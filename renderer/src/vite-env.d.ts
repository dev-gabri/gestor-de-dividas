/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

type ExportPdfPayload = {
  html: string;
  fileName?: string;
};

type ExportPdfResult = {
  canceled: boolean;
  filePath?: string;
};

type UpdaterState = {
  state: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
  message: string | null;
  version: string | null;
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
};

interface Window {
  electronAPI?: {
    exportPdfReport: (payload: ExportPdfPayload) => Promise<ExportPdfResult>;
    getUpdaterState: () => Promise<UpdaterState>;
    onUpdaterState: (listener: (state: UpdaterState) => void) => () => void;
  };
}
