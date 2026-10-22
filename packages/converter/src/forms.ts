import { classList, collapseWhitespace, findAll, getAttr, hasAttr, textContent, walkElements, type Element } from "./dom";
import type { FileImports } from "./jsx";
import { isGenericName } from "./lists";
import { safeIdentifier, toCamel, toPascal, uniqueName } from "./naming";
import type { WarningLevel } from "./types";

/** Names the code of one form is built from. */
export interface FormState {
  /** Typed values interface, e.g. `ContactFormValues`. */
  typeName: string;
  values: string;
  setValues: string;
  setField: string;
  initial: string;
  submit: string;
}

export type ControlKind = "text" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "checkboxGroup";

export type FormBinding =
  | { kind: "form"; form: FormState }
  | { kind: ControlKind; form: FormState; field: string; value: string };

const TEXT_INPUTS = new Set([
  "text", "email", "password", "search", "tel", "url", "number", "date", "time", "datetime-local", "month",
  "week", "color", "range",
]);

interface Control {
  el: Element;
  kind: ControlKind;
  field: string;
  /** Value the control stands for (radio / checkbox option, or the control's own value). */
  value: string;
}

/**
 * Finds the forms of one file's markup (a page or a shared component) and gives their text fields,
 * selects, checkboxes and radios React state: one typed values object per form, a `setField`
 * helper and an `onSubmit` handler that stops the browser from navigating. Native validation
 * (`required`, `type="email"`…) still runs before the handler is called. Nothing is sent anywhere:
 * the handler is the place to call your API.
 */
export function prepareForms(
  root: Element,
  skip: (el: Element) => boolean,
  imports: FileImports,
  warn: (level: WarningLevel, message: string) => void,
): Map<Element, FormBinding> {
  const bindings = new Map<Element, FormBinding>();
  const forms: Element[] = [];
  const visit = (el: Element) => {
    if (el !== root && skip(el)) return false;
    if (el.tagName === "form") {
      forms.push(el);
      return false;
    }
    return true;
  };
  if (root.tagName === "form") forms.push(root);
  else walkElements(root, visit);

  for (const form of forms) {
    const controls = collectControls(form);
    if (controls.length === 0) continue;

    const base = uniqueName(formBase(form), imports.names);
    const pascal = toPascal(base);
    const state: FormState = {
      typeName: uniqueName(`${pascal}${/form$/i.test(pascal) ? "" : "Form"}Values`, new Set(imports.forms.map((f) => f.typeName))),
      values: `${base}Values`,
      setValues: `set${pascal}Values`,
      setField: `set${pascal}Field`,
      initial: `initial${pascal}Values`,
      submit: `handle${pascal}Submit`,
    };
    for (const name of [state.values, state.setValues, state.setField, state.initial, state.submit]) imports.names.add(name);

    const fields = new Map<string, Control[]>();
    for (const control of controls) fields.set(control.field, [...(fields.get(control.field) ?? []), control]);

    const members: string[] = [];
    const defaults: string[] = [];
    for (const [field, group] of fields) {
      const kind = group[0].kind;
      members.push(`${INDENT}${field}: ${kind === "checkbox" ? "boolean" : kind === "checkboxGroup" || kind === "multiselect" ? "string[]" : "string"};`);
      defaults.push(`${INDENT}${field}: ${initialValue(group)},`);
      for (const control of group) bindings.set(control.el, { kind: control.kind, form: state, field, value: control.value });
    }
    bindings.set(form, { kind: "form", form: state });

    imports.state = true;
    imports.reactTypes.add("FormEvent");
    imports.forms.push({ typeName: state.typeName, type: [`export interface ${state.typeName} {`, ...members, "}"].join("\n") });
    imports.hooks.push(
      `  const ${state.initial}: ${state.typeName} = {`,
      ...defaults.map((line) => `  ${line}`),
      "  };",
      `  const [${state.values}, ${state.setValues}] = useState<${state.typeName}>(${state.initial});`,
      `  const ${state.setField} = <K extends keyof ${state.typeName}>(field: K, value: ${state.typeName}[K]) =>`,
      `    ${state.setValues}((current) => ({ ...current, [field]: value }));`,
      `  const ${state.submit} = (event: FormEvent<HTMLFormElement>) => {`,
      "    event.preventDefault();",
      `    // No backend is connected. Send \`${state.values}\` to your API here.`,
      "  };",
    );
    warn("info", `Form "${base}" keeps its values in state (${state.values}). Connect ${state.submit} to your API: nothing is sent yet.`);
  }
  return bindings;
}

const INDENT = "  ";

function collectControls(form: Element): Control[] {
  const controls: Control[] = [];
  const taken = new Set<string>();
  const checkboxNames = new Map<string, number>();
  const inputs = findAll(form, (el) => ["input", "textarea", "select"].includes(el.tagName));

  for (const el of inputs) {
    if (el.tagName === "input" && (getAttr(el, "type") ?? "text").toLowerCase() === "checkbox") {
      const name = getAttr(el, "name");
      if (name) checkboxNames.set(name, (checkboxNames.get(name) ?? 0) + 1);
    }
  }

  const fieldFor = new Map<string, string>();
  for (const el of inputs) {
    const type = (getAttr(el, "type") ?? "text").toLowerCase();
    let kind: ControlKind;
    if (el.tagName === "textarea") kind = "textarea";
    else if (el.tagName === "select") kind = hasAttr(el, "multiple") ? "multiselect" : "select";
    else if (type === "radio") kind = "radio";
    else if (type === "checkbox") kind = (checkboxNames.get(getAttr(el, "name") ?? "") ?? 0) > 1 ? "checkboxGroup" : "checkbox";
    else if (TEXT_INPUTS.has(type)) kind = "text";
    else continue;

    const groupKey = getAttr(el, "name") && ["radio", "checkboxGroup"].includes(kind) ? `${kind}:${getAttr(el, "name")}` : null;
    let field = groupKey ? fieldFor.get(groupKey) : undefined;
    if (!field) {
      field = uniqueName(safeIdentifier(fieldBase(el, form, controls.length)), taken);
      if (groupKey) fieldFor.set(groupKey, field);
    }
    controls.push({ el, kind, field, value: getAttr(el, "value") ?? (kind === "checkbox" || kind === "checkboxGroup" ? "on" : "") });
  }
  return controls;
}

/** Field name: the control's name, else its id, label, placeholder or aria-label. */
function fieldBase(el: Element, form: Element, index: number): string {
  const id = getAttr(el, "id");
  const label = id ? findAll(form, (l) => l.tagName === "label" && getAttr(l, "for") === id)[0] : undefined;
  const candidates = [
    getAttr(el, "name"),
    id,
    label ? collapseWhitespace(textContent(label)) : null,
    getAttr(el, "aria-label"),
    getAttr(el, "placeholder"),
  ];
  for (const candidate of candidates) {
    const name = candidate ? toCamel(candidate.replace(/\[\]$/, "").replace(/[[\]]+/g, " ")) : "";
    if (name && name.length <= 32) return name;
  }
  return `field${index + 1}`;
}

/** Name of the form: its id, name or label, else the class of the form, else "form". */
function formBase(form: Element): string {
  const candidates = [getAttr(form, "id"), getAttr(form, "name"), getAttr(form, "aria-label"), classList(form).find((c) => !c.includes("--") && !isGenericName(c))];
  for (const candidate of candidates) {
    const name = candidate ? toCamel(candidate) : "";
    if (name && name.length <= 24 && !isGenericName(name)) return safeIdentifier(name);
  }
  return "form";
}

function initialValue(group: Control[]): string {
  const first = group[0];
  const el = first.el;
  switch (first.kind) {
    case "checkbox":
      return hasAttr(el, "checked") ? "true" : "false";
    case "checkboxGroup":
      return `[${group.filter((c) => hasAttr(c.el, "checked")).map((c) => JSON.stringify(c.value)).join(", ")}]`;
    case "radio": {
      const checked = group.find((c) => hasAttr(c.el, "checked"));
      return JSON.stringify(checked?.value ?? "");
    }
    case "textarea":
      return JSON.stringify(textContent(el).replace(/^\n/, ""));
    case "select":
    case "multiselect": {
      const options = findAll(el, (o) => o.tagName === "option");
      const value = (o: Element) => getAttr(o, "value") ?? collapseWhitespace(textContent(o));
      const selected = options.filter((o) => hasAttr(o, "selected")).map(value);
      if (first.kind === "multiselect") return `[${selected.map((v) => JSON.stringify(v)).join(", ")}]`;
      return JSON.stringify(selected[0] ?? (options[0] ? value(options[0]) : ""));
    }
    default:
      return JSON.stringify(getAttr(el, "value") ?? "");
  }
}

/** Props that bind a control (or the form itself) to its state. */
export function bindingProps(binding: FormBinding): string[] {
  const { form } = binding;
  if (binding.kind === "form") {
    return [`onSubmit={${form.submit}}`, `onReset={() => ${form.setValues}(${form.initial})}`];
  }
  const current = `${form.values}.${binding.field}`;
  const set = (value: string) => `${form.setField}(${JSON.stringify(binding.field)}, ${value})`;
  switch (binding.kind) {
    case "text":
    case "textarea":
    case "select":
      return [`value={${current}}`, `onChange={(event) => ${set("event.target.value")}}`];
    case "multiselect":
      return [
        `value={${current}}`,
        `onChange={(event) => ${set("Array.from(event.target.selectedOptions, (option) => option.value)")}}`,
      ];
    case "checkbox":
      return [`checked={${current}}`, `onChange={(event) => ${set("event.target.checked")}}`];
    case "checkboxGroup": {
      const option = JSON.stringify(binding.value);
      return [
        `checked={${current}.includes(${option})}`,
        `onChange={(event) => ${set(`event.target.checked ? [...${current}, ${option}] : ${current}.filter((item) => item !== ${option})`)}}`,
      ];
    }
    case "radio":
      return [`checked={${current} === ${JSON.stringify(binding.value)}}`, `onChange={() => ${set(JSON.stringify(binding.value))}}`];
  }
}

/** Whether the control's own `value`, `checked` or default text is replaced by the state binding. */
export function isControlled(binding: FormBinding | undefined): binding is Extract<FormBinding, { field: string }> {
  return !!binding && binding.kind !== "form";
}
