// Deterministic red-flag checks that run instantly on the device, with or without any AI model.
// They give a floor for the verdict: the model may add context, but it can never talk away a hard
// red flag such as "send me the code we just texted you".

const RULES = [
  { id: 'asks_code', weight: 5, label: 'Asks for a one-time code, PIN or password',
    re: /\b(send|share|give|tell|forward|read)\b[^.\n]{0,40}\b(code|otp|pin|password|passcode|verification)\b|\b(code|otp)\b[^.\n]{0,30}\b(send|share|reply)\b|\bcommuniquez?[^.\n]{0,30}\bcode\b/i },
  { id: 'gift_cards', weight: 5, label: 'Wants payment in gift cards',
    re: /\b(gift ?cards?|itunes|google play|steam|amazon) (card|voucher|code)s?\b|\bcartes? cadeaux?\b/i },
  { id: 'crypto_pay', weight: 4, label: 'Wants payment in crypto or a wire to a stranger',
    re: /\b(pay|send|transfer|deposit)\b[^.\n]{0,40}\b(bitcoin|btc|usdt|crypto|wallet address|western union|moneygram)\b/i },
  { id: 'urgency', weight: 2, label: 'Pressure to act right now',
    re: /\b(urgent(ly)?|immediately|within (\d+|24|48) (hours|minutes)|act now|final (notice|warning)|last chance|(be )?(suspended|locked|closed|blocked)|expires? (today|in \d+ (minutes?|hours?)))\b|\bimmédiatement\b|\bdernier avertissement\b/i },
  { id: 'prize', weight: 3, label: 'Prize, lottery or inheritance you never asked for',
    re: /\b(you('ve| have)? won|winner|lottery|jackpot|inheritance|claim your (prize|reward)|unclaimed (funds|package))\b|\bvous avez gagné\b/i },
  { id: 'job_fee', weight: 3, label: 'Job or task that pays well but needs a fee first',
    re: /\b(work from home|part[- ]time job|earn \$?\d+[^.\n]{0,20}(per|a) (day|hour))\b|\b(registration|processing|training) fee\b/i },
  { id: 'parcel', weight: 2, label: 'Parcel "held" for a small fee',
    re: /\b(parcel|package|delivery|shipment|colis)\b[^.\n]{0,60}\b(fee|pay|customs|redeliver|held|suspended)\b/i },
  { id: 'family', weight: 3, label: '"Hi Mum/Dad, new number" style request',
    re: /\b(hi|hey|hello) (mum|mom|dad|mama|papa)\b[^.\n]{0,60}\b(new (number|phone)|lost my phone)\b/i },
  { id: 'remote_access', weight: 4, label: 'Asks you to install remote-access software',
    re: /\b(anydesk|teamviewer|quick ?support|rustdesk|ultraviewer|remote (access|desktop))\b/i },
  { id: 'secrecy', weight: 2, label: 'Asks you to keep it secret',
    re: /\b(don'?t|do not) (tell|inform) (anyone|your (bank|family))\b|\bkeep (this|it) (secret|confidential|between us)\b/i },
];

const SHORTENERS = /^(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly|rb\.gy|shorturl\.at|ow\.ly|tiny\.cc)$/i;
const BRANDS = ['paypal', 'amazon', 'apple', 'microsoft', 'google', 'netflix', 'facebook', 'instagram', 'whatsapp', 'dhl', 'fedex', 'ups', 'usps', 'hsbc', 'chase', 'wellsfargo', 'sbi', 'hdfc', 'icici', 'paytm', 'binance', 'coinbase'];
const LEET = { 0: 'o', 1: 'l', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' };

export function hostsIn(text) {
  const hosts = new Set();
  for (const m of String(text).matchAll(/\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?=[\/\s:?#)"'<>]|$)/gi)) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

// Lookalike domains: punycode, digit swaps (paypa1), or a brand name in a domain the brand does not own.
export function domainFlags(host) {
  const flags = [];
  const labels = host.split('.');
  const registrable = labels.slice(-2).join('.');
  if (host.split('.').some((l) => l.startsWith('xn--'))) flags.push('Uses look-alike characters (punycode)');
  if (SHORTENERS.test(registrable)) flags.push('Hides the real address behind a link shortener');
  const flat = host.replace(/[0-9]/g, (d) => LEET[d] || d).replace(/[-.]/g, '');
  for (const b of BRANDS) {
    const owns = registrable.startsWith(b + '.') || registrable === b;
    if (!owns && flat.includes(b)) { flags.push(`Mentions "${b}" but is not ${b}'s site`); break; }
  }
  if (/\.(zip|mov|top|xyz|click|country|gq|tk|ml|cf)$/i.test(host)) flags.push('Uses a domain ending often seen in scams');
  return flags;
}

export function scanSignals(text) {
  const s = String(text || '');
  const hits = RULES.filter((r) => r.re.test(s)).map((r) => ({ id: r.id, label: r.label, weight: r.weight }));
  const domains = hostsIn(s).map((h) => ({ host: h, flags: domainFlags(h) })).filter((d) => d.flags.length);
  const score = hits.reduce((a, h) => a + h.weight, 0) + domains.reduce((a, d) => a + 2 * d.flags.length, 0);
  const floor = score >= 5 ? 'high' : score >= 2 ? 'medium' : 'low';
  return { hits, domains, score, floor };
}
