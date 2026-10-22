import type { ConversionWarning, WarningLevel } from "./types";

/** Collects warnings once each, so repeated problems in a design produce a single message. */
export class WarningCollector {
  private readonly items = new Map<string, ConversionWarning>();

  add(level: WarningLevel, message: string, screen?: string): void {
    const key = `${level}|${screen ?? ""}|${message}`;
    if (!this.items.has(key)) this.items.set(key, { level, message, screen });
  }

  addAll(warnings: ConversionWarning[]): void {
    for (const w of warnings) this.add(w.level, w.message, w.screen);
  }

  list(): ConversionWarning[] {
    const order: Record<WarningLevel, number> = { error: 0, warning: 1, info: 2 };
    return [...this.items.values()].sort((a, b) => order[a.level] - order[b.level]);
  }
}
