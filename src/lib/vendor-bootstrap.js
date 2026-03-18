const path = require("node:path");
const { spawn } = require("node:child_process");

function getBootstrapScriptPath(projectRoot) {
  return path.join(projectRoot, "scripts", "bootstrap-yt-dlp.js");
}

function runVendorBootstrap(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, "..", ".."));
  const scriptPath = getBootstrapScriptPath(projectRoot);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: projectRoot,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        code: 1,
        output: `${stdout}${stderr}`.trim(),
        error: String(error?.message || error || "Vendor bootstrap failed."),
        scriptPath
      });
    });

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code: Number(code ?? 1),
        output: `${stdout}${stderr}`.trim(),
        scriptPath
      });
    });
  });
}

module.exports = {
  getBootstrapScriptPath,
  runVendorBootstrap
};
