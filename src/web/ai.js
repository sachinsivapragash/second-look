// Firebase wiring: App Check, anonymous Auth, Remote Config, Firestore and Firebase AI Logic hybrid inference.
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { getFirestore, doc, setDoc, serverTimestamp, collection, getCountFromServer } from 'firebase/firestore';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';
import { firebaseConfig, RECAPTCHA_V3_SITE_KEY } from './firebase-config.js';
import { redact } from '../core/redact.js';
import { scanSignals } from '../core/signals.js';
import { buildPrompt, finalVerdict, VERDICT_SCHEMA } from '../core/verdict.js';
import { route, MODES } from '../core/router.js';

// Local development can use an App Check debug token (registered in the console); production uses reCAPTCHA Enterprise.
if (['localhost', '127.0.0.1'].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = localStorage.getItem('appcheck-debug') || true;

export const app = initializeApp(firebaseConfig);
initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_V3_SITE_KEY), isTokenAutoRefreshEnabled: true });
const auth = getAuth(app);
const db = getFirestore(app);
const ai = getAI(app, { backend: new GoogleAIBackend() });

// Remote Config: tune without shipping a new version.
const rc = getRemoteConfig(app);
rc.settings.minimumFetchIntervalMillis = 60 * 60 * 1000;
rc.defaultConfig = { cloud_model: 'gemini-3.5-flash', on_device_max_chars: 4000, community_alert_threshold: 3 };
export const configReady = fetchAndActivate(rc).catch(() => false);
export const cfg = () => ({
  cloudModel: getValue(rc, 'cloud_model').asString(),
  maxOnDeviceChars: getValue(rc, 'on_device_max_chars').asNumber(),
  communityThreshold: getValue(rc, 'community_alert_threshold').asNumber(),
});

let signIn = null;
const user = () => (signIn ||= signInAnonymously(auth).then((c) => c.user));

// ---- On-device model (Chrome built-in AI, Gemini Nano) ----
const LM = () => globalThis.LanguageModel;
const LANGS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
export async function onDeviceAvailability() {
  try { return LM() ? await LM().availability(LANGS) : 'unavailable'; } catch { return 'unavailable'; }
}
// Must run from a click (Chrome needs user activation to start the model download).
export async function downloadOnDeviceModel(onProgress) {
  if (!LM()) throw new Error('This browser has no built-in AI');
  const s = await LM().create({ ...LANGS, monitor(m) { m.addEventListener('downloadprogress', (e) => onProgress?.(e.loaded)); } });
  s.destroy?.();
}

function modelFor(mode) {
  const c = cfg();
  return getGenerativeModel(ai, {
    mode,
    onDeviceParams: { createOptions: { ...LANGS, temperature: 0.2, topK: 3 }, promptOptions: { responseConstraint: VERDICT_SCHEMA } },
    inCloudParams: { model: c.cloudModel, generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: VERDICT_SCHEMA } },
  });
}

// One full check. Returns the verdict plus where it ran and what was removed before any cloud call.
export async function check(text, { privateOnly = false } = {}) {
  await configReady;
  const original = String(text || '').slice(0, 20000);
  const signals = scanSignals(original);
  const availability = await onDeviceAvailability();
  const r = route({ availability, length: original.length, privateOnly, maxOnDeviceChars: cfg().maxOnDeviceChars });
  const started = performance.now();
  if (!r.mode) return { ...finalVerdict(null, signals), source: 'checks-only', why: r.why, ms: 0, redaction: null, signals };
  const red = r.redact ? redact(original) : null;
  const sent = red ? red.text : original;
  const prompt = buildPrompt(sent, { signals, redacted: !!red });
  try {
    const res = await modelFor(r.mode).generateContent(prompt);
    const v = finalVerdict(res.response.text(), signals);
    const source = res.response.inferenceSource || (r.mode === MODES.ON ? 'on_device' : 'in_cloud');
    return { ...v, source, why: r.why, ms: Math.round(performance.now() - started), redaction: red ? { counts: red.counts, total: red.total, sentText: red.text } : null, signals };
  } catch (e) {
    return { ...finalVerdict(null, signals), source: 'checks-only', why: r.why, error: e.message, ms: Math.round(performance.now() - started), redaction: red ? { counts: red.counts, total: red.total, sentText: red.text } : null, signals };
  }
}

// ---- Community reports: only a SHA-256 of the domain is stored, one report per anonymous user ----
async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s.toLowerCase()));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function reportDomain(host) {
  const u = await user();
  const h = await sha256(host);
  await setDoc(doc(db, 'domains', h, 'reports', u.uid), { at: serverTimestamp() });
  return reportCount(host);
}
export async function reportCount(host) {
  try { await user(); const h = await sha256(host); return (await getCountFromServer(collection(db, 'domains', h, 'reports'))).data().count; } catch { return null; }
}
