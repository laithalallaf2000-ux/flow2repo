import { useEffect, useState } from "react";

export type Route = "home" | "about" | "privacy";

const ROUTES: Record<string, Route> = { "#/about": "about", "#/privacy": "privacy" };

function current(): Route {
  return ROUTES[window.location.hash] ?? "home";
}

/**
 * Hash routes (#/about, #/privacy) keep the site a set of static files: no server rewrites needed.
 * Plain anchors such as #features belong to the home page and scroll to their section.
 */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(current);

  useEffect(() => {
    const onChange = () => {
      const next = current();
      setRoute(next);
      if (next !== "home" || !window.location.hash) window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  // Coming back to the home page on "#features": scroll there once the page has rendered.
  useEffect(() => {
    if (route !== "home") return;
    const id = window.location.hash.slice(1);
    if (!id || id.startsWith("/")) return;
    // Wait for the page to lay out, so the section lands below the sticky nav (scroll-margin-top).
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView(), 60);
    return () => window.clearTimeout(timer);
  }, [route]);

  return route;
}
