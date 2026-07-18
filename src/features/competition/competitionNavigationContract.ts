export const COMPETITION_LAUNCH_SURFACES = [
  "coach_dashboard_via_athlete",
  "coach_athlete",
  "coach_compete",
  "parent_compete",
  "parent_this_week_via_athlete",
  "competition_detail",
  "deep_link",
] as const;

export type CompetitionLaunchSurface = (typeof COMPETITION_LAUNCH_SURFACES)[number];

export const COMPETITION_RETURN_CLASSES = ["compete", "athlete"] as const;

export type CompetitionReturnClass = (typeof COMPETITION_RETURN_CLASSES)[number];

export type CompetitionLaunchContext =
  | {
      launchSurface: CompetitionLaunchSurface;
      returnClass: "compete";
      returnScopeId?: never;
    }
  | {
      launchSurface: CompetitionLaunchSurface;
      returnClass: "athlete";
      returnScopeId: string;
    };

export type CompetitionLaunchContextParams = {
  launchSurface?: string | readonly string[];
  returnClass?: string | readonly string[];
  returnScopeId?: string | readonly string[];
};

export type CompetitionLaunchContextValidation =
  | {
      valid: true;
      launchContext: CompetitionLaunchContext;
      errors: readonly [];
    }
  | {
      valid: false;
      launchContext: undefined;
      errors: readonly string[];
    };

function singleLaunchContextParam(
  field: keyof CompetitionLaunchContextParams,
  value: string | readonly string[] | undefined,
  errors: string[],
): string | undefined {
  if (value !== undefined && typeof value !== "string") {
    errors.push(`${field}_must_be_single`);
    return undefined;
  }
  return value;
}

export function validateCompetitionLaunchContext(
  params: CompetitionLaunchContextParams,
  expectedReturnScopeId?: string,
): CompetitionLaunchContextValidation {
  const errors: string[] = [];
  const launchSurface = singleLaunchContextParam(
    "launchSurface",
    params.launchSurface,
    errors,
  );
  const returnClass = singleLaunchContextParam("returnClass", params.returnClass, errors);
  const returnScopeId = singleLaunchContextParam(
    "returnScopeId",
    params.returnScopeId,
    errors,
  );

  if (!launchSurface) {
    errors.push("launchSurface_required");
  } else if (
    !COMPETITION_LAUNCH_SURFACES.includes(
      launchSurface as CompetitionLaunchSurface,
    )
  ) {
    errors.push("launchSurface_invalid");
  }

  if (!returnClass) {
    errors.push("returnClass_required");
  } else if (
    !COMPETITION_RETURN_CLASSES.includes(returnClass as CompetitionReturnClass)
  ) {
    errors.push("returnClass_invalid");
  }

  if (returnClass === "athlete") {
    if (!returnScopeId) {
      errors.push("returnScopeId_required_for_athlete");
    } else if (
      expectedReturnScopeId !== undefined &&
      returnScopeId !== expectedReturnScopeId
    ) {
      errors.push("returnScopeId_must_match_editor_scope");
    }
  } else if (returnClass === "compete" && returnScopeId !== undefined) {
    errors.push("returnScopeId_forbidden_for_compete");
  }

  if (errors.length > 0 || !launchSurface) {
    return { valid: false, launchContext: undefined, errors };
  }

  if (returnClass === "compete") {
    return {
      valid: true,
      launchContext: {
        launchSurface: launchSurface as CompetitionLaunchSurface,
        returnClass,
      },
      errors: [],
    };
  }

  if (returnClass === "athlete" && returnScopeId) {
    return {
      valid: true,
      launchContext: {
        launchSurface: launchSurface as CompetitionLaunchSurface,
        returnClass,
        returnScopeId,
      },
      errors: [],
    };
  }

  return {
    valid: false,
    launchContext: undefined,
    errors: ["returnClass_invalid"],
  };
}

export function logCompetitionLaunchContextValidation(
  editor: "coach_kid" | "parent_kid" | "parent_family",
  validation: CompetitionLaunchContextValidation,
): void {
  const payload = validation.valid
    ? { valid: true, ...validation.launchContext }
    : { valid: false, errors: [...validation.errors] };

  if (validation.valid) {
    console.log("[COMP_LAUNCH_CONTEXT_VALIDATION]", { editor, ...payload });
  } else {
    console.warn("[COMP_LAUNCH_CONTEXT_VALIDATION]", { editor, ...payload });
  }
}

export function appendCompetitionLaunchContext(
  href: string,
  launchContext: CompetitionLaunchContext,
): string {
  const params = [
    `launchSurface=${encodeURIComponent(launchContext.launchSurface)}`,
    `returnClass=${encodeURIComponent(launchContext.returnClass)}`,
    ...(launchContext.returnClass === "athlete"
      ? [`returnScopeId=${encodeURIComponent(launchContext.returnScopeId)}`]
      : []),
  ];
  return `${href}${href.includes("?") ? "&" : "?"}${params.join("&")}`;
}

export const COMPETITION_EXIT_REASONS = [
  "save",
  "cancel",
  "delete",
  "load_error",
] as const;

export type CompetitionExitReason = (typeof COMPETITION_EXIT_REASONS)[number];

export type CompetitionExitContractArgs = {
  launchContext?: CompetitionLaunchContext;
  exitReason?: CompetitionExitReason;
};

export type CompetitionExitNavigationResolution =
  | {
      contractApplied: true;
      destination: string;
      launchContext: CompetitionLaunchContext;
    }
  | {
      contractApplied: false;
      destination: "/compete";
      launchContext: undefined;
    };

export function resolveCompetitionExitNavigation(args: {
  actorRole: "parent" | "coach";
  athleteId: string;
  launchContext?: CompetitionLaunchContextParams;
}): CompetitionExitNavigationResolution {
  const validation = validateCompetitionLaunchContext(
    args.launchContext ?? {},
    args.athleteId,
  );

  if (!validation.valid) {
    return {
      contractApplied: false,
      destination: "/compete",
      launchContext: undefined,
    };
  }

  const { launchContext } = validation;
  if (launchContext.returnClass === "compete") {
    return {
      contractApplied: true,
      destination: "/compete",
      launchContext,
    };
  }

  const lane = args.actorRole === "coach" ? "coach" : "this-week";
  return {
    contractApplied: true,
    destination: `/${lane}/kid/${encodeURIComponent(launchContext.returnScopeId)}`,
    launchContext,
  };
}
