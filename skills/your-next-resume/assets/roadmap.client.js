/*
  Roadmap page behaviour — inlined into the generated HTML by scripts/render-roadmap.mjs.
  Both views and every card are rendered server-side, so this file only adds:
    1. the timeline / by-resume-line toggle,
    2. per-browser tick state (localStorage, never written back to roadmap.md — ADR 0002/0004),
    3. the progress meter.
  Every localStorage touch is wrapped: a browser with storage blocked must still render.
*/
(function () {
  "use strict";

  var root = document.documentElement;
  var suffix = root.getAttribute("data-roadmap-key") || "default";
  var TICKS_KEY = "ynr.roadmap.ticks." + suffix;
  var VIEW_KEY = "ynr.roadmap.view." + suffix;

  /* ---- storage, defensively ---- */
  function readJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var value = JSON.parse(raw);
      return value && typeof value === "object" ? value : fallback;
    } catch (err) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* Private mode, blocked storage, quota. The file is the record; carry on. */
    }
  }
  function readString(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }
  function writeString(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {
      /* ignore */
    }
  }

  /*
    `overrides` holds only the milestones a person has actually clicked in this browser.
    Anything absent falls back to the `- [x] done` state read from roadmap.md, so the file
    stays the source of truth and a stale tick can never hide a real record.
  */
  var overrides = readJSON(TICKS_KEY, {});

  var cards = Array.prototype.slice.call(document.querySelectorAll(".card[data-m]"));
  var ids = cards.map(function (card) { return card.getAttribute("data-m"); });
  var fileDone = {};
  cards.forEach(function (card) {
    fileDone[card.getAttribute("data-m")] = card.getAttribute("data-file-done") === "true";
  });

  function isDone(id) {
    return Object.prototype.hasOwnProperty.call(overrides, id)
      ? overrides[id] === true
      : fileDone[id] === true;
  }

  function paint() {
    ids.forEach(function (id) {
      var done = isDone(id);
      var nodes = document.querySelectorAll('[data-m="' + id + '"]');
      Array.prototype.forEach.call(nodes, function (node) {
        if (node.classList.contains("card") || node.classList.contains("tl-row")) {
          node.classList.toggle("done", done);
        }
        var box = node.querySelector('input[type="checkbox"]');
        if (box) box.checked = done;
      });
      var row = document.querySelector('.tl-row[data-m="' + id + '"]');
      if (row) row.classList.toggle("done", done);
    });

    var n = ids.filter(isDone).length;
    var total = ids.length;
    var tally = document.querySelector(".tally");
    var fill = document.querySelector(".bar i");
    if (tally) tally.textContent = n + " of " + total + " done";
    if (fill) fill.style.width = (total ? (n / total) * 100 : 0) + "%";
  }

  document.addEventListener("change", function (event) {
    var target = event.target;
    if (!target || target.type !== "checkbox") return;
    var holder = target.closest ? target.closest("[data-m]") : null;
    if (!holder) return;
    var id = holder.getAttribute("data-m");
    if (!id || ids.indexOf(id) === -1) return;

    var next = !isDone(id);
    if (next === (fileDone[id] === true)) delete overrides[id];
    else overrides[id] = next;
    writeJSON(TICKS_KEY, overrides);
    paint();
  });

  /* ---- view toggle. No history.replaceState: it throws on file:// origins. ---- */
  var buttons = Array.prototype.slice.call(document.querySelectorAll(".switch button"));
  function setView(view) {
    var chosen = view === "bullets" ? "bullets" : "timeline";
    root.setAttribute("data-view", chosen);
    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-v") === chosen));
    });
    writeString(VIEW_KEY, chosen);
  }
  buttons.forEach(function (button) {
    button.addEventListener("click", function () { setView(button.getAttribute("data-v")); });
  });

  var params = (location.search || "").match(/[?&]view=(timeline|bullets)/);
  setView(params ? params[1] : (readString(VIEW_KEY) || "timeline"));
  paint();
})();
