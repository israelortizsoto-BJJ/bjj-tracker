import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendCompetitionLaunchContext,
  COMPETITION_EXIT_REASONS,
  COMPETITION_LAUNCH_SURFACES,
  COMPETITION_RETURN_CLASSES,
  type CompetitionLaunchContext,
  type CompetitionReturnClass,
  resolveCompetitionExitNavigation,
  validateCompetitionLaunchContext,
} from "../competitionNavigationContract";

const COMPLETE_CONTEXT_BY_RETURN_CLASS = {
  compete: {
    launchSurface: "coach_compete",
    returnClass: "compete",
  },
  athlete: {
    launchSurface: "coach_athlete",
    returnClass: "athlete",
    returnScopeId: "kid_1",
  },
} satisfies Record<CompetitionReturnClass, CompetitionLaunchContext>;

describe("competitionNavigationContract", () => {
  it("exposes every certified Launch Context vocabulary value", () => {
    assert.deepEqual(COMPETITION_LAUNCH_SURFACES, [
      "coach_dashboard_via_athlete",
      "coach_athlete",
      "coach_compete",
      "parent_compete",
      "parent_this_week_via_athlete",
      "competition_detail",
      "deep_link",
    ]);
    assert.deepEqual(COMPETITION_RETURN_CLASSES, ["compete", "athlete"]);
    assert.deepEqual(COMPETITION_EXIT_REASONS, [
      "save",
      "cancel",
      "delete",
      "load_error",
    ]);
  });

  it("requires Athlete scope and omits scope for Compete", () => {
    assert.equal(
      "returnScopeId" in COMPLETE_CONTEXT_BY_RETURN_CLASS.compete,
      false,
    );
    assert.equal(COMPLETE_CONTEXT_BY_RETURN_CLASS.athlete.returnScopeId, "kid_1");
  });

  it("stamps every certified launch surface without changing its destination", () => {
    const cases: {
      href: string;
      context: CompetitionLaunchContext;
      expected: string;
    }[] = [
      {
        href: "/coach/kid/kid_1/competition/edit",
        context: {
          launchSurface: "coach_dashboard_via_athlete",
          returnClass: "athlete",
          returnScopeId: "kid_1",
        },
        expected:
          "/coach/kid/kid_1/competition/edit?launchSurface=coach_dashboard_via_athlete&returnClass=athlete&returnScopeId=kid_1",
      },
      {
        href: "/coach/kid/kid_1/competition/edit?entryId=entry_1",
        context: {
          launchSurface: "coach_athlete",
          returnClass: "athlete",
          returnScopeId: "kid_1",
        },
        expected:
          "/coach/kid/kid_1/competition/edit?entryId=entry_1&launchSurface=coach_athlete&returnClass=athlete&returnScopeId=kid_1",
      },
      {
        href: "/this-week/kid/kid_1/competition/edit?openNonce=1",
        context: {
          launchSurface: "coach_compete",
          returnClass: "compete",
        },
        expected:
          "/this-week/kid/kid_1/competition/edit?openNonce=1&launchSurface=coach_compete&returnClass=compete",
      },
      {
        href: "/this-week/kid/kid_1/competition/edit?openNonce=1",
        context: {
          launchSurface: "parent_compete",
          returnClass: "compete",
        },
        expected:
          "/this-week/kid/kid_1/competition/edit?openNonce=1&launchSurface=parent_compete&returnClass=compete",
      },
      {
        href: "/this-week/kid/kid_1/competition/edit",
        context: {
          launchSurface: "parent_this_week_via_athlete",
          returnClass: "athlete",
          returnScopeId: "kid_1",
        },
        expected:
          "/this-week/kid/kid_1/competition/edit?launchSurface=parent_this_week_via_athlete&returnClass=athlete&returnScopeId=kid_1",
      },
      {
        href: "/coach/kid/kid_1/competition/edit?entryId=entry_1",
        context: {
          launchSurface: "competition_detail",
          returnClass: "compete",
        },
        expected:
          "/coach/kid/kid_1/competition/edit?entryId=entry_1&launchSurface=competition_detail&returnClass=compete",
      },
      {
        href: "/coach/kid/kid_1/competition/edit?entryId=entry_1",
        context: {
          launchSurface: "deep_link",
          returnClass: "compete",
        },
        expected:
          "/coach/kid/kid_1/competition/edit?entryId=entry_1&launchSurface=deep_link&returnClass=compete",
      },
    ];

    for (const testCase of cases) {
      assert.equal(
        appendCompetitionLaunchContext(testCase.href, testCase.context),
        testCase.expected,
      );
    }
  });

  it("validates and preserves Compete and Athlete Launch Context", () => {
    assert.deepEqual(
      validateCompetitionLaunchContext(
        {
          launchSurface: "coach_compete",
          returnClass: "compete",
        },
        "kid_1",
      ),
      {
        valid: true,
        launchContext: {
          launchSurface: "coach_compete",
          returnClass: "compete",
        },
        errors: [],
      },
    );

    assert.deepEqual(
      validateCompetitionLaunchContext(
        {
          launchSurface: "coach_athlete",
          returnClass: "athlete",
          returnScopeId: "kid_1",
        },
        "kid_1",
      ),
      {
        valid: true,
        launchContext: {
          launchSurface: "coach_athlete",
          returnClass: "athlete",
          returnScopeId: "kid_1",
        },
        errors: [],
      },
    );
  });

  it("rejects incomplete, unknown, ambiguous, or scope-invalid Launch Context", () => {
    const cases = [
      {
        params: {},
        expectedReturnScopeId: "kid_1",
        errors: ["launchSurface_required", "returnClass_required"],
      },
      {
        params: {
          launchSurface: "unknown",
          returnClass: "unknown",
        },
        expectedReturnScopeId: "kid_1",
        errors: ["launchSurface_invalid", "returnClass_invalid"],
      },
      {
        params: {
          launchSurface: ["coach_compete", "parent_compete"],
          returnClass: ["compete", "athlete"],
        },
        expectedReturnScopeId: "kid_1",
        errors: [
          "launchSurface_must_be_single",
          "returnClass_must_be_single",
          "launchSurface_required",
          "returnClass_required",
        ],
      },
      {
        params: {
          launchSurface: "coach_athlete",
          returnClass: "athlete",
        },
        expectedReturnScopeId: "kid_1",
        errors: ["returnScopeId_required_for_athlete"],
      },
      {
        params: {
          launchSurface: "coach_athlete",
          returnClass: "athlete",
          returnScopeId: "kid_2",
        },
        expectedReturnScopeId: "kid_1",
        errors: ["returnScopeId_must_match_editor_scope"],
      },
      {
        params: {
          launchSurface: "coach_compete",
          returnClass: "compete",
          returnScopeId: "kid_1",
        },
        expectedReturnScopeId: "kid_1",
        errors: ["returnScopeId_forbidden_for_compete"],
      },
    ] as const;

    for (const testCase of cases) {
      const validation = validateCompetitionLaunchContext(
        testCase.params,
        testCase.expectedReturnScopeId,
      );
      assert.equal(validation.valid, false);
      assert.equal(validation.launchContext, undefined);
      assert.deepEqual(validation.errors, testCase.errors);
    }
  });

  it("resolves every certified Launch Context to its contract destination", () => {
    const cases = [
      {
        actorRole: "coach",
        launchContext: {
          launchSurface: "coach_dashboard_via_athlete",
          returnClass: "athlete",
          returnScopeId: "kid_1",
        },
        destination: "/coach/kid/kid_1",
      },
      {
        actorRole: "coach",
        launchContext: {
          launchSurface: "coach_athlete",
          returnClass: "athlete",
          returnScopeId: "kid_1",
        },
        destination: "/coach/kid/kid_1",
      },
      {
        actorRole: "coach",
        launchContext: {
          launchSurface: "coach_compete",
          returnClass: "compete",
        },
        destination: "/compete",
      },
      {
        actorRole: "parent",
        launchContext: {
          launchSurface: "parent_compete",
          returnClass: "compete",
        },
        destination: "/compete",
      },
      {
        actorRole: "parent",
        launchContext: {
          launchSurface: "parent_this_week_via_athlete",
          returnClass: "athlete",
          returnScopeId: "kid_1",
        },
        destination: "/this-week/kid/kid_1",
      },
      {
        actorRole: "coach",
        launchContext: {
          launchSurface: "competition_detail",
          returnClass: "compete",
        },
        destination: "/compete",
      },
      {
        actorRole: "parent",
        launchContext: {
          launchSurface: "deep_link",
          returnClass: "compete",
        },
        destination: "/compete",
      },
    ] as const;

    for (const testCase of cases) {
      const resolution = resolveCompetitionExitNavigation({
        actorRole: testCase.actorRole,
        athleteId: "kid_1",
        launchContext: testCase.launchContext,
      });
      assert.equal(resolution.contractApplied, true);
      assert.equal(resolution.destination, testCase.destination);
      assert.deepEqual(resolution.launchContext, testCase.launchContext);
    }
  });

  it("keeps the production Compete fallback for absent or invalid Launch Context", () => {
    const cases = [
      undefined,
      {},
      {
        launchSurface: "coach_athlete",
        returnClass: "athlete",
      },
      {
        launchSurface: "coach_athlete",
        returnClass: "athlete",
        returnScopeId: "kid_2",
      },
      {
        launchSurface: "unknown",
        returnClass: "compete",
      },
    ] as const;

    for (const launchContext of cases) {
      assert.deepEqual(
        resolveCompetitionExitNavigation({
          actorRole: "coach",
          athleteId: "kid_1",
          launchContext,
        }),
        {
          contractApplied: false,
          destination: "/compete",
          launchContext: undefined,
        },
      );
    }
  });
});
