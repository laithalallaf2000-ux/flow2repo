import type { Upload } from "./files";

export interface Sample {
  id: string;
  label: string;
  load: () => Promise<Upload>;
}

/**
 * Designs that show what Flow2Repo does best. They are loaded on demand, so the landing page
 * does not carry their weight (the website sample embeds its photos).
 */
export const SAMPLES: Sample[] = [
  {
    id: "dashboard",
    label: "a dashboard",
    load: async () => {
      const { default: html } = await import("../../../../fixtures/spec-nexaflow/index.html?raw");
      return { name: "nexaflow-dashboard.html", files: [{ path: "index.html", data: html }] };
    },
  },
  {
    id: "website",
    label: "a website",
    load: async () => {
      const { default: html } = await import("../../../../fixtures/loanwell-landing/index.html?raw");
      return { name: "loanwell-website.html", files: [{ path: "index.html", data: html }] };
    },
  },
];
