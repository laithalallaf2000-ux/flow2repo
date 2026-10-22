import type { CSSProperties } from "react";
import type { DetectionMode, ScreenConfig } from "@flow2repo/converter";
import { HomeIcon } from "./Icons";

interface ScreenListProps {
  mode: DetectionMode;
  forcedSingle: boolean;
  screens: ScreenConfig[];
  selected: string;
  onSelect: (id: string) => void;
  onChange: (screens: ScreenConfig[]) => void;
  onDetectionChange: (detection: "auto" | "single") => void;
}

const MODE_INFO: Record<DetectionMode, { tone: string; title: string; text: string }> = {
  spec: { tone: "success", title: "Flow2Repo prompt detected", text: "Screens, components and links come straight from the markers." },
  "multi-file": { tone: "info", title: "One screen per HTML file", text: "Links between the files were turned into routes." },
  heuristic: { tone: "warning", title: "Screens guessed from the layout", text: "Check the list below. Use the prompt for exact results." },
  single: { tone: "neutral", title: "Single page", text: "The whole file becomes one page." },
};

export default function ScreenList({
  mode,
  forcedSingle,
  screens,
  selected,
  onSelect,
  onChange,
  onDetectionChange,
}: ScreenListProps) {
  const info = MODE_INFO[mode];
  const included = screens.filter((s) => s.include).length;

  const update = (id: string, patch: Partial<ScreenConfig>) =>
    onChange(screens.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const setHome = (id: string) =>
    onChange(
      screens.map((s) => {
        if (s.id === id) return { ...s, route: "/", include: true };
        return s.route === "/" ? { ...s, route: `/${s.id}` } : s;
      }),
    );

  return (
    <aside className="panel screens">
      <div className={`notice notice--${info.tone}`}>
        <strong>{info.title}</strong>
        <span>{info.text}</span>
        {mode === "heuristic" && (
          <button type="button" className="link-button" onClick={() => onDetectionChange("single")}>
            Treat the file as one page instead
          </button>
        )}
        {forcedSingle && (
          <button type="button" className="link-button" onClick={() => onDetectionChange("auto")}>
            Detect screens again
          </button>
        )}
      </div>

      <div className="panel__head">
        <h2>Screens</h2>
        <span className="count">
          {included}/{screens.length}
        </span>
      </div>

      <ol className="screen-list">
        {screens.map((screen, index) => {
          const isHome = screen.route.trim() === "/";
          return (
            <li
              key={screen.id}
              className={`screen-card${screen.id === selected ? " screen-card--selected" : ""}${
                screen.include ? "" : " screen-card--excluded"
              }`}
              onClick={() => onSelect(screen.id)}
              style={{ "--i": index } as CSSProperties}
            >
              <div className="screen-card__top">
                <label className="switch" title={screen.include ? "Included" : "Excluded"} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={screen.include}
                    onChange={(e) => update(screen.id, { include: e.target.checked })}
                    aria-label={`Include ${screen.title}`}
                  />
                  <span />
                </label>
                <span className="screen-card__index">{String(index + 1).padStart(2, "0")}</span>
                <input
                  className="screen-card__title"
                  value={screen.title}
                  onChange={(e) => update(screen.id, { title: e.target.value })}
                  aria-label="Screen title"
                />
                <button
                  type="button"
                  className={`home-toggle${isHome ? " home-toggle--on" : ""}`}
                  title={isHome ? "Start page" : "Make this the start page"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setHome(screen.id);
                  }}
                >
                  <HomeIcon width={15} height={15} />
                </button>
              </div>
              <label className="route-field">
                <span>route</span>
                <input
                  value={screen.route}
                  onChange={(e) => update(screen.id, { route: e.target.value })}
                  aria-label="Route"
                  spellCheck={false}
                />
              </label>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
