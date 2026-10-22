import { useEffect, useMemo, useRef, useState } from "react";
import { buildScreenPreview, resolvePreviewClick, type Analysis, type PreviewClick } from "@flow2repo/converter";
import { assetDataUrls } from "../lib/files";
import { MonitorIcon, PhoneIcon, TabletIcon } from "./Icons";

const DEVICES = [
  { id: "desktop", label: "Desktop", width: "100%", icon: MonitorIcon },
  { id: "tablet", label: "Tablet", width: "834px", icon: TabletIcon },
  { id: "mobile", label: "Mobile", width: "390px", icon: PhoneIcon },
] as const;

interface PreviewPaneProps {
  analysis: Analysis;
  screenId: string;
  title: string;
  /** Called when a link or button in the preview leads to another screen. */
  onNavigate: (screenId: string) => void;
}

export default function PreviewPane({ analysis, screenId, title, onNavigate }: PreviewPaneProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const assets = useMemo(() => assetDataUrls(analysis.files.assets), [analysis]);
  const html = useMemo(
    () => buildScreenPreview(analysis, screenId, (path) => assets.get(path)),
    [analysis, screenId, assets],
  );
  const width = DEVICES.find((d) => d.id === device)!.width;

  // Links inside the preview do not navigate the frame; it reports clicks and we switch screens here.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const click = event.data as PreviewClick;
      if (click?.type !== "flow2repo:click") return;
      const target = resolvePreviewClick(analysis, screenId, click);
      if (target && target !== screenId) onNavigate(target);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [analysis, screenId, onNavigate]);

  return (
    <div className="preview">
      <div className="toolbar">
        <span className="toolbar__title">{title}</span>
        <div className="segmented" role="group" aria-label="Preview width">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              className={d.id === device ? "on" : ""}
              onClick={() => setDevice(d.id)}
              title={d.label}
            >
              <d.icon width={16} height={16} />
            </button>
          ))}
        </div>
      </div>
      <div className="preview__stage">
        <iframe
          ref={frame}
          key={screenId}
          title={`Preview of ${title}`}
          className="preview__frame"
          style={{ width }}
          sandbox="allow-scripts"
          srcDoc={html}
        />
      </div>
    </div>
  );
}
