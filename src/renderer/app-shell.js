(function initKimbleAppShell() {
  function createAppShell(deps) {
    const state = deps.state;
    const dom = deps.dom || {};
    const escapeHtml = deps.escapeHtml;
    const setButtonBusy = deps.setButtonBusy;
    const setQuickStatus = deps.setQuickStatus;
    const setBbcStatus = deps.setBbcStatus;
    const setSettingsStatus = deps.setSettingsStatus;
    const shouldArmForceRetry = deps.shouldArmForceRetry;
    const formatCueAlignment = deps.formatCueAlignment;
    const formatProgressText = deps.formatProgressText;
    const createProgressToken = deps.createProgressToken;
    const attachDownloadProgress = deps.attachDownloadProgress;
    const setUrlParam = deps.setUrlParam;
    const applyTheme = deps.applyTheme;
    const getActiveDownloadDir = deps.getActiveDownloadDir;
    const renderPathFormatPreview = deps.renderPathFormatPreview;
    const updateDownloadDirPickerUi = deps.updateDownloadDirPickerUi;
    const clearGlobalNowPlaying = deps.clearGlobalNowPlaying;
    const actions = deps.actions || {};
    const documentRef = deps.documentRef || document;
    const windowRef = deps.windowRef || window;
    const localStorageRef = deps.localStorageRef || window.localStorage;

    let queueRefreshTimer = null;
    let scheduleRefreshTimer = null;
    let fipLiveInterval = null;
    let kexpLiveInterval = null;
    let healthDashboardTimer = null;

    function buildRteLivePlayerSrc(channelId, autoplay = false) {
      const clipId = encodeURIComponent(String(channelId || "").trim());
      if (!clipId) {
        return "";
      }
      return `https://www.rte.ie/bosco/components/player/iframe.html?radioUI=true&autostart=${autoplay ? "true" : "false"}&app_name=rnn&clipid=${clipId}`;
    }

    async function refreshLivePanel() {
      const selectedId = String(dom.stationSelect?.value || "").trim();
      if (!selectedId) {
        if (dom.liveNow) {
          dom.liveNow.textContent = "No RTÉ station selected.";
        }
        if (dom.livePlayerFrame) {
          dom.livePlayerFrame.src = "";
        }
        if (dom.liveOverlayPlayBtn) {
          dom.liveOverlayPlayBtn.classList.add("hidden");
          delete dom.liveOverlayPlayBtn.dataset.autoplaySrc;
        }
        return;
      }

      const station = (state.liveStations || []).find((item) => String(item.id) === selectedId);
      if (!station) {
        if (dom.liveNow) {
          dom.liveNow.textContent = "Station not found.";
        }
        if (dom.livePlayerFrame) {
          dom.livePlayerFrame.src = "";
        }
        if (dom.liveOverlayPlayBtn) {
          dom.liveOverlayPlayBtn.classList.add("hidden");
          delete dom.liveOverlayPlayBtn.dataset.autoplaySrc;
        }
        return;
      }

      const baseSrc = buildRteLivePlayerSrc(selectedId, false);
      const autoplaySrc = buildRteLivePlayerSrc(selectedId, true);
      let liveInfo = null;

      try {
        if (typeof windowRef.rteDownloader?.getLiveNow === "function") {
          liveInfo = await windowRef.rteDownloader.getLiveNow(selectedId);
        }
      } catch {}

      const stationName = String(liveInfo?.stationName || station.name || "RTE Radio").trim();
      const programmeName = String(liveInfo?.programmeName || "Live").trim();
      const description = String(liveInfo?.description || "").trim();
      if (dom.liveNow) {
        dom.liveNow.innerHTML = description
          ? `<strong>${escapeHtml(stationName)}</strong> - ${escapeHtml(programmeName)}<br><span class="muted">${escapeHtml(description)}</span>`
          : `<strong>${escapeHtml(stationName)}</strong> - ${escapeHtml(programmeName)}`;
      }
      if (dom.livePlayerFrame) {
        dom.livePlayerFrame.src = baseSrc;
      }
      if (dom.liveOverlayPlayBtn) {
        if (autoplaySrc) {
          dom.liveOverlayPlayBtn.dataset.autoplaySrc = autoplaySrc;
          dom.liveOverlayPlayBtn.classList.remove("hidden");
        } else {
          delete dom.liveOverlayPlayBtn.dataset.autoplaySrc;
          dom.liveOverlayPlayBtn.classList.add("hidden");
        }
      }
    }

    async function loadLiveStations() {
      state.liveStations = await windowRef.rteDownloader.getLiveStations();
      if (dom.stationSelect) {
        dom.stationSelect.innerHTML = state.liveStations
          .map((station) => `<option value="${escapeHtml(station.id)}">${escapeHtml(station.name)}</option>`)
          .join("");
      }
      await refreshLivePanel();
    }

    async function refreshTimeBasedUi() {
      await actions.refreshSchedules?.();
      await actions.refreshBbcSchedules?.();
      if (state.currentProgramUrl) {
        await actions.loadProgram?.(state.currentProgramUrl, state.currentProgramPage);
      }
      if (state.bbcProgramUrl) {
        await actions.loadBbcProgram?.(state.bbcProgramUrl, state.bbcProgramPage);
      }
    }

    function getExplorerSectionId(sourceType = "") {
      const key = String(sourceType || "").trim().toLowerCase();
      if (key === "bbc") return "bbcExplorerSection";
      if (key === "wwf") return "wwfExplorerSection";
      if (key === "nts") return "ntsExplorerSection";
      if (key === "fip") return "fipExplorerSection";
      if (key === "kexp") return "kexpExplorerSection";
      return "rteExplorerSection";
    }

    async function openProgramExplorer(target = {}) {
      const sourceType = String(target.sourceType || "rte").trim().toLowerCase();
      const programUrl = String(target.programUrl || "").trim();
      const page = Math.max(1, Number(target.page || 1) || 1);
      const useExtended = Boolean(target.useExtended);

      if (!programUrl) {
        throw new Error("Program URL is required.");
      }

      const tabName = ["bbc", "wwf", "nts", "fip", "kexp"].includes(sourceType) ? sourceType : "rte";
      setActiveTab(tabName);

      if (sourceType === "bbc") {
        await actions.loadBbcProgram?.(programUrl, page);
      } else if (sourceType === "wwf") {
        await actions.loadWwfProgram?.(programUrl, page);
      } else if (sourceType === "nts") {
        await actions.loadNtsProgram?.(programUrl, page);
      } else if (sourceType === "fip") {
        await actions.loadFipProgram?.(programUrl, page);
      } else if (sourceType === "kexp" && useExtended) {
        await actions.loadKexpExtendedProgram?.(programUrl, page);
      } else if (sourceType === "kexp") {
        await actions.loadKexpProgram?.(programUrl, page);
      } else {
        await actions.loadProgram?.(programUrl, page);
      }

      windowRef.requestAnimationFrame(() => {
        documentRef.getElementById(getExplorerSectionId(sourceType))?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    }

    function setActiveTab(tabName) {
      const valid = ["rte", "bbc", "wwf", "nts", "fip", "kexp", "schedules", "settings"];
      state.activeTab = valid.includes(tabName) ? tabName : "rte";
      if (["rte", "bbc", "wwf", "nts", "fip", "kexp"].includes(state.activeTab)) {
        state.lastSourceTab = state.activeTab;
      }

      const isRte = state.activeTab === "rte";
      const isBbc = state.activeTab === "bbc";
      const isWwf = state.activeTab === "wwf";
      const isNts = state.activeTab === "nts";
      const isFip = state.activeTab === "fip";
      const isKexp = state.activeTab === "kexp";
      const isSchedules = state.activeTab === "schedules";
      const isSettings = state.activeTab === "settings";

      dom.rteTabContent?.classList.toggle("hidden", !isRte);
      dom.bbcTabContent?.classList.toggle("hidden", !isBbc);
      dom.wwfTabContent?.classList.toggle("hidden", !isWwf);
      dom.ntsTabContent?.classList.toggle("hidden", !isNts);
      dom.fipTabContent?.classList.toggle("hidden", !isFip);
      dom.kexpTabContent?.classList.toggle("hidden", !isKexp);
      dom.schedulesTabContent?.classList.toggle("hidden", !isSchedules);
      dom.settingsTabContent?.classList.toggle("hidden", !isSettings);

      dom.tabRteBtn?.classList.toggle("active-tab", isRte);
      dom.tabBbcBtn?.classList.toggle("active-tab", isBbc);
      dom.tabWwfBtn?.classList.toggle("active-tab", isWwf);
      dom.tabNtsBtn?.classList.toggle("active-tab", isNts);
      dom.tabFipBtn?.classList.toggle("active-tab", isFip);
      dom.tabKexpBtn?.classList.toggle("active-tab", isKexp);
      dom.tabSchedulesBtn?.classList.toggle("active-tab", isSchedules);
      dom.tabSettingsBtn?.classList.toggle("active-tab", isSettings);

      if (isSchedules) {
        actions.renderAllSchedules?.().catch(() => {});
        actions.refreshLibraryData?.().catch(() => {});
        clearInterval(healthDashboardTimer);
        healthDashboardTimer = setInterval(() => actions.renderAllSchedules?.().catch(() => {}), 5 * 60 * 1000);
      } else {
        clearInterval(healthDashboardTimer);
        healthDashboardTimer = null;
      }

      if (isSettings) {
        actions.loadDiagnostics?.().catch(() => {});
      }

      if (isWwf) {
        if (dom.wwfStationSelect && state.wwfLiveStations.length === 0 && windowRef.rteDownloader?.getWwfLiveStations) {
          windowRef.rteDownloader.getWwfLiveStations().then((stations) => {
            state.wwfLiveStations = stations || [];
            if (dom.wwfStationSelect && state.wwfLiveStations.length) {
              dom.wwfStationSelect.innerHTML = state.wwfLiveStations.map((station) => `<option value="${escapeHtml(station.id)}">${escapeHtml(station.name)}</option>`).join("");
            }
          }).catch(() => {});
        }
        actions.refreshWwfLiveNow?.().catch(() => {});
        actions.renderWwfScheduleList?.().catch(() => {});
      }

      if (isNts) {
        if (dom.ntsStationSelect && state.ntsLiveStations.length === 0 && windowRef.rteDownloader?.getNtsLiveStations) {
          windowRef.rteDownloader.getNtsLiveStations().then((stations) => {
            state.ntsLiveStations = stations || [];
            if (dom.ntsStationSelect && state.ntsLiveStations.length) {
              dom.ntsStationSelect.innerHTML = state.ntsLiveStations.map((station) => {
                const streamUrl = String(station.streamUrl || "").trim();
                return `<option value="${escapeHtml(station.id)}"${streamUrl ? ` data-stream-url="${escapeHtml(streamUrl)}"` : ""}>${escapeHtml(station.name)}</option>`;
              }).join("");
              const firstWithStream = state.ntsLiveStations.find((station) => String(station.streamUrl || "").trim());
              if (firstWithStream && dom.ntsLiveAudio) {
                dom.ntsLiveAudio.src = firstWithStream.streamUrl || "";
              }
              actions.refreshNtsLiveNow?.().catch(() => {});
            }
          }).catch(() => {});
        } else if (dom.ntsStationSelect && state.ntsLiveStations.length > 0) {
          actions.refreshNtsLiveNow?.().catch(() => {});
        }
        actions.renderNtsScheduleList?.().catch(() => {});
      }

      if (isFip) {
        if (dom.fipStationSelect && state.fipLiveStations.length === 0 && windowRef.rteDownloader?.getFipLiveStations) {
          windowRef.rteDownloader.getFipLiveStations().then((stations) => {
            state.fipLiveStations = Array.isArray(stations) ? stations : [];
            if (dom.fipStationSelect && state.fipLiveStations.length) {
              dom.fipStationSelect.innerHTML = state.fipLiveStations.map((station) => {
                const streamUrl = String(station.streamUrl || "").trim();
                return `<option value="${escapeHtml(station.id)}"${streamUrl ? ` data-stream-url="${escapeHtml(streamUrl)}"` : ""}>${escapeHtml(station.name)}</option>`;
              }).join("");
              actions.refreshFipLiveNow?.().catch(() => {});
            }
          }).catch(() => {});
        } else if (dom.fipStationSelect && state.fipLiveStations.length > 0) {
          actions.refreshFipLiveNow?.().catch(() => {});
        }
        clearInterval(fipLiveInterval);
        fipLiveInterval = setInterval(() => {
          if (state.activeTab === "fip") {
            actions.refreshFipLiveNow?.().catch(() => {});
          } else {
            clearInterval(fipLiveInterval);
            fipLiveInterval = null;
          }
        }, 30000);
        actions.renderFipScheduleList?.().catch(() => {});
      } else {
        clearInterval(fipLiveInterval);
        fipLiveInterval = null;
      }

      if (isKexp) {
        actions.refreshKexpLiveNow?.().catch(() => {});
        clearInterval(kexpLiveInterval);
        kexpLiveInterval = setInterval(() => {
          if (state.activeTab === "kexp") {
            actions.refreshKexpLiveNow?.().catch(() => {});
          } else {
            clearInterval(kexpLiveInterval);
            kexpLiveInterval = null;
          }
        }, 30000);
        actions.renderKexpScheduleList?.().catch(() => {});
      } else {
        clearInterval(kexpLiveInterval);
        kexpLiveInterval = null;
      }

      if (dom.downloadDirInput) {
        dom.downloadDirInput.value = getActiveDownloadDir();
      }
      renderPathFormatPreview();
    }

    async function handleQuickDownload() {
      const pageUrl = String(dom.quickUrlInput?.value || "").trim();
      if (!pageUrl) {
        setQuickStatus("Enter an RTE episode URL.", true);
        return;
      }

      const forceDownload = dom.quickDownloadBtn?.dataset.forceNext === "1";
      if (forceDownload && dom.quickDownloadBtn) {
        delete dom.quickDownloadBtn.dataset.forceNext;
      }
      setButtonBusy(dom.quickDownloadBtn, true, "Download");
      if (dom.quickLog) {
        dom.quickLog.textContent = "";
      }
      setQuickStatus(forceDownload ? "Forcing re-download..." : "Resolving title and stream...");
      const progressToken = createProgressToken("quick");
      const detachProgress = attachDownloadProgress(progressToken, (progress) => {
        setQuickStatus(formatProgressText(progress, "Downloading..."));
      });

      try {
        const data = await windowRef.rteDownloader.downloadFromPageUrl(pageUrl, progressToken, { forceDownload });
        const cueText = data?.cue?.cuePath ? ` + CUE/chapters generated${formatCueAlignment(data.cue)}` : "";
        const statusPrefix = data?.existing ? "Already downloaded" : "Saved";
        const hintText = data?.existing ? " (click Download again to force re-download)" : "";
        setQuickStatus(`${statusPrefix}: ${data.outputDir}\\${data.fileName}${cueText}${hintText}`);
        if (dom.quickDownloadBtn) {
          if (data?.existing) {
            dom.quickDownloadBtn.dataset.forceNext = "1";
          } else {
            delete dom.quickDownloadBtn.dataset.forceNext;
          }
        }
        if (dom.quickLog) {
          dom.quickLog.textContent = data.log || "Done.";
        }
      } catch (error) {
        if (dom.quickDownloadBtn && shouldArmForceRetry(error?.message)) {
          dom.quickDownloadBtn.dataset.forceNext = "1";
        }
        setQuickStatus(error.message, true);
      } finally {
        detachProgress();
        setButtonBusy(dom.quickDownloadBtn, false, "Download");
      }
    }

    function bindEvents() {
      dom.quickDownloadBtn?.addEventListener("click", () => {
        handleQuickDownload().catch(() => {});
      });
      dom.quickUrlInput?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        if (!dom.quickDownloadBtn?.disabled) {
          dom.quickDownloadBtn.click();
        }
      });

      dom.stationSelect?.addEventListener("change", () => {
        refreshLivePanel().catch((error) => {
          if (dom.liveNow) {
            dom.liveNow.textContent = error.message;
          }
        });
      });
      dom.refreshLiveBtn?.addEventListener("click", () => {
        setButtonBusy(dom.refreshLiveBtn, true, "Refresh");
        refreshLivePanel()
          .catch((error) => {
            if (dom.liveNow) {
              dom.liveNow.textContent = error.message;
            }
          })
          .finally(() => {
            setButtonBusy(dom.refreshLiveBtn, false, "Refresh");
          });
      });

      dom.liveOverlayPlayBtn?.addEventListener("click", () => {
        const rawSrc = dom.liveOverlayPlayBtn.dataset.autoplaySrc || "";
        if (!rawSrc || !dom.livePlayerFrame) {
          return;
        }
        dom.livePlayerFrame.src = setUrlParam(rawSrc, "_ts", String(Date.now()));
        dom.liveOverlayPlayBtn.classList.add("hidden");
      });

      documentRef.addEventListener("click", (event) => {
        if (event.target.closest(".search-box")) {
          return;
        }
        actions.hideSearchDropdown?.();
        actions.hideBbcSearchDropdown?.();
      });

      dom.tabRteBtn?.addEventListener("click", () => setActiveTab("rte"));
      dom.tabBbcBtn?.addEventListener("click", () => setActiveTab("bbc"));
      dom.tabWwfBtn?.addEventListener("click", () => setActiveTab("wwf"));
      dom.tabNtsBtn?.addEventListener("click", () => setActiveTab("nts"));
      dom.tabFipBtn?.addEventListener("click", () => setActiveTab("fip"));
      dom.tabKexpBtn?.addEventListener("click", () => setActiveTab("kexp"));
      dom.tabSchedulesBtn?.addEventListener("click", () => setActiveTab("schedules"));
      dom.tabSettingsBtn?.addEventListener("click", () => setActiveTab("settings"));

      dom.themeToggleBtn?.addEventListener("click", () => {
        applyTheme(state.theme === "dark" ? "light" : "dark");
      });

      dom.scheduleBackfillMode?.addEventListener("change", () => {
        const isBackfill = dom.scheduleBackfillMode.value === "backfill";
        if (dom.scheduleBackfillCount) {
          dom.scheduleBackfillCount.disabled = !isBackfill;
        }
      });
    }

    async function bootstrap() {
      try {
        const savedTheme = localStorageRef.getItem("kimble_theme") || "dark";
        applyTheme(savedTheme);
        clearGlobalNowPlaying();
        try {
          state.canPickDownloadDirectory = Boolean(await windowRef.rteDownloader.canPickDownloadDirectory());
        } catch {
          state.canPickDownloadDirectory = false;
        }
        updateDownloadDirPickerUi();
        setActiveTab("rte");
        if (dom.scheduleBackfillCount) {
          dom.scheduleBackfillCount.disabled = true;
        }
        if (dom.bbcScheduleBackfillCount) {
          dom.bbcScheduleBackfillCount.disabled = true;
        }
        await actions.loadSettings?.();
        if (typeof windowRef.rteDownloader?.connectGlobalEvents === "function") {
          if ("Notification" in windowRef) {
            windowRef.Notification.requestPermission().catch(() => {});
          }
          windowRef.rteDownloader.connectGlobalEvents((payload) => {
            if (payload?.type === "episode.downloaded" && "Notification" in windowRef && windowRef.Notification.permission === "granted") {
              try {
                new windowRef.Notification(`New episode: ${payload.title || ""}`, {
                  body: payload.episodeTitle || `${(payload.source || "").toUpperCase()} download complete`
                });
              } catch {}
            }
            if (payload?.type === "download.history.updated" || payload?.type === "download.history.cleared") {
              actions.loadHistory?.().catch(() => {});
            }
            if (payload?.type === "feeds.updated") {
              actions.loadFeeds?.().catch(() => {});
            }
            if (payload?.type === "download.error" && state.activeTab === "settings") {
              actions.loadDiagnostics?.().catch(() => {});
            }
            if (payload?.type === "download.queue.restored") {
              actions.refreshDownloadQueueSnapshot?.().catch(() => {});
            }
          });
        }

        await Promise.all([
          loadLiveStations(),
          actions.loadBbcLiveStations?.(),
          actions.refreshSchedules?.(),
          actions.refreshBbcSchedules?.()
        ]);
        await actions.refreshDownloadQueueSnapshot?.();

        clearInterval(queueRefreshTimer);
        queueRefreshTimer = setInterval(() => {
          actions.refreshDownloadQueueSnapshot?.().catch(() => {});
        }, 1500);

        clearInterval(scheduleRefreshTimer);
        scheduleRefreshTimer = setInterval(() => {
          Promise.all([
            actions.refreshSchedules?.(),
            actions.refreshBbcSchedules?.()
          ]).catch(() => {});
        }, 5000);

        setSettingsStatus("Loaded.");
        setQuickStatus("Ready");
        setBbcStatus("Ready");
      } catch (error) {
        setQuickStatus(error.message, true);
        setBbcStatus(error.message, true);
        setSettingsStatus(error.message, true);
      }
    }

    return {
      bindEvents,
      bootstrap,
      openProgramExplorer,
      refreshTimeBasedUi,
      setActiveTab
    };
  }

  window.KimbleAppShell = {
    create: createAppShell
  };
})();
