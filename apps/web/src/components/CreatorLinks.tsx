import { CREATOR } from "../lib/site";
import { GitHubIcon, GlobeIcon, LinkedInIcon } from "./Icons";

/** Website, LinkedIn and GitHub of the creator, as icon buttons. */
export default function CreatorLinks() {
  const links = [
    { href: CREATOR.website, label: "Website", icon: GlobeIcon },
    { href: CREATOR.linkedin, label: "LinkedIn", icon: LinkedInIcon },
    { href: CREATOR.github, label: "GitHub", icon: GitHubIcon },
  ];
  return (
    <div className="creator-links">
      {links.map((link) => (
        <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="creator-link">
          <link.icon width={16} height={16} />
          <span>{link.label}</span>
        </a>
      ))}
    </div>
  );
}
