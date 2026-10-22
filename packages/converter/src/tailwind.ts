import type { DesignScript, DocInfo } from "./analyze";
import { getAttr } from "./dom";
import type { WarningLevel } from "./types";

/**
 * Tailwind as the design used it: the play CDN (v3, `cdn.tailwindcss.com`) or the browser build
 * (v4, `@tailwindcss/browser`). The generated project installs the real package instead.
 */
export interface TailwindSetup {
  version: 3 | 4;
  /** `tailwind.config.js` source, built from the design's inline `tailwind.config = {…}`. */
  config: string | null;
  /** Scripts that only existed to run Tailwind in the browser; the project no longer loads them. */
  scripts: Set<DesignScript>;
}

const V3_CDN = /^(https?:)?\/\/cdn\.tailwindcss\.com/i;
const V4_BROWSER = /@tailwindcss\/browser/i;
const INLINE_CONFIG = /^\s*(?:window\.)?tailwind\.config\s*=\s*(\{[\s\S]*\})\s*;?\s*$/;

export function detectTailwind(docs: DocInfo[], warn: (level: WarningLevel, message: string) => void): TailwindSetup | null {
  let version: 3 | 4 | null = null;
  const scripts = new Set<DesignScript>();

  for (const doc of docs) {
    for (const script of doc.scripts) {
      if (script.kind !== "remote") continue;
      const src = (getAttr(script.element, "src") ?? "").trim();
      const found = V3_CDN.test(src) ? 3 : V4_BROWSER.test(src) ? 4 : null;
      if (!found) continue;
      version = version === 4 || found === 4 ? 4 : 3;
      scripts.add(script);
    }
  }
  if (!version) return null;

  let config: string | null = null;
  if (version === 3) {
    for (const doc of docs) {
      for (const script of doc.scripts) {
        if (script.kind !== "inline" || !/\btailwind\.config\b/.test(script.code)) continue;
        scripts.add(script);
        const match = INLINE_CONFIG.exec(script.code);
        if (match && !config) config = tailwindConfig(match[1]);
        else if (!match) warn("warning", "The inline tailwind.config of the design could not be moved to tailwind.config.js automatically. Copy it over by hand.");
      }
    }
    config ??= tailwindConfig("{}");
  } else {
  }
  return { version, config, scripts };
}

function tailwindConfig(designConfig: string): string {
  return `const design = ${designConfig};

/** @type {import('tailwindcss').Config} */
export default {
  ...design,
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
};
`;
}

export const POSTCSS_CONFIG = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

export function tailwindDependencies(version: 3 | 4): Record<string, string> {
  return version === 3
    ? { tailwindcss: "^3.4.17", postcss: "^8.5.0", autoprefixer: "^10.4.20" }
    : { tailwindcss: "^4.1.0", "@tailwindcss/vite": "^4.1.0" };
}

/** Tailwind's layers wrapped around the design's own CSS, in the order the CDN applied them. */
export function withTailwindCss(version: 3 | 4, designCss: string): string {
  if (version === 4) return `@import "tailwindcss";\n\n${designCss}`;
  return `@tailwind base;\n@tailwind components;\n\n${designCss}\n@tailwind utilities;\n`;
}
