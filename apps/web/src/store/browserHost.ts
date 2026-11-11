/**
 * Browser implementation of the host ports: localStorage for settings,
 * native `fetch` for demo files, and a temporary object URL for downloads.
 */
import type { HostPorts } from "./ports";

export function createBrowserHost(): HostPorts {
  return {
    now: () => Date.now(),
    download: (fileName, bytes) => {
      const blob = new Blob([bytes as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    fetchDemoFile: async (path) => {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Demo file missing: ${path}`);
      return new Uint8Array(await response.arrayBuffer());
    },
    settings: {
      get: (key) => {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      set: (key, value) => {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          /* Storage full or private mode: best effort. */
        }
      },
    },
  };
}
