import type { DocInfo } from "./analyze";
import { ACTIVE_CLASSES } from "./attributes";
import { childElements, classList, findAll, getAttr, walkElements, type Element } from "./dom";
import { prepareInteractions } from "./interactions";
import {
  createImports,
  elementKind,
  jsxAttributeValue,
  printElement,
  type ActiveState,
  type CapturedSlot,
  type PrintContext,
  type SlotState,
} from "./jsx";
import { prepareForms } from "./forms";
import { assignNames } from "./lists";
import { toKebab, toPascal, uniqueName } from "./naming";
import type { WarningLevel } from "./types";

export interface ComponentSource {
  screenId: string;
  /** Route of the page this copy belongs to. */
  route: string;
  doc: DocInfo;
  root: Element;
}

export interface SharedComponent {
  name: string;
  element: Element;
  doc: DocInfo;
  /** Screen the printed copy comes from. */
  screenId: string;
  active: ActiveState | null;
  usedIn: string[];
  /** Copies that differ only in a few texts or values share the component through props. */
  props: { names: string[]; fills: Map<string, string> } | null;
}

/** More differences than this and the copies are really different markup, not one component. */
const MAX_PROPS = 6;

interface Candidate {
  el: Element;
  source: ComponentSource;
  explicit: boolean;
  depth: number;
}

/** Semantic landmarks that become components when they are identical on at least two screens. */
const SEMANTIC_NAMES: Record<string, string> = {
  aside: "Sidebar",
  nav: "Navbar",
  header: "Header",
  footer: "Footer",
};

/**
 * Finds parts repeated across screens and decides which become shared components.
 * Explicit parts (`data-component`) are always extracted; semantic landmarks only when two or more
 * screens contain identical markup. Variants are compared by their generated JSX, with the
 * current-page highlight normalised away, so a sidebar whose active item moves still matches.
 */
export function extractComponents(
  sources: ComponentSource[],
  baseContext: (doc: DocInfo) => PrintContext,
  componentOf: Map<Element, string>,
  componentProps: Map<Element, string>,
  usedNames: Set<string>,
  warn: (level: WarningLevel, message: string) => void,
): SharedComponent[] {
  const groups = new Map<string, { name: string; explicit: boolean; candidates: Candidate[] }>();
  const addCandidate = (name: string, candidate: Candidate) => {
    const key = `${candidate.explicit ? "e" : "s"}:${name}`;
    const group = groups.get(key) ?? { name, explicit: candidate.explicit, candidates: [] };
    group.candidates.push(candidate);
    groups.set(key, group);
  };

  for (const source of sources) {
    const collect = (el: Element, depth: number, insideCandidate: boolean) => {
      for (const child of childElements(el)) {
        const explicitName = getAttr(child, "data-component");
        if (explicitName !== null) {
          addCandidate(toPascal(explicitName) || "Section", { el: child, source, explicit: true, depth });
          collect(child, depth + 1, true);
        } else if (!insideCandidate && SEMANTIC_NAMES[child.tagName]) {
          addCandidate(SEMANTIC_NAMES[child.tagName], { el: child, source, explicit: false, depth });
          collect(child, depth + 1, true);
        } else {
          collect(child, depth + 1, insideCandidate);
        }
      }
    };
    collect(source.root, 0, false);
  }

  // Deepest groups first, so nested components are already replaced when their parents are compared.
  const ordered = [...groups.values()].sort(
    (a, b) =>
      Math.max(...b.candidates.map((c) => c.depth)) - Math.max(...a.candidates.map((c) => c.depth)) ||
      Number(b.explicit) - Number(a.explicit),
  );

  const components: SharedComponent[] = [];
  for (const group of ordered) {
    const resolveRoute = baseContext(group.candidates[0].source.doc).resolveRoute;
    const active = activeStateFor(group.candidates, resolveRoute);
    // Copies are compared by the JSX they produce, in a context like the component file's own.
    const contextFor = (candidate: Candidate, slots: SlotState | null): PrintContext => {
      const imports = createImports();
      const skip = (el: Element) => componentOf.has(el) && el !== candidate.el;
      return {
        ...baseContext(candidate.source.doc),
        imports,
        componentOf,
        componentProps,
        self: candidate.el,
        idScope: { screenId: candidate.source.screenId, replacement: toKebab(group.name) },
        active,
        slots,
        interactions: prepareInteractions(candidate.el, skip, imports, () => {}),
        forms: prepareForms(candidate.el, skip, imports, () => {}),
      };
    };

    const buckets = new Map<string, Candidate[]>();
    for (const candidate of group.candidates) {
      const ctx = contextFor(candidate, null);
      const key = [
        ...printElement(candidate.el, ctx, 0),
        ...ctx.imports.data.map((block) => block.source),
        ...ctx.imports.hooks,
      ].join("\n");
      buckets.set(key, [...(buckets.get(key) ?? []), candidate]);
    }

    const ranked = [...buckets.values()].sort((a, b) => b.length - a.length);
    let members = ranked[0];
    let props: { names: string[]; fills: Map<string, string>; values: Map<Candidate, string> } | null = null;
    if (ranked.length > 1) {
      const shared = shareThroughProps(group.candidates, contextFor);
      if (shared && shared.members.length > members.length) {
        members = shared.members;
        props = shared;
      }
    }

    const screens = unique(members.map((c) => c.source.screenId));
    if (!group.explicit && screens.length < 2) continue;

    const name = uniqueName(group.name, usedNames);
    for (const candidate of members) {
      componentOf.set(candidate.el, name);
      const values = props?.values.get(candidate);
      if (values) componentProps.set(candidate.el, values);
    }
    components.push({
      name,
      element: members[0].el,
      doc: members[0].source.doc,
      screenId: members[0].source.screenId,
      active,
      usedIn: screens,
      props: props ? { names: props.names, fills: props.fills } : null,
    });

    const rest = group.candidates.filter((c) => !members.includes(c));
    if (group.explicit && rest.length) {
      const differing = unique(rest.map((c) => c.source.screenId));
      warn(
        "warning",
        `Component "${name}" has different markup on: ${differing.join(", ")}. Those copies were kept inline; make the markup identical to share it.`,
      );
    }
  }

  return components;
}

/**
 * Copies whose JSX is identical once texts and values are left out (a Header showing each page's
 * title) become one component with props. Returns the largest such set and each copy's prop values.
 */
function shareThroughProps(
  candidates: Candidate[],
  contextFor: (candidate: Candidate, slots: SlotState | null) => PrintContext,
): { members: Candidate[]; names: string[]; fills: Map<string, string>; values: Map<Candidate, string> } | null {
  const captures = candidates.map((candidate) => {
    const slots: SlotState = { root: candidate.el, mode: "capture", captured: new Map(), fills: new Map() };
    return { candidate, skeleton: printElement(candidate.el, contextFor(candidate, slots), 0).join("\n"), captured: slots.captured };
  });
  const groups = new Map<string, typeof captures>();
  for (const capture of captures) groups.set(capture.skeleton, [...(groups.get(capture.skeleton) ?? []), capture]);
  const largest = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  if (largest.length < 2) return null;

  const first: Map<string, CapturedSlot> = largest[0].captured;
  const varying = [...first.keys()].filter((key) => new Set(largest.map((c) => c.captured.get(key)?.value)).size > 1);
  if (!varying.length || varying.length > MAX_PROPS) return null;
  if (varying.some((key) => ["svg", "list", "activeOn"].includes(first.get(key)!.hint.kind))) return null;

  const names = assignNames(
    varying.map((key) => ({ key, hint: first.get(key)!.hint, value: first.get(key)!.value })),
    largest[0].candidate.el,
  );
  const props = varying.map((key) => ({ key, name: names.get(key)! }));
  const values = new Map(
    largest.map((c) => [
      c.candidate,
      props.map((p) => `${p.name}=${jsxAttributeValue(c.captured.get(p.key)!.value)}`).join(" "),
    ]),
  );
  return {
    members: largest.map((c) => c.candidate),
    names: props.map((p) => p.name),
    fills: new Map(props.map((p) => [p.key, p.name])),
    values,
  };
}

function activeStateFor(
  candidates: Candidate[],
  resolveRoute: (el: Element, doc: DocInfo) => string | null,
): ActiveState | null {
  const classes = new Set<string>();
  const marked: { el: Element; isNav: boolean }[] = [];
  const alsoActiveOn = new Map<string, string[]>();

  for (const { el: root, source } of candidates) {
    const visit = (el: Element) => {
      const active = classList(el).filter((c) => ACTIVE_CLASSES.has(c));
      if (!active.length) return;
      const isNav = resolveRoute(el, source.doc) !== null;
      const navs = isNav ? [el] : findAll(el, (d) => resolveRoute(d, source.doc) !== null);
      if (navs.length !== 1) return;
      marked.push({ el, isNav });
      active.forEach((c) => classes.add(c));
      const target = resolveRoute(navs[0], source.doc)!;
      if (target !== source.route) {
        const routes = alsoActiveOn.get(target) ?? [];
        if (!routes.includes(source.route)) alsoActiveOn.set(target, [...routes, source.route]);
      }
    };
    visit(root);
    walkElements(root, (el) => visit(el));
  }

  if (!classes.size) return null;
  const kinds = (isNav: boolean) => new Set(marked.filter((m) => m.isNav === isNav).map((m) => elementKind(m.el, classes)));
  return { classes: [...classes], navKinds: kinds(true), holderKinds: kinds(false), alsoActiveOn };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
