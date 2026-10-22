import { describe, expect, it } from "vitest";
import { convert, spec } from "./helpers";

const page = (body: string) => convert(spec(`<section data-screen="home" data-home>${body}</section>`)).file("src/pages/HomePage.tsx");

describe("HTML to JSX", () => {
  it("renames attributes React spells differently", () => {
    const out = page(`<label for="e" class="lbl">Email</label><input id="e" tabindex="2" maxlength="40" readonly autocomplete="off">`);
    expect(out).toContain(`<label htmlFor="e" className="lbl">Email</label>`);
    expect(out).toContain(`<input id="e" tabIndex={2} maxLength={40} readOnly autoComplete="off" />`);
  });

  it("turns form values into uncontrolled defaults", () => {
    const out = page(`<input value="Sara"><input type="checkbox" checked value="yes"><textarea>Hi
there</textarea><select><option value="a">A</option><option value="b" selected>B</option></select>`);
    expect(out).toContain(`<input defaultValue="Sara" />`);
    expect(out).toContain(`<input type="checkbox" defaultChecked value="yes" />`);
    expect(out).toContain(`<textarea defaultValue={"Hi\\nthere"} />`);
    expect(out).toContain(`<select defaultValue="b">`);
    expect(out).not.toContain("selected");
  });

  it("converts inline styles to objects, typing custom properties", () => {
    const out = page(`<div style="background-image: url('data:image/png;base64,AA;BB'); -webkit-line-clamp: 2; --gap: 4px"></div>`);
    expect(out).toContain(`style={{ backgroundImage: "url('data:image/png;base64,AA;BB')", WebkitLineClamp: "2", "--gap": "4px" } as CSSProperties}`);
    expect(out).toContain(`import type { CSSProperties } from "react";`);
  });

  it("camel-cases SVG attributes and keeps viewBox", () => {
    const out = page(`<svg viewBox="0 0 24 24" xmlns:xlink="http://www.w3.org/1999/xlink"><path stroke-width="2" fill-rule="evenodd" d="M0 0"/><use xlink:href="#i"/></svg>`);
    expect(out).toContain(`viewBox="0 0 24 24"`);
    expect(out).toContain(`xmlnsXlink=`);
    expect(out).toContain(`<path strokeWidth="2" fillRule="evenodd" d="M0 0" />`);
    expect(out).toContain(`<use href="#i" />`);
  });

  it("escapes characters that are special in JSX text", () => {
    const out = page(`<p>if (a < b) { return &amp; }&nbsp;ok</p>`);
    expect(out).toContain(`<p>if (a &lt; b) &#123; return &amp; &#125;&nbsp;ok</p>`);
  });

  it("keeps visible spaces between inline elements across lines", () => {
    const out = page(`<p class="intro-paragraph-with-a-long-class-name">Hello <strong>Sara Haddad</strong> and <em>welcome back to the dashboard of your store</em> today</p>`);
    expect(out).toMatch(/Hello\{" "\}\n\s+<strong>Sara Haddad<\/strong>\n\s+\{" "\}and\{" "\}\n\s+<em>/);
  });

  it("keeps inline handlers for useDesignScripts and moves scripts out of the markup", () => {
    const { file } = convert(spec(`<section data-screen="home"><button onclick="go()">Go</button><script>go()</script></section>`));
    const page = file("src/pages/HomePage.tsx");
    expect(page).toContain(`<button data-f2r-onclick="go()">Go</button>`);
    expect(page).not.toContain("<script");
  });

  it("preserves whitespace inside pre", () => {
    const out = page(`<pre>line 1\n  line 2</pre>`);
    expect(out).toContain(`<pre>{"line 1\\n  line 2"}</pre>`);
  });

  it("converts unknown elements to divs and numeric attributes to numbers", () => {
    const out = page(`<center><table><tr><td colspan="2">x</td></tr></table></center>`);
    expect(out).toContain("<div>");
    expect(out).toContain(`<td colSpan={2}>x</td>`);
    expect(out).toContain("<tbody>");
  });
});
