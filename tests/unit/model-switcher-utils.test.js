import { describe, expect, it } from "vitest";
import { buildActiveProviderKeys, filterModelSwitcherModels } from "@/app/(dashboard)/dashboard/model-switcher/modelSwitcherUtils.js";

describe("model switcher utils", () => {
  it("matches active provider ids to model aliases", () => {
    const keys = buildActiveProviderKeys([
      { provider: "codex", isActive: true },
      { provider: "antigravity", isActive: true },
      { provider: "openai", isActive: false },
    ]);

    expect(keys.has("codex")).toBe(true);
    expect(keys.has("cx")).toBe(true);
    expect(keys.has("antigravity")).toBe(true);
    expect(keys.has("ag")).toBe(true);
    expect(keys.has("openai")).toBe(false);
  });

  it("keeps models whose alias belongs to an active provider", () => {
    const keys = buildActiveProviderKeys([{ provider: "codex", isActive: true }]);
    const models = filterModelSwitcherModels([
      { provider: "cx", fullModel: "cx/gpt-5.5" },
      { provider: "ag", fullModel: "ag/gemini-3-flash" },
    ], keys);

    expect(models.map((m) => m.fullModel)).toEqual(["cx/gpt-5.5"]);
  });
});
