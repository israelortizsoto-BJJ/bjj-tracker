import { Redirect } from "expo-router";

/** Legacy path; Learn tab owns gear content. */
export default function GearRedirect() {
  return <Redirect href="/learn/gear" />;
}
