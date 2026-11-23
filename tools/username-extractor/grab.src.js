/*
 * "Grab usernames" bookmarklet: source. build_bookmarklet.py minifies this into the
 * javascript: link on the extractor page.
 *
 * Runs ONLY when you click it, ONLY on the TikTok tab you are looking at.
 * It collects the campaign leaderboard data that page loads (display name,
 * @username, rank, score) and hands it to the extractor tab. It sends nothing
 * to any server, and does not read cookies, passwords or messages.
 */
(function () {
  var TOOL = "https://jolikewe.github.io/talenthaus/tools/username-extractor/";
  var TOOL_ORIGIN = "https://jolikewe.github.io";
  var KEY_RE = /"(handle_name|handleName|unique_id|uniqueId|nickname|display_name)"\s*:/;

  if (!/(^|\.)tiktok\.com$/.test(location.hostname)) {
    alert("Open the TikTok campaign page first, then click this bookmark.");
    return;
  }
  if (window.__thGrab) { window.__thGrab.show(); return; }

  var blocks = [], seen = {};
  function add(text) {
    if (typeof text !== "string" || text.length < 20 || text.length > 8e6) return;
    var t = text.trim();
    if (t[0] !== "{" && t[0] !== "[") return;
    if (!KEY_RE.test(t) || seen[t]) return;
    seen[t] = 1; blocks.push(t); update();
  }

  /* 1. Capture leaderboard responses the page loads from now on (tab clicks, "load more"). */
  var of = window.fetch;
  window.fetch = function () {
    return of.apply(this, arguments).then(function (r) {
      try { r.clone().text().then(add, function () {}); } catch (e) {}
      return r;
    });
  };
  var oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", function () {
      try {
        if (this.responseType === "" || this.responseType === "text") add(this.responseText);
        else if (this.responseType === "json" && this.response) add(JSON.stringify(this.response));
      } catch (e) {}
    });
    return os.apply(this, arguments);
  };

  /* 2. Re-request the data calls the page has already made (same TikTok session). */
  function harvest() {
    var urls = {}, list = performance.getEntriesByType("resource");
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.initiatorType !== "fetch" && e.initiatorType !== "xmlhttprequest") continue;
      try { if (!/(^|\.)tiktok(v)?\.com$|(^|\.)tiktokv\.us$/.test(new URL(e.name).hostname)) continue; } catch (x) { continue; }
      urls[e.name] = 1;
    }
    var keys = Object.keys(urls), n = 0;
    setStatus("Checking " + keys.length + " data requests…");
    return Promise.all(keys.map(function (u) {
      return of(u, { credentials: "include" })
        .then(function (r) { return r.ok ? r.text() : ""; })
        .then(add, function () {})
        .then(function () { n++; });
    }));
  }

  /* 3. Fallback: names visible on the page (profile links) if no data was found. */
  function fromPage() {
    var rows = [], got = {};
    var links = document.querySelectorAll('a[href*="/@"]');
    for (var i = 0; i < links.length; i++) {
      var m = links[i].href.match(/\/@([A-Za-z0-9._]+)/);
      if (!m || got[m[1]]) continue;
      got[m[1]] = 1;
      rows.push({ user: { handle_name: m[1], nickname: (links[i].innerText || "").trim().split("\n")[0] } });
    }
    return rows.length ? JSON.stringify({ source: "page_links", data: { rankings: rows } }) : "";
  }

  /* Panel */
  var box = document.createElement("div");
  box.setAttribute("style", "position:fixed;z-index:2147483647;right:16px;bottom:16px;width:300px;padding:14px 16px;border-radius:14px;background:#14131f;color:#eceaf5;font:13px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5);border:1px solid #2a2840");
  box.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:14px">Grab usernames</b>' +
    '<button data-a="x" style="all:unset;cursor:pointer;opacity:.6;font-size:16px" aria-label="Close">×</button></div>' +
    '<div data-s style="color:#9a97b0;margin-bottom:8px">Starting…</div>' +
    '<div style="color:#9a97b0;font-size:12px;margin-bottom:10px">Tip: click through each leaderboard tab and scroll to the bottom. New data is added automatically.</div>' +
    '<button data-a="o" style="all:unset;cursor:pointer;display:block;text-align:center;padding:9px;border-radius:10px;background:#25f4ee;color:#0b0b12;font-weight:700;margin-bottom:6px">Open in extractor</button>' +
    '<button data-a="c" style="all:unset;cursor:pointer;display:block;text-align:center;padding:8px;border-radius:10px;border:1px solid #2a2840">Copy data instead</button>';
  document.body.appendChild(box);
  var st = box.querySelector("[data-s]");
  function setStatus(t) { st.textContent = t; }
  function update() { setStatus(blocks.length + " leaderboard response" + (blocks.length === 1 ? "" : "s") + " captured."); }
  function payload() { return blocks.length ? blocks.join("\n\n") : fromPage(); }

  box.addEventListener("click", function (ev) {
    var a = ev.target.getAttribute("data-a");
    if (a === "x") { box.style.display = "none"; }
    else if (a === "c") {
      var p = payload(); if (!p) { setStatus("Nothing found yet. Open a leaderboard tab first."); return; }
      navigator.clipboard.writeText(p).then(function () { setStatus("Copied. Paste it into the extractor."); },
        function () { setStatus("Copy blocked by the browser. Use Open in extractor."); });
    } else if (a === "o") {
      var data = payload(); if (!data) { setStatus("Nothing found yet. Open a leaderboard tab first."); return; }
      var w = window.open(TOOL + "#from=bookmarklet", "_blank");
      if (!w) { setStatus("Pop-up blocked. Allow pop-ups for tiktok.com, or use Copy."); return; }
      var sent = false;
      function onMsg(e) {
        if (e.origin !== TOOL_ORIGIN || !e.data || e.data.type !== "extractor-ready" || sent) return;
        sent = true; window.removeEventListener("message", onMsg);
        w.postMessage({ type: "tiktok-campaign-data", payload: data, page: location.href }, TOOL_ORIGIN);
        setStatus("Sent to the extractor tab.");
      }
      window.addEventListener("message", onMsg);
    }
  });

  window.__thGrab = { show: function () { box.style.display = "block"; } };
  harvest().then(function () {
    if (!blocks.length) setStatus(fromPage() ? "No leaderboard data yet; found profile links on the page. Open a leaderboard tab for full scores." : "No leaderboard data yet. Open a leaderboard tab.");
    else update();
  });
})();
