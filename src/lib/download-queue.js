const fs = require("node:fs");
const path = require("node:path");

function safeReadQueueStore(storagePath) {
  if (!storagePath || !fs.existsSync(storagePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(storagePath, "utf8"));
  } catch {
    return null;
  }
}

function writeQueueStore(storagePath, payload) {
  if (!storagePath) {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
    const tmpPath = `${storagePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmpPath, storagePath);
  } catch {}
}

function normalizeMetadataList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/,\s*/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function createDownloadQueue(getConcurrency, options = {}) {
  const pending = [];
  const active = new Map();
  const history = [];
  const listeners = new Set();
  let paused = false;
  let seq = 0;

  function resolveStoragePath() {
    if (typeof options.getStoragePath === "function") {
      return String(options.getStoragePath() || "").trim();
    }
    return String(options.storagePath || "").trim();
  }

  function maxConcurrent() {
    const value = Number(getConcurrency?.() || 1);
    if (!Number.isFinite(value)) {
      return 1;
    }
    return Math.max(1, Math.min(8, Math.floor(value)));
  }

  function toTaskView(task) {
    return {
      id: task.id,
      label: task.label,
      sourceType: task.sourceType,
      programTitle: String(task.programTitle || ""),
      episodeUrl: String(task.episodeUrl || ""),
      description: String(task.description || ""),
      location: String(task.location || ""),
      hosts: normalizeMetadataList(task.hosts),
      genres: normalizeMetadataList(task.genres),
      createdAt: task.createdAt,
      startedAt: task.startedAt || null,
      endedAt: task.endedAt || null,
      status: task.status,
      outputDir: String(task.outputDir || ""),
      fileName: String(task.fileName || ""),
      filePath: task.outputDir && task.fileName ? `${task.outputDir}${path.sep}${task.fileName}` : "",
      message: String(task.message || ""),
      rerunnable: Boolean(task.persisted)
    };
  }

  function toPersistedTask(task) {
    if (!task || !task.persisted) {
      return null;
    }
    return {
      ...toTaskView(task),
      persisted: task.persisted
    };
  }

  function toHistoryItem(task) {
    return {
      ...toTaskView(task),
      persisted: task?.persisted || null
    };
  }

  function toHistoryView(item) {
    return {
      id: item.id,
      label: item.label,
      sourceType: item.sourceType,
      programTitle: String(item.programTitle || ""),
      episodeUrl: String(item.episodeUrl || ""),
      description: String(item.description || ""),
      location: String(item.location || ""),
      hosts: normalizeMetadataList(item.hosts),
      genres: normalizeMetadataList(item.genres),
      createdAt: item.createdAt,
      startedAt: item.startedAt || null,
      endedAt: item.endedAt || null,
      status: item.status,
      outputDir: String(item.outputDir || ""),
      fileName: String(item.fileName || ""),
      filePath: String(item.filePath || ""),
      message: String(item.message || ""),
      rerunnable: Boolean(item.persisted)
    };
  }

  function persistState() {
    const storagePath = resolveStoragePath();
    if (!storagePath) {
      return;
    }
    writeQueueStore(storagePath, {
      paused,
      pending: pending.map(toPersistedTask).filter(Boolean),
      active: Array.from(active.values()).map(toPersistedTask).filter(Boolean),
      history: history.slice(0, 40)
    });
  }

  function snapshot() {
    return {
      paused,
      activeCount: active.size,
      queuedCount: pending.length,
      maxConcurrent: maxConcurrent(),
      active: Array.from(active.values()).map(toTaskView),
      queued: pending.map(toTaskView),
      recent: history.slice(0, 20).map(toHistoryView)
    };
  }

  function notify() {
    persistState();
    const snap = snapshot();
    for (const listener of listeners) {
      try {
        listener(snap);
      } catch {}
    }
  }

  function pushHistory(task) {
    history.unshift(toHistoryItem(task));
    if (history.length > 40) {
      history.length = 40;
    }
  }

  function createTask(runFn, meta = {}, mode = "promise") {
    seq += 1;
    const task = {
      id: String(meta.id || `q${Date.now().toString(36)}-${seq.toString(36)}`),
      label: String(meta.label || "Download").trim(),
      sourceType: String(meta.sourceType || "").trim(),
      programTitle: String(meta.programTitle || "").trim(),
      episodeUrl: String(meta.episodeUrl || "").trim(),
      description: String(meta.description || "").trim(),
      location: String(meta.location || "").trim(),
      hosts: normalizeMetadataList(meta.hosts),
      genres: normalizeMetadataList(meta.genres),
      createdAt: String(meta.createdAt || new Date().toISOString()),
      startedAt: meta.startedAt || null,
      endedAt: meta.endedAt || null,
      status: String(meta.status || "queued"),
      message: String(meta.message || ""),
      outputDir: String(meta.outputDir || ""),
      fileName: String(meta.fileName || ""),
      persisted: meta.persisted || null,
      run: runFn,
      cancelRequested: false,
      cancelImpl: null
    };

    if (mode === "promise") {
      let resolvePromise = () => {};
      let rejectPromise = () => {};
      const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });
      task.resolve = (value) => {
        task.status = task.cancelRequested ? "cancelled" : "done";
        if (value && typeof value === "object") {
          task.outputDir = String(value.outputDir || "");
          task.fileName = String(value.fileName || "");
          task.message = String(value.log || task.message || "");
        }
        resolvePromise(value);
      };
      task.reject = (error) => {
        task.status = task.cancelRequested ? "cancelled" : "failed";
        task.message = String(error?.message || error || "");
        rejectPromise(error);
      };
      return { task, promise };
    }

    task.resolve = (value) => {
      task.status = task.cancelRequested ? "cancelled" : "done";
      if (value && typeof value === "object") {
        task.outputDir = String(value.outputDir || "");
        task.fileName = String(value.fileName || "");
        task.message = String(value.log || task.message || "");
      }
    };
    task.reject = (error) => {
      task.status = task.cancelRequested ? "cancelled" : "failed";
      task.message = String(error?.message || error || "");
    };
    return { task, promise: null };
  }

  function enqueueTask(task) {
    pending.push(task);
    notify();
    pump();
  }

  function pump() {
    while (!paused && active.size < maxConcurrent() && pending.length) {
      const task = pending.shift();
      if (!task) {
        continue;
      }
      if (task.cancelRequested) {
        task.status = "cancelled";
        task.endedAt = new Date().toISOString();
        pushHistory(task);
        task.reject(new Error("Cancelled by user."));
        notify();
        continue;
      }
      task.status = "running";
      task.startedAt = new Date().toISOString();
      active.set(task.id, task);
      notify();
      Promise.resolve()
        .then(() => task.run({
          id: task.id,
          label: task.label,
          sourceType: task.sourceType,
          registerCancel: (fn) => {
            if (typeof fn === "function") {
              task.cancelImpl = fn;
            }
          },
          isCancelled: () => Boolean(task.cancelRequested)
        }))
        .then(task.resolve, task.reject)
        .finally(() => {
          active.delete(task.id);
          if (!task.endedAt) {
            task.endedAt = new Date().toISOString();
          }
          if (task.status === "running") {
            task.status = task.cancelRequested ? "cancelled" : "done";
          }
          pushHistory(task);
          notify();
          pump();
        });
    }
  }

  function run(runFn, meta = {}) {
    const { task, promise } = createTask(runFn, meta, "promise");
    enqueueTask(task);
    return promise;
  }

  function restorePending() {
    const storagePath = resolveStoragePath();
    if (!storagePath || typeof options.restoreTask !== "function") {
      return 0;
    }
    const store = safeReadQueueStore(storagePath);
    if (!store || typeof store !== "object") {
      return 0;
    }
    paused = Boolean(store.paused);
    history.length = 0;
    for (const item of Array.isArray(store.history) ? store.history.slice(0, 40) : []) {
      history.push({
        id: String(item?.id || ""),
        label: String(item?.label || "Download"),
        sourceType: String(item?.sourceType || ""),
        programTitle: String(item?.programTitle || ""),
        episodeUrl: String(item?.episodeUrl || ""),
        description: String(item?.description || ""),
        location: String(item?.location || ""),
        hosts: normalizeMetadataList(item?.hosts),
        genres: normalizeMetadataList(item?.genres),
        createdAt: String(item?.createdAt || ""),
        startedAt: item?.startedAt || null,
        endedAt: item?.endedAt || null,
        status: String(item?.status || ""),
        outputDir: String(item?.outputDir || ""),
        fileName: String(item?.fileName || ""),
        filePath: String(item?.filePath || ""),
        message: String(item?.message || ""),
        persisted: item?.persisted || null
      });
    }

    const savedTasks = [
      ...(Array.isArray(store.active) ? store.active : []),
      ...(Array.isArray(store.pending) ? store.pending : [])
    ];
    let restoredCount = 0;

    for (const item of savedTasks) {
      const persisted = item?.persisted;
      if (!persisted) {
        continue;
      }
      try {
        const restored = options.restoreTask(persisted, item);
        if (!restored || typeof restored.run !== "function") {
          continue;
        }
        const { task } = createTask(restored.run, {
          id: item.id,
          label: restored.meta?.label || item.label,
          sourceType: restored.meta?.sourceType || item.sourceType,
          programTitle: restored.meta?.programTitle || item.programTitle || "",
          episodeUrl: restored.meta?.episodeUrl || item.episodeUrl || "",
          description: restored.meta?.description || item.description || "",
          location: restored.meta?.location || item.location || "",
          hosts: normalizeMetadataList(restored.meta?.hosts || item.hosts),
          genres: normalizeMetadataList(restored.meta?.genres || item.genres),
          createdAt: item.createdAt || new Date().toISOString(),
          status: "queued",
          persisted,
          message: item.status === "running"
            ? "Restored after restart; previous run was interrupted."
            : "Restored after restart."
        }, "restored");
        pending.push(task);
        restoredCount += 1;
      } catch {}
    }
    notify();
    pump();
    return restoredCount;
  }

  function pause() {
    paused = true;
    notify();
  }

  function resume() {
    paused = false;
    notify();
    pump();
  }

  function cancel(taskId) {
    const id = String(taskId || "").trim();
    if (!id) {
      return false;
    }
    const pendingIndex = pending.findIndex((task) => task.id === id);
    if (pendingIndex >= 0) {
      const [task] = pending.splice(pendingIndex, 1);
      task.cancelRequested = true;
      task.status = "cancelled";
      task.endedAt = new Date().toISOString();
      pushHistory(task);
      task.reject(new Error("Cancelled by user."));
      notify();
      return true;
    }
    const task = active.get(id);
    if (!task) {
      return false;
    }
    task.cancelRequested = true;
    task.status = "cancelling";
    if (typeof task.cancelImpl === "function") {
      try {
        task.cancelImpl();
      } catch {}
    }
    notify();
    return true;
  }

  function clearPending() {
    const ids = pending.map((task) => task.id);
    for (const id of ids) {
      cancel(id);
    }
  }

  function rerun(taskId, options = {}) {
    if (typeof options.restoreTask !== "function") {
      return null;
    }
    const id = String(taskId || "").trim();
    if (!id) {
      return null;
    }
    const previous = history.find((item) => item.id === id && item.persisted);
    if (!previous?.persisted) {
      return null;
    }
    const restored = options.restoreTask(previous.persisted, previous, {
      mode: options.mode === "current-settings" ? "current-settings" : "exact"
    });
    if (!restored || typeof restored.run !== "function") {
      return null;
    }
    const { task, promise } = createTask(restored.run, {
      label: restored.meta?.label || previous.label,
      sourceType: restored.meta?.sourceType || previous.sourceType,
      programTitle: restored.meta?.programTitle || previous.programTitle || "",
      episodeUrl: restored.meta?.episodeUrl || previous.episodeUrl || "",
      description: restored.meta?.description || previous.description || "",
      location: restored.meta?.location || previous.location || "",
      hosts: normalizeMetadataList(restored.meta?.hosts || previous.hosts),
      genres: normalizeMetadataList(restored.meta?.genres || previous.genres),
      persisted: previous.persisted,
      message: options.mode === "current-settings"
        ? "Queued again with current settings."
        : "Queued again from saved job."
    }, "promise");
    enqueueTask(task);
    return { id: task.id, promise };
  }

  function stats() {
    return {
      active: active.size,
      queued: pending.length,
      maxConcurrent: maxConcurrent(),
      paused
    };
  }

  function onChange(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    try {
      listener(snapshot());
    } catch {}
    return () => listeners.delete(listener);
  }

  return {
    run,
    restorePending,
    pause,
    resume,
    cancel,
    clearPending,
    rerun,
    snapshot,
    onChange,
    stats
  };
}

module.exports = {
  createDownloadQueue
};
