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

interface Window {
  electronAPI?: {
    exportPdfReport: (payload: ExportPdfPayload) => Promise<ExportPdfResult>;
  };
}
