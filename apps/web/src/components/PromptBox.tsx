import { useState } from "react";
import dashboardPrompt from "../../../../docs/prompts/dashboard.md?raw";
import websitePrompt from "../../../../docs/prompts/website.md?raw";
import { CheckIcon, CopyIcon, DownloadIcon } from "./Icons";

const PROMPTS = [
  { id: "dashboard", label: "Dashboard / web app", file: "flow2repo-dashboard-prompt.md", text: dashboardPrompt },
  { id: "website", label: "Website", file: "flow2repo-website-prompt.md", text: websitePrompt },
] as const;

export default function PromptBox() {
  const [selected, setSelected] = useState<(typeof PROMPTS)[number]["id"]>("dashboard");
  const [copied, setCopied] = useState(false);
  const prompt = PROMPTS.find((p) => p.id === selected)!;

  const copy = async () => {
    await navigator.clipboard.writeText(prompt.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([prompt.text], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = prompt.file;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="prompt-box">
      <div className="prompt-box__bar">
        <div className="segmented prompt-box__tabs" role="tablist" aria-label="Prompt type">
          {PROMPTS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === selected}
              className={p.id === selected ? "on" : ""}
              onClick={() => {
                setSelected(p.id);
                setCopied(false);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="prompt-box__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={download} title={prompt.file}>
            <DownloadIcon width={15} height={15} /> .md
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={copy}>
            {copied ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </div>
      </div>
      <pre className="prompt-box__text" key={prompt.id}>
        {prompt.text}
      </pre>
    </div>
  );
}
