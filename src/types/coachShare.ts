export type CoachId = string;
export type CoachLinkId = string;
export type ParentProfileId = string;
export type PackId = string;
export type ModuleId = string;
export type EnrollmentId = string;
export type AssignmentId = string;
export type CompletionReceiptId = string;

export type CoachLinkScope = "child" | "household";
export type CoachLinkStatus = "active" | "revoked";
export type CoachIdentityMap = Record<CoachId, CoachIdentity>;
export type ProgramPackMap = Record<PackId, ProgramPack>;
export type AssignmentMap = Record<AssignmentId, Assignment>;

export interface CoachIdentity {
  id: CoachId;
  displayName: string;
  academyName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoachLink {
  id: CoachLinkId;
  coachId: CoachId;
  parentProfileId: ParentProfileId;
  scope: CoachLinkScope;
  status: CoachLinkStatus;
  canReceiveCompletionReceipts: boolean;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
}

export interface PackModule {
  id: ModuleId;
  title: string;
  summary?: string;
  position: number;
}

export interface ProgramPack {
  id: PackId;
  coachId: CoachId;
  title: string;
  description?: string;
  version: number;
  modules: PackModule[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export type EnrollmentStatus = "active" | "completed" | "revoked";

export interface PackEnrollment {
  id: EnrollmentId;
  packId: PackId;
  parentProfileId: ParentProfileId;
  coachId: CoachId;
  assignedAt: string;
  status: EnrollmentStatus;
  completedAt?: string;
  revokedAt?: string;
}

export type AssignmentStatus = "assigned" | "completed" | "revoked";

export interface Assignment {
  id: AssignmentId;
  enrollmentId: EnrollmentId;
  packId: PackId;
  moduleId: ModuleId;
  coachId: CoachId;
  parentProfileId: ParentProfileId;
  title: string;
  notes?: string;
  assignedAt: string;
  dueAt?: string;
  status: AssignmentStatus;
  completedAt?: string;
  revokedAt?: string;
}

export interface CompletionReceipt {
  id: CompletionReceiptId;
  assignmentId: AssignmentId;
  enrollmentId: EnrollmentId;
  packId: PackId;
  moduleId: ModuleId;
  coachId: CoachId;
  parentProfileId: ParentProfileId;
  completedAt: string;
  sharedAt?: string;
}
