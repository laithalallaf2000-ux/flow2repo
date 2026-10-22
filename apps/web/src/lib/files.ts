import type { FileData, InputFile } from "@flow2repo/converter";

export interface Upload {
  name: string;
  files: InputFile[];
}

const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
const MAX_FILES = 2000;

/** Reads dropped/selected files. ZIPs are unpacked in memory with size and count limits. */
export async function readUpload(selected: File[]): Promise<Upload> {
  const files: InputFile[] = [];
  let total = 0;

  const add = (path: string, data: Uint8Array) => {
    total += data.byteLength;
    if (total > MAX_TOTAL_BYTES) throw new Error("The design is larger than 80 MB. Remove large media files and try again.");
    if (files.length >= MAX_FILES) throw new Error(`The design has more than ${MAX_FILES} files.`);
    files.push({ path, data });
  };

  for (const file of selected) {
    if (/\.zip$/i.test(file.name)) {
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(file);
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        add(entry.name, await entry.async("uint8array"));
      }
    } else {
      add(file.webkitRelativePath || file.name, new Uint8Array(await file.arrayBuffer()));
    }
  }

  if (!files.some((f) => /\.html?$/i.test(f.path))) {
    throw new Error("No HTML file found. Upload an .html file or a .zip that contains one.");
  }
  const name = selected.length === 1 ? selected[0].name : `${selected.length} files`;
  return { name, files };
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp4: "video/mp4",
  webm: "video/webm",
};

/**
 * data: URLs for the design's images and fonts, so a sandboxed preview iframe (opaque origin)
 * can display them without access to this page.
 */
export function assetDataUrls(assets: Map<string, FileData>): Map<string, string> {
  const urls = new Map<string, string>();
  for (const [path, data] of assets) {
    const mime = MIME[path.split(".").pop()?.toLowerCase() ?? ""];
    if (!mime) continue;
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    urls.set(path, `data:${mime};base64,${toBase64(bytes)}`);
  }
  return urls;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
