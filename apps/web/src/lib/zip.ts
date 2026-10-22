import JSZip from "jszip";
import type { GenerationResult } from "@flow2repo/converter";

export async function downloadProject(result: GenerationResult): Promise<void> {
  const zip = new JSZip();
  const root = zip.folder(result.projectName)!;
  for (const file of result.files) root.file(file.path, file.data);

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${result.projectName}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
