const path = require("node:path");

function createDownloadQueue(getConcurrency) {
  const pending = [];
  const active = new Map();
  const history = [];
  const listeners = new Set();
  let paused = false;
  let seq = 0;

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
      createdAt: task.createdAt,
      startedAt: task.startedAt || null,
      endedAt: task.endedAt || null,
      status: task.status,
      outputDir: String(task.outputDir || ""),
      fileName: String(task.fileName || ""),
      filePath: task.outputDir && task.fileName ? `${task.outputDir}${path.sep}${task.fileName}` : "",
      message: String(task.message || "")
    };
  }

  function notify() {
    const snap = snapshot();
    for (const listener of listeners) {
      try {
        listener(snap);
      } catch {}
    }
  }

  function pushHistory(task) {
    history.unshift(toTaskView(task));
    if (history.length > 40) {
      history.length = 40;
    }
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
    return new Promise((resolve, reject) => {
      seq += 1;
      const task = {
        id: `q${Date.now().toString(36)}-${seq.toString(36)}`,
        label: String(meta.label || "Download").trim(),
        sourceType: String(meta.sourceType || "").trim(),
        createdAt: new Date().toISOString(),
        startedAt: null,
        endedAt: null,
        status: "queued",
        run: runFn,
        resolve: (value) => {
          task.status = task.cancelRequested ? "cancelled" : "done";
          if (value && typeof value === "object") {
            task.outputDir = String(value.outputDir || "");
            task.fileName = String(value.fileName || "");
            task.message = String(value.log || "");
          }
          resolve(value);
        },
        reject: (error) => {
          task.status = task.cancelRequested ? "cancelled" : "failed";
          task.message = String(error?.message || error || "");
          reject(error);
        },
        cancelRequested: false,
        cancelImpl: null
      };
      pending.push(task);
      notify();
      pump();
    });
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

  function snapshot() {
    return {
      paused,
      activeCount: active.size,
      queuedCount: pending.length,
      maxConcurrent: maxConcurrent(),
      active: Array.from(active.values()).map(toTaskView),
      queued: pending.map(toTaskView),
      recent: history.slice(0, 20)
    };
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
    pause,
    resume,
    cancel,
    clearPending,
    snapshot,
    onChange,
    stats
  };
}

module.exports = {
  createDownloadQueue
};
