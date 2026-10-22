export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

export function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function extension(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf(".");
  return index <= 0 ? "" : name.slice(index + 1).toLowerCase();
}

/** True for URLs that must be left untouched: schemes (https:, data:, mailto:), protocol-relative and fragments. */
export function isExternalUrl(url: string): boolean {
  return /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url.trim());
}

/** Splits "img/a.png?v=2#x" into the path and its "?v=2#x" suffix. */
export function splitUrlSuffix(url: string): [string, string] {
  const index = url.search(/[?#]/);
  return index < 0 ? [url, ""] : [url.slice(0, index), url.slice(index)];
}

/** Resolves a relative URL found in `fromFile` to a normalized project path. */
export function resolveRelative(fromFile: string, url: string): string {
  let [path] = splitUrlSuffix(url.trim());
  try {
    path = decodeURI(path);
  } catch {
    // keep the raw path when it is not valid URI encoding
  }
  if (path.startsWith("/")) return normalizePath(path);
  return normalizePath(`${dirname(fromFile)}/${path}`);
}
