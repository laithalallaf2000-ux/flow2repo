import { CREATOR, REPO_URL } from "../lib/site";
import CreatorLinks from "./CreatorLinks";
import Logo from "./Logo";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div className="site-footer__brand">
          <Logo />
          <p>Turn AI-designed dashboards and websites into clean React repositories.</p>
        </div>
        <nav className="site-footer__col" aria-label="Product">
          <h3>Product</h3>
          <a href="#how">How it works</a>
          <a href="#prompt">The prompts</a>
          <a href="#features">Features</a>
        </nav>
        <nav className="site-footer__col" aria-label="Project">
          <h3>Project</h3>
          <a href="#/about">About</a>
          <a href="#/privacy">Privacy</a>
          {REPO_URL && (
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              Source on GitHub
            </a>
          )}
        </nav>
        <div className="site-footer__col site-footer__creator">
          <h3>Made by</h3>
          <a href={CREATOR.website} target="_blank" rel="noopener noreferrer" className="site-footer__name">
            {CREATOR.name}
          </a>
          <span className="site-footer__role">{CREATOR.role}</span>
          <CreatorLinks />
        </div>
      </div>
      <div className="site-footer__bottom">
        <span>
          © {new Date().getFullYear()} {CREATOR.name}. Open source.
        </span>
        <span>React today. Flutter is on the roadmap.</span>
      </div>
    </footer>
  );
}
