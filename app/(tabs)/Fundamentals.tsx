import { Redirect } from "expo-router";

/** Legacy path; Learn tab owns fundamentals content. */
export default function FundamentalsRedirect() {
  return <Redirect href="/learn/fundamentals" />;
}
