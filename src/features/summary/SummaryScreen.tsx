import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import SummaryAthleteSwitcher from "../../components/summary/SummaryAthleteSwitcher";
import SummaryCompetitionCard from "../../components/summary/SummaryCompetitionCard";
import SummaryConsistencyCard from "../../components/summary/SummaryConsistencyCard";
import SummaryHeroCard from "../../components/summary/SummaryHeroCard";
import SummaryPatternsCard from "../../components/summary/SummaryPatternsCard";
import SummaryWeekCard from "../../components/summary/SummaryWeekCard";
import OperatingHeader from "../../components/operating/OperatingHeader";
import {
  deriveCompetitionTrainingSkillFocus,
  principalTrainingSkillBucketFromDerivedFocus,
} from "../../ai-coach/competitionTrainingSkillFocus";
import { labelForSubmissionTypeKey } from "@/src/features/competition/submissionTypes";
import type { KidCompetitionEntryWithMatchDetail } from "@/src/storage/competitionStore";
import {
  formatAthleteBeltRankLabel,
  formatAthleteExperienceLevelLabel,
} from "@/src/lib/athlete/athleteBeltExperience";
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
import {
  buildSummaryViewModel,
  extractSignalSnapshot,
} from "@/src/lib/summary/buildSummaryViewModel";
import { selectFocusSystem } from "@/src/lib/summary/selectFocusSystem";
import {
  resolveWeeklyDoc,
  resolveWeeklySharedAthleteIdForParentSnapshot,
  type ParentWeeklySessionSnapshot,
} from "../../coach/resolveWeeklyDoc";
import {
  parentDeviceCoachLinkedForTrustUi,
  parentStrictWeeklyLinkedCoachLinksForUi,
} from "../../coachShare/coachLinkBinding";
import { normalizeInviteLinkToken, inviteLinkTokenTail } from "../../coachShare/inviteLinkToken";
import { coachSyncFetchSession } from "../../services/coachWeeklySyncApi";
import {
  getCachedWeeklyForLinkToken,
  setCachedWeeklyForLinkToken,
} from "../../storage/coachWeeklySyncCacheStore";
import { getCoachLinks } from "../../storage/coachShareStore";
import type { CoachLink } from "../../types/coachShare";
import { resolvePrincipalBucketEvidenceLine } from "../../lib/signals/competitionBucketHistory";
import { useDeviceRole } from "../../deviceRole/DeviceRoleProvider";
import {
  filterSessionsLikeTrainingRefresh,
  normalizeSessionsLikeTraining,
} from "../../domain/sessionUtils";
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
import {
  getLastSummaryAction,
  setLastSummaryAction,
} from "@/src/storage/summaryActionTracking";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const DISMISS_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function recentSubmissionTypesSummaryLine(
  competitions: readonly KidCompetitionEntryWithMatchDetail[],
): string | null {
  if (!competitions.length) return null;
  const sorted = [...competitions].sort((a, b) => {
    const c = b.eventDate.localeCompare(a.eventDate);
    if (c !== 0) return c;
    return b.createdAt.localeCompare(a.createdAt);
  });
  for (const c of sorted) {
    const { matches } = c;
    if (!Array.isArray(matches) || matches.length === 0) continue;
    const labels: string[] = [];
    const seen = new Set<string>();
    for (const m of matches) {
      if (m.matchResult !== "win" || m.outcome !== "Submission") continue;
      const lab = labelForSubmissionTypeKey(m.submissionType ?? null);
      if (!lab || seen.has(lab)) continue;
      seen.add(lab);
      labels.push(lab);
      if (labels.length >= 4) break;
    }
    if (labels.length > 0) {
      return `Submission types (latest event): ${labels.join(" · ")}`;
    }
  }
  return null;
}

function getSuggestionKey(s: IdentitySuggestion): string {
  return `${s.type}-${String(s.suggestedValue ?? "none")}`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
    kidsById,
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
  const [lastAction, setLastActionState] = useState<string | null>(null);
  const [weeklySessionSnapshot, setWeeklySessionSnapshot] =
    useState<ParentWeeklySessionSnapshot | null>(null);
  const [coachLinkRowsForTrustUi, setCoachLinkRowsForTrustUi] = useState<CoachLink[]>([]);
  /** Session-only: Recognized Skills starts collapsed for a calmer first paint. */
  const [recognizedSkillsExpanded, setRecognizedSkillsExpanded] = useState(false);
  const weeklySessionSourceRef = useRef<"cache" | "network" | "none">("none");
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
  const lastProgressionMemoryScopeRef = useRef<string | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void (async () => {
        const links = await getCoachLinks();
        if (!cancelled) {
          setCoachLinkRowsForTrustUi(links);
        }
        const weeklyLink = parentStrictWeeklyLinkedCoachLinksForUi(links)[0];
        const weeklySync = weeklyLink?.weeklySync;
        if (!weeklySync?.linkToken?.trim()) {
          if (!cancelled) {
            weeklySessionSourceRef.current = "none";
            setWeeklySessionSnapshot(null);
          }
          return;
        }

        const token = weeklySync.linkToken;
        const tokenNorm = normalizeInviteLinkToken(token);
        const tokenTail = inviteLinkTokenTail(token);

        const applySnapshot = (
          source: "cache" | "network" | "none",
          snapshot: ParentWeeklySessionSnapshot | null,
        ) => {
          if (cancelled) return;
          weeklySessionSourceRef.current = source;
          if (__DEV__) {
            const weeklyKeys = Object.keys(snapshot?.weeklyByAthleteId ?? {});
            console.log("[SUMMARY WEEKLY TRACE] hydration.applySnapshot", {
              sourcePath: "SummaryScreen.useFocusEffect → getCachedWeeklyForLinkToken | coachSyncFetchSession",
              dataPlane: source,
              tokenTail,
              athleteId: activeAthleteId,
              linkedKidId: summaryLinkedKidId,
              weeklyKeysAvailable: weeklyKeys,
              inviteHeadline: snapshot?.weekly?.headline?.slice(0, 120) ?? null,
              inviteUpdatedAt: snapshot?.weekly?.updatedAt ?? null,
              inviteSystemKey: snapshot?.weekly?.systemKey ?? null,
              firstAthleteKey: weeklyKeys[0] ?? null,
              firstAthleteHeadline: weeklyKeys[0]
                ? snapshot?.weeklyByAthleteId?.[weeklyKeys[0]]?.headline?.slice(0, 120) ?? null
                : null,
              firstAthleteSystemKey: weeklyKeys[0]
                ? snapshot?.weeklyByAthleteId?.[weeklyKeys[0]]?.systemKey ?? null
                : null,
              at: new Date().toISOString(),
            });
          }
          setWeeklySessionSnapshot(snapshot);
        };

        const cached = await getCachedWeeklyForLinkToken(token);
        if (cached) {
          applySnapshot("cache", {
            weekly: cached.weekly,
            weeklyByAthleteId: cached.weeklyByAthleteId,
            athletes: cached.athletes,
          });
        }

        try {
          const session = await coachSyncFetchSession(token, weeklySync.apiBaseUrl);
          const nowIso = new Date().toISOString();
          await setCachedWeeklyForLinkToken(
            token,
            session.weekly,
            nowIso,
            session.weeklyByAthleteId ?? {},
            session.athletes,
            session,
            tokenNorm,
          );
          applySnapshot("network", {
            weekly: session.weekly,
            weeklyByAthleteId: session.weeklyByAthleteId ?? {},
            athletes: session.athletes,
          });
        } catch (error) {
          if (__DEV__) {
            console.warn("[SUMMARY WEEKLY TRACE] hydration.networkError", {
              athleteId: activeAthleteId,
              tokenNorm,
              tokenTail,
              message: error instanceof Error ? error.message : String(error),
              keptCacheSnapshot: Boolean(cached),
            });
          }
          if (!cached) applySnapshot("none", null);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [activeAthleteId, summaryLinkedKidId]),
  );

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

  const { role: deviceRole } = useDeviceRole();

  const parentCoachLinkedTrust = useMemo(
    () => deviceRole === "parent" && parentDeviceCoachLinkedForTrustUi(coachLinkRowsForTrustUi),
    [coachLinkRowsForTrustUi, deviceRole],
  );
  const parentWeeklySyncChannelActive = useMemo(
    () =>
      deviceRole === "parent" &&
      parentStrictWeeklyLinkedCoachLinksForUi(coachLinkRowsForTrustUi).length > 0,
    [coachLinkRowsForTrustUi, deviceRole],
  );

  const { sessions: sessionsRaw, competitions } = useAthleteData(activeAthleteId);

  const sessions = useMemo(() => {
    return filterSessionsLikeTrainingRefresh(
      normalizeSessionsLikeTraining(sessionsRaw),
      {
        deviceRole,
        athleteId: activeAthleteId.trim(),
        linkedKidId:
          typeof summaryLinkedKidId === "string" && summaryLinkedKidId.trim()
            ? summaryLinkedKidId.trim()
            : undefined,
      },
    );
  }, [sessionsRaw, deviceRole, activeAthleteId, summaryLinkedKidId]);

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
    athleteId: activeAthleteId.trim() || null,
    kidId: summaryLinkedKidId,
    declaredInput,
  });

  const beltLabel = formatAthleteBeltRankLabel(athleteForSummary?.beltRank);
  const experienceLabel = formatAthleteExperienceLevelLabel(athleteForSummary?.experienceLevel);
  const hasIdentityHeader = Boolean(beltLabel && experienceLabel);
  const summaryOperatingHeaderMeta = useMemo(() => {
    if (hasIdentityHeader) {
      return `${beltLabel} / ${experienceLabel}`;
    }
    if (deviceRole === "parent" && parentWeeklySyncChannelActive) {
      return "Coach linked • Weekly sync active";
    }
    if (deviceRole === "parent" && parentCoachLinkedTrust) {
      return "Coach linked";
    }
    return "Add belt & experience";
  }, [
    beltLabel,
    deviceRole,
    experienceLabel,
    hasIdentityHeader,
    parentCoachLinkedTrust,
    parentWeeklySyncChannelActive,
  ]);
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

  const hybridConfidence = useMemo(
    () =>
      hasRealData
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
          },
    [
      hasRealData,
      identityFocus,
      identityScore.phase,
      identityScore.score,
      signals,
      summaryInsights.focus,
      summaryInsights.focusMode,
      summaryInsights.postSessionFeedback,
      summaryInsights.trend,
      summaryInsights.trendFeedback,
    ],
  );

  const resolvedWeeklySharedAthleteId = useMemo(() => {
    if (!weeklySessionSnapshot) return null;
    return resolveWeeklySharedAthleteIdForParentSnapshot(
      activeAthleteId,
      kidsById,
      weeklySessionSnapshot,
    );
  }, [activeAthleteId, kidsById, weeklySessionSnapshot]);

  const weeklySyncDoc = useMemo(() => {
    const doc = weeklySessionSnapshot
      ? resolveWeeklyDoc(weeklySessionSnapshot, resolvedWeeklySharedAthleteId)
      : null;
    if (__DEV__) {
      const sid = resolvedWeeklySharedAthleteId;
      const slot =
        sid && weeklySessionSnapshot?.weeklyByAthleteId
          ? weeklySessionSnapshot.weeklyByAthleteId[sid]
          : undefined;
      const invite = weeklySessionSnapshot?.weekly ?? null;
      let resolvedDocSource: "weeklyByAthleteId" | "invite.weekly" | "unknown" | "none" = "none";
      if (doc) {
        if (
          sid &&
          slot != null &&
          slot.headline === doc.headline &&
          slot.updatedAt === doc.updatedAt
        ) {
          resolvedDocSource = "weeklyByAthleteId";
        } else if (
          invite != null &&
          invite.headline === doc.headline &&
          invite.updatedAt === doc.updatedAt
        ) {
          resolvedDocSource = "invite.weekly";
        } else {
          resolvedDocSource = "unknown";
        }
      }
      console.log("[SUMMARY WEEKLY TRACE] resolveWeeklyDoc+snapshot", {
        path: "SummaryScreen.weeklySyncDoc useMemo → resolveWeeklyDoc(session, resolvedWeeklySharedAthleteId)",
        athleteId: activeAthleteId,
        linkedKidId: summaryLinkedKidId,
        resolvedWeeklySharedAthleteId: sid,
        resolvedDocSource,
        snapshotHydration: weeklySessionSourceRef.current,
        headline: doc?.headline?.slice(0, 120) ?? null,
        weeklyUpdatedAt: doc?.updatedAt ?? null,
        systemKey: doc?.systemKey ?? null,
        weeklyKeysAvailable: Object.keys(weeklySessionSnapshot?.weeklyByAthleteId ?? {}),
        slotHeadline: slot?.headline?.slice(0, 120) ?? null,
        slotSystemKey: slot?.systemKey ?? null,
        inviteHeadline: invite?.headline?.slice(0, 120) ?? null,
        inviteSystemKey: invite?.systemKey ?? null,
        at: new Date().toISOString(),
      });
    }
    return doc;
  }, [activeAthleteId, resolvedWeeklySharedAthleteId, summaryLinkedKidId, weeklySessionSnapshot]);

  const coachWeeklyForSummary = useMemo(() => {
    const built =
      weeklySyncDoc
        ? {
            headline: weeklySyncDoc.headline,
            body: weeklySyncDoc.body,
            systemKey: weeklySyncDoc.systemKey ?? null,
          }
        : null;
    if (__DEV__) {
      console.log("[SYSTEMKEY TRACE SUMMARY]", {
        traceStage: "10_SummaryScreen_coachWeeklyForSummary",
        headline: built?.headline?.slice(0, 120) ?? null,
        systemKey: built?.systemKey ?? null,
        athleteId: resolvedWeeklySharedAthleteId ?? null,
        weekStartYMD: weeklySyncDoc?.weekStartYMD ?? null,
        keyExistsOnObject:
          built != null && Object.prototype.hasOwnProperty.call(built, "systemKey"),
        source: "weeklySyncDoc → coachWeeklyForSummary_useMemo",
      });
    }
    return built;
  }, [weeklySyncDoc, resolvedWeeklySharedAthleteId]);

  const progressionMemoryWeekStart = weeklySyncDoc?.weekStartYMD ?? null;
  const progressionMemorySystemKey = weeklySyncDoc?.systemKey ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!activeAthleteId) {
      setLastActionState(null);
      lastProgressionMemoryScopeRef.current = null;
      return;
    }

    const scopeTicket = `${activeAthleteId}|${progressionMemoryWeekStart ?? ""}|${progressionMemorySystemKey ?? ""}`;
    if (lastProgressionMemoryScopeRef.current !== scopeTicket) {
      lastProgressionMemoryScopeRef.current = scopeTicket;
      setLastActionState(null);
    }

    void (async () => {
      const val = await getLastSummaryAction(
        activeAthleteId,
        progressionMemoryWeekStart,
        progressionMemorySystemKey,
      );
      if (!cancelled) setLastActionState(val);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeAthleteId,
    progressionMemoryWeekStart,
    progressionMemorySystemKey,
  ]);

  const summaryV2ViewModel = useMemo(() => {
    const signals = hybridConfidence;
    const identityBased =
      "isIdentityBased" in signals && signals.isIdentityBased === true;
    const hasData = identityBased ? true : signals.hasData;
    const confidence = identityBased ? signals.confidenceScore : signals.confidence;
    const topSystem = identityBased ? null : signals.patterns.topSystem;
    const topTechnique = identityBased ? null : signals.patterns.topTechnique;
    const focus = topSystem || topTechnique;
    let focusText: string | null | undefined = focus;
    if (identityBased && signals.identityFocus) {
      focusText = signals.identityFocus;
    }
    if (signals.blendedFocus?.trim()) {
      focusText = signals.blendedFocus.trim();
    }
    const identityFocusForVm = identityBased ? signals.identityFocus : focusText;
    const snapForSelect = extractSignalSnapshot(signals);
    const coachSystemKeyForVm = coachWeeklyForSummary?.systemKey?.trim() || null;
    const selectedSystemKey = selectFocusSystem({
      coachSystem: coachSystemKeyForVm,
      signalSystem: snapForSelect.topSystem,
      identityFocus: identityFocusForVm,
    });
    if (__DEV__) {
      console.log("[SUMMARY DUAL VM AUDIT] SummaryScreen.pre-buildSummaryViewModel", {
        athleteId: activeAthleteId,
        weeklyHeadline: weeklySyncDoc?.headline?.slice(0, 120) ?? null,
        weeklySystemKey: weeklySyncDoc?.systemKey ?? null,
        coachWeekly: coachWeeklyForSummary,
        resolvedWeeklyDoc: weeklySyncDoc,
        selectedSystemKey,
      });
    }
    console.log("[SUMMARY_RECOMPUTE]", {
      athleteId: activeAthleteId,
      competitionCount: competitions?.length ?? 0,
      identityScore: identityScore.score,
    });
    return buildSummaryViewModel({
      signals,
      identityScore: confidence,
      phase: identityBased ? signals.phase : hasData ? "experienced" : "cold",
      identityFocus: identityFocusForVm,
      coachWeekly: coachWeeklyForSummary,
      lastAction: lastAction,
    });
  }, [
    activeAthleteId,
    coachWeeklyForSummary,
    competitions?.length,
    hybridConfidence,
    identityScore.score,
    lastAction,
    summaryLinkedKidId,
    weeklySessionSnapshot,
    weeklySyncDoc,
  ]);

  useEffect(() => {
    if (!activeAthleteId) return;
    if (summaryV2ViewModel.stepKey) {
      void setLastSummaryAction(
        activeAthleteId,
        progressionMemoryWeekStart,
        progressionMemorySystemKey,
        summaryV2ViewModel.stepKey,
      );
    }
  }, [
    activeAthleteId,
    progressionMemoryWeekStart,
    progressionMemorySystemKey,
    summaryV2ViewModel?.stepKey,
  ]);

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

  const recentSubmissionTypesLine = useMemo(
    () => recentSubmissionTypesSummaryLine(competitions),
    [competitions],
  );

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
      <SafeAreaView style={styles.ctaScreen} edges={["top"]}>
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
    <ScrollView
      style={styles.screenInner}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <OperatingHeader
        mode="athlete"
        semanticLead
        eyebrow="Summary / Identity"
        title="A mirror of the athlete"
        subtitle={
          activeAthleteName?.trim()
            ? `Active context · ${activeAthleteName.trim()}`
            : null
        }
        athlete={{
          name: activeAthleteName || "Athlete",
          initials: initialsFromName(activeAthleteName),
          meta: summaryOperatingHeaderMeta,
          identityHighlight: true,
        }}
        actions={[
          {
            label: "Athlete actions",
            icon: "⋯",
            onPress: handleOpenManageAthlete,
          },
          {
            label: "Add athlete",
            icon: "+",
            onPress: () => router.push("/summary/add-athlete"),
          },
          {
            label: "Device profile and settings",
            icon: "⚙",
            accessibilityLabel: "Device profile and settings",
            onPress: () => router.push("/profile"),
          },
        ]}
      />

      <View style={styles.identityScoreRow}>
        <Text style={styles.identityScoreText}>
          Identity score · {identityScore.score}
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

      <View style={styles.skillsSection}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: recognizedSkillsExpanded }}
          accessibilityLabel={
            recognizedSkillsExpanded ? "Collapse recognized skills" : "Expand recognized skills"
          }
          hitSlop={8}
          onPress={() => {
            if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
              UIManager.setLayoutAnimationEnabledExperimental(true);
            }
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setRecognizedSkillsExpanded((v) => !v);
          }}
          style={[
            styles.skillsHeaderRow,
            recognizedSkillsExpanded ? styles.skillsHeaderRowExpanded : null,
          ]}
        >
          <Text style={styles.skillsTitle}>Recognized Skills</Text>
          <Text style={styles.skillsChevron} importantForAccessibility="no">
            {recognizedSkillsExpanded ? "▼" : "▶"}
          </Text>
        </Pressable>
        {recognizedSkillsExpanded ? (
          declaredSkills.length > 0 ? (
            <View style={styles.skillsRow}>
              {declaredSkills.map((skill) => (
                <View key={skill} style={styles.skillChip}>
                  <Text style={styles.skillText}>{formatSkill(skill)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.skillsEmpty}>
              Add skills to help us understand your game
            </Text>
          )
        ) : null}
      </View>

      <View style={styles.section}>
        <SummaryHeroCard
          signals={hybridConfidence}
          lastAction={lastAction}
          coachWeekly={coachWeeklyForSummary}
          devDualVmAudit={
            __DEV__
              ? {
                  athleteId: activeAthleteId,
                  resolvedWeeklyDoc: weeklySyncDoc,
                }
              : undefined
          }
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
          recentSubmissionTypesLine={recentSubmissionTypesLine ?? undefined}
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
    </SafeAreaView>
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
  screenInner: {
    flex: 1,
    backgroundColor: "#0b0f12",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
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
    marginTop: 10,
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: 8,
  },
  identityScoreText: {
    color: "#777f89",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  selectorSection: {
    marginBottom: 22,
    paddingTop: 4,
  },
  skillsSection: {
    marginTop: 18,
  },
  skillsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  skillsHeaderRowExpanded: {
    marginBottom: 10,
  },
  skillsTitle: {
    color: "#a9b0b8",
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  skillsChevron: {
    color: "#777f89",
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillChip: {
    borderWidth: 1,
    borderColor: "rgba(236, 241, 245, 0.12)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#181b1f",
  },
  skillText: {
    color: "#d1d5db",
    fontSize: 12,
    fontWeight: "700",
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
