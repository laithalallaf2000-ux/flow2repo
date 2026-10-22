import { describe, expect, it } from "vitest";
import { convert, readFixture, spec } from "./helpers";

describe("interactions", () => {
  it("turns data-toggle and tabs into useState", () => {
    const { file } = convert(spec(`
      <section data-screen="home">
        <button data-toggle="menu">Menu</button>
        <nav class="menu" data-toggle-target="menu"><button data-close="menu">Close</button></nav>
        <div class="tabs">
          <button class="tab is-active" data-tab-group="billing" data-tab="monthly">Monthly</button>
          <button class="tab" data-tab-group="billing" data-tab="yearly">Yearly</button>
        </div>
        <div data-tab-group="billing" data-tab-panel="monthly">M</div>
        <div data-tab-group="billing" data-tab-panel="yearly" hidden>Y</div>
      </section>`));
    const page = file("src/pages/HomePage.tsx");
    expect(page).toContain(`import { useState } from "react";`);
    expect(page).toContain("const [menuOpen, setMenuOpen] = useState(false);");
    expect(page).toContain(`const [billingTab, setBillingTab] = useState("monthly");`);
    expect(page).not.toContain("data-toggle");
    expect(page).not.toContain("data-tab");
  });

  it("turns a dropdown menu, a modal with a close button and accordions into state-driven React", () => {
    const shop = convert(readFixture("ecommerce-admin"));
    const dashboard = shop.file("src/pages/DashboardPage.tsx");
    expect(dashboard).toContain("const [exportOpen, setExportOpen] = useState(false);");
    expect(dashboard).toContain(`className={exportOpen ? "menu__panel is-open" : "menu__panel"}`);
    const products = shop.file("src/pages/ProductsPage.tsx");
    expect(products).toContain(`className={newProductOpen ? "modal is-open" : "modal"}`);
    expect(products).toContain("onClick={() => setNewProductOpen(false)}");
    const crm = convert(readFixture("crm-app")).file("src/pages/ContactDetailPage.tsx");
    expect(crm).toContain(`className={callOpen ? "faq__a is-open" : "faq__a"}`);
    expect(crm).toContain("aria-expanded={mailOpen}");
    const faq = convert(readFixture("pricing-nested")).file("src/pages/HelpPage.tsx");
    expect(faq).toContain("setTrialOpen((open) => !open)");
  });

  it("uses React state and handlers only: no DOM lookups in generated pages", () => {
    for (const name of ["ecommerce-admin", "crm-app", "pricing-nested"]) {
      const { result } = convert(readFixture(name));
      for (const f of result.files.filter((x) => x.path.startsWith("src/pages/"))) {
        expect(String(f.data)).not.toMatch(/document\.|getElementById|querySelector|classList/);
      }
    }
  });

  it("tells you plainly that design scripts and inline handlers were kept, not converted to React", () => {
    const { result } = convert(readFixture("heuristic-mobile-grid"));
    const kept = result.warnings.find((w) => w.message.startsWith("Kept 1 script"));
    expect(kept?.level).toBe("warning");
    expect(kept?.message).toContain("did not convert");
    expect(kept?.message).toContain("Re-implement that behavior with React");
    const handlers = result.warnings.find((w) => w.message.startsWith("Inline event handlers"));
    expect(handlers?.level).toBe("warning");
    expect(handlers?.message).toContain("not React handlers");
  });

  it("does not warn about scripts for designs that use only the supported markers", () => {
    const { result } = convert(readFixture("ecommerce-admin"));
    expect(result.warnings.filter((w) => w.level !== "info")).toEqual([]);
  });

  it("warns when a toggle's trigger and target are not in the same page or component", () => {
    const { result } = convert(spec(`<section data-screen="home"><button data-toggle="x">Open</button></section>`));
    expect(result.warnings.some((w) => w.level === "warning" && w.message.includes('Toggle "x"'))).toBe(true);
  });
});
