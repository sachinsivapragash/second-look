export const APP_URL = 'https://sachinsivapragash.github.io/second-look/';
// The text travels in the URL fragment (#...), which browsers never send to a server.
export const openCheck = (text) => chrome.tabs.create({ url: `${APP_URL}#text=${encodeURIComponent(String(text).slice(0, 6000))}` });
