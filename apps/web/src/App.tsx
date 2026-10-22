import { lazy, Suspense, useState } from "react";
import About from "./components/About";
import Landing from "./components/Landing";
import Privacy from "./components/Privacy";
import type { Upload } from "./lib/files";
import { useHashRoute } from "./lib/route";

// The converter, highlighter and ZIP writer load only once a design is opened.
const Workspace = lazy(() => import("./components/Workspace"));

export default function App() {
  const route = useHashRoute();
  const [upload, setUpload] = useState<Upload | null>(null);

  if (upload) {
    return (
      <Suspense fallback={<div className="empty">Opening your design…</div>}>
        <Workspace upload={upload} onReset={() => setUpload(null)} />
      </Suspense>
    );
  }
  if (route === "about") return <About />;
  if (route === "privacy") return <Privacy />;
  return <Landing onUpload={setUpload} />;
}
