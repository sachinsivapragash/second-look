# Second Look: a private scam checker (Firebase AI Logic hybrid inference)

**Got a message that feels off? Paste it, get a straight answer and what to do next, without handing your private messages to a server when you don't have to.**

Live: https://sachinsivapragash.github.io/second-look/ · License: Apache-2.0

## Why
Scam texts, fake bank calls and "Hi Mum, new number" messages cost people billions, and the people most often targeted are the least likely to know the warning signs. The obvious fix, "paste it into an AI chatbot", means sending private messages, phone numbers and one-time codes to a server. Second Look is built around one idea: **check privately first, and only send what's needed, after removing personal data on your own device.**

## How Firebase AI Logic hybrid inference is used
Second Look uses the Firebase AI Logic Web SDK (`firebase/ai`), `getGenerativeModel` with `InferenceMode`, in [`src/web/ai.js`](src/web/ai.js):

- **On-device (Gemini Nano in Chrome):** when the built-in model is `available`, Second Look calls the SDK with `InferenceMode.ONLY_ON_DEVICE`, so the full message never leaves the computer. It uses a `responseConstraint` (JSON schema) for structured output.
- **Cloud (Gemini via the Gemini Developer API):** when on-device AI isn't available or the text is very long, it calls `InferenceMode.ONLY_IN_CLOUD`, **after** removing phone numbers, emails, card numbers (Luhn-checked), bank account numbers, one-time codes and link paths on the device. It uses `responseSchema` for structured output.
- **Why not just `PREFER_ON_DEVICE`?** That mode silently falls back to the cloud with the *same* prompt, which would send the personal data along. Second Look routes each request itself ([`src/core/router.js`](src/core/router.js)), so the raw text only ever goes to the on-device model.
- Every result shows a **privacy receipt**: where it ran (`response.inferenceSource`), what was removed, and the exact text that was sent.
- A **Private only** switch never uses the cloud. Without on-device AI it falls back to the instant checks alone.
- **On-device model download:** if Chrome reports `downloadable`, a button starts the download (it needs a user gesture), and the app uses the cloud until the model is ready.

## Features
- **Text or screenshot:** paste a message, or drop/paste a screenshot (WhatsApp, SMS, fake receipts). Images are read on-device when Chrome supports image input; otherwise they go to the cloud only after you tick a consent box, because pictures can't be redacted automatically.
- **Ask about it:** follow-up questions ("I already clicked the link, what now?") answered with the same privacy routing as the check.
- **Any language:** answers in 12 languages; English, Spanish and Japanese run on-device, and the others are marked "(cloud)".
- **Live protection in Gmail and WhatsApp Web (Chrome extension):** opened emails and incoming chat messages are scanned by the instant checks *inside the tab*. Risky ones get a warning banner with a "Full check" button. Nothing leaves the page unless you press it.
- **Right-click "Check with Second Look"** on any selected text, plus an offline popup check.
- **Community reports:** report a scam site and see how many others did (hashed domains only).
- **Resilient cloud:** if the main Gemini model is overloaded or out of quota, it retries with a lighter model.

## Other Firebase products
- **App Check** (required), with the reCAPTCHA Enterprise / Fraud Defense provider, protects the Gemini API from abuse.
- **Anonymous Authentication** for community reports, with 30-day auto clean-up of anonymous accounts.
- **Cloud Firestore:** community reports of scam sites store **only a SHA-256 hash of the domain**, one report per anonymous user, with a server timestamp and nothing else. The rules are in [`firestore.rules`](firestore.rules).
- **Remote Config:** the cloud model, the on-device length limit and the community-alert threshold are tunable without a release.

## Safety by design
- **Instant checks first:** deterministic rules ([`src/core/signals.js`](src/core/signals.js)) flag requests for codes or passwords, gift cards, crypto or wire payments, pressure, fake prizes, job fees, parcel fees, "Hi Mum" requests, remote-access apps, secrecy, and look-alike domains (punycode, digit swaps, brand names on other domains, shorteners, risky domain endings). They work with no AI at all.
- **The AI can raise a warning, never lower it:** the final verdict is at least the level the instant checks found ([`src/core/verdict.js`](src/core/verdict.js)).
- **Prompt injection:** the message is fenced and marked untrusted, and its instructions are ignored. The output must match a schema and is re-validated in code.
- **No message storage:** history keeps only the verdict (risk, type, where it ran) on the device. Text shared from the Chrome extension arrives in the URL fragment, which browsers never send to a server.
- **Accessibility:** labelled controls, visible focus, live regions for results, reduced-motion support, large touch targets, and light and dark themes.

## Run it locally
```bash
npm install
npm test           # core tests: redaction, red flags, verdict floor, routing
npm start          # builds and serves on http://localhost:5050
```
For local testing, App Check uses a debug token. Register the token the browser console prints under **App Check → Apps → Manage debug tokens** in the Firebase console.

To try on-device AI: use Chrome with built-in AI (Gemini Nano) enabled. Second Look shows "On-device AI ready" when it is.

## Project layout
| Path | What |
|---|---|
| `src/core/` | Redaction, red-flag checks, verdict schema and floor, hybrid router (pure JS, unit-tested) |
| `src/web/ai.js` | Firebase: App Check, Auth, Remote Config, Firestore, AI Logic hybrid inference |
| `src/web/main.js` | UI |
| `public/` | Static site (deployed to GitHub Pages by `.github/workflows/pages.yml`) |
| `firestore.rules` | Security rules for community reports |

## Built with
Firebase AI Logic (hybrid inference: Gemini Nano on-device and Gemini in the cloud), App Check, Authentication, Cloud Firestore, Remote Config, vanilla JavaScript, esbuild. Built with Claude Code. The [ECC](https://github.com/affaan-m/ECC) design-direction, accessibility and security checklists guided the UI and hardening.
