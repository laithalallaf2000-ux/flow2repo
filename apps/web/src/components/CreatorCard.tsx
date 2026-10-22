import { CREATOR } from "../lib/site";
import CreatorLinks from "./CreatorLinks";

/** "Built by" band: who is behind Flow2Repo, with a way to read the story and reach them. */
export default function CreatorCard() {
  return (
    <div className="creator">
      <img className="creator__avatar" src="/creator-logo.png" alt="" width="92" height="92" />
      <div className="creator__body">
        <p className="section__kicker">Built by a designer</p>
        <h2 className="creator__title">Hi, I'm {CREATOR.name}.</h2>
        <p className="creator__text">
          I'm a UX designer. I started designing in HTML with AI, and kept losing time turning those designs into real
          React code. Flow2Repo is the tool I wanted: fast, honest, and free for everyone.
        </p>
        <div className="creator__actions">
          <a className="btn btn--dark btn--sm" href="#/about">
            Read the story
          </a>
          <CreatorLinks />
        </div>
      </div>
    </div>
  );
}
