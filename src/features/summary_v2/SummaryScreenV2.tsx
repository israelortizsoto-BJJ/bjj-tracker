import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
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
import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import { getCompetitionDetailByEntryId } from "../../storage/competitionStore";
import {
  getCompetitionVersion,
  getKidCompetitionEntriesForKid,
  subscribeCompetition,
} from "../../storage/kidCompetitionStore";
import { getKidsById, startOfWeekMondayYMD, todayYMD as todayKidYMD } from "../../storage/coachKidStore";
import { getSessions } from "../../storage/sessionsStore";
import { StorageKeys } from "../../storage/storageKeys";
import type { Session } from "../../types";
import { setActiveKidId, useActiveKidId } from "../../state/activeKidStore";

import AthleteSwitcher, { type AthleteOption } from "./components/AthleteSwitcher";
import CompetitionCard from "./components/CompetitionCard";
import GameIdentityCard from "./components/GameIdentityCard";
import IdentityCard from "./components/IdentityCard";
import MetricTile from "./components/MetricTile";
import SectionTitle from "./components/SectionTitle";

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

  // TODO(summary_v2): Surface a second real athlete when >1 kid exists on the roster (today: Account + first kid, or Athlete B mock).
  const athleteOptions: AthleteOption[] = useMemo(() => {
    const kidsSorted = Object.values(kidsByIdSnapshot)
      .filter((k) => (k?.name ?? "").trim().length > 0)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    const primary: AthleteOption = {
      key: SUMMARY_IDENTITY_ACCOUNT_SCOPE,
      label: "Account",
    };

    const second: AthleteOption = kidsSorted[0]
      ? { key: kidsSorted[0].id, label: kidsSorted[0].name.trim() }
      : { key: MOCK_SECOND_ATHLETE_KEY, label: "Athlete B" };

    return [primary, second];
  }, [kidsByIdSnapshot]);

  const effectiveScope = useMemo(() => {
    if (selectedAthleteKey === MOCK_SECOND_ATHLETE_KEY) return MOCK_SECOND_ATHLETE_KEY;
    return selectedAthleteKey;
  }, [selectedAthleteKey]);

  const selectedKidIdForCompetition = useMemo(() => {
    if (effectiveScope === SUMMARY_IDENTITY_ACCOUNT_SCOPE || effectiveScope === MOCK_SECOND_ATHLETE_KEY)
      return null;
    return effectiveScope;
  }, [effectiveScope]);

  type LoadShape = {
    sessionsByDate: Record<string, Session[]>;
    mergedMatches: CompetitionDetailMatchSnapshot[];
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
        if (selectedKidIdForCompetition) {
          const entries = await getKidCompetitionEntriesForKid(selectedKidIdForCompetition);
          for (const e of entries) {
            const detail = await getCompetitionDetailByEntryId(e.id);
            const matches = detail?.matches;
            if (Array.isArray(matches)) mergedMatches.push(...matches);
          }
        }

        if (cancelled) return;
        setProfileRoot(parseProfileRoot(profileRaw));
        setKidsByIdSnapshot(kids);
        setLoaded({ sessionsByDate: byDate, mergedMatches });
      })();
      return () => {
        cancelled = true;
      };
    }, [deviceRole, effectiveScope, selectedKidIdForCompetition, competitionBump])
  );

  const sessionsByDateEffective = loaded?.sessionsByDate ?? {};
  const mergedMatchesEffective = loaded?.mergedMatches ?? [];

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

  const onSelectAthlete = useCallback(
    (key: string) => {
      setSelectedAthleteKey(key);
      if (key === SUMMARY_IDENTITY_ACCOUNT_SCOPE) {
        setActiveKidId(null);
        return;
      }
      if (key === MOCK_SECOND_ATHLETE_KEY) {
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
        <AthleteSwitcher
          athletes={athleteOptions}
          selectedKey={selectedAthleteKey}
          onSelect={onSelectAthlete}
        />

        <IdentityCard title={identityTitle} score={identityScore} />

        <GameIdentityCard />

        <SectionTitle title="System Dashboard" />

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

        <SectionTitle title="Competition" />

        <CompetitionCard
          recordLabel={competitionView.recordLabel}
          statWinRate={competitionView.statWinRate}
          statSubmissionRate={competitionView.statSubmissionRate}
          statFastestSub={competitionView.statFastestSub}
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
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
});
