const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  exportPdfReport(payload) {
    return ipcRenderer.invoke("reports:export-pdf", payload);
  },
  getUpdaterState() {
    return ipcRenderer.invoke("updater:get-state");
  },
  onUpdaterState(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    const handler = (_event, payload) => {
      listener(payload);
    };
    ipcRenderer.on("updater:state", handler);
    return () => {
      ipcRenderer.removeListener("updater:state", handler);
    };
  },
});
