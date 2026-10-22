import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeDesign, generateProject } from "../src";
import { listFixtures, readFixture } from "./helpers";

const OUTPUT_DIR = join(import.meta.dirname, "../../../.output");

/** Every fixture must produce a project that installs, type-checks and builds. */
describe.each(listFixtures())("fixture %s", (name) => {
  it("generates a React project that builds", () => {
    const result = generateProject(analyzeDesign(readFixture(name)));
    expect(result.warnings.filter((w) => w.level === "error")).toEqual([]);

    const dir = join(OUTPUT_DIR, name);
    rmSync(dir, { recursive: true, force: true });
    for (const file of result.files) {
      const path = join(dir, file.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.data);
    }

    // Vitest sets NODE_ENV=test. Install like a user (dev dependencies included), then build for production.
    const { NODE_ENV: _, ...userEnv } = process.env;
    execFileSync("npm", ["install", "--no-audit", "--no-fund", "--prefer-offline", "--loglevel=error"], { cwd: dir, stdio: "pipe", env: userEnv });
    try {
      execFileSync("npm", ["run", "build"], { cwd: dir, stdio: "pipe", env: { ...userEnv, NODE_ENV: "production" } });
    } catch (error) {
      const e = error as { stdout?: Buffer; stderr?: Buffer };
      throw new Error(`Build failed for ${name}:\n${e.stdout?.toString()}\n${e.stderr?.toString()}`);
    }
  }, 300_000);
});
