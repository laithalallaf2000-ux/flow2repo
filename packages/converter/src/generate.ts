import { defaultScreenConfig, normalizeRoute, type Analysis, type AnalyzedScreen, type DocInfo } from "./analyze";
import { extractComponents } from "./components";
import { prepareForms } from "./forms";
import { createFlexDetector } from "./display";
import { prepareInteractions } from "./interactions";
import { rewriteCssUrls } from "./css";
import {
  collapseWhitespace,
  createSyntheticElement,
  getAttr,
  textContent,
  type Element,
} from "./dom";
import { decodeText } from "./input";
import { createImports, printElement, type FileImports, type PrintContext } from "./jsx";
import { planSections } from "./sections";
import { POSTCSS_CONFIG, detectTailwind, withTailwindCss, type TailwindSetup } from "./tailwind";
import { toKebab, toPackageName, toPascal, toTitle, uniqueName } from "./naming";
import { basename, isExternalUrl, resolveRelative, splitUrlSuffix } from "./paths";
import {
  GITIGNORE,
  MAIN_TSX,
  TSCONFIG,
  USE_DESIGN_SCRIPTS,
  VITE_CONFIG,
  VITE_CONFIG_TAILWIND_V4,
  VITE_ENV,
  appTsx,
  escapeHtml,
  indexHtml,
  packageJson,
  readme,
  wrapDesignScript,
} from "./project";
import type { WarningLevel, GenerateOptions, GeneratedComponent, GeneratedPage, GenerationResult, OutputFile } from "./types";
import { WarningCollector } from "./warnings";

interface PageUnit {
  screen: AnalyzedScreen;
  root: Element;
  title: string;
  route: string;
  componentName: string;
}

const RESERVED_NAMES = ["App", "Link", "NavLink", "Navigate", "Route", "Routes", "ScrollToTop", "StrictMode"];

export function generateProject(analysis: Analysis, options: GenerateOptions = {}): GenerationResult {
  const warnings = new WarningCollector();
  warnings.addAll(analysis.warnings);
  const projectName = toPackageName(options.projectName || analysis.suggestedName);

  const units = planPages(analysis, options, warnings);
  if (units.length === 0) {
    warnings.add("error", "No screens selected. Include at least one screen to generate a project.");
    return { projectName, files: [], pages: [], components: [], warnings: warnings.list() };
  }

  const resolveRoute = createRouteResolver(analysis, units, warnings);
  const resolveAsset = (url: string, doc: DocInfo): string => {
    const trimmed = url.trim();
    if (!trimmed || isExternalUrl(trimmed)) return url;
    const [path, suffix] = splitUrlSuffix(trimmed);
    const target = resolveRelative(doc.path, path);
    if (analysis.files.assets.has(target)) return `/${encodeURI(target)}${suffix}`;
    warnings.add("warning", `Missing file "${trimmed}" (referenced in ${doc.path}). Add it to public/ or update the path.`);
    return url;
  };

  const componentOf = new Map<Element, string>();
  const componentProps = new Map<Element, string>();
  const warn = (level: WarningLevel, message: string) => warnings.add(level, message);
  const isFlex = createFlexDetector(analysis);
  const baseContext = (doc: DocInfo, imports: FileImports = createImports()): PrintContext => ({
    imports,
    doc,
    componentOf,
    componentProps,
    self: null,
    active: null,
    idScope: null,
    slots: null,
    interactions: new Map(),
    forms: new Map(),
    isFlex,
    resolveRoute,
    resolveAsset,
    warn,
  });
  const withInteractions = (ctx: PrintContext, root: Element): PrintContext => {
    const skip = (el: Element) => componentOf.has(el) && el !== ctx.self;
    return {
      ...ctx,
      interactions: prepareInteractions(root, skip, ctx.imports, warn),
      forms: prepareForms(root, skip, ctx.imports, warn),
    };
  };

  const usedNames = new Set([...RESERVED_NAMES, ...units.map((u) => u.componentName)]);
  const shared = extractComponents(
    units.map((u) => ({ screenId: u.screen.id, route: u.route, doc: u.screen.doc, root: u.root })),
    (doc) => baseContext(doc),
    componentOf,
    componentProps,
    usedNames,
    warn,
  );
  // Long pages are split into one component per section, after shared parts are known.
  const sections = planSections(
    units.map((u) => ({ screen: u.screen, root: u.root, componentName: u.componentName })),
    componentOf,
    usedNames,
  );
  const sectionNames = new Set(sections.map((s) => s.name));

  const files: OutputFile[] = [];
  const pages: GeneratedPage[] = [];
  const components: GeneratedComponent[] = [];
  const docs = [...new Set(units.map((u) => u.screen.doc))];
  const tailwind = detectTailwind(docs, warn);
  const dataNames = new Set<string>();
  const designScripts = emitDesignScripts(docs, analysis, files, warnings, tailwind);

  for (const unit of units) {
    const imports = createImports();
    const body = printElement(unit.root, withInteractions(baseContext(unit.screen.doc, imports), unit.root), 2);
    const sources = designScripts.get(unit.screen.doc);
    const screenCss = (unit.screen.doc.screenCss.get(unit.screen.id) ?? [])
      .map((css) => rewriteCssUrls(css, (url) => resolveAsset(url, unit.screen.doc)))
      .join("\n\n");
    const extra: ModuleExtras = { imports: [], constants: [], hooks: [] };
    if (sources) {
      extra.imports.push(`import { useDesignScripts } from "../lib/useDesignScripts";`);
      extra.constants.push(`const DESIGN_SCRIPTS: string[] = ${JSON.stringify(sources)};`);
      extra.hooks.push("  useDesignScripts(DESIGN_SCRIPTS);");
    }
    if (screenCss) extra.imports.push(`import "./${unit.componentName}.css";`);
    addModules(unit.componentName.replace(/Page$/, ""), imports, files, extra, dataNames);

    const file = `src/pages/${unit.componentName}.tsx`;
    files.push({ path: file, data: moduleSource(unit.componentName, imports, body, extra, "../components/", [], sectionNames) });
    if (screenCss) files.push({ path: `src/pages/${unit.componentName}.css`, data: `${screenCss}\n` });
    pages.push({
      screenId: unit.screen.id,
      title: unit.title,
      route: unit.route,
      componentName: unit.componentName,
      file,
    });
  }

  for (const component of shared) {
    const imports = createImports();
    component.props?.names.forEach((name) => imports.names.add(name));
    const ctx: PrintContext = withInteractions(
      {
        ...baseContext(component.doc, imports),
        self: component.element,
        active: component.active,
        idScope: { screenId: component.screenId, replacement: toKebab(component.name) },
        slots: component.props
          ? { root: component.element, mode: "fill", captured: new Map(), fills: component.props.fills, allowLists: true }
          : null,
      },
      component.element,
    );
    const body = printElement(component.element, ctx, 2);
    const extra: ModuleExtras = { imports: [], constants: [], hooks: [] };
    addModules(component.name, imports, files, extra, dataNames);
    const file = `src/components/${component.name}.tsx`;
    files.push({ path: file, data: moduleSource(component.name, imports, body, extra, "./", component.props?.names) });
    components.push({ name: component.name, file, usedIn: component.usedIn });
  }

  for (const section of sections) {
    const imports = createImports();
    const ctx = withInteractions({ ...baseContext(section.doc, imports), self: section.element }, section.element);
    const body = printElement(section.element, ctx, 2);
    const extra: ModuleExtras = { imports: [], constants: [], hooks: [] };
    addModules(section.name, imports, files, extra, dataNames);
    files.push({
      path: `src/sections/${section.name}.tsx`,
      data: moduleSource(section.name, imports, body, extra, "../components/", [], sectionNames, "./"),
    });
  }

  if (designScripts.size) files.push({ path: "src/lib/useDesignScripts.ts", data: USE_DESIGN_SCRIPTS });
  files.push({ path: "src/styles/global.css", data: globalCss(docs, resolveAsset, tailwind) });
  files.push({ path: "src/App.tsx", data: appTsx(pages) });
  files.push({ path: "src/main.tsx", data: MAIN_TSX });
  files.push({ path: "src/vite-env.d.ts", data: VITE_ENV });
  files.push({ path: "index.html", data: buildIndexHtml(projectName, docs, units, analysis, warnings, tailwind) });
  files.push({ path: "package.json", data: packageJson(projectName, tailwind?.version ?? null) });
  files.push({ path: "vite.config.ts", data: tailwind?.version === 4 ? VITE_CONFIG_TAILWIND_V4 : VITE_CONFIG });
  if (tailwind?.version === 3) {
    files.push({ path: "tailwind.config.js", data: tailwind.config! });
    files.push({ path: "postcss.config.js", data: POSTCSS_CONFIG });
  }
  files.push({ path: "tsconfig.json", data: TSCONFIG });
  files.push({ path: ".gitignore", data: GITIGNORE });
  const written = new Set(files.map((f) => f.path));
  for (const [path, data] of analysis.files.assets) {
    if (!written.has(`public/${path}`)) files.push({ path: `public/${path}`, data });
  }

  const finalWarnings = warnings.list();
  files.push({ path: "README.md", data: readme(projectName, pages, components, finalWarnings) });

  return {
    projectName,
    files: sortFiles(files),
    pages,
    components: components.sort((a, b) => a.name.localeCompare(b.name)),
    warnings: finalWarnings,
  };
}

function planPages(analysis: Analysis, options: GenerateOptions, warnings: WarningCollector): PageUnit[] {
  const configs = options.screens ?? defaultScreenConfig(analysis);
  const screensById = new Map(analysis.screens.map((s) => [s.id, s]));
  const usedRoutes = new Set<string>();
  const usedNames = new Set(RESERVED_NAMES);
  const units: PageUnit[] = [];

  for (const config of configs) {
    const screen = screensById.get(config.id);
    if (!screen || !config.include) continue;

    const title = collapseWhitespace(config.title) || screen.title;
    const wanted = normalizeRoute(config.route || screen.route);
    const route = uniqueName(wanted, usedRoutes, "-");
    if (route !== wanted) warnings.add("warning", `Route "${wanted}" is used twice; "${title}" was given "${route}".`);

    const base = toPascal(title) || toPascal(screen.id) || "Screen";
    const componentName = uniqueName(`${base}Page`, usedNames);
    units.push({ screen, root: pageRoot(screen), title, route, componentName });
  }
  return units;
}

/** Screens that are a whole <body> get a wrapper div carrying the body's attributes. */
function pageRoot(screen: AnalyzedScreen): Element {
  if (!screen.isBody) return screen.element;
  const attrs = screen.element.attrs.filter((a) => !a.name.startsWith("on"));
  if (!attrs.some((a) => a.name === "data-screen")) attrs.push({ name: "data-screen", value: screen.id });
  return createSyntheticElement("div", attrs, screen.element.childNodes);
}

function createRouteResolver(
  analysis: Analysis,
  units: PageUnit[],
  warnings: WarningCollector,
): (el: Element, doc: DocInfo) => string | null {
  const routeById = new Map(units.map((u) => [u.screen.id, u.route]));
  const knownIds = new Set(analysis.screens.map((s) => s.id));
  const homeRoute = units.find((u) => u.route === "/")?.route ?? units[0].route;
  const byFile = new Map(analysis.screens.filter((s) => s.isBody).map((s) => [s.doc.path, s.id]));
  // Without the prompt's data-goto markers, buttons and links whose text names a screen are linked to it.
  const byTitle =
    analysis.mode === "spec" ? new Map<string, string>() : new Map(units.map((u) => [labelKey(u.title), u.route]));
  const cache = new Map<Element, string | null>();

  const resolve = (el: Element, doc: DocInfo): string | null => {
    const goto = getAttr(el, "data-goto");
    if (goto !== null) {
      const id = toKebab(goto);
      const route = routeById.get(id);
      if (route) return route;
      warnings.add(
        "warning",
        knownIds.has(id)
          ? `Links to "${goto}" were left unlinked because that screen is excluded.`
          : `data-goto="${goto}" points to a screen that does not exist.`,
      );
      return null;
    }

    if (el.tagName === "a") {
      const href = (getAttr(el, "href") ?? "").trim();
      if (href.startsWith("#") && href.length > 1) {
        const route = routeById.get(toKebab(href.slice(1)));
        if (route) return route;
      } else if (href && !isExternalUrl(href)) {
        const target = resolveRelative(doc.path, href);
        if (target === "" || target === "index.html") return homeRoute;
        const id = byFile.get(target);
        if (id && routeById.has(id)) return routeById.get(id)!;
      }
      if (href && href !== "#") return null;
    }

    if (byTitle.size && (el.tagName === "a" || el.tagName === "button")) {
      const route = byTitle.get(labelKey(textContent(el)));
      if (route) return route;
    }
    return null;
  };

  return (el, doc) => {
    if (!cache.has(el)) cache.set(el, resolve(el, doc));
    return cache.get(el)!;
  };
}

/** "📈 Activity" and "activity" compare equal: letters and digits only, lower case. */
function labelKey(text: string): string {
  return collapseWhitespace(text.replace(/[^\p{L}\p{N}\s]/gu, " ")).toLowerCase();
}

interface ModuleExtras {
  imports: string[];
  /** Module-level declarations placed before the component. */
  constants: string[];
  /** Lines at the top of the component body. */
  hooks: string[];
}

/**
 * Moves a page's or component's list data and form value types out of its file: interfaces go to
 * `src/types/<name>.ts`, the arrays to `src/data/<name>.ts` (`.tsx` when they hold icons). Swapping
 * the design's sample data for a fetch then only touches the data file.
 */
function addModules(
  base: string,
  imports: FileImports,
  files: OutputFile[],
  extra: ModuleExtras,
  usedNames: Set<string>,
): void {
  const blocks = imports.data;
  if (!blocks.length && !imports.forms.length) return;
  const name = uniqueName(toKebab(base) || "data", usedNames, "-");

  const types: string[] = [];
  for (const block of blocks) for (const type of block.types) if (!types.includes(type)) types.push(type);
  for (const form of imports.forms) types.push(form.type);
  if (types.length) {
    const header = types.some((t) => /\bReactNode\b/.test(t)) ? [`import type { ReactNode } from "react";`] : [];
    files.push({ path: `src/types/${name}.ts`, data: `${[...header, ...types].join("\n\n")}\n` });
  }

  if (blocks.length) {
    const hasNodes = blocks.some((b) => b.hasNodes);
    const used = [...new Set(blocks.flatMap((b) => (b.usesType ? [b.usesType] : [])))];
    const header = used.length ? [`import type { ${used.join(", ")} } from "../types/${name}";`] : [];
    files.push({
      path: `src/data/${name}.${hasNodes ? "tsx" : "ts"}`,
      data: `${[...header, ...blocks.map((b) => b.source)].join("\n\n")}\n`,
    });
    extra.imports.push(`import { ${blocks.map((b) => b.name).join(", ")} } from "../data/${name}";`);
  }
  if (imports.forms.length) {
    extra.imports.push(`import type { ${imports.forms.map((f) => f.typeName).join(", ")} } from "../types/${name}";`);
  }
}

function moduleSource(
  name: string,
  imports: FileImports,
  body: string[],
  extra: ModuleExtras,
  componentDir: string,
  propNames: string[] = [],
  sectionNames: Set<string> = new Set(),
  sectionDir = "../sections/",
): string {
  const lines: string[] = [];
  const reactTypes = [...(imports.cssProperties ? ["CSSProperties"] : []), ...imports.reactTypes].sort();
  if (imports.state) lines.push(`import { useState${reactTypes.length ? `, type ${reactTypes.join(", type ")}` : ""} } from "react";`);
  else if (reactTypes.length) lines.push(`import type { ${reactTypes.join(", ")} } from "react";`);
  const router = [
    imports.link && "Link",
    imports.navLink && "NavLink",
    imports.location && "useLocation",
    imports.navigate && "useNavigate",
  ].filter(Boolean);
  if (router.length) lines.push(`import { ${router.join(", ")} } from "react-router-dom";`);
  // Shared components first, then the page's own sections.
  const byKind = (name: string) => `${sectionNames.has(name) ? 1 : 0}${name}`;
  for (const component of [...imports.components].sort((x, y) => byKind(x).localeCompare(byKind(y)))) {
    lines.push(`import ${component} from "${sectionNames.has(component) ? sectionDir : componentDir}${component}";`);
  }
  lines.push(...extra.imports);
  if (extra.constants.length) lines.push("", ...extra.constants);

  const hooks: string[] = [...extra.hooks, ...imports.hooks];
  if (imports.navigate) hooks.push("  const navigate = useNavigate();");
  if (imports.location) hooks.push("  const { pathname } = useLocation();");

  return [
    ...lines,
    ...(lines.length ? [""] : []),
    propNames.length
      ? `export default function ${name}({ ${propNames.join(", ")} }: { ${propNames.map((n) => `${n}: string`).join("; ")} }) {`
      : `export default function ${name}() {`,
    ...hooks,
    ...(hooks.length ? [""] : []),
    "  return (",
    ...body,
    "  );",
    "}",
    "",
  ].join("\n");
}

/**
 * Writes the design's classic scripts to public/ (wrapped so they can run again) and returns, per
 * document, the script URLs its pages load. Documents with only inline handlers get an empty list.
 */
function emitDesignScripts(
  docs: DocInfo[],
  analysis: Analysis,
  files: OutputFile[],
  warnings: WarningCollector,
  tailwind: TailwindSetup | null,
): Map<DocInfo, string[]> {
  const result = new Map<DocInfo, string[]>();
  const written = new Set<string>();
  const handlerDocs: string[] = [];
  let count = 0;

  for (const doc of docs) {
    const sources: string[] = [];
    let inline = 0;
    for (const script of doc.scripts) {
      if (script.kind === "remote" || tailwind?.scripts.has(script)) continue;
      let path: string;
      let code: string;
      if (script.kind === "local") {
        path = script.path;
        code = decodeText(analysis.files.assets.get(script.path)!);
      } else {
        inline++;
        path = `design-scripts/${basename(doc.path).replace(/\.html?$/i, "")}-inline-${inline}.js`;
        code = script.code;
      }
      if (!written.has(path)) {
        written.add(path);
        files.push({ path: `public/${path}`, data: wrapDesignScript(code) });
        count++;
      }
      sources.push(`/${encodeURI(path)}`);
    }
    if (sources.length || doc.hasInlineHandlers) result.set(doc, sources);
    if (doc.hasInlineHandlers) handlerDocs.push(doc.path);
  }

  // These scripts are not React code: they work on the page's DOM after it renders. Say so plainly.
  if (count) {
    warnings.add(
      "warning",
      `Kept ${count} script${count === 1 ? "" : "s"} from the design but did not convert ${count === 1 ? "it" : "them"} to React: ${count === 1 ? "it runs" : "they run"} on the rendered page through src/lib/useDesignScripts.ts. Re-implement that behavior with React state and event handlers (toggles and tabs can be declared with data-toggle / data-tab-group to get it automatically).`,
    );
  }
  if (handlerDocs.length) {
    warnings.add(
      "warning",
      `Inline event handlers (onclick…) in ${handlerDocs.join(", ")} were kept as attributes and are not React handlers: they only work through src/lib/useDesignScripts.ts.`,
    );
  }
  return result;
}

function globalCss(
  docs: DocInfo[],
  resolveAsset: (url: string, doc: DocInfo) => string,
  tailwind: TailwindSetup | null,
): string {
  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const doc of docs) {
    for (const css of doc.globalCss) {
      if (seen.has(css)) continue;
      seen.add(css);
      blocks.push(rewriteCssUrls(css, (url) => resolveAsset(url, doc)));
    }
  }
  const css = blocks.length ? `${blocks.join("\n\n")}\n` : tailwind ? "" : "/* The design had no shared <style> block. */\n";
  return tailwind ? withTailwindCss(tailwind.version, css) : css;
}

function buildIndexHtml(
  projectName: string,
  docs: DocInfo[],
  units: PageUnit[],
  analysis: Analysis,
  warnings: WarningCollector,
  tailwind: TailwindSetup | null,
): string {
  const links: string[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    for (const link of doc.headLinks) {
      let href = getAttr(link, "href")!.trim();
      if (!isExternalUrl(href)) {
        const target = resolveRelative(doc.path, href);
        if (!analysis.files.assets.has(target)) {
          warnings.add("warning", `Missing stylesheet or icon "${href}" (linked in ${doc.path}).`);
          continue;
        }
        href = `/${encodeURI(target)}`;
      }
      if (seen.has(href)) continue;
      seen.add(href);
      const attrs = link.attrs
        .filter((a) => !a.name.startsWith("on"))
        .map((a) => `${a.name}="${escapeHtml(a.name === "href" ? href : a.value)}"`);
      links.push(`<link ${attrs.join(" ")} />`);
    }
  }

  // Scripts from CDNs (Tailwind, Chart.js…) load once for the whole app, before React starts.
  const scripts = [
    ...new Set(
      docs.flatMap((doc) =>
        doc.scripts.flatMap((script) => {
          if (script.kind !== "remote" || tailwind?.scripts.has(script)) return [];
          const attrs = script.element.attrs
            .filter((a) => !a.name.startsWith("on"))
            .map((a) => (a.value === "" ? a.name : `${a.name}="${escapeHtml(a.value)}"`));
          return [`<script ${attrs.join(" ")}></script>`];
        }),
      ),
    ),
  ];

  const first = docs[0];
  // Body attributes of whole-body screens live on each page's wrapper instead.
  const bodyAttrs = units.some((u) => u.screen.isBody)
    ? ""
    : first.bodyAttrs.map((a) => ` ${a.name}="${escapeHtml(a.value)}"`).join("");

  const metas: string[] = [];
  const seenMetas = new Set<string>();
  for (const doc of docs) {
    for (const meta of doc.headMetas) {
      const key = (getAttr(meta, "name") ?? getAttr(meta, "property") ?? "").toLowerCase();
      if (seenMetas.has(key)) continue;
      seenMetas.add(key);
      const attrs = meta.attrs.map((a) => `${a.name}="${escapeHtml(a.value)}"`);
      metas.push(`<meta ${attrs.join(" ")} />`);
    }
  }

  return indexHtml({
    title: first.title || toTitle(projectName),
    lang: first.lang || "en",
    dir: first.dir,
    metas,
    links,
    scripts,
    bodyAttrs,
  });
}

function sortFiles(files: OutputFile[]): OutputFile[] {
  const rank = (path: string) => (path.startsWith("src/") ? 0 : path.startsWith("public/") ? 2 : 1);
  return files.sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path));
}
