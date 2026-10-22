import { describe, expect, it } from "vitest";
import { convert, readFixture, spec } from "./helpers";

describe("navigation and components", () => {
  it("links data-goto anchors and buttons to routes", () => {
    const { file } = convert(spec(`
      <section data-screen="home" data-home><a href="#orders" data-goto="orders">Orders</a><button type="button" data-goto="orders">Go</button></section>
      <section data-screen="orders"><a href="https://example.com">Docs</a></section>`));
    const home = file("src/pages/HomePage.tsx");
    expect(home).toContain(`<Link to="/orders">Orders</Link>`);
    expect(home).toContain(`<button type="button" onClick={() => navigate("/orders")}>Go</button>`);
    expect(home).toContain(`import { Link, useNavigate } from "react-router-dom";`);
    expect(home).toContain("const navigate = useNavigate();");
    expect(file("src/pages/OrdersPage.tsx")).toContain(`<a href="https://example.com">Docs</a>`);
  });

  it("extracts identical components and turns the moving active class into NavLink", () => {
    const { result, file } = convert(readFixture("spec-saas-dashboard"));
    expect(result.components.map((c) => [c.name, c.usedIn.length])).toEqual([["Sidebar", 4], ["Topbar", 4]]);
    const sidebar = file("src/components/Sidebar.tsx");
    expect(sidebar).toContain(`className={({ isActive }) => (isActive ? "nav-item is-active" : "nav-item")}`);
    expect(sidebar).toContain(`end={navigationItem.to === "/"}`);
    expect(sidebar).toContain("navigationItems.map((navigationItem) => (");
    expect(file("src/data/sidebar.tsx")).toContain(`to: "/orders"`);
    expect(file("src/pages/OrdersPage.tsx")).toContain("<Sidebar />");
    expect(file("src/pages/OrdersPage.css")).toContain(`[data-screen="orders"] .chip`);
    expect(file("src/styles/global.css")).not.toContain("1440px");
    expect(result.warnings.filter((w) => w.level !== "info")).toEqual([]);
  });

  it("shares copies that differ only in text through props", () => {
    const { result, file } = convert(spec(`
      <section data-screen="a"><header data-component="Topbar"><h1>A</h1></header></section>
      <section data-screen="b"><header data-component="Topbar"><h1>B</h1></header></section>
      <section data-screen="c"><header data-component="Topbar"><h1>C</h1></header></section>`));
    expect(file("src/components/Topbar.tsx")).toContain("{title}");
    expect(file("src/components/Topbar.tsx")).toContain("{ title }: { title: string }");
    expect(file("src/pages/CPage.tsx")).toContain(`<Topbar title="C" />`);
    expect(file("src/pages/APage.tsx")).toContain(`<Topbar title="A" />`);
    expect(result.warnings.filter((w) => w.level !== "info")).toEqual([]);
  });

  it("keeps a list inside a component that also takes props, when the list is the same in every copy", () => {
    const top = (title: string) =>
      `<header data-component="Top"><h1>${title}</h1><ul class="links"><li><a data-goto="a">Alpha</a></li><li><a data-goto="b">Beta</a></li><li><a data-goto="c">Gamma</a></li></ul></header>`;
    const { file, result } = convert(spec(`
      <section data-screen="a">${top("A")}</section>
      <section data-screen="b">${top("B")}</section>
      <section data-screen="c">${top("C")}</section>`));
    const component = file("src/components/Top.tsx");
    expect(component).toContain("export default function Top({ title }: { title: string })");
    expect(component).toContain("<h1>{title}</h1>");
    expect(component).toContain("links.map((linkItem) => (");
    expect(file("src/data/top.ts")).toContain(`label: "Alpha"`);
    expect(file("src/pages/BPage.tsx")).toContain(`<Top title="B" />`);
    expect(result.warnings.filter((w) => w.level !== "info")).toEqual([]);
  });

  it("does not turn a list into data when a prop sits inside its items", () => {
    const top = (a: string) =>
      `<header data-component="Top"><ul><li><a data-goto="a">${a}</a></li><li><a data-goto="b">Beta</a></li><li><a data-goto="c">Gamma</a></li></ul></header>`;
    const { file } = convert(spec(`
      <section data-screen="a">${top("One")}</section>
      <section data-screen="b">${top("Two")}</section>
      <section data-screen="c">${top("Three")}</section>`));
    const component = file("src/components/Top.tsx");
    expect(component).not.toContain(".map(");
    expect(component).toContain("{label}");
  });

  it("keeps structurally different copies of a component inline and warns", () => {
    const { result, file } = convert(spec(`
      <section data-screen="a"><header data-component="Topbar"><h1>A</h1></header></section>
      <section data-screen="b"><header data-component="Topbar"><h1>A</h1></header></section>
      <section data-screen="c"><header data-component="Topbar"><h2>C</h2><p>extra</p></header></section>`));
    expect(file("src/pages/CPage.tsx")).toContain("<h2>C</h2>");
    expect(file("src/pages/APage.tsx")).toContain("<Topbar />");
    expect(result.warnings.some((w) => w.message.includes(`"Topbar" has different markup on: c`))).toBe(true);
  });

  it("maps links between HTML files and active list items in multi-file sites", () => {
    const { result, file } = convert(readFixture("multi-file-site"));
    expect(result.components.map((c) => c.name)).toEqual(["Footer", "Header"]);
    const header = file("src/components/Header.tsx");
    expect(header).toContain(`<li className={pathname === "/about" ? "active" : undefined}>`);
    expect(header).toContain(`<Link to="/about">About</Link>`);
    expect(header).toContain(`<img src="/img/logo.svg"`);
    expect(file("src/pages/HomePage.tsx")).toContain(`<Link to="/contact" className="btn">`);
    expect(file("index.html")).toContain(`<link rel="stylesheet" href="/css/style.css" />`);
    expect(file("src/pages/HomePage.tsx")).toContain(`<div className="page-home" data-screen="home">`);
  });

  it("links buttons by screen title when the prompt markers are missing", () => {
    const { file } = convert(readFixture("heuristic-mobile-grid"));
    const home = file("src/pages/HomePage.tsx");
    expect(home).toContain(`onClick={() => navigate("/activity")}`);
  });

  it("respects excluded screens, renamed titles and custom routes", () => {
    const { result, file } = convert(readFixture("spec-saas-dashboard"), {
      projectName: "Pulse Admin",
      screens: [
        { id: "dashboard", title: "Overview", route: "/", include: true },
        { id: "orders", title: "Orders", route: "/sales", include: true },
        { id: "login", title: "Login", route: "/login", include: false },
      ],
    });
    expect(result.projectName).toBe("pulse-admin");
    expect(result.pages.map((p) => [p.componentName, p.route])).toEqual([["OverviewPage", "/"], ["OrdersPage", "/sales"]]);
    expect(file("src/components/Topbar.tsx")).toContain(`<button className="btn" type="button">Sign out</button>`);
    expect(file("src/components/Sidebar.tsx")).toContain(`to="/sales"`);
    expect(result.warnings.some((w) => w.message.includes(`"login"`))).toBe(true);
  });
});

describe("ids made unique per screen", () => {
  it("still shares the component and renames the ids after it", () => {
    const topbar = (screen: string) =>
      `<header data-component="Topbar"><label for="${screen}-search">Search</label><input id="${screen}-search" type="search"></header>`;
    const { result, file } = convert(spec(`
      <section data-screen="dashboard">${topbar("dashboard")}</section>
      <section data-screen="order-details">${topbar("order-details")}</section>`));
    expect(result.components.map((c) => c.name)).toEqual(["Topbar"]);
    expect(file("src/components/Topbar.tsx")).toContain(`<label htmlFor="topbar-search">Search</label>`);
    expect(file("src/components/Topbar.tsx")).toContain(`<input id="topbar-search" type="search" />`);
    expect(result.warnings.filter((w) => w.level !== "info")).toEqual([]);
  });

  it("extracts every shared part of the NexaFlow design", () => {
    const { result } = convert(readFixture("spec-nexaflow"));
    expect(result.components.map((c) => [c.name, c.usedIn.length])).toEqual([["Footer", 6], ["Sidebar", 6], ["Topbar", 6]]);
    expect(result.warnings.filter((w) => w.level !== "info")).toEqual([]);
  });
});

describe("active state", () => {
  it("only highlights the kind of link that was highlighted in the design", () => {
    const { file } = convert(readFixture("spec-nexaflow"));
    const sidebar = file("src/components/Sidebar.tsx");
    expect(file("src/data/sidebar.tsx")).toContain(`to: "/settings"`);
    expect(sidebar).toContain(`<Link to="/settings" className="sidebar__upgrade-link">`);
    expect(sidebar).not.toContain(`<NavLink to="/settings" className="sidebar__upgrade-link">`);
  });
});

describe("sections", () => {
  it("keeps a nav item active on the screens that highlight it in the design", () => {
    const { file } = convert(readFixture("spec-nexaflow"));
    const sidebar = file("src/components/Sidebar.tsx");
    expect(sidebar).toContain(`className={[navigationItem.to, ...(navigationItem.activeOn ?? [])].includes(pathname) ? "nav-item is-active" : "nav-item"}`);
    expect(sidebar).toContain("const { pathname } = useLocation();");
    expect(file("src/data/sidebar.tsx")).toContain(`activeOn: ["/order-details"]`);
    expect(file("src/types/sidebar.ts")).toContain("activeOn?: string[];");
  });
});
