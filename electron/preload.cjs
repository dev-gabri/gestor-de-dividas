const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  exportPdfReport(payload) {
    return ipcRenderer.invoke("reports:export-pdf", payload);
  },
});
