import { parse } from "parse5";
import { dedentCss } from "./css";
import {
  childElements,
  collapseWhitespace,
  findFirst,
  getAttr,
  hasAttr,
  isElement,
  textContent,
  walkElements,
  type Document,
  type Element,
} from "./dom";
import { readDesignFiles, type DesignFiles } from "./input";
import { toKebab, toTitle, truncate, uniqueName, toPackageName } from "./naming";
import { basename, isExternalUrl, resolveRelative } from "./paths";
import type { AnalyzeOptions, ConversionWarning, DetectionMode, InputFile, ScreenConfig } from "./types";
import { WarningCollector } from "./warnings";

export interface DocInfo {
  path: string;
  document: Document;
  head: Element | null;
  body: Element | null;
  title: string;
  lang: string | null;
  dir: string | null;
  bodyAttrs: Element["attrs"];
  /** Plain <style> blocks: the app's shared styles. */
  globalCss: string[];
  /** <style data-f2r="preview"> blocks: canvas-only styles, never copied to the project. */
  previewCss: string[];
  /** <style data-f2r-screen="id"> blocks keyed by screen id. */
  screenCss: Map<string, string[]>;
  /** <link> tags from <head> worth keeping (stylesheets, fonts, icons). */
  headLinks: Element[];
  /** <meta> tags worth keeping (description, theme-color, Open Graph…). */
  headMetas: Element[];
  /** Classic scripts of the design, in document order. */
  scripts: DesignScript[];
  /** Some element has an inline event handler (onclick, onchange…). */
  hasInlineHandlers: boolean;
}

/** A script from the design: from a CDN, a file in the upload, or inline code. */
export type DesignScript =
  | { kind: "remote"; element: Element }
  | { kind: "local"; path: string }
  | { kind: "inline"; code: string };

export interface AnalyzedScreen {
  id: string;
  title: string;
  route: string;
  element: Element;
  doc: DocInfo;
  /** The screen is a whole <body> (multi-file and single-page modes). */
  isBody: boolean;
}

export interface Analysis {
  mode: DetectionMode;
  screens: AnalyzedScreen[];
  docs: DocInfo[];
  files: DesignFiles;
  suggestedName: string;
  warnings: ConversionWarning[];
}

interface RawScreen {
  element: Element;
  doc: DocInfo;
  idHint: string;
  title: string;
  route: string | null;
  home: boolean;
  isBody: boolean;
}

const CLASSIC_SCRIPT_TYPES = new Set(["", "text/javascript", "application/javascript"]);
const KEPT_LINK_RELS = /\b(stylesheet|preconnect|dns-prefetch|preload|icon|apple-touch-icon|manifest)\b/i;
/** Meta tags that describe the site (search, sharing, browser UI); viewport and charset are written by the project itself. */
const KEPT_META = /^(description|keywords|author|robots|theme-color|color-scheme|application-name|og:.+|twitter:.+)$/i;

export function analyzeDesign(input: InputFile[], options: AnalyzeOptions = {}): Analysis {
  const warnings = new WarningCollector();
  const files = readDesignFiles(input);

  if (files.html.length === 0) {
    warnings.add("error", "No HTML file found. Upload an .html file or a .zip that contains one.");
    return { mode: "single", screens: [], docs: [], files, suggestedName: "my-react-app", warnings: warnings.list() };
  }

  const docs = files.html.map((file) => parseDoc(file.path, file.source, files, warnings));
  const { mode, raw } = detectScreens(docs, options, warnings);
  const screens = finalizeScreens(raw);
  // "Loanwell One — Scraps tonight. Soil by morning." names the project after the brand, not the tagline.
  const brand = docs[0].title.split(/\s+[—–|·-]\s+/)[0];
  const suggestedName = toPackageName(brand || basename(docs[0].path).replace(/\.html?$/i, ""));

  if (mode === "heuristic") {
    warnings.add(
      "warning",
      `Screens were guessed from the layout (${screens.length} found). Check them, and use the Flow2Repo prompt for exact results.`,
    );
    warnings.add(
      "info",
      "Canvas styles (board grid, fixed frame sizes) cannot be separated automatically without the prompt. Check fixed widths on screen containers.",
    );
  }
  if (mode === "multi-file" && new Set(docs.map((d) => d.globalCss.join("\n"))).size > 1) {
    warnings.add("info", `Styles from ${docs.length} HTML files were merged into one global stylesheet. Check for conflicting rules.`);
  }

  return { mode, screens, docs, files, suggestedName, warnings: warnings.list() };
}

export function defaultScreenConfig(analysis: Analysis): ScreenConfig[] {
  return analysis.screens.map((s) => ({ id: s.id, title: s.title, route: s.route, include: true }));
}

function parseDoc(path: string, source: string, files: DesignFiles, warnings: WarningCollector): DocInfo {
  const document = parse(source);
  const html = childElements(document).find((el) => el.tagName === "html") ?? null;
  const head = html ? childElements(html).find((el) => el.tagName === "head") ?? null : null;
  const body = html ? childElements(html).find((el) => el.tagName === "body") ?? null : null;

  const doc: DocInfo = {
    path,
    document,
    head,
    body,
    title: "",
    lang: html ? getAttr(html, "lang") : null,
    dir: html ? getAttr(html, "dir") : null,
    bodyAttrs: body ? body.attrs.filter((a) => !a.name.startsWith("on")) : [],
    globalCss: [],
    previewCss: [],
    screenCss: new Map(),
    headLinks: [],
    headMetas: [],
    scripts: [],
    hasInlineHandlers: false,
  };

  walkElements(document, (el) => {
    if (el.tagName === "title" && !doc.title) doc.title = collapseWhitespace(textContent(el));
    if (el.tagName === "style") {
      const css = dedentCss(textContent(el));
      if (!css) return;
      const screen = getAttr(el, "data-f2r-screen");
      if (getAttr(el, "data-f2r") === "preview" || hasAttr(el, "data-f2r-preview")) doc.previewCss.push(css);
      else if (screen) {
        const id = toKebab(screen);
        doc.screenCss.set(id, [...(doc.screenCss.get(id) ?? []), css]);
      } else doc.globalCss.push(css);
    }
    if (el.tagName === "link" && KEPT_LINK_RELS.test(getAttr(el, "rel") ?? "") && getAttr(el, "href")) {
      doc.headLinks.push(el);
    }
    if (el.tagName === "meta" && getAttr(el, "content") !== null && KEPT_META.test(getAttr(el, "name") ?? getAttr(el, "property") ?? "")) {
      doc.headMetas.push(el);
    }
    if (el.tagName === "script") collectScript(el, doc, files, warnings);
    if (!doc.hasInlineHandlers && el !== body && el.attrs.some((a) => /^on[a-z]/.test(a.name))) {
      doc.hasInlineHandlers = true;
    }
  });

  return doc;
}

function collectScript(el: Element, doc: DocInfo, files: DesignFiles, warnings: WarningCollector): void {
  const type = (getAttr(el, "type") ?? "").trim().toLowerCase();
  const src = getAttr(el, "src")?.trim();
  if (type === "module") {
    warnings.add("warning", `Skipped a module script${src ? ` (${src})` : ""} in ${doc.path}: only classic scripts are carried over.`);
    return;
  }
  if (!CLASSIC_SCRIPT_TYPES.has(type)) return;

  if (src) {
    if (isExternalUrl(src)) {
      doc.scripts.push({ kind: "remote", element: el });
      return;
    }
    const path = resolveRelative(doc.path, src);
    if (files.assets.has(path)) doc.scripts.push({ kind: "local", path });
    else warnings.add("warning", `Missing script "${src}" (referenced in ${doc.path}).`);
    return;
  }
  const code = textContent(el).trim();
  if (code) doc.scripts.push({ kind: "inline", code });
}

function detectScreens(
  docs: DocInfo[],
  options: AnalyzeOptions,
  warnings: WarningCollector,
): { mode: DetectionMode; raw: RawScreen[] } {
  if (options.detection === "single") return { mode: "single", raw: [singleScreen(docs[0])] };

  const spec = docs.flatMap(detectSpecScreens);
  if (spec.length > 0) {
    const ignored = docs.filter((d) => !spec.some((s) => s.doc === d));
    if (ignored.length) {
      warnings.add("info", `Ignored HTML files without data-screen markers: ${ignored.map((d) => d.path).join(", ")}`);
    }
    return { mode: "spec", raw: spec };
  }

  if (docs.length > 1) return { mode: "multi-file", raw: docs.map(fileScreen) };

  const guessed = detectHeuristicScreens(docs[0]);
  if (guessed) return { mode: "heuristic", raw: guessed };

  return { mode: "single", raw: [singleScreen(docs[0])] };
}

function detectSpecScreens(doc: DocInfo): RawScreen[] {
  if (!doc.body) return [];
  const screens: RawScreen[] = [];
  walkElements(doc.body, (el) => {
    const id = getAttr(el, "data-screen");
    if (id === null) return;
    screens.push({
      element: el,
      doc,
      idHint: id,
      title: getAttr(el, "data-title") || toTitle(id) || headingText(el),
      route: getAttr(el, "data-route"),
      home: hasAttr(el, "data-home"),
      isBody: false,
    });
    return false;
  });
  return screens;
}

function fileScreen(doc: DocInfo): RawScreen {
  const name = basename(doc.path).replace(/\.html?$/i, "");
  const isIndex = name.toLowerCase() === "index";
  return {
    element: doc.body!,
    doc,
    idHint: isIndex ? "home" : name,
    title: isIndex ? "Home" : toTitle(name) || doc.title,
    route: null,
    home: isIndex,
    isBody: true,
  };
}

function singleScreen(doc: DocInfo): RawScreen {
  return {
    element: doc.body!,
    doc,
    idHint: "home",
    // A single page is the home page; the document title still names the project.
    title: "Home",
    route: "/",
    home: true,
    isBody: true,
  };
}

const SCREEN_HINT = /screen|frame|artboard|page|phone|device|mock|view|slide/i;
const CANVAS_HINT = /canvas|board|grid|screens|frames|gallery|flow|showcase|wrapper/i;
const MIN_SCREEN_ELEMENTS = 12;

/**
 * Finds a container whose children look like complete screens: several large siblings of similar size
 * that together hold most of the document, and that either are named like screens or each carry their
 * own navigation/header.
 */
function detectHeuristicScreens(doc: DocInfo): RawScreen[] | null {
  const body = doc.body;
  if (!body) return null;

  const counts = new Map<Element, number>();
  const count = (el: Element): number => {
    let n = 0;
    for (const child of childElements(el)) n += 1 + count(child);
    counts.set(el, n);
    return n;
  };
  const total = count(body);
  if (total < MIN_SCREEN_ELEMENTS * 2) return null;

  let best: { container: Element; screens: Element[] } | null = null;
  const consider = (container: Element) => {
    const kids = childElements(container).filter(
      (k) => counts.get(k)! >= MIN_SCREEN_ELEMENTS && !["script", "style", "template"].includes(k.tagName),
    );
    if (kids.length < 2) return;
    const covered = kids.reduce((sum, k) => sum + counts.get(k)! + 1, 0);
    if (covered < total * 0.6) return;
    const sizes = kids.map((k) => counts.get(k)!);
    if (Math.min(...sizes) / Math.max(...sizes) < 0.2) return;
    const named = kids.every((k) => SCREEN_HINT.test(`${getAttr(k, "class") ?? ""} ${getAttr(k, "id") ?? ""}`));
    const canvas = CANVAS_HINT.test(`${getAttr(container, "class") ?? ""} ${getAttr(container, "id") ?? ""}`);
    const ownChrome = kids.every((k) => findFirst(k, (el) => ["nav", "header", "aside"].includes(el.tagName)) !== null);
    if (!named && !canvas && !ownChrome) return;
    if (!best || kids.length > best.screens.length) best = { container, screens: kids };
  };
  consider(body);
  walkElements(body, (el) => consider(el));

  const found = best as { container: Element; screens: Element[] } | null;
  if (!found) return null;

  return found.screens.map((el, index) => {
    const { element, label } = unwrapLabel(el, counts);
    const title =
      label ||
      getAttr(element, "data-title") ||
      getAttr(element, "aria-label") ||
      headingText(element) ||
      `Screen ${index + 1}`;
    return {
      element,
      doc,
      idHint: getAttr(element, "id") && !/^\d/.test(getAttr(element, "id")!) ? getAttr(element, "id")! : title,
      title,
      route: null,
      home: index === 0,
      isBody: false,
    };
  });
}

/** `<div class="wrap"><p class="label">Login</p><div class="screen">…</div></div>` → the inner screen plus "Login". */
function unwrapLabel(el: Element, counts: Map<Element, number>): { element: Element; label: string } {
  const kids = childElements(el);
  const main = kids.find((k) => counts.get(k)! + 1 >= counts.get(el)! * 0.85);
  if (!main) return { element: el, label: "" };
  const others = kids.filter((k) => k !== main);
  const labels = others.map((k) => collapseWhitespace(textContent(k)));
  const allLabels =
    others.length > 0 &&
    others.every((k) => !k.childNodes.some(isElement)) &&
    labels.every((t) => t.length > 0 && t.length <= 40);
  return allLabels ? { element: main, label: labels.join(" ") } : { element: el, label: "" };
}

function headingText(el: Element): string {
  const heading = findFirst(el, (e) => /^h[1-3]$/.test(e.tagName));
  return heading ? truncate(collapseWhitespace(textContent(heading)), 40) : "";
}

function finalizeScreens(raw: RawScreen[]): AnalyzedScreen[] {
  const usedIds = new Set<string>();
  const usedRoutes = new Set<string>();
  const homeIndex = Math.max(0, raw.findIndex((s) => s.home || s.route === "/"));

  const ids = raw.map((s, i) => uniqueName(toKebab(s.idHint) || toKebab(s.title) || `screen-${i + 1}`, usedIds, "-"));
  usedRoutes.add("/");

  return raw.map((s, i) => {
    let route = "/";
    if (i !== homeIndex) {
      const wanted = s.route && s.route !== "/" && !isExternalUrl(s.route) ? normalizeRoute(s.route) : `/${ids[i]}`;
      route = uniqueName(wanted, usedRoutes, "-");
    }
    return {
      id: ids[i],
      title: truncate(collapseWhitespace(s.title), 60) || toTitle(ids[i]),
      route,
      element: s.element,
      doc: s.doc,
      isBody: s.isBody,
    };
  });
}

export function normalizeRoute(route: string): string {
  const cleaned = route
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-/:_.]/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "");
  return cleaned.startsWith("/") ? cleaned || "/" : `/${cleaned}`;
}
