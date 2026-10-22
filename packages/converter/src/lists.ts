import { ACTIVE_CLASSES } from "./attributes";
import {
  SVG_NS,
  childElements,
  classList,
  collapseWhitespace,
  findAll,
  findFirst,
  getAttr,
  isElement,
  isText,
  textContent,
  type ChildNode,
  type Element,
} from "./dom";
import {
  INDENT,
  MAX_LINE,
  createImports,
  isMeaningful,
  slotId,
  type NestedRun,
  type PrintContext,
  type SlotHint,
  type SlotState,
} from "./jsx";
import { pluralize, safeIdentifier, singularize, toCamel, toKebab, typeName, uniqueName } from "./naming";

type Print = (el: Element, ctx: PrintContext, depth: number) => string[];

export interface PlannedList {
  /** Index of the last child the list covers. */
  end: number;
  render: (depth: number) => string[];
}

/** Fewer repeats than this are left as they are: two similar elements are often a coincidence. */
const MIN_ITEMS = 3;

/* ---------- Data model ---------- */

type FieldKind = "text" | "node" | "routes" | "list";

interface Field {
  /** Slot id the value comes from. */
  key: string;
  name: string;
  kind: FieldKind;
  /** Schema of the items when the field is a nested list. */
  sub?: Schema;
}

interface Schema {
  typeName: string;
  /** Items are plain strings (`string[]`), so there are no fields. */
  strings: boolean;
  fields: Field[];
  /** Field that identifies an item and is used as the React key. */
  keyField: string | null;
}

interface Row {
  [field: string]: string | string[] | Row[];
}

interface Planned {
  schema: Schema;
  rows: (Row | string)[];
  /** Interface declarations this list needs, dependencies first. */
  types: string[];
  /** Names of those interfaces. */
  typeNames: string[];
  hasNodes: boolean;
  /** Prints `{array.map(…)}` with the first item as the template. */
  renderMap: (arrayExpr: string, depth: number) => string[];
}

/* ---------- Finding lists ---------- */

/**
 * Finds runs of sibling elements that share one structure and differ only in their content
 * (stat cards, table rows, list items) and turns each into a data array plus `.map()`.
 * Returns the runs keyed by the index of their first child.
 */
export function planLists(children: ChildNode[], ctx: PrintContext, print: Print): Map<number, PlannedList> {
  const lists = new Map<number, PlannedList>();
  if (ctx.slots && !ctx.slots.allowLists) return lists;
  let run: { index: number; el: Element }[] = [];

  const flush = () => {
    if (run.length >= MIN_ITEMS) {
      const render = planTopLevel(run.map((r) => r.el), ctx, print);
      if (render) lists.set(run[0].index, { end: run[run.length - 1].index, render });
    }
    run = [];
  };

  children.forEach((child, index) => {
    if (isText(child)) {
      if (collapseWhitespace(child.value)) flush();
      return;
    }
    const el = child as Element;
    if (run.length && shape(el) !== shape(run[0].el)) flush();
    run.push({ index, el });
  });
  flush();
  return lists;
}

function planTopLevel(items: Element[], ctx: PrintContext, print: Print): ((depth: number) => string[]) | null {
  if (items.some((item) => containsComponent(item, ctx) || containsControl(item, ctx))) return null;
  if (ctx.slots && items.some((item) => subtreeHasFill(item, ctx.slots!))) return null;

  const parent = items[0].parentNode && isElement(items[0].parentNode as ChildNode) ? (items[0].parentNode as Element) : null;
  let wanted = listName(items[0], parent);
  // A second list with the same name takes its name from the section it sits in ("pricingCards").
  if (ctx.imports.names.has(safeIdentifier(wanted))) {
    const section = sectionName(items[0]);
    if (section) wanted = toCamel(`${section} ${wanted}`);
  }
  const taken = new Set(ctx.imports.data.flatMap((block) => block.typeNames));
  const planned = plan(items, ctx, print, wanted, taken, null, true);
  if (!planned) return null;

  const arrayName = uniqueName(safeIdentifier(wanted), ctx.imports.names);
  ctx.imports.data.push({
    name: arrayName,
    usesType: planned.schema.strings ? null : planned.schema.typeName,
    types: planned.types,
    typeNames: planned.typeNames,
    source: dataSource(arrayName, planned),
    hasNodes: planned.hasNodes,
  });
  return (depth) => planned.renderMap(arrayName, depth);
}

/**
 * Structure of an element with its values left out: tags, attribute names and where text sits.
 * Runs of identical children count as one (`li*`), so cards that differ only in how many tags they
 * hold share one shape; the exact counts are compared later, on the printed markup.
 */
const shapes = new WeakMap<Element, string>();
function shape(el: Element): string {
  const cached = shapes.get(el);
  if (cached) return cached;
  let result: string;
  if (el.namespaceURI === SVG_NS && el.tagName === "svg") {
    result = "svg";
  } else {
    const names = el.attrs.map((a) => a.name).sort().join(",");
    const kids: string[] = [];
    for (const child of el.childNodes.filter(isMeaningful)) {
      if (isText(child)) {
        kids.push("#");
        continue;
      }
      const part = `${shape(child as Element)}*`;
      if (kids[kids.length - 1] !== part) kids.push(part);
    }
    result = `${el.tagName}[${names}](${kids.join(",")})`;
  }
  shapes.set(el, result);
  return result;
}

function containsComponent(el: Element, ctx: PrintContext): boolean {
  if (ctx.componentOf.has(el)) return true;
  return childElements(el).some((child) => containsComponent(child, ctx));
}

/** Form controls keep their own state, so markup that holds them is never turned into data. */
function containsControl(el: Element, ctx: PrintContext): boolean {
  if (ctx.forms.has(el)) return true;
  return childElements(el).some((child) => containsControl(child, ctx));
}

/** True when a slot of an enclosing component (a prop) sits inside this element. */
function subtreeHasFill(el: Element, slots: SlotState): boolean {
  const path = slotId(el, slots.root, "");
  for (const key of slots.fills.keys()) {
    if (key.startsWith(`${path}.`) || key.startsWith(`${path}@`) || key.startsWith(`${path}#`)) return true;
  }
  return false;
}

/* ---------- Nested lists ---------- */

interface RawRun {
  container: Element;
  /** Position of the container under the item, e.g. "1.0". */
  path: string;
  key: string;
  els: Element[];
}

const NEVER_LISTED = new Set(["td", "th", "dt", "dd", "br", "hr", "option", "source", "track", "col"]);

/** Same structure and same classes (active state aside): what a repeated element looks like. */
function runKey(el: Element): string {
  return `${shape(el)}|${classList(el).filter((c) => !ACTIVE_CLASSES.has(c)).sort().join(" ")}`;
}

function collectRuns(root: Element, ctx: PrintContext): RawRun[] {
  const out: RawRun[] = [];
  const visit = (container: Element) => {
    if (container.namespaceURI === SVG_NS) return;
    const kids = container.childNodes.filter(isMeaningful);
    const inRun = new Set<Element>();
    let run: Element[] = [];
    const flush = () => {
      if (run.length) {
        out.push({ container, path: slotId(container, root, ""), key: runKey(run[0]), els: run });
        if (run.length >= 2) run.forEach((el) => inRun.add(el));
      }
      run = [];
    };
    for (const kid of kids) {
      const listable =
        isElement(kid) &&
        kid.namespaceURI !== SVG_NS &&
        !NEVER_LISTED.has(kid.tagName) &&
        !containsComponent(kid, ctx) &&
        !containsControl(kid, ctx);
      if (!listable) {
        flush();
        continue;
      }
      if (run.length && runKey(kid) !== runKey(run[0])) flush();
      run.push(kid);
    }
    flush();
    for (const kid of kids) if (isElement(kid) && !inRun.has(kid)) visit(kid);
  };
  visit(root);
  return out;
}

/**
 * Runs of repeated elements inside the items (tags in a card, features in a plan) that are the
 * same kind of run in every item. They become arrays inside the items' data, so the number of
 * entries can differ from one item to the next.
 */
function qualifyRuns(items: Element[], ctx: PrintContext): Map<Element, NestedRun>[] {
  const perItem = items.map((item) => collectRuns(item, ctx));
  const byKey = new Map<string, RawRun[][]>();
  perItem.forEach((runs, i) => {
    for (const run of runs) {
      const key = `${run.path}|${run.key}`;
      const entry = byKey.get(key) ?? items.map(() => []);
      entry[i].push(run);
      byKey.set(key, entry);
    }
  });

  const result = items.map(() => new Map<Element, NestedRun>());
  const ordinals = new Map<string, number>();
  for (const entry of byKey.values()) {
    if (entry.some((runs) => runs.length !== 1)) continue;
    // Items whose values are different kinds of thing (a price, a status, a date) are the fields of
    // one record, not entries of one list.
    if (entry.some((runs) => mixedValues(runs[0].els))) continue;
    const lengths = entry.map((runs) => runs[0].els.length);
    if (Math.max(...lengths) < 2) continue;
    if (Math.max(...lengths) < 3 && new Set(lengths).size === 1) continue;
    const path = entry[0][0].path;
    const ordinal = ordinals.get(path) ?? 0;
    ordinals.set(path, ordinal + 1);
    const id = `${path}@list${ordinal}`;
    entry.forEach((runs, i) => {
      const run = runs[0];
      result[i].set(run.container, { id, first: run.els[0], last: run.els[run.els.length - 1], items: run.els });
    });
  }
  return result;
}

/** Whether a run's texts say they are different kinds of value (price next to status next to date). */
function mixedValues(els: Element[]): boolean {
  const kinds = new Set(els.map((el) => nameFromValue(textContent(el))).filter(Boolean));
  return kinds.size >= 2;
}

/* ---------- Planning ---------- */

interface Prepared {
  key: string;
  hint: SlotHint;
  kind: FieldKind;
  value: string;
  sub?: Planned;
  sizes?: number[];
  /** Preferred field name for a nested list. */
  listName?: string;
}

let mapDepth = 0;

function plan(
  items: Element[],
  ctx: PrintContext,
  print: Print,
  baseName: string,
  taken: Set<string>,
  groups: number[] | null,
  nested: boolean,
): Planned | null {
  const local = new Set(taken);
  const runs = nested ? qualifyRuns(items, ctx) : items.map(() => new Map<Element, NestedRun>());
  const captures = items.map((item, i) => {
    const slots: SlotState = { root: item, mode: "capture", captured: new Map(), fills: new Map(), nested: runs[i] };
    const lines = print(item, { ...ctx, imports: createImports(), slots }, 0);
    return { skeleton: lines.join("\n"), captured: slots.captured };
  });
  if (captures.some((c) => c.skeleton !== captures[0].skeleton)) return null;

  const literal = (el: Element) => print(el, { ...ctx, imports: createImports(), slots: null }, 0).join("\n");
  const prepared: Prepared[] = [];
  for (const [key, slot] of captures[0].captured) {
    if (slot.hint.kind === "list") {
      const perParent = captures.map((c) => c.captured.get(key)?.items ?? []);
      const signatures = perParent.map((els) => els.map(literal).join("\u0000"));
      if (new Set(signatures).size === 1) continue;
      const flat = perParent.flat();
      const sizes = perParent.map((els) => els.length);
      const listName = listFieldName(slot.hint.el, flat[0], slot.hint.el === items[0]);
      const sub = plan(flat, ctx, print, listName, local, sizes, true);
      if (!sub) return nested ? plan(items, ctx, print, baseName, taken, groups, false) : null;
      prepared.push({ key, hint: slot.hint, kind: "list", value: "", sub, sizes, listName });
      continue;
    }
    const values = captures.map((c) => c.captured.get(key)?.value ?? "");
    if (new Set(values).size === 1) continue;
    const kind: FieldKind = slot.hint.kind === "svg" ? "node" : slot.hint.kind === "activeOn" ? "routes" : "text";
    prepared.push({ key, hint: slot.hint, kind, value: values[0] });
  }
  if (prepared.length === 0) return null;
  // Values that only refine an item (the routes it is also active on) come last.
  prepared.sort((a, b) => Number(a.kind === "routes") - Number(b.kind === "routes"));

  // A label that is the same in every item ("Orders" before "24") says what the value after it is.
  const staticKeys = new Set([...captures[0].captured.keys()].filter((k) => !prepared.some((p) => p.key === k)));
  const labelFor = (hint: SlotHint): string | undefined => {
    if (hint.kind !== "text" || hint.el === items[0]) return undefined;
    const parent = hint.el.parentNode as Element | null;
    if (!parent) return undefined;
    const siblings = parent.childNodes.filter(isMeaningful);
    const previous = siblings[siblings.indexOf(hint.el) - 1];
    if (!previous || !isElement(previous as ChildNode)) return undefined;
    const text = (previous as Element).childNodes.find(isText);
    if (!text || !staticKeys.has(slotId(text, items[0], "#"))) return undefined;
    const words = collapseWhitespace(textContent(previous as Element));
    return /^[A-Za-z][A-Za-z ]{1,24}$/.test(words) ? toCamel(words) : undefined;
  };

  const names = assignNames(
    prepared.map((p) => ({
      key: p.key,
      hint: p.hint,
      value: p.value,
      label: labelFor(p.hint),
      preferred: p.kind === "list" ? [safeIdentifier(p.listName!)] : undefined,
    })),
    items[0],
  );
  const strings = prepared.length === 1 && prepared[0].kind === "text" && prepared[0].hint.kind === "text";
  const fields: Field[] = prepared.map((p) => ({
    key: p.key,
    name: names.get(p.key)!,
    kind: p.kind,
    sub: p.sub?.schema,
  }));

  const itemRows: (Row | string)[] = items.map(() => ({}));
  const cursor = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    if (strings) {
      itemRows[i] = captures[i].captured.get(prepared[0].key)!.value;
      continue;
    }
    const row: Row = {};
    for (const [f, p] of prepared.entries()) {
      const field = fields[f];
      if (p.kind === "list") {
        const size = p.sizes![i];
        const at = cursor.get(p.key) ?? 0;
        row[field.name] = p.sub!.rows.slice(at, at + size) as string[] | Row[];
        cursor.set(p.key, at + size);
      } else if (p.kind === "routes") {
        row[field.name] = JSON.parse(captures[i].captured.get(p.key)!.value) as string[];
      } else {
        row[field.name] = captures[i].captured.get(p.key)!.value;
      }
    }
    itemRows[i] = row;
  }

  // Key: a field that names the item and is unique inside each array; otherwise a generated id.
  const sizes = groups ?? [items.length];
  const isUniqueIn = (read: (i: number) => string): boolean => {
    let start = 0;
    for (const size of sizes) {
      const seen = new Set<string>();
      for (let i = start; i < start + size; i++) {
        const value = read(i);
        if (seen.has(value)) return false;
        seen.add(value);
      }
      start += size;
    }
    return true;
  };

  let keyField: string | null = null;
  let stringsUnique = false;
  const singular = toCamel(singularize(baseName));
  if (strings) {
    stringsUnique = isUniqueIn((i) => itemRows[i] as string);
  } else {
    for (const preferred of KEY_FIELDS) {
      const field = fields.find((f) => f.name === preferred && f.kind === "text");
      if (!field) continue;
      // A number is not an identity (two customers can both have 24 orders), unless it is called id.
      const numeric = (i: number) => /^[\d,.]+$/.test((itemRows[i] as Row)[field.name] as string);
      if (field.name !== "id" && itemRows.some((_, i) => numeric(i))) continue;
      if (isUniqueIn((i) => (itemRows[i] as Row)[field.name] as string)) {
        keyField = field.name;
        break;
      }
    }
    if (!keyField && !fields.some((f) => f.name === "id")) {
      fields.unshift({ key: "@id", name: "id", kind: "text" });
      let start = 0;
      for (const size of sizes) {
        for (let n = 0; n < size; n++) {
          const row = itemRows[start + n] as Row;
          itemRows[start + n] = { id: `${toKebab(singular) || "item"}-${n + 1}`, ...row };
        }
        start += size;
      }
      keyField = "id";
    }
  }

  const schema: Schema = {
    typeName: strings ? "" : typeName(singularize(baseName), local),
    strings,
    fields,
    keyField,
  };
  const types: string[] = [];
  const typeNames: string[] = [];
  for (const p of prepared) {
    if (p.sub) {
      for (const t of p.sub.types) if (!types.includes(t)) types.push(t);
      for (const n of p.sub.typeNames) if (!typeNames.includes(n)) typeNames.push(n);
    }
  }
  if (!strings) {
    types.push(typeSource(schema));
    typeNames.push(schema.typeName);
  }
  const hasNodes = prepared.some((p) => p.kind === "node" || p.sub?.hasNodes);
  for (const name of local) taken.add(name);

  const renderMap = (arrayExpr: string, depth: number): string[] => {
    const itemName = uniqueName(safeIdentifier(strings ? singular : toCamel(schema.typeName)), ctx.imports.names);
    const indexName = mapDepth === 0 ? "index" : `${itemName}Index`;
    let usesIndex = false;
    let keyExpr: string;
    if (strings && stringsUnique) keyExpr = itemName;
    else if (strings) {
      usesIndex = true;
      keyExpr = `\`\${${itemName}}-\${${indexName}}\``;
    } else if (keyField) keyExpr = `${itemName}.${keyField}`;
    else {
      usesIndex = true;
      keyExpr = indexName;
    }

    const fills = new Map<string, string>();
    const nestedRender = new Map<string, (depth: number) => string[]>();
    for (const p of prepared) {
      const field = fields.find((x) => x.key === p.key)!;
      if (p.kind === "list") {
        nestedRender.set(p.key, (d) => p.sub!.renderMap(`${itemName}.${field.name}`, d));
      } else {
        const expr = strings ? itemName : `${itemName}.${field.name}`;
        fills.set(p.key, p.kind === "routes" ? `(${expr} ?? [])` : expr);
      }
    }
    const slots: SlotState = { root: items[0], mode: "fill", captured: new Map(), fills, keyExpr, nested: runs[0], nestedRender };
    mapDepth++;
    let body: string[];
    try {
      body = print(items[0], { ...ctx, slots }, depth + 1);
    } finally {
      mapDepth--;
    }
    const pad = INDENT.repeat(depth);
    const params = usesIndex ? `(${itemName}, ${indexName})` : `(${itemName})`;
    return [`${pad}{${arrayExpr}.map(${params} => (`, ...body, `${pad}))}`];
  };

  return { schema, rows: itemRows, types, typeNames, hasNodes, renderMap };
}

/* ---------- Emitting data and types ---------- */

const KEY_FIELDS = ["id", "to", "href", "name", "title", "label", "email", "sku", "code", "slug"];

const fieldType = (field: Field): string => {
  if (field.kind === "node") return "ReactNode";
  if (field.kind === "routes") return "string[]";
  if (field.kind === "list") return field.sub!.strings ? "string[]" : `${field.sub!.typeName}[]`;
  return "string";
};

function typeSource(schema: Schema): string {
  const lines = [`export interface ${schema.typeName} {`];
  for (const field of schema.fields) {
    lines.push(`${INDENT}${field.name}${field.kind === "routes" ? "?" : ""}: ${fieldType(field)};`);
  }
  lines.push("}");
  return lines.join("\n");
}

function dataSource(name: string, planned: Planned): string {
  const { schema, rows } = planned;
  const type = schema.strings ? "string[]" : `${schema.typeName}[]`;
  const lines = [`export const ${name}: ${type} = [`];
  // One layout for the whole array: if any row needs several lines, every row gets them.
  const compact = !schema.strings && (rows as Row[]).every((row) => rowLines(schema, row, INDENT).length === 1);
  for (const row of rows) {
    if (schema.strings) lines.push(`${INDENT}${JSON.stringify(row)},`);
    else lines.push(...rowLines(schema, row as Row, INDENT, !compact));
  }
  lines.push("];");
  return lines.join("\n");
}

const stringList = (values: string[]): string => `[${values.map((v) => JSON.stringify(v)).join(", ")}]`;

function inlineCell(field: Field, cell: string | string[] | Row[]): string | null {
  switch (field.kind) {
    case "node":
      return typeof cell === "string" && !cell.includes("\n") ? cell : null;
    case "text":
      return JSON.stringify(cell);
    case "routes":
      return stringList(cell as string[]);
    case "list": {
      if (field.sub!.strings) return stringList(cell as string[]);
      const rows = (cell as Row[]).map((row) => inlineRow(field.sub!, row));
      return rows.every((r) => r !== null) ? `[${rows.join(", ")}]` : null;
    }
  }
}

function inlineRow(schema: Schema, row: Row): string | null {
  const parts: string[] = [];
  for (const field of schema.fields) {
    if (isEmptyOptional(field, row[field.name])) continue;
    const inline = inlineCell(field, row[field.name]);
    if (inline === null) return null;
    parts.push(`${field.name}: ${inline}`);
  }
  return `{ ${parts.join(", ")} }`;
}

/** Optional fields (the routes an item is also active on) are left out when they are empty. */
function isEmptyOptional(field: Field, cell: string | string[] | Row[]): boolean {
  return field.kind === "routes" && (cell as string[]).length === 0;
}

function rowLines(schema: Schema, row: Row, indent: string, expand = false): string[] {
  const inline = inlineRow(schema, row);
  if (!expand && inline !== null && `${indent}${inline},`.length <= MAX_LINE) return [`${indent}${inline},`];
  const inner = `${indent}${INDENT}`;
  const lines = [`${indent}{`];
  for (const field of schema.fields) {
    if (!isEmptyOptional(field, row[field.name])) lines.push(...fieldLines(field, row[field.name], inner));
  }
  lines.push(`${indent}},`);
  return lines;
}

function fieldLines(field: Field, cell: string | string[] | Row[], indent: string): string[] {
  const inline = inlineCell(field, cell);
  if (inline !== null && `${indent}${field.name}: ${inline},`.length <= MAX_LINE) return [`${indent}${field.name}: ${inline},`];
  const inner = `${indent}${INDENT}`;
  if (field.kind === "node") {
    return [`${indent}${field.name}: (`, ...(cell as string).split("\n").map((l) => `${inner}${l}`), `${indent}),`];
  }
  if (field.kind === "text") return [`${indent}${field.name}: ${JSON.stringify(cell)},`];
  if (field.kind === "routes" || field.sub!.strings) {
    return [`${indent}${field.name}: [`, ...(cell as string[]).map((v) => `${inner}${JSON.stringify(v)},`), `${indent}],`];
  }
  return [`${indent}${field.name}: [`, ...(cell as Row[]).flatMap((r) => rowLines(field.sub!, r, inner)), `${indent}],`];
}

/* ---------- Naming ---------- */

/** Class words that describe layout or widgets, not what the data is. */
const GENERIC_WORDS = new Set([
  "card", "item", "items", "text", "box", "wrapper", "container", "row", "col", "cell", "content", "inner",
  "body", "list", "group", "section", "block", "wrap", "btn", "button", "link", "flex", "grid", "layout",
  "main", "page", "app", "inline", "w", "h", "t", "x", "y", "top", "bottom", "left", "right", "head", "foot",
  "outer", "start", "end", "middle", "meta", "info", "header", "footer",
]);
/** UI widgets: a better name is used when the value says what it is (a status, an e-mail address). */
const WIDGET_WORDS = new Set(["badge", "chip", "pill", "tag"]);

const TAG_NAMES: Record<string, string[]> = {
  h1: ["title", "heading"], h2: ["title", "subtitle"], h3: ["title", "subtitle"],
  h4: ["title", "subtitle"], h5: ["title", "subtitle"], h6: ["title", "subtitle"],
  p: ["description", "details", "note"], strong: ["highlight", "value"], b: ["highlight", "value"],
  label: ["label"], button: ["label", "action"], a: ["label", "link"], span: ["label", "value", "detail"],
  li: ["text"], option: ["label"], small: ["note", "caption"], time: ["date", "time"], em: ["note"],
  td: ["value"], th: ["label"], div: ["text"], dt: ["term"], dd: ["definition"], blockquote: ["quote"],
  cite: ["author"], figcaption: ["caption"],
};

/** What an element is called when it has no class to say so (used for class-variant fields). */
const TAG_WORDS: Record<string, string> = { a: "link", button: "button", span: "text", li: "item", div: "box", p: "text" };

const ATTR_NAMES: Record<string, string> = {
  href: "href", alt: "alt", title: "title", id: "id", value: "value", placeholder: "placeholder",
  "aria-label": "label", datetime: "date", srcset: "srcSet", for: "inputId",
};

const STATUS_WORDS = new Set([
  "paid", "pending", "shipped", "delivered", "cancelled", "canceled", "refunded", "completed", "processing",
  "active", "inactive", "failed", "draft", "published", "open", "closed", "overdue", "approved", "rejected",
  "unpaid", "in transit", "on hold", "archived", "scheduled",
]);

/** What a text is, when its value makes that clear (a price, a date, an e-mail address, a status). */
function nameFromValue(value: string): string | null {
  const text = collapseWhitespace(value);
  if (!text) return null;
  if (STATUS_WORDS.has(text.toLowerCase())) return "status";
  if (/^\S+@\S+\.\S+$/.test(text)) return "email";
  if (/^[-+]?[$€£¥₪]\s?\d|^\d[\d,.]*\s?(USD|EUR|GBP|SAR|AED|JOD)\b/i.test(text)) return "price";
  if (/^\d{4}-\d{2}-\d{2}|^[A-Z][a-z]{2,8}\.? \d{1,2},? \d{4}|^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(text)) return "date";
  if (/^\+?[\d\s().-]{7,}$/.test(text) && text.replace(/\D/g, "").length >= 7) return "phone";
  if (/^[-+▲▼↑↓]?\s*\d+(\.\d+)?\s?%$/.test(text)) return "percent";
  return null;
}

function meaningfulClasses(el: Element): string[] {
  return classList(el).filter((c) => !c.includes("--") && !ACTIVE_CLASSES.has(c) && !isUtilityClass(c));
}

const UTILITY_PREFIXES = [
  "text", "bg", "p", "px", "py", "pt", "pb", "pl", "pr", "m", "mx", "my", "mt", "mb", "ml", "mr", "flex", "grid", "gap",
  "space", "border", "rounded", "shadow", "w", "h", "min", "max", "font", "leading", "tracking", "items", "justify",
  "self", "block", "inline", "hidden", "overflow", "absolute", "relative", "fixed", "sticky", "top", "left", "right",
  "bottom", "inset", "z", "opacity", "transition", "duration", "cursor", "underline", "uppercase", "lowercase",
  "capitalize", "truncate", "col", "row", "order", "ring", "divide", "object", "whitespace", "fill", "stroke", "size",
  "grow", "shrink", "basis", "list", "place", "content", "sr", "outline", "backdrop", "blur", "translate", "rotate",
  "scale", "ease", "animate", "container", "aspect", "line", "decoration", "tabular", "antialiased", "italic",
];
const UTILITY_CLASS = new RegExp(`^-?(${UTILITY_PREFIXES.join("|")})(-|$)`);

/** Tailwind-style utilities describe looks, not meaning, so they never name data. */
function isUtilityClass(name: string): boolean {
  return /[:[\]/]/.test(name) || UTILITY_CLASS.test(name);
}

/** "stat__value" → value, "amount" → amount; null for layout words ("card", "nav-item"). */
function semanticClassName(el: Element): string | null {
  const classes = meaningfulClasses(el);
  for (let i = classes.length - 1; i >= 0; i--) {
    const c = classes[i];
    const name = toCamel(c.includes("__") ? c.slice(c.lastIndexOf("__") + 2) : c);
    if (name.length < 3 || /^\d+$/.test(name)) continue;
    const lastWord = (name.match(/[A-Z]?[a-z0-9]+$/)?.[0] ?? name).toLowerCase();
    if (GENERIC_WORDS.has(lastWord)) continue;
    return name;
  }
  return null;
}

/** Whether a class or id names layout ("auth-box", "form-grid"), not what the markup is. */
export function isGenericName(value: string): boolean {
  const name = toCamel(value);
  const lastWord = (name.match(/[A-Z]?[a-z0-9]+$/)?.[0] ?? name).toLowerCase();
  return name.length < 3 || GENERIC_WORDS.has(lastWord) || WIDGET_WORDS.has(lastWord);
}

/** Name of the section a list sits in: the closest ancestor with a meaningful id or class. */
function sectionName(el: Element): string | null {
  let node = el.parentNode as Element | null;
  for (let depth = 0; node && isElement(node as ChildNode) && depth < 6; depth++, node = node.parentNode as Element | null) {
    const id = getAttr(node, "id");
    if (id && !/^\d/.test(id) && !isGenericName(id)) return toCamel(id);
    const name = semanticClassName(node);
    if (name) return name;
  }
  return null;
}

/** Text inside a table cell is named after its column header ("Customer" → customer). */
function tableHeaderName(el: Element, root: Element): string | null {
  let cell: Element | null = null;
  for (let node: Element | null = el; node; node = node === root ? null : (node.parentNode as Element | null)) {
    if (node.tagName === "td" || node.tagName === "th") {
      cell = node;
      break;
    }
  }
  if (!cell || !cell.parentNode) return null;
  const row = cell.parentNode as Element;
  const index = childElements(row).filter((c) => c.tagName === "td" || c.tagName === "th").indexOf(cell);
  let table: Element | null = row;
  while (table && table.tagName !== "table") table = table.parentNode as Element | null;
  if (!table) return null;
  const head = childElements(table).find((c) => c.tagName === "thead");
  const headRow = head && childElements(head).find((c) => c.tagName === "tr");
  const header = headRow && childElements(headRow).filter((c) => c.tagName === "th" || c.tagName === "td")[index];
  const label = header ? toCamel(collapseWhitespace(textContent(header))) : "";
  // A header that cannot be turned into an identifier (Arabic, Chinese…) still says "this is column n".
  if (header && !label && collapseWhitespace(textContent(header))) return `column${index + 1}`;
  return label || null;
}

function ancestorClassName(el: Element, root: Element): string | null {
  if (el === root) return null;
  for (let node = el.parentNode as Element | null; node && node !== root; node = node.parentNode as Element | null) {
    if (!isElement(node as ChildNode)) break;
    const name = semanticClassName(node);
    if (name) return name;
  }
  return null;
}

function candidateNames(hint: SlotHint, root: Element, value: string, label?: string): string[] {
  const out: string[] = [];
  const add = (name: string | null | undefined) => {
    if (!name) return;
    const id = safeIdentifier(name);
    if (!out.includes(id)) out.push(id);
  };

  switch (hint.kind) {
    case "svg":
      add("icon");
      break;
    case "route":
      add("to");
      add("path");
      break;
    case "activeOn":
      add("activeOn");
      break;
    case "class": {
      const base = hint.el === root ? null : semanticClassName(hint.el) ?? TAG_WORDS[hint.el.tagName] ?? null;
      add(base ? `${base}Variant` : "variant");
      add("variant");
      break;
    }
    case "style":
      add(toCamel(hint.name.replace(/^--/, "")) || "style");
      break;
    case "attr":
      if (hint.name === "src") add(classList(hint.el).some((c) => /avatar/.test(c)) ? "avatar" : "image");
      else add(ATTR_NAMES[hint.name] ?? toCamel(hint.name.replace(/^(data|aria)-/, "")));
      break;
    case "text": {
      const inferred = nameFromValue(value);
      const own = semanticClassName(hint.el);
      add(tableHeaderName(hint.el, root));
      if (label) {
        const numeric = /^[\d,.]+$/.test(collapseWhitespace(value));
        add(numeric && /s$/i.test(label) ? `${singularize(label)}Count` : label);
      }
      if (own && WIDGET_WORDS.has(own)) add(inferred);
      else add(own);
      add(ancestorClassName(hint.el, root));
      add(inferred);
      if (/^[\d,.]+$/.test(collapseWhitespace(value))) add("value");
      for (const name of TAG_NAMES[hint.el.tagName] ?? ["text"]) add(name);
      add("text");
      break;
    }
    case "list":
      add("items");
      break;
  }
  if (out.length === 0) out.push("value");
  return out;
}

export interface NameRequest {
  key: string;
  hint: SlotHint;
  value?: string;
  /** Names to try first (a nested list is named after its container). */
  preferred?: string[];
  /** Text of a label that sits before the value and is the same in every item ("Orders" before "24"). */
  label?: string;
}

/**
 * Names fields or props from what the design says about each value: column headers, class names,
 * the shape of the value (price, date, status) and the tag. Duplicates fall back to the next
 * candidate, then to a number, in a fixed order.
 */
export function assignNames(requests: NameRequest[], root: Element, reserved: Iterable<string> = []): Map<string, string> {
  const used = new Set(reserved);
  const names = new Map<string, string>();
  for (const request of requests) {
    const candidates = request.preferred ?? candidateNames(request.hint, root, request.value ?? "", request.label);
    const free = candidates.find((name) => !used.has(name));
    const name = free ?? uniqueName(candidates[0], used);
    used.add(name);
    names.set(request.key, name);
  }
  return names;
}

/** Single name for one value (kept for callers that name one slot). */
export function fieldName(hint: SlotHint, root: Element, value = ""): string {
  return candidateNames(hint, root, value)[0];
}

const LIST_TAG_NAMES: Record<string, string> = {
  tr: "rows", li: "items", option: "options", a: "links", button: "buttons", img: "images", th: "columns",
  article: "articles", section: "sections", figure: "figures", span: "items", div: "items",
};

/** "navItems" → "navigationItems": spell out the one abbreviation designs always use. */
function expandNav(name: string): string {
  return name.replace(/^nav(?=[A-Z]|$)/, "navigation");
}

function plural(name: string): string {
  return /s$/i.test(name) ? name : pluralize(name);
}

/** Array name for a list found among the children of `parent`. */
function listName(item: Element, parent: Element | null): string {
  if (item.tagName === "tr") return rowsName(item);

  const containerName = parent ? semanticClassName(parent) : null;
  if (containerName && /s$/i.test(containerName)) return expandNav(containerName);
  const itemName = semanticClassName(item);
  if (itemName) return expandNav(plural(itemName));
  if ((inside(item, "nav") || inside(item, "aside")) && ["a", "li", "button"].includes(item.tagName)) return "navigationItems";
  if (containerName) return expandNav(plural(containerName));
  const generic = meaningfulClasses(item).at(-1);
  if (generic && toCamel(generic).length >= 3) return plural(toCamel(generic));
  return LIST_TAG_NAMES[item.tagName] ?? "items";
}

/** Name of a list nested inside items: after its container (`tags`), else after its items. */
function listFieldName(container: Element, firstItem: Element, containerIsItem = false): string {
  const containerName = containerIsItem ? null : semanticClassName(container);
  if (containerName) return expandNav(plural(containerName));
  const itemName = semanticClassName(firstItem);
  if (itemName) return expandNav(plural(itemName));
  if (container.tagName === "ul" || container.tagName === "ol") {
    const parentName = container.parentNode && isElement(container.parentNode as ChildNode) ? semanticClassName(container.parentNode as Element) : null;
    if (parentName) return plural(parentName);
  }
  return LIST_TAG_NAMES[firstItem.tagName] ?? "items";
}

function inside(el: Element, tag: string): boolean {
  for (let node = el.parentNode as Element | null; node && isElement(node as ChildNode); node = node.parentNode as Element | null) {
    if (node.tagName === tag) return true;
  }
  return false;
}

/** Table rows are named after the heading above the table ("Recent orders" → orderRows). */
function rowsName(row: Element): string {
  let table: Element | null = row;
  while (table && table.tagName !== "table") table = table.parentNode as Element | null;
  if (!table) return "rows";

  const caption = childElements(table).find((c) => c.tagName === "caption");
  const heading = caption ? collapseWhitespace(textContent(caption)) : headingAbove(table);
  const word = heading
    .toLowerCase()
    .match(/[a-z]{3,}/g)
    ?.at(-1);
  return word ? `${toCamel(singularize(word))}Rows` : "rows";
}

/** Text of the closest heading that comes before `el` inside its card or section. */
function headingAbove(el: Element): string {
  const isHeading = (n: Element) => /^h[1-6]$/.test(n.tagName) || meaningfulClasses(n).some((c) => /(title|heading)$/.test(c));
  let current: Element = el;
  for (let depth = 0; depth < 4; depth++) {
    const parent = current.parentNode as Element | null;
    if (!parent || !isElement(parent as ChildNode)) break;
    const before = childElements(parent);
    const found = before
      .slice(0, before.indexOf(current))
      .reverse()
      .map((sibling) => (isHeading(sibling) ? sibling : findAll(sibling, isHeading).at(-1)))
      .find(Boolean);
    if (found) return collapseWhitespace(textContent(found));
    if (isHeading(parent)) break;
    const own = findFirst(parent, isHeading);
    if (own && !contains(current, own)) return collapseWhitespace(textContent(own));
    current = parent;
  }
  return "";
}

function contains(root: Element, target: Element): boolean {
  if (root === target) return true;
  return childElements(root).some((child) => contains(child, target));
}
