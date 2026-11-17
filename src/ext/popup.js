import { scanSignals } from '../core/signals.js';
import { openCheck } from './shared.js';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LABEL = { high: ['⛔', 'Very likely a scam'], medium: ['⚠️', 'Looks suspicious'], low: ['✅', 'No obvious warning signs'] };
let text = '';
async function grab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => (getSelection().toString() || document.body.innerText).slice(0, 6000) });
    return result || '';
  } catch { return ''; }
}
async function run() {
  text = ($('#txt').value || '').trim() || await grab();
  $('#txt').value = text.slice(0, 6000);
  const s = scanSignals(text);
  const [icon, title] = LABEL[s.floor];
  const flags = s.hits.map((h) => h.label).concat(s.domains.flatMap((d) => d.flags.map((f) => `${d.host}: ${f}`)));
  $('#out').className = 'out ' + s.floor;
  $('#out').innerHTML = `<b>${icon} ${title}</b>${flags.length ? `<ul>${flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p>The instant checks found nothing. The AI check looks deeper.</p>'}<p class="small">Instant checks ran in this popup. Nothing was sent.</p>`;
}
$('#scan').onclick = run;
$('#full').onclick = () => { const t = ($('#txt').value || text).trim(); if (t) openCheck(t); };
run();
