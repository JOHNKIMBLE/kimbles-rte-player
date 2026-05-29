const {
  isSsrfBlockedHostname,
  assertOutboundHttpUrl,
  assertUrlHostSuffixes,
  assertDiscordWebhookUrl,
  hostMatchesSuffix,
  hostMatchesAnySuffix
} = require("../src/lib/url-safety");
const { parseWwfScheduleJsonSlice } = require("../src/lib/wwf-schedule-json");

describe("url-safety", () => {
  test("isSsrfBlockedHostname flags loopback and RFC1918 literals", () => {
    expect(isSsrfBlockedHostname("127.0.0.1")).toBe(true);
    expect(isSsrfBlockedHostname("localhost")).toBe(true);
    expect(isSsrfBlockedHostname("10.0.0.1")).toBe(true);
    expect(isSsrfBlockedHostname("192.168.1.1")).toBe(true);
    expect(isSsrfBlockedHostname("169.254.169.254")).toBe(true);
    expect(isSsrfBlockedHostname("www.rte.ie")).toBe(false);
  });

  test("assertOutboundHttpUrl rejects non-http(s)", () => {
    expect(() => assertOutboundHttpUrl("file:///etc/passwd")).toThrow();
    expect(() => assertOutboundHttpUrl("javascript:alert(1)")).toThrow();
  });

  test("assertUrlHostSuffixes enforces suffix list", () => {
    expect(assertUrlHostSuffixes("https://www.bbc.co.uk/foo", ["bbc.co.uk"], "t")).toMatch(/^https:/);
    expect(() => assertUrlHostSuffixes("https://evil.com/x", ["bbc.co.uk"], "t")).toThrow();
  });

  test("assertDiscordWebhookUrl enforces discord host and path", () => {
    const ok = "https://discord.com/api/webhooks/123/abc";
    expect(assertDiscordWebhookUrl(ok)).toContain("discord.com");
    expect(() => assertDiscordWebhookUrl("https://evil.com/api/webhooks/1/2")).toThrow();
  });

  test("hostMatchesSuffix rejects substring tricks", () => {
    expect(hostMatchesSuffix("www.nts.live", "nts.live")).toBe(true);
    expect(hostMatchesSuffix("evilnts.live", "nts.live")).toBe(false);
    expect(hostMatchesSuffix("notrasset.ie", "rasset.ie")).toBe(false);
    expect(hostMatchesAnySuffix("www.bbc.co.uk", ["bbc.co.uk", "bbc.com"])).toBe(true);
    expect(hostMatchesAnySuffix("evilbbc.com", ["bbc.co.uk", "bbc.com"])).toBe(false);
  });

  test("parseWwfScheduleJsonSlice parses escaped schedule JSON", () => {
    const slice = JSON.stringify([{ show_key: "x" }]).replace(/"/g, '\\"');
    const arr = parseWwfScheduleJsonSlice(slice);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr[0]).toMatchObject({ show_key: "x" });
  });
});
