// One-shot outbound iMessage: `bun src/notify.ts "your message"`
// Sends to NOTIFY_PHONE (from .env) and exits. No inbound handling.
import { Spectrum } from "spectrum-ts";
import { imessage } from "@spectrum-ts/imessage";

const text = process.argv.slice(2).join(" ").trim() || (await Bun.stdin.text()).trim();
const phone = process.env.NOTIFY_PHONE;

if (!text) {
  console.error('usage: bun src/notify.ts "message"  (or pipe text on stdin)');
  process.exit(2);
}
if (!phone) {
  console.error("NOTIFY_PHONE is not set in .env (e.g. NOTIFY_PHONE=+13105551234)");
  process.exit(2);
}

const app = await Spectrum({
  projectId: process.env.PROJECT_ID!,
  projectSecret: process.env.PROJECT_SECRET!,
  providers: [imessage.config()],
});

let code = 0;
try {
  const im = imessage(app);
  const space = await im.space.create(await im.user(phone));
  await space.send(text);
  console.log("sent");
} catch (err) {
  console.error("send failed:", err);
  code = 1;
} finally {
  await app.stop();
  process.exit(code);
}
