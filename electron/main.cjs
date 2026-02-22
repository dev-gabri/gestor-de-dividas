const { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");

const iconPath = path.join(__dirname, "..", "logo.png");
const rendererDistIndex = path.join(__dirname, "..", "renderer", "dist", "index.html");
const preloadPath = path.join(__dirname, "preload.cjs");
const devServerUrl = process.env.ELECTRON_RENDERER_URL || "http://localhost:5173";
const appId = "com.comercialfagundes.gestordedividas";
let updateCheckInterval = null;
let mainWindow = null;
let updaterState = {
  state: "idle",
  message: null,
  version: null,
  percent: 0,
  bytesPerSecond: 0,
  transferred: 0,
  total: 0,
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

function getAppIcon() {
  const image = nativeImage.createFromPath(iconPath);
  return image.isEmpty() ? null : image;
}

function applyAppIcon() {
  const appIcon = getAppIcon();
  if (!appIcon) {
    console.warn("Icone do app nao encontrado em:", iconPath);
    return null;
  }

  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(appIcon);
  }

  return appIcon;
}

function attachWindowDiagnostics(win) {
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    dialog.showErrorBox(
      "Falha ao carregar a interface",
      `Erro ${errorCode}: ${errorDescription}\nURL: ${validatedURL}`
    );
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    dialog.showErrorBox(
      "Falha no processo de renderização",
      `Motivo: ${details.reason}${details.exitCode ? ` (código ${details.exitCode})` : ""}`
    );
  });
}

function broadcastUpdaterState(win = mainWindow) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("updater:state", updaterState);
}

function patchUpdaterState(patch, win = mainWindow) {
  updaterState = {
    ...updaterState,
    ...patch,
  };
  broadcastUpdaterState(win);
}

function sanitizeFileName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function renderHtmlToPdfBuffer(html) {
  const tempHtml = path.join(
    app.getPath("temp"),
    `gd-report-${Date.now()}-${Math.random().toString(36).slice(2)}.html`
  );
  await fs.promises.writeFile(tempHtml, html, "utf8");

  const printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
    },
  });

  try {
    await printWin.loadFile(tempHtml);
    return await printWin.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      landscape: false,
    });
  } finally {
    if (!printWin.isDestroyed()) {
      printWin.destroy();
    }
    fs.promises.unlink(tempHtml).catch(() => {});
  }
}

ipcMain.handle("reports:export-pdf", async (_event, payload) => {
  const html = typeof payload?.html === "string" ? payload.html : "";
  const fileName = typeof payload?.fileName === "string" ? payload.fileName : "extrato-cliente";

  if (!html.trim()) {
    throw new Error("Conteúdo do relatório não informado.");
  }

  const pdfBuffer = await renderHtmlToPdfBuffer(html);
  const safeBaseName = sanitizeFileName(fileName) || "extrato-cliente";
  const defaultPath = path.join(app.getPath("downloads"), `${safeBaseName}.pdf`);

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow ?? undefined, {
    title: "Salvar extrato em PDF",
    defaultPath,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  await fs.promises.writeFile(filePath, pdfBuffer);
  return { canceled: false, filePath };
});

ipcMain.handle("updater:get-state", async () => {
  return updaterState;
});

function setupAutoUpdater(win) {
  if (!app.isPackaged || process.platform !== "win32") return;

  const updaterConfigPath = path.join(process.resourcesPath, "app-update.yml");
  if (!fs.existsSync(updaterConfigPath)) {
    console.info("Auto-update não configurado: app-update.yml não encontrado.");
    return;
  }

  let hasShownUpdateAvailable = false;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    console.error("Erro no auto-update:", error?.message ?? error);
    patchUpdaterState(
      {
        state: "error",
        message: error?.message ?? "Falha ao baixar atualização.",
      },
      win,
    );
  });

  autoUpdater.on("checking-for-update", () => {
    patchUpdaterState(
      {
        state: "checking",
        message: "Verificando atualização...",
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
      },
      win,
    );
  });

  autoUpdater.on("update-available", (info) => {
    if (hasShownUpdateAvailable) return;
    hasShownUpdateAvailable = true;
    patchUpdaterState(
      {
        state: "available",
        message: "Atualização encontrada. Iniciando download...",
        version: info?.version ?? null,
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
      },
      win,
    );

    dialog
      .showMessageBox(win, {
        type: "info",
        title: "Atualização disponível",
        message: "Uma nova versão foi encontrada.",
        detail: "O download está sendo feito em segundo plano.",
        buttons: ["OK"],
      })
      .catch(() => {});
  });

  autoUpdater.on("update-not-available", () => {
    hasShownUpdateAvailable = false;
    patchUpdaterState(
      {
        state: "idle",
        message: null,
        version: null,
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
      },
      win,
    );
  });

  autoUpdater.on("download-progress", (progress) => {
    const percent = Number.isFinite(progress?.percent) ? Math.max(0, Math.min(100, progress.percent)) : 0;
    patchUpdaterState(
      {
        state: "downloading",
        message: `Baixando atualização ${percent.toFixed(1)}%`,
        percent,
        bytesPerSecond: Math.max(0, progress?.bytesPerSecond ?? 0),
        transferred: Math.max(0, progress?.transferred ?? 0),
        total: Math.max(0, progress?.total ?? 0),
      },
      win,
    );
  });

  autoUpdater.on("update-downloaded", (info) => {
    patchUpdaterState(
      {
        state: "downloaded",
        message: "Atualização pronta para instalar.",
        version: info?.version ?? updaterState.version ?? null,
        percent: 100,
      },
      win,
    );

    dialog
      .showMessageBox(win, {
        type: "info",
        title: "Atualização pronta",
        message: "A atualização foi baixada com sucesso.",
        detail: "Deseja reiniciar agora para instalar?",
        buttons: ["Reiniciar agora", "Depois"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      })
      .catch(() => {});
  });

  autoUpdater
    .checkForUpdates()
    .catch((error) => console.error("Falha ao verificar atualizações:", error?.message ?? error));

  const thirtyMinutes = 30 * 60 * 1000;
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }

  updateCheckInterval = setInterval(() => {
    autoUpdater
      .checkForUpdates()
      .catch((error) => console.error("Falha ao verificar atualizações:", error?.message ?? error));
  }, thirtyMinutes);
}

async function createWindow(appIcon) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1080,
    minHeight: 720,
    icon: appIcon ?? iconPath,
    show: false,
    backgroundColor: "#eef4fb",
    autoHideMenuBar: true,
    webPreferences: {
      spellcheck: false,
      contextIsolation: true,
      sandbox: false,
      preload: preloadPath,
    },
  });
  attachWindowDiagnostics(win);
  win.once("ready-to-show", () => {
    win.show();
  });
  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });
  if (process.platform !== "darwin") {
    win.setMenuBarVisibility(false);
    win.removeMenu();
  }

  if (app.isPackaged) {
    if (!fs.existsSync(rendererDistIndex)) {
      dialog.showErrorBox("Build não encontrado", "Arquivo renderer/dist/index.html não foi encontrado. Gere o build do renderer.");
      app.quit();
      return;
    }
    await win.loadFile(rendererDistIndex);
    return win;
  }

  // Carrega o Vite (React) no desenvolvimento
  await win.loadURL(devServerUrl);
  return win;
}

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId(appId);
  }
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
  }

  const appIcon = applyAppIcon();
  mainWindow = await createWindow(appIcon);
  if (mainWindow) {
    setupAutoUpdater(mainWindow);
  }
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.on("before-quit", () => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length > 0) return;
  const appIcon = applyAppIcon();
  mainWindow = await createWindow(appIcon);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
