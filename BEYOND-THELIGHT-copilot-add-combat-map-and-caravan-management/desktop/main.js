const path = require("path");
const http = require("http");
const { fork } = require("child_process");
const { app, BrowserWindow, dialog } = require("electron");

let mainWindow = null;
let serverProcess = null;

function waitForServer(url, timeoutMs) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    function probe() {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for local BEYOND server."));
          return;
        }
        setTimeout(probe, 300);
      });
    }

    probe();
  });
}

function resolveServerEntry() {
  return path.join(app.getAppPath(), "server.js");
}

function startLocalServer(port) {
  const userDataDir = app.getPath("userData");
  const serverEntry = resolveServerEntry();

  serverProcess = fork(serverEntry, [], {
    cwd: app.getAppPath(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(port),
      BTL_DATA_DIR: userDataDir,
      CAMPAIGN_STORE_PATH: path.join(userDataDir, "campaign-data.json"),
      LICENSE_STORE_PATH: path.join(userDataDir, "license-data.json")
    },
    stdio: "inherit"
  });

  serverProcess.on("exit", (code) => {
    if (!app.isQuitting && code !== 0) {
      dialog.showErrorBox(
        "Server stopped",
        `The local BEYOND server stopped unexpectedly (exit code ${code}).`
      );
    }
  });
}

function stopLocalServer() {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill("SIGTERM");
}

async function createWindow() {
  const port = 3000;
  const url = `http://127.0.0.1:${port}`;

  startLocalServer(port);
  await waitForServer(url, 20000);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: "#06070e",
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.loadURL(url);
}

app.on("ready", async () => {
  try {
    await createWindow();
  } catch (err) {
    dialog.showErrorBox("Startup failed", err && err.message ? err.message : String(err));
    app.quit();
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  stopLocalServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      await createWindow();
    } catch (err) {
      dialog.showErrorBox("Startup failed", err && err.message ? err.message : String(err));
      app.quit();
    }
  }
});