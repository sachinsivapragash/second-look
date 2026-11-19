// Records a captioned demo of Second Look on the live site (dev tool).
//   node scripts/record-demo.mjs [appUrl] [out.mp4]
// Reuses playwright + ffmpeg-static from the sibling duepilot project.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const req = createRequire(path.resolve('../duepilot/package.json'));
const { chromium } = req('playwright');
const FF = req('ffmpeg-static');
const APP = process.argv[2] || 'https://sachinsivapragash.github.io/second-look/';
const OUT = path.resolve('video');
const MP4 = process.argv[3] || path.join(OUT, 'second-look-demo.mp4');
const GUARD = fs.readFileSync(path.resolve('extension/dist/guard.js'), 'utf8').replace(/\/\/# sourceMappingURL.*/, '');
// Optional App Check debug token (kept in the git-ignored video/ folder) so the headless recorder passes App Check.
const TOKEN = fs.existsSync(path.join(OUT, '.debugtoken')) ? fs.readFileSync(path.join(OUT, '.debugtoken'), 'utf8').trim() : '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CAP_CSS = `#cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;max-width:1100px;width:max-content;
  background:rgba(20,22,26,.92);color:#fff;font:600 24px/1.35 system-ui,sans-serif;padding:14px 26px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.35);text-align:center}
  #cap small{display:block;font:400 17px/1.4 system-ui;opacity:.85;margin-top:4px}`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
  await ctx.route('https://web.whatsapp.com/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset=utf-8>
    <body style="margin:0;font:16px system-ui;background:#efeae2"><div style="background:#008069;color:#fff;padding:16px 24px;font-weight:600">Demo chat · Unknown number</div>
    <div id=c style="padding:24px 40px;display:flex;flex-direction:column;gap:14px;max-width:700px">
    <div class="message-in" style="background:#fff;padding:10px 14px;border-radius:10px;width:fit-content;max-width:560px"><span class="selectable-text copyable-text">See you at dinner on Sunday! 🍲</span></div></div></body>` }));
  if (TOKEN) await ctx.addInitScript((t) => { self.FIREBASE_APPCHECK_DEBUG_TOKEN = t; }, TOKEN);
  const page = await ctx.newPage();
  const T0 = Date.now(); const cuts = [];
  const offCamera = async (ms) => { const a = (Date.now() - T0) / 1000; await sleep(ms); cuts.push([a + 0.3, (Date.now() - T0) / 1000 - 0.3]); };
  page.on('pageerror', (e) => console.log('page error:', e.message));
  const cap = async (title, sub = '') => {
    await page.evaluate(([css, t, s]) => {
      if (!document.getElementById('capcss')) { const st = document.createElement('style'); st.id = 'capcss'; st.textContent = css; document.head.append(st); }
      let c = document.getElementById('cap'); if (!c) { c = document.createElement('div'); c.id = 'cap'; document.body.append(c); }
      c.innerHTML = t + (s ? `<small>${s}</small>` : '');
    }, [CAP_CSS, title, sub]);
  };
  const log = [];
  const go = async (name) => {
    for (let attempt = 1; ; attempt++) {
      await page.evaluate(() => document.querySelector('#result .stamp')?.remove());
      await page.click('#go');
      await page.waitForSelector('#result .stamp', { timeout: 70000 });
      const offline = await page.evaluate(() => /could not be reached/.test(document.querySelector('.receipt')?.innerText || ''));
      if (!offline || name === 'private' || attempt === 4) break;
      console.log(name, 'rate-limited, retrying off camera (attempt', attempt, ')');
      await offCamera(40000);
    }
    await waitResult(name);
  };
  const waitResult = async (name) => {
    await page.waitForSelector('#result .stamp', { timeout: 60000 }); await sleep(400);
    const info = await page.evaluate(() => ({ stamp: document.querySelector('.stamp h2')?.innerText, lang: document.querySelector('#result').lang, why: (document.querySelector('.why')?.innerText || '').slice(0, 70), receipt: document.querySelector('.receipt .head + p, .receipt p')?.innerText.slice(0, 70) }));
    log.push({ name, ...info }); console.log(name, JSON.stringify(info));
  };
  const scrollResult = async (to) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), to);

  // 1. Intro
  await page.goto(APP); await page.waitForLoadState('networkidle'); await page.selectOption('#lang', 'en');
  await cap('Second Look: a private scam checker', 'Firebase AI Logic hybrid inference: Gemini Nano on your device, or a redacted message to Gemini in the cloud');
  await sleep(6000);

  // 2. Parcel example, cloud with redaction
  await cap('Paste a message that feels off', 'Example: a parcel “redelivery fee” text');
  await page.click('[data-ex=parcel]'); await sleep(2500);
  await cap('Instant checks run on the device first…', 'This browser has no on-device Gemini Nano, so personal details are removed before the cloud sees anything');
  await go('parcel'); await sleep(4500);
  await cap('A straight answer, what to do, and why', 'The AI can raise a warning but never lower it below the instant checks');
  await page.evaluate(() => document.querySelector('#result').scrollTo?.(0, 0)); await scrollResult(250); await sleep(5000);

  // 3. Privacy receipt
  await page.evaluate(() => { const r = document.querySelector('.receipt'); r.scrollIntoView({ behavior: 'smooth', block: 'center' }); r.querySelector('details')?.setAttribute('open', ''); });
  await cap('The privacy receipt shows exactly what left the device', 'Phone number and link path were removed on the device before sending');
  await sleep(7000);

  // 4. Ask about it
  await page.evaluate(() => document.querySelector('.ask').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await cap('Ask about it', '“I already clicked the link. What now?”');
  await sleep(1500); await page.click('[data-q]');
  await page.waitForFunction(() => { const a = document.querySelector('#answer'); return a && !/Thinking/.test(a.innerText); }, null, { timeout: 60000 });
  console.log('followup', JSON.stringify((await page.$eval('#answer', (e) => e.innerText)).slice(0, 120)));
  await sleep(6500);

  await offCamera(20000);
  // 5. Hindi
  await scrollResult(0); await sleep(800);
  await page.selectOption('#lang', 'hi');
  await cap('Answers in 12 languages', 'Hindi, Tamil, Telugu, Bengali, Marathi, Arabic, Swahili and more');
  await page.click('[data-ex=bank]'); await sleep(1500); await go('hindi'); await sleep(7000);
  await page.selectOption('#lang', 'en');

  await offCamera(20000);
  // 6. Screenshot with consent
  await scrollResult(0);
  await cap('Screenshots work too', 'WhatsApp chats, SMS, fake receipts');
  await page.click('#tab-shot'); await sleep(1200);
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 620; c.height = 280; const g = c.getContext('2d');
    g.fillStyle = '#e7ffdb'; g.fillRect(0, 0, 620, 280); g.fillStyle = '#111'; g.font = '24px sans-serif';
    ['+44 7700 900123', 'Congratulations! You won a £1000', 'gift card. Claim within 1 hour:', 'tesco-rewards-claim.xyz/win', 'Just pay the £2.99 delivery fee.'].forEach((t, i) => g.fillText(t, 22, 44 + i * 48));
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'shot.png', { type: 'image/png' }));
    const inp = document.querySelector('#file'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  });
  await sleep(2500);
  await cap('Pictures can’t be redacted, so they go to the cloud only with consent');
  await page.check('#agree'); await sleep(2500);
  await go('screenshot'); await sleep(6500);

  // 7. Private only
  await page.click('#tab-text'); await page.check('#private', { force: true });
  await cap('Private only: never uses the cloud', 'Instant checks still catch the classic tricks, even offline');
  await page.click('[data-ex=mum]'); await sleep(1200); await go('private'); await sleep(3000);
  await page.evaluate(() => document.querySelector('.receipt').scrollIntoView({ behavior: 'smooth', block: 'center' })); await sleep(4500);

  // 8. Extension live protection (demo chat page with the extension's content script)
  await page.goto('https://web.whatsapp.com/');
  await page.addScriptTag({ content: 'window.chrome = window.chrome || {}; chrome.runtime = { sendMessage(){} };' + GUARD });
  await cap('The Chrome extension warns you inside WhatsApp Web and Gmail', 'Checks run locally in the tab; nothing is sent unless you ask');
  await sleep(2500);
  await page.evaluate(() => {
    const d = document.createElement('div'); d.className = 'message-in';
    d.style.cssText = 'background:#fff;padding:10px 14px;border-radius:10px;width:fit-content;max-width:560px';
    d.innerHTML = '<span class="selectable-text copyable-text">Hi Mum, this is my new number, I lost my phone. Can you urgently send £640 today? Please don\'t call, I can\'t talk.</span>';
    document.getElementById('c').append(d);
  });
  await sleep(6000);

  // 9. Outro
  await cap('Second Look: private by design, open source', 'sachinsivapragash.github.io/second-look · github.com/sachinsivapragash/second-look');
  await sleep(5000);

  const video = page.video(); await ctx.close(); await browser.close();
  const webm = await video.path();
  const keep = cuts.length ? ['-vf', `select='not(${cuts.map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`).join('+')})',setpts=N/FRAME_RATE/TB`] : [];
  console.log('cuts', JSON.stringify(cuts));
  execFileSync(FF, ['-y', '-i', webm, ...keep, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', MP4], { stdio: 'ignore' });
  fs.rmSync(webm);
  console.log('saved', MP4);
})();
