export type Gear = "gi" | "nogi" | "both";

// v1 multi-technique support: per-technique entry.
// Keep fields aligned with the existing top-level technique-related fields.
export type TechniqueEntry = {
  id: string;
  position?: string;
  grips?: string;
  finish?: string;
  techniqueId?: string;
  technique?: string;
  customTechnique?: string;
};

export type Session = {
  id: string;
  createdAt: string;
  date: string; // YYYY-MM-DD
  system: string;

  // New (more specific technique breakdown)
  position?: string;
  grips?: string;
  finish?: string;

  // MVP taxonomy (new)
  gear?: Gear;
  techniqueId?: string; // points to fundamentals taxonomy leaf ID

  // Legacy (keep for backward compatibility while we transition)
  technique: string;

  // v1 multi-technique container (optional + backward compatible)
  techniques?: TechniqueEntry[];

  drill: string;
  notes: string;
  youtubeUrl: string;
  imageUri?: string | null;
  videoUri?: string | null;
  imageAssetId?: string | null;
  videoAssetId?: string | null;
  customTechnique?: string;
};

