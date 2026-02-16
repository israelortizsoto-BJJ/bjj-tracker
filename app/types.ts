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
  gear?: "gi" | "nogi";
  techniqueId?: string; // points to fundamentals taxonomy leaf ID

  // Legacy (keep for backward compatibility while we transition)
  technique: string;

  drill: string;
  notes: string;
  youtubeUrl: string;
  imageUri?: string | null;
  videoUri?: string | null;
  imageAssetId?: string | null;
  videoAssetId?: string | null;
};

