import { describe, expect, it } from "vitest";
import { convert, listFixtures, readFixture, spec } from "./helpers";

describe("naming strategy", () => {
  it("never produces placeholder identifiers on any fixture", () => {
    const offenders: string[] = [];
    for (const name of listFixtures()) {
      const { result } = convert(readFixture(name));
      for (const f of result.files) {
        if (!/^src\/(data|types)\//.test(f.path)) continue;
        const text = String(f.data);
        for (const match of text.matchAll(/\b(text\d+|ts|[A-Za-z]+\d+Item|[a-z]+Features)\b/g)) offenders.push(`${name}/${f.path}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("names a sidebar's links navigationItems / NavigationItem and keeps their icons", () => {
    const { file } = convert(readFixture("ecommerce-admin"));
    expect(file("src/data/sidebar.tsx")).toContain("export const navigationItems: NavigationItem[] = [");
    expect(file("src/types/sidebar.ts")).toBe(`import type { ReactNode } from "react";\n\nexport interface NavigationItem {\n  to: string;\n  icon: ReactNode;\n  label: string;\n}\n`);
  });

  it("names table rows after the heading above the table (orderRows) and fields after the column headers", () => {
    const { file } = convert(readFixture("ecommerce-admin"));
    const types = file("src/types/dashboard.ts");
    expect(types).toContain("export interface OrderRow {");
    expect(types).toMatch(/order: string;\n\s+customer: string;\n\s+date: string;\n\s+badgeVariant: string;\n\s+status: string;\n\s+total: string;/);
    expect(file("src/data/dashboard.ts")).toContain("export const orderRows: OrderRow[] = [");
  });

  it("infers names from what a value is: price, status, date, e-mail, percent", () => {
    const { file } = convert(spec(`<section data-screen="home"><div>
      <div class="row"><span>$12.00</span><span>Paid</span><span>2026-10-21</span><span>a@b.co</span><span>12%</span></div>
      <div class="row"><span>$30.50</span><span>Pending</span><span>2026-10-22</span><span>c@d.co</span><span>8%</span></div>
      <div class="row"><span>$7.25</span><span>Shipped</span><span>2026-10-23</span><span>e@f.co</span><span>3%</span></div>
    </div></section>`));
    const types = file("src/types/home.ts");
    for (const name of ["price", "status", "date", "email", "percent"]) expect(types).toContain(`${name}: string;`);
  });

  it("names columns by position when the header cannot be written as an identifier", () => {
    const { file } = convert(readFixture("rtl-app"));
    const types = file("src/types/customers.ts");
    expect(types).toContain("column1: string;");
    expect(types).toContain("column2: string;");
    expect(types).toContain("labels: string[];");
  });

  it("never names an interface after React Router or a browser global", () => {
    const { file } = convert(spec(`<section data-screen="home"><nav>
      <a href="#a" class="link">One</a><a href="#b" class="link">Two</a><a href="#c" class="link">Three</a>
    </nav><div>
      <span class="date">x1</span><span class="date">x2</span><span class="date">x3</span>
    </div></section>`));
    const types = file("src/types/home.ts");
    expect(types).not.toMatch(/interface Link \{/);
    expect(types).not.toMatch(/interface Date \{/);
  });

  it("gives a second list with the same name a name from its section, then a unique interface", () => {
    const { file } = convert(readFixture("landing-page"));
    expect(file("src/data/home.ts")).toContain("export const pricingCards: PricingCard[] = [");
    const names = [...file("src/types/home.ts").matchAll(/export interface (\w+)/g)].map((m) => m[1]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives props meaningful names (title, label) instead of class-derived ones", () => {
    const { file } = convert(readFixture("tailwind-app"));
    expect(file("src/components/Header.tsx")).toContain("{ title, to, label }: { title: string; to: string; label: string }");
  });
});
