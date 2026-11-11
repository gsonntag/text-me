// Send yourself an iMessage via Photon Spectrum.
//
//   bun scripts/notify.ts "message"              send, then wait up to 5 min for a reply (default)
//   bun scripts/notify.ts --wait=10m "message"   custom wait (s/m suffix)
//   bun scripts/notify.ts --no-wait "message"    send and exit immediately
//
// When waiting it prints `REPLY: <text>` or `NO_REPLY`, and exits 0 either way.
// Text can also be piped on stdin.
//
// Other waiting textmes and Tether share the thread: a reply is taken only when it's this text's
// (threaded to it, starting with its [tag], or plain while this is the latest text; scripts/thread.ts).
import { Spectrum } from "spectrum-ts";
import { imessage } from "@spectrum-ts/imessage";
import { FileThread, owns, tagOf, type Waiter } from "./thread";

const DEFAULT_WAIT_MS = 5 * 60_000;

let waitMs = DEFAULT_WAIT_MS;
const words: string[] = [];
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--wait(?:=(\d+)([sm]?))?$/);
  if (arg === "--no-wait") {
    waitMs = 0;
  } else if (m) {
    waitMs = m[1] ? Number(m[1]) * (m[2] === "s" ? 1000 : 60_000) : DEFAULT_WAIT_MS;
  } else {
    words.push(arg);
  }
}

const text = words.join(" ").trim() || (process.stdin.isTTY ? "" : (await Bun.stdin.text()).trim());
const phone = process.env.NOTIFY_PHONE;

if (!text) {
  console.error('usage: textme [--wait=5m | --no-wait] "message"');
  process.exit(2);
}
if (!phone) {
  console.error("NOTIFY_PHONE is not set in .env (e.g. NOTIFY_PHONE=+13105551234)");
  process.exit(2);
}

const digits = (s: string) => s.replace(/\D/g, "").slice(-10);
const myDigits = digits(phone);

const app = await Spectrum({
  projectId: process.env.PROJECT_ID!,
  projectSecret: process.env.PROJECT_SECRET!,
  providers: [imessage.config()],
});

function textOf(content: any): { text: string; replyTo?: string } | undefined {
  if (!content) return undefined;
  if (content.type === "text" && typeof content.text === "string") return { text: content.text };
  if (content.type === "markdown" && typeof content.markdown === "string") return { text: content.markdown };
  if (content.type === "reply") {
    // threaded iMessage reply: what it answers
    const inner = textOf(content.content);
    return inner && { text: inner.text, replyTo: typeof content.target?.id === "string" ? content.target.id : undefined };
  }
  return undefined;
}

const thread = new FileThread();
let me: Waiter | undefined;
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const)
  process.on(sig, () => {
    thread.clear();
    process.exit(130);
  });

// Starts listening before the send so a fast reply can't be missed.
async function waitForReply(after: Date): Promise<string | undefined> {
  for await (const [, message] of app.messages) {
    if (message.direction !== "inbound") continue;
    if (message.timestamp < after) continue; // ignore history replayed on connect
    if (!message.sender || digits(message.sender.id) !== myDigits) continue;
    const reply = textOf(message.content);
    if (!reply?.text.trim()) continue;
    // Someone else's (another textme's, or Tether's): keep waiting.
    if (me && !owns(me, reply, thread.others(), Date.now())) continue;
    return reply.text;
  }
  return undefined;
}

let code = 0;
try {
  const startedAt = new Date(Date.now() - 2000);
  const replyPromise = waitMs ? waitForReply(startedAt) : undefined;

  const im = imessage(app);
  const space = await im.space.create(await im.user(phone));
  const mins = Math.max(1, Math.round(waitMs / 60_000));
  const sent: any = await space.send(waitMs ? `${text}\n\n(reply within ${mins} min to steer)` : text);
  console.log("sent");
  if (waitMs) {
    const sentAt = Date.now();
    me = { pid: process.pid, sentAt, until: sentAt + waitMs, id: typeof sent?.id === "string" ? sent.id : undefined, tag: tagOf(text) };
    thread.publish(me);
  }

  if (replyPromise) {
    const timeout = new Promise<undefined>((r) => setTimeout(() => r(undefined), waitMs));
    const reply = await Promise.race([replyPromise, timeout]);
    if (reply) {
      console.log(`REPLY: ${reply}`);
      console.log("NOTE: If this reply looks unrelated to what you texted, ignore it and continue as if NO_REPLY.");
    } else {
      console.log("NO_REPLY");
    }
  }
} catch (err) {
  console.error("send failed:", err);
  code = 1;
} finally {
  thread.clear();
  await app.stop();
  process.exit(code);
}
