import {
  defaultFamilyLinkButtonLabel,
  normalizeFamilyResourceUrl,
} from "../coach/familyResourceUrl";
import type { Session } from "../types";
import type { SyncedWeeklyMessagePayload } from "../types/coachWeeklySync";

export type ReadTogetherStoryCardKey =
  | "mission"
  | "coach_recap"
  | "mats"
  | "study_move"
  | "journey";

export type ReadTogetherStoryCard = {
  key: ReadTogetherStoryCardKey;
  /** Approved working name for the card */
  title: string;
  /** Optional prominent line under the title (e.g. weekly headline). */
  headline?: string;
  body: string;
  eyebrow?: string;
  /** Mission-of-the-week link from `missionResourceUrl` (mission card only). */
  missionLinkUrl?: string;
  missionLinkLabel?: string;
  /** Study / family resource link from `familyResourceUrl` (study_move card only). */
  familyLinkUrl?: string;
  familyLinkLabel?: string;
};

export const READ_TOGETHER_TITLES = {
  mission: "Mission of the week",
  coachRecap: "What we sharpened with coach",
  studyMove: "Study the move",
  mats: "On the mats this week",
  journey: "Why this matters",
} as const;

/** Family Huddle modal card order (WeeklyDoc-aligned; mission lives on the main This Week card). */
export const READ_TOGETHER_TITLE_ORDER = [
  READ_TOGETHER_TITLES.coachRecap,
  READ_TOGETHER_TITLES.studyMove,
  READ_TOGETHER_TITLES.journey,
] as const;

export type BuildReadTogetherStoryCardsInput = {
  mode: "weekly_sync" | "legacy_assignment";
  /** Monday YYYY-MM-DD for week copy */
  weekStartYMD: string;
  weeklySyncDoc: SyncedWeeklyMessagePayload | null;
  weeklySyncNetworkOk: boolean;
  /** Same lines parent hero uses (mission). */
  missionHeadline: string;
  missionBody: string;
  missionEyebrow: string;
  /** Plain-English "why this matters" copy (parent translation). */
  whyThisMattersText?: string;
  /** Legacy class + program copy for journey fallback */
  legacyClassProgramBody: string;
  /** Hint shown after journey copy (navigation / next steps). */
  closingNavigationHint: string;
  practiceSummary: {
    sessionCountThisWeek: number;
    latestSession: Session | null;
  };
};

/**
 * Single mapper: safe published weekly fields + practice summary + optional `familyCoachRecapNote`.
 * Does not use coach-only youtubeUrl, private check-ins, or standing guidance (not on parent payload).
 */
export function buildReadTogetherStoryCards(
  input: BuildReadTogetherStoryCardsInput,
): ReadTogetherStoryCard[] {
  const { mode, weeklySyncDoc, weeklySyncNetworkOk, whyThisMattersText, legacyClassProgramBody, closingNavigationHint } =
    input;

  const doc = weeklySyncDoc;
  const recap =
    mode === "weekly_sync" && doc
      ? (doc.familyCoachRecapNote ?? "").trim()
      : "";

  if (__DEV__) {
    console.log("[bjj-read-together-card2]", {
      mode,
      hasWeeklyDoc: Boolean(doc),
      recapLen: recap.length,
      usingCoachRecapFallback: !recap,
    });
  }

  const coachRecapBody = recap
    ? recap
    : mode === "weekly_sync"
      ? "Your coach has not added a short family recap for this week yet — that is optional. The shared weekly note still carries this week’s focus; you can also ask your coach after class for one sentence about what to reinforce at home."
      : "This view is not using the family weekly note channel yet, so there is no published recap field on this card. After you connect this phone with your coach’s invite, an optional family recap can appear here when they publish.";

  const familyResourceUrl = mode === "weekly_sync" && doc ? doc.familyResourceUrl : undefined;

  const familyUrl =
    mode === "weekly_sync" && doc
      ? normalizeFamilyResourceUrl(familyResourceUrl)
      : undefined;

  const hasFamily = !!familyUrl;

  if (__DEV__ && mode === "weekly_sync" && doc) {
    console.log("[READ TOGETHER CARD LINKS]", {
      familyResourceUrl,
    });
  }

  const familyLabel = (doc?.familyResourceLabel ?? "").trim();

  let studyBody: string;
  if (hasFamily) {
    studyBody =
      "Your coach left a link with this week’s note. Open it together when it feels right.\n\nIf it does not open, check your connection or ask your coach for a fresh link.";
  } else {
    studyBody =
      "No link this week — that is fine. Use the mission as your cue: one slow rep at home, talk through the steps in simple words, or ask your coach for a safe drill to try together.";
  }

  const classLine = (doc?.classLine ?? "").trim();
  const programLine = (doc?.programLine ?? "").trim();
  const fromDoc = [classLine, programLine].filter(Boolean).join("\n\n");

  let journeyMain: string;
  const whyTrim = (whyThisMattersText ?? "").trim();
  if (whyTrim) {
    journeyMain = whyTrim;
  } else if (mode === "weekly_sync") {
    journeyMain =
      fromDoc ||
      "Jiu-jitsu grows a little at a time. Some weeks feel easy, some feel hard — both are normal. Cheer for effort, stay patient, and remember you are on the same team.";
  } else {
    journeyMain =
      legacyClassProgramBody.trim() ||
      "Keep tying what you see in class to what you practice at home. Small, consistent reps add up more than perfect weeks.";
  }

  const journeyBody = closingNavigationHint.trim()
    ? `${journeyMain}\n\n${closingNavigationHint.trim()}`
    : journeyMain;

  const coachRecapCard: ReadTogetherStoryCard = {
    key: "coach_recap",
    title: READ_TOGETHER_TITLES.coachRecap,
    eyebrow:
      mode === "weekly_sync"
        ? weeklySyncNetworkOk
          ? "From your coach (published for families)"
          : doc
            ? "Saved on this phone — connection was spotty"
            : "Weekly note"
        : "Assignment or local focus",
    body: coachRecapBody,
  };

  const studyCard: ReadTogetherStoryCard = {
    key: "study_move",
    title: READ_TOGETHER_TITLES.studyMove,
    eyebrow: "Family resource",
    body: studyBody,
  };
  if (hasFamily && familyUrl) {
    studyCard.familyLinkUrl = familyUrl;
    studyCard.familyLinkLabel = familyLabel || defaultFamilyLinkButtonLabel(familyUrl);
  }

  const journeyCard: ReadTogetherStoryCard = {
    key: "journey",
    title: READ_TOGETHER_TITLES.journey,
    eyebrow: "Connect at home",
    body: journeyBody,
  };

  return [coachRecapCard, studyCard, journeyCard];
}
