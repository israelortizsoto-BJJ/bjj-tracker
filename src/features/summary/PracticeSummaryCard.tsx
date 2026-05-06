import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { todayYMD } from "../../storage/coachKidStore";
import { StorageKeys } from "../../storage/storageKeys";
import type { Session } from "../../types";

const FEED = {
  panel: "#181b1f",
  line: "rgba(236, 241, 245, 0.12)",
  text: "#f2f4f6",
  muted: "#a9b0b8",
  faint: "#777f89",
  radius: 6,
};

function startOfWeekMondayYMD(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  date.setDate(date.getDate() - diffToMonday);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function readSessionsSafe(raw: string | null): Session[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Session[]) : [];
  } catch {
    return [];
  }
}

function sessionSummaryTitle(session: Session): string {
  const system = (session.system ?? "").trim();
  const technique = (session.technique ?? "").trim();
  if (system && technique) return `${system} · ${technique}`;
  return technique || system || "Practice session";
}

export type PracticeSummaryCardProps = {
  /** Roster athlete id (`Kid.id`). Omit or empty = do not load. */
  kidId: string | undefined;
};

export function PracticeSummaryCard({ kidId }: PracticeSummaryCardProps) {
  const [sessionCount, setSessionCount] = useState(0);
  const [latestSession, setLatestSession] = useState<Session | null>(null);

  const load = useCallback(async () => {
    const k = typeof kidId === "string" ? kidId.trim() : "";
    if (!k) {
      setSessionCount(0);
      setLatestSession(null);
      return;
    }

    const today = todayYMD();
    const getTime = (s: Session) =>
      new Date(s.createdAt ?? s.date ?? today).getTime();

    const rawSessions = await AsyncStorage.getItem(StorageKeys.sessions);
    const allSessions = readSessionsSafe(rawSessions).map((s) => ({
      ...s,
      date: s.date || today,
    }));
    let scopedSessions = allSessions.filter((s) => (s.kidId ?? "").trim() === k);
    scopedSessions = scopedSessions.filter((s) => s.trainingLoggedByRole !== "coach");
    const weekStart = startOfWeekMondayYMD(today);
    const thisWeekSessions = scopedSessions
      .filter((s) => s.date >= weekStart && s.date <= today)
      .sort((a, b) => getTime(b) - getTime(a));

    const latestSession = thisWeekSessions[0] ?? null;

    setSessionCount(thisWeekSessions.length);
    setLatestSession(latestSession);
  }, [kidId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const primaryLine =
    sessionCount === 1 ? "1 session this week" : `${sessionCount} sessions this week`;

  const secondaryText = latestSession
    ? sessionSummaryTitle(latestSession)
    : "No sessions logged yet";

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
      <Text
        style={{
          color: FEED.text,
          fontSize: 17,
          lineHeight: 22,
          fontWeight: "900",
        }}
      >
        Practice Summary
      </Text>
      <Text
        style={{
          marginTop: 10,
          color: FEED.muted,
          fontSize: 14,
          lineHeight: 21,
        }}
      >
        {primaryLine}
      </Text>
      <Text
        style={{
          marginTop: 6,
          color: FEED.faint,
          fontSize: 13,
          lineHeight: 19,
        }}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {secondaryText}
      </Text>
    </View>
  );
}
