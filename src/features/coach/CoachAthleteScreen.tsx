import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { getCompetitionDetailByEntryId } from "../../storage/competitionStore";
import {
  getKidsById,
  getLatestKidWeeklyFocusForWeek,
  startOfWeekMondayYMD,
  todayYMD,
} from "../../storage/coachKidStore";
import { getKidCompetitionEntriesForKid } from "../../storage/kidCompetitionStore";
import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type {
  Kid,
  KidCompetitionEntry,
  KidsById,
  KidWeeklyFocusEntry,
} from "../../types/coachKid";

const UI = {
  screenBg: "#0b0f12",
  bgCard: "#171b20",
  border: "#26303a",
  fieldBg: "#20252b",
  textPrimary: "#ffffff",
  textSecondary: "#9ca3af",
  accent: "#c7f36b",
};

const FOCUS_STATUS_OPTIONS = [
  "Not started",
  "In progress",
  "Showing in training",
  "Executed in competition",
] as const;

const SESSION_OUTCOME_VALUES = [
  { value: "not_yet", label: "Not yet" },
  { value: "close", label: "Close" },
  { value: "hit", label: "Hit it" },
] as const;

type FocusStatus = (typeof FOCUS_STATUS_OPTIONS)[number];
type SessionOutcome = (typeof SESSION_OUTCOME_VALUES)[number]["value"];

type RecentCompetitionMatch = {
  id: string;
  competition: KidCompetitionEntry;
  match: CompetitionDetailMatchSnapshot;
  matchIndex: number;
};

function formatCreatedDate(createdAt?: string): string | null {
  if (!createdAt) return null;

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getCurrentWeekKey(): string {
  return startOfWeekMondayYMD(todayYMD());
}

function sessionOutcomeLabel(outcome: SessionOutcome): string {
  return (
    SESSION_OUTCOME_VALUES.find((option) => option.value === outcome)?.label ?? "Not yet"
  );
}

function Section({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: ReactNode;
  tone?: "default" | "private" | "published";
}) {
  return (
    <View
      style={[
        styles.section,
        tone === "private" ? styles.privateSection : null,
        tone === "published" ? styles.publishedSection : null,
      ]}
    >
      <Text style={styles.sectionTitle}>{title}</Text>
      {typeof children === "string" ? (
        <Text style={styles.sectionText}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export default function CoachAthleteScreen() {
  const params = useLocalSearchParams<{ athleteId?: string }>();
  const athleteId = typeof params.athleteId === "string" ? params.athleteId : "";
  const [kidsById, setKidsByIdState] = useState<KidsById>({});
  const [weeklyFocus, setWeeklyFocus] = useState<KidWeeklyFocusEntry | null>(null);
  const [recentCompetitionMatches, setRecentCompetitionMatches] = useState<
    RecentCompetitionMatch[]
  >([]);
  const [focusStatus, setFocusStatus] = useState<FocusStatus>("Not started");
  const [localOutcome, setLocalOutcome] = useState<SessionOutcome | undefined>();
  const [sessionNote, setSessionNote] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const kids = await getKidsById();
        if (mounted) setKidsByIdState(kids);
      } finally {
        if (mounted) setReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      if (!athleteId) {
        if (mounted) setWeeklyFocus(null);
        return;
      }

      const currentWeekKey = getCurrentWeekKey();
      const focus = await getLatestKidWeeklyFocusForWeek(athleteId, currentWeekKey);
      if (mounted) setWeeklyFocus(focus);
    })();

    return () => {
      mounted = false;
    };
  }, [athleteId]);

  useEffect(() => {
    if (!weeklyFocus && localOutcome) {
      setLocalOutcome(undefined);
    }
  }, [weeklyFocus, localOutcome]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      if (!athleteId) {
        if (mounted) setRecentCompetitionMatches([]);
        return;
      }

      const entries = await getKidCompetitionEntriesForKid(athleteId);
      const hydrated = await Promise.all(
        entries.slice(0, 6).map(async (competition) => ({
          competition,
          detail: await getCompetitionDetailByEntryId(competition.id),
        })),
      );

      const nextMatches = hydrated.flatMap(({ competition, detail }) =>
        Array.isArray(detail?.matches)
          ? detail.matches.map((match, index) => ({
              id: `${competition.id}:${match.id || index}`,
              competition,
              match,
              matchIndex: index,
            }))
          : [],
      );

      nextMatches.sort(
        (a, b) =>
          b.competition.eventDate.localeCompare(a.competition.eventDate) ||
          b.competition.createdAt.localeCompare(a.competition.createdAt) ||
          b.matchIndex - a.matchIndex,
      );

      if (mounted) setRecentCompetitionMatches(nextMatches.slice(0, 3));
    })();

    return () => {
      mounted = false;
    };
  }, [athleteId]);

  const athlete: Kid | null = useMemo(() => {
    if (!athleteId) return null;
    return kidsById[athleteId] ?? null;
  }, [athleteId, kidsById]);

  const headerSubtext = useMemo(() => {
    if (!athlete) return "";

    const profileKind = athlete.sharedAthleteId?.trim() ? "Linked athlete" : "Local athlete";
    const createdDate = formatCreatedDate(athlete.createdAt);

    return createdDate ? `${profileKind} · Added ${createdDate}` : profileKind;
  }, [athlete]);

  const athleteMissing = ready && !athlete;
  const focusDetail =
    weeklyFocus?.focusType === "custom"
      ? weeklyFocus.note?.trim()
      : weeklyFocus?.metadata?.trim();
  const hasFocus = Boolean(weeklyFocus);
  const canSetOutcome = hasFocus;
  const hasCompetitionWin = recentCompetitionMatches.some(
    ({ match }) =>
      match.matchResult === "win" &&
      (match.outcome === "Submission" || match.outcome === "Points"),
  );
  const resolvedOutcome: SessionOutcome | undefined =
    hasCompetitionWin && !localOutcome ? "hit" : localOutcome;
  const isDerivedOutcome = hasCompetitionWin && !localOutcome;
  const isFocusShowingUp = resolvedOutcome === "hit" && hasCompetitionWin;
  const isFocusAlignedWithCompetition = false;
  let interpretationMessage = "";

  if (!hasFocus && hasCompetitionWin) {
    interpretationMessage =
      "Performance is showing up in competition. Set a focus to guide it.";
  } else if (hasFocus && hasCompetitionWin && !isFocusAlignedWithCompetition) {
    interpretationMessage =
      "Winning in competition, but not clearly tied to this week's focus.";
  } else if (hasFocus && !resolvedOutcome) {
    interpretationMessage =
      "Track progress during training before competition.";
  } else if (resolvedOutcome === "hit" && hasCompetitionWin) {
    interpretationMessage = "Focus is showing up in competition.";
  } else if (hasFocus && resolvedOutcome && !hasCompetitionWin) {
    interpretationMessage =
      "Progress is happening in training. Now validate it in competition.";
  } else {
    interpretationMessage =
      "Set a weekly focus to connect coaching work with proof.";
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.topBar}>
        <Text onPress={() => router.replace("/coach")} style={styles.backText}>
          Back
        </Text>
        <Text style={styles.topBarTitle}>{athlete?.name ?? "Athlete"}</Text>
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {athleteMissing ? (
              <View style={styles.fallback}>
                <Text style={styles.fallbackTitle}>Athlete not found</Text>
              </View>
            ) : (
              <>
              {headerSubtext ? (
                <View style={styles.header}>
                  <Text style={styles.eyebrow}>Coach</Text>
                  <Text style={styles.subtitle}>{headerSubtext}</Text>
                </View>
              ) : null}

              <Section title="Current Focus" tone="published">
                <View style={styles.sectionStack}>
                  {weeklyFocus ? (
                    <View style={styles.focusBox}>
                      <Text style={styles.focusTitle}>{weeklyFocus.title}</Text>
                      {focusDetail ? (
                        <Text style={styles.sectionText}>{focusDetail}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.sectionText}>No focus set for this week</Text>
                  )}
                  <View style={styles.optionGrid}>
                    {FOCUS_STATUS_OPTIONS.map((option) => {
                      const active = focusStatus === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => setFocusStatus(option)}
                          style={({ pressed }) => [
                            styles.optionButton,
                            active ? styles.optionButtonActive : null,
                            pressed ? styles.optionButtonPressed : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionButtonText,
                              active ? styles.optionButtonTextActive : null,
                            ]}
                          >
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </Section>

              <Section title="Session Outcome" tone="private">
                <View style={styles.sectionStack}>
                  {!hasFocus ? (
                    <Text style={styles.guardText}>
                      Set a weekly focus before recording an outcome.
                    </Text>
                  ) : null}
                  <View style={styles.segmentedRow}>
                    {SESSION_OUTCOME_VALUES.map((option) => {
                      const active = localOutcome === option.value;
                      const derivedHitOption =
                        isDerivedOutcome && !hasFocus && option.value === "hit";
                      return (
                        <Pressable
                          key={option.value}
                          disabled={!canSetOutcome}
                          onPress={() => {
                            setLocalOutcome(option.value);
                            setLastUpdated(new Date().toLocaleString());
                          }}
                          style={({ pressed }) => [
                            styles.segmentButton,
                            active ? styles.segmentButtonActive : null,
                            !canSetOutcome ? styles.segmentButtonDisabled : null,
                            derivedHitOption ? styles.segmentButtonDerived : null,
                            pressed ? styles.optionButtonPressed : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.segmentButtonText,
                              active ? styles.segmentButtonTextActive : null,
                              !canSetOutcome ? styles.segmentButtonTextDisabled : null,
                              derivedHitOption ? styles.segmentButtonTextDerived : null,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {isDerivedOutcome && !hasFocus ? (
                    <Text style={styles.derivedOutcomeText}>
                      Competition shows this is working
                    </Text>
                  ) : null}
                  {resolvedOutcome ? (
                    <Text style={styles.resolvedOutcomeText}>
                      Outcome: {sessionOutcomeLabel(resolvedOutcome)}
                    </Text>
                  ) : null}
                  {isReady ? (
                    <TextInput
                      value={sessionNote}
                      onChangeText={setSessionNote}
                      placeholder="Quick coaching note (optional)"
                      placeholderTextColor={UI.textSecondary}
                      multiline
                      textAlignVertical="top"
                      style={[styles.noteInput, { minHeight: 80 }]}
                    />
                  ) : null}
                  {lastUpdated ? (
                    <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>
                  ) : null}
                </View>
              </Section>

              <Section title="Recent Competition">
                {recentCompetitionMatches.length === 0 ? (
                  <Text style={styles.sectionText}>No recent match proof yet</Text>
                ) : (
                  <View style={styles.matchList}>
                    {recentCompetitionMatches.map(({ id, competition, match }, index) => (
                      <View key={id} style={styles.matchCard}>
                        <View style={styles.matchHeaderRow}>
                          <Text style={styles.matchTitle}>
                            {competition.tournamentName || `Match ${index + 1}`}
                          </Text>
                          <Text
                            style={[
                              styles.resultBadge,
                              match.matchResult === "win" ? styles.winBadge : null,
                              match.matchResult === "loss" ? styles.lossBadge : null,
                            ]}
                          >
                            {match.matchResult ?? "No result"}
                          </Text>
                        </View>
                        <Text style={styles.matchMeta}>
                          Outcome: {match.outcome ?? "Not recorded"}
                        </Text>
                        {match.coachNote?.trim() ? (
                          <Text style={styles.matchNote}>{match.coachNote.trim()}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </Section>

              <Section title="Interpretation">
                <View
                  style={[
                    styles.connectionBox,
                    isFocusShowingUp ? styles.connectionBoxActive : null,
                  ]}
                >
                  <Text style={styles.connectionLabel}>Focus → Outcome → Competition</Text>
                  <Text style={styles.connectionText}>{interpretationMessage}</Text>
                </View>
              </Section>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: UI.screenBg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backText: {
    color: "#2563eb",
    fontSize: 16,
    marginRight: 12,
  },
  topBarTitle: {
    color: UI.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  screen: {
    flex: 1,
    backgroundColor: UI.screenBg,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  header: {
    backgroundColor: UI.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 16,
  },
  eyebrow: {
    color: UI.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  subtitle: {
    color: UI.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  section: {
    backgroundColor: UI.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 16,
  },
  privateSection: {
    borderStyle: "dashed",
  },
  publishedSection: {
    borderColor: UI.accent,
  },
  sectionTitle: {
    color: UI.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
  },
  sectionText: {
    color: UI.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionStack: {
    gap: 12,
  },
  guardText: {
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  focusBox: {
    backgroundColor: UI.fieldBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 12,
  },
  focusTitle: {
    color: UI.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 4,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    backgroundColor: UI.fieldBg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionButtonActive: {
    borderColor: UI.accent,
  },
  optionButtonPressed: {
    opacity: 0.72,
  },
  optionButtonText: {
    color: UI.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  optionButtonTextActive: {
    color: UI.textPrimary,
  },
  segmentedRow: {
    flexDirection: "row",
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    backgroundColor: UI.fieldBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  segmentButtonActive: {
    borderColor: UI.accent,
  },
  segmentButtonDisabled: {
    opacity: 0.55,
  },
  segmentButtonDerived: {
    backgroundColor: "transparent",
    borderColor: UI.accent,
    borderStyle: "dashed",
    opacity: 1,
  },
  segmentButtonText: {
    color: UI.textSecondary,
    fontSize: 13,
    fontWeight: "800",
  },
  segmentButtonTextActive: {
    color: UI.textPrimary,
  },
  segmentButtonTextDisabled: {
    color: UI.textSecondary,
  },
  segmentButtonTextDerived: {
    color: UI.accent,
  },
  derivedOutcomeText: {
    color: UI.accent,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  resolvedOutcomeText: {
    color: UI.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  noteInput: {
    backgroundColor: UI.fieldBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI.border,
    color: UI.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lastUpdated: {
    color: UI.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  connectionBox: {
    backgroundColor: UI.fieldBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 12,
  },
  connectionBoxActive: {
    borderColor: UI.accent,
  },
  connectionLabel: {
    color: UI.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },
  connectionText: {
    color: UI.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  matchList: {
    gap: 10,
  },
  matchCard: {
    backgroundColor: UI.fieldBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 12,
  },
  matchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  matchTitle: {
    flex: 1,
    color: UI.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  resultBadge: {
    color: UI.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  winBadge: {
    color: UI.accent,
  },
  lossBadge: {
    color: "#fca5a5",
  },
  matchMeta: {
    color: UI.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  matchNote: {
    color: UI.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    minHeight: 240,
  },
  fallbackTitle: {
    color: UI.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
});
