"use strict";

function toggleCurrentTab(tab) {
  if (!tab || !tab.id) return;
  browser.tabs.sendMessage(tab.id, { type: "AO3MAIL_TOGGLE" }).catch(() => {});
}

browser.browserAction.onClicked.addListener(toggleCurrentTab);
browser.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-mail-workspace") return;
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  toggleCurrentTab(tabs[0]);
});
