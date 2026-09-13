// Auto Skip Intro popup controller

const defaults = {
  enabled: true,
  skipIntro: true,
  skipRecap: true,
  skipCredits: false,
  debugMode: false,
  cooldownMs: 2500,
  scanIntervalMs: 1200
};

const ids = ["enabled", "skipIntro", "skipRecap", "skipCredits", "debugMode"];
const statusEl = document.getElementById("status");

init();

async function init() {
  const settings = await chrome.storage.sync.get(defaults);

  for (const id of ids) {
    const el = document.getElementById(id);
    el.checked = Boolean(settings[id]);

    el.addEventListener("change", async () => {
      await chrome.storage.sync.set({ [id]: el.checked });
      statusEl.textContent = "Saved. Refresh Netflix if needed.";
      notifyActivePage();
    });
  }

  document.getElementById("openOptions").onclick = () => chrome.runtime.openOptionsPage();
  document.getElementById("testScan").onclick = () => sendAction("ASI_TEST_SCAN");
  document.getElementById("forceScan").onclick = () => sendAction("ASI_FORCE_SKIP");
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function notifyActivePage() {
  try {
    const tab = await getActiveTab();
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: "ASI_SETTINGS_CHANGED" });
    }
  } catch (_) {
    // The current tab may not host the extension content script.
  }
}

async function sendAction(type) {
  statusEl.textContent = "Scanning...";

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      statusEl.textContent = "No active tab found.";
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type });
    statusEl.textContent = response?.message || "No response. Refresh the streaming page and try again.";
  } catch (_) {
    statusEl.textContent = "Could not reach the page. Refresh the streaming page and try again.";
  }
}
