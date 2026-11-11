import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { TETHER_REFUSAL, tetherBlock } from "./tether";

describe("tetherBlock", () => {
  test("outside Tether textme sends", () => {
    expect(tetherBlock({})).toBeUndefined();
    expect(tetherBlock({ TETHER_SESSION: "" })).toBeUndefined();
  });
  test("inside a Tether session it refuses and points at text_person", () => {
    expect(tetherBlock({ TETHER_SESSION: "claude:abc" })).toBe(TETHER_REFUSAL);
    expect(TETHER_REFUSAL).toContain("text_person");
  });
  test("TEXTME_IN_TETHER=1 lets it through", () => {
    expect(tetherBlock({ TETHER_SESSION: "codex:1", TEXTME_IN_TETHER: "1" })).toBeUndefined();
  });
  test("notify.ts exits before sending anything", () => {
    const p = Bun.spawnSync([process.execPath, join(import.meta.dir, "notify.ts"), "hi"], {
      env: { PATH: process.env.PATH ?? "", HOME: "/nonexistent", TETHER_SESSION: "claude:abc", NOTIFY_PHONE: "+15555550100" },
    });
    expect(p.exitCode).toBe(3);
    expect(p.stderr.toString()).toContain("text_person");
  });
});
