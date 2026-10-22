import type { Analysis, GenerationResult, WarningLevel } from "@flow2repo/converter";
import { AlertIcon, CheckIcon, ErrorIcon, InfoIcon } from "./Icons";

const ICONS: Record<WarningLevel, typeof InfoIcon> = { error: ErrorIcon, warning: AlertIcon, info: InfoIcon };

interface ReportPaneProps {
  analysis: Analysis;
  result: GenerationResult;
  onOpenFile: (path: string) => void;
}

export default function ReportPane({ analysis, result, onOpenFile }: ReportPaneProps) {
  const sourceFiles = result.files.filter((f) => f.path.startsWith("src/")).length;
  const assets = result.files.filter((f) => f.path.startsWith("public/")).length;
  const stats = [
    { label: "Pages", value: result.pages.length },
    { label: "Shared components", value: result.components.length },
    { label: "Source files", value: sourceFiles },
    { label: "Assets", value: assets },
  ];

  return (
    <div className="report">
      <div className="stats">
        {stats.map((s) => (
          <div className="stat-tile" key={s.label}>
            <span className="stat-tile__value">{s.value}</span>
            <span className="stat-tile__label">{s.label}</span>
          </div>
        ))}
      </div>

      <section className="report__section">
        <h3>Pages</h3>
        <table className="report__table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Screen</th>
              <th>Component</th>
            </tr>
          </thead>
          <tbody>
            {result.pages.map((p) => (
              <tr key={p.screenId}>
                <td className="mono">{p.route}</td>
                <td>{p.title}</td>
                <td>
                  <button type="button" className="link-button mono" onClick={() => onOpenFile(p.file)}>
                    {p.componentName}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {result.components.length > 0 && (
        <section className="report__section">
          <h3>Shared components</h3>
          <div className="chips">
            {result.components.map((c) => (
              <button key={c.name} type="button" className="chip" onClick={() => onOpenFile(c.file)}>
                <span className="mono">{c.name}</span>
                <span className="chip__meta">{c.usedIn.length} screens</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="report__section">
        <h3>Conversion notes</h3>
        {result.warnings.length === 0 ? (
          <p className="report__clean">
            <CheckIcon width={16} height={16} /> Clean conversion: nothing needs your attention.
          </p>
        ) : (
          <ul className="warnings">
            {result.warnings.map((w, i) => {
              const Icon = ICONS[w.level];
              return (
                <li key={i} className={`warning warning--${w.level}`}>
                  <Icon width={16} height={16} />
                  <span>{w.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="report__foot muted">
        Detected from {analysis.docs.length} HTML file{analysis.docs.length === 1 ? "" : "s"} · Runs locally, nothing was
        uploaded.
      </p>
    </div>
  );
}
