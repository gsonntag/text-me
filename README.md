# text-me

A [Claude Code](https://claude.com/claude-code) skill that lets Claude text you an iMessage when it finishes something or needs your input.

> "run the full test suite and text me when it's done"
>
> 📱 `✅ tests pass (142/142) in my-app`

It only sends. Each `textme` call connects to [Photon Spectrum](https://photon.codes/docs/spectrum-ts), sends one message and exits. It doesn't receive messages, and you don't need a server or anything running in the background.

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
textme "hello from claude"   # prints "sent" on success
```

## Usage

In Claude Code:

- Add **"text me when done"** to any request. Claude finishes the work, checks the result, then texts you a one-line summary.
- **`/text-me <message>`** sends a message directly.
- If Claude gets blocked and needs a decision, it will text you about that too.

From a terminal or script:

```sh
textme "deploy finished"
long_job && textme "✅ job done" || textme "❌ job failed"
echo "piped text works too" | textme
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
bin/textme         command-line wrapper
.env.example       config template; your real .env is gitignored
```
