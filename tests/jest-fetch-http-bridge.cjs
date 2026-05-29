/**
 * Tests mock global.fetch with plain objects { ok, text(), json() } without arrayBuffer/status.
 * Outbound code uses https.request via requestLikeFetch; this bridge forwards https.request to
 * global.fetch when fetch is a Jest mock. Only https.request is patched so supertest/http (local
 * server) keeps the real implementation.
 */
const https = require("node:https");
const { Readable } = require("node:stream");

function buildHrefFromRequestOptions(options) {
  const defaultPort = 443;
  const hostname = String(options.hostname || "");
  const port = Number(options.port) || defaultPort;
  const pathPart = options.path || "/";
  const auth = options.auth ? `${options.auth}@` : "";
  const portSeg = port === defaultPort ? "" : `:${port}`;
  return `https://${auth}${hostname}${portSeg}${pathPart}`;
}

async function bodyBufferFromFetchResponse(res) {
  if (!res) {
    return Buffer.alloc(0);
  }
  try {
    if (typeof res.arrayBuffer === "function") {
      return Buffer.from(await res.arrayBuffer());
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof res.text === "function") {
      return Buffer.from(await res.text(), "utf8");
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof res.json === "function") {
      return Buffer.from(JSON.stringify(await res.json()), "utf8");
    }
  } catch {
    /* fall through */
  }
  return Buffer.alloc(0);
}

function statusFromMockResponse(res) {
  const n = Number(res && res.status);
  if (Number.isFinite(n) && n >= 100 && n <= 599) {
    return n;
  }
  return res && res.ok === false ? 502 : 200;
}

const realHttpsRequest = https.request.bind(https);

https.request = function bridgedHttpsRequest(options, callback) {
  const fetchFn = global.fetch;
  const useBridge =
    typeof jest !== "undefined"
    && typeof fetchFn === "function"
    && jest.isMockFunction(fetchFn);

  if (!useBridge) {
    return realHttpsRequest(options, callback);
  }

  const href = buildHrefFromRequestOptions(options);
  const method = String(options.method || "GET").toUpperCase();
  const headers = options.headers && typeof options.headers === "object" ? { ...options.headers } : {};
  const chunks = [];

  const fakeReq = {
    on() {
      return fakeReq;
    },
    setNoDelay() {
      return fakeReq;
    },
    setTimeout() {
      return fakeReq;
    },
    write(chunk) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    },
    end() {
      const init = { method, headers };
      if (chunks.length && method !== "GET" && method !== "HEAD") {
        init.body = Buffer.concat(chunks);
      }
      Promise.resolve(fetchFn(href, init))
        .then(async (res) => {
          const buf = await bodyBufferFromFetchResponse(res);
          const incoming = Readable.from([buf]);
          incoming.statusCode = statusFromMockResponse(res);
          incoming.statusMessage = (res && res.statusText) || "";
          incoming.headers = {};
          if (res && res.headers && typeof res.headers.forEach === "function") {
            res.headers.forEach((value, key) => {
              incoming.headers[key] = value;
            });
          }
          if (callback) {
            callback(incoming);
          }
        })
        .catch(() => {
          const incoming = Readable.from([]);
          incoming.statusCode = 599;
          incoming.statusMessage = "Network bridge error";
          incoming.headers = {};
          if (callback) {
            callback(incoming);
          }
        });
    }
  };
  return fakeReq;
};
