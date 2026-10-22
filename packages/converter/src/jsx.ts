import type { DocInfo } from "./analyze";
import {
  BOOLEAN_PROPS,
  HTML_PASSTHROUGH,
  HTML_RENAMED,
  KNOWN_HTML_ELEMENTS,
  NUMBER_PROPS,
  PHRASING_ELEMENTS,
  SKIPPED_ELEMENTS,
  SVG_CAMEL,
  camelCaseAttribute,
} from "./attributes";
import { cssPropertyToJs, parseInlineStyle, rewriteCssUrls } from "./css";
import {
  SVG_NS,
  classList,
  collapseWhitespace,
  findAll,
  getAttr,
  hasAttr,
  isElement,
  isText,
  textContent,
  type ChildNode,
  type Element,
  type ParentNode,
  type TextNode,
} from "./dom";
import { bindingProps, isControlled, type FormBinding } from "./forms";
import type { Interaction } from "./interactions";
import { planLists } from "./lists";
import type { WarningLevel } from "./types";

/** One list's data: exported interfaces (`src/types`) and an exported array (`src/data`). */
export interface DataBlock {
  /** Exported array name, e.g. `stats`. */
  name: string;
  /** Interface the array is typed with, or null for a plain `string[]`. */
  usesType: string | null;
  /** Interface declarations the list needs, dependencies first. */
  types: string[];
  /** Names declared by `types`. */
  typeNames: string[];
  /** The exported array. */
  source: string;
  /** The array holds JSX (icons), so the data module needs a .tsx extension. */
  hasNodes: boolean;
}

/** A form's state: its values interface and the code that declares and handles it. */
export interface FormBlock {
  /** Interface source for the form's values (goes to `src/types`). */
  type: string;
  typeName: string;
}

export interface FileImports {
  link: boolean;
  navLink: boolean;
  navigate: boolean;
  location: boolean;
  state: boolean;
  cssProperties: boolean;
  /** Type-only imports from "react" (FormEvent…). */
  reactTypes: Set<string>;
  components: Set<string>;
  /** Data arrays behind `.map()` lists; they are written to `src/data/` and imported. */
  data: DataBlock[];
  /** State hooks declared at the top of the component. */
  hooks: string[];
  /** Forms with state: their values interfaces (written to `src/types`). */
  forms: FormBlock[];
  /** Identifiers already taken in this file. */
  names: Set<string>;
}

/** How the current page is highlighted inside a shared component (from the classes its variants used). */
export interface ActiveState {
  /** Class names that marked the current page, e.g. "is-active". */
  classes: string[];
  /**
   * Kinds (tag + other classes, see `elementKind`) of navigating elements that carried the class,
   * e.g. "a.nav-item". Other links in the component, like an "Upgrade" link, never become active.
   */
  navKinds: Set<string>;
  /** Kinds of non-navigating parents that carried it, e.g. "li" in `<li class="active"><a data-goto>`. */
  holderKinds: Set<string>;
  /**
   * Other routes on which an item is shown active, learned from the design: when the Order details
   * screen highlights "Orders", the Orders item stays active on /order-details too.
   */
  alsoActiveOn: Map<string, string[]>;
}

/** Identifies "the same kind of element" across variants: its tag plus its classes, minus active ones. */
export function elementKind(el: Element, activeClasses: Iterable<string>): string {
  const active = new Set(activeClasses);
  return [el.tagName, ...classList(el).filter((c) => !active.has(c)).sort()].join(".");
}

/** What a varying value is, used to name the data field or prop it becomes. */
export interface SlotHint {
  kind: "text" | "attr" | "class" | "style" | "route" | "svg" | "list" | "activeOn";
  /** Element the value belongs to (the parent element for text). */
  el: Element;
  /** Attribute or CSS property name. */
  name: string;
}

export interface CapturedSlot {
  value: string;
  hint: SlotHint;
  /** A nested list slot: the repeated elements it stands for. */
  items?: Element[];
}

/** A run of repeated elements inside a list item (tags in a card) that becomes a nested `.map()`. */
export interface NestedRun {
  id: string;
  first: Element;
  last: Element;
  items: Element[];
}

/**
 * Lets the printer treat texts and attribute values under `root` as slots.
 * - capture: values are recorded and printed as placeholders, so two subtrees that differ only in
 *   their values print the same "skeleton".
 * - fill: slots listed in `fills` are printed as JavaScript expressions (`stat.label`, `title`).
 * Slots are identified by their position under `root`, so they line up between similar subtrees.
 */
export interface SlotState {
  root: Element;
  mode: "capture" | "fill";
  captured: Map<string, CapturedSlot>;
  fills: Map<string, string>;
  /** Fill mode: `key` given to the root element of a `.map()` item. */
  keyExpr?: string;
  /** Nested runs under `root`, by their container element. */
  nested?: Map<Element, NestedRun>;
  /** Fill mode: prints the `.map()` of a nested run, by run id. Runs without one print as written. */
  nestedRender?: Map<string, (depth: number) => string[]>;
  /** Lists may be planned while printing (a component with props, whose slots hold only its props). */
  allowLists?: boolean;
}

export interface PrintContext {
  imports: FileImports;
  doc: DocInfo;
  /** Elements printed as `<Name />` because they were extracted into shared components. */
  componentOf: Map<Element, string>;
  /** Props passed to a component reference, already formatted (`title="Orders"`). */
  componentProps: Map<Element, string>;
  /** Root element of the component being printed, so it is not replaced by a reference to itself. */
  self: Element | null;
  /** Set while printing a shared component: navigation items get route-aware active classes. */
  active: ActiveState | null;
  /**
   * Set while printing a shared component: ids made unique per screen ("orders-search") are
   * renamed after the component ("topbar-search"), so every copy produces the same markup.
   */
  idScope: { screenId: string; replacement: string } | null;
  slots: SlotState | null;
  /** Toggles and tabs declared with data-toggle / data-tab, turned into React state. */
  interactions: Map<Element, Interaction>;
  /** Form controls bound to React state, and the forms that own them. */
  forms: Map<Element, FormBinding>;
  /** Whether a container lays its children out as flex or grid items (whitespace between them is not rendered). */
  isFlex: (el: Element, doc: DocInfo) => boolean;
  resolveRoute: (el: Element, doc: DocInfo) => string | null;
  resolveAsset: (url: string, doc: DocInfo) => string;
  warn: (level: WarningLevel, message: string) => void;
}

export function createImports(): FileImports {
  return {
    link: false,
    navLink: false,
    navigate: false,
    location: false,
    state: false,
    cssProperties: false,
    reactTypes: new Set(),
    components: new Set(),
    data: [],
    hooks: [],
    forms: [],
    names: new Set(["navigate", "pathname", "index", "key", "props"]),
  };
}

export const MAX_LINE = 100;
export const INDENT = "  ";
// HTML collapses only these characters; a non-breaking space must survive as &nbsp;.
const HTML_WHITESPACE = /[ \t\n\r\f]+/g;
const FLOW2REPO_ATTRS = new Set([
  "data-goto", "data-component", "data-home", "data-route", "data-f2r",
  "data-toggle", "data-toggle-target", "data-close", "data-tab", "data-tab-group", "data-tab-panel",
]);
const LEGACY_INLINE = new Set(["font", "big", "tt", "strike", "acronym", "nobr", "blink"]);
const ASSET_ATTRS = new Set(["src", "poster", "data"]);
const ID_REFERENCE_ATTRS = new Set([
  "id", "for", "list", "form", "headers", "aria-labelledby", "aria-describedby", "aria-controls", "aria-owns",
]);
const LITERAL_VALUE_INPUTS = new Set(["checkbox", "radio", "submit", "reset", "button", "image"]);
const OPEN_CLASS = "is-open";

export function printElement(el: Element, ctx: PrintContext, depth: number): string[] {
  const pad = INDENT.repeat(depth);
  const component = ctx.componentOf.get(el);
  if (component && el !== ctx.self) {
    ctx.imports.components.add(component);
    const props = ctx.componentProps.get(el);
    return [`${pad}<${component}${props ? ` ${props}` : ""} />`];
  }

  // An icon that differs between similar subtrees becomes one value (`icon: <svg …/>`).
  if (ctx.slots && el.namespaceURI === SVG_NS && el.tagName === "svg") {
    const id = slotId(el, ctx.slots.root, "@svg");
    if (ctx.slots.mode === "capture") {
      const value = printElement(el, { ...ctx, slots: null }, 0).join("\n");
      ctx.slots.captured.set(id, { value, hint: { kind: "svg", el, name: "svg" } });
      return [`${pad}{§${id}§}`];
    }
    const expr = ctx.slots.fills.get(id);
    if (expr) return [`${pad}{${expr}}`];
  }

  const { tag, attrs, hasValueChildren } = convertElement(el, ctx);
  if (ctx.slots?.mode === "fill" && ctx.slots.root === el && ctx.slots.keyExpr) {
    attrs.unshift(`key={${ctx.slots.keyExpr}}`);
  }
  const preformatted = el.tagName === "pre";
  const children = hasValueChildren ? [] : printableChildren(el, preformatted);
  if (children.length === 0) return openTag(tag, attrs, pad, true);

  const open = openTag(tag, attrs, pad, false);
  if (preformatted) {
    const inner = printRaw(children, ctx);
    return open.length === 1 ? [`${open[0]}${inner}</${tag}>`] : [...open, `${pad}${INDENT}${inner}`, `${pad}</${tag}>`];
  }

  // Repeated runs inside a list item (tags in a card) are looked up by their container element.
  const nestedRun = ctx.slots?.nested?.get(el);
  // Lists are planned outside slot printing, so items are never nested in another capture.
  const lists = planLists(children, ctx, printElement);
  const flex = ctx.isFlex(el, ctx.doc);

  if (open.length === 1 && lists.size === 0 && !nestedRun) {
    const inline = printInline(children, ctx);
    if (inline !== null) {
      const line = `${open[0]}${inline}</${tag}>`;
      if (line.length <= MAX_LINE) return [line];
    }
  }

  const lines = [...open];
  for (let i = 0; i < children.length; i++) {
    const list = lists.get(i);
    if (list) {
      lines.push(...list.render(depth + 1));
      i = list.end;
      continue;
    }
    if (nestedRun && children[i] === nestedRun.first) {
      const slots = ctx.slots!;
      const render = slots.mode === "fill" ? slots.nestedRender?.get(nestedRun.id) : undefined;
      if (slots.mode === "capture") {
        slots.captured.set(nestedRun.id, {
          value: "",
          hint: { kind: "list", el, name: "list" },
          items: nestedRun.items,
        });
        lines.push(`${INDENT.repeat(depth + 1)}{§${nestedRun.id}§}`);
        i = children.indexOf(nestedRun.last);
        continue;
      }
      if (render) {
        lines.push(...render(depth + 1));
        i = children.indexOf(nestedRun.last);
        continue;
      }
    }
    lines.push(...printChild(children[i], children[i - 1], children[i + 1], ctx, depth + 1, flex));
  }
  lines.push(`${pad}</${tag}>`);
  return lines;
}

function printChild(
  child: ChildNode,
  prev: ChildNode | undefined,
  next: ChildNode | undefined,
  ctx: PrintContext,
  depth: number,
  flex = false,
): string[] {
  const pad = INDENT.repeat(depth);
  if (!isText(child)) return printElement(child as Element, ctx, depth);

  // JSX drops whitespace that contains a line break, so spaces that are visible in HTML
  // (between two inline neighbours) are written explicitly as {" "}. Whitespace next to a
  // block element is not rendered by browsers, so it is dropped. Flex and grid containers do not
  // render the whitespace between their items either.
  const text = child.value.replace(HTML_WHITESPACE, " ");
  if (text === " ") {
    if (flex) return [];
    const visible = (node?: ChildNode) => !!node && !(isText(node) && !trimHtmlWhitespace(node.value)) && isInline(node, ctx);
    return visible(prev) && visible(next) ? [`${pad}{" "}`] : [];
  }
  let line = printText(child, trimHtmlWhitespace(text), ctx);
  if (!flex && text.startsWith(" ") && prev && isInline(prev, ctx)) line = `{" "}${line}`;
  if (!flex && text.endsWith(" ") && next && isInline(next, ctx)) line = `${line}{" "}`;
  return [`${pad}${line}`];
}

/** Prints children on one line (text mixed with inline elements), or null when that is not possible. */
function printInline(children: ChildNode[], ctx: PrintContext): string | null {
  let out = "";
  for (const child of children) {
    if (isText(child)) {
      const text = child.value.replace(HTML_WHITESPACE, " ");
      const core = trimHtmlWhitespace(text);
      if (!core) {
        out += text;
        continue;
      }
      out += `${text.startsWith(" ") ? " " : ""}${printText(child, core, ctx)}${text.endsWith(" ") ? " " : ""}`;
      continue;
    }
    const el = child as Element;
    if (!PHRASING_ELEMENTS.has(el.tagName) || ctx.componentOf.has(el)) return null;
    const lines = printElement(el, ctx, 0);
    if (lines.length !== 1) return null;
    out += lines[0];
  }
  return trimHtmlWhitespace(out);
}

/** Content of <pre>: whitespace is significant, so text is written as string expressions. */
function printRaw(children: ChildNode[], ctx: PrintContext): string {
  return children
    .map((child) => {
      if (isText(child)) return `{${JSON.stringify(child.value)}}`;
      const el = child as Element;
      const { tag, attrs } = convertElement(el, ctx);
      const attrText = attrs.map((a) => ` ${a}`).join("");
      const kids = printableChildren(el, true);
      return kids.length ? `<${tag}${attrText}>${printRaw(kids, ctx)}</${tag}>` : `<${tag}${attrText} />`;
    })
    .join("");
}

function printableChildren(el: Element, keepWhitespace: boolean): ChildNode[] {
  const children = el.childNodes.filter((child) => {
    if (isText(child)) return true;
    if (!isElement(child)) return false;
    // Scripts are collected per document and loaded by useDesignScripts.
    return !SKIPPED_ELEMENTS.has(child.tagName);
  });
  if (!keepWhitespace && children.every((c) => isText(c) && !trimHtmlWhitespace(c.value))) return [];
  return children;
}

function isInline(node: ChildNode, ctx: PrintContext): boolean {
  if (isText(node)) return true;
  const el = node as Element;
  return PHRASING_ELEMENTS.has(el.tagName) && !ctx.componentOf.has(el);
}

function openTag(tag: string, attrs: string[], pad: string, selfClose: boolean): string[] {
  const line = `${pad}<${tag}${attrs.map((a) => ` ${a}`).join("")}${selfClose ? " />" : ">"}`;
  if (line.length <= MAX_LINE || attrs.length === 0) return [line];
  return [`${pad}<${tag}`, ...attrs.map((a) => `${pad}${INDENT}${a}`), `${pad}${selfClose ? "/>" : ">"}`];
}

/* ---------- Slots ---------- */

/** Text and elements that count when lining up similar subtrees (blank text and scripts do not). */
export function isMeaningful(node: ChildNode): boolean {
  if (isText(node)) return trimHtmlWhitespace(node.value) !== "";
  return isElement(node) && !SKIPPED_ELEMENTS.has(node.tagName);
}

export function slotId(node: ChildNode, root: Element, suffix: string): string {
  const path: number[] = [];
  let current: ChildNode = node;
  while (current !== root) {
    const parent: ParentNode | null = current.parentNode;
    if (!parent) break;
    path.push(parent.childNodes.filter(isMeaningful).indexOf(current));
    current = parent as ChildNode;
  }
  return `${path.reverse().join(".")}${suffix}`;
}

type SlotResult = { type: "literal" } | { type: "placeholder"; token: string } | { type: "expr"; expr: string };

function useSlot(ctx: PrintContext, node: ChildNode, suffix: string, hint: SlotHint, value: string): SlotResult {
  const slots = ctx.slots;
  if (!slots) return { type: "literal" };
  const id = slotId(node, slots.root, suffix);
  if (slots.mode === "capture") {
    slots.captured.set(id, { value, hint });
    return { type: "placeholder", token: `§${id}§` };
  }
  const expr = slots.fills.get(id);
  return expr ? { type: "expr", expr } : { type: "literal" };
}

function printText(node: TextNode, text: string, ctx: PrintContext): string {
  const result = useSlot(ctx, node, "#", { kind: "text", el: node.parentNode as Element, name: "text" }, text);
  if (result.type === "placeholder") return result.token;
  if (result.type === "expr") return `{${result.expr}}`;
  return escapeText(text);
}

/** A string-valued prop, or the slot that replaces its value. */
function stringProp(
  ctx: PrintContext,
  el: Element,
  raw: string,
  prop: string,
  value: string,
  kind: SlotHint["kind"] = "attr",
): string {
  const result = useSlot(ctx, el, `@${raw}`, { kind, el, name: raw }, value);
  if (result.type === "placeholder") return `${prop}="${result.token}"`;
  if (result.type === "expr") return `${prop}={${result.expr}}`;
  return `${prop}="${escapeAttr(value)}"`;
}

/** A route as a JavaScript string expression. */
function routeExpr(ctx: PrintContext, el: Element, route: string): string {
  const result = useSlot(ctx, el, "@route", { kind: "route", el, name: "to" }, route);
  if (result.type === "placeholder") return `"${result.token}"`;
  if (result.type === "expr") return result.expr;
  return JSON.stringify(route);
}

/* ---------- Elements ---------- */

interface ConvertedElement {
  tag: string;
  attrs: string[];
  /** The element's text became a prop (textarea defaultValue), so its children are not printed. */
  hasValueChildren: boolean;
}

function convertElement(el: Element, ctx: PrintContext): ConvertedElement {
  const isSvg = el.namespaceURI === SVG_NS;
  let tag = el.tagName;
  if (!isSvg && !KNOWN_HTML_ELEMENTS.has(tag)) {
    const fallback = LEGACY_INLINE.has(tag) ? "span" : "div";
    ctx.warn("warning", `Converted unsupported element <${tag}> to <${fallback}>.`);
    tag = fallback;
  }

  const route = ctx.resolveRoute(el, ctx.doc);
  const active = ctx.active;
  // Route whose activity toggles this element's active classes (only inside shared components).
  let activeRoute: string | null = null;
  if (active && active.classes.length) {
    const kind = elementKind(el, active.classes);
    if (route && active.navKinds.has(kind)) activeRoute = route;
    else if (!route && active.holderKinds.has(kind)) activeRoute = singleNavRoute(el, ctx);
  }
  const interaction = route ? undefined : ctx.interactions.get(el);
  const binding = ctx.forms.get(el);
  const controlled = isControlled(binding) ? binding : null;

  // Inside list items, navigation items must print the same markup whatever their route or active
  // state, so those parts become values of the list (`to`, `activeOn`) instead of per-item code.
  let activeOnExpr: string | null = null;
  let uniformActive = false;
  if (activeRoute && route && tag === "a" && ctx.slots) {
    const id = slotId(el, ctx.slots.root, "@activeOn");
    if (ctx.slots.mode === "capture") {
      ctx.slots.captured.set(id, {
        value: JSON.stringify(active!.alsoActiveOn.get(activeRoute) ?? []),
        hint: { kind: "activeOn", el, name: "activeOn" },
      });
      uniformActive = true;
    } else {
      activeOnExpr = ctx.slots.fills.get(id) ?? null;
    }
  }

  const attrs: string[] = [];
  let hasValueChildren = false;
  let classWritten = false;

  const writeClass = () => {
    classWritten = true;
    const classes = classList(el);
    if (interaction && !activeRoute && (interaction.kind === "toggle-target" || interaction.kind === "tab")) {
      const flag = interaction.kind === "tab" ? interaction.group.activeClass : OPEN_CLASS;
      const base = classes.filter((c) => c !== flag).join(" ");
      const on = JSON.stringify([base, flag].filter(Boolean).join(" "));
      const off = base ? JSON.stringify(base) : "undefined";
      const condition =
        interaction.kind === "tab" ? `${interaction.group.value} === ${JSON.stringify(interaction.value)}` : interaction.state.open;
      attrs.push(`className={${condition} ? ${on} : ${off}}`);
      return;
    }
    if (!activeRoute) {
      if (classes.length) attrs.push(stringProp(ctx, el, "class", "className", classes.join(" "), "class"));
      return;
    }
    const base = classes.filter((c) => !active!.classes.includes(c)).join(" ");
    const on = JSON.stringify([base, ...active!.classes].filter(Boolean).join(" "));
    const off = base ? JSON.stringify(base) : "undefined";
    if (uniformActive) {
      attrs.push(`className={({ isActive }) => (isActive ? ${on} : ${off})}`);
      return;
    }
    if (activeOnExpr && route) {
      ctx.imports.location = true;
      attrs.push(`className={[${routeExpr(ctx, el, route)}, ...${activeOnExpr}].includes(pathname) ? ${on} : ${off}}`);
      return;
    }
    const routes = [activeRoute, ...(active!.alsoActiveOn.get(activeRoute) ?? [])];
    if (routes.length > 1) {
      ctx.imports.location = true;
      attrs.push(`className={${JSON.stringify(routes).replace(/,/g, ", ")}.includes(pathname) ? ${on} : ${off}}`);
    } else if (tag === "a" && route) {
      attrs.push(`className={({ isActive }) => (isActive ? ${on} : ${off})}`);
    } else {
      ctx.imports.location = true;
      attrs.push(`className={pathname === ${JSON.stringify(activeRoute)} ? ${on} : ${off}}`);
    }
  };

  // NavLink only knows its own route; items also active on other routes use useLocation instead.
  const useNavLink = !!activeRoute && !activeOnExpr && (uniformActive || !active!.alsoActiveOn.has(activeRoute));
  if (route && tag === "a") {
    const to = routeExpr(ctx, el, route);
    attrs.push(to.startsWith('"') ? `to=${to}` : `to={${to}}`);
    if (useNavLink) {
      ctx.imports.navLink = true;
      // `end` keeps "/" from matching every page; in a list it depends on the item's route.
      if (ctx.slots?.mode === "capture") attrs.push("end={§end§}");
      else if (!to.startsWith('"')) attrs.push(`end={${to} === "/"}`);
      else if (route === "/") attrs.push("end");
    } else {
      ctx.imports.link = true;
    }
  }

  for (const attr of el.attrs) {
    const raw = attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name;
    const value = attr.value;

    if (/^on[a-z]/.test(raw)) {
      // React has no string event handlers; useDesignScripts restores them as real attributes after render.
      attrs.push(stringProp(ctx, el, raw, `data-f2r-${raw}`, value));
      continue;
    }
    if (FLOW2REPO_ATTRS.has(raw)) continue;
    if (raw === "data-title" && hasAttr(el, "data-screen")) continue;
    if (raw === "class") {
      writeClass();
      continue;
    }
    if (raw === "aria-current" && activeRoute) continue;
    if (raw === "hidden" && interaction?.kind === "tab-panel") continue;
    // The tab state decides these now; keeping the design's static values would contradict it.
    if (interaction?.kind === "tab" && raw === "aria-selected") continue;
    if (interaction?.kind === "toggle-trigger" && raw === "aria-expanded") continue;
    if (raw === "style") {
      const style = printStyle(value, ctx, el);
      if (style) attrs.push(style);
      continue;
    }
    if (ctx.idScope && ID_REFERENCE_ATTRS.has(raw)) {
      attrs.push(stringProp(ctx, el, raw, HTML_RENAMED[raw] ?? raw, rescopeIds(value, ctx.idScope, componentIds(ctx))));
      continue;
    }
    if (raw.startsWith("data-") || raw.startsWith("aria-")) {
      attrs.push(stringProp(ctx, el, raw, raw, value));
      continue;
    }

    if (isSvg) {
      const svgProp = svgAttribute(raw, value, el, ctx);
      if (svgProp) attrs.push(svgProp);
      continue;
    }

    if (raw === "href") {
      if (tag === "a" && route) continue;
      if (ctx.idScope && value.startsWith("#")) {
        attrs.push(stringProp(ctx, el, raw, "href", `#${rescopeIds(value.slice(1), ctx.idScope, componentIds(ctx))}`));
        continue;
      }
      attrs.push(stringProp(ctx, el, raw, "href", ctx.resolveAsset(value, ctx.doc)));
      continue;
    }
    if (ASSET_ATTRS.has(raw)) {
      attrs.push(stringProp(ctx, el, raw, raw, ctx.resolveAsset(value, ctx.doc)));
      continue;
    }
    if (raw === "srcset") {
      attrs.push(stringProp(ctx, el, raw, "srcSet", rewriteSrcSet(value, ctx)));
      continue;
    }

    if (tag === "input" && raw === "value") {
      const type = (getAttr(el, "type") ?? "text").toLowerCase();
      if (controlled && controlled.kind !== "radio" && controlled.kind !== "checkbox" && controlled.kind !== "checkboxGroup") continue;
      attrs.push(stringProp(ctx, el, raw, LITERAL_VALUE_INPUTS.has(type) ? "value" : "defaultValue", value));
      continue;
    }
    if (tag === "input" && raw === "checked") {
      if (!controlled) attrs.push("defaultChecked");
      continue;
    }
    if (tag === "option" && raw === "selected") continue;

    const prop = HTML_RENAMED[raw] ?? (HTML_PASSTHROUGH.has(raw) ? raw : null);
    if (prop) {
      const formatted = formatProp(prop, value, ctx, el, raw);
      if (formatted) attrs.push(formatted);
    } else if (raw.includes("-")) {
      attrs.push(stringProp(ctx, el, raw, raw, value));
    } else {
      ctx.warn("info", `Dropped attribute "${raw}" on <${el.tagName}>: it has no React equivalent.`);
    }
  }

  if (!classWritten && (activeRoute || interaction?.kind === "toggle-target" || interaction?.kind === "tab")) writeClass();

  if (tag === "textarea") {
    const text = textContent(el);
    if (text && !controlled) attrs.push(text.includes("\n") ? `defaultValue={${JSON.stringify(text)}}` : stringProp(ctx, el, "value", "defaultValue", text));
    hasValueChildren = true;
  }
  if (tag === "select" && !controlled) {
    const defaultValue = selectDefaultValue(el);
    if (defaultValue) attrs.push(defaultValue);
  }
  if (binding) attrs.push(...bindingProps(binding));
  if (hasAttr(el, "contenteditable") && el.childNodes.length > 0) attrs.push("suppressContentEditableWarning");

  if (route && tag !== "a") {
    ctx.imports.navigate = true;
    attrs.push(`onClick={() => navigate(${routeExpr(ctx, el, route)})}`);
  }
  if (interaction) attrs.push(...interactionProps(interaction));

  if (route && tag === "a") tag = useNavLink ? "NavLink" : "Link";
  return { tag, attrs, hasValueChildren };
}

function interactionProps(interaction: Interaction): string[] {
  switch (interaction.kind) {
    case "toggle-trigger":
      return [
        `aria-expanded={${interaction.state.open}}`,
        `onClick={() => ${interaction.state.setter}((open) => !open)}`,
      ];
    case "close-trigger":
      return [`onClick={() => ${interaction.state.setter}(false)}`];
    case "tab": {
      const selected = `${interaction.group.value} === ${JSON.stringify(interaction.value)}`;
      return [`aria-selected={${selected}}`, `onClick={() => ${interaction.group.setter}(${JSON.stringify(interaction.value)})}`];
    }
    case "tab-panel":
      return [`hidden={${interaction.group.value} !== ${JSON.stringify(interaction.value)}}`];
    case "toggle-target":
      return [];
  }
}

function svgAttribute(raw: string, value: string, el: Element, ctx: PrintContext): string | null {
  if (raw === "xlink:href" || raw === "href") {
    const url = el.tagName === "image" ? ctx.resolveAsset(value, ctx.doc) : value;
    return `href="${escapeAttr(url)}"`;
  }
  if (raw === "xmlns:xlink") return `xmlnsXlink="${escapeAttr(value)}"`;
  if (raw === "xml:space") return `xmlSpace="${escapeAttr(value)}"`;
  if (raw === "xml:lang") return `xmlLang="${escapeAttr(value)}"`;
  if (raw.includes(":")) return null;
  if (HTML_RENAMED[raw]) return formatProp(HTML_RENAMED[raw], value, ctx, el, raw);
  if (raw.includes("-")) {
    const camel = camelCaseAttribute(raw);
    return `${SVG_CAMEL.has(camel) ? camel : raw}="${escapeAttr(value)}"`;
  }
  return `${raw}="${escapeAttr(collapseWhitespace(value))}"`;
}

function formatProp(prop: string, value: string, ctx: PrintContext, el: Element, raw: string): string {
  if (BOOLEAN_PROPS.has(prop)) return value.toLowerCase() === "false" ? `${prop}={false}` : prop;
  if (NUMBER_PROPS.has(prop)) {
    if (/^-?\d+$/.test(value.trim())) return `${prop}={${Number(value.trim())}}`;
    ctx.warn("info", `Dropped ${prop}="${value}" on <${el.tagName}>: a number is required.`);
    return "";
  }
  return stringProp(ctx, el, raw, prop, value.replace(/\s*\n\s*/g, " "));
}

function printStyle(value: string, ctx: PrintContext, el: Element): string | null {
  const declarations = parseInlineStyle(value);
  if (!declarations.length) return null;
  let hasCustomProperty = false;
  const entries = declarations.map(([property, raw]) => {
    let css = raw;
    if (/!important\s*$/i.test(css)) {
      ctx.warn("info", "Removed !important from inline styles: React style objects do not support it.");
      css = css.replace(/\s*!important\s*$/i, "");
    }
    css = rewriteCssUrls(css, (url) => ctx.resolveAsset(url, ctx.doc));
    const key = cssPropertyToJs(property);
    if (key.startsWith("--")) hasCustomProperty = true;
    const slot = useSlot(ctx, el, `@style:${property}`, { kind: "style", el, name: property }, css);
    const printed = slot.type === "placeholder" ? `"${slot.token}"` : slot.type === "expr" ? slot.expr : JSON.stringify(css);
    return `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${printed}`;
  });
  const object = `{ ${entries.join(", ")} }`;
  if (!hasCustomProperty) return `style={${object}}`;
  ctx.imports.cssProperties = true;
  return `style={${object} as CSSProperties}`;
}

function rewriteSrcSet(value: string, ctx: PrintContext): string {
  return value
    .split(",")
    .map((candidate) => {
      const [url, ...descriptor] = candidate.trim().split(/\s+/);
      return [ctx.resolveAsset(url, ctx.doc), ...descriptor].join(" ");
    })
    .join(", ");
}

function selectDefaultValue(select: Element): string | null {
  const selected = findAll(select, (el) => el.tagName === "option" && hasAttr(el, "selected"));
  if (!selected.length) return null;
  const values = selected.map((o) => getAttr(o, "value") ?? collapseWhitespace(textContent(o)));
  if (hasAttr(select, "multiple")) return `defaultValue={${JSON.stringify(values)}}`;
  return `defaultValue="${escapeAttr(values[0])}"`;
}

/**
 * Renames ids that belong to the component (`orders-search` → `topbar-search`). A reference to an
 * id outside the component, such as a navbar link to a page section (`#home-pricing`), is kept.
 */
function rescopeIds(value: string, scope: { screenId: string; replacement: string }, ownIds: Set<string>): string {
  const pattern = new RegExp(`(^|-)${scope.screenId.replace(/[-]/g, "\\-")}(?=-|$)`);
  return value
    .split(/\s+/)
    .map((token) => (ownIds.has(token) ? token.replace(pattern, `$1${scope.replacement}`) : token))
    .join(" ");
}

const idsByComponent = new WeakMap<Element, Set<string>>();

/** Ids defined inside the component being printed. */
function componentIds(ctx: PrintContext): Set<string> {
  const root = ctx.self;
  if (!root) return new Set();
  let ids = idsByComponent.get(root);
  if (!ids) {
    ids = new Set(
      [root, ...findAll(root, () => true)].map((el) => getAttr(el, "id")).filter((id): id is string => !!id),
    );
    idsByComponent.set(root, ids);
  }
  return ids;
}

/** Route of the only navigating element inside `el`, e.g. the link inside an active <li>. */
function singleNavRoute(el: Element, ctx: PrintContext): string | null {
  const routes = findAll(el, (d) => ctx.resolveRoute(d, ctx.doc) !== null).map((d) => ctx.resolveRoute(d, ctx.doc));
  return routes.length === 1 ? routes[0] : null;
}

const TEXT_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "{": "&#123;",
  "}": "&#125;",
  " ": "&nbsp;",
};

export function trimHtmlWhitespace(text: string): string {
  return text.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, "");
}

export function escapeText(text: string): string {
  return text.replace(/[&<>{} ]/g, (char) => TEXT_ESCAPES[char]);
}

export function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** A value as a JSX attribute: `"text"` when it is safe as a string, `{"…"}` otherwise. */
export function jsxAttributeValue(value: string): string {
  return /["\n{}]/.test(value) ? `{${JSON.stringify(value)}}` : `"${value.replace(/&/g, "&amp;")}"`;
}
