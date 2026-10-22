export type FileData = string | Uint8Array;

export interface InputFile {
  /** Path inside the uploaded design, e.g. "index.html" or "assets/logo.png". */
  path: string;
  data: FileData;
}

export interface OutputFile {
  path: string;
  data: FileData;
}

export type WarningLevel = "info" | "warning" | "error";

export interface ConversionWarning {
  level: WarningLevel;
  message: string;
  /** Screen id the warning belongs to, when it is screen specific. */
  screen?: string;
}

/**
 * How screens were found:
 * - spec: the design follows the Flow2Repo prompt (`data-screen` markers)
 * - multi-file: every HTML file is one screen
 * - heuristic: screens guessed from the layout of a single file
 * - single: the whole file is one page
 */
export type DetectionMode = "spec" | "multi-file" | "heuristic" | "single";

/** User-editable settings for one detected screen. */
export interface ScreenConfig {
  id: string;
  title: string;
  route: string;
  include: boolean;
}

export interface AnalyzeOptions {
  /** "single" skips screen detection and treats the main HTML file as one page. */
  detection?: "auto" | "single";
}

export interface GenerateOptions {
  projectName?: string;
  screens?: ScreenConfig[];
}

export interface GeneratedPage {
  screenId: string;
  title: string;
  route: string;
  componentName: string;
  file: string;
}

export interface GeneratedComponent {
  name: string;
  file: string;
  usedIn: string[];
}

export interface GenerationResult {
  projectName: string;
  files: OutputFile[];
  pages: GeneratedPage[];
  components: GeneratedComponent[];
  warnings: ConversionWarning[];
}
