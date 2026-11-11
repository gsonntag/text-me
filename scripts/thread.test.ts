import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileThread, owns, tagOf, type Others, type Waiter } from "./thread";

const now = 1_000_000;
const me: Waiter = { pid: 1, sentAt: now - 60_000, until: now + 240_000, id: "me", tag: "foliation" };
const none: Others = { waiters: [], tethers: [] };
const tether = (lastOut: number, open: number[] = [3], sent: string[] = ["t1"]) => ({ pid: 9, lastOut, open: open.map((n) => ({ n, until: now + 60_000 })), sent });

describe("owns", () => {
  test("alone: every reply is mine", () => {
    expect(owns(me, { text: "no" }, none, now)).toBe(true);
  });

  test("Tether texted before me: a plain reply is mine; a number for its open session is Tether's", () => {
    const o = { waiters: [], tethers: [tether(now - 120_000)] };
    expect(owns(me, { text: "no" }, o, now)).toBe(true);
    expect(owns(me, { text: "3 y" }, o, now)).toBe(false);
    expect(owns(me, { text: "4 y" }, o, now)).toBe(true);
  });

  test("Tether texted after me: plain replies are Tether's, threaded ones to me are mine", () => {
    const o = { waiters: [], tethers: [tether(now - 1000)] };
    expect(owns(me, { text: "no" }, o, now)).toBe(false);
    expect(owns(me, { text: "no", replyTo: "me" }, o, now)).toBe(true);
    expect(owns(me, { text: "[foliation] no" }, o, now)).toBe(true);
  });

  test("another textme: the latest takes plain replies; tags and threads pick one", () => {
    const other: Waiter = { pid: 2, sentAt: now - 1000, until: now + 1000, id: "o", tag: "api" };
    const o = { waiters: [other], tethers: [] };
    expect(owns(me, { text: "ok" }, o, now)).toBe(false);
    expect(owns(me, { text: "foliation: ok" }, o, now)).toBe(true);
    expect(owns(me, { text: "[api] ok" }, { waiters: [], tethers: [] }, now)).toBe(true); // no such waiter: just text
    expect(owns(me, { text: "ok", replyTo: "o" }, { waiters: [{ ...other, sentAt: 0 }], tethers: [] }, now)).toBe(false);
    expect(owns(me, { text: "ok", replyTo: "t1" }, { waiters: [], tethers: [tether(0)] }, now)).toBe(false);
    // the other one stopped waiting
    expect(owns(me, { text: "ok" }, { waiters: [{ ...other, until: now - 1 }], tethers: [] }, now)).toBe(true);
  });

  test("tagOf", () => {
    expect(tagOf("[foliation #90] No fix needed")).toBe("foliation");
    expect(tagOf("[My-App] ✅ done")).toBe("my-app");
    expect(tagOf("no tag")).toBeUndefined();
  });
});

describe("FileThread", () => {
  test("reads other waiters and Tether, removes dead ones, publishes and clears its own", () => {
    const dir = mkdtempSync(join(tmpdir(), "thread-"));
    writeFileSync(join(dir, "textme-2.json"), JSON.stringify({ kind: "textme", pid: 2, sentAt: 5, until: 10, tag: "api" }));
    writeFileSync(join(dir, "textme-3.json"), JSON.stringify({ kind: "textme", pid: 3, sentAt: 5, until: 10 }));
    writeFileSync(join(dir, "tether-9.json"), JSON.stringify({ kind: "tether", pid: 9, lastOut: 7, open: [{ n: 1, until: 20 }], sent: ["a"] }));
    const t = new FileThread(dir, (pid) => pid !== 3);
    t.publish(me);
    const o = t.others();
    expect(o.waiters).toEqual([{ pid: 2, sentAt: 5, until: 10, id: undefined, tag: "api" }]);
    expect(o.tethers).toEqual([{ pid: 9, lastOut: 7, open: [{ n: 1, until: 20 }], sent: ["a"] }]);
    expect(existsSync(join(dir, "textme-3.json"))).toBe(false);
    expect(existsSync(join(dir, `textme-${process.pid}.json`))).toBe(true);
    t.clear();
    expect(existsSync(join(dir, `textme-${process.pid}.json`))).toBe(false);
  });
});
