import { ACTIVE_CLASSES } from "./attributes";
import { childElements, classList, collapseWhitespace, findAll, getAttr, textContent, walkElements, type Element } from "./dom";
import type { FileImports } from "./jsx";
import { toKebab, toPascal } from "./naming";
import type { WarningLevel } from "./types";

/** `data-toggle="menu"` opens and closes every `data-toggle-target="menu"` (class `is-open`). */
export interface ToggleState {
  id: string;
  /** Boolean state variable, e.g. `menuOpen`. */
  open: string;
  setter: string;
}

/** Tabs sharing `data-tab-group="billing"`: one selected value, e.g. `billingTab`. */
export interface TabGroup {
  id: string;
  value: string;
  setter: string;
  /** Class the design puts on the selected tab, e.g. `is-active` or `active`. */
  activeClass: string;
}

export type Interaction =
  | { kind: "toggle-trigger"; state: ToggleState }
  | { kind: "close-trigger"; state: ToggleState }
  | { kind: "toggle-target"; state: ToggleState }
  | { kind: "tab"; group: TabGroup; value: string }
  | { kind: "tab-panel"; group: TabGroup; value: string };

/**
 * Finds the toggles and tabs declared in one file's markup (a page or a shared component) and
 * declares their state in `imports`. A trigger and its target must live in the same file, since
 * the state belongs to that component.
 */
export function prepareInteractions(
  root: Element,
  skip: (el: Element) => boolean,
  imports: FileImports,
  warn: (level: WarningLevel, message: string) => void,
): Map<Element, Interaction> {
  const triggers = new Map<string, Element[]>();
  const closers = new Map<string, Element[]>();
  const targets = new Map<string, Element[]>();
  const tabs = new Map<string, { el: Element; value: string }[]>();
  const panels = new Map<string, { el: Element; value: string }[]>();
  const add = <T>(map: Map<string, T[]>, key: string, value: T) => map.set(key, [...(map.get(key) ?? []), value]);

  const visit = (el: Element) => {
    if (el !== root && skip(el)) return false;
    const toggle = getAttr(el, "data-toggle");
    const close = getAttr(el, "data-close");
    const target = getAttr(el, "data-toggle-target");
    let group = getAttr(el, "data-tab-group");
    let tab = getAttr(el, "data-tab");
    let panel = getAttr(el, "data-tab-panel");
    // ARIA tabs (role="tab" with aria-controls) are tabs without any Flow2Repo marker.
    const aria = ariaTabs.get(el);
    if (aria) {
      group = aria.group;
      if (aria.kind === "tab") tab = aria.value;
      else panel = aria.value;
    }
    if (toggle) add(triggers, toKebab(toggle), el);
    if (close) add(closers, toKebab(close), el);
    if (target) add(targets, toKebab(target), el);
    if (group && tab) add(tabs, toKebab(group), { el, value: tab });
    if (group && panel) add(panels, toKebab(group), { el, value: panel });
    return true;
  };
  const ariaTabs = findAriaTabs(root, skip);
  visit(root);
  walkElements(root, visit);

  const interactions = new Map<Element, Interaction>();

  for (const id of new Set([...triggers.keys(), ...closers.keys(), ...targets.keys()])) {
    const targetEls = targets.get(id) ?? [];
    const triggerEls = [...(triggers.get(id) ?? []), ...(closers.get(id) ?? [])];
    if (!targetEls.length || !triggerEls.length) {
      warn("warning", `Toggle "${id}" needs both a data-toggle button and a data-toggle-target in the same page or component; it was left static.`);
      continue;
    }
    const name = variableName(id);
    const state: ToggleState = { id, open: `${name}Open`, setter: `set${toPascal(id) || "Toggle"}Open` };
    const initial = targetEls.some((el) => classList(el).includes("is-open"));
    imports.state = true;
    imports.hooks.push(`  const [${state.open}, ${state.setter}] = useState(${initial});`);
    imports.names.add(state.open).add(state.setter);
    for (const el of triggers.get(id) ?? []) interactions.set(el, { kind: "toggle-trigger", state });
    for (const el of closers.get(id) ?? []) interactions.set(el, { kind: "close-trigger", state });
    for (const el of targetEls) interactions.set(el, { kind: "toggle-target", state });
  }

  for (const [id, groupTabs] of tabs) {
    const groupPanels = panels.get(id) ?? [];
    const name = variableName(id);
    const selected = groupTabs.find((t) => classList(t.el).some((c) => ACTIVE_CLASSES.has(c)) || getAttr(t.el, "aria-selected") === "true");
    const activeClass = selected ? (classList(selected.el).find((c) => ACTIVE_CLASSES.has(c)) ?? "is-active") : "is-active";
    const group: TabGroup = { id, value: `${name}Tab`, setter: `set${toPascal(id) || "Group"}Tab`, activeClass };
    const initial = (selected ?? groupTabs[0]).value;
    imports.state = true;
    imports.hooks.push(`  const [${group.value}, ${group.setter}] = useState(${JSON.stringify(initial)});`);
    imports.names.add(group.value).add(group.setter);
    for (const t of groupTabs) interactions.set(t.el, { kind: "tab", group, value: t.value });
    for (const p of groupPanels) interactions.set(p.el, { kind: "tab-panel", group, value: p.value });
  }
  for (const id of panels.keys()) {
    if (!tabs.has(id)) warn("warning", `Tab panels of group "${id}" have no data-tab buttons in the same page or component.`);
  }
  warnLooseTabs(root, skip, interactions, warn);

  return interactions;
}

/** Tab buttons and their panels written with ARIA: `role="tab"` + `aria-controls`, panels `role="tabpanel"`. */
function findAriaTabs(
  root: Element,
  skip: (el: Element) => boolean,
): Map<Element, { kind: "tab" | "panel"; group: string; value: string }> {
  const result = new Map<Element, { kind: "tab" | "panel"; group: string; value: string }>();
  const lists = findAll(root, (el) => getAttr(el, "role") === "tablist" && !skip(el));
  lists.forEach((list, i) => {
    const group = toKebab(getAttr(list, "id") ?? getAttr(list, "aria-label") ?? "") || `tabs${lists.length > 1 ? i + 1 : ""}`;
    for (const tab of findAll(list, (el) => getAttr(el, "role") === "tab")) {
      const controls = getAttr(tab, "aria-controls");
      const panel = controls ? findAll(root, (el) => getAttr(el, "id") === controls)[0] : undefined;
      if (!controls || !panel || skip(panel)) continue;
      result.set(tab, { kind: "tab", group, value: controls });
      result.set(panel, { kind: "panel", group, value: controls });
    }
  });
  return result;
}

/**
 * Buttons that look like tabs (a "tabs" container) but carry no marker stay static. Say so, instead
 * of leaving a design whose tabs do nothing without a word.
 */
function warnLooseTabs(
  root: Element,
  skip: (el: Element) => boolean,
  interactions: Map<Element, Interaction>,
  warn: (level: WarningLevel, message: string) => void,
): void {
  const looksLikeTabs = (el: Element) => classList(el).some((c) => /(^|[-_])(tabs?|tablist|tab-list|segmented)([-_]|$)/i.test(c));
  for (const container of findAll(root, (el) => !skip(el) && looksLikeTabs(el))) {
    const buttons = childElements(container).filter((c) => c.tagName === "button" || c.tagName === "a");
    if (buttons.length < 2 || buttons.some((b) => interactions.has(b) || getAttr(b, "data-goto") !== null)) continue;
    const labels = buttons.map((b) => collapseWhitespace(textContent(b))).join(", ");
    warn(
      "info",
      `Tabs "${labels}" were left static: they have no data-tab markers, so clicking them changes nothing. Add data-tab-group / data-tab to the buttons and data-tab-panel to the panels (see docs/prompts/).`,
    );
  }
}

function variableName(id: string): string {
  const pascal = toPascal(id) || "Panel";
  return pascal[0].toLowerCase() + pascal.slice(1);
}
