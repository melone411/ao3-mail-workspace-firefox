"use strict";

function send(tab, type) {
  if (!tab || !tab.id) return;
  browser.tabs.sendMessage(tab.id, { type }).catch(() => {});
}

async function currentTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

browser.browserAction.onClicked.addListener((tab) => send(tab, "OWA_TOGGLE"));

browser.commands.onCommand.addListener(async (command) => {
  const tab = await currentTab();
  if (command === "toggle-mail-workspace") send(tab, "OWA_TOGGLE");
  if (command === "toggle-lock-screen") send(tab, "OWA_VEIL");
  if (command === "cycle-skin") send(tab, "OWA_SKIN");
});
