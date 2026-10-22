import { extension, normalizePath } from "./paths";
import type { FileData, InputFile } from "./types";

export interface DesignFiles {
  html: { path: string; source: string }[];
  /** Local stylesheets by path (also present in `assets`, since they are served from public/). */
  css: Map<string, string>;
  /** Every non-HTML file, copied to the generated project's public/ folder. */
  assets: Map<string, FileData>;
}

const IGNORED = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|\.git|node_modules)(\/|$)/;

export function decodeText(data: FileData): string {
  return typeof data === "string" ? data : new TextDecoder().decode(data);
}

export function readDesignFiles(input: InputFile[]): DesignFiles {
  const files = input
    .map((file) => ({ path: normalizePath(file.path), data: file.data }))
    .filter((file) => file.path && !IGNORED.test(file.path));

  const root = commonRootFolder(files.map((f) => f.path));
  const design: DesignFiles = { html: [], css: new Map(), assets: new Map() };

  for (const file of files) {
    const path = root ? file.path.slice(root.length + 1) : file.path;
    const ext = extension(path);
    if (ext === "html" || ext === "htm") {
      design.html.push({ path, source: decodeText(file.data) });
      continue;
    }
    if (ext === "css") design.css.set(path, decodeText(file.data));
    design.assets.set(path, file.data);
  }

  design.html.sort((a, b) => entryRank(a.path) - entryRank(b.path) || a.path.localeCompare(b.path));
  return design;
}

/** ZIPs often wrap everything in one folder ("my-design/index.html"); strip it so paths start at the design root. */
function commonRootFolder(paths: string[]): string {
  if (paths.length === 0 || paths.some((p) => !p.includes("/"))) return "";
  const first = paths[0].split("/")[0];
  return paths.every((p) => p.startsWith(`${first}/`)) ? first : "";
}

function entryRank(path: string): number {
  const depth = path.split("/").length;
  return /(^|\/)index\.html?$/i.test(path) ? depth * 2 - 1 : depth * 2;
}
