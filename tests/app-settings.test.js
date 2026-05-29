const {
  createDefaultSettings,
  normalizeSettings,
  shouldGenerateEmbeddedChapters,
  shouldWriteCueSidecar
} = require("../src/lib/app-settings");

describe("app settings chapter behavior", () => {
  test("defaults keep cue sidecar separate from embedded chapters", () => {
    const settings = createDefaultSettings("C:\\Downloads");

    expect(settings.cueAutoGenerate).toBe(false);
    expect(settings.id3Tagging).toBe(true);
    expect(shouldWriteCueSidecar(settings)).toBe(false);
    expect(shouldGenerateEmbeddedChapters(settings)).toBe(true);
  });

  test("normalized settings preserve explicit cue sidecar preference", () => {
    const settings = normalizeSettings({
      cueAutoGenerate: true,
      id3Tagging: false
    }, {
      defaultDownloadDir: "C:\\Downloads"
    });

    expect(shouldWriteCueSidecar(settings)).toBe(true);
    expect(shouldGenerateEmbeddedChapters(settings)).toBe(false);
  });

  test("force mode enables both cue generation paths", () => {
    const settings = normalizeSettings({
      cueAutoGenerate: false,
      id3Tagging: false
    }, {
      defaultDownloadDir: "C:\\Downloads"
    });

    expect(shouldWriteCueSidecar(settings, { force: true })).toBe(true);
    expect(shouldGenerateEmbeddedChapters(settings, { force: true })).toBe(true);
  });

  test("normalizes download rules and smart tag cleanup defaults", () => {
    const settings = normalizeSettings({
      downloadKeepLatest: 999,
      downloadDeleteOlderDays: -12,
      skipReruns: 1,
      smartTagCleanup: 0
    }, {
      defaultDownloadDir: "C:\\Downloads"
    });

    expect(settings.downloadKeepLatest).toBe(500);
    expect(settings.downloadDeleteOlderDays).toBe(0);
    expect(settings.skipReruns).toBe(true);
    expect(settings.smartTagCleanup).toBe(false);
  });

  test("normalizes notification targets and per-program rules", () => {
    const settings = normalizeSettings({
      discordWebhookUrl: " https://discord.test/hook ",
      ntfyTopicUrl: " https://ntfy.sh/topic ",
      perProgramRules: [{
        sourceType: "NTS",
        programTitle: " The Breakfast Show ",
        outputDir: " /downloads/Breakfast ",
        pathFormat: " {radio}/{host}/{episode} ",
        downloadKeepLatest: 12,
        downloadDeleteOlderDays: 30,
        skipReruns: 1
      }]
    }, {
      defaultDownloadDir: "C:\\Downloads"
    });

    expect(settings.discordWebhookUrl).toBe("https://discord.test/hook");
    expect(settings.ntfyTopicUrl).toBe("https://ntfy.sh/topic");
    expect(settings.perProgramRules).toEqual([
      expect.objectContaining({
        sourceType: "nts",
        programTitle: "The Breakfast Show",
        outputDir: "/downloads/Breakfast",
        pathFormat: "{radio}/{host}/{episode}",
        downloadKeepLatest: 12,
        downloadDeleteOlderDays: 30,
        skipReruns: true,
        enabled: true
      })
    ]);
  });
});
