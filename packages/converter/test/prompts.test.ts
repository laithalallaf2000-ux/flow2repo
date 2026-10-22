import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { convert } from "./helpers";

/** The skeleton inside a prompt: what the AI is told to imitate must convert cleanly. */
function skeleton(name: string): string {
  const prompt = readFileSync(join(import.meta.dirname, `../../../docs/prompts/${name}.md`), "utf8");
  return prompt.split("```html")[1].split("```")[0];
}

describe("prompt skeletons", () => {
  it("dashboard: sidebar, top bar with a title prop, toggle state and data lists", () => {
    const { analysis, result, file } = convert(skeleton("dashboard"));
    expect(analysis.mode).toBe("spec");
    expect(result.components.map((c) => c.name)).toEqual(["Sidebar", "Topbar"]);
    expect(file("src/pages/OrdersPage.tsx")).toContain(`<Topbar title="Orders" />`);
    expect(file("src/components/Topbar.tsx")).toContain("useState(false)");
    expect(file("src/pages/DashboardPage.tsx")).toContain("{stats.map((stat) => (");
    expect(file("src/pages/OrdersPage.tsx")).toContain("orderRows.map(");
    // Only the screens the skeleton leaves out may be reported.
    expect(result.warnings.filter((w) => w.level !== "info").every((w) => /settings|order-details/.test(w.message))).toBe(true);
  });

  it("website: navbar with a mobile menu, footer, feature list and pricing tabs", () => {
    const { analysis, result, file } = convert(skeleton("website"));
    expect(analysis.mode).toBe("spec");
    expect(result.components.map((c) => c.name)).toEqual(["Footer", "Navbar"]);
    expect(file("src/components/Navbar.tsx")).toContain("setNavMenuOpen((open) => !open)");
    expect(file("src/pages/HomePage.tsx")).toContain("{features.map((feature) => (");
    expect(file("src/pages/HomePage.tsx")).toContain(`href="#home-features"`);
    expect(file("src/pages/PricingPage.tsx")).toContain(`useState("monthly")`);
    expect(result.warnings.filter((w) => w.level !== "info")).toEqual([]);
  });
});
