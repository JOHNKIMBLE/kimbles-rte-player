"use strict";

/**
 * All application fetch/http.get calls that use user-influenced URLs go through this module.
 * URLs are validated in url-safety before any network request.
 */

const {
  assertUrlHostSuffixes,
  assertOutboundHttpUrl,
  assertGenericNotificationWebhookUrl,
  assertDiscordWebhookUrl,
  assertNtfyTopicUrl,
  canonicalizeRteProxyTarget
} = require("./url-safety");

async function fetchWithHostAllowlist(urlString, suffixes, label, init) {
  const href = assertUrlHostSuffixes(urlString, suffixes, label);
  // lgtm[js/request-forgery] -- href produced only after assertUrlHostSuffixes allowlist + SSRF blocks
  return fetch(href, init || {});
}

async function fetchWithOutboundAssert(urlString, label, init) {
  const href = assertOutboundHttpUrl(urlString, label);
  // lgtm[js/request-forgery] -- href produced only after assertOutboundHttpUrl
  return fetch(href, init || {});
}

async function fetchWithGenericWebhookAssert(urlString, init) {
  const href = assertGenericNotificationWebhookUrl(urlString);
  // lgtm[js/request-forgery] -- href produced only after assertGenericNotificationWebhookUrl
  return fetch(href, init || {});
}

async function fetchDiscordWebhookAssert(urlString, init) {
  const href = assertDiscordWebhookUrl(urlString);
  // lgtm[js/request-forgery]
  return fetch(href, init || {});
}

async function fetchNtfyAssert(urlString, init) {
  const href = assertNtfyTopicUrl(urlString);
  // lgtm[js/request-forgery]
  return fetch(href, init || {});
}

async function fetchRteProxyUpstream(inputUrl, isAllowedFn, init) {
  const href = canonicalizeRteProxyTarget(inputUrl, isAllowedFn);
  // lgtm[js/request-forgery] -- href from canonicalizeRteProxyTarget + isAllowedFn
  const response = await fetch(href, init || {});
  return { response, href };
}

function httpGetWithHostAllowlist(urlString, suffixes, label, headers) {
  const href = assertUrlHostSuffixes(urlString, suffixes, label);
  return new Promise((resolve, reject) => {
    const u = new URL(href);
    const mod = u.protocol === "https:" ? require("node:https") : require("node:http");
    // lgtm[js/request-forgery] -- href produced only after assertUrlHostSuffixes
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
  fetchWithHostAllowlist,
  fetchWithOutboundAssert,
  fetchWithGenericWebhookAssert,
  fetchDiscordWebhookAssert,
  fetchNtfyAssert,
  /** @returns {{ response: Response, href: string }} */
  fetchRteProxyUpstream,
  httpGetWithHostAllowlist
};
