const { app, BrowserWindow, dialog, nativeImage } = require("electron");
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

async function createWindow(appIcon) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: appIcon ?? iconPath,
  });

  if (app.isPackaged) {
    if (!fs.existsSync(rendererDistIndex)) {
      dialog.showErrorBox("Build não encontrado", "Arquivo renderer/dist/index.html não foi encontrado. Gere o build do renderer.");
      app.quit();
      return;
    }
    await win.loadFile(rendererDistIndex);
    return;
  }

  // Carrega o Vite (React) no desenvolvimento
  await win.loadURL(devServerUrl);
}

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId(appId);
  }

  const appIcon = applyAppIcon();
  await createWindow(appIcon);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
