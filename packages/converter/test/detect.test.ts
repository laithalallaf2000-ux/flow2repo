import { describe, expect, it } from "vitest";
import { analyzeDesign } from "../src";
import { readFixture, spec } from "./helpers";

describe("screen detection", () => {
  it("reads data-screen markers from the prompt spec", () => {
    const a = analyzeDesign(readFixture("spec-saas-dashboard"));
    expect(a.mode).toBe("spec");
    expect(a.screens.map((s) => [s.id, s.title, s.route])).toEqual([
      ["login", "Login", "/login"],
      ["dashboard", "Dashboard", "/"],
      ["orders", "Orders", "/orders"],
      ["order-details", "Order details", "/order-details"],
      ["settings", "Settings", "/settings"],
    ]);
  });

  it("makes the first screen home when none is marked and de-duplicates ids", () => {
    const a = analyzeDesign([{ path: "index.html", data: spec(`<section data-screen="a">A</section><section data-screen="a">B</section>`) }]);
    expect(a.screens.map((s) => [s.id, s.route])).toEqual([["a", "/"], ["a-2", "/a-2"]]);
  });

  it("treats every HTML file as a screen", () => {
    const a = analyzeDesign(readFixture("multi-file-site"));
    expect(a.mode).toBe("multi-file");
    expect(a.screens.map((s) => [s.id, s.route])).toEqual([["home", "/"], ["about", "/about"], ["contact", "/contact"]]);
  });

  it("guesses screens laid out on a board and takes titles from labels", () => {
    const a = analyzeDesign(readFixture("heuristic-mobile-grid"));
    expect(a.mode).toBe("heuristic");
    expect(a.screens.map((s) => s.title)).toEqual(["Home", "Activity", "Profile"]);
    expect(a.screens.every((s) => s.element.attrs.some((at) => at.value === "screen"))).toBe(true);
  });

  it("keeps a normal landing page as one page", () => {
    const sections = Array.from({ length: 4 }, (_, i) => `<section class="block"><h2>Part ${i}</h2>${"<p><span>a</span><span>b</span></p>".repeat(6)}</section>`).join("");
    const a = analyzeDesign([{ path: "index.html", data: `<html><body><header><nav><a href="#">x</a></nav></header>${sections}</body></html>` }]);
    expect(a.mode).toBe("single");
    expect(a.screens).toHaveLength(1);
  });

  it("can be forced to a single page", () => {
    const a = analyzeDesign(readFixture("heuristic-mobile-grid"), { detection: "single" });
    expect(a.mode).toBe("single");
  });
});

describe("single pages", () => {
  it("names a single-page site Home and the project after its title", () => {
    const a = analyzeDesign(readFixture("vanilla-js-site"));
    expect(a.mode).toBe("single");
    expect(a.screens.map((s) => s.title)).toEqual(["Home"]);
    expect(a.suggestedName).toBe("my-first-website");
  });
});

describe("landing pages", () => {
  it("keeps a marketing site as one page with its in-page anchors", () => {
    const a = analyzeDesign(readFixture("landing-page"));
    expect(a.mode).toBe("single");
    expect(a.suggestedName).toBe("brewly");
  });
});
