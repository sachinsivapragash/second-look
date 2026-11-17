# Devpost submission: Second Look (#BuildHybridAI 2026)

**Name:** Second Look

**Tagline (under 200 characters):** A private scam checker for the people we love: hybrid AI that runs Gemini Nano on your device, and only ever sends the cloud a version with your personal data removed.

**Links**
- Try it: https://sachinsivapragash.github.io/second-look/
- Code (Apache-2.0): https://github.com/sachinsivapragash/second-look
- Video: *(add the YouTube link)*

**Built with:** firebase-ai-logic, gemini-nano, gemini, chrome-prompt-api, firebase-app-check, recaptcha-enterprise, firebase-authentication, cloud-firestore, firebase-remote-config, chrome-extensions, javascript, esbuild, github-pages

---

## Inspiration
Scam texts are relentless: parcel fees, "Hi Mum, new number", fake bank security calls. The people most likely to be targeted are the least likely to want to paste their private messages into a chatbot. We wanted a calm "second look" that gives a straight answer and the next step, without making privacy the price.

## What it does
- **Paste a message or drop a screenshot** and get a clear verdict (scam / suspicious / no clear signs), numbered steps for what to do, and the reasons, with the suspicious parts highlighted.
- **Privacy receipt:** every result says where it ran. On the device: nothing sent. In the cloud: exactly what was removed first, with a "show exactly what was sent" view.
- **Ask about it:** follow-up questions such as "I already clicked the link, what now?"
- **Any language:** answers in 12 languages, including Hindi, Tamil, Telugu, Bengali, Marathi, Arabic (right-to-left) and Swahili.
- **Private only mode:** never touches the cloud; deterministic instant checks still work offline.
- **Community reports:** report a scam site and see how many others did. Only a SHA-256 hash of the domain is stored.
- **Chrome extension with live protection:** warning banners right inside Gmail and WhatsApp Web, computed locally in the tab, plus right-click "Check with Second Look" anywhere.

## How we built it
- **Firebase AI Logic hybrid inference** is the core. When Chrome's Gemini Nano is `available`, we call `InferenceMode.ONLY_ON_DEVICE` with a JSON `responseConstraint`, so the raw message never leaves the computer. Otherwise we call `ONLY_IN_CLOUD` with a `responseSchema`, **after** on-device redaction of phone numbers, emails, Luhn-checked card numbers, IBANs, one-time codes and link paths.
- **We deliberately route each request ourselves instead of using `PREFER_ON_DEVICE`.** That mode falls back to the cloud with the *same* prompt, which would leak the unredacted text. Our router (`src/core/router.js`) guarantees raw text only ever reaches the local model.
- **Images:** checked on-device when the browser supports image input. Otherwise they go to the cloud only after explicit consent, because pictures can't be redacted.
- **Safety:** deterministic signal rules set a floor. The AI can raise a warning but never lower it. The message is fenced as untrusted to resist prompt injection, and the output is schema-validated in code.
- **Firebase:**
  - **App Check** with reCAPTCHA Enterprise (Fraud Defense) protects the Gemini API.
  - **Anonymous Auth** with 30-day clean-up.
  - **Firestore**, with strict rules (one hashed report per user, server timestamp only).
  - **Remote Config** for the cloud model, its fallback model, the on-device length limit and the alert threshold.
- **Resilience:** if the main cloud model is overloaded or out of quota, it retries with a lighter Gemini model.
- **Delivery:** static web app built with esbuild and deployed to GitHub Pages by GitHub Actions; a Manifest V3 Chrome extension.

## Challenges we ran into
- `PREFER_ON_DEVICE` silently sends the same prompt to the cloud, so a privacy-first app has to make the routing decision itself.
- In browsers where the Prompt API exists but can't create sessions, cloud calls hung until we built a plain cloud model for cloud mode.
- Free-tier cloud quotas: we added a model fallback and a clear "instant checks only" receipt so the app never just fails.
- Gmail and WhatsApp Web render messages dynamically, so the extension watches the page and scans each new message once.

## Accomplishments that we're proud of
- A privacy receipt that makes hybrid inference *visible* to non-technical users.
- The AI can never talk a dangerous message down to "safe".
- It is still useful with no AI at all: offline instant checks in the app and the extension.

## What we learned
Hybrid AI isn't just "local if possible". The most important design work is deciding *what* is allowed to leave the device, and showing the user that decision every time.

## What's next for Second Look
- On-device OCR so screenshots can be redacted before any cloud call.
- More languages on-device as Gemini Nano adds them.
- An Android share-sheet version, and family mode so a relative can forward a message for a second look.
