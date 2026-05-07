import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import SummaryAthleteSwitcher from "../../components/summary/SummaryAthleteSwitcher";
import SummaryCompetitionCard from "../../components/summary/SummaryCompetitionCard";
import SummaryConsistencyCard from "../../components/summary/SummaryConsistencyCard";
import SummaryHeroCard from "../../components/summary/SummaryHeroCard";
import SummaryPatternsCard from "../../components/summary/SummaryPatternsCard";
import SummaryWeekCard from "../../components/summary/SummaryWeekCard";
import {
  deriveCompetitionTrainingSkillFocus,
  principalTrainingSkillBucketFromDerivedFocus,
} from "../../ai-coach/competitionTrainingSkillFocus";
import { computeIdentityScore } from "@/src/lib/identity/computeIdentityScore";
import {
  aggregateCoachSignals,
  deriveCoachSignals,
} from "@/src/lib/identity/deriveCoachSignals";
import {
  deriveIdentitySuggestions,
  type IdentitySuggestion,
} from "@/src/lib/identity/deriveIdentitySuggestions";
import {
  validateIdentitySignals,
  type IdentityValidationResult,
} from "@/src/lib/identity/validateIdentitySignals";
import { deriveSummaryExplanation } from "@/src/lib/summary/deriveSummaryExplanation";
import { deriveSummaryInsights, type SummaryTrend } from "@/src/lib/summary/deriveSummaryInsights";
import { resolvePrincipalBucketEvidenceLine } from "../../lib/signals/competitionBucketHistory";
import { useActiveAthlete } from "../../hooks/useActiveAthlete";
import { useAthleteData } from "../../hooks/useAthleteData";
import { useSignals } from "../../hooks/useSignals";
import {
  deleteAthlete,
  setActiveAthleteId,
  updateAthlete,
  type ParentAthlete,
  type ParentAthleteUpdate,
} from "../../storage/athleteStore";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const DISMISS_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function getSuggestionKey(s: IdentitySuggestion): string {
  return `${s.type}-${String(s.suggestedValue ?? "none")}`;
}

function titleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatBeltLabel(beltRank: string | undefined): string | null {
  const t = beltRank?.trim();
  if (!t) return null;
  const base = t.replace(/\s+belt\s*$/i, "").trim();
  if (!base) return null;
  return `${titleCaseWords(base)} Belt`;
}

function formatExperienceLabel(experienceLevel: string | undefined): string | null {
  const t = experienceLevel?.trim();
  if (!t) return null;
  const k = t.toLowerCase();
  if (k === "beginner") return "Beginner";
  if (k === "developing") return "Developing";
  if (k === "experienced") return "Experienced";
  return titleCaseWords(t);
}

const formatSkill = (skill: string) => {
  return skill
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

function getIdentityFocus(athlete: {
  declaredSkills?: string[];
  experienceLevel?: string;
  isCompetitor?: boolean;
} | null | undefined): string {
  const skills = athlete?.declaredSkills ?? [];
  const exp = (athlete?.experienceLevel ?? "").trim().toLowerCase();
  const competitor = !!athlete?.isCompetitor;

  if (skills.length === 0) {
    if (exp === "beginner") {
      return "Focus on learning and recognizing core positions.";
    }
    if (exp === "developing") {
      return "Start identifying the techniques that feel natural to you.";
    }
    return "Refine your strongest positions and sequences.";
  }

  const topSkills = skills.slice(0, 2).map(formatSkill).join(" & ");

  if (exp === "developing") {
    return `Build sequences around your ${topSkills}.`;
  }

  if (exp === "experienced") {
    if (competitor) {
      return `Sharpen your ${topSkills} for competition performance.`;
    }
    return `Refine and optimize your ${topSkills}.`;
  }

  return `Explore and build from your ${topSkills}.`;
}

function summaryEmptyInsightCopy(input: {
  experienceLevel?: string;
  isCompetitor?: boolean | undefined;
}): string | null {
  const exp = input.experienceLevel?.trim().toLowerCase();
  if (exp === "beginner") {
    return "Start logging your training to begin building your game.";
  }
  if (exp === "developing") {
    return "You've started building your game. Let's refine it.";
  }
  if (input.isCompetitor === true) {
    return "Track your matches and sharpen your performance.";
  }
  return null;
}

export default function SummaryScreen() {
  const router = useRouter();
  const {
    linkedKidId: summaryLinkedKidId,
    hydrationReady,
    athleteId: activeAthleteId,
    athlete,
    athletes,
  } = useActiveAthlete();

  const [appliedProfile, setAppliedProfile] = useState<ParentAthlete | null>(null);
  const [dismissedAtMap, setDismissedAtMap] = useState<Record<string, number>>({});
  const [suggestionInteractions, setSuggestionInteractions] = useState<
    Record<string, { accepted: number; dismissed: number }>
  >({});
  const [suggestionCooldownMap, setSuggestionCooldownMap] = useState<
    Record<string, number>
  >({});
  const [nowTick, setNowTick] = useState(Date.now());
  const previousValidationRef = useRef<IdentityValidationResult | null>(null);
  const previousTrendRef = useRef<SummaryTrend | null>(null);
  const prevAthleteIdForPrevSignalsRef = useRef(activeAthleteId);
  if (prevAthleteIdForPrevSignalsRef.current !== activeAthleteId) {
    prevAthleteIdForPrevSignalsRef.current = activeAthleteId;
    previousValidationRef.current = null;
    previousTrendRef.current = null;
  }

  const prevVisibleSuggestionKeysRef = useRef<Set<string>>(new Set());
  const resurfacedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setAppliedProfile(null);
    setDismissedAtMap({});
    setSuggestionInteractions({});
    setSuggestionCooldownMap({});
    previousValidationRef.current = null;
    previousTrendRef.current = null;
    prevVisibleSuggestionKeysRef.current = new Set();
    resurfacedKeysRef.current = new Set();
  }, [activeAthleteId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const athleteForSummary = useMemo(() => {
    if (appliedProfile && appliedProfile.id === activeAthleteId) {
      return appliedProfile;
    }
    return athlete;
  }, [appliedProfile, activeAthleteId, athlete]);

  const activeAthleteName = athleteForSummary?.name?.trim() ?? "";
  const hasActiveAthlete = Boolean(activeAthleteId && activeAthleteName);

  const handleApplySuggestion = useCallback(
    async (suggestion: IdentitySuggestion) => {
      const base = athleteForSummary;
      if (!base?.id || !suggestion?.type) return;

      const patch: ParentAthleteUpdate = {};

      if (suggestion.type === "skill" && typeof suggestion.suggestedValue === "string") {
        const existing = base.declaredSkills ?? [];
        if (!existing.includes(suggestion.suggestedValue)) {
          patch.declaredSkills = [...existing, suggestion.suggestedValue];
        }
      }

      if (suggestion.type === "competitor") {
        patch.isCompetitor = true;
      }

      if (suggestion.type === "experience" && typeof suggestion.suggestedValue === "string") {
        patch.experienceLevel = suggestion.suggestedValue;
      }

      if (Object.keys(patch).length === 0) return;

      const updated = await updateAthlete(base.id, patch);
      if (updated) {
        setAppliedProfile(updated);
        setSuggestionInteractions((prev) => {
          const key = getSuggestionKey(suggestion);
          const entry = prev[key] ?? { accepted: 0, dismissed: 0 };
          return {
            ...prev,
            [key]: {
              ...entry,
              accepted: entry.accepted + 1,
            },
          };
        });
      }
    },
    [athleteForSummary],
  );

  const handleDismissSuggestion = useCallback((suggestion: IdentitySuggestion) => {
    setDismissedAtMap((prev) => ({
      ...prev,
      [getSuggestionKey(suggestion)]: Date.now(),
    }));
    setSuggestionInteractions((prev) => {
      const key = getSuggestionKey(suggestion);
      const entry = prev[key] ?? { accepted: 0, dismissed: 0 };
      return {
        ...prev,
        [key]: {
          ...entry,
          dismissed: entry.dismissed + 1,
        },
      };
    });
  }, []);

  const handleSelectAthlete = useCallback(async (id: string) => {
    await setActiveAthleteId(id);
  }, []);

  const handleOpenManageAthlete = useCallback(() => {
    if (!activeAthleteId || !athleteForSummary?.name) return;

    const athleteName = athleteForSummary.name;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Edit Profile", `Delete ${athleteName}`, "Cancel"],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
          title: "Manage Athlete",
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) {
            router.push("/summary/profile");
          }
          if (buttonIndex === 1) {
            const ok = await deleteAthlete(activeAthleteId);
            if (ok) router.replace("/summary");
          }
        },
      );
    } else {
      Alert.alert("Manage Athlete", undefined, [
        {
          text: "Edit Profile",
          onPress: () => router.push("/summary/profile"),
        },
        {
          text: `Delete ${athleteName}`,
          style: "destructive",
          onPress: async () => {
            const ok = await deleteAthlete(activeAthleteId);
            if (ok) router.replace("/summary");
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [activeAthleteId, athleteForSummary?.name, router]);

  const { sessions, competitions } = useAthleteData(activeAthleteId);

  const identityScore = computeIdentityScore({
    beltRank: athleteForSummary?.beltRank,
    declaredSkills: athleteForSummary?.declaredSkills,
    sessionCount: sessions?.length ?? 0,
    competitionCount: competitions?.length ?? 0,
  });

  const identityFocus = getIdentityFocus(athleteForSummary);

  const declaredInput =
    athleteForSummary &&
    ((athleteForSummary.experienceLevel ?? "").trim() !== "" ||
      typeof athleteForSummary.isCompetitor === "boolean")
      ? {
          experienceLevel: athleteForSummary.experienceLevel,
          isCompetitor: athleteForSummary.isCompetitor,
        }
      : undefined;
  const signals = useSignals({
    sessions,
    competitions,
    athleteId: activeAthleteId.trim() || null,
    kidId: summaryLinkedKidId,
    declaredInput,
  });

  const beltLabel = formatBeltLabel(athleteForSummary?.beltRank);
  const experienceLabel = formatExperienceLabel(athleteForSummary?.experienceLevel);
  const hasIdentityHeader = Boolean(beltLabel && experienceLabel);
  const declaredSkills = athleteForSummary?.declaredSkills ?? [];

  const personalizedEmptyInsight = useMemo(() => {
    if (signals.hasData) return null;
    return summaryEmptyInsightCopy({
      experienceLevel: athleteForSummary?.experienceLevel,
      isCompetitor: athleteForSummary?.isCompetitor,
    });
  }, [signals.hasData, athleteForSummary?.experienceLevel, athleteForSummary?.isCompetitor]);

  const hasRealData = signals.hasData === true;

  const coachSignals = useMemo(() => {
    const coachNotes =
      competitions?.flatMap((c) => {
        const text = typeof c.coachNotes === "string" ? c.coachNotes.trim() : "";
        return text.length > 0 ? [text] : [];
      }) ?? [];
    const coachSignalList = deriveCoachSignals(coachNotes);
    return aggregateCoachSignals(coachSignalList);
  }, [competitions]);

  const validation = useMemo(() => {
    return validateIdentitySignals({
      declaredSkills: athleteForSummary?.declaredSkills,
      isCompetitor: athleteForSummary?.isCompetitor,
      experienceLevel: athleteForSummary?.experienceLevel,
      signals,
      coachSignals,
      sessionCount: sessions?.length ?? 0,
      competitionCount: competitions?.length ?? 0,
    });
  }, [
    athleteForSummary?.declaredSkills,
    athleteForSummary?.isCompetitor,
    athleteForSummary?.experienceLevel,
    signals,
    coachSignals,
    sessions?.length,
    competitions?.length,
  ]);

  const summaryInsights = useMemo(() => {
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return deriveSummaryInsights({
      signals,
      identityScore: identityScore.score,
      phase: identityScore.phase,
      identityFocus,
      sessions: sorted,
      coachSignals,
    });
  }, [
    sessions,
    signals,
    identityScore.score,
    identityScore.phase,
    identityFocus,
    coachSignals,
  ]);

  useEffect(() => {
    previousValidationRef.current = validation;
  }, [validation]);

  useEffect(() => {
    previousTrendRef.current = summaryInsights.trend;
  }, [summaryInsights.trend]);

  const identitySuggestions = useMemo(
    () =>
      deriveIdentitySuggestions({
        declaredSkills: athleteForSummary?.declaredSkills,
        isCompetitor: athleteForSummary?.isCompetitor,
        experienceLevel: athleteForSummary?.experienceLevel,
        signals,
        coachSignals,
        validation,
        sessionCount: sessions?.length ?? 0,
        competitionCount: competitions?.length ?? 0,
      }),
    [
      athleteForSummary?.declaredSkills,
      athleteForSummary?.isCompetitor,
      athleteForSummary?.experienceLevel,
      signals,
      coachSignals,
      validation,
      sessions?.length,
      competitions?.length,
    ],
  );

  const suggestionsAfterDismissCooldown = useMemo(() => {
    const now = nowTick;
    const prevVal = previousValidationRef.current;
    const prevTrend = previousTrendRef.current;

    const validationChanged =
      prevVal != null &&
      (prevVal.skills !== validation.skills ||
        prevVal.competitor !== validation.competitor ||
        prevVal.experience !== validation.experience);

    const trendChanged = prevTrend != null && prevTrend !== summaryInsights.trend;

    return identitySuggestions.filter((s) => {
      const key = getSuggestionKey(s);
      const lastDismissedAt = dismissedAtMap[key] ?? 0;
      const isCoolingDown = now - lastDismissedAt < DISMISS_COOLDOWN_MS;
      const overrideCondition = validationChanged || trendChanged || s.confidence >= 0.85;

      console.log("SUGGESTION STATE", {
        key,
        dismissedAt: dismissedAtMap[key],
        now,
        isCoolingDown,
      });

      if (isCoolingDown && !overrideCondition) return false;

      return true;
    });
  }, [identitySuggestions, dismissedAtMap, nowTick, validation, summaryInsights.trend]);

  const cooldownEligibleSuggestions = useMemo(() => {
    const now = nowTick;

    return suggestionsAfterDismissCooldown.filter((s) => {
      const key = getSuggestionKey(s);

      const lastShown = suggestionCooldownMap[key] ?? 0;
      const isCoolingDown = lastShown > 0 && now - lastShown < COOLDOWN_MS;

      const isNew = suggestionCooldownMap[key] == null;

      const prevVal = previousValidationRef.current;
      const prevTrend = previousTrendRef.current;

      const validationChanged =
        prevVal != null &&
        (prevVal.skills !== validation.skills ||
          prevVal.competitor !== validation.competitor ||
          prevVal.experience !== validation.experience);

      const trendChanged = prevTrend != null && prevTrend !== summaryInsights.trend;

      if (isNew) return true;
      if (validationChanged) return true;
      if (trendChanged) return true;

      return !isCoolingDown;
    });
  }, [suggestionsAfterDismissCooldown, suggestionCooldownMap, nowTick, validation, summaryInsights.trend]);

  const finalSuggestions = useMemo(() => {
    const weightedSuggestions = cooldownEligibleSuggestions.map((s) => {
      const key = getSuggestionKey(s);
      const interaction = suggestionInteractions[key];

      if (!interaction) return s;

      let adjustedConfidence = s.confidence;
      let adjustedPriority = s.priority;

      if (interaction.accepted > 0) {
        adjustedConfidence += 0.05 * interaction.accepted;
        adjustedPriority += 0.5;
      }

      if (interaction.dismissed > 0) {
        adjustedConfidence -= 0.05 * interaction.dismissed;
        adjustedPriority -= 0.5;
      }

      return {
        ...s,
        confidence: Math.max(0, Math.min(adjustedConfidence, 1)),
        priority: adjustedPriority,
      };
    });

    return weightedSuggestions
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.confidence - a.confidence;
      })
      .slice(0, 2);
  }, [cooldownEligibleSuggestions, suggestionInteractions]);

  const currentSuggestionKeys = new Set(finalSuggestions.map(getSuggestionKey));
  const resurfacedKeys = new Set<string>();
  currentSuggestionKeys.forEach((key) => {
    const wasDismissed = dismissedAtMap[key];
    const isNowVisible = currentSuggestionKeys.has(key);

    if (wasDismissed && isNowVisible) {
      resurfacedKeys.add(key);
    }
  });
  resurfacedKeysRef.current = resurfacedKeys;

  const eligibleSuggestionKeysSignature = useMemo(
    () => [...cooldownEligibleSuggestions].map(getSuggestionKey).sort().join("\u0001"),
    [cooldownEligibleSuggestions],
  );

  /** Stamp cooldown when a suggestion leaves the eligible set (avoids flicker from stamping on every render). */
  useEffect(() => {
    const currentKeys = new Set(cooldownEligibleSuggestions.map((s) => getSuggestionKey(s)));
    const prevKeys = prevVisibleSuggestionKeysRef.current;

    setSuggestionCooldownMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of prevKeys) {
        if (!currentKeys.has(key)) {
          next[key] = Date.now();
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    prevVisibleSuggestionKeysRef.current = currentKeys;
  }, [eligibleSuggestionKeysSignature, cooldownEligibleSuggestions]);

  const explanation = useMemo(
    () =>
      deriveSummaryExplanation({
        identityScore: identityScore.score,
        phase: identityScore.phase,
        beltRank: athleteForSummary?.beltRank,
        declaredSkills: athleteForSummary?.declaredSkills,
        sessionCount: sessions?.length ?? 0,
        competitionCount: competitions?.length ?? 0,
        signals,
        trend: summaryInsights.trend,
      }),
    [
      athleteForSummary?.beltRank,
      athleteForSummary?.declaredSkills,
      competitions?.length,
      identityScore.phase,
      identityScore.score,
      sessions?.length,
      signals,
      summaryInsights.trend,
    ],
  );

  const hybridConfidence = hasRealData
    ? {
        ...signals,
        blendedFocus: summaryInsights.focus ?? undefined,
        focusMode: summaryInsights.focusMode,
        trend: summaryInsights.trend,
        trendFeedback: summaryInsights.trendFeedback,
        postSessionFeedback: summaryInsights.postSessionFeedback,
      }
    : {
        hasData: true as const,
        isIdentityBased: true as const,
        confidenceScore: identityScore.score,
        phase: identityScore.phase,
        identityFocus,
        blendedFocus: summaryInsights.focus ?? undefined,
        focusMode: summaryInsights.focusMode,
        trend: summaryInsights.trend,
        trendFeedback: summaryInsights.trendFeedback,
        postSessionFeedback: summaryInsights.postSessionFeedback,
      };

  const competitionSkillFocus = useMemo(
    () =>
      activeAthleteId
        ? deriveCompetitionTrainingSkillFocus({
            competitionsWithMatches: competitions,
            sessions,
          })
        : null,
    [activeAthleteId, competitions, sessions],
  );

  const competitionSkillFocusHint =
    competitionSkillFocus?.eligibleForSummaryLine &&
    competitionSkillFocus.highConfidence &&
    competitionSkillFocus.summaryLabel
      ? competitionSkillFocus.summaryLabel
      : undefined;

  const principalFocusBucket = useMemo(
    () => principalTrainingSkillBucketFromDerivedFocus(competitionSkillFocus),
    [competitionSkillFocus],
  );

  const bucketFocusEvidenceLine = useMemo(
    () =>
      resolvePrincipalBucketEvidenceLine(
        principalFocusBucket,
        signals.competition.bucketOutcomeTrends,
      ),
    [principalFocusBucket, signals.competition.bucketOutcomeTrends],
  );

  if (!hydrationReady) {
    return (
      <View style={styles.bootScreen}>
        <ActivityIndicator size="large" color="#c7f36b" />
      </View>
    );
  }

  if (!hasActiveAthlete) {
    return (
      <View style={styles.ctaScreen}>
        <Text style={styles.ctaTitle}>Summary</Text>
        <Text style={styles.ctaSubtitle}>
          Add an athlete on this device to see training insights here.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/summary/add-athlete")}
          style={({ pressed }) => [styles.ctaBtn, pressed ? styles.ctaBtnPressed : null]}
        >
          <Text style={styles.ctaBtnText}>Create Athlete</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {activeAthleteName}
          <Text style={styles.headerMeta}>
            {hasIdentityHeader
              ? ` • ${beltLabel} • ${experienceLabel}`
              : " • Not Linked"}
          </Text>
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Athlete actions"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleOpenManageAthlete}
            style={({ pressed }) => [styles.headerMenuBtn, pressed ? styles.headerMenuBtnPressed : null]}
          >
            <Text style={styles.headerMenuGlyph}>⋯</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Add athlete"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push("/summary/add-athlete")}
            style={({ pressed }) => [styles.headerAddBtn, pressed ? styles.headerAddBtnPressed : null]}
          >
            <Text style={styles.headerAddGlyph}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.identityScoreRow}>
        <Text style={styles.identityScoreText}>
          Identity Score: {identityScore.score}
        </Text>
      </View>

      {athletes.length > 1 ? (
        <View style={styles.selectorSection}>
          <SummaryAthleteSwitcher
            activeAthleteId={activeAthleteId}
            athletes={athletes}
            onChange={handleSelectAthlete}
          />
        </View>
      ) : null}

      {declaredSkills.length > 0 ? (
        <View style={styles.skillsSection}>
          <Text style={styles.skillsTitle}>Recognized Skills</Text>
          <View style={styles.skillsRow}>
            {declaredSkills.map((skill) => (
              <View key={skill} style={styles.skillChip}>
                <Text style={styles.skillText}>{formatSkill(skill)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.skillsSection}>
          <Text style={styles.skillsEmpty}>
            Add skills to help us understand your game
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <SummaryHeroCard
          signals={hybridConfidence}
          emptyInsightCopy={personalizedEmptyInsight}
          identityReason={explanation.identityReason}
          signalReason={explanation.signalReason}
          nextAction={explanation.nextAction}
          identityValidation={validation}
          identitySuggestions={finalSuggestions}
          resurfacedSuggestionKeys={resurfacedKeysRef.current}
          onApplySuggestion={handleApplySuggestion}
          onDismissSuggestion={handleDismissSuggestion}
          suggestionProfile={{
            declaredSkills: athleteForSummary?.declaredSkills,
            isCompetitor: athleteForSummary?.isCompetitor,
            experienceLevel: athleteForSummary?.experienceLevel,
          }}
        />
      </View>

      <View style={styles.section}>
        <SummaryWeekCard
          weeklySessionCount={signals.frequency.weeklySessionCount}
          topTechniques={signals.techniques.topTechniques}
        />
      </View>

      <View style={styles.section}>
        <SummaryPatternsCard
          gear={signals.gear}
          topSystem={signals.patterns.topSystem}
          topTechnique={signals.patterns.topTechnique}
          topTechniques={signals.techniques.topTechniques}
        />
      </View>

      <View style={styles.section}>
        <SummaryConsistencyCard
          weeklySessionCount={signals.consistency.currentWeekCount}
          streak={signals.consistency.streak}
        />
      </View>

      <View style={styles.lastSection}>
        <SummaryCompetitionCard
          averageMatchTime={signals.competition.averageMatchTime}
          competitionCount={signals.competition.competitionCount}
          fastestSubmission={signals.competition.fastestSubmission}
          lastCompetitionDate={signals.competition.lastCompetitionDate}
          lastCompetitionResult={signals.competition.lastCompetitionResult}
          lastCompetitionLosses={signals.competition.lastCompetitionLosses}
          lastCompetitionMatchCount={signals.competition.lastCompetitionMatchCount}
          lastCompetitionName={signals.competition.lastCompetitionName}
          lastCompetitionWins={signals.competition.lastCompetitionWins}
          podiumCountLast30Days={signals.competition.podiumCountLast30Days}
          podiumCountLast90Days={signals.competition.podiumCountLast90Days}
          record={signals.competition.record}
          submissionRate={signals.competition.submissionRate}
          totalMatches={signals.competition.totalMatches}
          winRate={signals.competition.winRate}
          winStyle={signals.competition.winStyle}
          placementTrend={signals.competition.placementTrend}
          skillFocusHint={competitionSkillFocusHint}
          bucketFocusEvidenceLine={bucketFocusEvidenceLine ?? undefined}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    backgroundColor: "#0b0f12",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaScreen: {
    flex: 1,
    backgroundColor: "#0b0f12",
    padding: 24,
    justifyContent: "center",
  },
  ctaTitle: {
    color: "#f9fafb",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 12,
  },
  ctaSubtitle: {
    color: "#9ca3af",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 28,
  },
  ctaBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#c7f36b",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaBtnPressed: {
    opacity: 0.88,
  },
  ctaBtnText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  screen: {
    flex: 1,
    backgroundColor: "#0b0f12",
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  headerTitle: {
    flex: 1,
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "800",
  },
  headerMeta: {
    color: "#6b7280",
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerMenuBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  headerMenuBtnPressed: {
    opacity: 0.82,
  },
  headerMenuGlyph: {
    color: "#9ca3af",
    fontSize: 22,
    fontWeight: "700",
    marginTop: -4,
    letterSpacing: 1,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAddBtnPressed: {
    opacity: 0.82,
  },
  headerAddGlyph: {
    color: "#c7f36b",
    fontSize: 26,
    fontWeight: "700",
    marginTop: -2,
  },
  identityScoreRow: {
    marginTop: 8,
  },
  identityScoreText: {
    color: "#8fa3ad",
    fontSize: 12,
  },
  selectorSection: {
    marginBottom: 24,
  },
  skillsSection: {
    marginTop: 20,
  },
  skillsTitle: {
    color: "#aaa",
    marginBottom: 10,
    fontSize: 14,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillChip: {
    borderWidth: 1,
    borderColor: "#c7f36b",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#1a2a1a",
  },
  skillText: {
    color: "#c7f36b",
    fontSize: 12,
  },
  skillsEmpty: {
    color: "#666",
    fontSize: 12,
  },
  section: {
    marginBottom: 30,
  },
  lastSection: {
    marginBottom: 0,
  },
});
