// Send yourself an iMessage via Photon Spectrum.
//
//   bun scripts/notify.ts "message"              send and exit
//   bun scripts/notify.ts --wait "question?"     send, then wait up to 5 min for a reply
//   bun scripts/notify.ts --wait=10m "question?" custom wait (s/m suffix)
//
// With --wait: prints `REPLY: <text>` and exits 0 on a reply, or prints `NO_REPLY` and exits 3 on timeout.
// Text can also be piped on stdin.
import { Spectrum } from "spectrum-ts";
import { imessage } from "@spectrum-ts/imessage";

const DEFAULT_WAIT_MS = 5 * 60_000;

let waitMs = 0;
const words: string[] = [];
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--wait(?:=(\d+)([sm]?))?$/);
  if (m) {
    waitMs = m[1] ? Number(m[1]) * (m[2] === "s" ? 1000 : 60_000) : DEFAULT_WAIT_MS;
  } else {
    words.push(arg);
  }
}

const text = words.join(" ").trim() || (process.stdin.isTTY ? "" : (await Bun.stdin.text()).trim());
const phone = process.env.NOTIFY_PHONE;

if (!text) {
  console.error('usage: textme [--wait[=5m]] "message"');
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

function textOf(content: any): string | undefined {
  if (!content) return undefined;
  if (content.type === "text") return content.text;
  if (content.type === "markdown") return content.markdown;
  if (content.type === "reply") return textOf(content.content); // threaded iMessage reply
  return undefined;
}

// Starts listening before the send so a fast reply can't be missed.
async function waitForReply(after: Date): Promise<string | undefined> {
  for await (const [, message] of app.messages) {
    if (message.direction !== "inbound") continue;
    if (message.timestamp < after) continue; // ignore history replayed on connect
    if (!message.sender || digits(message.sender.id) !== myDigits) continue;
    const reply = textOf(message.content);
    if (reply) return reply;
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
  await space.send(waitMs ? `${text}\n\n(reply within ${mins} min to steer)` : text);
  console.log("sent");

  if (replyPromise) {
    const timeout = new Promise<undefined>((r) => setTimeout(() => r(undefined), waitMs));
    const reply = await Promise.race([replyPromise, timeout]);
    if (reply) {
      console.log(`REPLY: ${reply}`);
      console.log(
        "NOTE: Other agents may be waiting on a reply at the same time. If this reply appears unrelated to " +
          "your current conversation, ignore it unless the user explicitly addresses you, and continue as if NO_REPLY.",
      );
    } else {
      console.log("NO_REPLY");
      code = 3;
    }
  }
} catch (err) {
  console.error("send failed:", err);
  code = 1;
} finally {
  await app.stop();
  process.exit(code);
}
