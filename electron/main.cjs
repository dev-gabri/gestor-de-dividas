const { app, BrowserWindow, Menu, dialog, nativeImage } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");

const iconPath = path.join(__dirname, "..", "logo.png");
const rendererDistIndex = path.join(__dirname, "..", "renderer", "dist", "index.html");
const devServerUrl = process.env.ELECTRON_RENDERER_URL || "http://localhost:5173";
const appId = "com.comercialfagundes.gestordedividas";

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
  });

  autoUpdater.on("update-available", () => {
    if (hasShownUpdateAvailable) return;
    hasShownUpdateAvailable = true;

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
  });

  autoUpdater.on("update-downloaded", () => {
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
  setInterval(() => {
    autoUpdater
      .checkForUpdates()
      .catch((error) => console.error("Falha ao verificar atualizações:", error?.message ?? error));
  }, thirtyMinutes);
}

async function createWindow(appIcon) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: appIcon ?? iconPath,
    autoHideMenuBar: true,
  });
  attachWindowDiagnostics(win);
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
  const win = await createWindow(appIcon);
  if (win) {
    setupAutoUpdater(win);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
