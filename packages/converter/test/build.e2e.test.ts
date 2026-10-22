import { execFile } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { analyzeDesign, generateProject } from "../src";
import { listFixtures, readFixture } from "./helpers";

const OUTPUT_DIR = join(import.meta.dirname, "../../../.output");

// Async on purpose: a blocking exec stalls the Vitest worker long enough for its RPC to time out.
const run = promisify(execFile);

/** Every fixture must produce a project that installs, type-checks and builds. */
describe.each(listFixtures())("fixture %s", (name) => {
  it("generates a React project that builds", async () => {
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
    await run("npm", ["install", "--no-audit", "--no-fund", "--prefer-offline", "--loglevel=error"], { cwd: dir, env: userEnv });
    try {
      await run("npm", ["run", "build"], { cwd: dir, env: { ...userEnv, NODE_ENV: "production" } });
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string };
      throw new Error(`Build failed for ${name}:\n${e.stdout}\n${e.stderr}`);
    }
  }, 300_000);
});
