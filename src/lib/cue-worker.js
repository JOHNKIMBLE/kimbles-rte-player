const { generateCueForAudio, generateCuePreview } = require("./cue");
const { getEpisodePlaylist } = require("./rte");
const { getBbcEpisodePlaylist } = require("./bbc");
const { getKexpEpisodeTracklist } = require("./kexp");
const { getFipEpisodeTracklist } = require("./fip");

async function runTask(message) {
  const taskId = String(message?.taskId || "");
  const mode = String(message?.mode || "preview");
  const options = message?.options && typeof message.options === "object" ? message.options : {};
  const runner = mode === "generate" ? generateCueForAudio : generateCuePreview;

  const result = await runner({
    ...options,
    getRteTracks: getEpisodePlaylist,
    getBbcTracks: getBbcEpisodePlaylist,
    getKexpTracks: getKexpEpisodeTracklist,
    getFipTracks: getFipEpisodeTracklist,
    onProgress: (payload) => {
      if (typeof process.send === "function") {
        process.send({
          type: "progress",
          taskId,
          payload
        });
      }
    }
  });

  if (typeof process.send === "function") {
    process.send({
      type: "result",
      taskId,
      result
    });
  }
}

process.on("message", async (message) => {
  if (!message || message.type !== "run") {
    return;
  }
  const taskId = String(message.taskId || "");
  try {
    await runTask(message);
  } catch (error) {
    if (typeof process.send === "function") {
      process.send({
        type: "error",
        taskId,
        error: String(error?.message || error || "Cue worker failed")
      });
    }
  } finally {
    setTimeout(() => process.exit(0), 0);
  }
});
