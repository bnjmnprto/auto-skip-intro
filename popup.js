const defaults = {
  enabled: true,
  skipIntro: true,
  skipRecap: true,
  skipCredits: false,
  debugMode: false,
  cooldownMs: 2500,
  scanIntervalMs: 1200
};

const ids = ["enabled","skipIntro","skipRecap","skipCredits","debugMode"];
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
      notifyTabSettingsChanged();
    });
  }

  document.getElementById("openOptions").onclick = () => chrome.runtime.openOptionsPage();
  document.getElementById("testScan").onclick = () => sendToPage("ASI_TEST_SCAN");
  document.getElementById("forceScan").onclick = () => sendToPage("ASI_FORCE_SKIP");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function notifyTabSettingsChanged() {
  try {
    const tab = await getActiveTab();
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "ASI_SETTINGS_CHANGED" });
  } catch (_) {}
}

async function sendToPage(type) {
  statusEl.textContent = "Scanning...";
  try {
    const tab = await getActiveTab();
    const response = await chrome.tabs.sendMessage(tab.id, { type });
    statusEl.textContent = response?.message || "No response. Refresh Netflix and try again.";
  } catch (err) {
    statusEl.textContent = "Could not reach page. Refresh Netflix after installing v0.9.";
  }
}
