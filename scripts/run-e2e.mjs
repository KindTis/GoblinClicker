import { spawn, spawnSync } from "node:child_process";

const baseUrl = "http://127.0.0.1:5173";
const serverArgs = ["./node_modules/vite/bin/vite.js", "--mode", "test", "--host", "127.0.0.1"];
let serverProcess = null;

try {
  if (!(await isServerReady())) {
    serverProcess = spawn(process.execPath, serverArgs, {
      cwd: process.cwd(),
      stdio: ["ignore", "inherit", "inherit"],
    });
    await waitForServer();
  }

  const exitCode = await runPlaywright();
  process.exitCode = exitCode;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  stopServer();
}

process.exit(process.exitCode ?? 0);

async function runPlaywright() {
  const args = ["./node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)];
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, PLAYWRIGHT_SKIP_WEB_SERVER: "1" },
    stdio: "inherit",
  });
  return new Promise((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    if (serverProcess?.exitCode !== null) {
      throw new Error(`Vite test server exited with code ${serverProcess.exitCode}`);
    }
    if (await isServerReady()) {
      return;
    }
    await delay(250);
  }
  throw new Error("Vite test server did not become ready");
}

async function isServerReady() {
  try {
    const response = await fetch(baseUrl);
    return response.ok;
  } catch {
    return false;
  }
}

function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return;
  }
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(serverProcess.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  serverProcess.kill("SIGTERM");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
