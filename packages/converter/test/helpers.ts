import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { analyzeDesign, generateProject, type GenerateOptions, type InputFile } from "../src";

export const FIXTURES_DIR = join(import.meta.dirname, "../../../fixtures");

export function readFixture(name: string): InputFile[] {
  const root = join(FIXTURES_DIR, name);
  const files: InputFile[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else files.push({ path: relative(root, full), data: new Uint8Array(readFileSync(full)) });
    }
  };
  walk(root);
  return files;
}

export function listFixtures(): string[] {
  return readdirSync(FIXTURES_DIR).filter((name) => statSync(join(FIXTURES_DIR, name)).isDirectory());
}

/** Converts HTML (or several files) and returns generated text files by path. */
export function convert(input: string | InputFile[], options?: GenerateOptions) {
  const files = typeof input === "string" ? [{ path: "index.html", data: input }] : input;
  const analysis = analyzeDesign(files);
  const result = generateProject(analysis, options);
  const byPath = new Map(result.files.map((f) => [f.path, typeof f.data === "string" ? f.data : ""]));
  return { analysis, result, file: (path: string) => byPath.get(path) ?? "", has: (path: string) => byPath.has(path) };
}

/** Wraps screens in a minimal Flow2Repo-spec document. */
export function spec(screens: string, head = ""): string {
  return `<!DOCTYPE html><html lang="en"><head><title>Test App</title>${head}</head><body><div data-f2r="canvas">${screens}</div></body></html>`;
}
