export type ProgressionStep =
  | "control"
  | "entry"
  | "sweep"
  | "pass"
  | "submit"
  | "back_take"
  | "mount";

type StepDef = { id: ProgressionStep; label: ProgressionStep };

type Input = {
  topSystem: string | null;
  coachSystem: string | null;
  lastAction?: string | null;
  alignmentStatus?:
    | "no_focus"
    | "directed_no_proof"
    | "misaligned"
    | "aligned"
    | "validated"
    | null;
};

const progressionMap: Record<string, StepDef[]> = {
  "l1.guard": [
    { id: "control", label: "control" },
    { id: "sweep", label: "sweep" },
    { id: "submit", label: "submit" },
    { id: "back_take", label: "back_take" },
  ],
  "l1.top_passing": [
    { id: "control", label: "control" },
    { id: "pass", label: "pass" },
    { id: "submit", label: "submit" },
    { id: "mount", label: "mount" },
  ],
  "l1.back_control": [
    { id: "control", label: "control" },
    { id: "submit", label: "submit" },
  ],
  "l1.turtle_scramble": [
    { id: "control", label: "control" },
    { id: "back_take", label: "back_take" },
  ],
};

function normalizeSystem(raw: string | null): string | null {
  if (!raw) return null;
  return raw.toLowerCase().replace(/\s+/g, "_");
}

function formatStep(system: string, step: ProgressionStep): string {
  const label = system.split(".").pop()?.replace(/_/g, " ") ?? system;
  const systemDisplay = label
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  switch (step) {
    case "control":
      return `Control position in ${systemDisplay}`;
    case "entry":
      return `Find entry into ${systemDisplay}`;
    case "sweep":
      return `Hit a sweep from ${systemDisplay}`;
    case "pass":
      return `Complete a pass from ${systemDisplay}`;
    case "submit":
      return `Look for a submission from ${systemDisplay}`;
    case "back_take":
      return `Take the back from ${systemDisplay}`;
    case "mount":
      return `Mount from ${systemDisplay}`;
    default:
      return `Work on ${systemDisplay}`;
  }
}

export function computeProgression({
  topSystem,
  coachSystem,
  lastAction,
  alignmentStatus,
}: Input): { action: string; stepKey: string } {
  const system = normalizeSystem(coachSystem ?? topSystem);

  if (!system) {
    const nextStep = { id: "pick_one_position" as const };
    const action = "Pick one position and work from there.";
    return {
      action,
      stepKey: `none:${nextStep.id}`,
    };
  }

  const steps =
    progressionMap[system] ??
    [
      { id: "control", label: "control" },
      { id: "submit", label: "submit" },
    ];

  let stepIndex = 0;

  if (lastAction) {
    const lastStepId = lastAction.split(":")[1];

    const idx = steps.findIndex((s) => s.id === lastStepId);
    if (idx >= 0) {
      stepIndex = idx;
    }
  }

  // Alignment controls progression:
  // directed_no_proof → reset (coach direction exists, but no proof of work)
  // misaligned → reset (wrong focus)
  // aligned → hold (keep working)
  // validated → advance

  if (alignmentStatus === "directed_no_proof") {
    stepIndex = 0;
  } else if (alignmentStatus === "misaligned") {
    stepIndex = 0;
  } else if (alignmentStatus === "validated") {
    stepIndex = Math.min(stepIndex + 1, steps.length - 1);
  }

  const nextStep = steps[stepIndex];

  return {
    action: formatStep(system, nextStep.label),
    stepKey: `${system}:${nextStep.id}`,
  };
}
