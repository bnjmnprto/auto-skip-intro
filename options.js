const defaults = {
  enabled: true,
  skipIntro: true,
  skipRecap: true,
  skipCredits: false,
  debugMode: false,
  cooldownMs: 2500,
  scanIntervalMs: 1200
};

const fields = ["enabled","skipIntro","skipRecap","skipCredits","debugMode","cooldownMs","scanIntervalMs"];
const statusEl = document.getElementById("status");

init();

async function init() {
  const settings = await chrome.storage.sync.get(defaults);
  for (const field of fields) {
    const el = document.getElementById(field);
    if (el.type === "checkbox") el.checked = Boolean(settings[field]);
    else el.value = settings[field];

    el.addEventListener("change", async () => {
      const value = el.type === "checkbox" ? el.checked : Number(el.value);
      await chrome.storage.sync.set({ [field]: value });
      statusEl.textContent = "Saved. Refresh streaming page if needed.";
    });
  }
}
