export { analyzeDesign, defaultScreenConfig, normalizeRoute } from "./analyze";
export type { Analysis, AnalyzedScreen } from "./analyze";
export { generateProject } from "./generate";
export { buildScreenPreview, resolvePreviewClick } from "./preview";
export type { PreviewClick } from "./preview";
export { PROJECT_DEPENDENCIES } from "./project";
export type * from "./types";

/** Version of the Flow2Repo Design Spec (docs/prompts/) this converter implements. */
export const SPEC_VERSION = 1;
