// Removes personal data from text before anything is sent to a cloud model.
// Runs on the device. Keeps link domains (needed to judge a scam) but drops paths and query strings,
// which often carry tracking IDs or one-time tokens.

const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿]/g;

function luhn(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = +digits[digits.length - 1 - i];
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

const RULES = [
  // Card numbers (13-19 digits with optional spaces/dashes) that pass the Luhn check.
  ['card', /\b(?:\d[ -]?){12,18}\d\b/g, (m) => luhn(m.replace(/\D/g, ''))],
  ['iban', /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g],
  ['email', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  // One-time codes: a 4-8 digit number near "code", "OTP", "PIN" or "verification".
  ['code', /\b(?:code|otp|pin|passcode|verification|vérification|codigo|código)\b[^\d\n]{0,20}(\d{4,8})\b/gi],
  // Phone numbers: optional +country, 8-15 digits with separators.
  ['phone', /(?:\+|\b00)?\d[\d\s().-]{7,}\d\b/g, (m) => { const n = m.replace(/\D/g, '').length; return n >= 8 && n <= 15; }],
  // Long ID-like numbers (accounts, national IDs) not caught above.
  ['number', /\b\d{9,}\b/g],
];

const LABEL = { card: '[CARD]', iban: '[IBAN]', email: '[EMAIL]', code: '[CODE]', phone: '[PHONE]', number: '[NUMBER]' };

// URLs: keep scheme + host so the model can still spot lookalike domains, drop the rest.
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;

export function redact(input) {
  let text = String(input ?? '').normalize('NFC').replace(INVISIBLE, '');
  const counts = {};
  const bump = (k) => { counts[k] = (counts[k] || 0) + 1; };

  text = text.replace(URL_RE, (u) => {
    try {
      const url = new URL(u);
      if (url.pathname === '/' && !url.search && !url.hash) return u;
      bump('link');
      return `${url.protocol}//${url.host}/[…]`;
    } catch { return u; }
  });

  for (const [kind, re, check] of RULES) {
    text = text.replace(re, (m, g1) => {
      if (check && !check(m)) return m;
      bump(kind);
      if (kind === 'code' && g1) return m.replace(g1, LABEL.code);
      return LABEL[kind];
    });
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { text, counts, total };
}
