(() => {
  const DEFAULTS = {
    enabled: true,
    skipIntro: true,
    skipRecap: true,
    skipCredits: false,
    debugMode: false,
    cooldownMs: 2500,
    scanIntervalMs: 1200
  };

  const INTERNAL_ATTR = "data-auto-skip-intro-internal";
  const STATE = {
    settings: { ...DEFAULTS },
    lastClickAt: 0,
    lastMessage: "Loaded.",
    lastCandidate: "None yet.",
    timer: null
  };

  const BLOCKLIST = [
    "next episode", "play next episode", "next up", "episodes", "more episodes",
    "play", "pause", "settings", "audio", "subtitles", "back", "close",
    "volume", "fullscreen", "rewind", "forward", "trailer", "preview",
    "browse", "my list", "like", "dislike"
  ];

  const SELECTORS = [
    "button",
    "[role='button']",
    "[aria-label*='Skip' i]",
    "[data-uia*='skip' i]",
    "[class*='skip' i]",
    "[id*='skip' i]"
  ].join(",");

  init();

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "ASI_SETTINGS_CHANGED") {
      loadSettings().then(() => {
        restartTimer();
        sendResponse({ ok: true });
      });
      return true;
    }

    if (msg?.type === "ASI_TEST_SCAN") {
      const result = scanAndMaybeClick({ force: false, manual: true });
      sendResponse({ ok: true, message: makeResponseMessage(result) });
      return true;
    }

    if (msg?.type === "ASI_FORCE_SKIP") {
      const result = scanAndMaybeClick({ force: true, manual: true });
      sendResponse({ ok: true, message: makeResponseMessage(result) });
      return true;
    }
  });

  async function init() {
    await loadSettings();
    restartTimer();
    setTimeout(() => scanAndMaybeClick({ force: false, manual: false }), 1500);
  }

  async function loadSettings() {
    try {
      STATE.settings = await chrome.storage.sync.get(DEFAULTS);
    } catch (_) {
      STATE.settings = { ...DEFAULTS };
    }
    renderDebug();
  }

  function restartTimer() {
    if (STATE.timer) clearInterval(STATE.timer);

    const interval = Math.max(800, Number(STATE.settings.scanIntervalMs || 1200));
    STATE.timer = setInterval(() => {
      scanAndMaybeClick({ force: false, manual: false });
    }, interval);
  }

  function scanAndMaybeClick({ force, manual }) {
    if (!STATE.settings.enabled && !force) {
      updateStatus("Disabled.");
      return { clicked: false, reason: "Disabled." };
    }

    const now = Date.now();
    if (!manual && now - STATE.lastClickAt < Number(STATE.settings.cooldownMs || 2500)) {
      return { clicked: false, reason: "Cooldown." };
    }

    const candidate = findCandidate({ force });

    if (!candidate) {
      updateStatus("Skip button not found.");
      return { clicked: false, reason: "Skip button not found." };
    }

    STATE.lastCandidate = describe(candidate.element, candidate.reason);

    if (!isVisible(candidate.element)) {
      updateStatus("Candidate found but not visible.");
      return { clicked: false, reason: "Candidate found but not visible." };
    }

    updateStatus("Clicking: " + STATE.lastCandidate);
    clickControl(candidate.element);
    STATE.lastClickAt = Date.now();
    toast("Skipped intro");
    return { clicked: true, reason: "Clicked.", candidate: STATE.lastCandidate };
  }

  function findCandidate({ force }) {
    const elements = Array.from(document.querySelectorAll(SELECTORS))
      .filter(el => !isInternal(el))
      .slice(0, 400);

    const candidates = [];

    for (const el of elements) {
      const sig = signature(el);
      if (!sig) continue;
      if (blocked(sig)) continue;

      const matchType = allowedMatch(sig, force);
      if (!matchType) continue;

      const clickable = nearestClickable(el);
      if (!clickable || isInternal(clickable)) continue;
      const clickSig = signature(clickable);
      if (blocked(clickSig)) continue;
      if (!isVisible(clickable)) continue;
      if (!reasonableSize(clickable)) continue;

      candidates.push({ element: clickable, reason: matchType });
    }

    if (!candidates.length) {
      const maybeButtons = Array.from(document.querySelectorAll("button,[role='button'],div,span"))
        .filter(el => !isInternal(el))
        .slice(-500);

      for (const el of maybeButtons) {
        if (!isVisible(el)) continue;
        if (!reasonableSize(el)) continue;
        const text = norm(el.innerText || el.textContent || "");
        if (!text || text.length > 60) continue;
        if (blocked(text)) continue;
        const matchType = allowedMatch(text, force);
        if (!matchType) continue;

        const clickable = nearestClickable(el) || el;
        if (!clickable || isInternal(clickable)) continue;
        if (blocked(signature(clickable))) continue;
        if (!isVisible(clickable)) continue;
        if (!reasonableSize(clickable)) continue;

        candidates.push({ element: clickable, reason: matchType + " visible text" });
      }
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) => score(b) - score(a));
    return candidates[0];
  }

  function allowedMatch(sig, force) {
    const s = norm(sig);

    if ((STATE.settings.skipIntro || force) && (
      s.includes("skip intro") ||
      s.includes("skip-intro") ||
      s.includes("player-skip-intro") ||
      s.includes("skip opening") ||
      s.includes("skip title sequence")
    )) return "intro";

    if ((STATE.settings.skipRecap || force) && (
      s.includes("skip recap") ||
      s.includes("skip-recap") ||
      s.includes("player-skip-recap")
    )) return "recap";

    if ((STATE.settings.skipCredits || force) && (
      s.includes("skip credits") ||
      s.includes("skip-credits") ||
      s.includes("player-skip-credits")
    )) return "credits";

    return null;
  }

  function nearestClickable(el) {
    if (!el) return null;

    let node = el;
    for (let i = 0; node && i < 6; i++, node = node.parentElement) {
      if (isInternal(node)) return null;
      if (isClickable(node)) return node;
    }

    return isClickable(el) ? el : null;
  }

  function isClickable(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const tag = el.tagName.toLowerCase();
    const role = norm(el.getAttribute("role"));
    if (tag === "button" || role === "button" || tag === "a") return true;

    try {
      return getComputedStyle(el).cursor === "pointer";
    } catch (_) {
      return false;
    }
  }

  function signature(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE || isInternal(el)) return "";

    const parts = [`tag=${el.tagName.toLowerCase()}`];

    for (const attr of ["aria-label", "data-uia", "data-testid", "title", "id", "class", "role"]) {
      const val = el.getAttribute(attr);
      if (val) parts.push(`${attr}=${val}`);
    }

    const text = (el.innerText || el.textContent || "").trim();
    if (text && text.length <= 80) parts.push(`text=${text}`);

    return norm(parts.join(" "));
  }

  function score(item) {
    const sig = signature(item.element);
    let n = 0;
    if (sig.includes("player-skip-intro")) n += 120;
    if (sig.includes("skip intro")) n += 100;
    if (sig.includes("aria-label")) n += 30;
    if (sig.includes("data-uia")) n += 30;
    if (sig.includes("tag=button")) n += 20;
    const rect = item.element.getBoundingClientRect();
    n -= Math.max(0, rect.width - 260) / 15;
    n -= Math.max(0, rect.height - 70) / 5;
    return n;
  }

  function clickControl(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: window };

    for (const type of ["mouseover", "mousemove", "mousedown", "mouseup", "click"]) {
      try { el.dispatchEvent(new MouseEvent(type, opts)); } catch (_) {}
    }

    try { el.click(); } catch (_) {}
  }

  function isVisible(el) {
    if (!el || !el.isConnected || isInternal(el)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    if (rect.right < 0 || rect.bottom < 0 || rect.left > innerWidth || rect.top > innerHeight) return false;

    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return false;
    return true;
  }

  function reasonableSize(el) {
    const rect = el.getBoundingClientRect();
    return rect.width >= 20 && rect.height >= 10 && rect.width <= 520 && rect.height <= 160;
  }

  function blocked(sig) {
    const s = norm(sig);
    return BLOCKLIST.some(word => s.includes(word));
  }

  function isInternal(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    return el.hasAttribute(INTERNAL_ATTR) || Boolean(el.closest?.(`[${INTERNAL_ATTR}]`));
  }

  function updateStatus(msg) {
    STATE.lastMessage = msg;
    renderDebug();
  }

  function renderDebug() {
    let box = document.querySelector(`[${INTERNAL_ATTR}="debug"]`);

    if (!STATE.settings.debugMode) {
      if (box) box.remove();
      return;
    }

    if (!box) {
      box = document.createElement("div");
      box.setAttribute(INTERNAL_ATTR, "debug");
      box.style.cssText = [
        "position:fixed",
        "right:16px",
        "bottom:16px",
        "z-index:2147483647",
        "max-width:420px",
        "background:rgba(0,0,0,.84)",
        "color:white",
        "font:12px Arial,sans-serif",
        "padding:10px 12px",
        "border-radius:10px",
        "pointer-events:none"
      ].join(";");
      document.documentElement.appendChild(box);
    }

    box.innerHTML = `
      <strong>Auto Skip Intro v1.0</strong><br>
      Status: ${escapeHtml(STATE.lastMessage)}<br>
      Candidate: ${escapeHtml(STATE.lastCandidate)}
    `;
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.setAttribute(INTERNAL_ATTR, "toast");
    el.textContent = msg;
    el.style.cssText = [
      "position:fixed",
      "left:50%",
      "top:18px",
      "transform:translateX(-50%)",
      "z-index:2147483647",
      "background:rgba(0,0,0,.85)",
      "color:white",
      "font:13px Arial,sans-serif",
      "padding:9px 13px",
      "border-radius:999px",
      "pointer-events:none"
    ].join(";");
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  function makeResponseMessage(result) {
    return [
      result.reason || STATE.lastMessage,
      "Candidate: " + STATE.lastCandidate
    ].join("\\n");
  }

  function describe(el, reason) {
    const rect = el.getBoundingClientRect();
    const sig = signature(el);
    return `${reason}: ${Math.round(rect.width)}x${Math.round(rect.height)} ${sig.slice(0, 180)}`;
  }

  function norm(v) {
    return String(v || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
