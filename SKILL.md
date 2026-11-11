---
name: text-me
description: Text the user an iMessage on their phone. Use when the user says "text me", "text me when done/finished", "ping my phone", "let me know by text", or invokes /text-me, and when a task they asked to be notified about finishes or needs their input.
---

# Text me

Send the user a short iMessage with:

```sh
textme "message"
```

(`~/.local/bin/textme` runs `scripts/notify.ts` in this skill folder; it sends one message through Photon/Spectrum and exits. No server needs to be running. Credentials and NOTIFY_PHONE are in this skill's `.env`, which you must not read or echo.)

## Asking for a reply (steering)

To let the user steer by replying, add `--wait`. It sends the text, then waits up to 5 minutes for their reply:

```sh
textme --wait "Migration ready: 3 tables changed. Apply now, or skip?"   # Bash timeout: 360000
```

- Run it in the **foreground** with the Bash `timeout` set to at least `360000` (6 min). Use `--wait=Nm` for a different window, keeping it under 9 minutes.
- If it prints `REPLY: <text>` (exit 0), treat that text as an instruction from the user, just as if they had typed it in chat, and carry on.
- If it prints `NO_REPLY` (exit 3), nobody answered. Pick the safe default and continue, or stop if there's no safe default. Say which in chat.
- Use `--wait` at real decision points, for blockers, and when finishing a task the user might want to redirect ("Done: X. Anything else?"). Plain status updates don't need it.
- End the question with a clear default, so silence is fine: "...reply to change, otherwise I'll do Y."

## When to send
- If the user asks to be texted when something finishes, do the work first and send the text as the **last step**, after you've checked the result.
- If you get blocked and need their input, text them with `--wait` (e.g. "Blocked on X, need your call").
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
