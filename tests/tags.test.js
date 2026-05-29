const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

jest.mock("../src/lib/downloader", () => ({
  resolveBundledFfmpegDir: jest.fn(() => null)
}));

const mockSpawnSync = jest.fn();

jest.mock("node:child_process", () => ({
  spawnSync: (...args) => mockSpawnSync(...args)
}));

describe("applyId3Tags", () => {
  function syncsafe(buffer, offset) {
    return (
      ((buffer[offset] || 0) << 21)
      | ((buffer[offset + 1] || 0) << 14)
      | ((buffer[offset + 2] || 0) << 7)
      | (buffer[offset + 3] || 0)
    );
  }

  function readMp3ChapterTimes(filePath) {
    const bytes = fs.readFileSync(filePath);
    const majorVersion = bytes[3];
    const tagSize = syncsafe(bytes, 6);
    const rows = [];
    let offset = 10;
    while (offset + 10 <= 10 + tagSize) {
      const id = bytes.subarray(offset, offset + 4).toString("ascii");
      if (!/^[A-Z0-9]{4}$/.test(id)) {
        break;
      }
      const frameSize = majorVersion >= 4
        ? syncsafe(bytes, offset + 4)
        : bytes.readUInt32BE(offset + 4);
      if (!frameSize || offset + 10 + frameSize > 10 + tagSize) {
        break;
      }
      if (id === "CHAP") {
        const payload = bytes.subarray(offset + 10, offset + 10 + frameSize);
        const nulIndex = payload.indexOf(0);
        rows.push({
          start: payload.readUInt32BE(nulIndex + 1),
          end: payload.readUInt32BE(nulIndex + 5)
        });
      }
      offset += 10 + frameSize;
    }
    return rows;
  }

  let tempDir;
  let audioPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tags-test-"));
    audioPath = path.join(tempDir, "episode.mp3");
    fs.writeFileSync(audioPath, "fake-audio");
    mockSpawnSync.mockReset();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("embeds rich metadata and chapters into tagged audio files", async () => {
    mockSpawnSync.mockImplementation((command, args) => {
      if (String(command).includes("ffmpeg")) {
        const outPath = args[args.length - 1];
        fs.writeFileSync(outPath, "tagged-audio");
      }
      return { status: 0, stdout: "", stderr: "" };
    });

    let applyId3Tags;
    jest.isolateModules(() => {
      ({ applyId3Tags } = require("../src/lib/tags"));
    });

    const result = await applyId3Tags({
      audioPath,
      title: "Smoke Episode",
      programTitle: "Smoke Program",
      sourceType: "nts",
      publishedTime: "2026-03-17",
      sourceUrl: "https://www.nts.live/shows/smoke-show/episodes/smoke-episode",
      episodeUrl: "https://www.nts.live/shows/smoke-show/episodes/smoke-episode",
      description: "Smoke description",
      location: "London",
      hosts: ["DJ Smoke"],
      genres: ["House", "Soul"],
      chapters: [
        { title: "Track One", artist: "Artist One", startSeconds: 0 },
        { title: "Track Two", artist: "Artist Two", startSeconds: 120 }
      ],
      durationSeconds: 240
    });

    expect(result.ok).toBe(true);
    expect(result.chaptersEmbedded).toBe(true);
    expect(result.tracklistEmbedded).toBe(true);

    const ffmpegCall = mockSpawnSync.mock.calls.find((call) => String(call[0]).includes("ffmpeg"));
    expect(ffmpegCall).toBeTruthy();
    expect(ffmpegCall[1]).toEqual(expect.arrayContaining([
      "-f", "ffmetadata",
      "-map_metadata", "1",
      "-map_chapters", "1",
      "-metadata", "artist=DJ Smoke",
      "-metadata", "location=London"
    ]));
    expect(ffmpegCall[1]).toContain("tracklist=1. Artist One - Track One\n2. Artist Two - Track Two");

    const taggedBytes = fs.readFileSync(audioPath);
    expect(taggedBytes.subarray(0, 3).toString("ascii")).toBe("ID3");
    expect(taggedBytes.includes(Buffer.from("CHAP", "ascii"))).toBe(true);
    expect(taggedBytes.includes(Buffer.from("CTOC", "ascii"))).toBe(true);

    const chapterTimes = readMp3ChapterTimes(audioPath);
    expect(chapterTimes).toHaveLength(2);
    expect(chapterTimes[0]).toEqual(expect.objectContaining({ start: 0, end: 119999 }));
    expect(chapterTimes[1]).toEqual(expect.objectContaining({ start: 120000, end: 240000 }));
  });

  test("uses artist-prefixed chapter titles for mp4-family files", async () => {
    audioPath = path.join(tempDir, "episode.m4a");
    fs.writeFileSync(audioPath, "fake-audio");
    mockSpawnSync.mockImplementation((command, args) => {
      if (String(command).includes("ffmpeg")) {
        const metadataIndex = args.findIndex((arg) => arg === "-f");
        const metadataPath = metadataIndex >= 0 ? args[metadataIndex + 3] : "";
        if (metadataPath && fs.existsSync(metadataPath)) {
          const metadataText = fs.readFileSync(metadataPath, "utf8");
          expect(metadataText).toContain("title=Artist One - Track One");
          expect(metadataText).toContain("title=Artist Two - Track Two");
        }
        const outPath = args[args.length - 1];
        fs.writeFileSync(outPath, "tagged-audio");
      }
      return { status: 0, stdout: "", stderr: "" };
    });

    let applyId3Tags;
    jest.isolateModules(() => {
      ({ applyId3Tags } = require("../src/lib/tags"));
    });

    const result = await applyId3Tags({
      audioPath,
      title: "Smoke Episode",
      programTitle: "Smoke Program",
      sourceType: "rte",
      chapters: [
        { title: "Track One", artist: "Artist One", startSeconds: 0 },
        { title: "Track Two", artist: "Artist Two", startSeconds: 120 }
      ],
      durationSeconds: 240
    });

    expect(result.ok).toBe(true);
    expect(result.chaptersEmbedded).toBe(true);
  });

  test("smart tag cleanup strips duplicate program prefixes from episode titles", async () => {
    mockSpawnSync.mockImplementation((command, args) => {
      if (String(command).includes("ffmpeg")) {
        expect(args).toContain("title=Live from Dublin");
        const outPath = args[args.length - 1];
        fs.writeFileSync(outPath, "tagged-audio");
      }
      return { status: 0, stdout: "", stderr: "" };
    });

    let applyId3Tags;
    jest.isolateModules(() => {
      ({ applyId3Tags } = require("../src/lib/tags"));
    });

    const result = await applyId3Tags({
      audioPath,
      title: "Smoke Program - Smoke Program - Live from Dublin",
      programTitle: "Smoke Program",
      sourceType: "bbc",
      cleanupOptions: {
        smartCleanup: true
      }
    });

    expect(result.ok).toBe(true);
  });
});
