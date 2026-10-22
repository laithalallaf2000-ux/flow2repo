import { useMemo, useState } from "react";
import { analyzeDesign, defaultScreenConfig, generateProject, type ScreenConfig } from "@flow2repo/converter";
import type { Upload } from "../lib/files";
import { downloadProject } from "../lib/zip";
import CodePane from "./CodePane";
import { ArrowLeftIcon, CodeIcon, DownloadIcon, EyeIcon, ReportIcon } from "./Icons";
import Logo from "./Logo";
import PreviewPane from "./PreviewPane";
import ReportPane from "./ReportPane";
import ScreenList from "./ScreenList";

type Tab = "preview" | "code" | "report";

interface WorkspaceProps {
  upload: Upload;
  onReset: () => void;
}

export default function Workspace({ upload, onReset }: WorkspaceProps) {
  const [detection, setDetection] = useState<"auto" | "single">("auto");
  const analysis = useMemo(() => analyzeDesign(upload.files, { detection }), [upload, detection]);

  // Screen settings belong to one analysis; switching detection starts from fresh defaults.
  const [screenState, setScreenState] = useState(() => ({ analysis, screens: defaultScreenConfig(analysis) }));
  const screens = screenState.analysis === analysis ? screenState.screens : defaultScreenConfig(analysis);
  const setScreens = (next: ScreenConfig[]) => setScreenState({ analysis, screens: next });

  const [projectName, setProjectName] = useState(analysis.suggestedName);
  const [tab, setTab] = useState<Tab>("preview");
  const [selectedScreen, setSelectedScreen] = useState(analysis.screens[0]?.id ?? "");
  const [selectedFile, setSelectedFile] = useState("src/App.tsx");
  const [downloading, setDownloading] = useState(false);

  const result = useMemo(
    () => generateProject(analysis, { projectName, screens }),
    [analysis, projectName, screens],
  );

  const screenId = screens.some((s) => s.id === selectedScreen) ? selectedScreen : screens[0]?.id ?? "";
  const screenTitle = screens.find((s) => s.id === screenId)?.title ?? "";
  const notes = result.warnings.filter((w) => w.level !== "info").length;
  const hasErrors = result.warnings.some((w) => w.level === "error");

  const openFile = (path: string) => {
    setSelectedFile(path);
    setTab("code");
  };

  const download = async () => {
    setDownloading(true);
    try {
      await downloadProject(result);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="workspace">
      <header className="ws-bar">
        <button type="button" className="icon-button" onClick={onReset} title="Start over">
          <ArrowLeftIcon width={18} height={18} />
        </button>
        <Logo />
        <span className="file-chip mono" title={upload.name}>
          {upload.name}
        </span>
        <div className="ws-bar__spacer" />
        <label className="project-name">
          <span>Project</span>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            spellCheck={false}
            aria-label="Project name"
          />
        </label>
        <button type="button" className="btn btn--primary" onClick={download} disabled={hasErrors || downloading}>
          <DownloadIcon width={16} height={16} />
          <span className="btn__label">{downloading ? "Packing…" : "Download ZIP"}</span>
        </button>
      </header>

      <div className="ws-body">
        {analysis.screens.length > 0 && (
          <ScreenList
            mode={analysis.mode}
            forcedSingle={detection === "single"}
            screens={screens}
            selected={screenId}
            onSelect={(id) => {
              setSelectedScreen(id);
              setTab("preview");
            }}
            onChange={setScreens}
            onDetectionChange={setDetection}
          />
        )}

        <main className="panel ws-main">
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>
              <EyeIcon width={16} height={16} /> Preview
            </button>
            <button type="button" role="tab" aria-selected={tab === "code"} onClick={() => setTab("code")}>
              <CodeIcon width={16} height={16} /> Code
              <span className="tabs__badge">{result.files.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === "report"} onClick={() => setTab("report")}>
              <ReportIcon width={16} height={16} /> Report
              {notes > 0 && <span className="tabs__badge tabs__badge--warn">{notes}</span>}
            </button>
          </div>

          <div className="ws-content">
            {tab === "preview" &&
              (screenId ? (
                <PreviewPane analysis={analysis} screenId={screenId} title={screenTitle} onNavigate={setSelectedScreen} />
              ) : (
                <div className="empty">No screens found in this design.</div>
              ))}
            {tab === "code" &&
              (result.files.length ? (
                <CodePane result={result} selected={selectedFile} onSelect={setSelectedFile} />
              ) : (
                <div className="empty">Include at least one screen to generate code.</div>
              ))}
            {tab === "report" && <ReportPane analysis={analysis} result={result} onOpenFile={openFile} />}
          </div>
        </main>
      </div>
    </div>
  );
}
