import { describe, expect, it } from "vitest";
import { convert } from "./helpers";

const page = (body: string) =>
  `<!DOCTYPE html><html><head><title>Site</title></head><body>${body}</body></html>`;

describe("landing page regressions", () => {
  it("does not repeat aria-expanded on a toggle button that already had one", () => {
    const { file } = convert(
      page(`<header data-component="Navbar"><button data-toggle="menu" aria-expanded="false">Menu</button><nav data-toggle-target="menu"><a href="#home-faq">FAQ</a></nav></header><main><section id="home-faq">Q</section></main>`),
    );
    const navbar = file("src/components/Navbar.tsx");
    expect(navbar.match(/aria-expanded/g)).toHaveLength(1);
    expect(navbar).toContain("aria-expanded={menuOpen}");
  });

  it("keeps links from a shared part to sections of the page", () => {
    const { file } = convert(
      page(`<header data-component="Navbar"><a href="#home-faq">FAQ</a><label for="home-q">Search</label><input id="home-q"></header><main><section id="home-faq">Q</section></main>`),
    );
    const navbar = file("src/components/Navbar.tsx");
    expect(navbar).toContain(`href="#home-faq"`);
    expect(navbar).toContain(`htmlFor="navbar-q"`);
    expect(navbar).toContain(`id="navbar-q"`);
  });
});
