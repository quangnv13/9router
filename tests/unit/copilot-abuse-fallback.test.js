import { describe, expect, it, vi } from "vitest";

import { checkFallbackError } from "../../open-sse/services/accountFallback.js";
import { handleComboChat } from "../../open-sse/services/combo.js";

describe("Copilot anti-abuse fallback", () => {
  it("does not fallback on abnormal behavior errors", () => {
    expect(checkFallbackError(422, "abnormal behavior detected")).toEqual({
      shouldFallback: false,
      cooldownMs: 0,
    });
  });

  it("stops combo fallback on abnormal behavior errors", async () => {
    const handleSingleModel = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "abnormal behavior detected" } }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      })
    );

    const response = await handleComboChat({
      body: { messages: [{ role: "user", content: "hi" }] },
      models: ["github/gpt-5", "github/claude-sonnet"],
      handleSingleModel,
      log: { info: vi.fn(), warn: vi.fn() },
      comboName: "copilot-combo",
    });

    expect(response.status).toBe(422);
    expect(handleSingleModel).toHaveBeenCalledTimes(1);
  });

  it("still falls back on transient 503 errors", async () => {
    const handleSingleModel = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "overloaded" } }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const response = await handleComboChat({
      body: { messages: [{ role: "user", content: "hi" }] },
      models: ["github/gpt-5", "openai/gpt-5"],
      handleSingleModel,
      log: { info: vi.fn(), warn: vi.fn() },
      comboName: "transient-combo",
    });

    expect(response.status).toBe(200);
    expect(handleSingleModel).toHaveBeenCalledTimes(2);
  });
});
