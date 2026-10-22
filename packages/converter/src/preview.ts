import { serialize, serializeOuter } from "parse5";
import type { Analysis } from "./analyze";
import { rewriteCssUrls } from "./css";
import { collapseWhitespace, getAttr, isElement, walkElements, type Element } from "./dom";
import { toKebab } from "./naming";
import { isExternalUrl, resolveRelative } from "./paths";

const URL_ATTRS = new Set(["src", "poster", "srcset", "href", "xlink:href"]);

/** Message the preview posts to its parent when a link or button is clicked. */
export interface PreviewClick {
  type: "flow2repo:click";
  goto: string | null;
  href: string | null;
  label: string;
}

/**
 * Captures clicks inside the preview: links never navigate the frame (that would load a blank page),
 * and the parent decides which screen, if any, the click leads to.
 */
const CLICK_BRIDGE = `document.addEventListener("click", function (event) {
  var target = event.target instanceof Element ? event.target.closest("a, button, [data-goto]") : null;
  if (!target) return;
  if (target.closest("a")) event.preventDefault();
  parent.postMessage({
    type: "flow2repo:click",
    goto: target.getAttribute("data-goto"),
    href: target.getAttribute("href"),
    label: (target.textContent || "").trim()
  }, "*");
}, true);`;

/**
 * Builds a standalone HTML document showing one screen as designed, without the canvas.
 * `assetUrl` maps a design file path to a URL the preview can load (e.g. a data: URL).
 *
 * Meant for an iframe sandboxed with only `allow-scripts`. The design's own scripts and inline
 * handlers are removed, and a Content-Security-Policy lets only the click bridge run.
 */
export function buildScreenPreview(
  analysis: Analysis,
  screenId: string,
  assetUrl: (path: string) => string | undefined = () => undefined,
): string {
  const screen = analysis.screens.find((s) => s.id === screenId);
  if (!screen) return "<!doctype html><title>Not found</title>";
  const doc = screen.doc;

  const localUrl = (fromFile: string) => (url: string) => {
    if (!url.trim() || isExternalUrl(url)) return url;
    return assetUrl(resolveRelative(fromFile, url)) ?? url;
  };
  const fromDoc = localUrl(doc.path);
  const nonce = Math.random().toString(36).slice(2);

  const head: string[] = [
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${nonce}'">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
  ];
  for (const link of doc.headLinks) {
    const href = getAttr(link, "href")!;
    const rel = getAttr(link, "rel") ?? "";
    if (isExternalUrl(href)) {
      head.push(serializeOuter(link));
    } else if (/stylesheet/i.test(rel)) {
      const path = resolveRelative(doc.path, href);
      const css = analysis.files.css.get(path);
      if (css) head.push(`<style>${rewriteCssUrls(css, localUrl(path))}</style>`);
    }
  }
  for (const css of [...doc.globalCss, ...(doc.screenCss.get(screen.id) ?? [])]) {
    head.push(`<style>${rewriteCssUrls(css, fromDoc)}</style>`);
  }
  head.push(`<script nonce="${nonce}">${CLICK_BRIDGE}</script>`);

  const bodyAttrs = doc.bodyAttrs.map((a) => ` ${a.name}="${a.value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`).join("");
  const content = withPreviewTree(screen.element, fromDoc, () =>
    screen.isBody ? serialize(screen.element) : serializeOuter(screen.element),
  );

  const lang = doc.lang ? ` lang="${doc.lang}"` : "";
  const dir = doc.dir ? ` dir="${doc.dir}"` : "";
  return `<!doctype html><html${lang}${dir}><head>${head.join("")}</head><body${bodyAttrs}>${content}</body></html>`;
}

/**
 * Works out which screen a click in the preview of `fromScreenId` leads to, following the same rules
 * as the generated router: data-goto, "#screen" links, links between HTML files and, for designs
 * without the prompt, buttons labelled with a screen's title.
 */
export function resolvePreviewClick(analysis: Analysis, fromScreenId: string, click: PreviewClick): string | null {
  const ids = new Set(analysis.screens.map((s) => s.id));
  if (click.goto) {
    const id = toKebab(click.goto);
    return ids.has(id) ? id : null;
  }

  const href = click.href?.trim() ?? "";
  if (href.startsWith("#") && href.length > 1) {
    const id = toKebab(href.slice(1));
    if (ids.has(id)) return id;
  } else if (href && !isExternalUrl(href)) {
    const from = analysis.screens.find((s) => s.id === fromScreenId);
    if (from) {
      const target = resolveRelative(from.doc.path, href);
      const match = analysis.screens.find((s) => s.isBody && s.doc.path === target);
      if (match) return match.id;
      if (target === "" || target === "index.html") return analysis.screens[0]?.id ?? null;
    }
  }

  if (analysis.mode !== "spec" && (!href || href === "#")) {
    const label = collapseWhitespace(click.label.replace(/[^\p{L}\p{N}\s]/gu, " ")).toLowerCase();
    const match = analysis.screens.find((s) => s.title.toLowerCase() === label);
    if (match) return match.id;
  }
  return null;
}

/**
 * Temporarily adapts the tree under `root` for the preview while `render` runs, then restores it:
 * asset URLs are rewritten, and scripts, inline handlers and javascript: URLs are left out.
 */
function withPreviewTree(root: Element, rewrite: (url: string) => string, render: () => string): string {
  const restore: (() => void)[] = [];
  const visit = (el: Element) => {
    const { attrs, childNodes } = el;
    el.childNodes = childNodes.filter((child) => !(isElement(child) && child.tagName === "script"));
    el.attrs = attrs
      .filter((attr) => !/^on[a-z]/.test(attr.name) && !/^\s*javascript:/i.test(attr.value))
      .map((attr) => {
        const name = attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name;
        if (name === "srcset") {
          const value = attr.value
            .split(",")
            .map((c) => {
              const [url, ...rest] = c.trim().split(/\s+/);
              return [rewrite(url), ...rest].join(" ");
            })
            .join(", ");
          return { ...attr, value };
        }
        if (URL_ATTRS.has(name) && !(name === "href" && el.tagName === "a")) return { ...attr, value: rewrite(attr.value) };
        if (name === "style") return { ...attr, value: rewriteCssUrls(attr.value, rewrite) };
        return attr;
      });
    restore.push(() => {
      el.attrs = attrs;
      el.childNodes = childNodes;
    });
  };
  visit(root);
  walkElements(root, (el) => visit(el));
  try {
    return render();
  } finally {
    restore.forEach((undo) => undo());
  }
}
