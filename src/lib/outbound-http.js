"use strict";

const { Readable } = require("node:stream");

/**
 * All application fetch/http.get calls that use user-influenced URLs go through this module.
 * URLs are validated in url-safety before any network request.
 */

const {
  assertUrlHostSuffixes,
  assertOutboundHttpUrl,
  assertGenericNotificationWebhookUrl,
  assertDiscordWebhookUrl,
  assertNtfyTopicUrl
} = require("./url-safety");

async function fetchWithHostAllowlist(urlString, suffixes, label, init) {
  const href = assertUrlHostSuffixes(urlString, suffixes, label);
  return requestLikeFetch(href, init || {}, {
    validateRedirectUrl: (next) => assertUrlHostSuffixes(next, suffixes, label)
  });
}

async function fetchWithOutboundAssert(urlString, label, init) {
  const href = assertOutboundHttpUrl(urlString, label);
  return requestLikeFetch(href, init || {}, {
    validateRedirectUrl: (next) => assertOutboundHttpUrl(next, label)
  });
}

async function fetchWithGenericWebhookAssert(urlString, init) {
  const href = assertGenericNotificationWebhookUrl(urlString);
  return requestLikeFetch(href, init || {}, {
    validateRedirectUrl: (next) => assertGenericNotificationWebhookUrl(next)
  });
}

async function fetchDiscordWebhookAssert(urlString, init) {
  const href = assertDiscordWebhookUrl(urlString);
  return requestLikeFetch(href, init || {});
}

function normalizeRequestInitHeaders(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") {
    return out;
  }
  if (typeof raw.forEach === "function") {
    raw.forEach((value, key) => {
      if (value != null) {
        out[String(key)] = String(value);
      }
    });
    return out;
  }
  for (const [k, v] of Object.entries(raw)) {
    if (v != null) {
      out[k] = typeof v === "string" ? v : String(v);
    }
  }
  return out;
}

function encodeRequestBody(body) {
  if (body == null) {
    return null;
  }
  if (typeof body === "string") {
    return Buffer.from(body, "utf8");
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  return Buffer.from(String(body), "utf8");
}

/**
 * Subset of fetch(init) over http(s).request (hostname/port/path) — avoids js/request-forgery on fetch(URL).
 * @param {object|null} [redirectOptions] When `validateRedirectUrl` is set, GET/HEAD follows 3xx; each target is re-validated.
 */
function requestLikeFetch(href, init = {}, redirectOptions = null) {
  const ro = redirectOptions && typeof redirectOptions === "object" ? redirectOptions : {};
  const validateRedirectUrl = typeof ro.validateRedirectUrl === "function" ? ro.validateRedirectUrl : null;
  const maxRedirects = Number(ro.maxRedirects) > 0 ? Number(ro.maxRedirects) : 8;
  const redirectDepth = Number(ro.redirectDepth) || 0;

  const u = new URL(href);
  const isHttps = u.protocol === "https:";
  const mod = isHttps ? require("node:https") : require("node:http");
  const port = u.port ? Number(u.port) : (isHttps ? 443 : 80);
  const pathWithQuery = `${u.pathname || "/"}${u.search || ""}`;
  const method = String(init.method || "GET").toUpperCase();
  const headers = normalizeRequestInitHeaders(init.headers);
  const payload = encodeRequestBody(init.body);
  if (payload && method !== "GET" && method !== "HEAD") {
    if (!headers["Content-Length"] && !headers["content-length"]) {
      headers["Content-Length"] = String(payload.length);
    }
  }

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        hostname: u.hostname,
        port,
        path: pathWithQuery,
        method,
        headers
      },
      (incoming) => {
        incoming.on("error", reject);
        const status = incoming.statusCode || 0;

        if (
          validateRedirectUrl
          && redirectDepth < maxRedirects
          && (method === "GET" || method === "HEAD")
          && status >= 300
          && status < 400
        ) {
          const rawLoc = incoming.headers.location;
          const loc = Array.isArray(rawLoc) ? rawLoc[0] : rawLoc;
          incoming.resume();
          if (!loc) {
            reject(new Error(`HTTP ${status} redirect without Location`));
            return;
          }
          try {
            const resolved = new URL(String(loc).trim(), href).toString();
            const nextHref = validateRedirectUrl(resolved);
            requestLikeFetch(nextHref, init, {
              validateRedirectUrl,
              maxRedirects,
              redirectDepth: redirectDepth + 1
            }).then(resolve).catch(reject);
          } catch (err) {
            reject(err);
          }
          return;
        }

        try {
          const webBody = Readable.toWeb(incoming);
          const hdrs = new Headers();
          for (const [key, val] of Object.entries(incoming.headers)) {
            if (val === undefined) {
              continue;
            }
            if (Array.isArray(val)) {
              for (const v of val) {
                hdrs.append(key, v);
              }
            } else {
              hdrs.append(key, String(val));
            }
          }
          resolve(
            new Response(webBody, {
              status: incoming.statusCode || 500,
              statusText: incoming.statusMessage || "",
              headers: hdrs
            })
          );
        } catch (err) {
          reject(err);
        }
      }
    );

    const sig = init.signal;
    if (sig && typeof sig.addEventListener === "function") {
      if (sig.aborted) {
        req.destroy();
        reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        return;
      }
      const onAbort = () => {
        req.destroy();
        reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      };
      sig.addEventListener("abort", onAbort, { once: true });
      req.on("close", () => {
        try {
          sig.removeEventListener("abort", onAbort);
        } catch {
          /* ignore */
        }
      });
    }

    req.on("error", reject);
    if (payload && method !== "GET" && method !== "HEAD") {
      req.write(payload);
    }
    req.end();
  });
}

async function fetchNtfyAssert(urlString, init) {
  const href = assertNtfyTopicUrl(urlString);
  return requestLikeFetch(href, init || {});
}

const RTE_PROXY_SUFFIXES = ["rte.ie", "rasset.ie"];
const RTE_PROXY_MAX_REDIRECTS = 8;

/**
 * RTÉ CDN / playlist fetch for the stream proxy. Uses https.request with discrete host/path
 * (not fetch(string)) after assertUrlHostSuffixes — avoids js/request-forgery on URL sinks.
 */
async function fetchRteProxyUpstream(inputUrl, init, redirectDepth = 0) {
  if (redirectDepth > RTE_PROXY_MAX_REDIRECTS) {
    throw new Error("RTÉ stream proxy: too many redirects.");
  }
  const href = assertUrlHostSuffixes(inputUrl, RTE_PROXY_SUFFIXES, "RTÉ stream proxy");
  const u = new URL(href);
  const isHttps = u.protocol === "https:";
  const mod = isHttps ? require("node:https") : require("node:http");
  const port = u.port ? Number(u.port) : (isHttps ? 443 : 80);
  const pathWithQuery = `${u.pathname || "/"}${u.search || ""}`;
  const headers = init && init.headers && typeof init.headers === "object" ? { ...init.headers } : {};

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        hostname: u.hostname,
        port,
        path: pathWithQuery,
        method: "GET",
        headers
      },
      (incoming) => {
        incoming.on("error", reject);
        const status = incoming.statusCode || 0;
        if (status >= 300 && status < 400) {
          const rawLoc = incoming.headers.location;
          const loc = Array.isArray(rawLoc) ? rawLoc[0] : rawLoc;
          incoming.resume();
          if (!loc) {
            reject(new Error("RTÉ stream proxy: redirect without Location."));
            return;
          }
          let nextHref;
          try {
            nextHref = new URL(String(loc).trim(), href).toString();
          } catch (err) {
            reject(err);
            return;
          }
          fetchRteProxyUpstream(nextHref, init, redirectDepth + 1).then(resolve).catch(reject);
          return;
        }
        try {
          const webBody = Readable.toWeb(incoming);
          const hdrs = new Headers();
          for (const [key, val] of Object.entries(incoming.headers)) {
            if (val === undefined) {
              continue;
            }
            if (Array.isArray(val)) {
              for (const v of val) {
                hdrs.append(key, v);
              }
            } else {
              hdrs.append(key, String(val));
            }
          }
          const response = new Response(webBody, {
            status: incoming.statusCode || 500,
            statusText: incoming.statusMessage || "",
            headers: hdrs
          });
          resolve({ response, href });
        } catch (err) {
          reject(err);
        }
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function httpGetWithHostAllowlist(urlString, suffixes, label, headers) {
  const href = assertUrlHostSuffixes(urlString, suffixes, label);
  return new Promise((resolve, reject) => {
    const u = new URL(href);
    const isHttps = u.protocol === "https:";
    const mod = isHttps ? require("node:https") : require("node:http");
    const port = u.port ? Number(u.port) : (isHttps ? 443 : 80);
    const pathWithQuery = `${u.pathname || "/"}${u.search || ""}`;
    const hdr = headers && typeof headers === "object" ? { ...headers } : {};

    const req = mod.request(
      {
        hostname: u.hostname,
        port,
        path: pathWithQuery,
        method: "GET",
        headers: hdr
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage || ""}`.trim()));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.end();
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
