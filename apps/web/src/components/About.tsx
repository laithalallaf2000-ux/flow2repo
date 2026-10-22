import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { CREATOR } from "../lib/site";
import CreatorLinks from "./CreatorLinks";
import { ArrowRightIcon, CodeIcon, LayersIcon, ReportIcon, ShieldIcon } from "./Icons";
import SiteFooter from "./SiteFooter";
import SiteNav from "./SiteNav";
import { useScrollReveal } from "./useScrollReveal";

interface Chapter {
  year: string;
  title: string;
  text: string;
  art: ReactNode;
}

const CHAPTERS: Chapter[] = [
  {
    year: "Chapter 01",
    title: "A designer first",
    text: "I'm a UX designer. I love the part where an idea becomes an interface: the flows, the spacing, the small details that make a screen feel right.",
    art: (
      <div className="art art--frames">
        <span />
        <span />
        <span />
      </div>
    ),
  },
  {
    year: "Chapter 02",
    title: "AI opened a new door",
    text: "When AI tools arrived, I found a path I didn't expect: designing directly in HTML and CSS. I could sketch a screen, refine it with AI, and hold a real, clickable page in minutes instead of days.",
    art: (
      <div className="art art--code">
        <i>&lt;section</i>
        <i className="art__accent">class="hero"</i>
        <i>&gt;</i>
      </div>
    ),
  },
  {
    year: "Chapter 03",
    title: "Beautiful, but not a product",
    text: "A good-looking HTML file is still not an app. Turning it into React meant splitting pages, wiring buttons and rewriting the same sidebar again and again. I learned React and Next.js on the way, and saw how much of that work repeats every time.",
    art: (
      <div className="art art--gap">
        <span>design.html</span>
        <b>?</b>
        <span>React app</span>
      </div>
    ),
  },
  {
    year: "Chapter 04",
    title: "Building the bridge",
    text: "So I built the tool I wanted: one that turns those designs into a React website or dashboard fast, with a structure that scales. Sample data lands in its own files, ready to become real data from a backend. Static sites and their animations come along as designed.",
    art: (
      <div className="art art--tree">
        <i>src/</i>
        <i className="art__in">pages/</i>
        <i className="art__in">components/</i>
        <i className="art__in art__accent">data/ → your API</i>
      </div>
    ),
  },
  {
    year: "Chapter 05",
    title: "AI as a helper, not a crutch",
    text: "Not everything has to be AI. AI helped me build this converter, but the converter itself is plain code: it reads your markup, understands it and gives the same result every time. The goal is to depend on AI less, not more.",
    art: (
      <div className="art art--badge">
        <span>Same input</span>
        <ArrowRightIcon width={14} height={14} />
        <span className="art__accent">same output</span>
      </div>
    ),
  },
  {
    year: "Next",
    title: "Open, and growing",
    text: "Flow2Repo is free and open source. It saves designers and developers a lot of time and a lot of figuring out. React comes first; Flutter is on the roadmap.",
    art: (
      <div className="art art--next">
        <span>React</span>
        <span className="art__soon">Flutter</span>
      </div>
    ),
  },
];

const PRINCIPLES = [
  { icon: CodeIcon, title: "Deterministic", text: "No AI at conversion time. The same design always gives the same project." },
  { icon: LayersIcon, title: "Designer-first", text: "Your design is the source of truth. The code follows it, pixel for pixel." },
  { icon: ReportIcon, title: "Honest", text: "When something can't be converted, the report says so." },
  { icon: ShieldIcon, title: "Private", text: "Everything runs in your browser. Your files stay on your machine." },
];

export default function About() {
  useScrollReveal();
  const timeline = useRef<HTMLOListElement>(null);

  // The timeline's line fills as the reader scrolls through the chapters.
  useEffect(() => {
    const el = timeline.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.6 - rect.top) / rect.height));
      el.style.setProperty("--progress", progress.toFixed(3));
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

  return (
    <div className="landing page">
      <div className="hero-grid" aria-hidden="true" />
      <SiteNav page="about" />

      <section className="page-hero">
        <span className="eyebrow">
          <i /> The story
        </span>
        <h1>
          From designing with AI
          <br />
          to shipping <span className="marker">real code</span>.
        </h1>
        <p className="page-hero__lead">
          Flow2Repo started with a designer who wanted designs to become real projects without losing anything on the
          way. This is how it happened.
        </p>
      </section>

      <section className="section story">
        <ol className="timeline" ref={timeline}>
          {CHAPTERS.map((chapter, i) => (
            <li className="chapter reveal" key={chapter.title} style={{ "--i": i } as CSSProperties}>
              <span className="chapter__dot" aria-hidden="true" />
              <div className="chapter__card">
                <span className="chapter__year">{chapter.year}</span>
                <h2>{chapter.title}</h2>
                <p>{chapter.text}</p>
              </div>
              <div className="chapter__art" aria-hidden="true">
                {chapter.art}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="section reveal">
        <p className="section__kicker">What it stands for</p>
        <h2 className="section__title">Four promises.</h2>
        <div className="features principles">
          {PRINCIPLES.map((p, i) => (
            <div className="feature" key={p.title} style={{ "--i": i } as CSSProperties}>
              <p.icon className="feature__icon" width={20} height={20} />
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section reveal">
        <div className="cta">
          <div>
            <h2>Say hi, or hire me.</h2>
            <p>
              {CREATOR.name} · {CREATOR.role}
            </p>
          </div>
          <CreatorLinks />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
