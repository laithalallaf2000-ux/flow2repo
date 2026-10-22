import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";

const LANGUAGES: Record<string, string> = {
  tsx: "tsx",
  ts: "typescript",
  css: "css",
  json: "json",
  html: "markup",
  svg: "markup",
  md: "markdown",
};

/** Returns highlighted HTML for a file, or escaped plain text for unknown types. */
export function highlight(code: string, path: string): string {
  const language = LANGUAGES[path.split(".").pop() ?? ""];
  const grammar = language ? Prism.languages[language] : undefined;
  if (!grammar) return code.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return Prism.highlight(code, grammar, language);
}
