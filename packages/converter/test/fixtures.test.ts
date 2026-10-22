import { describe, expect, it } from "vitest";
import { convert, listFixtures, readFixture } from "./helpers";

/** Invariants every generated project must satisfy, whatever the design. */
describe.each(listFixtures())("generated structure of %s", (name) => {
  const { result, file } = convert(readFixture(name));
  const paths = new Set(result.files.map((f) => f.path));
  const sources = result.files.filter((f) => /^src\/.*\.(tsx?|css)$/.test(f.path));

  it("only imports files that exist", () => {
    const missing: string[] = [];
    for (const f of sources.filter((s) => /\.tsx?$/.test(s.path))) {
      const dir = f.path.split("/").slice(0, -1);
      for (const m of String(f.data).matchAll(/from "(\.[^"]+)"|import "(\.[^"]+)"/g)) {
        const spec = m[1] ?? m[2];
        const parts = [...dir];
        for (const part of spec.split("/")) {
          if (part === "..") parts.pop();
          else if (part !== ".") parts.push(part);
        }
        const target = parts.join("/");
        if (![target, `${target}.ts`, `${target}.tsx`, `${target}.css`].some((p) => paths.has(p))) missing.push(`${f.path} -> ${spec}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("types every data array and keeps interfaces out of data files", () => {
    for (const f of result.files.filter((x) => x.path.startsWith("src/data/"))) {
      const text = String(f.data);
      expect(text).not.toContain("export interface");
      for (const m of text.matchAll(/export const (\w+): ([\w[\]]+) = \[/g)) {
        const type = m[2];
        expect(type === "string[]" || /^[A-Z]\w*\[\]$/.test(type)).toBe(true);
        if (type !== "string[]") expect(text).toContain(`import type { `);
      }
    }
  });

  it("imports every data array and form type it declares", () => {
    const allSource = sources.map((s) => String(s.data)).join("\n");
    for (const f of result.files.filter((x) => x.path.startsWith("src/data/"))) {
      for (const [, array] of String(f.data).matchAll(/export const (\w+):/g)) {
        expect(allSource).toMatch(new RegExp(`import \\{[^}]*\\b${array}\\b[^}]*\\} from "\\.\\./data/`));
      }
    }
    for (const f of result.files.filter((x) => x.path.startsWith("src/types/"))) {
      for (const [, form] of String(f.data).matchAll(/export interface (\w+FormValues|FormValues)\b/g)) {
        expect(allSource).toContain(`useState<${form}>`);
      }
    }
  });

  it("keeps pages small: sample data and form types live outside the page", () => {
    for (const page of result.pages) {
      const lines = file(page.file).split("\n").length;
      expect(lines).toBeLessThan(420);
      expect(file(page.file)).not.toMatch(/^const \w+ = \[/m);
    }
  });

  it("emits no empty modules and no leftover markers", () => {
    for (const f of sources) {
      expect(String(f.data)).not.toContain("§");
      expect(String(f.data)).not.toMatch(/data-f2r="canvas"|\bdata-toggle\b|\bdata-tab(-group|-panel)?=|\bdata-close\b/);
    }
    for (const dir of ["src/data/", "src/types/"]) {
      for (const f of result.files.filter((x) => x.path.startsWith(dir))) expect(String(f.data).trim().length).toBeGreaterThan(0);
    }
  });
});

describe("realistic designs", () => {
  it("e-commerce admin: typed navigation with icons, products with tags, filter form, modal", () => {
    const { file, result } = convert(readFixture("ecommerce-admin"));
    expect(result.components.map((c) => c.name)).toEqual(["Sidebar"]);
    expect(file("src/data/sidebar.tsx")).toContain("icon: (");
    const products = file("src/data/products.ts");
    expect(products).toContain(`tags: ["New", "Popular", "Sale"]`);
    expect(products).toContain(`tags: ["Featured"]`);
    expect(file("src/pages/ProductsPage.tsx")).toContain("{product.tags.map((tag) => (");
  });

  it("CRM: contacts table with tags, pipeline columns with deals, a tabbed profile form", () => {
    const { file } = convert(readFixture("crm-app"));
    expect(file("src/data/contacts.ts")).toContain(`chips: ["Lead", "VIP", "EU"]`);
    expect(file("src/data/pipeline.ts")).toContain(`title: "Qualified"`);
    const detail = file("src/pages/ContactDetailPage.tsx");
    expect(detail).toContain(`const [detailTab, setDetailTab] = useState("profile");`);
    expect(detail).toContain("useState<ContactFormValues>");
  });

  it("multi-step form: a stepper component with route-aware active state and one typed form per step", () => {
    const { file, result } = convert(readFixture("multi-step-form"));
    expect(result.components.map((c) => c.name)).toEqual(["Steps"]);
    expect(file("src/components/Steps.tsx")).toContain("isActive");
    expect(file("src/types/account.ts")).toContain("terms: boolean;");
    expect(file("src/types/preferences.ts")).toContain("topics: string[];");
  });

  it("RTL application: direction kept on every page, shared side navigation, Arabic data untouched", () => {
    const { file, result } = convert(readFixture("rtl-app"));
    for (const page of result.pages) expect(file(page.file)).toContain('dir="rtl"');
    expect(file("src/data/customers.ts")).toContain(`"عمر خليل"`);
    expect(result.components.map((c) => c.name)).toEqual(["SideNav"]);
  });

  it("pricing site: navbar, footer and FAQ built from shared components, lists and toggles", () => {
    const { file, result } = convert(readFixture("pricing-nested"));
    expect(result.components.map((c) => c.name).sort()).toEqual(["Footer", "Navbar"]);
    expect(file("src/pages/HelpPage.tsx")).toContain("useState(false)");
    expect(file("src/data/navbar.ts")).toContain(`to: "/pricing"`);
  });
});
