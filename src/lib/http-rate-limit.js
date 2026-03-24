"use strict";

/**
 * Simple per-IP rate limit for mutating HTTP methods (local Express API).
 */
function createMutationRateLimiter({ windowMs = 60_000, maxRequests = 500 } = {}) {
  const buckets = new Map();
  return function rateLimitMutations(req, res, next) {
    const method = req.method || "GET";
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return next();
    }
    const ip = String(req.ip || req.socket?.remoteAddress || "unknown").replace(/^::ffff:/, "");
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, b);
    }
    b.count += 1;
    if (b.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Too many requests. Try again shortly." });
    }
    next();
  };
}

module.exports = { createMutationRateLimiter };
