/*
  Roadmap page behaviour — inlined into the generated HTML by scripts/render-roadmap.mjs.
  Both views and every card are rendered server-side, so this file only adds:
    1. the timeline / Map toggle,
    2. per-browser tick state (localStorage, never written back to roadmap.md — ADR 0002/0004),
    3. the progress meter,
    4. the Map's click-to-select path highlighting and live locked/available state (ADR 0014),
    5. the nested task checklist and its cascading progress bars (ADR 0015).
  Every localStorage touch is wrapped: a browser with storage blocked must still render.
*/
(function () {
  "use strict";

  var root = document.documentElement;
  var suffix = root.getAttribute("data-roadmap-key") || "default";
  var TICKS_KEY = "ynr.roadmap.ticks." + suffix;
  var STEPS_KEY = "ynr.roadmap.steps." + suffix;
  var TASKS_KEY = "ynr.roadmap.tasks." + suffix;
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

  /* ADR 0014: the tech tree's detail panel is a second `.card[data-m]` per milestone
     (same id as the Timeline card), so ids must be deduplicated here or the "n of total
     done" tally would silently double-count every milestone. */
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card[data-m]"));
  var seenIds = {};
  var ids = [];
  cards.forEach(function (card) {
    var id = card.getAttribute("data-m");
    if (!Object.prototype.hasOwnProperty.call(seenIds, id)) {
      seenIds[id] = true;
      ids.push(id);
    }
  });
  var fileDone = {};
  cards.forEach(function (card) {
    fileDone[card.getAttribute("data-m")] = card.getAttribute("data-file-done") === "true";
  });

  function isDone(id) {
    return Object.prototype.hasOwnProperty.call(overrides, id)
      ? overrides[id] === true
      : fileDone[id] === true;
  }

  /*
    ADR 0013: step ticks are tracked completely separately from milestone ticks — a
    different storage key, a different override object, and a different file-state source
    (per-<li> data-file-done, not the card's data-file-done). Composite keys are
    "<milestoneId>:<stepIndex>" so two milestones' steps never collide.
  */
  var stepOverrides = readJSON(STEPS_KEY, {});
  var stepLis = Array.prototype.slice.call(document.querySelectorAll("li[data-s]"));
  var stepFileDone = {};
  stepLis.forEach(function (li) {
    var card = li.closest("[data-m]");
    if (!card) return;
    var key = card.getAttribute("data-m") + ":" + li.getAttribute("data-s");
    stepFileDone[key] = li.getAttribute("data-file-done") === "true";
  });

  function stepKeyOf(li) {
    var card = li.closest("[data-m]");
    return card ? card.getAttribute("data-m") + ":" + li.getAttribute("data-s") : null;
  }

  /*
    ADR 0015: task ticks are tracked completely separately again — a third storage key, a
    third override object, a third file-state source (per-<li> data-file-done, scoped by
    the task's own step AND that step's card). Composite keys are
    "<milestoneId>:<stepIndex>:<taskIndex>".
  */
  var taskOverrides = readJSON(TASKS_KEY, {});
  var taskLis = Array.prototype.slice.call(document.querySelectorAll("li[data-t]"));
  var taskFileDone = {};
  function taskKeyOf(li) {
    var stepLi = li.closest ? li.closest("li[data-s]") : null;
    var card = li.closest ? li.closest("[data-m]") : null;
    return stepLi && card ? card.getAttribute("data-m") + ":" + stepLi.getAttribute("data-s") + ":" + li.getAttribute("data-t") : null;
  }
  taskLis.forEach(function (li) {
    var key = taskKeyOf(li);
    if (key) taskFileDone[key] = li.getAttribute("data-file-done") === "true";
  });

  function isTaskDone(key) {
    return Object.prototype.hasOwnProperty.call(taskOverrides, key)
      ? taskOverrides[key] === true
      : taskFileDone[key] === true;
  }

  /* Step key -> its task keys, built once. Empty/absent for a zero-task step. */
  var stepTaskKeys = {};
  taskLis.forEach(function (li) {
    var stepLi = li.closest("li[data-s]");
    var card = li.closest("[data-m]");
    if (!stepLi || !card) return;
    var sKey = card.getAttribute("data-m") + ":" + stepLi.getAttribute("data-s");
    (stepTaskKeys[sKey] = stepTaskKeys[sKey] || []).push(taskKeyOf(li));
  });

  /* ADR 0015: once a step has tasks, its own bracket is not read for meaning — its
     done-ness is derived, so there is exactly one place this can go wrong, not two. */
  function isStepDone(key) {
    var taskKeys = stepTaskKeys[key];
    if (taskKeys && taskKeys.length > 0) {
      return taskKeys.every(function (tk) { return isTaskDone(tk); });
    }
    return Object.prototype.hasOwnProperty.call(stepOverrides, key)
      ? stepOverrides[key] === true
      : stepFileDone[key] === true;
  }

  function paintTasks() {
    taskLis.forEach(function (li) {
      var key = taskKeyOf(li);
      if (!key) return;
      var done = isTaskDone(key);
      li.classList.toggle("done", done);
      var box = li.querySelector('input[type="checkbox"]');
      if (box) box.checked = done;
    });
    Array.prototype.slice.call(document.querySelectorAll(".tasks")).forEach(function (group) {
      var items = Array.prototype.slice.call(group.querySelectorAll("li[data-t]"));
      var n = items.filter(function (li) { return isTaskDone(taskKeyOf(li)); }).length;
      var tally = group.querySelector(".tasks-tally");
      if (tally) tally.textContent = n + " of " + items.length + " tasks";
    });
    paintProgress();
  }

  /* Never touches .tally / .bar i — the milestone progress meter counts milestones only. */
  function paintSteps() {
    stepLis.forEach(function (li) {
      var key = stepKeyOf(li);
      if (!key) return;
      var done = isStepDone(key);
      li.classList.toggle("done", done);
      var box = li.querySelector('input[type="checkbox"]');
      if (box) {
        box.checked = done;
        var taskKeys = stepTaskKeys[key];
        box.indeterminate = !!(taskKeys && taskKeys.length && !done &&
          taskKeys.some(function (tk) { return isTaskDone(tk); }));
      }
    });

    Array.prototype.slice.call(document.querySelectorAll(".steps")).forEach(function (group) {
      var items = Array.prototype.slice.call(group.querySelectorAll("li[data-s]"));
      var n = items.filter(function (li) { return isStepDone(stepKeyOf(li)); }).length;
      var tally = group.querySelector(".steps-tally");
      if (tally) tally.textContent = n + " of " + items.length + " steps";
    });
    paintProgress();
  }

  /*
    ADR 0015: recompute each milestone's action-item tally from the CANONICAL (non-tt-detail)
    card's live DOM state — counting from both copies would double-count, exactly the class
    of bug ADR 0014 already had to fix once for the milestone-level tally.
  */
  function actionTally(id) {
    var canonical = document.querySelector('.card[data-m="' + id + '"]:not(.tt-detail)');
    if (!canonical) return { done: 0, total: 0 };
    var done = 0;
    var total = 0;
    Array.prototype.slice.call(canonical.querySelectorAll("li[data-s]")).forEach(function (stepLi) {
      var tasksHere = Array.prototype.slice.call(stepLi.querySelectorAll("li[data-t]"));
      if (tasksHere.length > 0) {
        tasksHere.forEach(function (t) {
          total += 1;
          if (isTaskDone(taskKeyOf(t))) done += 1;
        });
      } else {
        total += 1;
        if (isStepDone(stepKeyOf(stepLi))) done += 1;
      }
    });
    return { done: done, total: total };
  }

  function paintProgress() {
    var grandDone = 0;
    var grandTotal = 0;
    ids.forEach(function (id) {
      var t = actionTally(id);
      grandDone += t.done;
      grandTotal += t.total;
      var pct = t.total ? (t.done / t.total) * 100 : 0;
      Array.prototype.slice.call(document.querySelectorAll('.card[data-m="' + id + '"] .steps-progress')).forEach(function (el) {
        var bar = el.querySelector(".sp-bar i");
        var label = el.querySelector(".sp-label");
        if (bar) bar.style.width = pct + "%";
        if (label) label.textContent = t.done + " of " + t.total + " action items done";
      });
      var fill = document.querySelector('.tt-node[data-m="' + id + '"] .tt-fill');
      if (fill) fill.style.width = pct + "%";
    });
    var bar = document.querySelector(".tasks-meter .bar i");
    var tally = document.querySelector(".tasks-meter .tally");
    if (tally) tally.textContent = grandDone + " of " + grandTotal + " action items done";
    if (bar) bar.style.width = (grandTotal ? (grandDone / grandTotal) * 100 : 0) + "%";
  }

  /*
    ADR 0014: the tech tree's forward/reverse dependency maps, built once from each
    node's own `data-deps` — the single data source also used for live locked/available
    recomputation below and for path highlighting in selectNode(). No server-emitted
    JSON island, no second mechanism.
  */
  var treeNodes = Array.prototype.slice.call(document.querySelectorAll(".tt-node[data-m]"));
  var edgeEls = Array.prototype.slice.call(document.querySelectorAll(".tt-edge"));
  var depsOf = {};
  treeNodes.forEach(function (node) {
    var raw = node.getAttribute("data-deps") || "";
    depsOf[node.getAttribute("data-m")] = raw ? raw.split(",") : [];
  });
  var dependents = {};
  treeNodes.forEach(function (node) {
    dependents[node.getAttribute("data-m")] = [];
  });
  Object.keys(depsOf).forEach(function (id) {
    depsOf[id].forEach(function (dep) {
      if (dependents[dep]) dependents[dep].push(id);
    });
  });

  /* Real status, not decorative: recomputed on every tick, not just at first render. */
  function paintTree() {
    treeNodes.forEach(function (node) {
      var id = node.getAttribute("data-m");
      var done = isDone(id);
      var blocked = (depsOf[id] || []).some(function (d) { return !isDone(d); });
      node.classList.remove("is-done", "is-locked", "is-available");
      node.classList.add(done ? "is-done" : blocked ? "is-locked" : "is-available");
    });
  }

  /* Ancestors (what it needs) + descendants (what it unlocks) + itself, iteratively —
     no recursion, so a large or malformed graph still can't blow the stack. */
  function relatedSet(id) {
    var seen = {};
    seen[id] = true;
    var stack = [id];
    while (stack.length) {
      var cur = stack.pop();
      (depsOf[cur] || []).forEach(function (d) {
        if (!seen[d]) { seen[d] = true; stack.push(d); }
      });
    }
    stack = [id];
    while (stack.length) {
      var cur2 = stack.pop();
      (dependents[cur2] || []).forEach(function (d) {
        if (!seen[d]) { seen[d] = true; stack.push(d); }
      });
    }
    return seen;
  }

  var selectedId = null;
  function selectNode(id) {
    selectedId = id;
    var related = id ? relatedSet(id) : null;
    treeNodes.forEach(function (node) {
      var nid = node.getAttribute("data-m");
      node.classList.toggle("tt-lit", !!related && !!related[nid]);
      node.classList.toggle("tt-dim", !!related && !related[nid]);
      node.setAttribute("aria-pressed", String(nid === id));
    });
    edgeEls.forEach(function (edge) {
      var lit = related && related[edge.getAttribute("data-from")] && related[edge.getAttribute("data-to")];
      edge.classList.toggle("tt-lit", !!lit);
      edge.classList.toggle("tt-dim", !!related && !lit);
    });
    Array.prototype.slice.call(document.querySelectorAll(".tt-detail")).forEach(function (d) {
      d.classList.toggle("is-active", d.getAttribute("data-m") === id);
    });
    var wrap = document.querySelector(".tt-detail-wrap");
    if (wrap) wrap.classList.toggle("has-selection", !!id);
  }

  document.addEventListener("click", function (event) {
    var node = event.target.closest ? event.target.closest(".tt-node") : null;
    if (!node) return;
    var id = node.getAttribute("data-m");
    selectNode(id === selectedId ? null : id);
  });

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

    paintTree();
    paintProgress();
  }

  document.addEventListener("change", function (event) {
    var target = event.target;
    if (!target || target.type !== "checkbox") return;

    /* ADR 0015: a task's <li> sits inside a <details> inside a step's <li data-s>, so
       target.closest("li[data-s]") ALSO matches a task checkbox — test task ancestry
       first and handle it separately, or a task click would misfire as a step click.
       (A step-with-tasks' own checkbox is disabled, so it can never reach this listener.) */
    var taskLi = target.closest ? target.closest("li[data-t]") : null;
    if (taskLi) {
      var tkey = taskKeyOf(taskLi);
      if (!tkey) return;
      var nextTask = !isTaskDone(tkey);
      if (nextTask === (taskFileDone[tkey] === true)) delete taskOverrides[tkey];
      else taskOverrides[tkey] = nextTask;
      writeJSON(TASKS_KEY, taskOverrides);
      paintTasks();
      paintSteps(); // the owning step's derived checked/indeterminate state may have changed
      return;
    }

    /* ADR 0013: a step's <li> sits inside a <details> inside .card[data-m], so both a step
       checkbox and the milestone's own checkbox resolve to the same closest("[data-m]").
       Check for step ancestry first and handle it separately, or a step click would
       misfire the milestone's own done state. */
    var stepLi = target.closest ? target.closest("li[data-s]") : null;
    if (stepLi) {
      var key = stepKeyOf(stepLi);
      if (!key) return;
      var nextStep = !isStepDone(key);
      if (nextStep === (stepFileDone[key] === true)) delete stepOverrides[key];
      else stepOverrides[key] = nextStep;
      writeJSON(STEPS_KEY, stepOverrides);
      paintSteps();
      return;
    }

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
    var chosen = view === "tree" ? view : "timeline";
    root.setAttribute("data-view", chosen);
    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-v") === chosen));
    });
    writeString(VIEW_KEY, chosen);
  }
  buttons.forEach(function (button) {
    button.addEventListener("click", function () { setView(button.getAttribute("data-v")); });
  });

  var params = (location.search || "").match(/[?&]view=(timeline|tree)/);
  setView(params ? params[1] : (readString(VIEW_KEY) || "timeline"));
  paint();
  paintSteps();
  paintTasks();
})();
