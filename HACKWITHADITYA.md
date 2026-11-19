# HackWithAditya 2026: Level 1 submission (Second Look)

**Team:** Second Look · **Theme:** Cybersecurity, FinTech & Digital Trust

## Links
- Working prototype: https://sachinsivapragash.github.io/second-look/
- Source code (Apache-2.0): https://github.com/sachinsivapragash/second-look
- Demo video (1:53): https://youtu.be/3dge9OMnXcQ

## Problem (short)
UPI fraud, fake KYC and "account will be blocked" calls, parcel-fee texts and "Hi Mum, new number" WhatsApp messages cost Indian families money every day. The people most often targeted, such as parents and grandparents, are the least likely to know the warning signs, and the least willing to paste private messages into a chatbot.

## Solution (short)
Second Look is a private scam checker. You paste a message or drop a screenshot and get:
- a plain verdict
- numbered steps for what to do
- the reasons, quoted from the message

It answers in 12 languages, including Hindi, Telugu, Tamil, Bengali and Marathi.

Privacy is built in:
- It runs Gemini Nano on the device in Chrome when available.
- Otherwise it removes phone numbers, card and account numbers, OTPs and link paths on the device before Gemini checks the rest in the cloud (Firebase AI Logic).
- A "privacy receipt" shows exactly what was sent.

A Chrome extension adds live warnings inside WhatsApp Web and Gmail, computed locally in the tab.

## What works today (prototype)
- Text and screenshot checks; screenshots go to the cloud only with consent.
- Deterministic instant checks that work offline. They cover OTP and PIN requests, gift cards, crypto and wire payments, pressure tactics, fake prizes, job fees, parcel fees, "new number" requests, remote-access apps (AnyDesk/TeamViewer), secrecy, and look-alike domains (e.g. "hdfc-secure-login.top").
- The AI can raise a warning but never lower it below the instant checks. The message is treated as untrusted input to resist prompt injection.
- Follow-up questions ("I already shared the OTP, what now?").
- Private-only mode, and community reports of scam domains (hashed).
- A Chrome extension tested on live Gmail and WhatsApp Web.

## Tech
- JavaScript, esbuild and GitHub Pages
- Firebase AI Logic: hybrid on-device/cloud, Gemini 3.5 Flash
- Firebase App Check (reCAPTCHA Enterprise), Anonymous Auth, Firestore and Remote Config
- A Chrome Manifest V3 extension

## Ideas for the 48-hour enhancement round (India-first)
1. **UPI / bank-specific checks:** fake collect requests, "refund" QR codes, KYC-update links, look-alike UPI IDs and bank domains (SBI, HDFC, ICICI, Paytm).
2. **Voice:** speak a suspicious call or voice note in Telugu or Hindi and get a spoken answer for elders who don't read English.
3. **Family mode:** forward a message to a trusted family member for a "second look" with one tap.
4. **One-tap reporting** to the National Cyber Crime portal (cybercrime.gov.in) or helpline 1930, with the evidence pre-filled.
