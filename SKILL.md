---
name: text-me
description: Text the user an iMessage on their phone. Use when the user says "text me", "text me when done/finished", "ping my phone", "let me know by text", or invokes /text-me, and when a task they asked to be notified about finishes or needs their input.
---

# Text me

Send the user a short iMessage with:

```sh
textme "[my-app] ✅ tests pass (142/142). Anything else?"   # Bash timeout: 360000
```

Every text waits for a reply. `textme` sends the message, then listens for up to 5 minutes for the user's reply, so the user can always steer you from their phone. (`~/.local/bin/textme` runs `scripts/notify.ts` in this skill folder. No server needs to be running. Credentials and NOTIFY_PHONE are in this skill's `.env`, which you must not read or echo.)

## Handling the reply

- Always run it in the **foreground** with the Bash `timeout` set to `360000` (6 min). Don't use `--no-wait`; that's only for the user's own shell scripts.
- If it prints `REPLY: <text>`, treat that text as an instruction from the user, just as if they had typed it in chat, and carry on.
- **Always answer a reply by text, not just in chat.** The user replied from their phone, so assume they're away from the terminal. If the reply is a question, greeting or comment ("hi", "how'd it go?"), answer it with another `textme`, which waits again. If it's a task, send a short acknowledgement only if the task will take more than a couple of minutes ("on it: adding dark mode"), then text again when it's done. Never leave a reply without a text answer.
- **This applies to "done" texts too.** A reply to a completion text is often a new task ("nice, now add dark mode"). Do it, then text again when that's done, which waits for another reply. Keep this loop going until a text gets `NO_REPLY` or the user says they're done.
- **Several agents can be waiting at once, and they all receive the same reply.** If the reply appears unrelated to your current conversation, ignore it unless the user explicitly addresses you (e.g. names your project or task), and continue as if `NO_REPLY`. Say in chat that you ignored it. Start every text with a short tag such as `[my-app]` (the project or task name), so the user can address you.
- If it prints `NO_REPLY`, nobody answered. Continue with the default you stated, or end your turn if you were done. Say which in chat.
- Write the text so that silence is fine: state the default ("...reply to change, otherwise I'll do Y") or ask an open question ("Anything else?").

## When to send
- If the user asks to be texted when something finishes, do the work first and send the text as the **last step**, after you've checked the result.
- If you get blocked and need their input, text them (e.g. "Blocked on X, need your call").
- If they run `/text-me <message>` directly, send that message as written.
- Send one text per event. Don't send progress updates unless they ask for them.

## Message style
- Keep it under ~160 characters, in plain text, with the outcome first: `✅ tests pass (142/142) in self-texter` or `❌ build failed: missing env var API_KEY`.
- Name the project or task so they know what it's about.
- Never include secrets, tokens, or the contents of `.env`.

## Checking that it worked
- On success the command prints `sent`. Ignore the `[spectrum.lifecycle]` log lines.
- If you see `send failed` with `Target not allowed for this project`, the phone isn't registered on the Photon project; tell the user to check the Photon dashboard.
- If it says `NOTIFY_PHONE is not set`, the number is missing from `~/.claude/skills/text-me/.env`.
- If sending fails, tell the user in chat. Don't retry in a loop.
