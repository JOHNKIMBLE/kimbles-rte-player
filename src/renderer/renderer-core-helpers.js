(function initKimbleRendererCoreHelpers() {
  function createRendererCoreHelpers(deps) {
    const dom = deps.dom || {};
    const downloadProgressHandlers = new Map();

    function handleDownloadProgress(payload) {
      const token = payload?.token;
      if (!token || !downloadProgressHandlers.has(token)) {
        return;
      }
      const handler = downloadProgressHandlers.get(token);
      if (typeof handler === "function") {
        handler(payload);
      }
    }

    function createProgressToken(prefix) {
      return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }

    function attachDownloadProgress(token, handler) {
      downloadProgressHandlers.set(token, handler);
      return () => {
        downloadProgressHandlers.delete(token);
      };
    }

    function formatProgressText(progress, fallbackText) {
      if (!progress) {
        return fallbackText;
      }
      if (progress.kind === "download") {
        const percent = Number.isFinite(progress.percent) ? `${progress.percent.toFixed(1)}%` : "";
        const frag = progress.fragmentCurrent && progress.fragmentTotal
          ? ` (frag ${progress.fragmentCurrent}/${progress.fragmentTotal})`
          : "";
        return `Downloading... ${percent}${frag}`.trim();
      }
      if (progress.kind === "extractaudio") {
        return "Converting to MP3...";
      }
      if (progress.kind === "fixupm3u8") {
        return "Finalizing stream container...";
      }
      if (progress.kind === "cue") {
        return progress.message || fallbackText;
      }
      if (progress.kind === "generic" || progress.kind === "info" || progress.kind === "hlsnative") {
        return progress.message || fallbackText;
      }
      return progress.message || fallbackText;
    }

    const NAMED_HTML_ENTITIES = new Map(
      Object.entries({
        hellip: "\u2026",
        mdash: "\u2014",
        ndash: "\u2013",
        rsquo: "\u2019",
        lsquo: "\u2018",
        apos: "'",
        quot: '"',
        amp: "&",
        nbsp: " ",
        lt: "<",
        gt: ">"
      })
    );

    function decodeHtmlEntitiesOnce(sIn) {
      const s = String(sIn || "");
      let out = "";
      let i = 0;
      while (i < s.length) {
        if (s.charCodeAt(i) !== 38) {
          out += s[i];
          i += 1;
          continue;
        }
        const semi = s.indexOf(";", i + 1);
        if (semi < 0 || semi - i > 48) {
          out += "&";
          i += 1;
          continue;
        }
        const inner = s.slice(i + 1, semi);
        let rep = null;
        if (/^#[Xx][0-9a-fA-F]+$/.test(inner)) {
          const code = Number.parseInt(inner.slice(2), 16);
          if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff) {
            rep = String.fromCodePoint(code);
          }
        } else if (/^#[0-9]+$/.test(inner)) {
          const code = Number(inner.slice(1));
          if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff) {
            rep = String.fromCodePoint(code);
          }
        } else {
          rep = NAMED_HTML_ENTITIES.get(inner.toLowerCase()) ?? null;
        }
        if (rep != null) {
          out += rep;
          i = semi + 1;
        } else {
          out += "&";
          i += 1;
        }
      }
      return out;
    }

    /** Decode HTML entities without assigning untrusted strings to element innerHTML. */
    function decodeHtmlEntities(input) {
      let cur = String(input || "");
      for (let p = 0; p < 12; p += 1) {
        const next = decodeHtmlEntitiesOnce(cur);
        if (next === cur) {
          return cur;
        }
        cur = next;
      }
      return cur;
    }

    function escapeHtml(text) {
      return decodeHtmlEntities(String(text || ""))
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function normalizeOutputFormatValue(input) {
      return String(input || "").trim().toLowerCase() === "mp3" ? "mp3" : "m4a";
    }

    function setQuickStatus(text, isError = false) {
      if (!dom.quickResult) {
        return;
      }
      dom.quickResult.className = `status ${isError ? "" : "muted"}`;
      dom.quickResult.textContent = text;
    }

    function setBbcStatus(text, isError = false) {
      if (!dom.bbcResult) {
        return;
      }
      dom.bbcResult.className = `status ${isError ? "" : "muted"}`;
      dom.bbcResult.textContent = text;
    }

    function setButtonBusy(button, busy, normalLabel, busyLabel = "Working...") {
      if (!button) {
        return;
      }
      button.disabled = busy;
      button.textContent = busy ? busyLabel : normalLabel;
    }

    function setSettingsStatus(text, isError = false) {
      if (!dom.settingsStatus) {
        return;
      }
      dom.settingsStatus.className = `status ${isError ? "" : "muted"}`;
      dom.settingsStatus.textContent = text;
    }

    function shouldArmForceRetry(message) {
      return /click\s+download\s+again\s+to\s+force/i.test(String(message || ""));
    }

    function formatCueAlignment(cue) {
      const method = String(cue?.alignment?.method || "").trim();
      const confidenceRaw = Number(cue?.alignment?.confidence);
      const confidence = Number.isFinite(confidenceRaw) ? `${Math.round(confidenceRaw * 100)}%` : "";
      const reason = String(cue?.alignment?.reason || "").trim();
      const auddDetections = Number(cue?.alignment?.auddWindows?.detections || 0);
      const acoustidScoreRaw = Number(cue?.alignment?.acoustid?.score ?? cue?.acoustid?.score);
      const acoustidScore = Number.isFinite(acoustidScoreRaw) ? `acoustid ${Math.round(acoustidScoreRaw * 100)}%` : "";
      const songrecDetections = Number(cue?.alignment?.songrec?.detections || 0);
      const songrecMatched = Number(cue?.alignment?.songrec?.matched || 0);
      const insertedRecognitionTracks = Number(cue?.alignment?.insertedRecognitionTracks || 0);
      const landmarkSummary = cue?.alignment?.landmarks || null;
      const silenceCount = Number(landmarkSummary?.silenceCount || 0);
      const loudnessCount = Number(landmarkSummary?.loudnessCount || 0);
      const spectralCount = Number(landmarkSummary?.spectralCount || 0);
      const mergedCount = Number(landmarkSummary?.mergedCount || 0);
      const parts = [];
      if (method) {
        parts.push(method.replace(/[-_]+/g, " "));
      }
      if (confidence) {
        parts.push(confidence);
      }
      if (auddDetections > 0) {
        parts.push(`audd ${auddDetections}`);
      }
      if (acoustidScore) {
        parts.push(acoustidScore);
      }
      if (songrecDetections > 0) {
        parts.push(`songrec ${songrecMatched}/${songrecDetections}`);
      }
      if (insertedRecognitionTracks > 0) {
        parts.push(`inferred +${insertedRecognitionTracks}`);
      }
      if (mergedCount > 0) {
        parts.push(`landmarks ${mergedCount} (s${silenceCount}/l${loudnessCount}/f${spectralCount})`);
      }
      if (reason) {
        parts.push(reason);
      }
      if (!parts.length) {
        return "";
      }
      return ` (${parts.join(", ")})`;
    }

    function formatCueSource(cue) {
      const source = String(cue?.source || "").trim().toLowerCase();
      if (!source || source === "none") {
        return "";
      }
      const labels = {
        "external-tracklist": "external tracklist",
        "rte-episode-playlist": "RTE episode playlist",
        "bbc-music-played": "BBC music played",
        "common-tracklist-sites": "common tracklist sites",
        "common-tracklist-sites+acoustid": "common tracklist sites + AcoustID",
        "window-recognition-audd": "AudD window recognition",
        "window-recognition-audd+acoustid": "AudD + AcoustID window recognition",
        "window-recognition-audd+songrec": "AudD + Songrec window recognition",
        "window-recognition-audd+acoustid+songrec": "AudD + AcoustID + Songrec window recognition",
        "window-recognition-songrec": "Songrec window recognition",
        "window-recognition-acoustid": "AcoustID window recognition",
        "window-recognition-songrec+acoustid": "Songrec + AcoustID window recognition",
        "window-recognition-acoustid+songrec": "AcoustID + Songrec window recognition",
        "window-recognition-acoustid+audd": "AcoustID + AudD window recognition",
        "window-recognition-songrec+audd": "Songrec + AudD window recognition",
        "window-recognition-acoustid+songrec+audd": "AcoustID + Songrec + AudD window recognition"
      };
      const label = labels[source] || source.replace(/[-_]+/g, " ");
      return ` from ${label}`;
    }

    return {
      handleDownloadProgress,
      createProgressToken,
      attachDownloadProgress,
      formatProgressText,
      decodeHtmlEntities,
      escapeHtml,
      normalizeOutputFormatValue,
      setQuickStatus,
      setBbcStatus,
      setButtonBusy,
      setSettingsStatus,
      shouldArmForceRetry,
      formatCueAlignment,
      formatCueSource
    };
  }

  window.KimbleRendererCoreHelpers = {
    create: createRendererCoreHelpers
  };
})();
