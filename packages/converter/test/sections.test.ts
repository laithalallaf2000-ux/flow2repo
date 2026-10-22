import { describe, expect, it } from "vitest";
import { convert, readFixture } from "./helpers";

const page = (main: string) => `<!DOCTYPE html><html><head><title>Site</title></head><body><main>${main}</main></body></html>`;
const section = (id: string, extra = "") =>
  `<section id="home-${id}"><h2>${id}</h2><p>One</p><p>Two</p><p>Three</p><ul><li>a</li><li>b</li></ul>${extra}</section>`;

describe("long pages split into sections", () => {
  it("gives each section of a landing page its own component", () => {
    const { file, has } = convert(readFixture("loanwell-landing"));
    const home = file("src/pages/HomePage.tsx");
    for (const name of ["Hero", "HowItWorks", "Specs", "Comparison", "Reviews", "Faq", "Reserve"]) {
      expect(home).toContain(`<${name}Section />`);
      expect(has(`src/sections/${name}Section.tsx`)).toBe(true);
    }
    expect(home).toContain(`import Navbar from "../components/Navbar";`);
    expect(home).toContain(`import FaqSection from "../sections/FaqSection";`);
    expect(file("src/sections/FaqSection.tsx")).toContain(`from "../data/faq-section"`);
    expect(file("src/sections/ReserveSection.tsx")).toContain("useState<HomeReservationFormValues>");
  });

  it("names the project after the brand, not the tagline", () => {
    expect(convert(readFixture("loanwell-landing")).result.projectName).toBe("loanwell-one");
  });

  it("leaves short pages in one file", () => {
    const { has } = convert(page(section("a") + section("b")));
    expect(has("src/sections/ASection.tsx")).toBe(false);
  });

  it("keeps a section in its page when its toggle controls something outside it", () => {
    const { file, has } = convert(
      page(section("a", `<button data-toggle="signup">Join</button>`) + section("b") + section("c") + `<div data-toggle-target="signup">Form</div>`),
    );
    expect(has("src/sections/ASection.tsx")).toBe(false);
    expect(has("src/sections/BSection.tsx")).toBe(true);
    expect(file("src/pages/HomePage.tsx")).toContain("setSignupOpen");
  });

  it("does not split dashboards built from the prompt", () => {
    const { result } = convert(readFixture("spec-nexaflow"));
    expect(result.files.some((f) => f.path.startsWith("src/sections/"))).toBe(false);
  });
});
