// Inside a session Tether runs (it sets TETHER_SESSION), texts go through Tether's text_person tool,
// so the person's replies reach that session through Tether's router (numbering, threads, ✅). A
// textme there would text past Tether and listen for replies on its own, so it refuses.
// TEXTME_IN_TETHER=1 overrides that (for the person's own use).

export const TETHER_REFUSAL =
  "textme is off inside Tether sessions: use Tether's text_person tool (mcp__tether__text_person) to text the person instead. Nothing was sent.";

/** Why textme won't send here, or undefined when it may. */
export function tetherBlock(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.TETHER_SESSION && env.TEXTME_IN_TETHER !== "1" ? TETHER_REFUSAL : undefined;
}
