export function toKebab(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toPascal(value: string): string {
  const name = toKebab(value)
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
  if (!name) return "";
  return /^[0-9]/.test(name) ? `N${name}` : name;
}

export function toTitle(value: string): string {
  return toKebab(value)
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function uniqueName(base: string, used: Set<string>, separator = ""): string {
  let name = base;
  for (let i = 2; used.has(name); i++) name = `${base}${separator}${i}`;
  used.add(name);
  return name;
}

export function toPackageName(value: string): string {
  return toKebab(value).slice(0, 60) || "my-react-app";
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

export function toCamel(value: string): string {
  const pascal = toPascal(value);
  return pascal ? pascal[0].toLowerCase() + pascal.slice(1) : "";
}

export function pluralize(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/** "orders" → "order", "navigationItems" → "navigationItem". Words that are not plural get "Item". */
export function singularize(word: string): string {
  if (/ies$/i.test(word) && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(ss|us|is)$/i.test(word)) return `${word}Item`;
  if (/(x|z|ch|sh|ss|us)es$/i.test(word)) return word.slice(0, -2);
  if (/[^s]s$/i.test(word)) return word.slice(0, -1);
  return `${word}Item`;
}

const RESERVED_WORDS = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else",
  "enum", "export", "extends", "false", "finally", "for", "function", "if", "import", "in", "instanceof",
  "new", "null", "return", "super", "switch", "this", "throw", "true", "try", "typeof", "var", "void",
  "while", "with", "yield", "let", "static", "implements", "interface", "package", "private",
  "protected", "public", "await", "children", "key", "ref", "navigate", "pathname", "index", "props", "event",
]);

/** A valid, non-reserved TypeScript identifier for a value (field, variable, array). */
export function safeIdentifier(name: string): string {
  const cleaned = /^[A-Za-z_$][\w$]*$/.test(name) ? name : toCamel(name) || "value";
  return RESERVED_WORDS.has(cleaned) ? `${cleaned}Value` : cleaned;
}

/** Names a generated interface must not take: they clash with React Router, React or browser globals. */
const RESERVED_TYPE_NAMES = new Set([
  "Link", "NavLink", "Navigate", "Route", "Routes", "Router", "Outlet", "Form", "Element", "Text", "Image",
  "Date", "Map", "Set", "Object", "Array", "String", "Number", "Boolean", "Error", "Event", "Node", "Document",
  "Window", "History", "Location", "Request", "Response", "Option", "Selection", "Range", "Comment", "File",
  "Blob", "URL", "Headers", "Promise", "Symbol", "Function", "Record", "Partial", "Required", "Readonly",
  "Pick", "Omit", "Exclude", "Extract", "Audio", "Video", "Notification", "Animation", "Screen", "Storage",
  "Plugin", "Component", "ReactNode", "CSSProperties", "FormEvent", "ChangeEvent", "App",
]);

/** Interface name for a list's items: PascalCase, never a reserved name, never a duplicate. */
export function typeName(base: string, taken: Set<string>): string {
  let name = toPascal(base) || "Item";
  if (RESERVED_TYPE_NAMES.has(name)) name = `${name}Item`;
  return uniqueName(name, taken);
}
