import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  appendKidWeeklyFocus,
  setKidsById,
  startOfWeekMondayYMD,
  todayYMD,
} from "../storage/coachKidStore";
import { StorageKeys } from "../storage/storageKeys";
import type { Kid, KidId } from "../types/coachKid";

const NOW_ISO = "2026-03-06T09:00:00.000Z";

const DEMO_KID_1_ID: KidId = "kid_demo_luca";
const DEMO_KID_2_ID: KidId = "kid_demo_mikey";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function addDaysYMD(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

export async function seedCoachKidsDemo(): Promise<void> {
  const kids: Kid[] = [
    {
      id: DEMO_KID_1_ID,
      name: "Luca",
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    },
    {
      id: DEMO_KID_2_ID,
      name: "Mikey",
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    },
  ];

  const kidsById = kids.reduce<Record<KidId, Kid>>((acc, k) => {
    acc[k.id] = k;
    return acc;
  }, {});

  await setKidsById(kidsById);

  // Seed 3 weeks of kid-week focus so history renders immediately.
  const today = todayYMD();
  const week0 = startOfWeekMondayYMD(today);
  const week1 = startOfWeekMondayYMD(addDaysYMD(today, -7));
  const week2 = startOfWeekMondayYMD(addDaysYMD(today, -14));

  await appendKidWeeklyFocus({
    kidId: DEMO_KID_1_ID,
    weekStartYMD: week2,
    focusType: "template",
    templateId: "guard-pull-defense-knee-middle",
    title: "Guard Pull Defense — Knee in the Middle",
    metadata: "Modules: 3 · Focus: Gi / Top Player · Level: Fundamentals",
    youtubeUrl: undefined,
    coachOutcome: undefined,
    coachNotes: undefined,
  });

  await appendKidWeeklyFocus({
    kidId: DEMO_KID_1_ID,
    weekStartYMD: week1,
    focusType: "template",
    templateId: "triangle-defense-posture-escape",
    title: "Triangle Defense — Posture and Escape",
    metadata: "Modules: 3 · Focus: Gi / Defense · Level: Fundamentals",
    youtubeUrl: undefined,
    coachOutcome: "developing",
    coachNotes: "Emphasize posture first; don’t rush the escape.",
  });

  await appendKidWeeklyFocus({
    kidId: DEMO_KID_1_ID,
    weekStartYMD: week0,
    focusType: "custom",
    title: "Grip fighting + stance",
    note: "Start standing tall, deny grips early.",
    youtubeUrl: undefined,
    coachOutcome: "on_track",
    coachNotes: "Good improvement when he resets quickly after frames.",
  });
}

export async function clearCoachKidsDemo(): Promise<void> {
  await setKidsById({});
  await AsyncStorage.setItem(StorageKeys.kidWeeklyFocusEntries, JSON.stringify([]));
}

