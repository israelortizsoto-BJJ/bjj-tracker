export type SessionPlanExposureLevel = "low" | "medium" | "high";

export type GeneratedSessionPlan = {
  title: string;
  steps: string[];
  focus: string;
};

/** Human-readable system name from a key (e.g. "l1.top_passing" → "Top Passing"). */
function formatSystemName(system: string): string {
  const tail = system.split(".").slice(-1)[0]?.trim() ?? "";
  if (!tail) return system.trim();
  return tail
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function generateSessionPlan({
  system,
  exposureLevel,
}: {
  system: string;
  exposureLevel: SessionPlanExposureLevel;
}): GeneratedSessionPlan {
  const SystemName = formatSystemName(system);

  switch (exposureLevel) {
    case "low":
      return {
        title: `Sharpen your ${SystemName}`,
        steps: [
          `Drill entries into ${SystemName} (light resistance)`,
          "Complete 10 successful reps per round",
          "Add controlled resistance in final round",
        ],
        focus: "Clean execution",
      };
    case "medium":
      return {
        title: `Fix your ${SystemName} under pressure`,
        steps: [
          `Start in disadvantage positions inside ${SystemName}`,
          "Partner gives 50–70% resistance",
          "Track failed attempts and reset immediately",
        ],
        focus: "Execution under resistance",
      };
    case "high":
      return {
        title: `Emergency fix: ${SystemName}`,
        steps: [
          "Start every round in your weakest position",
          "Full resistance from partner",
          "Only count successful escapes or completions",
        ],
        focus: "Survive and execute under pressure",
      };
  }
}
