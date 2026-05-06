import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { SummaryIdentityInputsShape } from "../../domain/metrics";
import {
  computeCompetitionRecord,
  computeConfidence,
  computeCurrentFocus14d,
  computeFastestSub,
  computeGiNoGi14d,
  computeSubmissionRate,
  computeTopSystemThisWeek,
  computeTopTechniqueThisWeek,
  computeTotalSessionCount,
  computeWinRate,
  deriveIdentityDisplayName,
  METRIC_TILE_COMPETITION_RECORD_PLACEHOLDER,
  resolveSummaryIdentityMode,
  type SummaryConfidenceMetrics,
} from "../../domain/metrics";
import { resolveIntentLabel, resolveSystemLabel, resolveTechniqueLabel } from "../../domain/metricLabels";
import { useDeviceRole } from "../../deviceRole/DeviceRoleProvider";
import {
  normalizeSessionsLikeTraining,
  filterSessionsForTrainingScope,
  buildSessionsByDate,
} from "../../domain/sessionUtils";
import { SUMMARY_IDENTITY_ACCOUNT_SCOPE } from "../../types/summaryIdentityScope";
import { familyCompetitionResultLabel, formatFamilyCompetitionDate } from "../../family/coachShareCompetitionBuckets";
import type {
  CompetitionDetailMatchSnapshot,
  KidCompetitionEntryWithMatchDetail,
} from "../../storage/competitionStore";
import { getKidCompetitionEntriesWithMatchDetailForKid } from "../../storage/competitionStore";
import { getCompetitionVersion, subscribeCompetition } from "../../storage/kidCompetitionStore";
import { getKidsById, startOfWeekMondayYMD, todayYMD as todayKidYMD } from "../../storage/coachKidStore";
import { getSessions } from "../../storage/sessionsStore";
import { StorageKeys } from "../../storage/storageKeys";
import type { Session } from "../../types";
import { setActiveKidId, useActiveKidId } from "../../state/activeKidStore";

import AthleteSwitcher, { type AthleteOption } from "./components/AthleteSwitcher";
import CompetitionCard from "./components/CompetitionCard";
import IdentityCard from "./components/IdentityCard";
import MetricTile from "./components/MetricTile";

/** Second chip when no roster kid exists yet (sessions stay empty until real athletes are added). */
const MOCK_SECOND_ATHLETE_KEY = "__summary_v2_mock_second__";

const ICON_TRAINING = require("../../../assets/icons/training.png");
const ICON_SYSTEM = require("../../../assets/icons/system.png");
const ICON_TECHNIQUE = require("../../../assets/icons/technique.png");
const ICON_FOCUS = require("../../../assets/icons/focus.png");
const ICON_GI = require("../../../assets/icons/gi.png");

function addDaysLocal(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseProfileRoot(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function parseIdentityInputsFromUnknown(raw: unknown): SummaryIdentityInputsShape {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const role = typeof o.role === "string" ? o.role : undefined;
  const competition = typeof o.competition === "string" ? o.competition : undefined;
  return { role, competition };
}

function readIntent(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const v = (raw as Record<string, unknown>).intent;
  return typeof v === "string" ? v : undefined;
}

function getScopedIdentityFromProfile(
  profileRoot: Record<string, unknown> | null,
  scope: string
): { inputs: SummaryIdentityInputsShape; modeFromStore: unknown; intentValue: string | undefined } {
  if (!profileRoot) return { inputs: {}, modeFromStore: undefined, intentValue: undefined };

  const byScopeRaw = profileRoot.summaryIdentityByScope;
  if (byScopeRaw && typeof byScopeRaw === "object" && !Array.isArray(byScopeRaw)) {
    const bucket = (byScopeRaw as Record<string, unknown>)[scope];
    if (bucket && typeof bucket === "object" && !Array.isArray(bucket)) {
      const br = bucket as Record<string, unknown>;
      const inputsUnknown = br.summaryIdentityInputs;
      const modeFromStore = br.summaryIdentityMode;
      return {
        inputs: parseIdentityInputsFromUnknown(inputsUnknown),
        modeFromStore,
        intentValue: readIntent(inputsUnknown),
      };
    }
  }

  if (scope === SUMMARY_IDENTITY_ACCOUNT_SCOPE) {
    const inputsUnknown = profileRoot.summaryIdentityInputs;
    return {
      inputs: parseIdentityInputsFromUnknown(inputsUnknown),
      modeFromStore: profileRoot.summaryIdentityMode,
      intentValue: readIntent(inputsUnknown),
    };
  }

  return { inputs: {}, modeFromStore: undefined, intentValue: undefined };
}

function formatGiVsNoGi(metric: SummaryConfidenceMetrics["giNoGi"]): string {
  if (!metric) return "";
  const total = metric.gi + metric.nogi;
  if (total <= 0) return "";
  const giPct = Math.round((metric.gi / total) * 100);
  return `${giPct}% ${metric.primary}`;
}

function normalizeRecordHyphen(record: string): string {
  return record.replace(/-/g, "–");
}

export default function SummaryScreenV2() {
  const { role: deviceRole } = useDeviceRole();
  const activeKidFromStore = useActiveKidId();

  const today = todayKidYMD();
  const weekStartMonday = startOfWeekMondayYMD(today);

  const [competitionBump, setCompetitionBump] = useState(() => getCompetitionVersion());

  const [profileRoot, setProfileRoot] = useState<Record<string, unknown> | null>(null);
  const [kidsByIdSnapshot, setKidsByIdSnapshot] = useState<Awaited<ReturnType<typeof getKidsById>>>({});

  const [selectedAthleteKey, setSelectedAthleteKey] = useState<string>(
    () => activeKidFromStore ?? SUMMARY_IDENTITY_ACCOUNT_SCOPE
  );

  React.useEffect(() => {
    const unsubscribe = subscribeCompetition(() => setCompetitionBump(getCompetitionVersion()));
    return () => {
      unsubscribe();
    };
  }, []);

  const athleteOptions: AthleteOption[] = useMemo(() => {
    const kidsSorted = Object.values(kidsByIdSnapshot)
      .filter((k) => (k?.name ?? "").trim().length > 0)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    const defaults: AthleteOption[] = [
      {
        key: SUMMARY_IDENTITY_ACCOUNT_SCOPE,
        name: "Ava",
        belt: "Blue Belt",
        avatar: "A",
      },
      {
        key: MOCK_SECOND_ATHLETE_KEY,
        name: "Mia",
        belt: "White Belt",
        avatar: "M",
      },
      {
        key: "__summary_v2_mock_third__",
        name: "Jin",
        belt: "Gray Belt",
        avatar: "J",
      },
    ];

    if (kidsSorted.length <= 0) {
      return defaults;
    }

    const dynamic = kidsSorted.slice(0, 3).map((kid, index) => {
      const fallback = defaults[index] ?? defaults[defaults.length - 1];
      return {
        key: kid.id,
        name: kid.name.trim() || fallback.name,
        belt: fallback.belt,
        avatar: (kid.name.trim().charAt(0) || fallback.avatar).toUpperCase(),
      };
    });

    if (dynamic.length < 3) {
      return [...dynamic, ...defaults.slice(dynamic.length)];
    }

    return dynamic;
  }, [kidsByIdSnapshot]);

  const effectiveScope = useMemo(() => {
    if (selectedAthleteKey === MOCK_SECOND_ATHLETE_KEY || selectedAthleteKey === "__summary_v2_mock_third__") {
      return MOCK_SECOND_ATHLETE_KEY;
    }
    return selectedAthleteKey;
  }, [selectedAthleteKey]);

  const selectedKidIdForCompetition = useMemo(() => {
    if (
      effectiveScope === SUMMARY_IDENTITY_ACCOUNT_SCOPE ||
      effectiveScope === MOCK_SECOND_ATHLETE_KEY
    ) {
      return null;
    }
    return effectiveScope;
  }, [effectiveScope]);

  type LoadShape = {
    sessionsByDate: Record<string, Session[]>;
    mergedMatches: CompetitionDetailMatchSnapshot[];
    competitionEntries: KidCompetitionEntryWithMatchDetail[];
  };

  const [loaded, setLoaded] = useState<LoadShape | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const [profileRaw, kids, rows] = await Promise.all([
          AsyncStorage.getItem(StorageKeys.profile),
          getKidsById(),
          getSessions(),
        ]);

        const normalized = normalizeSessionsLikeTraining(rows);
        const scoped =
          effectiveScope === MOCK_SECOND_ATHLETE_KEY
            ? []
            : filterSessionsForTrainingScope(
                normalized,
                effectiveScope === SUMMARY_IDENTITY_ACCOUNT_SCOPE ? SUMMARY_IDENTITY_ACCOUNT_SCOPE : effectiveScope,
                deviceRole
              );

        const byDate = buildSessionsByDate(scoped);

        let mergedMatches: CompetitionDetailMatchSnapshot[] = [];
        let competitionEntries: KidCompetitionEntryWithMatchDetail[] = [];
        if (selectedKidIdForCompetition) {
          competitionEntries = await getKidCompetitionEntriesWithMatchDetailForKid(
            selectedKidIdForCompetition,
          );
          for (const e of competitionEntries) {
            mergedMatches.push(...e.matches);
          }
        }

        if (cancelled) return;
        setProfileRoot(parseProfileRoot(profileRaw));
        setKidsByIdSnapshot(kids);
        setLoaded({ sessionsByDate: byDate, mergedMatches, competitionEntries });
      })();
      return () => {
        cancelled = true;
      };
    }, [deviceRole, effectiveScope, selectedKidIdForCompetition, competitionBump])
  );

  const sessionsByDateEffective = loaded?.sessionsByDate ?? {};
  const mergedMatchesEffective = loaded?.mergedMatches ?? [];
  const competitionEntriesEffective = loaded?.competitionEntries ?? [];

  const confidenceMetrics = useMemo((): SummaryConfidenceMetrics => {
    const weekDates = Array.from({ length: 7 }, (_, i) => addDaysLocal(weekStartMonday, i));
    const weekSessionsFlat: Session[] = [];
    for (const ymd of weekDates) {
      weekSessionsFlat.push(...(sessionsByDateEffective[ymd] ?? []));
    }
    weekSessionsFlat.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const topSystem = computeTopSystemThisWeek(weekSessionsFlat);
    const topTechnique = computeTopTechniqueThisWeek(weekSessionsFlat);
    const sessionsThisWeek = weekSessionsFlat.length;

    return {
      sessionsThisWeek,
      topSystem,
      topTechnique,
      currentFocus: computeCurrentFocus14d(sessionsByDateEffective, today),
      giNoGi: computeGiNoGi14d(sessionsByDateEffective, today),
    };
  }, [sessionsByDateEffective, today, weekStartMonday]);

  const identityTitle = useMemo(() => {
    const { inputs, modeFromStore, intentValue } = getScopedIdentityFromProfile(profileRoot, effectiveScope);
    const mode = resolveSummaryIdentityMode(modeFromStore, inputs);
    const systemLabel = confidenceMetrics.topSystem
      ? resolveSystemLabel(confidenceMetrics.topSystem.systemId)
      : "";
    const techniqueLabel = confidenceMetrics.topTechnique
      ? resolveTechniqueLabel(confidenceMetrics.topTechnique.techniqueId)
      : "";
    const intentLabel = resolveIntentLabel(intentValue);
    return deriveIdentityDisplayName(mode, {
      systemLabel,
      intentLabel,
      techniqueLabel,
    });
  }, [profileRoot, effectiveScope, confidenceMetrics.topSystem, confidenceMetrics.topTechnique]);

  const identityScore = useMemo(() => computeConfidence(confidenceMetrics), [confidenceMetrics]);

  const trainingSessionsTotal = useMemo(
    () => computeTotalSessionCount(sessionsByDateEffective),
    [sessionsByDateEffective]
  );

  const metricValues = useMemo(() => {
    const topSystemLabel = confidenceMetrics.topSystem
      ? resolveSystemLabel(confidenceMetrics.topSystem.systemId)
      : "";
    const topTechLabel = confidenceMetrics.topTechnique
      ? resolveTechniqueLabel(confidenceMetrics.topTechnique.techniqueId)
      : "";
    const focusLabel = confidenceMetrics.currentFocus
      ? resolveSystemLabel(confidenceMetrics.currentFocus.systemId)
      : "";

    const giFmt = formatGiVsNoGi(confidenceMetrics.giNoGi);

    return {
      sessions: String(trainingSessionsTotal),
      topSystem: topSystemLabel,
      topTech: topTechLabel,
      focus: focusLabel,
      gi: giFmt,
    };
  }, [confidenceMetrics, trainingSessionsTotal]);

  const competitionView = useMemo(() => {
    const rawRecord = computeCompetitionRecord(mergedMatchesEffective);
    const recordOk = rawRecord !== METRIC_TILE_COMPETITION_RECORD_PLACEHOLDER && rawRecord.length > 0;
    const recordLabel = recordOk ? normalizeRecordHyphen(rawRecord) : "";

    const totalMatches = mergedMatchesEffective.length;
    let statWinRate = "";
    let statSubmissionRate = "";
    let statFastestSub = "";

    if (totalMatches > 0) {
      statWinRate = `${computeWinRate(mergedMatchesEffective)}%`;
      statSubmissionRate = `${computeSubmissionRate(mergedMatchesEffective)}%`;
      const fastest = computeFastestSub(mergedMatchesEffective);
      statFastestSub = fastest === "—" ? "" : fastest;
    }

    return { recordLabel, statWinRate, statSubmissionRate, statFastestSub };
  }, [mergedMatchesEffective]);

  const latestCompetitionFace = useMemo(() => {
    if (competitionEntriesEffective.length === 0) {
      return {
        latestSummary: "" as string,
        latestDateLine: "" as string,
        insight:
          "Log competitions with match detail to connect outcomes to what you drill in class.",
      };
    }
    const sorted = [...competitionEntriesEffective].sort((a, b) => {
      const byDate = b.eventDate.localeCompare(a.eventDate);
      if (byDate !== 0) return byDate;
      return b.createdAt.localeCompare(a.createdAt);
    });
    const entry = sorted[0]!;
    const name = entry.tournamentName.trim() || "Event";
    const latestSummary = `${familyCompetitionResultLabel(entry.result)} · ${name}`;
    const latestDateLine = formatFamilyCompetitionDate(entry.eventDate);
    const r = entry.result;
    let insight =
      "Name the hardest moment from that day and turn it into one clear training priority.";
    if (r === "gold") {
      insight =
        "A 1st-place outcome reinforces doubling down on trusted positions and finishes that already feel automatic.";
    } else if (r === "silver" || r === "bronze") {
      insight =
        "A 2nd or 3rd place often comes down to a handful of exchanges—pick one sequence to sharpen before the next event.";
    } else if (r === "dnf") {
      insight =
        "Use this week to reset pacing and preparation, with one steady technical theme for the next outing.";
    } else if (r === "other") {
      insight = "Translate what happened into one measurable focus in training this block.";
    }
    return { latestSummary, latestDateLine, insight };
  }, [competitionEntriesEffective]);

  const onSelectAthlete = useCallback(
    (key: string) => {
      setSelectedAthleteKey(key);
      if (
        key === SUMMARY_IDENTITY_ACCOUNT_SCOPE ||
        key === MOCK_SECOND_ATHLETE_KEY ||
        key === "__summary_v2_mock_third__"
      ) {
        setActiveKidId(null);
        return;
      }
      setActiveKidId(key);
    },
    []
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Summary</Text>

        <AthleteSwitcher
          athletes={athleteOptions}
          selectedKey={selectedAthleteKey}
          onSelect={onSelectAthlete}
        />

        <View style={styles.identityWrap}>
          <View style={styles.identityGlowBlue} />
          <View style={styles.identityGlowTeal} />
          <IdentityCard title={identityTitle} score={identityScore} />
        </View>

        <Text style={styles.sectionTitle}>System Dashboard</Text>

        <View style={styles.grid}>
          <MetricTile
            accent="green"
            iconSource={ICON_TRAINING}
            label="Training Sessions"
            value={metricValues.sessions}
          />
          <MetricTile accent="blue" iconSource={ICON_SYSTEM} label="Top System" value={metricValues.topSystem} />
          <MetricTile accent="yellow" iconSource={ICON_TECHNIQUE} label="Top Technique" value={metricValues.topTech} />
          <MetricTile accent="green" iconSource={ICON_FOCUS} label="14-Day Focus" value={metricValues.focus} />
          <MetricTile accent="blue" iconSource={ICON_GI} label="Gi vs No-Gi" value={metricValues.gi} />
        </View>

        <Text style={styles.sectionTitle}>Competition</Text>

        <CompetitionCard
          insightText={latestCompetitionFace.insight}
          latestDateLine={latestCompetitionFace.latestDateLine}
          latestSummary={latestCompetitionFace.latestSummary}
          recordLabel={competitionView.recordLabel}
          statFastestSub={competitionView.statFastestSub}
          statSubmissionRate={competitionView.statSubmissionRate}
          statWinRate={competitionView.statWinRate}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#020617",
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    paddingTop: 8,
  },
  screenTitle: {
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 18,
  },
  identityWrap: {
    marginBottom: 16,
    borderRadius: 24,
    overflow: "visible",
  },
  identityGlowBlue: {
    position: "absolute",
    top: -28,
    right: 8,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#2563EB",
    opacity: 0.12,
  },
  identityGlowTeal: {
    position: "absolute",
    bottom: -16,
    left: 8,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#14B8A6",
    opacity: 0.1,
  },
  sectionTitle: {
    color: "#E2E8F0",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 14,
  },
});
