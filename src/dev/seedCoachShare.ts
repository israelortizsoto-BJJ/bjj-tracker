import {
    setAssignmentsById,
    setCoachLinks,
    setCoachesById,
    setCompletionReceiptsQueue,
    setPackEnrollments,
    setPacksById,
} from "../storage/coachShareStore";
import type {
    Assignment,
    CoachIdentity,
    CoachLink,
    CompletionReceipt,
    PackEnrollment,
    ProgramPack,
} from "../types/coachShare";

const NOW_ISO = "2026-03-06T09:00:00.000Z";

const DEMO_COACH_ID = "coach_demo_aoj";
const DEMO_PARENT_PROFILE_ID = "parent_demo_primary";
const DEMO_COACH_LINK_ID = "coach_link_demo_primary";
const DEMO_PACK_ID = "pack_demo_fundamentals_001";
const DEMO_ENROLLMENT_ID = "enrollment_demo_001";
const DEMO_ASSIGNMENT_ID = "assignment_demo_001";

export async function seedCoachShareDemo(): Promise<void> {
  const coach: CoachIdentity = {
    id: DEMO_COACH_ID,
    displayName: "Coach Rafa",
    academyName: "MatMind Demo Academy",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };

  const coachLink: CoachLink = {
    id: DEMO_COACH_LINK_ID,
    coachId: DEMO_COACH_ID,
    parentProfileId: DEMO_PARENT_PROFILE_ID,
    scope: "child",
    status: "active",
    canReceiveCompletionReceipts: true,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };

  const pack: ProgramPack = {
    id: DEMO_PACK_ID,
    coachId: DEMO_COACH_ID,
    title: "Week 1 Foundations",
    description: "Simple first-week training plan to help reinforce key focus areas during regular class.",
    version: 1,
    modules: [
      {
        id: "module_demo_base_001",
        title: "Base and posture",
        summary: "Review athletic base, posture, and standing balance cues.",
        position: 1,
      },
      {
        id: "module_demo_shrimp_001",
        title: "Shrimp movement",
        summary: "Practice shrimp mechanics and recovery movement.",
        position: 2,
      },
      {
        id: "module_demo_bridge_001",
        title: "Bridge and turn",
        summary: "Build bridge timing and shoulder-turn coordination.",
        position: 3,
      },
    ],
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };

  const enrollment: PackEnrollment = {
    id: DEMO_ENROLLMENT_ID,
    packId: DEMO_PACK_ID,
    parentProfileId: DEMO_PARENT_PROFILE_ID,
    coachId: DEMO_COACH_ID,
    assignedAt: NOW_ISO,
    status: "active",
  };

  const assignment: Assignment = {
    id: DEMO_ASSIGNMENT_ID,
    enrollmentId: DEMO_ENROLLMENT_ID,
    packId: DEMO_PACK_ID,
    moduleId: "module_demo_base_001",
    coachId: DEMO_COACH_ID,
    parentProfileId: DEMO_PARENT_PROFILE_ID,
    title: "Practice base for 5 minutes",
    notes: "Focus on posture, balance, and standing back up with control.",
    assignedAt: NOW_ISO,
    status: "assigned",
  };

  const completionReceipts: CompletionReceipt[] = [];

  await setCoachesById({
    [coach.id]: coach,
  });

  await setCoachLinks([coachLink]);

  await setPacksById({
    [pack.id]: pack,
  });

  await setPackEnrollments([enrollment]);

  await setAssignmentsById({
    [assignment.id]: assignment,
  });

  await setCompletionReceiptsQueue(completionReceipts);
}
export async function clearCoachShareDemo(): Promise<void> {
  await setCoachesById({});
  await setCoachLinks([]);
  await setPacksById({});
  await setPackEnrollments([]);
  await setAssignmentsById({});
  await setCompletionReceiptsQueue([]);
}
