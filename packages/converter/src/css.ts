/** Splits an inline `style` attribute into declarations, respecting quotes and parentheses (e.g. data: URLs). */
export function parseInlineStyle(style: string): [string, string][] {
  const declarations: [string, string][] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;

  const flush = () => {
    const index = current.indexOf(":");
    if (index > 0) {
      const property = current.slice(0, index).trim();
      const value = current.slice(index + 1).trim();
      if (property && value) declarations.push([property, value]);
    }
    current = "";
  };

  for (const char of style) {
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    } else if (char === ";" && depth === 0) {
      flush();
      continue;
    }
    current += char;
  }
  flush();
  return declarations;
}

/** CSS property name to React style key: "background-color" → "backgroundColor", "-webkit-mask" → "WebkitMask". */
export function cssPropertyToJs(property: string): string {
  if (property.startsWith("--")) return property;
  let name = property.toLowerCase();
  if (name.startsWith("-ms-")) name = name.slice(1);
  return name.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

/** Rewrites every url(...) reference in a CSS string. */
export function rewriteCssUrls(css: string, rewrite: (url: string) => string): string {
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote: string, url: string) => {
    if (!url) return match;
    const next = rewrite(url);
    return next === url ? match : `url(${quote}${next}${quote})`;
  });
}

/** Removes the common leading indentation of a <style> block so the extracted CSS file reads cleanly. */
export function dedentCss(css: string): string {
  const lines = css.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)![0].length);
  const indent = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(indent).trimEnd()).join("\n");
}
