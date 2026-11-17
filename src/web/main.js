// Second Look web UI.
import { check, checkImage, followUp, onDeviceAvailability, onDeviceImageAvailability, downloadOnDeviceModel, reportDomain, reportCount, cfg, configReady, ANSWER_LANGUAGES, ON_DEVICE_LANGS } from './ai.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const EXAMPLES = {
  parcel: 'Royal Mail: Your parcel is being held at our depot due to an unpaid shipping fee of £1.99. Pay within 24 hours or it will be returned: http://royalmail-redeliver-uk.top/pay?id=88213 Call +44 7700 900123 if you need help.',
  mum: 'Hi Mum, this is my new number, I dropped my phone in the toilet 🙈 Can you save it? I need to pay a bill urgently today and my banking app is locked. Can you send £640 to this account and I’ll pay you back tomorrow? Don’t tell Dad, he’ll worry.',
  bank: 'HDFC Security Team: We detected an unusual login on your account. To keep it from being suspended, read us the 6-digit verification code we just sent to your phone, and install AnyDesk so our engineer can secure your device. Code expires in 5 minutes.',
  ok: 'Hi Priya, the team lunch moved to Thursday 1pm at the usual place. The agenda is in the shared doc: https://docs.google.com/document/d/1A2b3C/edit. See you there!',
};

// ---- engine status (top right) ----
let availability = 'unavailable';
async function refreshEngine() {
  availability = await onDeviceAvailability();
  const map = {
    available: ['ok', 'On-device AI ready · messages stay on this computer'],
    downloadable: ['warn', 'Cloud AI, personal data removed first <button id="dl" type="button">Use on-device AI</button>'],
    downloading: ['warn', 'Downloading on-device AI… using the cloud meanwhile'],
    unavailable: ['cloud', 'Cloud AI · personal data removed first'],
  };
  const [cls, html] = map[availability] || map.unavailable;
  $('#engine').className = 'engine ' + cls;
  $('#engine').innerHTML = `<span class="dot"></span><span>${html}</span>`;
  $('#dl')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Starting…';
    try { await downloadOnDeviceModel((p) => { e.target.textContent = `Downloading ${Math.round(p * 100)}%`; }); } catch (err) { showErr(err.message); }
    refreshEngine();
  });
}

// Headlines and section labels in each answer language: [high, medium, low, what to do, why, ask about it]
const UI = {
  hi: ['यह लगभग निश्चित रूप से धोखा है', 'सावधान रहें: यह संदिग्ध लगता है', 'धोखे के कोई स्पष्ट संकेत नहीं', 'क्या करें', 'क्यों', 'इसके बारे में पूछें'],
  ta: ['இது பெரும்பாலும் ஒரு மோசடி', 'கவனம்: இது சந்தேகமாகத் தெரிகிறது', 'மோசடிக்கான தெளிவான அறிகுறிகள் இல்லை', 'என்ன செய்வது', 'ஏன்', 'இதைப் பற்றி கேளுங்கள்'],
  te: ['ఇది దాదాపు ఖచ్చితంగా మోసం', 'జాగ్రత్త: ఇది అనుమానాస్పదంగా ఉంది', 'మోసం యొక్క స్పష్టమైన సంకేతాలు లేవు', 'ఏం చేయాలి', 'ఎందుకు', 'దీని గురించి అడగండి'],
  bn: ['এটি প্রায় নিশ্চিতভাবে একটি প্রতারণা', 'সাবধান: এটি সন্দেহজনক মনে হচ্ছে', 'প্রতারণার কোনো স্পষ্ট লক্ষণ নেই', 'কী করবেন', 'কেন', 'এ বিষয়ে জিজ্ঞাসা করুন'],
  mr: ['हा जवळजवळ नक्कीच फसवणुकीचा प्रकार आहे', 'सावध राहा: हे संशयास्पद दिसते', 'फसवणुकीची कोणतीही स्पष्ट चिन्हे नाहीत', 'काय करावे', 'का', 'याबद्दल विचारा'],
  es: ['Esto es muy probablemente una estafa', 'Cuidado: esto parece sospechoso', 'No hay señales claras de estafa', 'Qué hacer', 'Por qué', 'Pregunta sobre esto'],
  fr: ['C’est très probablement une arnaque', 'Prudence : cela semble suspect', 'Aucun signe clair d’arnaque', 'Que faire', 'Pourquoi', 'Poser une question'],
  ar: ['هذه على الأرجح عملية احتيال', 'احذر: تبدو هذه الرسالة مريبة', 'لا توجد علامات واضحة على الاحتيال', 'ماذا تفعل', 'لماذا', 'اسأل عنها'],
  pt: ['Isto é muito provavelmente um golpe', 'Cuidado: isto parece suspeito', 'Nenhum sinal claro de golpe', 'O que fazer', 'Por quê', 'Pergunte sobre isto'],
  ja: ['これは詐欺の可能性が非常に高いです', '注意：怪しいメッセージです', '詐欺の明らかな兆候はありません', 'すべきこと', '理由', 'これについて質問する'],
  sw: ['Huu ni utapeli kwa uwezekano mkubwa', 'Kuwa mwangalifu: hii inaonekana ya kutiliwa shaka', 'Hakuna dalili wazi za utapeli', 'Cha kufanya', 'Kwa nini', 'Uliza kuhusu hili'],
};
const ui = (i, en) => UI[$('#lang')?.value]?.[i] || en;

// ---- states ----
const RISK = {
  high: { title: 'This is very likely a scam', icon: '⛔' },
  medium: { title: 'Be careful: this looks suspicious', icon: '⚠️' },
  low: { title: 'No clear signs of a scam', icon: '✅' },
};
const KIND = { card: 'card number', iban: 'bank account number', email: 'email address', code: 'one-time code', phone: 'phone number', number: 'ID number', link: 'link path' };

function showLoading(privateOnly) {
  const ai = privateOnly ? (availability === 'available' ? 'Asking the on-device AI' : 'Private mode: no AI on this device') : availability === 'available' ? 'Asking the on-device AI' : 'Removing personal data, then asking the cloud AI';
  $('#result').className = 'result loading';
  $('#result').innerHTML = `<ol class="steps" aria-label="Progress"><li class="done"><span class="s">✓</span>Instant checks on this device</li><li class="now" id="step2"><span class="s"></span>${esc(ai)}</li><li id="step3"><span class="s"></span>Writing your answer</li></ol>`;
}

function highlight(text, quotes) {
  let html = esc(text);
  for (const q of quotes.filter((x) => x && x.length >= 4).slice(0, 8)) {
    const e = esc(q);
    if (html.includes(e)) html = html.split(e).join(`<mark>${e}</mark>`);
  }
  return html;
}

function askBox(r) {
  const qs = r.risk === 'low' ? ['How can I double-check who sent this?', 'What signs should I watch for?']
    : ['I already clicked the link. What now?', 'I already paid or shared a code. What now?', 'How do I report this?'];
  return `<div class="ask"><h3>${ui(5, 'Ask about it')}</h3><div class="qs">${qs.map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <form id="askf"><label for="q" class="sr">Your question</label><input id="q" maxlength="500" placeholder="Ask anything about this message…" autocomplete="off"><button type="submit">Ask</button></form><div id="answer" aria-live="polite"></div></div>`;
}
function receipt(r) {
  if (r.source === 'on_device') {
    return `<div class="receipt device"><div class="head"><span>PRIVACY RECEIPT</span><span>${r.ms} ms</span></div>
      <p>🔒 Checked <b>on this device</b> with Gemini Nano${r.image ? ', screenshot included' : ''}.<br><b>Sent to the internet: nothing.</b></p></div>`;
  }
  if (r.source === 'in_cloud' && r.image) {
    return `<div class="receipt cloud"><div class="head"><span>PRIVACY RECEIPT</span><span>${r.ms} ms</span></div><p>☁ You agreed to send this screenshot (${esc(r.image.kb)} KB) to Gemini in the cloud through Firebase AI Logic, because this browser can’t read images on-device. Images can’t be redacted automatically, so it was sent as it is.</p></div>`;
  }
  if (r.source === 'in_cloud') {
    const items = Object.entries(r.redaction?.counts || {}).map(([k, n]) => `<li>${n} ${esc(KIND[k] || k)}${n > 1 ? 's' : ''}</li>`).join('');
    return `<div class="receipt cloud"><div class="head"><span>PRIVACY RECEIPT</span><span>${r.ms} ms</span></div>
      <p>☁ Checked in the cloud by Gemini through Firebase AI Logic, because this browser has no on-device AI ready.</p>
      ${items ? `<p><b>Removed on your device before sending:</b></p><ul>${items}</ul>` : '<p>No personal data was found to remove.</p>'}
      <details><summary>Show exactly what was sent</summary><pre>${esc(r.redaction?.sentText || '')}</pre></details></div>`;
  }
  const why = r.why === 'private-no-model' ? 'Private mode is on and this browser has no on-device AI, so only the instant checks ran.'
    : r.error ? `The AI could not be reached right now, so this answer comes from the instant checks alone. <small class="muted">(${esc(r.error.slice(0, 220))})</small>` : 'Only the instant checks ran.';
  const sentLine = r.error && r.redaction ? 'The cloud was tried with the redacted text only.' : r.error && r.image ? 'The screenshot you agreed to send was tried in the cloud.' : 'Sent to the internet: nothing.';
  return `<div class="receipt checks"><div class="head"><span>PRIVACY RECEIPT</span><span>offline</span></div><p>🧩 ${why}<br><b>${sentLine}</b></p></div>`;
}

async function render(text, r) {
  const k = RISK[r.risk];
  const quotes = r.redFlags.map((f) => f.quote);
  const hosts = r.signals.domains.map((d) => d.host).concat(
    [...new Set((text.match(/\bhttps?:\/\/[^\s/]+/gi) || []).map((u) => u.replace(/^https?:\/\//i, '').toLowerCase()))].filter((h) => !r.signals.domains.some((d) => d.host === h)),
  ).slice(0, 5);
  const fallbackTodo = r.risk === 'low' ? ['If anything still feels off, contact the sender through a number or address you already know.']
    : ['Do not reply, click links, pay, or share any code.', 'Contact the company or person using a number you already have, not one in the message.', 'Block and report the sender.'];
  const todo = r.whatToDo.length ? r.whatToDo : fallbackTodo;
  $('#result').className = `result ${r.risk}`;
  $('#result').lang = $('#lang').value; $('#result').dir = $('#lang').value === 'ar' ? 'rtl' : 'ltr';
  $('#result').innerHTML = `
    <div class="stamp"><span class="icon" aria-hidden="true">${k.icon}</span><div><h2>${ui(['high', 'medium', 'low'].indexOf(r.risk), k.title)}</h2>${r.scamType && !/^(none|unknown)$/i.test(r.scamType) ? `<p>${esc(r.scamType)}</p>` : ''}</div></div>
    ${r.explanation ? `<p class="why">${esc(r.explanation)}</p>` : ''}
    ${r.raisedByChecks ? '<p class="note">The AI was less worried, but the instant checks found a hard warning sign, so the warning stays.</p>' : ''}
    <h3>${ui(3, 'What to do')}</h3><ol class="todo">${todo.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    ${r.redFlags.length ? `<h3>${ui(4, 'Why')}</h3><ul class="flags">${r.redFlags.map((f) => `<li>${esc(f.flag)}${f.quote ? `<q>${esc(f.quote)}</q>` : ''}</li>`).join('')}</ul>` : ''}
    ${hosts.length ? `<h3>Links in this message</h3><ul class="hosts">${hosts.map((h) => `<li><code>${esc(h)}</code><span class="count" data-host="${esc(h)}"></span><button type="button" data-report="${esc(h)}">Report as scam</button></li>`).join('')}</ul>` : ''}
    ${r.image ? `<details class="msg"><summary>Show the screenshot</summary><img class="shot" src="${shotURL}" alt="Checked screenshot"></details>` : `<details class="msg"><summary>Show the message with warning signs highlighted</summary><blockquote>${highlight(text, quotes)}</blockquote></details>`}
    ${askBox(r)}
    ${receipt(r)}`;
  for (const h of hosts) updateCount(h);
  $('#result').scrollIntoView?.({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
async function updateCount(host, n) {
  const el = document.querySelector(`.count[data-host="${CSS.escape(host)}"]`);
  if (!el) return;
  const c = n ?? (await reportCount(host));
  el.textContent = c == null ? '' : c === 0 ? 'no community reports yet' : `reported by ${c} ${c === 1 ? 'person' : 'people'}`;
  el.classList.toggle('hot', c >= cfg().communityThreshold);
}

// ---- history (verdicts only, never the message) ----
const HKEY = 'second-look.history';
const loadH = () => { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch { return []; } };
function addHistory(r) {
  const h = [{ at: Date.now(), risk: r.risk, type: r.scamType, source: r.source }, ...loadH()].slice(0, 6);
  try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch { /* ignore */ }
  drawHistory();
}
function drawHistory() {
  const h = loadH();
  if (!h.length) return;
  $('#history').className = 'history';
  $('#history').innerHTML = `<h2>Recent checks <small>(kept on this device, without the message)</small></h2><ul class="hist">${h.map((x) => `<li>${RISK[x.risk].icon} <span>${esc(/^(none|unknown)$/i.test(x.type || '') ? x.risk + ' risk' : x.type)}</span><span>${x.source === 'on_device' ? '🔒' : x.source === 'in_cloud' ? '☁' : '🧩'}</span><time>${new Date(x.at).toLocaleDateString()}</time></li>`).join('')}</ul>`;
}

// ---- events ----
function showErr(m) { $('#err').textContent = m || ''; }
document.addEventListener('click', async (e) => {
  const ex = e.target.closest('[data-ex]');
  if (ex) { $('#msg').value = EXAMPLES[ex.dataset.ex]; $('#msg').focus(); showErr(''); return; }
  const rep = e.target.closest('[data-report]');
  if (rep) {
    rep.disabled = true; rep.textContent = 'Sending…';
    try { const n = await reportDomain(rep.dataset.report); rep.textContent = 'Reported ✓'; updateCount(rep.dataset.report, n); }
    catch (err) { rep.disabled = false; rep.textContent = 'Report as scam'; showErr('Could not send the report: ' + err.message); }
  }
});
let mode = 'text', shotFile = null, shotURL = '', lastText = '', lastVerdict = null;
async function run() {
  const privateOnly = $('#private').checked, lang = $('#lang').value;
  if (mode === 'shot') {
    if (!shotFile) { showErr('Choose or paste a screenshot first.'); return; }
    showErr(''); const b = $('#go'); b.disabled = true; b.textContent = 'Checking…';
    try {
      const r = await checkImage(shotFile, { privateOnly, cloudConsent: $('#agree').checked, lang });
      if (r.privateBlocked) { showErr('Private mode is on and this browser can’t read images on-device. Paste the text instead.'); return; }
      if (r.needsConsent) { $('#consent').hidden = false; showErr('Tick the box to send this screenshot to the cloud, or paste the text instead (text is redacted automatically).'); return; }
      lastText = ''; lastVerdict = r; await render('', r); addHistory(r);
    } catch (err) { showErr(err.message); }
    finally { b.disabled = false; b.textContent = 'Check it'; }
    return;
  }
  const text = $('#msg').value.trim();
  if (text.length < 8) { showErr('Paste a message first, or try one of the examples.'); $('#msg').focus(); return; }
  showErr(''); const b = $('#go'); b.disabled = true; b.textContent = 'Checking…';
  showLoading(privateOnly);
  try { const r = await check(text, { privateOnly, lang }); lastText = text; lastVerdict = r; await render(text, r); addHistory(r); }
  catch (err) { $('#result').className = 'result'; $('#result').innerHTML = `<div class="placeholder"><p><b>Something went wrong.</b></p><p>${esc(err.message)}</p><p>Your message was not saved. Try again in a moment.</p></div>`; }
  finally { b.disabled = false; b.textContent = 'Check it'; }
}
$('#go').addEventListener('click', run);
$('#msg').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); });
$('#private').addEventListener('change', (e) => { try { localStorage.setItem('second-look.private', e.target.checked ? '1' : ''); } catch { /* ignore */ } });
try { $('#private').checked = localStorage.getItem('second-look.private') === '1'; } catch { /* ignore */ }

// Text shared into the page (from the Chrome extension) arrives in the URL fragment, which is never sent to a server.
const shared = new URLSearchParams(location.hash.slice(1)).get('text');
if (shared) { $('#msg').value = shared.slice(0, 20000); history.replaceState(null, '', location.pathname); }

// ---- answer language ----
const langSel = $('#lang');
langSel.innerHTML = Object.entries(ANSWER_LANGUAGES).map(([k, v]) => `<option value="${k}">${v}${ON_DEVICE_LANGS.includes(k) ? '' : ' (cloud)'}</option>`).join('');
try { langSel.value = localStorage.getItem('second-look.lang') || 'en'; } catch { /* ignore */ }
langSel.addEventListener('change', () => { try { localStorage.setItem('second-look.lang', langSel.value); } catch { /* ignore */ } });

// ---- tabs: text / screenshot ----
function setMode(m) {
  mode = m;
  $('#tab-text').setAttribute('aria-selected', m === 'text'); $('#tab-shot').setAttribute('aria-selected', m === 'shot');
  $('#pane-text').hidden = m !== 'text'; $('#pane-shot').hidden = m !== 'shot'; $('#examples').hidden = m !== 'text';
  showErr('');
}
$('#tab-text').addEventListener('click', () => setMode('text'));
$('#tab-shot').addEventListener('click', () => setMode('shot'));
async function takeFile(f) {
  if (!f || !/^image\//.test(f.type)) return showErr('That isn’t an image. Use a PNG, JPEG or WebP screenshot.');
  shotFile = f; if (shotURL) URL.revokeObjectURL(shotURL); shotURL = URL.createObjectURL(f);
  $('#preview').src = shotURL; $('#preview').hidden = false; $('.drop-empty').hidden = true; setMode('shot');
  const avail = await onDeviceImageAvailability();
  $('#consent').hidden = avail === 'available' || $('#private').checked; $('#agree').checked = false;
}
$('#file').addEventListener('change', (e) => takeFile(e.target.files[0]));
const drop = $('#drop');
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => takeFile(e.dataTransfer.files[0]));
document.addEventListener('paste', (e) => { const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); takeFile(f); } });

// ---- follow-up questions ----
async function ask(q) {
  const out = $('#answer'); if (!out || !lastVerdict) return;
  out.innerHTML = '<p class="answer">Thinking…</p>';
  try {
    const a = await followUp(q, { text: lastText, verdict: lastVerdict, privateOnly: $('#private').checked, lang: $('#lang').value });
    out.innerHTML = `<p class="answer"><b>${esc(q)}</b>\n${esc(a.answer).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}<span class="by">${a.source === 'on_device' ? '🔒 Answered on this device' : a.source === 'in_cloud' ? '☁ Answered in the cloud (message redacted)' : '🧩 No AI available'}</span></p>`;
  } catch (err) { out.innerHTML = `<p class="answer">${esc(err.message)}</p>`; }
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) ask(b.dataset.q); });
document.addEventListener('submit', (e) => { if (e.target.id === 'askf') { e.preventDefault(); const q = $('#q').value.trim(); if (q) ask(q); } });

refreshEngine(); configReady.then(refreshEngine); drawHistory();
