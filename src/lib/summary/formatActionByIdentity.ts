import type { IdentityState } from "./resolveIdentityState";

export function formatActionByIdentity(
  baseAction: string,
  identity: IdentityState,
): string {
  const clean = baseAction
    .replace(/^Try\s+/i, "")
    .trim()
    .replace(/\.+$/, "");

  if (identity === "exploring") {
    return `Start by trying ${clean}`;
  }

  if (identity === "performing") {
    return `Focus on executing ${clean}`;
  }

  return `Try ${clean}`;
}
