import { buildTechniqueIndex, getTechniqueById } from "../fundamentals/index";
import { FUNDAMENTALS_TAXONOMY } from "../fundamentals/taxonomy";

const TECH_INDEX = buildTechniqueIndex(FUNDAMENTALS_TAXONOMY);

const SYSTEM_LABEL_BY_ID = new Map<string, string>([
  ["ALL", "All"],
  ["All", "All"],
  ...FUNDAMENTALS_TAXONOMY.map((l1) => [l1.id, l1.label] as const),
]);

export function humanizeIdFallback(id: string): string {
  const t = id.trim();
  if (!t) return "";
  const words = t.split(/[_\s]+/).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export function resolveSystemLabel(systemId: string | undefined | null): string {
  const key = (systemId ?? "").trim();
  if (!key) return "";
  return SYSTEM_LABEL_BY_ID.get(key) ?? humanizeIdFallback(key);
}

export function resolveTechniqueLabel(techniqueId: string | undefined | null): string {
  const id = (techniqueId ?? "").trim();
  if (!id) return "";
  const found = getTechniqueById(TECH_INDEX, id);
  return found?.label ?? humanizeIdFallback(id);
}

const INTENT_LABEL_BY_VALUE = new Map<string, string>([
  ["learn_basics", "Learn basics"],
  ["stay_consistent", "Stay consistent"],
  ["improve_skill", "Improve skill"],
  ["compete_to_win", "Compete to win"],
]);

/** Human label for stored identity `intent` option values (Identity Builder). */
export function resolveIntentLabel(intentValue: string | undefined | null): string {
  const key = (intentValue ?? "").trim();
  if (!key) return "";
  return INTENT_LABEL_BY_VALUE.get(key) ?? humanizeIdFallback(key);
}
