const path = require("node:path");
const { fork } = require("node:child_process");

function runCueTaskInChild({ mode = "preview", options = {}, onProgress = null } = {}) {
  return new Promise((resolve, reject) => {
    const taskId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const workerPath = path.join(__dirname, "cue-worker.js");
    const child = fork(workerPath, [], {
      stdio: ["ignore", "ignore", "ignore", "ipc"]
    });

    let settled = false;
    const finish = (fn, value) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        if (child.connected) {
          child.disconnect();
        }
      } catch {}
      try {
        child.kill();
      } catch {}
      fn(value);
    };

    child.on("message", (message) => {
      if (!message || String(message.taskId || "") !== taskId) {
        return;
      }
      if (message.type === "progress") {
        if (typeof onProgress === "function") {
          onProgress(message.payload || {});
        }
        return;
      }
      if (message.type === "result") {
        finish(resolve, message.result);
        return;
      }
      if (message.type === "error") {
        finish(reject, new Error(String(message.error || "Cue worker failed")));
      }
    });

    child.once("error", (error) => {
      finish(reject, error);
    });

    child.once("exit", (code, signal) => {
      if (!settled) {
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        finish(reject, new Error(`Cue worker exited before completing (${reason}).`));
      }
    });

    child.send({
      type: "run",
      taskId,
      mode,
      options
    });
  });
}

module.exports = {
  runCueTaskInChild
};
