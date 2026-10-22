import type { CSSProperties } from "react";
import { CREATOR, REPO_URL } from "../lib/site";
import { CodeIcon, DownloadIcon, EyeIcon, GlobeIcon, LockIcon, ShieldIcon } from "./Icons";
import SiteFooter from "./SiteFooter";
import SiteNav from "./SiteNav";
import { useScrollReveal } from "./useScrollReveal";

const POINTS = [
  {
    icon: LockIcon,
    title: "Your files never leave your computer",
    text: "When you drop a design, the browser reads it and converts it right there. Nothing is uploaded: Flow2Repo has no server that receives files, no account and no database.",
  },
  {
    icon: DownloadIcon,
    title: "The ZIP is built on your machine",
    text: "The generated project is packed into a ZIP inside your browser and saved straight to your downloads.",
  },
  {
    icon: EyeIcon,
    title: "The preview is sandboxed",
    text: "Each screen is shown in an isolated frame. Scripts from your design do not run there; the only script is a small one of ours that turns clicks into screen changes.",
  },
  {
    icon: GlobeIcon,
    title: "What does go online",
    text: "This site loads its fonts from Google Fonts. While previewing, images and fonts that your design links to (for example from Unsplash) load from their own servers, exactly as they would if you opened the design yourself.",
  },
  {
    icon: ShieldIcon,
    title: "No tracking",
    text: "No analytics, no cookies, no ads, and nothing stored in your browser. Reloading the page forgets your design.",
  },
  {
    icon: CodeIcon,
    title: "You can check all of this",
    text: "Flow2Repo is open source, so every claim on this page can be verified in the code.",
  },
];

export default function Privacy() {
  useScrollReveal();
  return (
    <div className="landing page">
      <div className="hero-grid" aria-hidden="true" />
      <SiteNav page="privacy" />

      <section className="page-hero">
        <span className="eyebrow">
          <i /> Privacy
        </span>
        <h1>
          Your designs stay <span className="marker">yours</span>.
        </h1>
        <p className="page-hero__lead">
          The short version: Flow2Repo runs entirely in your browser. Here is exactly what happens to your files.
        </p>
      </section>

      <section className="section reveal">
        <div className="features privacy-points">
          {POINTS.map((point, i) => (
            <div className="feature" key={point.title} style={{ "--i": i } as CSSProperties}>
              <point.icon className="feature__icon" width={20} height={20} />
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </div>
          ))}
        </div>
        <p className="privacy-note">
          Questions? Reach {CREATOR.name} on{" "}
          <a href={CREATOR.linkedin} target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
          {REPO_URL && (
            <>
              {" "}
              or open an issue on{" "}
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </>
          )}
          . Last updated October 22, 2026.
        </p>
      </section>

      <SiteFooter />
    </div>
  );
}
