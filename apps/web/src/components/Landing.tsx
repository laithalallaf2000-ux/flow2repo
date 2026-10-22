import type { CSSProperties, ReactNode } from "react";
import type { Upload } from "../lib/files";
import type { Sample } from "../lib/samples";
import DropZone from "./DropZone";
import {
  FormIcon,
  LayersIcon,
  ListIcon,
  PaletteIcon,
  ReportIcon,
  RouteIcon,
  SectionsIcon,
  ShieldIcon,
  ToggleIcon,
} from "./Icons";
import CreatorCard from "./CreatorCard";
import PromptBox from "./PromptBox";
import SiteFooter from "./SiteFooter";
import SiteNav from "./SiteNav";
import { useScrollReveal } from "./useScrollReveal";

interface LandingProps {
  onUpload: (upload: Upload) => void;
}

const STEPS = [
  {
    title: "Pick a prompt",
    text: "One for dashboards and web apps, one for websites. Each tells any AI how to lay out pages, shared parts and navigation.",
  },
  {
    title: "Design with any AI",
    text: "Paste it into ChatGPT, Claude, Gemini or any AI that writes HTML, describe your idea and get one file with every screen.",
  },
  {
    title: "Drop it, get a repo",
    text: "Review the screens, rename routes, preview every page and download a React + Vite project.",
  },
];

const FEATURES = [
  { icon: RouteIcon, title: "Pages and routing", text: "Every screen becomes a page wired with React Router. Links and buttons navigate for real." },
  { icon: LayersIcon, title: "Shared components", text: "Sidebars, navbars and footers are extracted once, with the active link and props where copies differ." },
  { icon: ListIcon, title: "Typed data and .map()", text: "Repeated cards, rows and list items become typed arrays in src/data, ready to swap for an API call." },
  { icon: FormIcon, title: "Forms with state", text: "Fields become controlled inputs with typed values and a submit handler that marks where your API goes." },
  { icon: ToggleIcon, title: "Menus and tabs that work", text: "Mobile menus, dropdowns, modals and tabs declared in the design become real React state." },
  { icon: SectionsIcon, title: "Long pages, split", text: "Landing pages are split into one component per section, each with its own data and state." },
  { icon: PaletteIcon, title: "Built to match", text: "Styles, fonts and images carry over. The designs we test come out identical to the original, pixel for pixel." },
  { icon: ReportIcon, title: "Honest report", text: "Anything that could not be converted is listed, so nothing breaks silently." },
  { icon: ShieldIcon, title: "Private by design", text: "Conversion runs entirely in your browser. Your designs never leave your machine." },
];

const MINI_SCREENS = ["Dashboard", "Orders", "Order details", "Customers", "Analytics", "Settings"];

const CODE_LINES: ReactNode[] = [
  <>
    <span className="t-k">import</span> {"{ "}orders{" }"} <span className="t-k">from</span> <span className="t-s">"../data/orders"</span>;
  </>,
  <> </>,
  <>
    <span className="t-k">export default function</span> <span className="t-f">OrdersTable</span>() {"{"}
  </>,
  <>
    {"  "}
    <span className="t-k">return</span> (
  </>,
  <>
    {"    "}&lt;<span className="t-t">tbody</span>&gt;
  </>,
  <>
    {"      "}
    {"{"}orders.<span className="t-f">map</span>((order) =&gt; (
  </>,
  <>
    {"        "}&lt;<span className="t-t">tr</span> <span className="t-a">key</span>={"{"}order.id{"}"}&gt;
  </>,
  <>
    {"          "}&lt;<span className="t-t">td</span>&gt;{"{"}order.customer{"}"}&lt;/<span className="t-t">td</span>&gt;
  </>,
  <>
    {"        "}&lt;/<span className="t-t">tr</span>&gt;
  </>,
  <>
    {"      "}
    {"))}"}
  </>,
  <>
    {"    "}&lt;/<span className="t-t">tbody</span>&gt;
    <span className="caret" />
  </>,
];

export default function Landing({ onUpload }: LandingProps) {
  useScrollReveal();
  const loadSample = async (sample: Sample) => onUpload(await sample.load());

  return (
    <div className="landing">
      <div className="hero-grid" aria-hidden="true" />
      <SiteNav />

      <section className="hero">
        <div className="hero__copy">
          <span className="eyebrow">
            <i /> Open source · Runs in your browser
          </span>
          <h1>
            Design it with AI.
            <br />
            Ship a <span className="marker">real React repo</span>.
          </h1>
          <p className="hero__sub">
            Flow2Repo turns a dashboard or website designed by AI into a clean React + TypeScript project: pages,
            shared components, typed data, working navigation and your exact styles.
          </p>
          <DropZone onUpload={onUpload} onSample={loadSample} />
        </div>

        <div className="hero__visual" aria-hidden="true">
          <div className="canvas-card">
            <div className="window-bar">
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
              <span className="mono">design.html</span>
            </div>
            <div className="canvas-card__grid">
              {MINI_SCREENS.map((name, i) => (
                <div className="mini" key={name} style={{ "--i": i } as CSSProperties}>
                  <span className="mini__side" />
                  <span className="mini__body">
                    <b />
                    <span />
                    <span />
                  </span>
                  <em>{name}</em>
                </div>
              ))}
            </div>
          </div>
          <div className="code-card">
            <div className="window-bar window-bar--dark">
              <span className="mono">src/pages/OrdersPage.tsx</span>
            </div>
            <pre>
              {CODE_LINES.map((line, i) => (
                <span className="ln" key={i} style={{ "--l": i } as CSSProperties}>
                  {line}
                </span>
              ))}
            </pre>
          </div>
        </div>
      </section>

      <div className="works-with reveal">
        <span>Works with designs from</span>
        <strong>ChatGPT</strong>
        <strong>Claude</strong>
        <strong>Gemini</strong>
        <strong>any AI that writes HTML</strong>
      </div>

      <section className="section reveal" id="how">
        <p className="section__kicker">How it works</p>
        <h2 className="section__title">Three steps from idea to repository.</h2>
        <div className="steps">
          {STEPS.map((step, i) => (
            <div className="step" key={step.title}>
              <span className="step__num">0{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section prompt-section reveal" id="prompt">
        <div className="prompt-section__intro">
          <p className="section__kicker">The prompt</p>
          <h2 className="section__title">The prompt is the secret.</h2>
          <p>
            AI tools produce HTML in endless shapes. The Flow2Repo prompts give them one shape: every screen marked,
            every shared part named, every button told where it goes. That is what makes the conversion exact instead
            of a guess. Pick the dashboard prompt for apps with a sidebar, the website prompt for marketing sites.
          </p>
          <ul className="checklist">
            <li>Screens on one canvas, each with an id and a title</li>
            <li>Shared parts marked once, identical on every screen</li>
            <li>
              Navigation declared with <code>data-goto</code>
            </li>
            <li>
              Menus and tabs declared with <code>data-toggle</code> and <code>data-tab</code>
            </li>
            <li>Repeated items and forms built so they become data and state</li>
          </ul>
          <p className="muted">
            Designs made without the prompt still work: Flow2Repo detects screens from the layout and links buttons by
            their labels. You just get more to review.
          </p>
        </div>
        <PromptBox />
      </section>

      <section className="section reveal" id="features">
        <p className="section__kicker">What you get</p>
        <h2 className="section__title">A project you would have written by hand.</h2>
        <div className="features">
          {FEATURES.map((f, i) => (
            <div className="feature" key={f.title} style={{ "--i": i } as CSSProperties}>
              <f.icon className="feature__icon" width={20} height={20} />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section reveal">
        <CreatorCard />
      </section>

      <section className="section reveal">
        <div className="cta">
          <div>
            <h2>Try it with your own design.</h2>
            <p>Free, open source, and nothing is uploaded.</p>
          </div>
          <button
            type="button"
            className="btn btn--light"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            Convert a design
          </button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
