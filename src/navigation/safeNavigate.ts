import type { Href } from "expo-router";

type ReplaceRouter = {
  replace: (href: Href) => void;
};

export function safeReplace(router: ReplaceRouter, path: string) {
  if (!path.startsWith("/")) {
    throw new Error("Navigation paths must start with '/' in Expo Router");
  }
  router.replace(path as Href);
}
