// Live protection for Gmail and WhatsApp Web.
// Runs the instant checks on messages you open, entirely inside this tab. Nothing is sent anywhere
// unless you press "Full check", which opens Second Look with the text in the URL fragment.
import { scanSignals } from '../core/signals.js';

const SITES = {
  'mail.google.com': '.a3s.aiL, .a3s',                                      // opened email bodies
  'web.whatsapp.com': '.message-in .copyable-text, .message-in span.selectable-text', // incoming chat bubbles
};
const selector = SITES[location.hostname];
const seen = new WeakSet();

function banner(el, sig) {
  const high = sig.floor === 'high';
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText = `all:initial;display:block;margin:6px 0;padding:10px 12px;border-radius:10px;font:14px/1.45 system-ui,sans-serif;
    background:${high ? '#fdecea' : '#fff4dc'};color:${high ? '#b42318' : '#9a5b00'};border:1.5px solid currentColor;max-width:560px`;
  const title = document.createElement('b');
  title.textContent = high ? '🛡️ Second Look: this looks like a scam' : '🛡️ Second Look: be careful with this one';
  const list = document.createElement('div');
  list.style.cssText = 'color:#1f2328;margin:4px 0 8px';
  list.textContent = [...sig.hits.map((h) => h.label), ...sig.domains.map((d) => `Suspicious link: ${d.host}`)].slice(0, 3).join(' · ');
  const btn = document.createElement('button');
  btn.textContent = 'Full check';
  btn.style.cssText = 'all:initial;cursor:pointer;font:600 13px system-ui,sans-serif;background:#0f6e6a;color:#fff;padding:5px 12px;border-radius:8px';
  btn.addEventListener('click', (e) => { e.stopPropagation(); chrome.runtime.sendMessage({ type: 'check', text: el.innerText }); });
  const close = document.createElement('button');
  close.textContent = 'Dismiss';
  close.style.cssText = 'all:initial;cursor:pointer;font:13px system-ui,sans-serif;color:#5d5a54;margin-left:12px';
  close.addEventListener('click', (e) => { e.stopPropagation(); box.remove(); });
  box.append(title, list, btn, close);
  return box;
}

function scan() {
  if (!selector) return;
  for (const el of document.querySelectorAll(selector)) {
    if (seen.has(el) || el.closest('[data-second-look]')) continue;
    seen.add(el);
    const text = el.innerText || '';
    if (text.length < 12) continue;
    const sig = scanSignals(text);
    if (sig.floor === 'low') continue;
    const host = document.createElement('div');
    host.dataset.secondLook = '1';
    host.appendChild(banner(el, sig));
    el.parentElement?.insertBefore(host, el);
  }
}

let t = 0;
new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 400); }).observe(document.body, { childList: true, subtree: true });
scan();
