import { describe, expect, it } from "vitest";
import { convert, readFixture, spec } from "./helpers";

describe("data layer", () => {
  it("moves list data into src/data and its interfaces into src/types", () => {
    const { file } = convert(readFixture("spec-saas-dashboard"));
    const types = file("src/types/dashboard.ts");
    expect(types).toContain("export interface Stat {");
    expect(types).toContain("export interface Bar {");
    const data = file("src/data/dashboard.ts");
    expect(data).toContain(`import type { Stat, Bar, Goal } from "../types/dashboard";`);
    expect(data).toContain("export const stats: Stat[] = [");
    expect(data).not.toContain("export interface");
    const page = file("src/pages/DashboardPage.tsx");
    expect(page).toContain(`import { stats, bars, goals } from "../data/dashboard";`);
    expect(page).toContain("stats.map((stat) =>");
    expect(page).not.toContain("const stats");
  });

  it("types plain text lists as string[] and icons as ReactNode in a .tsx data module", () => {
    const { file, has } = convert(spec(`
      <section data-screen="home">
        <ul><li>One</li><li>Two</li><li>Three</li></ul>
        <div>
          <button><svg viewBox="0 0 4 4"><path d="M0 0h1"/></svg>A</button>
          <button><svg viewBox="0 0 4 4"><circle r="1"/></svg>B</button>
          <button><svg viewBox="0 0 4 4"><path d="M2 2h1"/></svg>C</button>
        </div>
      </section>`));
    expect(has("src/data/home.tsx")).toBe(true);
    expect(file("src/data/home.tsx")).toContain("export const items: string[] = [");
    expect(file("src/types/home.ts")).toContain(`import type { ReactNode } from "react";`);
    expect(file("src/types/home.ts")).toContain("icon: ReactNode;");
  });

  it("writes no data or types module for pages without lists or forms", () => {
    const { result } = convert(spec(`<section data-screen="home"><p>Hi</p></section>`));
    expect(result.files.some((f) => f.path.startsWith("src/data/") || f.path.startsWith("src/types/"))).toBe(false);
  });
});
