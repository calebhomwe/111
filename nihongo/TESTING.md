# Testing Michi on an iPhone

## Where to open it

| | Link | Notes |
|---|---|---|
| **claude.ai artifact** | https://claude.ai/artifact/PgAA73qSvtCscfkui3W8tg | Private to your account. Everything works, including Sensei (the Claude tutor) and progress sync. |
| **GitHub Pages** (after the one-time setup below) | https://calebhomwe.github.io/111/ | Public. Works offline and can be added to the Home Screen. Sensei and cloud sync are not available (they need claude.ai). |

### One-time GitHub Pages setup
1. Repo **Settings → Pages**.
2. **Build and deployment → Source: Deploy from a branch**.
3. **Branch: `gh-pages` / `(root)`** → Save. The site is live about a minute later.

To publish a new build: `bash nihongo/tools/deploy_pages.sh`.

## Install it like an app (GitHub Pages version)
Safari → open the site → **Share** → **Add to Home Screen**. It opens full screen with its own icon and keeps working with no signal after the first visit (the voice recordings download as you use them).

## Before you start
- Turn the **silent switch off** (the side switch). iPhone mutes web audio when it is on.
- Tap anything once; the first tap switches the sound on.
- Use **iOS 14 or newer**. Some shading is simpler before iOS 16.2.

## 10-minute test script
1. **Welcome**: pick *I'm brand new*. You land on Today.
2. **First lesson**: Learn → Hiragana · Vowels. Check the stroke animation, tap the speaker (you should hear a human voice), finish the check. A stamp and petals appear at the end.
3. **Typing**: Review → answer a card that asks you to type. Type romaji (`a`, `ka`); it should become kana. The keyboard must not zoom the page.
4. **Writing**: Dojo → Writing. Draw あ with your finger. The page must not scroll while you draw. Tap *Undo*.
5. **Kana Blitz**: Dojo → Kana Blitz, 60 seconds.
6. **Read a story**: Read → open one, tap a word (meaning + audio), then *Read aloud*.
7. **Placement test**: Settings → *Take the test*. Answer a few questions, including a listening one.
8. **Speech styles**: Learn → *Speech styles*, then Dojo → *Read the Room*.
9. **Rotate the phone** on Today, a lesson and Writing.
10. **Offline** (Pages version only): after one visit, enable Airplane Mode and reopen the Home Screen icon.

## What to report
The screen, what you tapped, what you expected and what happened. A screenshot or screen recording helps.

## Known limits
- Sensei and cloud progress sync only work in the claude.ai artifact.
- On the Pages version, progress lives in that browser on that device. Use Settings → *Export backup* to move it.
- The course content was written by AI and checked automatically; it has not been reviewed by a native speaker.
