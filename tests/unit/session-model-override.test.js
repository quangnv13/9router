import { beforeEach, describe, expect, it, vi } from "vitest";

const kv = {
  get: vi.fn(),
};

vi.mock("@/lib/db/helpers/kvStore.js", () => ({
  makeKv: vi.fn(() => kv),
}));

const { applySessionModelOverride, clearSessionModelOverrideCache } = await import("../../open-sse/utils/sessionModelOverride.js");

describe("session model override", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSessionModelOverrideCache();
    kv.get.mockResolvedValue(null);
  });

  it("returns original model when no override exists", async () => {
    const body = { model: "anthropic/claude-sonnet-4", messages: [] };

    const result = await applySessionModelOverride(body, {
      headers: { "x-session-id": "session-1" },
    });

    expect(result.body).toBe(body);
    expect(result.model).toBe("anthropic/claude-sonnet-4");
  });

  it("replaces body.model when session override exists without mutating metadata", async () => {
    kv.get.mockResolvedValue("openai/gpt-4o-mini");
    const body = { model: "anthropic/claude-sonnet-4", messages: [], metadata: { user_id: "u1" } };

    const result = await applySessionModelOverride(body, {
      headers: { "x-session-id": "session-1" },
    });

    expect(result.body).toEqual({ model: "openai/gpt-4o-mini", messages: [], metadata: { user_id: "u1" } });
    expect(body).toEqual({ model: "anthropic/claude-sonnet-4", messages: [], metadata: { user_id: "u1" } });
    expect(result.model).toBe("openai/gpt-4o-mini");
    expect(result.sessionId).toBe("session-1");
  });

  it("ignores invalid or missing session ids", async () => {
    const body = { model: "anthropic/claude-sonnet-4", messages: [] };

    const missing = await applySessionModelOverride(body, { headers: {} });
    const invalid = await applySessionModelOverride(body, {
      headers: { "x-session-id": " ".repeat(300) },
    });

    expect(missing.body).toBe(body);
    expect(invalid.body).toBe(body);
    expect(kv.get).not.toHaveBeenCalled();
  });
});
