// app/fundamentals/index.ts

import type { Gear } from "@/app/types";
import type { TaxLevel1, TaxTechnique } from "./taxonomy";
import type { TechniqueIndexItem } from "./types";
export type { TechniqueIndexItem };

// ---------------------------
// Pure helpers
// ---------------------------
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const gearEffective = (g?: Gear): Gear => g ?? "both";

const matchesGear = (itemGear: Gear, selected: Gear) => {
  if (selected === "both") return true;
  return itemGear === "both" || itemGear === selected;
};

const toKeywords = (t: TaxTechnique): string[] => {
  const base = [t.label, ...(t.keywords ?? [])];
  return Array.from(new Set(base.map(normalize).filter(Boolean)));
};

// ---------------------------
// Public API
// ---------------------------
export function buildTechniqueIndex(taxonomy: TaxLevel1[]): TechniqueIndexItem[] {
  const out: TechniqueIndexItem[] = [];

  for (const l1 of taxonomy) {
    for (const l2 of l1.nodes) {
      // Direct techniques at level 2
      if (l2.techniques && l2.techniques.length > 0) {
        for (const t of l2.techniques) {
          const gear = gearEffective(t.gear ?? l2.gear ?? l1.gear);
          const keywords = toKeywords(t);

          out.push({
            id: t.id,
            label: t.label,
            gear,
            path: {
              level1Id: l1.id,
              level1Label: l1.label,
              level2Id: l2.id,
              level2Label: l2.label,
            },
            keywords,
            haystack: normalize([t.label, l1.label, l2.label, ...keywords].join(" ")),
          });
        }
      }

      // Categories at level 3
      if (l2.categories && l2.categories.length > 0) {
        for (const c of l2.categories) {
          for (const t of c.techniques) {
            const gear = gearEffective(t.gear ?? c.gear ?? l2.gear ?? l1.gear);
            const keywords = toKeywords(t);

            out.push({
              id: t.id,
              label: t.label,
              gear,
              path: {
                level1Id: l1.id,
                level1Label: l1.label,
                level2Id: l2.id,
                level2Label: l2.label,
                level3Id: c.id,
                level3Label: c.label,
              },
              keywords,
              haystack: normalize([t.label, l1.label, l2.label, c.label, ...keywords].join(" ")),
            });
          }
        }
      }
    }
  }

  // Stable ordering for UI lists
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

export function filterTechniqueIndexByGear(index: TechniqueIndexItem[], gear: Gear) {
  return index.filter((it) => matchesGear(it.gear, gear));
}

/**
 * MVP search:
 * - token-based includes match against haystack
 * - returns top N
 *
 * Critic rule: do NOT build fuzzy search yet.
 */
export function searchTechniques(
  index: TechniqueIndexItem[],
  query: string,
  opts?: { gear?: Gear; limit?: number }
) {
  const q = normalize(query);
  const limit = opts?.limit ?? 25;
  const gear = opts?.gear ?? "both";

  const base = filterTechniqueIndexByGear(index, gear);

  if (!q) return base.slice(0, limit);

  const tokens = q.split(" ").filter(Boolean);

  const results = base.filter((it) => tokens.every((tk) => it.haystack.includes(tk)));
  return results.slice(0, limit);
}

export function getTechniqueById(index: TechniqueIndexItem[], id?: string) {
  if (!id) return undefined;
  return index.find((it) => it.id === id);
}