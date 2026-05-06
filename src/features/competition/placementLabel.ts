/** Maps stored tier / result codes to placement labels at render time only (no medal color names). */
export function getPlacementLabel(tier?: string): string {
  switch (tier) {
    case "gold":
      return "1st";
    case "silver":
      return "2nd";
    case "bronze":
      return "3rd";
    case "dnf":
      return "DNF";
    case "other":
      return "Other";
    case "participated":
      return "Event";
    default:
      return "Event";
  }
}
