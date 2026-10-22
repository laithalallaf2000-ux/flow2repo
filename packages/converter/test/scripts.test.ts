import { describe, expect, it } from "vitest";
import { convert, readFixture } from "./helpers";

describe("design scripts", () => {
  it("serves local scripts from public/ and loads them from the page", () => {
    const { file, has, result } = convert(readFixture("vanilla-js-site"));
    const page = file("src/pages/HomePage.tsx");
    expect(page).toContain(`import { useDesignScripts } from "../lib/useDesignScripts";`);
    expect(page).toContain(`const DESIGN_SCRIPTS: string[] = ["/script.js"];`);
    expect(page).toContain("  useDesignScripts(DESIGN_SCRIPTS);");
    expect(page).toContain(`<button id="myButton">Click Me</button>`);
    expect(has("src/lib/useDesignScripts.ts")).toBe(true);
    expect(file("public/script.js")).toMatch(/^\/\/ From the original design[^\n]*\n\{\n\nconst button/);
    expect(file("public/script.js").trimEnd().endsWith("}")).toBe(true);
    expect(file("index.html")).toContain(`<link rel="stylesheet" href="/style.css" />`);
    expect(result.warnings.some((w) => w.message.startsWith("Kept 1 script"))).toBe(true);
  });

  it("writes inline scripts to files and keeps onclick handlers", () => {
    const { file } = convert(readFixture("heuristic-mobile-grid"));
    const home = file("src/pages/HomePage.tsx");
    expect(home).toContain(`data-f2r-onclick="startWorkout()"`);
    expect(home).toContain(`["/design-scripts/index-inline-1.js"]`);
    expect(file("public/design-scripts/index-inline-1.js")).toContain("function startWorkout()");
  });

  it("loads CDN scripts once from index.html", () => {
    const { file, has } = convert(
      `<html><head><script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1" defer></script></head><body><p>Hi</p></body></html>`,
    );
    expect(file("index.html")).toContain(`<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1" defer></script>`);
    expect(has("src/lib/useDesignScripts.ts")).toBe(false);
  });

  it("generates nothing script related for designs without JavaScript", () => {
    const { file, has } = convert(readFixture("spec-saas-dashboard"));
    expect(has("src/lib/useDesignScripts.ts")).toBe(false);
    expect(file("src/pages/OrdersPage.tsx")).not.toContain("useDesignScripts");
  });
});

describe("whitespace around removed scripts", () => {
  it("does not leave a stray space where a script was", () => {
    const { file } = convert(readFixture("vanilla-js-site"));
    expect(file("src/pages/HomePage.tsx")).toContain(`<button id="myButton">Click Me</button>\n    </div>`);
  });
});
