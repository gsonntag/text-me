# text-me

A [Claude Code](https://claude.com/claude-code) skill that lets Claude text you an iMessage when it finishes something or needs your input.

> "run the full test suite and text me when it's done"
>
> 📱 `✅ tests pass (142/142) in my-app`

You can reply to any text within 5 minutes to steer that agent, or give it a new task once it's done. Each `textme` call connects to [Photon Spectrum](https://photon.codes/docs/spectrum-ts), sends one message, waits for your reply and exits. Nothing runs in the background.

## Requirements

- [Bun](https://bun.sh)
- A free [Photon](https://app.photon.codes) account with an iMessage project
- Your phone number added **and verified** on your Photon account. On the Free and Pro plans, Photon will only text registered numbers.

## Install

```sh
git clone https://github.com/gsonntag/text-me ~/.claude/skills/text-me
cd ~/.claude/skills/text-me
bun install
cp .env.example .env   # then fill in PROJECT_ID, PROJECT_SECRET, NOTIFY_PHONE
ln -s ~/.claude/skills/text-me/bin/textme ~/.local/bin/textme   # any dir on your PATH
```

Your `PROJECT_ID` and `PROJECT_SECRET` are in the Photon dashboard. If you set up with `bun create spectrum-project`, they're in that project's `.env`.

Test it:

```sh
textme --no-wait "hello from claude"   # prints "sent" on success
```

## Usage

In Claude Code:

- Add **"text me when done"** to any request. Claude finishes the work, checks the result, then texts you a one-line summary.
- **`/text-me <message>`** sends a message directly.
- If Claude gets blocked and needs a decision, it will text you about that too.
- **Reply to steer.** Every text gives you 5 minutes to reply. Your reply goes straight to that agent as an instruction ("skip the migration", "also update the docs"). If you reply to a "done" text, it takes your reply as its next task, does it and texts you again. If you don't reply, it continues with the default it stated, or stops.
- **Multiple agents:** each text starts with a tag like `[my-app]`. Each reply goes to exactly one waiting agent: the one whose text you answer in a thread (long-press → Reply), the one whose tag your reply starts with (`[my-app] skip it`), or otherwise the one that texted last. [Tether](https://github.com/gsonntag/web-coder), texting from the same number, follows the same rule, so a reply to a `textme` text doesn't also reach Tether (and `3 y` for Tether's session [3] doesn't reach a `textme`). They coordinate through small files in `~/.local/state/imessage-thread/`. Inside a session Tether runs (`TETHER_SESSION` set), `textme` refuses and points the agent at Tether's `text_person` tool (`TEXTME_IN_TETHER=1` overrides).

From a terminal or script:

```sh
textme "ship it?"                 # waits up to 5 min; prints "REPLY: <text>" or "NO_REPLY"
textme --wait=2m "quick check?"   # custom window
textme --no-wait "deploy finished"  # just send, don't wait
long_job && textme --no-wait "✅ job done" || textme --no-wait "❌ job failed"
echo "piped text works too" | textme --no-wait
```

## Troubleshooting

| Error | Fix |
|---|---|
| `Target not allowed for this project` | Your phone isn't registered on the Photon project. Add and verify it in the dashboard (avatar menu, top-right), then reload the project's setup page. |
| `NOTIFY_PHONE is not set` | Add `NOTIFY_PHONE=+1XXXXXXXXXX` to `.env`. |
| Authentication error | Check `PROJECT_ID` / `PROJECT_SECRET` in the Photon dashboard. |

## Files

```
SKILL.md           instructions Claude follows
scripts/notify.ts  the sender (spectrum-ts)
scripts/thread.ts  which waiting agent a reply belongs to
bin/textme         command-line wrapper
.env.example       config template; your real .env is gitignored
```
