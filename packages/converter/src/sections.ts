import type { AnalyzedScreen, DocInfo } from "./analyze";
import { childElements, classList, collapseWhitespace, countElements, findAll, findFirst, getAttr, textContent, type Element } from "./dom";
import { toPascal, uniqueName } from "./naming";

export interface SectionSource {
  screen: AnalyzedScreen;
  root: Element;
  componentName: string;
}

export interface PageSection {
  name: string;
  element: Element;
  doc: DocInfo;
  screenId: string;
}

/** A page is split only when it has at least this many sections; short pages stay in one file. */
const MIN_SECTIONS = 3;
/** Sections smaller than this (a divider, a one-line band) are not worth their own file. */
const MIN_SECTION_ELEMENTS = 6;
const INTERACTION_ATTRS = ["data-toggle", "data-toggle-target", "data-close", "data-tab-group"];

/**
 * Splits long pages (landing pages, marketing sites) into one component per section:
 * `<main><section id="home-faq">…</section></main>` becomes `<FaqSection />` in `src/sections/`.
 * Elements already extracted as shared components are left alone, and a section is kept in its page
 * when a toggle or tab inside it is wired to something outside it, since that state must live in
 * one file.
 */
export function planSections(
  sources: SectionSource[],
  componentOf: Map<Element, string>,
  usedNames: Set<string>,
): PageSection[] {
  const sections: PageSection[] = [];
  for (const source of sources) {
    const container = findMain(source.root, componentOf) ?? source.root;
    const candidates = childElements(container).filter(
      (el) => !componentOf.has(el) && isSection(el) && countElements(el) >= MIN_SECTION_ELEMENTS,
    );
    if (candidates.length < MIN_SECTIONS) continue;

    const pagePrefix = source.componentName.replace(/Page$/, "");
    candidates.forEach((el, index) => {
      if (sharesInteractionsWithOutside(el, source.root)) return;
      const base = sectionName(el, source.screen.id) || `Section${index + 1}`;
      const wanted = base.endsWith("Section") ? base : `${base}Section`;
      // A second page with a "HeroSection" gets "PricingHeroSection" rather than "HeroSection2".
      const name = usedNames.has(wanted) ? uniqueName(`${pagePrefix}${wanted}`, usedNames) : uniqueName(wanted, usedNames);
      componentOf.set(el, name);
      sections.push({ name, element: el, doc: source.screen.doc, screenId: source.screen.id });
    });
  }
  return sections;
}

function findMain(root: Element, componentOf: Map<Element, string>): Element | null {
  if (root.tagName === "main") return root;
  return findFirst(root, (el) => el.tagName === "main" && !componentOf.has(el));
}

function isSection(el: Element): boolean {
  if (el.tagName === "section") return true;
  return classList(el).some((c) => /^hero$|^hero__?|section/.test(c));
}

/** "home-how-it-works" → HowItWorks, class "section--reviews" → Reviews, else the first heading. */
function sectionName(el: Element, screenId: string): string {
  const id = getAttr(el, "id");
  if (id) {
    const withoutPage = id.startsWith(`${screenId}-`) ? id.slice(screenId.length + 1) : id;
    const name = toPascal(withoutPage);
    if (name) return name;
  }
  for (const cls of classList(el)) {
    if (cls.includes("__")) continue;
    const name = toPascal(cls.replace(/^section--?/, "").replace(/--.*$/, ""));
    if (name && name !== "Section" && name !== "Container") return name;
  }
  const heading = findFirst(el, (e) => /^h[1-3]$/.test(e.tagName));
  if (heading) {
    const words = collapseWhitespace(textContent(heading)).split(" ").slice(0, 3).join(" ");
    return toPascal(words);
  }
  return "";
}

/** True when a toggle or tab id used inside `section` also appears elsewhere in the page. */
function sharesInteractionsWithOutside(section: Element, page: Element): boolean {
  const idsIn = (root: Element, exclude: Element | null) => {
    const ids = new Set<string>();
    for (const el of [root, ...findAll(root, () => true)]) {
      if (exclude && (el === exclude || isInside(el, exclude))) continue;
      for (const attr of INTERACTION_ATTRS) {
        const value = getAttr(el, attr);
        if (value) ids.add(`${attr === "data-tab-group" ? "tab" : "toggle"}:${value}`);
      }
    }
    return ids;
  };
  const inside = idsIn(section, null);
  if (!inside.size) return false;
  const outside = idsIn(page, section);
  return [...inside].some((id) => outside.has(id));
}

function isInside(el: Element, ancestor: Element): boolean {
  for (let node = el.parentNode as Element | null; node; node = node.parentNode as Element | null) {
    if (node === ancestor) return true;
  }
  return false;
}
