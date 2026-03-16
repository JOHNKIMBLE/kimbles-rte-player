/**
 * Express server API tests.
 * Only tests routes that don't require external network calls.
 */
const os = require("os");
const path = require("path");
const fs = require("fs");
const request = require("supertest");

let app;
let tmpDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rte-test-"));
  process.env.DATA_DIR = tmpDir;
  process.env.DOWNLOAD_DIR = tmpDir;
  // Require after env is set so server.js picks up the right dirs
  jest.resetModules();
  app = require("../src/server");
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Health ────────────────────────────────────────────────────────────────────

test("GET /health returns ok", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});

// ── Live station lists (pure data, no external calls) ─────────────────────────

test("GET /api/live/stations returns RTE station array", async () => {
  const res = await request(app).get("/api/live/stations");
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(0);
  expect(res.body[0]).toHaveProperty("id");
  expect(res.body[0]).toHaveProperty("name");
});

test("GET /api/wwf/live/stations returns WWF station array", async () => {
  const res = await request(app).get("/api/wwf/live/stations");
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(0);
});

test("GET /api/nts/live/stations returns NTS station array", async () => {
  const res = await request(app).get("/api/nts/live/stations");
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(0);
});

test("GET /api/fip/live/stations returns FIP station array", async () => {
  const res = await request(app).get("/api/fip/live/stations");
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(0);
});

// ── Settings ──────────────────────────────────────────────────────────────────

test("GET /api/settings returns settings object with expected keys", async () => {
  const res = await request(app).get("/api/settings");
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("timeFormat");
  expect(res.body).toHaveProperty("downloadDir");
  expect(res.body).toHaveProperty("pathFormat");
  expect(res.body).toHaveProperty("outputFormat");
  expect(res.body).toHaveProperty("maxConcurrentDownloads");
});

test("POST /api/settings updates timeFormat", async () => {
  const res = await request(app)
    .post("/api/settings")
    .send({ timeFormat: "12h" });
  expect(res.status).toBe(200);
  expect(res.body.timeFormat).toBe("12h");
});

test("POST /api/settings rejects unknown values gracefully (normalises)", async () => {
  const res = await request(app)
    .post("/api/settings")
    .send({ timeFormat: "99h" }); // invalid → normalised to "24h"
  expect(res.status).toBe(200);
  expect(res.body.timeFormat).toBe("24h");
});

test("POST /api/settings clamps maxConcurrentDownloads to 1–8", async () => {
  const res = await request(app)
    .post("/api/settings")
    .send({ maxConcurrentDownloads: 99 });
  expect(res.status).toBe(200);
  expect(res.body.maxConcurrentDownloads).toBe(8);
});

// ── Download queue ────────────────────────────────────────────────────────────

test("GET /api/download-queue/stats returns stats object", async () => {
  const res = await request(app).get("/api/download-queue/stats");
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("active");
  expect(res.body).toHaveProperty("queued");
});

test("GET /api/download-queue returns snapshot", async () => {
  const res = await request(app).get("/api/download-queue");
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("active");
  expect(res.body).toHaveProperty("queued");
  expect(res.body).toHaveProperty("recent");
});

test("POST /api/download-queue/pause returns snapshot", async () => {
  const res = await request(app).post("/api/download-queue/pause");
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("active");
});

test("POST /api/download-queue/resume returns snapshot", async () => {
  const res = await request(app).post("/api/download-queue/resume");
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("active");
});

test("POST /api/download-queue/cancel returns ok and snapshot", async () => {
  const res = await request(app)
    .post("/api/download-queue/cancel")
    .send({ taskId: "nonexistent" });
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("ok");
  expect(res.body).toHaveProperty("snapshot");
});

test("POST /api/download-queue/clear-pending returns snapshot", async () => {
  const res = await request(app).post("/api/download-queue/clear-pending");
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("active");
});

// ── Schedulers (pure in-memory CRUD) ─────────────────────────────────────────

describe.each([
  ["RTE", "/api/scheduler"],
  ["BBC", "/api/bbc/scheduler"],
  ["WWF", "/api/wwf/scheduler"],
  ["NTS", "/api/nts/scheduler"],
  ["FIP", "/api/fip/scheduler"],
])("%s scheduler", (_label, base) => {
  test(`GET ${base} returns array`, async () => {
    const res = await request(app).get(base);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test(`DELETE ${base}/nonexistent returns ok`, async () => {
    const res = await request(app).delete(`${base}/nonexistent`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test(`PATCH ${base}/nonexistent returns 400`, async () => {
    const res = await request(app)
      .patch(`${base}/nonexistent`)
      .send({ enabled: true });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });
});
