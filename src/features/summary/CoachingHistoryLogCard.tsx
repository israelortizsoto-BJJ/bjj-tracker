import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import {
  getKidWeeklyFocusEntriesForKid,
  startOfWeekMondayYMD,
  todayYMD,
} from "../../storage/coachKidStore";
import { tokens } from "../../theme/tokens";
import type { KidWeeklyFocusEntry } from "../../types/coachKid";

const FEED = {
  panel: "#181b1f",
  panel2: "#20242a",
  line: "rgba(236, 241, 245, 0.12)",
  text: "#f2f4f6",
  muted: "#a9b0b8",
  faint: "#777f89",
  radius: 6,
};

/** Shown as "Week of May 1" (long month). */
function formatWeekOfHeading(weekStartYMD: string) {
  const d = new Date(`${weekStartYMD}T00:00:00`);
  if (Number.isNaN(d.getTime())) return weekStartYMD;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

/** Title + template metadata or custom note (never coach/family recap fields). */
function focusPresentation(entry: KidWeeklyFocusEntry): {
  headline: string | null;
  detail: string | null;
} {
  const headline = entry.title.trim();
  const secondary =
    entry.focusType === "template"
      ? (entry.metadata ?? "").trim()
      : (entry.note ?? "").trim();
  if (!headline && !secondary) return { headline: null, detail: null };
  if (!headline) return { headline: secondary, detail: null };
  if (!secondary || secondary === headline) return { headline, detail: null };
  return { headline, detail: secondary };
}

function groupEntriesByWeek(entries: KidWeeklyFocusEntry[]): {
  weekStartYMD: string;
  entries: KidWeeklyFocusEntry[];
}[] {
  const map = new Map<string, KidWeeklyFocusEntry[]>();
  for (const e of entries) {
    const arr = map.get(e.weekStartYMD) ?? [];
    arr.push(e);
    map.set(e.weekStartYMD, arr);
  }
  const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
  return keys.map((weekStartYMD) => ({
    weekStartYMD,
    entries: map.get(weekStartYMD)!,
  }));
}

export type CoachingHistoryLogCardProps = {
  /** Roster athlete id (`Kid.id`). Omit or empty = no fetch. */
  kidId: string | undefined;
};

export function CoachingHistoryLogCard({ kidId }: CoachingHistoryLogCardProps) {
  const [ready, setReady] = useState(false);
  const [entriesForAthlete, setEntriesForAthlete] = useState<KidWeeklyFocusEntry[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  /** Reset expansion when roster athlete changes so we never reuse another kid’s open weeks. */
  useEffect(() => {
    const w = startOfWeekMondayYMD(todayYMD());
    setExpandedWeeks(new Set([w]));
  }, [kidId]);

  const weekAnchor = startOfWeekMondayYMD(todayYMD());

  const load = useCallback(async () => {
    const k = typeof kidId === "string" ? kidId.trim() : "";
    if (!k) {
      setEntriesForAthlete([]);
      setReady(true);
      return;
    }

    setReady(false);
    try {
      const rows = await getKidWeeklyFocusEntriesForKid(k);
      setEntriesForAthlete(rows.filter((e) => e.kidId === k));
    } finally {
      setReady(true);
    }
  }, [kidId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const weekGroups = useMemo(
    () => groupEntriesByWeek(entriesForAthlete),
    [entriesForAthlete],
  );

  const toggleWeek = useCallback((week: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  }, []);

  const hasRows = entriesForAthlete.length > 0;

  return (
    <View
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: FEED.radius,
        borderWidth: 1,
        borderColor: FEED.line,
        backgroundColor: FEED.panel,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.space[3],
        }}
      >
        <Text
          style={{
            color: FEED.text,
            fontSize: 17,
            lineHeight: 22,
            fontWeight: "900",
          }}
        >
          Weekly coaching progression
        </Text>
        <Text style={[tokens.type.caption, { color: FEED.muted }]}>By week</Text>
      </View>

      {!ready ? (
        <Text style={{ marginTop: 12, color: FEED.muted, fontSize: 14, lineHeight: 21 }}>
          Loading…
        </Text>
      ) : !hasRows ? (
        <Text style={{ marginTop: 12, color: FEED.muted, fontSize: 14, lineHeight: 21 }}>
          No weekly focus history for this athlete yet.
        </Text>
      ) : (
        <View style={{ marginTop: 12, gap: 8 }}>
          {weekGroups.map(({ weekStartYMD: w, entries }) => {
            const expanded = expandedWeeks.has(w);
            const chevron = expanded ? "▼" : "▶";
            const isThisWeek = w === weekAnchor;
            return (
              <View
                key={w}
                style={{
                  borderRadius: FEED.radius,
                  borderWidth: 1,
                  borderColor: FEED.line,
                  overflow: "hidden",
                }}
              >
                <Pressable
                  onPress={() => toggleWeek(w)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    backgroundColor: pressed ? FEED.panel2 : FEED.panel,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={
                    expanded
                      ? `Collapse week of ${formatWeekOfHeading(w)}`
                      : `Expand week of ${formatWeekOfHeading(w)}`
                  }
                >
                  <Text style={{ fontSize: 14, color: FEED.faint, width: 22 }}>{chevron}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "900", color: FEED.text }}>
                      Week of {formatWeekOfHeading(w)}
                      {isThisWeek ? " · This week" : ""}
                    </Text>
                    <Text style={{ marginTop: 2, fontSize: 12, color: FEED.faint }}>
                      {entries.length} {entries.length === 1 ? "entry" : "entries"}
                    </Text>
                  </View>
                </Pressable>

                {expanded ? (
                  <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
                    {entries.map((entry) => {
                      const { headline, detail } = focusPresentation(entry);
                      const coachEmphasis = (entry.coachNotes ?? "").trim();
                      const recap = (entry.familyCoachRecapNote ?? "").trim();

                      const sectionLabelStyle = {
                        fontSize: 12,
                        fontWeight: "700" as const,
                        color: FEED.faint,
                      };
                      const focusBlock =
                        headline || detail ? (
                          <View>
                            <Text style={sectionLabelStyle}>Focus</Text>
                            {headline ? (
                              <Text
                                style={{
                                  marginTop: 4,
                                  fontSize: 14,
                                  lineHeight: 21,
                                  color: FEED.text,
                                  fontWeight: "700",
                                }}
                              >
                                {headline}
                              </Text>
                            ) : null}
                            {detail ? (
                              <Text
                                style={{
                                  marginTop: 4,
                                  fontSize: 13,
                                  lineHeight: 19,
                                  color: FEED.muted,
                                }}
                              >
                                {detail}
                              </Text>
                            ) : null}
                          </View>
                        ) : null;

                      return (
                        <View
                          key={entry.id}
                          style={{
                            padding: 12,
                            borderRadius: FEED.radius,
                            borderWidth: 1,
                            borderColor: FEED.line,
                            backgroundColor: FEED.panel2,
                            gap: 12,
                          }}
                        >
                          {focusBlock}
                          {coachEmphasis ? (
                            <View>
                              <Text style={sectionLabelStyle}>Coach emphasis</Text>
                              <Text
                                style={{
                                  marginTop: 4,
                                  fontSize: 14,
                                  lineHeight: 21,
                                  color: FEED.text,
                                }}
                              >
                                {coachEmphasis}
                              </Text>
                            </View>
                          ) : null}
                          {recap ? (
                            <View>
                              <Text style={sectionLabelStyle}>Family recap</Text>
                              <Text
                                style={{
                                  marginTop: 4,
                                  fontSize: 14,
                                  lineHeight: 21,
                                  color: FEED.muted,
                                }}
                              >
                                {recap}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
