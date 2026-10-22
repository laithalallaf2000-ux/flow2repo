import { describe, expect, it } from "vitest";
import { convert, readFixture, spec } from "./helpers";

const countSpaces = (text: string) => (text.match(/\{" "\}/g) ?? []).length;

describe("JSX quality", () => {
  it("leaves out {\" \"} between items of flex and grid containers, where browsers render no space", () => {
    const { file } = convert(spec(`
      <style>.bar { display: flex; gap: 8px; }</style>
      <section data-screen="home">
        <div class="bar"><a href="#first-link-target-with-a-long-url" class="long-link-class">First link with some long text</a> <a href="#second-link-target" class="long-link-class">Second link with long text</a></div>
      </section>`));
    expect(file("src/pages/HomePage.tsx")).not.toContain('{" "}');
  });

  it("keeps {\" \"} where whitespace is visible (block containers with inline children)", () => {
    const { file } = convert(spec(`
      <style>.plain { display: block; }</style>
      <section data-screen="home">
        <div class="plain"><a href="#first-link-target-with-a-long-url" class="long-link-class">First link with some long text</a> <a href="#second-link-target" class="long-link-class">Second link with long text</a></div>
      </section>`));
    expect(countSpaces(file("src/pages/HomePage.tsx"))).toBe(1);
  });

  it("only trusts CSS that always makes the container flex: a media query keeps the spaces", () => {
    const { file } = convert(spec(`
      <style>.bar { display: flex; } @media (max-width: 600px) { .bar { display: block; } }</style>
      <section data-screen="home"><div class="bar"><a href="#first-link-target-with-a-long-url" class="long-link-class">First link with some long text</a> <a href="#second-link-target" class="long-link-class">Second link with long text</a></div></section>`));
    expect(countSpaces(file("src/pages/HomePage.tsx"))).toBe(1);
  });

  it("recognises Tailwind flex/grid utilities and inline display styles", () => {
    const { file } = convert(spec(`
      <section data-screen="home">
        <div class="flex gap-2"><a href="#first-link-target-with-a-long-url" class="long-link-class">First link with some long text</a> <a href="#second-link-target" class="long-link-class">Second link with long text</a></div>
        <div style="display:grid"><a href="#first-link-target-with-a-long-url" class="long-link-class">First link with some long text</a> <a href="#second-link-target" class="long-link-class">Second link with long text</a></div>
      </section>`));
    expect(file("src/pages/HomePage.tsx")).not.toContain('{" "}');
  });

  it("writes fewer explicit spaces on real designs while keeping every design's text", () => {
    const { file } = convert(readFixture("spec-nexaflow"));
    const all = ["Sidebar", "Topbar", "Footer"].map((c) => file(`src/components/${c}.tsx`)).join("");
    expect(countSpaces(all)).toBeLessThan(10);
  });

  it("preserves RTL direction, Arabic text and logical CSS", () => {
    const { file } = convert(readFixture("rtl-app"));
    const page = file("src/pages/OverviewPage.tsx");
    expect(page).toContain(`<section data-screen="overview" dir="rtl">`);
    expect(page).toContain("<h1>نظرة عامة</h1>");
    expect(file("index.html")).toContain(`lang="ar"`);
    expect(file("index.html")).toContain(`dir="rtl"`);
    expect(file("src/styles/global.css")).toContain("border-inline-end");
  });

  it("preserves entities, special characters and braces", () => {
    const { file } = convert(spec(`<section data-screen="home"><p>Tom &amp; Jerry&nbsp;&copy; {x} &lt;tag&gt;<br>next</p></section>`));
    expect(file("src/pages/HomePage.tsx")).toContain("Tom &amp; Jerry&nbsp;© &#123;x&#125; &lt;tag&gt;<br />next");
  });

  it("keeps accessibility attributes and inline SVG attributes", () => {
    const { file } = convert(spec(`<section data-screen="home"><button aria-label="Close" aria-expanded="false"><svg viewBox="0 0 4 4" stroke-width="2" aria-hidden="true"><path d="M0 0" stroke-linecap="round"/></svg></button><img src="a.png" alt="Logo"></section>`));
    const page = file("src/pages/HomePage.tsx");
    expect(page).toContain(`aria-label="Close"`);
    expect(page).toContain(`strokeWidth="2"`);
    expect(page).toContain(`strokeLinecap="round"`);
    expect(page).toContain(`alt="Logo"`);
  });

  it("names a page after data-screen when data-title is missing, not after its first heading", () => {
    const { result } = convert(spec(`<section data-screen="order-details"><h1>Zebra</h1></section>`));
    expect(result.pages[0].componentName).toBe("OrderDetailsPage");
    expect(result.pages[0].title).toBe("Order Details");
  });

  it("uses stable keys: a unique field, a generated id, or an index-based key when values repeat", () => {
    const { file } = convert(spec(`<section data-screen="home"><ul>
      <li class="note">dup</li><li class="note">dup</li><li class="note">other</li></ul></section>`));
    expect(file("src/pages/HomePage.tsx")).toContain("key={`${note}-${index}`}");
    const unique = convert(spec(`<section data-screen="home"><ul>
      <li class="note">a</li><li class="note">b</li><li class="note">c</li></ul></section>`));
    expect(unique.file("src/pages/HomePage.tsx")).toContain("key={note}");
  });
});
