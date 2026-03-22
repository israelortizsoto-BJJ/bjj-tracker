import type { CoachOutcome, KidCompetitionResult } from "../types/coachKid";
import type {
  WhatMattersNextDraftGenerator,
  WhatMattersNextDraftPayload,
  WhatMattersNextDraftResult,
} from "./whatMattersNextDraftTypes";

function collapseSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function outcomeLabel(o: CoachOutcome): string {
  switch (o) {
    case "not_yet":
      return "Learning";
    case "developing":
      return "Developing";
    case "on_track":
      return "On track";
  }
}

function resultLabel(r: KidCompetitionResult): string {
  switch (r) {
    case "gold":
      return "Gold";
    case "silver":
      return "Silver";
    case "bronze":
      return "Bronze";
    case "participated":
      return "Participated";
    case "dnf":
      return "Did not finish";
    case "other":
      return "Other result";
  }
}

/**
 * Local deterministic stand-in until a remote model is wired.
 * Only rearranges and tightens wording from the payload; does not add new claims.
 */
export function mockWhatMattersNextDraftFromPayload(
  payload: WhatMattersNextDraftPayload,
): WhatMattersNextDraftResult {
  const h0 = collapseSpace(payload.standingGuidanceDraft.headline);
  const d0 = collapseSpace(payload.standingGuidanceDraft.detail);
  const week = payload.currentWeekWeeklyFocus;

  let suggestedHeadline = h0;
  if (!suggestedHeadline && week?.title) {
    suggestedHeadline = collapseSpace(week.title);
  }
  if (!suggestedHeadline && payload.recentCheckIns[0]?.focusTitle) {
    suggestedHeadline = collapseSpace(payload.recentCheckIns[0].focusTitle);
  }
  if (!suggestedHeadline && payload.recentCompetitions[0]?.tournamentName) {
    suggestedHeadline = `${payload.kidDisplayName}: ${payload.recentCompetitions[0].tournamentName}`;
  }

  const detailParts: string[] = [];
  if (d0) detailParts.push(d0);

  if (week) {
    const bits = [`This week’s focus: ${week.title}.`];
    if (week.noteOrMetadata) bits.push(week.noteOrMetadata);
    if (week.templateId) bits.push(`(Template ${week.templateId}.)`);
    if (week.hasYoutubeUrl) bits.push("Video link on file (not sent).");
    detailParts.push(bits.join(" "));
  }

  if (payload.recentCheckIns.length) {
    const lines = payload.recentCheckIns.map((c) => {
      const oc = c.coachOutcome
        ? `Outcome: ${outcomeLabel(c.coachOutcome)}.`
        : "";
      const notes = c.coachNotes ? c.coachNotes : "";
      const core = `Week ${c.weekStartYMD} — ${c.focusTitle}`;
      return collapseSpace([core, oc, notes].filter(Boolean).join(" "));
    });
    detailParts.push(`Recent check-ins:\n${lines.map((l) => `• ${l}`).join("\n")}`);
  }

  if (payload.recentCompetitions.length) {
    const lines = payload.recentCompetitions.map((e) => {
      const bits = [
        e.eventDate,
        e.tournamentName,
        resultLabel(e.result),
        e.eventStatus ? `status ${e.eventStatus}` : "",
        e.organizationOrPromoter ? e.organizationOrPromoter : "",
        e.outcomeKind ? `how ${e.outcomeKind}` : "",
      ].filter(Boolean);
      return bits.join(" · ");
    });
    detailParts.push(
      `Recent competitions:\n${lines.map((l) => `• ${collapseSpace(l)}`).join("\n")}`,
    );
  }

  const suggestedDetail = detailParts.join("\n\n");

  return {
    suggestedHeadline: collapseSpace(suggestedHeadline),
    suggestedDetail: suggestedDetail.trim(),
  };
}

export const mockWhatMattersNextDraftGenerator: WhatMattersNextDraftGenerator = {
  async generateDraft(payload) {
    await new Promise((r) => setTimeout(r, 450));
    return mockWhatMattersNextDraftFromPayload(payload);
  },
};

/** Default Slice 1 generator (swap when a remote provider exists). */
export function getDefaultWhatMattersNextDraftGenerator(): WhatMattersNextDraftGenerator {
  return mockWhatMattersNextDraftGenerator;
}
