import type { Analysis, DocInfo } from "./analyze";
import { classList, getAttr, type Element } from "./dom";
import { isExternalUrl, resolveRelative } from "./paths";

interface Rule {
  selector: string;
  display: string;
  /** Inside @media / @supports: applies only in some conditions. */
  conditional: boolean;
}

const LAYOUT_DISPLAYS = new Set(["flex", "inline-flex", "grid", "inline-grid"]);

/**
 * Tells whether a container's children are laid out as flex or grid items. Browsers do not render
 * the whitespace between such items, so the printer can leave out the `{" "}` it would otherwise
 * write there. It answers true only when the design's CSS says so unconditionally and nothing
 * else (a media query, a hover rule, a longer selector) ever gives the same element another display.
 */
export function createFlexDetector(analysis: Analysis): (el: Element, doc: DocInfo) => boolean {
  const rulesByDoc = new Map<DocInfo, Rule[]>();
  const cache = new WeakMap<Element, boolean>();

  const rulesOf = (doc: DocInfo): Rule[] => {
    let rules = rulesByDoc.get(doc);
    if (rules) return rules;
    const sources: string[] = [...doc.globalCss, ...[...doc.screenCss.values()].flat()];
    for (const link of doc.headLinks) {
      const href = getAttr(link, "href")?.trim();
      if (!href || isExternalUrl(href) || !/stylesheet/i.test(getAttr(link, "rel") ?? "")) continue;
      const css = analysis.files.css.get(resolveRelative(doc.path, href));
      if (css) sources.push(css);
    }
    rules = sources.flatMap((css) => parseRules(css, false));
    rulesByDoc.set(doc, rules);
    return rules;
  };

  return (el, doc) => {
    const cached = cache.get(el);
    if (cached !== undefined) return cached;
    const result = decide(el, rulesOf(doc));
    cache.set(el, result);
    return result;
  };
}

function decide(el: Element, rules: Rule[]): boolean {
  const inline = /(?:^|;)\s*display\s*:\s*([^;!]+)/i.exec(getAttr(el, "style") ?? "")?.[1].trim().toLowerCase();
  if (inline) return LAYOUT_DISPLAYS.has(inline);

  const classes = classList(el);
  const utilityLayout = classes.some((c) => LAYOUT_DISPLAYS.has(c));
  const utilityOther = classes.some((c) => /(^|:)(block|inline|inline-block|table|contents|flow-root)$/.test(c));
  if (utilityLayout || utilityOther) return utilityLayout && !utilityOther;

  let layout = false;
  for (const rule of rules) {
    if (rule.display === "none") continue;
    for (const selector of rule.selector.split(",")) {
      const match = matchesLast(selector.trim(), el);
      if (match === null) continue;
      if (!LAYOUT_DISPLAYS.has(rule.display)) return false;
      if (match === "exact" && !rule.conditional) layout = true;
    }
  }
  return layout;
}

/**
 * How a selector relates to `el`: "exact" when the whole selector is one compound (tag, classes,
 * ids), "partial" when only its last compound matches (it may apply to more or fewer elements),
 * null when it cannot apply or is not understood.
 */
function matchesLast(selector: string, el: Element): "exact" | "partial" | null {
  if (!selector || selector.includes("::")) return null;
  const parts = selector.split(/\s*[\s>+~]\s*/).filter(Boolean);
  const last = parts[parts.length - 1];
  const hasPseudo = last.includes(":");
  const compound = last.replace(/:{1,2}[\w-]+(\([^)]*\))?/g, "");
  if (/[[\]*()]/.test(compound) || !compound) return null;

  const tag = /^[a-z][a-z0-9-]*/i.exec(compound)?.[0].toLowerCase();
  const classes = [...compound.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  const ids = [...compound.matchAll(/#([\w-]+)/g)].map((m) => m[1]);
  if (tag && tag !== el.tagName) return null;
  const own = classList(el);
  if (!classes.every((c) => own.includes(c))) return null;
  if (!ids.every((id) => getAttr(el, "id") === id)) return null;
  return parts.length === 1 && !hasPseudo ? "exact" : "partial";
}

function parseRules(css: string, conditional: boolean): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    if (open === -1) break;
    let depth = 1;
    let close = open + 1;
    while (close < text.length && depth > 0) {
      if (text[close] === "{") depth++;
      else if (text[close] === "}") depth--;
      close++;
    }
    const prelude = text.slice(i, open).trim();
    const body = text.slice(open + 1, close - 1);
    i = close;

    if (prelude.startsWith("@")) {
      if (/^@(media|supports|container)\b/i.test(prelude)) rules.push(...parseRules(body, true));
      else if (/^@layer\b/i.test(prelude)) rules.push(...parseRules(body, conditional));
      continue;
    }
    const display = [...body.matchAll(/(?:^|[;{\s])display\s*:\s*([^;}!]+)/gi)].at(-1)?.[1].trim().toLowerCase();
    if (display) rules.push({ selector: prelude, display, conditional });
  }
  return rules;
}
