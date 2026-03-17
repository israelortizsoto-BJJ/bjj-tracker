import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  AssignmentMap,
  CoachIdentityMap,
  CoachLink,
  CompletionReceipt,
  PackEnrollment,
  ProgramPackMap,
} from "../types/coachShare";
import { StorageKeys } from "./storageKeys";

export type CoachPilotPreviewTemplate = {
  templateId: string;
  templateTitle: string;
  templateMetadata: string;
  selectedAt: string;
  // In the legacy template preview, we didn't support reference links.
  // Newer flows attach youtubeUrl on the normalized preview items instead.
};

export type CoachPilotPreviewItem =
  | {
      id: string;
      type: "template";
      templateId: string;
      title: string;
      metadata?: string;
      createdAt: string;
      youtubeUrl?: string;
    }
  | {
      id: string;
      type: "custom";
      title: string;
      note?: string;
      createdAt: string;
      youtubeUrl?: string;
    };

export const COACH_PILOT_PREVIEW_MAX_ITEMS = 3 as const;

function safeParseOrDefault<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getCoachLinks(): Promise<CoachLink[]> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachLinks);
  return safeParseOrDefault<CoachLink[]>(raw, []);
}

export async function setCoachLinks(links: CoachLink[]): Promise<void> {
  await AsyncStorage.setItem(StorageKeys.coachLinks, JSON.stringify(links));
}

export async function getCoachesById(): Promise<CoachIdentityMap> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachesById);
  return safeParseOrDefault<CoachIdentityMap>(raw, {});
}

export async function setCoachesById(coachesById: CoachIdentityMap): Promise<void> {
  await AsyncStorage.setItem(
    StorageKeys.coachesById,
    JSON.stringify(coachesById),
  );
}

export async function getPacksById(): Promise<ProgramPackMap> {
  const raw = await AsyncStorage.getItem(StorageKeys.packsById);
  return safeParseOrDefault<ProgramPackMap>(raw, {});
}

export async function setPacksById(packsById: ProgramPackMap): Promise<void> {
  await AsyncStorage.setItem(StorageKeys.packsById, JSON.stringify(packsById));
}

export async function getPackEnrollments(): Promise<PackEnrollment[]> {
  const raw = await AsyncStorage.getItem(StorageKeys.packEnrollments);
  return safeParseOrDefault<PackEnrollment[]>(raw, []);
}

export async function setPackEnrollments(
  enrollments: PackEnrollment[],
): Promise<void> {
  await AsyncStorage.setItem(
    StorageKeys.packEnrollments,
    JSON.stringify(enrollments),
  );
}

export async function getAssignmentsById(): Promise<AssignmentMap> {
  const raw = await AsyncStorage.getItem(StorageKeys.assignmentsById);
  return safeParseOrDefault<AssignmentMap>(raw, {});
}

export async function setAssignmentsById(
  assignmentsById: AssignmentMap,
): Promise<void> {
  await AsyncStorage.setItem(
    StorageKeys.assignmentsById,
    JSON.stringify(assignmentsById),
  );
}

export async function getCompletionReceiptsQueue(): Promise<
  CompletionReceipt[]
> {
  const raw = await AsyncStorage.getItem(StorageKeys.completionReceiptsQueue);
  return safeParseOrDefault<CompletionReceipt[]>(raw, []);
}

export async function setCompletionReceiptsQueue(
  receipts: CompletionReceipt[],
): Promise<void> {
  await AsyncStorage.setItem(
    StorageKeys.completionReceiptsQueue,
    JSON.stringify(receipts),
  );
}

export async function getCoachPilotPreviewTemplate(): Promise<CoachPilotPreviewTemplate | null> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachPilotPreviewTemplate);
  return safeParseOrDefault<CoachPilotPreviewTemplate | null>(raw, null);
}

export async function setCoachPilotPreviewTemplate(
  preview: CoachPilotPreviewTemplate | null,
): Promise<void> {
  if (!preview) {
    await AsyncStorage.removeItem(StorageKeys.coachPilotPreviewTemplate);
    return;
  }

  await AsyncStorage.setItem(
    StorageKeys.coachPilotPreviewTemplate,
    JSON.stringify(preview),
  );
}

function normalizeCoachPilotPreviewItems(
  items: CoachPilotPreviewItem[],
): CoachPilotPreviewItem[] {
  // Keep it simple: cap list length, preserve insertion order.
  return items.slice(0, COACH_PILOT_PREVIEW_MAX_ITEMS);
}

async function maybeMigrateLegacyPilotPreviewTemplate(): Promise<CoachPilotPreviewItem[] | null> {
  const legacy = await getCoachPilotPreviewTemplate();
  if (!legacy) {
    return null;
  }

  const migrated: CoachPilotPreviewItem[] = [
    {
      id: `legacy-template-${legacy.templateId}`,
      type: "template",
      templateId: legacy.templateId,
      title: legacy.templateTitle,
      metadata: legacy.templateMetadata,
      createdAt: legacy.selectedAt,
    },
  ];

  await AsyncStorage.setItem(
    StorageKeys.coachPilotPreviewItems,
    JSON.stringify(migrated),
  );
  // Keep legacy key around for now; the new UI will read the list.
  return migrated;
}

export async function getCoachPilotPreviewItems(): Promise<CoachPilotPreviewItem[]> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachPilotPreviewItems);
  const parsed = safeParseOrDefault<CoachPilotPreviewItem[] | null>(raw, null);
  if (parsed && Array.isArray(parsed)) {
    return normalizeCoachPilotPreviewItems(parsed);
  }

  const migrated = await maybeMigrateLegacyPilotPreviewTemplate();
  return migrated ?? [];
}

export async function setCoachPilotPreviewItems(
  items: CoachPilotPreviewItem[],
): Promise<void> {
  await AsyncStorage.setItem(
    StorageKeys.coachPilotPreviewItems,
    JSON.stringify(normalizeCoachPilotPreviewItems(items)),
  );
}
