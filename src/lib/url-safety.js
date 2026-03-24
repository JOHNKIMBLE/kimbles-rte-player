/**
 * SSRF mitigation for server-side fetch(): block obvious internal/literal targets
 * and optionally require host suffix allowlists for source integrations.
 */

const net = require("node:net");

function normalizeHostname(hostname) {
  let h = String(hostname || "").trim().toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) {
    h = h.slice(1, -1);
  }
  return h;
}

/**
 * True if hostname is a literal IP or special name that must not be used for outbound hooks/CDN fetches.
 */
function isSsrfBlockedHostname(hostname) {
  const h = normalizeHostname(hostname);
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0" || h === "metadata.google.internal") return true;

  if (net.isIPv4(h)) {
    const parts = h.split(".").map((p) => Number(p));
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  if (net.isIPv6(h)) {
    const lower = h.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("ff")) return true;
    return false;
  }

  return false;
}

function parseHttpUrl(urlString) {
  const raw = String(urlString || "").trim();
  if (!raw) {
    throw new Error("URL is required.");
  }
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed.");
  }
  if (isSsrfBlockedHostname(u.hostname)) {
    throw new Error("That host is not allowed for outbound requests.");
  }
  return u;
}

/**
 * http(s) only, block literal private/loopback IPs and suspicious hostnames (covers artwork, tracklists, HLS).
 */
function assertOutboundHttpUrl(urlString, label = "URL") {
  try {
    return parseHttpUrl(urlString).toString();
  } catch (err) {
    const msg = err && err.message ? err.message : "Invalid URL";
    throw new Error(`${label}: ${msg}`, { cause: err });
  }
}

function hostMatchesSuffix(hostname, suffix) {
  const h = normalizeHostname(hostname);
  const s = String(suffix || "").toLowerCase().replace(/^\./, "");
  return h === s || h.endsWith(`.${s}`);
}

function hostMatchesAnySuffix(hostname, suffixes) {
  return (Array.isArray(suffixes) ? suffixes : []).some((suf) => hostMatchesSuffix(hostname, suf));
}

/**
 * Require hostname to match one of the allowed suffixes (e.g. "bbc.co.uk", "nts.live").
 */
function assertUrlHostSuffixes(urlString, suffixes, label = "URL") {
  const u = parseHttpUrl(urlString);
  const ok = (Array.isArray(suffixes) ? suffixes : []).some((suf) => hostMatchesSuffix(u.hostname, suf));
  if (!ok) {
    throw new Error(`${label}: host is not in the allowed list for this source.`);
  }
  return u.toString();
}

function assertDiscordWebhookUrl(raw) {
  const u = parseHttpUrl(raw);
  if (u.protocol !== "https:") {
    throw new Error("Discord webhooks must use HTTPS.");
  }
  const h = normalizeHostname(u.hostname);
  if (!hostMatchesSuffix(h, "discord.com") && !hostMatchesSuffix(h, "discordapp.com")) {
    throw new Error("Discord webhook URL must point to discord.com.");
  }
  if (!u.pathname.includes("/api/webhooks/")) {
    throw new Error("Discord webhook path must include /api/webhooks/.");
  }
  return u.toString();
}

function assertGenericNotificationWebhookUrl(raw) {
  const u = parseHttpUrl(raw);
  return u.toString();
}

function assertNtfyTopicUrl(raw) {
  const u = parseHttpUrl(raw);
  return u.toString();
}

/** After allowlist check, return canonical href for fetch (helps static analysis). */
function canonicalizeRteProxyTarget(inputUrl, isAllowedFn) {
  if (typeof isAllowedFn !== "function" || !isAllowedFn(inputUrl)) {
    throw new Error("Proxy target host is not allowed.");
  }
  return parseHttpUrl(inputUrl).toString();
}

/**
 * Outbound fetch with hostname allowlist (assert + fetch in one call for analyzers).
 */
async function fetchWithHostAllowlist(urlString, suffixes, label, init) {
  return fetch(assertUrlHostSuffixes(urlString, suffixes, label), init || {});
}

/**
 * Outbound fetch after outbound-http rules (CDN / tracklist / cover art).
 */
async function fetchWithOutboundAssert(urlString, label, init) {
  return fetch(assertOutboundHttpUrl(urlString, label), init || {});
}

async function fetchWithGenericWebhookAssert(urlString, init) {
  return fetch(assertGenericNotificationWebhookUrl(urlString), init || {});
}

function httpGetWithHostAllowlist(urlString, suffixes, label, headers) {
  const href = assertUrlHostSuffixes(urlString, suffixes, label);
  return new Promise((resolve, reject) => {
    const u = new URL(href);
    const mod = u.protocol === "https:" ? require("node:https") : require("node:http");
    const req = mod.get(href, { headers }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage || ""}`.trim()));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

module.exports = {
  isSsrfBlockedHostname,
  assertOutboundHttpUrl,
  assertUrlHostSuffixes,
  assertDiscordWebhookUrl,
  assertGenericNotificationWebhookUrl,
  assertNtfyTopicUrl,
  canonicalizeRteProxyTarget,
  hostMatchesSuffix,
  hostMatchesAnySuffix,
  fetchWithHostAllowlist,
  fetchWithOutboundAssert,
  fetchWithGenericWebhookAssert,
  httpGetWithHostAllowlist
};
