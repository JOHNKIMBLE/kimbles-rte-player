(function initKimbleSettingsScreen() {
  function createSettingsScreen(deps) {
    const state = deps.state;
    const dom = deps.dom || {};
    const normalizeOutputFormatValue = deps.normalizeOutputFormatValue;
    const setButtonBusy = deps.setButtonBusy;
    const setSettingsStatus = deps.setSettingsStatus;
    const getActiveDownloadDir = deps.getActiveDownloadDir;
    const setActiveDownloadDir = deps.setActiveDownloadDir;
    const parseReleaseDate = deps.parseReleaseDate;
    const refreshTimeBasedUi = deps.refreshTimeBasedUi;
    const defaultEpisodesPerPage = Number(deps.defaultEpisodesPerPage || 5);
    const defaultDiscoveryCount = Number(deps.defaultDiscoveryCount || 5);

    function renderPathFormatPreview() {
      if (!dom.pathFormatPreview) {
        return;
      }
      const format = String(dom.pathFormatInput?.value || state.pathFormat || "").trim();
      if (!format) {
        dom.pathFormatPreview.textContent = "Preview: (empty format)";
        return;
      }
      const sampleProgram = state.currentEpisodes?.title || state.bbcEpisodesPayload?.title || "2FM Greene Room with Jenny Greene";
      const sampleEpisode = "Wednesday 4 March 2026";
      const sampleDate = parseReleaseDate(state.currentEpisodes?.episodes?.[0]?.publishedTime || state.bbcEpisodesPayload?.episodes?.[0]?.publishedTime || "2026-03-04");
      const [year = "2026", month = "03", day = "04"] = sampleDate.split("-");
      const sample = format
        .replace(/\{radio\}/gi, "RTE")
        .replace(/\{program\}/gi, sampleProgram)
        .replace(/\{program_slug\}/gi, "2fm-greene-room-with-jenny-greene")
        .replace(/\{episode_short\}/gi, "Wednesday 4 March 2026")
        .replace(/\{episode\}/gi, sampleEpisode)
        .replace(/\{episode_slug\}/gi, "wednesday-4-march-2026")
        .replace(/\{release_date\}/gi, sampleDate)
        .replace(/\{year\}/gi, year)
        .replace(/\{month\}/gi, month)
        .replace(/\{day\}/gi, day)
        .replace(/\{date_compact\}/gi, `${year}${month}${day}`)
        .replace(/\{source_id\}/gi, "11783152");
      const ext = String(dom.outputFormatSelect?.value || state.outputFormat || "m4a")
        .replace(/^\./, "")
        .toLowerCase();
      dom.pathFormatPreview.textContent = `Preview: ${sample}.${ext || "m4a"}`;
    }

    function updateDownloadDirPickerUi() {
      if (!dom.chooseDownloadDirBtn) {
        return;
      }
      const canPick = Boolean(state.canPickDownloadDirectory);
      dom.chooseDownloadDirBtn.disabled = !canPick;
      dom.chooseDownloadDirBtn.title = canPick
        ? "Open folder picker"
        : "Folder picker is only available in Electron desktop build. Edit path manually here.";
    }

    function syncFormFromState() {
      if (dom.timeFormatSelect) {
        dom.timeFormatSelect.value = state.timeFormat;
      }
      if (dom.episodesPerPageInput) {
        dom.episodesPerPageInput.value = String(state.episodesPerPage);
      }
      if (dom.discoveryCountInput) {
        dom.discoveryCountInput.value = String(state.discoveryCount);
      }
      if (dom.downloadDirInput) {
        dom.downloadDirInput.value = getActiveDownloadDir();
      }
      if (dom.pathFormatInput) {
        dom.pathFormatInput.value = state.pathFormat;
      }
      if (dom.cueAutoGenerateCheckbox) {
        dom.cueAutoGenerateCheckbox.checked = state.cueAutoGenerate;
      }
      if (dom.outputFormatSelect) {
        dom.outputFormatSelect.value = normalizeOutputFormatValue(state.outputFormat);
      }
      if (dom.outputQualitySelect) {
        dom.outputQualitySelect.value = state.outputQuality;
      }
      if (dom.normalizeLoudnessCheckbox) {
        dom.normalizeLoudnessCheckbox.checked = state.normalizeLoudness;
      }
      if (dom.maxConcurrentInput) {
        dom.maxConcurrentInput.value = String(state.maxConcurrentDownloads);
      }
      if (dom.dedupeModeSelect) {
        dom.dedupeModeSelect.value = state.dedupeMode;
      }
      if (dom.id3TaggingCheckbox) {
        dom.id3TaggingCheckbox.checked = state.id3Tagging;
      }
      if (dom.feedExportCheckbox) {
        dom.feedExportCheckbox.checked = state.feedExportEnabled;
      }
      if (dom.webhookUrlInput) {
        dom.webhookUrlInput.value = state.webhookUrl;
      }
      if (dom.auddTrackMatchingCheckbox) {
        dom.auddTrackMatchingCheckbox.checked = state.auddTrackMatching;
      }
      if (dom.auddApiTokenInput) {
        dom.auddApiTokenInput.value = state.auddApiToken;
      }
      if (dom.fingerprintTrackMatchingCheckbox) {
        dom.fingerprintTrackMatchingCheckbox.checked = state.fingerprintTrackMatching;
      }
      if (dom.acoustidApiKeyInput) {
        dom.acoustidApiKeyInput.value = state.acoustidApiKey;
      }
      if (dom.songrecTrackMatchingCheckbox) {
        dom.songrecTrackMatchingCheckbox.checked = state.songrecTrackMatching;
      }
      if (dom.songrecSampleSecondsInput) {
        dom.songrecSampleSecondsInput.value = String(state.songrecSampleSeconds);
      }
      if (dom.ffmpegCueSilenceCheckbox) {
        dom.ffmpegCueSilenceCheckbox.checked = state.ffmpegCueSilenceDetect;
      }
      if (dom.ffmpegCueLoudnessCheckbox) {
        dom.ffmpegCueLoudnessCheckbox.checked = state.ffmpegCueLoudnessDetect;
      }
      if (dom.ffmpegCueSpectralCheckbox) {
        dom.ffmpegCueSpectralCheckbox.checked = state.ffmpegCueSpectralDetect;
      }
      renderPathFormatPreview();
    }

    function applySettingsToState(settings) {
      state.timeFormat = settings?.timeFormat === "12h" ? "12h" : "24h";
      state.episodesPerPage = Math.max(1, Math.min(50, Number(settings?.episodesPerPage || defaultEpisodesPerPage) || defaultEpisodesPerPage));
      state.discoveryCount = Math.max(1, Math.min(24, Number(settings?.discoveryCount || defaultDiscoveryCount) || defaultDiscoveryCount));
      state.downloadDir = String(settings?.downloadDir || settings?.rteDownloadDir || "");
      state.pathFormat = String(settings?.pathFormat || state.pathFormat);
      state.cueAutoGenerate = Boolean(settings?.cueAutoGenerate);
      state.outputFormat = normalizeOutputFormatValue(settings?.outputFormat || "m4a");
      state.outputQuality = String(settings?.outputQuality || "128K");
      state.normalizeLoudness = settings?.normalizeLoudness == null ? true : Boolean(settings.normalizeLoudness);
      state.maxConcurrentDownloads = Math.max(1, Math.min(8, Number(settings?.maxConcurrentDownloads || 2) || 2));
      state.dedupeMode = String(settings?.dedupeMode || "source-id");
      state.id3Tagging = settings?.id3Tagging == null ? true : Boolean(settings.id3Tagging);
      state.feedExportEnabled = settings?.feedExportEnabled == null ? true : Boolean(settings.feedExportEnabled);
      state.webhookUrl = String(settings?.webhookUrl || "");
      state.auddTrackMatching = settings?.auddTrackMatching == null ? false : Boolean(settings.auddTrackMatching);
      state.auddApiToken = String(settings?.auddApiToken || "");
      state.fingerprintTrackMatching = settings?.fingerprintTrackMatching == null ? false : Boolean(settings.fingerprintTrackMatching);
      state.acoustidApiKey = String(settings?.acoustidApiKey || "");
      state.songrecTrackMatching = settings?.songrecTrackMatching == null ? false : Boolean(settings.songrecTrackMatching);
      state.songrecSampleSeconds = Math.max(8, Math.min(45, Number(settings?.songrecSampleSeconds || 20) || 20));
      state.ffmpegCueSilenceDetect = settings?.ffmpegCueSilenceDetect == null ? true : Boolean(settings.ffmpegCueSilenceDetect);
      state.ffmpegCueLoudnessDetect = settings?.ffmpegCueLoudnessDetect == null ? true : Boolean(settings.ffmpegCueLoudnessDetect);
      state.ffmpegCueSpectralDetect = settings?.ffmpegCueSpectralDetect == null ? true : Boolean(settings.ffmpegCueSpectralDetect);
    }

    async function loadSettings() {
      const settings = await window.rteDownloader.getSettings();
      applySettingsToState(settings);
      syncFormFromState();
    }

    async function saveSettings() {
      const activeDownloadDir = String(dom.downloadDirInput?.value || "").trim();
      const pathFormat = String(dom.pathFormatInput?.value || "").trim();
      const timeFormat = dom.timeFormatSelect?.value === "12h" ? "12h" : "24h";
      const episodesPerPage = Math.max(1, Math.min(50, Math.floor(Number(dom.episodesPerPageInput?.value || defaultEpisodesPerPage) || defaultEpisodesPerPage)));
      const discoveryCount = Math.max(1, Math.min(24, Math.floor(Number(dom.discoveryCountInput?.value || defaultDiscoveryCount) || defaultDiscoveryCount)));
      const cueAutoGenerate = Boolean(dom.cueAutoGenerateCheckbox?.checked);
      const outputFormat = normalizeOutputFormatValue(dom.outputFormatSelect?.value || "m4a");
      const outputQuality = String(dom.outputQualitySelect?.value || "128K");
      const normalizeLoudness = Boolean(dom.normalizeLoudnessCheckbox?.checked);
      const dedupeMode = String(dom.dedupeModeSelect?.value || "source-id");
      const id3Tagging = Boolean(dom.id3TaggingCheckbox?.checked);
      const feedExportEnabled = Boolean(dom.feedExportCheckbox?.checked);
      const webhookUrl = String(dom.webhookUrlInput?.value || "").trim();
      const auddTrackMatching = Boolean(dom.auddTrackMatchingCheckbox?.checked);
      const auddApiToken = String(dom.auddApiTokenInput?.value || "").trim();
      const fingerprintTrackMatching = Boolean(dom.fingerprintTrackMatchingCheckbox?.checked);
      const acoustidApiKey = String(dom.acoustidApiKeyInput?.value || "").trim();
      const songrecTrackMatching = Boolean(dom.songrecTrackMatchingCheckbox?.checked);
      const songrecSampleSeconds = Math.max(8, Math.min(45, Math.floor(Number(dom.songrecSampleSecondsInput?.value || 20) || 20)));
      const ffmpegCueSilenceDetect = Boolean(dom.ffmpegCueSilenceCheckbox?.checked);
      const ffmpegCueLoudnessDetect = Boolean(dom.ffmpegCueLoudnessCheckbox?.checked);
      const ffmpegCueSpectralDetect = Boolean(dom.ffmpegCueSpectralCheckbox?.checked);
      const maxConcurrentDownloads = Math.max(1, Math.min(8, Math.floor(Number(dom.maxConcurrentInput?.value || 2) || 2)));

      if (!activeDownloadDir) {
        setSettingsStatus("Choose a download directory first.", true);
        return;
      }
      if (!pathFormat) {
        setSettingsStatus("Set a path format first.", true);
        return;
      }

      setButtonBusy(dom.saveSettingsBtn, true, "Save Settings", "Saving...");
      try {
        setActiveDownloadDir(activeDownloadDir);
        const saved = await window.rteDownloader.saveSettings({
          timeFormat,
          episodesPerPage,
          discoveryCount,
          downloadDir: state.downloadDir,
          pathFormat,
          cueAutoGenerate,
          outputFormat,
          outputQuality,
          normalizeLoudness,
          maxConcurrentDownloads,
          dedupeMode,
          id3Tagging,
          feedExportEnabled,
          webhookUrl,
          auddTrackMatching,
          auddApiToken,
          fingerprintTrackMatching,
          acoustidApiKey,
          songrecTrackMatching,
          songrecSampleSeconds,
          ffmpegCueSilenceDetect,
          ffmpegCueLoudnessDetect,
          ffmpegCueSpectralDetect
        });
        applySettingsToState(saved);
        syncFormFromState();
        if (state.auddTrackMatching && !state.auddApiToken) {
          setSettingsStatus("Settings saved. AudD is enabled, but no API token is configured, so AudD matching will be skipped.", true);
        } else if (state.fingerprintTrackMatching && !state.acoustidApiKey) {
          setSettingsStatus("Settings saved. AcoustID is enabled, but no API key is configured, so AcoustID matching will be skipped.", true);
        } else if (!state.ffmpegCueSilenceDetect && !state.ffmpegCueLoudnessDetect && !state.ffmpegCueSpectralDetect) {
          setSettingsStatus("Settings saved. All FFmpeg cue landmark filters are disabled, so cue timing will rely on source timings and spacing fallback.", true);
        } else {
          setSettingsStatus("Settings saved.");
        }
        await refreshTimeBasedUi();
      } catch (error) {
        setSettingsStatus(error.message, true);
      } finally {
        setButtonBusy(dom.saveSettingsBtn, false, "Save Settings");
      }
    }

    function bindEvents() {
      if (dom.pathFormatInput) {
        dom.pathFormatInput.addEventListener("input", renderPathFormatPreview);
      }
      if (dom.outputFormatSelect) {
        dom.outputFormatSelect.addEventListener("change", renderPathFormatPreview);
      }
      if (dom.pathFormatPresetsRow) {
        dom.pathFormatPresetsRow.addEventListener("click", (event) => {
          const presetBtn = event.target.closest("button[data-path-preset]");
          if (!presetBtn || !dom.pathFormatInput) {
            return;
          }
          dom.pathFormatInput.value = presetBtn.getAttribute("data-path-preset") || "";
          renderPathFormatPreview();
          setSettingsStatus("Preset applied. Click Save Settings to apply.");
        });
      }
      if (dom.chooseDownloadDirBtn) {
        dom.chooseDownloadDirBtn.addEventListener("click", async () => {
          if (!state.canPickDownloadDirectory) {
            setSettingsStatus("Folder picker is desktop-only. In Docker/web, type the path manually and click Save Settings.");
            return;
          }
          setButtonBusy(dom.chooseDownloadDirBtn, true, "Choose Folder", "Opening...");
          try {
            const chosen = await window.rteDownloader.pickDownloadDirectory();
            if (chosen) {
              dom.downloadDirInput.value = chosen;
              setActiveDownloadDir(chosen);
              setSettingsStatus("Folder selected. Click Save Settings to apply.");
            }
          } catch (error) {
            setSettingsStatus(error.message, true);
          } finally {
            setButtonBusy(dom.chooseDownloadDirBtn, false, "Choose Folder");
          }
        });
      }
      if (dom.saveSettingsBtn) {
        dom.saveSettingsBtn.addEventListener("click", () => {
          saveSettings().catch(() => {});
        });
      }
    }

    bindEvents();

    return {
      loadSettings,
      renderPathFormatPreview,
      updateDownloadDirPickerUi
    };
  }

  window.KimbleSettingsScreen = {
    create: createSettingsScreen
  };
})();
