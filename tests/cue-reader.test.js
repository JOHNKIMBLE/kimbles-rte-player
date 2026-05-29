const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { readCueChaptersForAudio } = require("../src/lib/cue-reader");

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cue-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeCue(fileName, content) {
  fs.writeFileSync(path.join(tmpDir, `${fileName}.cue`), content, "utf8");
}

describe("readCueChaptersForAudio", () => {
  test("parses a standard CUE file", () => {
    writeCue("episode", `TITLE "My Episode"
FILE "episode.mp3" MP3
  TRACK 01 AUDIO
    TITLE "Intro"
    PERFORMER "DJ Host"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "First Song"
    PERFORMER "Artist One"
    INDEX 01 05:30:00
  TRACK 03 AUDIO
    TITLE "Second Song"
    PERFORMER "Artist Two"
    INDEX 01 10:15:50
`);

    const chapters = readCueChaptersForAudio(tmpDir, "episode");
    expect(chapters).toHaveLength(3);

    expect(chapters[0].title).toBe("Intro");
    expect(chapters[0].artist).toBe("DJ Host");
    expect(chapters[0].startSeconds).toBe(0);
    expect(chapters[0].start).toBe("00:00");

    expect(chapters[1].title).toBe("First Song");
    expect(chapters[1].artist).toBe("Artist One");
    expect(chapters[1].startSeconds).toBe(5 * 60 + 30); // 330s
    expect(chapters[1].start).toBe("05:30");

    expect(chapters[2].title).toBe("Second Song");
    expect(chapters[2].startSeconds).toBeCloseTo(10 * 60 + 15 + 50 / 75, 1);
  });

  test("sorts chapters by start time", () => {
    writeCue("episode", `FILE "episode.mp3" MP3
  TRACK 01 AUDIO
    TITLE "Later"
    INDEX 01 10:00:00
  TRACK 02 AUDIO
    TITLE "Earlier"
    INDEX 01 02:00:00
`);

    const chapters = readCueChaptersForAudio(tmpDir, "episode");
    expect(chapters[0].title).toBe("Earlier");
    expect(chapters[1].title).toBe("Later");
  });

  test("skips tracks without titles", () => {
    writeCue("episode", `FILE "episode.mp3" MP3
  TRACK 01 AUDIO
    TITLE "Has Title"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    INDEX 01 05:00:00
`);

    const chapters = readCueChaptersForAudio(tmpDir, "episode");
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("Has Title");
  });

  test("returns empty array when no CUE file exists", () => {
    const chapters = readCueChaptersForAudio(tmpDir, "nonexistent");
    expect(chapters).toEqual([]);
  });

  test("returns empty for empty dir/fileName", () => {
    expect(readCueChaptersForAudio("", "")).toEqual([]);
    expect(readCueChaptersForAudio(null, null)).toEqual([]);
  });

  test("handles CUE with no TRACK entries", () => {
    writeCue("episode", `TITLE "Empty Show"
FILE "episode.mp3" MP3
`);
    const chapters = readCueChaptersForAudio(tmpDir, "episode");
    expect(chapters).toEqual([]);
  });

  test("handles hour+ timestamps", () => {
    writeCue("episode", `FILE "episode.mp3" MP3
  TRACK 01 AUDIO
    TITLE "Hour Mark"
    INDEX 01 60:00:00
`);
    const chapters = readCueChaptersForAudio(tmpDir, "episode");
    expect(chapters[0].startSeconds).toBe(3600);
    expect(chapters[0].start).toBe("01:00:00");
  });

  test("handles performer without title (filtered out)", () => {
    writeCue("episode", `FILE "episode.mp3" MP3
  TRACK 01 AUDIO
    PERFORMER "Solo Artist"
    INDEX 01 00:00:00
`);
    const chapters = readCueChaptersForAudio(tmpDir, "episode");
    expect(chapters).toEqual([]);
  });

  test("handles Windows-style line endings", () => {
    writeCue("episode", "FILE \"episode.mp3\" MP3\r\n  TRACK 01 AUDIO\r\n    TITLE \"CRLF Track\"\r\n    INDEX 01 00:00:00\r\n");
    const chapters = readCueChaptersForAudio(tmpDir, "episode");
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("CRLF Track");
  });
});
