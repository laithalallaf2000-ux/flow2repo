import { describe, expect, it } from "vitest";
import { convert, readFixture, spec } from "./helpers";

const FORM = `<section data-screen="home"><form id="signup" action="/x" method="post">
  <label for="n">Name</label><input id="n" name="name" value="Sara" required maxlength="40">
  <input name="email" type="email" placeholder="Email" required>
  <select name="plan"><option value="a">A</option><option value="b" selected>B</option></select>
  <textarea name="msg" rows="3">Hello</textarea>
  <input type="checkbox" name="agree" checked>
  <input type="radio" name="size" value="s"><input type="radio" name="size" value="m" checked>
  <input type="checkbox" name="extras" value="gift" checked><input type="checkbox" name="extras" value="wrap">
  <button type="submit">Send</button>
</form></section>`;

describe("forms", () => {
  const page = () => convert(spec(FORM));

  it("types the form values: strings, a boolean checkbox, a radio string and a checkbox group array", () => {
    const { file } = page();
    expect(file("src/types/home.ts")).toBe(
      [
        "export interface SignupFormValues {",
        "  name: string;",
        "  email: string;",
        "  plan: string;",
        "  msg: string;",
        "  agree: boolean;",
        "  size: string;",
        "  extras: string[];",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("starts from the design's defaults (value, selected, checked, textarea text)", () => {
    const home = page().file("src/pages/HomePage.tsx");
    for (const line of [`name: "Sara",`, `email: "",`, `plan: "b",`, `msg: "Hello",`, `agree: true,`, `size: "m",`, `extras: ["gift"],`]) {
      expect(home).toContain(line);
    }
    expect(home).toContain("useState<SignupFormValues>(initialSignupValues)");
  });

  it("binds controls with value / checked and typed onChange handlers", () => {
    const home = page().file("src/pages/HomePage.tsx");
    expect(home).toContain("value={signupValues.name}");
    expect(home).toContain(`onChange={(event) => setSignupField("name", event.target.value)}`);
    expect(home).toContain("checked={signupValues.agree}");
    expect(home).toContain(`setSignupField("agree", event.target.checked)`);
    expect(home).toContain(`checked={signupValues.size === "m"}`);
    expect(home).toContain(`onChange={() => setSignupField("size", "m")}`);
    expect(home).toContain(`checked={signupValues.extras.includes("gift")}`);
    expect(home).toContain(`event.target.checked ? [...signupValues.extras, "gift"] : signupValues.extras.filter((item) => item !== "gift")`);
    expect(home).toContain("value={signupValues.msg}");
    expect(home).not.toContain("defaultValue");
    expect(home).not.toContain("defaultChecked");
  });

  it("keeps names, types, labels, placeholders and validation attributes", () => {
    const home = page().file("src/pages/HomePage.tsx");
    expect(home).toContain(`name="name"`);
    expect(home).toContain("required");
    expect(home).toContain("maxLength={40}");
    expect(home).toContain(`type="email"`);
    expect(home).toContain(`placeholder="Email"`);
    expect(home).toContain(`<label htmlFor="n">Name</label>`);
    expect(home).toContain(`value="gift"`);
  });

  it("prevents native navigation in a submit handler that marks where the API call goes, and resets state on reset", () => {
    const { file, result } = page();
    const home = file("src/pages/HomePage.tsx");
    expect(home).toContain("const handleSignupSubmit = (event: FormEvent<HTMLFormElement>) => {");
    expect(home).toContain("event.preventDefault();");
    expect(home).toContain("// No backend is connected. Send `signupValues` to your API here.");
    expect(home).toContain("onSubmit={handleSignupSubmit}");
    expect(home).toContain("onReset={() => setSignupValues(initialSignupValues)}");
    expect(home).toContain(`import { useState, type FormEvent } from "react";`);
    expect(home).toContain(`import type { SignupFormValues } from "../types/home";`);
    const note = result.warnings.find((w) => w.message.includes("signupValues"));
    expect(note?.message).toContain("nothing is sent yet");
  });

  it("never invents an API URL, fetch call or backend response", () => {
    const home = page().file("src/pages/HomePage.tsx");
    expect(home).not.toMatch(/fetch\(|axios|XMLHttpRequest|api\//i);
  });

  it("supports multiple selects and several forms on one page", () => {
    const { file } = convert(readFixture("ecommerce-admin"));
    expect(file("src/types/products.ts")).toContain("export interface ProductSearchFormValues {");
    expect(file("src/types/products.ts")).toContain("export interface NewProductFormValues {");
    const prefs = convert(readFixture("multi-step-form")).file("src/pages/PreferencesPage.tsx");
    expect(prefs).toContain(`Array.from(event.target.selectedOptions, (option) => option.value)`);
    expect(prefs).toContain(`languages: ["en"],`);
  });

  it("names forms by their id or name, never by a layout class", () => {
    const { file } = convert(spec(`<section data-screen="home"><form class="card auth-box"><input name="a"></form></section>`));
    expect(file("src/types/home.ts")).toContain("export interface FormValues {");
  });

  it("leaves file inputs and hidden fields uncontrolled", () => {
    const { file } = convert(spec(`<section data-screen="home"><form><input type="file" name="doc"><input type="hidden" name="t" value="1"><input name="q"></form></section>`));
    const home = file("src/pages/HomePage.tsx");
    expect(home).toContain(`<input type="file" name="doc" />`);
    expect(home).toContain(`defaultValue="1"`);
    expect(file("src/types/home.ts")).toBe("export interface FormValues {\n  q: string;\n}\n");
  });

  it("does not turn repeated form controls into list data", () => {
    const { file } = convert(spec(`<section data-screen="home"><form>
      <label><input type="checkbox" name="o" value="a"> A</label><label><input type="checkbox" name="o" value="b"> B</label><label><input type="checkbox" name="o" value="c"> C</label>
    </form></section>`));
    expect(file("src/pages/HomePage.tsx")).not.toContain(".map(");
    expect(file("src/types/home.ts")).toContain("o: string[];");
  });

  it("gives forms inside shared components their own state", () => {
    const search = (id: string) => `<header data-component="Topbar"><form id="search"><input name="q" id="${id}-q"></form></header>`;
    const { file } = convert(spec(`<section data-screen="a">${search("a")}</section><section data-screen="b">${search("b")}</section>`));
    expect(file("src/components/Topbar.tsx")).toContain("value={searchValues.q}");
    expect(file("src/types/topbar.ts")).toContain("export interface SearchFormValues {");
  });
});
