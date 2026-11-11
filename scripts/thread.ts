// The iMessage thread is shared. Every waiting `textme`, and Tether (github.com/gsonntag/web-coder,
// runner/src/modules/texting/thread.ts) when its texting is on, send from the same Photon number and
// all hear every reply. So that a reply goes to exactly one of them, each publishes what it last
// sent to a folder they all read (one JSON file per process):
//   textme-<pid>.json  { kind: "textme", pid, sentAt, until, id?, tag? }
//   tether-<pid>.json  { kind: "tether", pid, lastOut, open: [{ n, until }], sent: [ids] }
// and they all apply the same rule:
//   1. A threaded reply belongs to whoever sent the message it answers.
//   2. "[my-app] ..." (a textme's tag) belongs to that textme; "3 ..." where [3] is one of Tether's
//      open sessions belongs to Tether.
//   3. Anything else belongs to whoever texted last.
// A file whose process is gone, or a textme past its wait, counts for nothing (and is removed).

import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Waiter {
  pid: number;
  sentAt: number;
  until: number;
  id?: string;
  /** the first word of the text's leading [tag], lowercased: "[foliation #90] ..." → "foliation" */
  tag?: string;
}

export interface TetherNote {
  pid: number;
  lastOut: number;
  open: { n: number; until: number }[];
  sent: string[];
}

export interface Others {
  waiters: Waiter[];
  tethers: TetherNote[];
}

export function threadDir(env: Record<string, string | undefined> = process.env): string {
  return env.IMESSAGE_THREAD_DIR || join(env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "imessage-thread");
}

/** "[foliation #90] No fix needed" → "foliation". */
export function tagOf(text: string): string | undefined {
  return /^\s*\[\s*([^\]\s]+)[^\]]*\]/.exec(text)?.[1]?.toLowerCase();
}

/** The tag a reply starts with ("[my-app] do x", "my-app: do x", "my-app do x"), if it's one of `tags`. */
function addressed(reply: string, tags: string[]): string | undefined {
  const t = reply.trim().toLowerCase().replace(/^\[\s*/, "");
  return tags.find((tag) => t.startsWith(tag) && /^($|[\s\]:,.-])/.test(t.slice(tag.length)));
}

/** A number at the start, alone or before the message: "2", "[2]", "2: do it" (as Tether reads it). */
const NUMBERED = /^[[(]?\s*([1-9])\s*[\])]?(?=$|[\s:.,)\]-])/;

/** Whether the reply is `me`'s to take (see the rule above). */
export function owns(me: Waiter, reply: { text: string; replyTo?: string }, others: Others, now: number): boolean {
  const waiters = others.waiters.filter((w) => w.pid !== me.pid && w.until > now);
  if (reply.replyTo) {
    if (reply.replyTo === me.id) return true;
    if (waiters.some((w) => w.id === reply.replyTo) || others.tethers.some((t) => t.sent.includes(reply.replyTo!))) return false;
  }
  const tags = [me, ...waiters].flatMap((w) => (w.tag ? [w.tag] : []));
  const tag = addressed(reply.text, tags);
  if (tag) return tag === me.tag;
  const n = NUMBERED.exec(reply.text.trim());
  if (n && others.tethers.some((t) => t.open.some((o) => o.n === Number(n[1]) && o.until > now))) return false;
  const latest = Math.max(0, ...waiters.map((w) => w.sentAt), ...others.tethers.map((t) => t.lastOut));
  return me.sentAt >= latest;
}

function alive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e: any) {
    return e?.code === "EPERM";
  }
}

export class FileThread {
  constructor(
    readonly dir: string = threadDir(),
    private isAlive: (pid: number) => boolean = alive,
  ) {}

  private get mine() {
    return join(this.dir, `textme-${process.pid}.json`);
  }

  /** The other textme waiters and Tether runners publishing now. */
  others(): Others {
    const out: Others = { waiters: [], tethers: [] };
    let names: string[];
    try {
      names = readdirSync(this.dir);
    } catch {
      return out;
    }
    for (const name of names) {
      const kind = /^(textme|tether)-(\d+)\.json$/.exec(name)?.[1];
      if (!kind || name === `textme-${process.pid}.json`) continue;
      const file = join(this.dir, name);
      try {
        const v = JSON.parse(readFileSync(file, "utf8"));
        if (!this.isAlive(v?.pid)) {
          rmSync(file, { force: true });
          continue;
        }
        if (kind === "textme" && typeof v.sentAt === "number" && typeof v.until === "number")
          out.waiters.push({ pid: v.pid, sentAt: v.sentAt, until: v.until, id: typeof v.id === "string" ? v.id : undefined, tag: typeof v.tag === "string" ? v.tag : undefined });
        if (kind === "tether" && typeof v.lastOut === "number" && Array.isArray(v.open) && Array.isArray(v.sent))
          out.tethers.push({ pid: v.pid, lastOut: v.lastOut, open: v.open, sent: v.sent });
      } catch {}
    }
    return out;
  }

  publish(me: Waiter) {
    try {
      mkdirSync(this.dir, { recursive: true, mode: 0o700 });
      const tmp = `${this.mine}.tmp`;
      writeFileSync(tmp, JSON.stringify({ kind: "textme", ...me }), { mode: 0o600 });
      renameSync(tmp, this.mine);
    } catch {}
  }

  clear() {
    rmSync(this.mine, { force: true });
  }
}
