import { openCheck } from './shared.js';
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'second-look', title: 'Check with Second Look', contexts: ['selection'] });
});
chrome.contextMenus.onClicked.addListener((info) => { if (info.menuItemId === 'second-look' && info.selectionText) openCheck(info.selectionText); });
chrome.runtime.onMessage.addListener((m) => { if (m?.type === 'check' && m.text) openCheck(m.text); });
