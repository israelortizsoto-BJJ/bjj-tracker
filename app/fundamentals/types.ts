import type { Gear } from "../types";

export type TechniquePath = {
  level1Id: string;
  level1Label: string;
  level2Id: string;
  level2Label: string;
  level3Id?: string;
  level3Label?: string;
};

export type TechniqueIndexItem = {
  id: string;
  label: string;
  gear: Gear;
  path: TechniquePath;
  haystack: string;
  keywords: string[];
};