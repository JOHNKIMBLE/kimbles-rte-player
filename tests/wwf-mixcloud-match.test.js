/**
 * Unit tests for WWF → Mixcloud channel resolution (src/lib/worldwidefm.js).
 * WWF stopped embedding Mixcloud links in episode pages, so the real cloudcast is
 * resolved by matching the Mixcloud channel listing on broadcast date + title.
 */
const {
  pickBestMixcloudMatch,
  mixcloudDateTokens
} = require("../src/lib/worldwidefm");

// Realistic sample of the WWF Mixcloud channel listing (subset of api.mixcloud.com).
const CLOUDCASTS = [
  {
    key: "/worldwidefm/live-from-s%C3%A8te-gilles-peterson-w-brownswood-20th-david-walters-live-session-02-07-26/",
    slug: "live-from-sète-gilles-peterson-w-brownswood-20th-david-walters-live-session-02-07-26",
    name: "Live from Sète: Gilles Peterson w/ Brownswood 20th & David Walters (Live Session) // 02-07-26",
    url: "https://www.mixcloud.com/worldwidefm/live-from-s%C3%A8te-gilles-peterson-w-brownswood-20th-david-walters-live-session-02-07-26/",
    createdTime: "2026-07-02T14:27:21Z"
  },
  {
    key: "/worldwidefm/mellow-madness-cl%C3%A9mentine-04-06-26/",
    slug: "mellow-madness-clémentine-04-06-26",
    name: "Mellow Madness: Clémentine // 04-06-26",
    url: "https://www.mixcloud.com/worldwidefm/mellow-madness-cl%C3%A9mentine-04-06-26/",
    createdTime: "2026-06-04T15:00:00Z"
  },
  {
    key: "/worldwidefm/we-out-here-2026-it-takes-a-village-w-sampa-the-great-26-06-26/",
    slug: "we-out-here-2026-it-takes-a-village-w-sampa-the-great-26-06-26",
    name: "We Out Here 2026: It Takes A Village w/ Sampa The Great // 26-06-26",
    url: "https://www.mixcloud.com/worldwidefm/we-out-here-2026-it-takes-a-village-w-sampa-the-great-26-06-26/",
    createdTime: "2026-06-26T12:00:00Z"
  }
];

describe("mixcloudDateTokens", () => {
  test("returns 2-digit and 4-digit DD-MM tokens", () => {
    expect(mixcloudDateTokens("2026-07-02")).toEqual(["02-07-26", "02-07-2026"]);
  });
  test("returns [] for a non-date", () => {
    expect(mixcloudDateTokens("not-a-date")).toEqual([]);
  });
});

describe("pickBestMixcloudMatch", () => {
  test("matches on broadcast-date slug token + title, ignoring accents and extra descriptors", () => {
    const episode = {
      slug: "live-from-sete-gilles-peterson-02-07-2026",
      publishedTime: "2026-07-02",
      showName: "Live from Sète",
      episodeName: "Gilles Peterson",
      fullTitle: "Live from Sète: Gilles Peterson"
    };
    const match = pickBestMixcloudMatch(episode, CLOUDCASTS);
    expect(match).toBeTruthy();
    expect(match.slug).toContain("gilles-peterson");
  });

  test("returns null when the episode is not yet mirrored (upload lag), even if another show aired the same day", () => {
    // Mellow Madness aired 2026-07-02 but the Mixcloud upload for that date is a
    // different show (Gilles Peterson). Must NOT return the wrong show.
    const episode = {
      slug: "mellow-madness-clementine-02-07-2026",
      publishedTime: "2026-07-02",
      showName: "Mellow Madness",
      episodeName: "Clémentine",
      fullTitle: "Mellow Madness: Clémentine"
    };
    expect(pickBestMixcloudMatch(episode, CLOUDCASTS)).toBeNull();
  });

  test("does not confuse a different guest of the same recurring show on a different date", () => {
    // "We Out Here ... w/ Mr Disco Kid" (02-07) is absent; the channel only has the
    // Sampa The Great edition (26-06). Different date + different guest → no match.
    const episode = {
      slug: "we-out-here-2026-it-takes-a-village-w-mr-disco-kid-02-07-2026",
      publishedTime: "2026-07-02",
      showName: "We Out Here 2026",
      episodeName: "It Takes A Village w/ Mr Disco Kid",
      fullTitle: "We Out Here 2026: It Takes A Village w/ Mr Disco Kid"
    };
    expect(pickBestMixcloudMatch(episode, CLOUDCASTS)).toBeNull();
  });

  test("matches a recurring show when the correct dated edition exists", () => {
    const episode = {
      slug: "mellow-madness-clementine-04-06-2026",
      publishedTime: "2026-06-04",
      showName: "Mellow Madness",
      episodeName: "Clémentine",
      fullTitle: "Mellow Madness: Clémentine"
    };
    const match = pickBestMixcloudMatch(episode, CLOUDCASTS);
    expect(match).toBeTruthy();
    expect(match.slug).toBe("mellow-madness-clémentine-04-06-26");
  });

  test("returns null for empty channel listing", () => {
    expect(pickBestMixcloudMatch({ slug: "x-01-01-2026", publishedTime: "2026-01-01" }, [])).toBeNull();
  });
});
