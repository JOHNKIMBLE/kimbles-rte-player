const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadPreloadApi() {
  let exposed = null;
  jest.resetModules();
  jest.doMock("electron", () => ({
    contextBridge: {
      exposeInMainWorld: (_name, api) => {
        exposed = api;
      }
    },
    ipcRenderer: {
      invoke: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn()
    }
  }));
  require("../src/preload");
  jest.dontMock("electron");
  return exposed;
}

function loadWebApi() {
  const code = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "web-api-bridge.js"), "utf8");
  const storage = new Map();
  const context = {
    window: {
      open: jest.fn()
    },
    location: {
      origin: "http://localhost"
    },
    localStorage: {
      getItem: (key) => storage.get(`local:${key}`) || null,
      setItem: (key, value) => storage.set(`local:${key}`, String(value)),
      removeItem: (key) => storage.delete(`local:${key}`)
    },
    sessionStorage: {
      getItem: (key) => storage.get(`session:${key}`) || null,
      setItem: (key, value) => storage.set(`session:${key}`, String(value)),
      removeItem: (key) => storage.delete(`session:${key}`)
    },
    EventSource: function EventSource() {
      this.close = jest.fn();
    },
    fetch: jest.fn(),
    setTimeout,
    clearTimeout,
    TextEncoder,
    TextDecoder,
    btoa: (value) => Buffer.from(String(value), "binary").toString("base64"),
    atob: (value) => Buffer.from(String(value), "base64").toString("binary"),
    console
  };
  context.globalThis = context;
  vm.runInNewContext(code, context, { filename: "web-api-bridge.js" });
  return context.window.rteDownloader;
}

describe("window.rteDownloader API parity", () => {
  test("Electron preload and web bridge expose the same method names", () => {
    const preloadApi = loadPreloadApi();
    const webApi = loadWebApi();

    expect(preloadApi).toBeTruthy();
    expect(webApi).toBeTruthy();

    const preloadKeys = Object.keys(preloadApi).sort();
    const webKeys = Object.keys(webApi).sort();

    expect(webKeys).toEqual(preloadKeys);
  });
});
