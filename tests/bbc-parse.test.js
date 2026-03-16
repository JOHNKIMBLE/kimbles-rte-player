/**
 * Unit tests for pure parsing functions in src/lib/bbc.js
 */
const { normalizeBbcUrl, normalizeBbcProgramUrl } = require("../src/lib/bbc");

describe("normalizeBbcUrl", () => {
  test("accepts a valid BBC URL", () => {
    const result = normalizeBbcUrl("https://www.bbc.co.uk/sounds/play/live:bbc_radio_one");
    expect(result).toContain("bbc.co.uk");
  });

  test("strips hash fragment", () => {
    const result = normalizeBbcUrl("https://www.bbc.co.uk/sounds/play/live:bbc_6music#section");
    expect(result).not.toContain("#");
  });

  test("throws for non-BBC URL", () => {
    expect(() => normalizeBbcUrl("https://example.com/path")).toThrow("BBC");
  });

  test("throws for invalid URL string", () => {
    expect(() => normalizeBbcUrl("not a url")).toThrow();
  });

  test("preserves path and query", () => {
    const result = normalizeBbcUrl("https://www.bbc.co.uk/programmes/b01cqx2b?page=2");
    expect(result).toContain("b01cqx2b");
    expect(result).toContain("page=2");
  });
});

describe("normalizeBbcProgramUrl", () => {
  test("normalizes /programmes/<pid> URL", () => {
    const result = normalizeBbcProgramUrl("https://www.bbc.co.uk/programmes/b01cqx2b");
    expect(result).toBe("https://www.bbc.co.uk/programmes/b01cqx2b");
  });

  test("normalizes /programmes/<pid>/episodes URL (strips extra path)", () => {
    const result = normalizeBbcProgramUrl("https://www.bbc.co.uk/programmes/b01cqx2b/episodes/player");
    expect(result).toBe("https://www.bbc.co.uk/programmes/b01cqx2b");
  });

  test("normalizes /sounds/brand/<id> URL to /programmes/<id>", () => {
    const result = normalizeBbcProgramUrl("https://www.bbc.co.uk/sounds/brand/b01cqx2b");
    expect(result).toBe("https://www.bbc.co.uk/programmes/b01cqx2b");
  });

  test("throws for non-BBC domain", () => {
    expect(() => normalizeBbcProgramUrl("https://example.com/programmes/b01cqx2b")).toThrow();
  });

  test("throws for BBC URL without /programmes/ or /sounds/brand/", () => {
    expect(() => normalizeBbcProgramUrl("https://www.bbc.co.uk/news/uk")).toThrow();
  });

  test("result is always https://www.bbc.co.uk/programmes/<id>", () => {
    const result = normalizeBbcProgramUrl("https://www.bbc.co.uk/programmes/b09abcde");
    expect(result).toMatch(/^https:\/\/www\.bbc\.co\.uk\/programmes\/[a-z0-9]+$/);
  });
});
