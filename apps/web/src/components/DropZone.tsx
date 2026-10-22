import { useRef, useState, type DragEvent } from "react";
import { readUpload, type Upload } from "../lib/files";
import { SAMPLES, type Sample } from "../lib/samples";
import { UploadIcon } from "./Icons";

interface DropZoneProps {
  onUpload: (upload: Upload) => void;
  onSample: (sample: Sample) => Promise<void>;
}

export default function DropZone({ onUpload, onSample }: DropZoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      onUpload(await readUpload(files));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the files.");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void handle([...event.dataTransfer.files]);
  };

  return (
    <div className="dropzone-wrap">
      <div
        className={`dropzone${dragging ? " dropzone--active" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="dropzone__icon">
          <UploadIcon width={26} height={26} />
        </span>
        <strong>{busy ? "Reading your design…" : "Drop your design here"}</strong>
        <span className="dropzone__hint">
          One <code>.html</code> file with all screens, several HTML files, or a <code>.zip</code> with assets
        </span>
        <span className="btn btn--primary dropzone__button">Choose files</span>
        <input
          ref={input}
          type="file"
          accept=".html,.htm,.zip,.css,.png,.jpg,.jpeg,.svg,.webp,.gif"
          multiple
          hidden
          onChange={(e) => {
            void handle([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="dropzone__error">{error}</p>}
      <p className="dropzone__alt">
        No design yet? Try{" "}
        {SAMPLES.map((sample, i) => (
          <span key={sample.id}>
            {i > 0 && " or "}
            <button
              type="button"
              className="link-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSample(sample);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {sample.label}
            </button>
          </span>
        ))}
      </p>
    </div>
  );
}
