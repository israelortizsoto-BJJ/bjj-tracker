import type { ParentAthlete } from "../storage/athleteStore";
import type { DeviceRole } from "../storage/deviceRoleStore";
import { isKidCoachArchived, type Kid, type KidsById } from "../types/coachKid";
import type { SyncedSharedAthlete } from "../types/coachWeeklySync";
import { buildCanonicalSharedAthletePrimaryRowMap } from "./canonicalSharedAthleteOwner";

export type WeeklyKeyNameMapping = {
  sharedAthleteId: string;
  athleteName: string | null;
};

function linkedKidIdForSharedAthlete(kidsById: KidsById, athleteId: string): string | null {
  const aid = athleteId.trim();
  if (!aid) return null;
  for (const k of Object.values(kidsById)) {
    if (!k?.id) continue;
    if ((k.sharedAthleteId ?? "").trim() === aid) return k.id;
  }
  return null;
}

export type LineageIntegrityWarningCode =
  | "LINEAGE_SPLIT_DETECTED"
  | "POTENTIAL_DUPLICATE_HUMAN"
  | "STALE_LINEAGE_LINKAGE"
  | "GHOST_ATHLETE_DETECTED";

export type LineageIntegrityWarning = {
  code: LineageIntegrityWarningCode;
  message: string;
  details: Record<string, unknown>;
};

export type WriterSessionAthletesSlice = {
  linkTokenNorm: string;
  athletes: readonly SyncedSharedAthlete[];
};

export type LineageIntegrityScanInput = {
  route: string;
  role?: DeviceRole | null;
  /** Active operating athlete id (parent `athleteStore` / OAI plane). */
  activeOperatingAthleteId?: string | null;
  parentAthletes?: readonly ParentAthlete[];
  operatingAthleteRoster?: readonly ParentAthlete[];
  kidsById?: KidsById;
  writerSessions?: readonly WriterSessionAthletesSlice[];
};

const warnedDedupeKeys = new Set<string>();

/** Normalized display name for duplicate-human clustering (DEV observability only). */
export function normalizeAthleteNameForLineage(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,']/g, "");
}

function warnKey(code: LineageIntegrityWarningCode, details: Record<string, unknown>): string {
  const parts: string[] = [code];
  for (const k of Object.keys(details).sort()) {
    const v = details[k];
    if (v == null || v === "") continue;
    parts.push(`${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
  return parts.join("|");
}

function pushWarning(
  out: LineageIntegrityWarning[],
  code: LineageIntegrityWarningCode,
  message: string,
  details: Record<string, unknown>,
): void {
  out.push({ code, message, details });
}

function athleteNameById(
  parentAthletes: readonly ParentAthlete[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of parentAthletes) {
    const id = a.id?.trim();
    if (!id) continue;
    map.set(id, (a.name ?? "").trim());
  }
  return map;
}

function activeKids(kidsById: KidsById): Kid[] {
  return Object.values(kidsById).filter((k) => k?.id && !isKidCoachArchived(k));
}

function detectOaiVsRosterMismatch(input: LineageIntegrityScanInput): LineageIntegrityWarning[] {
  const out: LineageIntegrityWarning[] = [];
  const oai = (input.activeOperatingAthleteId ?? "").trim();
  const kids = input.kidsById;
  if (!oai || !kids) return out;

  const namesByParentId = athleteNameById(input.parentAthletes ?? []);
  const oaiName =
    namesByParentId.get(oai) ??
    (input.operatingAthleteRoster ?? []).find((a) => a.id.trim() === oai)?.name?.trim() ??
    "";

  const kidBySharedLink = linkedKidIdForSharedAthlete(kids, oai);
  if (kidBySharedLink) return out;

  for (const k of activeKids(kids)) {
    const kidSid = (k.sharedAthleteId ?? "").trim();
    if (!kidSid || kidSid === oai) continue;

    const kidNameNorm = normalizeAthleteNameForLineage(k.name ?? "");
    const oaiNameNorm = oaiName ? normalizeAthleteNameForLineage(oaiName) : "";
    const nameAligned =
      Boolean(oaiNameNorm && kidNameNorm) && kidNameNorm === oaiNameNorm;

    if (!nameAligned) continue;

    pushWarning(out, "LINEAGE_SPLIT_DETECTED", "Active OAI id differs from linked roster kid sharedAthleteId", {
      athleteName: oaiName || k.name,
      oaiSharedAthleteId: oai,
      rosterSharedAthleteId: kidSid,
      linkedKidId: k.id,
      inviteToken: (k.sharedFromInviteTokenNorm ?? "").trim() || null,
      route: input.route,
      role: input.role ?? null,
    });
  }

  return out;
}

function detectDuplicateHumans(input: LineageIntegrityScanInput): LineageIntegrityWarning[] {
  const out: LineageIntegrityWarning[] = [];
  const byNorm = new Map<
    string,
    { sharedIds: Set<string>; sources: Set<string>; displayName: string }
  >();

  const ingest = (name: string, sharedId: string, source: string) => {
    const sid = sharedId.trim();
    if (!sid) return;
    const norm = normalizeAthleteNameForLineage(name);
    if (!norm) return;
    const bucket = byNorm.get(norm) ?? {
      sharedIds: new Set<string>(),
      sources: new Set<string>(),
      displayName: name.trim(),
    };
    bucket.sharedIds.add(sid);
    bucket.sources.add(source);
    byNorm.set(norm, bucket);
  };

  for (const a of input.parentAthletes ?? []) {
    ingest(a.name ?? "", a.id, "parent_athlete_store");
  }

  for (const k of activeKids(input.kidsById ?? {})) {
    const sid = (k.sharedAthleteId ?? "").trim();
    if (sid) ingest(k.name ?? "", sid, "coach_kid_store");
  }

  for (const sess of input.writerSessions ?? []) {
    for (const a of sess.athletes) {
      const id = typeof a.id === "string" ? a.id.trim() : "";
      if (!id) continue;
      ingest(a.name ?? "", id, `writer_session:${sess.linkTokenNorm}`);
    }
  }

  for (const [normalizedName, bucket] of byNorm) {
    if (bucket.sharedIds.size < 2) continue;
    pushWarning(out, "POTENTIAL_DUPLICATE_HUMAN", "Multiple shared athlete ids for the same normalized name", {
      normalizedName,
      athleteName: bucket.displayName,
      sharedAthleteIds: [...bucket.sharedIds].sort(),
      sourceStores: [...bucket.sources].sort(),
      route: input.route,
      role: input.role ?? null,
    });
  }

  return out;
}

function remoteAthleteIdsForToken(
  writerSessions: readonly WriterSessionAthletesSlice[] | undefined,
  tokenNorm: string,
): Set<string> {
  const ids = new Set<string>();
  for (const sess of writerSessions ?? []) {
    if (sess.linkTokenNorm !== tokenNorm) continue;
    for (const a of sess.athletes) {
      const id = typeof a.id === "string" ? a.id.trim() : "";
      if (id) ids.add(id);
    }
  }
  return ids;
}

function detectStaleLinkage(input: LineageIntegrityScanInput): LineageIntegrityWarning[] {
  const out: LineageIntegrityWarning[] = [];
  const oai = (input.activeOperatingAthleteId ?? "").trim();
  const kids = input.kidsById ?? {};
  const parentIds = new Set(
    (input.parentAthletes ?? []).map((a) => a.id.trim()).filter(Boolean),
  );
  const operatingIds = new Set(
    (input.operatingAthleteRoster ?? []).map((a) => a.id.trim()).filter(Boolean),
  );

  if (oai && operatingIds.size > 0 && !operatingIds.has(oai)) {
    pushWarning(out, "STALE_LINEAGE_LINKAGE", "Active OAI is absent from operating athlete roster", {
      athleteName:
        (input.parentAthletes ?? []).find((a) => a.id.trim() === oai)?.name?.trim() ?? null,
      oaiSharedAthleteId: oai,
      operatingRosterIds: [...operatingIds].sort(),
      route: input.route,
      role: input.role ?? null,
    });
  }

  for (const k of activeKids(kids)) {
    const kidSid = (k.sharedAthleteId ?? "").trim();
    const token = (k.sharedFromInviteTokenNorm ?? "").trim();

    if (kidSid && !parentIds.has(kidSid)) {
      pushWarning(out, "STALE_LINEAGE_LINKAGE", "Kid sharedAthleteId has no matching parent athlete row", {
        athleteName: k.name,
        rosterSharedAthleteId: kidSid,
        linkedKidId: k.id,
        inviteToken: token || null,
        route: input.route,
        role: input.role ?? null,
      });
    }

    if (token && kidSid) {
      const remoteIds = remoteAthleteIdsForToken(input.writerSessions, token);
      if (remoteIds.size > 0 && !remoteIds.has(kidSid)) {
        const remoteSameName = [...remoteIds].filter((rid) => {
          const remote = (input.writerSessions ?? [])
            .flatMap((s) => s.athletes)
            .find((a) => a.id.trim() === rid);
          if (!remote) return false;
          return (
            normalizeAthleteNameForLineage(remote.name ?? "") ===
            normalizeAthleteNameForLineage(k.name ?? "")
          );
        });
        pushWarning(
          out,
          "STALE_LINEAGE_LINKAGE",
          "Invite writer session roster no longer contains kid sharedAthleteId",
          {
            athleteName: k.name,
            rosterSharedAthleteId: kidSid,
            linkedKidId: k.id,
            inviteToken: token,
            remoteSessionAthleteIds: [...remoteIds].sort(),
            remoteSameNameCandidateIds: remoteSameName,
            route: input.route,
            role: input.role ?? null,
          },
        );
      }
    }

    if (oai && kidSid && kidSid !== oai) {
      const canonicalKid = buildCanonicalSharedAthletePrimaryRowMap(kids).get(oai);
      if (canonicalKid && canonicalKid.id !== k.id && canonicalKid.sharedAthleteId?.trim() === oai) {
        const kidNameNorm = normalizeAthleteNameForLineage(k.name ?? "");
        const canonNameNorm = normalizeAthleteNameForLineage(canonicalKid.name ?? "");
        if (kidNameNorm && kidNameNorm === canonNameNorm) {
          pushWarning(
            out,
            "STALE_LINEAGE_LINKAGE",
            "Non-canonical kid row name matches canonical active athlete but shared id differs",
            {
              athleteName: k.name,
              oaiSharedAthleteId: oai,
              rosterSharedAthleteId: kidSid,
              linkedKidId: k.id,
              canonicalKidId: canonicalKid.id,
              inviteToken: token || null,
              route: input.route,
              role: input.role ?? null,
            },
          );
        }
      }
    }
  }

  return out;
}

function detectGhostAthletes(input: LineageIntegrityScanInput): LineageIntegrityWarning[] {
  const out: LineageIntegrityWarning[] = [];
  const oai = (input.activeOperatingAthleteId ?? "").trim();
  const kids = input.kidsById ?? {};
  const operatingIds = new Set(
    (input.operatingAthleteRoster ?? []).map((a) => a.id.trim()).filter(Boolean),
  );
  const referencedSharedIds = new Set<string>();

  for (const k of activeKids(kids)) {
    const sid = (k.sharedAthleteId ?? "").trim();
    if (sid) referencedSharedIds.add(sid);
  }

  for (const a of input.parentAthletes ?? []) {
    const id = a.id.trim();
    if (!id) continue;
    const isLocalOnly = a.operatingScope === "local_only";
    const onRoster = operatingIds.has(id);
    const referencedByKid = referencedSharedIds.has(id);
    if (!isLocalOnly && !onRoster && !referencedByKid && id !== oai) {
      pushWarning(out, "GHOST_ATHLETE_DETECTED", "Parent athlete row is not on operating roster or kid linkage", {
        athleteName: a.name,
        sharedAthleteId: id,
        route: input.route,
        role: input.role ?? null,
      });
    }
  }

  for (const sid of referencedSharedIds) {
    const onRoster = operatingIds.has(sid);
    const isActive = sid === oai;
    if (!onRoster && !isActive) {
      const kid = buildCanonicalSharedAthletePrimaryRowMap(kids).get(sid);
      pushWarning(out, "GHOST_ATHLETE_DETECTED", "Shared athlete id referenced by kid but not operating/canonical", {
        athleteName: kid?.name ?? null,
        sharedAthleteId: sid,
        linkedKidId: kid?.id ?? null,
        inviteToken: (kid?.sharedFromInviteTokenNorm ?? "").trim() || null,
        route: input.route,
        role: input.role ?? null,
      });
    }
  }

  const byNorm = new Map<string, ParentAthlete[]>();
  for (const a of input.operatingAthleteRoster ?? []) {
    const norm = normalizeAthleteNameForLineage(a.name ?? "");
    if (!norm) continue;
    const list = byNorm.get(norm) ?? [];
    list.push(a);
    byNorm.set(norm, list);
  }
  for (const [normalizedName, rows] of byNorm) {
    if (rows.length < 2) continue;
    pushWarning(out, "GHOST_ATHLETE_DETECTED", "Multiple operating athletes share the same normalized name", {
      normalizedName,
      sharedAthleteIds: rows.map((r) => r.id.trim()).filter(Boolean).sort(),
      athleteNames: rows.map((r) => r.name?.trim()).filter(Boolean),
      route: input.route,
      role: input.role ?? null,
    });
  }

  return out;
}

export function scanLineageIntegrity(input: LineageIntegrityScanInput): LineageIntegrityWarning[] {
  if (!__DEV__) return [];
  return [
    ...detectOaiVsRosterMismatch(input),
    ...detectDuplicateHumans(input),
    ...detectStaleLinkage(input),
    ...detectGhostAthletes(input),
  ];
}

export function duplicateSharedIdsByAthleteName(
  mappings: readonly WeeklyKeyNameMapping[],
): Record<string, string[]> {
  if (!__DEV__) return {};
  const byNorm = new Map<string, Set<string>>();
  for (const m of mappings) {
    const sid = m.sharedAthleteId.trim();
    const name = (m.athleteName ?? "").trim();
    if (!sid || !name) continue;
    const norm = normalizeAthleteNameForLineage(name);
    if (!norm) continue;
    const set = byNorm.get(norm) ?? new Set<string>();
    set.add(sid);
    byNorm.set(norm, set);
  }
  const out: Record<string, string[]> = {};
  for (const [norm, ids] of byNorm) {
    if (ids.size < 2) continue;
    out[norm] = [...ids].sort();
  }
  return out;
}

export function logLineageIntegrityWarnings(
  warnings: readonly LineageIntegrityWarning[],
  ctx?: { route?: string },
): void {
  if (!__DEV__ || warnings.length === 0) return;

  for (const w of warnings) {
    const key = warnKey(w.code, { ...w.details, route: ctx?.route ?? w.details.route });
    if (warnedDedupeKeys.has(key)) continue;
    warnedDedupeKeys.add(key);

    console.warn(`[${w.code}]`, w.message, w.details);
    console.log("[LINEAGE_INTEGRITY]", {
      code: w.code,
      message: w.message,
      ...w.details,
    });
  }
}

export type LineageIntegrityDevSnapshot = {
  warningCount: number;
  codes: LineageIntegrityWarningCode[];
  route: string | null;
  updatedAt: number;
};

let lastDevSnapshot: LineageIntegrityDevSnapshot = {
  warningCount: 0,
  codes: [],
  route: null,
  updatedAt: 0,
};

export function getLineageIntegrityDevSnapshot(): LineageIntegrityDevSnapshot {
  return lastDevSnapshot;
}

export function runLineageIntegrityScan(input: LineageIntegrityScanInput): LineageIntegrityWarning[] {
  const warnings = scanLineageIntegrity(input);
  if (__DEV__) {
    lastDevSnapshot = {
      warningCount: warnings.length,
      codes: [...new Set(warnings.map((w) => w.code))],
      route: input.route,
      updatedAt: Date.now(),
    };
    logLineageIntegrityWarnings(warnings, { route: input.route });
  }
  return warnings;
}

/** DEV-only: clear dedupe so repeated scans after intentional state changes still log. */
export function resetLineageIntegrityDedupeDev(): void {
  if (!__DEV__) return;
  warnedDedupeKeys.clear();
}
