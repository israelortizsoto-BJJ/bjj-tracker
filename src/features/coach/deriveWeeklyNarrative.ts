type WeeklyNarrativeInput = {
  sparringApplication?: "not_yet" | "sometimes" | "yes" | "no_data" | null;
  sessionsThisWeek: number;
  recentCompetitionCount: number;
};

export function deriveWeeklyNarrative({
  sparringApplication,
  sessionsThisWeek,
  recentCompetitionCount,
}: WeeklyNarrativeInput) {
  let message = "";

  if (sparringApplication === "not_yet") {
    message = "Focus hasn't transferred yet. We're continuing to build reps.";
  }

  if (sparringApplication === "sometimes") {
    message = "We're starting to see this in sparring. Now it's about consistency.";
  }

  if (sparringApplication === "yes") {
    message = "Focus is showing up in sparring. Now we sharpen and build confidence.";
  }

  if (!sparringApplication || sparringApplication === "no_data") {
    message = "No sparring data yet — focus on getting reps this week.";
  }

  if (sessionsThisWeek === 0) {
    message += " Priority is getting sessions in.";
  }

  if (recentCompetitionCount > 0 && sparringApplication !== "yes") {
    message += " Competition showed this still needs work.";
  }

  return {
    message,
    meta: {
      confidence: "medium",
      inputsUsed: [
        "sparringApplication",
        "sessionsThisWeek",
        "recentCompetitionCount",
      ],
    },
  };
}
