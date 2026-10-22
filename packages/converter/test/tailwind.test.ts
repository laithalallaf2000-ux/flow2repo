import { describe, expect, it } from "vitest";
import { convert, spec } from "./helpers";

const SCREEN = `<section data-screen="home"><h1 class="text-2xl font-bold">Hi</h1></section>`;

describe("tailwind", () => {
  it("installs Tailwind v3 instead of loading the CDN and moves the inline config", () => {
    const { file, has, result } = convert(spec(SCREEN, `
      <script src="https://cdn.tailwindcss.com"></script>
      <script>tailwind.config = { theme: { extend: { colors: { brand: "#123456" } } } }</script>
      <style>.card { color: red; }</style>`));
    expect(file("index.html")).not.toContain("cdn.tailwindcss.com");
    expect(has("src/lib/useDesignScripts.ts")).toBe(false);
    expect(file("tailwind.config.js")).toContain(`brand: "#123456"`);
    expect(file("tailwind.config.js")).toContain(`"./src/**/*.{ts,tsx}"`);
    expect(has("postcss.config.js")).toBe(true);
    const pkg = JSON.parse(file("package.json"));
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^3/);
    expect(pkg.devDependencies.autoprefixer).toBeDefined();
    const css = file("src/styles/global.css");
    expect(css.indexOf("@tailwind base")).toBeLessThan(css.indexOf(".card"));
    expect(css.indexOf(".card")).toBeLessThan(css.indexOf("@tailwind utilities"));
    expect(file(result.pages[0].file)).toContain(`className="text-2xl font-bold"`);
  });

  it("installs Tailwind v4 with the Vite plugin for the browser build", () => {
    const { file, has } = convert(spec(SCREEN, `
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <style type="text/tailwindcss">@theme { --color-brand: #123456; }</style>`));
    expect(file("index.html")).not.toContain("@tailwindcss/browser");
    expect(file("vite.config.ts")).toContain("tailwindcss()");
    expect(JSON.parse(file("package.json")).devDependencies["@tailwindcss/vite"]).toBeDefined();
    expect(file("src/styles/global.css").startsWith(`@import "tailwindcss";`)).toBe(true);
    expect(file("src/styles/global.css")).toContain("--color-brand");
    expect(has("tailwind.config.js")).toBe(false);
  });

  it("adds nothing Tailwind related to other designs", () => {
    const { file, has } = convert(spec(SCREEN));
    expect(has("tailwind.config.js")).toBe(false);
    expect(file("package.json")).not.toContain("tailwindcss");
  });
});
