import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseCoachMatchBreakdownArtifactSet,
  type CoachMatchBreakdownArtifactSet,
} from "./coachMatchBreakdownArtifacts.ts";
import {
  COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_BLOCKED_FORENSIC_STAGE,
  COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_DISABLED_CODE,
  COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_DISABLED_ERROR,
  buildCoachMatchBreakdownSchemaV2PublicationDisabledResponse,
  coachMatchBreakdownSchemaV2PublicationDisabledBody,
  decideCoachMatchBreakdownPut,
  isCoachMatchBreakdownSchemaV2PublicationEnabled,
  logCoachMatchBreakdownSchemaV2PublicationBlocked,
} from "./coachMatchBreakdownSchemaV2Publication.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ATHLETE = "shared_ath_1";
const SECRET = "writer-secret";
const MEDIA_ID = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const ALIGNMENT = {
  commentaryStartVideoMs: 1200,
  matchMediaAssetId: "asset-1",
  attachmentRevision: 3,
} as const;

function artifactFields(overrides: Record<string, unknown> = {}) {
  return {
    sharedAthleteId: ATHLETE,
    sharedCompetitionId: "shared_comp_1",
    matchLineageKey: "match_1",
    coachNote: "Keep pressure.",
    mediaId: MEDIA_ID,
    durationMs: 12_000,
    mimeType: "audio/mp4",
    updatedAt: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

function rawSet(
  schemaVersion: 1 | 2,
  overrides: {
    updatedAt?: string;
    sharedAthleteId?: string;
    artifactOverrides?: Record<string, unknown>;
  } = {},
) {
  const sharedAthleteId = overrides.sharedAthleteId ?? ATHLETE;
  const updatedAt = overrides.updatedAt ?? "2026-07-20T00:00:00.000Z";
  return {
    schemaVersion,
    sharedAthleteId,
    updatedAt,
    artifacts: [
      artifactFields({
        sharedAthleteId,
        updatedAt,
        alignment: ALIGNMENT,
        ...(overrides.artifactOverrides ?? {}),
      }),
    ],
  };
}

function sessionWith(
  existing: CoachMatchBreakdownArtifactSet | undefined,
  athletes: Array<{ id: string }> = [{ id: ATHLETE }],
) {
  return {
    writerSecret: SECRET,
    athletes,
    coachMatchBreakdownArtifacts: existing
      ? { [existing.sharedAthleteId]: existing }
      : ({} as Record<string, CoachMatchBreakdownArtifactSet>),
  };
}

/**
 * Route-shaped harness: parse → decide → optional KV mutation.
 * Mirrors PUT /v1/sessions/:token/coach-match-breakdowns post-parse policy.
 */
function simulatePut(input: {
  capability: string | undefined;
  body: unknown;
  secret: string;
  priorRemoteJson: string | null;
}) {
  const kv = {
    value: input.priorRemoteJson,
    writes: 0,
  };
  const artifactSet = parseCoachMatchBreakdownArtifactSet(input.body);
  if (!artifactSet) {
    return { status: 400 as const, kv, body: { error: "Invalid coach match breakdown artifact set" } };
  }
  const priorArtifacts = input.priorRemoteJson
    ? (JSON.parse(input.priorRemoteJson) as Record<string, CoachMatchBreakdownArtifactSet>)
    : {};
  const decision = decideCoachMatchBreakdownPut({
    capability: input.capability,
    providedSecret: input.secret,
    artifactSet,
    session: {
      writerSecret: SECRET,
      athletes: [{ id: ATHLETE }],
      coachMatchBreakdownArtifacts: priorArtifacts,
    },
  });
  if (decision.kind === "unauthorized") {
    return { status: 401 as const, kv, body: { error: "Unauthorized" } };
  }
  if (decision.kind === "athlete_scope_denied") {
    return {
      status: 400 as const,
      kv,
      body: { error: "sharedAthleteId is not linked to this session" },
    };
  }
  if (decision.kind === "schema_v2_publication_disabled") {
    const response = buildCoachMatchBreakdownSchemaV2PublicationDisabledResponse();
    return {
      status: 409 as const,
      kv,
      body: coachMatchBreakdownSchemaV2PublicationDisabledBody(),
      response,
    };
  }
  if (decision.kind === "stale") {
    return {
      status: 409 as const,
      kv,
      body: { error: "Coach match breakdown artifact set is stale" },
    };
  }
  if (decision.kind === "equal_timestamp_conflict") {
    return {
      status: 409 as const,
      kv,
      body: { error: "Coach match breakdown artifact timestamp conflict" },
    };
  }
  kv.value = JSON.stringify(decision.nextCoachMatchBreakdownArtifacts);
  kv.writes += 1;
  return { status: 200 as const, kv, body: { ok: true }, artifactSet };
}

describe("isCoachMatchBreakdownSchemaV2PublicationEnabled", () => {
  it("enables only exact string 1", () => {
    assert.equal(isCoachMatchBreakdownSchemaV2PublicationEnabled(undefined), false);
    assert.equal(isCoachMatchBreakdownSchemaV2PublicationEnabled("0"), false);
    assert.equal(isCoachMatchBreakdownSchemaV2PublicationEnabled("true"), false);
    assert.equal(isCoachMatchBreakdownSchemaV2PublicationEnabled("01"), false);
    assert.equal(isCoachMatchBreakdownSchemaV2PublicationEnabled("1"), true);
  });
});

describe("Coach Match Breakdown schema-v2 publication interlock", () => {
  const capabilityStates: Array<string | undefined> = [undefined, "0", "true", "01", "1"];

  for (const capability of capabilityStates) {
    it(`schema v1 succeeds under capability ${JSON.stringify(capability)}`, () => {
      const parsed = parseCoachMatchBreakdownArtifactSet(rawSet(1));
      assert.ok(parsed);
      const decision = decideCoachMatchBreakdownPut({
        capability,
        providedSecret: SECRET,
        artifactSet: parsed,
        session: sessionWith(undefined),
      });
      assert.equal(decision.kind, "accept");
      if (decision.kind === "accept") {
        assert.equal(
          decision.nextCoachMatchBreakdownArtifacts[ATHLETE]?.schemaVersion,
          1,
        );
      }
    });
  }

  for (const capability of [undefined, "0", "true", "01"] as const) {
    it(`blocks schema v2 when capability is ${JSON.stringify(capability)}`, async () => {
      const prior = parseCoachMatchBreakdownArtifactSet(
        rawSet(1, { updatedAt: "2026-07-10T00:00:00.000Z" }),
      );
      assert.ok(prior);
      const priorRemoteJson = JSON.stringify({ [ATHLETE]: prior });
      const result = simulatePut({
        capability,
        body: rawSet(2),
        secret: SECRET,
        priorRemoteJson,
      });
      assert.equal(result.status, 409);
      assert.deepEqual(result.body, {
        error: COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_DISABLED_ERROR,
        code: COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_DISABLED_CODE,
      });
      assert.equal(result.kv.writes, 0);
      assert.equal(result.kv.value, priorRemoteJson);
      if ("response" in result && result.response) {
        assert.equal(result.response.status, 409);
        assert.deepEqual(await result.response.json(), result.body);
      }
    });
  }

  it("exact 1 permits schema v2 with alignment retained", () => {
    const parsed = parseCoachMatchBreakdownArtifactSet(rawSet(2));
    assert.ok(parsed);
    assert.deepEqual(parsed.artifacts[0]?.alignment, ALIGNMENT);
    const decision = decideCoachMatchBreakdownPut({
      capability: "1",
      providedSecret: SECRET,
      artifactSet: parsed,
      session: sessionWith(undefined),
    });
    assert.equal(decision.kind, "accept");
    if (decision.kind === "accept") {
      assert.deepEqual(
        decision.nextCoachMatchBreakdownArtifacts[ATHLETE]?.artifacts[0]?.alignment,
        ALIGNMENT,
      );
    }
  });

  it("schema v1 retains media metadata and strips alignment", () => {
    const parsed = parseCoachMatchBreakdownArtifactSet(rawSet(1));
    assert.ok(parsed);
    const artifact = parsed.artifacts[0];
    assert.ok(artifact);
    assert.equal(artifact.coachNote, "Keep pressure.");
    assert.equal(artifact.mediaId, MEDIA_ID);
    assert.equal(artifact.durationMs, 12_000);
    assert.equal(artifact.mimeType, "audio/mp4");
    assert.equal(artifact.alignment, undefined);
  });

  it("invalid authentication still returns 401", () => {
    const parsed = parseCoachMatchBreakdownArtifactSet(rawSet(1));
    assert.ok(parsed);
    assert.equal(
      decideCoachMatchBreakdownPut({
        capability: "1",
        providedSecret: "wrong",
        artifactSet: parsed,
        session: sessionWith(undefined),
      }).kind,
      "unauthorized",
    );
    assert.equal(
      simulatePut({
        capability: "0",
        body: rawSet(2),
        secret: "wrong",
        priorRemoteJson: null,
      }).status,
      401,
    );
  });

  it("invalid payload still returns 400", () => {
    assert.equal(parseCoachMatchBreakdownArtifactSet({ schemaVersion: 3, artifacts: [] }), null);
    assert.equal(
      simulatePut({
        capability: "1",
        body: { not: "valid" },
        secret: SECRET,
        priorRemoteJson: null,
      }).status,
      400,
    );
  });

  it("athlete-scope authorization failure remains unchanged", () => {
    const parsed = parseCoachMatchBreakdownArtifactSet(
      rawSet(1, { sharedAthleteId: "other_athlete" }),
    );
    assert.ok(parsed);
    assert.equal(
      decideCoachMatchBreakdownPut({
        capability: "1",
        providedSecret: SECRET,
        artifactSet: parsed,
        session: sessionWith(undefined),
      }).kind,
      "athlete_scope_denied",
    );
  });

  it("stale-timestamp behavior remains unchanged when v2 enabled", () => {
    const existing = parseCoachMatchBreakdownArtifactSet(
      rawSet(1, { updatedAt: "2026-07-20T00:00:00.000Z" }),
    );
    const incoming = parseCoachMatchBreakdownArtifactSet(
      rawSet(2, { updatedAt: "2026-07-19T00:00:00.000Z" }),
    );
    assert.ok(existing && incoming);
    assert.equal(
      decideCoachMatchBreakdownPut({
        capability: "1",
        providedSecret: SECRET,
        artifactSet: incoming,
        session: sessionWith(existing),
      }).kind,
      "stale",
    );
  });

  it("equal-timestamp conflict behavior remains unchanged when v2 enabled", () => {
    const existing = parseCoachMatchBreakdownArtifactSet(
      rawSet(1, { updatedAt: "2026-07-20T00:00:00.000Z" }),
    );
    const incoming = parseCoachMatchBreakdownArtifactSet(
      rawSet(2, {
        updatedAt: "2026-07-20T00:00:00.000Z",
        artifactOverrides: { coachNote: "Different note." },
      }),
    );
    assert.ok(existing && incoming);
    assert.equal(
      decideCoachMatchBreakdownPut({
        capability: "1",
        providedSecret: SECRET,
        artifactSet: incoming,
        session: sessionWith(existing),
      }).kind,
      "equal_timestamp_conflict",
    );
  });

  it("blocked-v2 forensic event contains no secrets or complete payload", () => {
    const lines: unknown[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args);
    };
    try {
      logCoachMatchBreakdownSchemaV2PublicationBlocked({
        traceId: "trace-1",
        tokenSuffix: "abcdef12",
        sharedAthleteId: ATHLETE,
        artifactCount: 1,
        updatedAt: "2026-07-20T00:00:00.000Z",
      });
    } finally {
      console.log = original;
    }
    assert.equal(lines.length, 1);
    const entry = lines[0] as unknown[];
    assert.equal(entry[0], "[OVERLAY_FORENSIC]");
    const payload = entry[1] as Record<string, unknown>;
    assert.equal(
      payload.stage,
      COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_BLOCKED_FORENSIC_STAGE,
    );
    const serialized = JSON.stringify(payload);
    assert.doesNotMatch(serialized, /writer-secret|Bearer|Keep pressure|alignment|bbbbbbbb/);
    assert.equal(payload.sharedAthleteId, ATHLETE);
    assert.equal(payload.schemaVersion, 2);
    assert.equal(payload.artifactCount, 1);
    assert.equal("artifacts" in payload, false);
    assert.equal("coachNote" in payload, false);
    assert.equal("mediaId" in payload, false);
  });

  it("repository default capability is explicitly 0", () => {
    const wrangler = readFileSync(path.join(root, "coach-sync-worker/wrangler.toml"), "utf8");
    assert.match(
      wrangler,
      /COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_ENABLED = "0"/,
    );
  });

  it("route guard placement is after auth/scope and before stale/KV write", () => {
    const worker = readFileSync(path.join(root, "coach-sync-worker/src/index.ts"), "utf8");
    const putStart = worker.indexOf("const coachMatchBreakdownsPut = path.match");
    const putEnd = worker.indexOf("const competitionTopologyPut = path.match", putStart);
    assert.ok(putStart > 0 && putEnd > putStart);
    const put = worker.slice(putStart, putEnd);
    const parseIdx = put.indexOf("parseCoachMatchBreakdownArtifactSet(body)");
    const decideIdx = put.indexOf("decideCoachMatchBreakdownPut(");
    const disabledIdx = put.indexOf('decision.kind === "schema_v2_publication_disabled"');
    const staleIdx = put.indexOf('decision.kind === "stale"');
    const writeIdx = put.indexOf("await writeSession(env.SESSIONS, token, next)");
    assert.ok(parseIdx > 0 && decideIdx > parseIdx);
    assert.ok(disabledIdx > decideIdx);
    assert.ok(staleIdx > disabledIdx);
    assert.ok(writeIdx > staleIdx);
    assert.match(put, /env\.COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_ENABLED/);
  });

  it("GET and playback behavior sources remain unchanged by this interlock", () => {
    const worker = readFileSync(path.join(root, "coach-sync-worker/src/index.ts"), "utf8");
    const filmRoom = readFileSync(
      path.join(root, "src/features/filmRoom/FilmRoomScreen.tsx"),
      "utf8",
    );
    const playbackDir = path.join(root, "src/playback");
    assert.match(worker, /sessionGet && request\.method === "GET"/);
    assert.doesNotMatch(
      worker,
      /COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_ENABLED[\s\S]{0,200}sessionGet && request\.method === "GET"/,
    );
    assert.doesNotMatch(filmRoom, /COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION/);
    const playbackFiles = readFileSync(
      path.join(root, "src/features/filmRoom/tests/filmRoomSingleClockAuthorityCorridor.test.ts"),
      "utf8",
    );
    assert.doesNotMatch(playbackFiles, /COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION/);
    assert.ok(playbackDir);
  });
});
