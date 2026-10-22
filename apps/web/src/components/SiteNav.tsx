import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Route } from "../lib/route";
import Logo from "./Logo";

/** Sections of the home page, then pages. Section links work from every page (#features → home). */
const LINKS = [
  { id: "how", label: "How it works", href: "#how" },
  { id: "prompt", label: "The prompts", href: "#prompt" },
  { id: "features", label: "Features", href: "#features" },
  { id: "about", label: "About", href: "#/about" },
];
const SECTION_IDS = ["how", "prompt", "features"];

/**
 * Landing navigation: logo, centred links in a pill whose highlight follows the section being read,
 * and the call to action. On small screens the links move into a menu.
 */
export default function SiteNav({ page = "home" }: { page?: Route }) {
  const [sectionActive, setSectionActive] = useState<string | null>(null);
  const active = page === "home" ? sectionActive : page;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);
  const links = useRef<Record<string, HTMLAnchorElement | null>>({});

  // Highlight the last section whose top has passed 40% of the screen height.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
      const line = window.innerHeight * 0.4;
      let current: string | null = null;
      for (const id of SECTION_IDS) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= line) current = id;
      }
      setSectionActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Move the pill highlight under the active link.
  useLayoutEffect(() => {
    const el = active ? links.current[active] : null;
    setIndicator(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
  }, [active]);

  const style = indicator ? ({ "--x": `${indicator.x}px`, "--w": `${indicator.w}px` } as CSSProperties) : undefined;

  return (
    <header className={`site-nav${scrolled ? " site-nav--scrolled" : ""}${open ? " site-nav--open" : ""}`}>
      <div className="site-nav__inner">
        <a
          href="#"
          className="site-nav__brand"
          aria-label="Flow2Repo home"
          onClick={(event) => {
            if (page !== "home") return;
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <Logo />
        </a>
        <nav className={`site-nav__links${indicator ? " has-active" : ""}`} style={style} aria-label="Sections">
          <span className="site-nav__indicator" aria-hidden="true" />
          {LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              ref={(el) => {
                links.current[link.id] = el;
              }}
              className={active === link.id ? "is-active" : undefined}
              aria-current={active === link.id ? "true" : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a className="btn btn--dark site-nav__menu-cta" href="#prompt" onClick={() => setOpen(false)}>
            Get the prompt
          </a>
        </nav>
        <div className="site-nav__end">
          <a className="btn btn--dark btn--sm" href="#prompt">
            Get the prompt
          </a>
          <button
            type="button"
            className="site-nav__menu"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
