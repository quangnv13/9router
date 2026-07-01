import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getProviderCredentials: vi.fn(),
  markAccountUnavailable: vi.fn(),
  clearAccountError: vi.fn(),
  extractApiKey: vi.fn(),
  isValidApiKey: vi.fn(),
  getModelInfo: vi.fn(),
  getComboModels: vi.fn(),
  handleChatCore: vi.fn(),
  checkAndRefreshToken: vi.fn(),
  updateProviderCredentials: vi.fn(),
  handleBypassRequest: vi.fn(),
  applySessionModelOverride: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({ getSettings: mocks.getSettings }));
vi.mock("@/sse/services/auth.js", () => ({
  getProviderCredentials: mocks.getProviderCredentials,
  markAccountUnavailable: mocks.markAccountUnavailable,
  clearAccountError: mocks.clearAccountError,
  extractApiKey: mocks.extractApiKey,
  isValidApiKey: mocks.isValidApiKey,
}));
vi.mock("@/sse/services/model.js", () => ({
  getModelInfo: mocks.getModelInfo,
  getComboModels: mocks.getComboModels,
}));
vi.mock("open-sse/handlers/chatCore.js", () => ({ handleChatCore: mocks.handleChatCore }));
vi.mock("@/sse/services/tokenRefresh.js", () => ({
  checkAndRefreshToken: mocks.checkAndRefreshToken,
  updateProviderCredentials: mocks.updateProviderCredentials,
}));
vi.mock("open-sse/utils/bypassHandler.js", () => ({ handleBypassRequest: mocks.handleBypassRequest }));
vi.mock("open-sse/utils/claudeHeaderCache.js", () => ({ cacheClaudeHeaders: vi.fn() }));
vi.mock("open-sse/utils/sessionModelOverride.js", () => ({
  applySessionModelOverride: mocks.applySessionModelOverride,
}));

const { handleChat } = await import("../../src/sse/handlers/chat.js");

function makeRequest(model) {
  return new Request("https://router.test/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }] }),
  });
}

describe("model switcher override", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({
      requireApiKey: false,
      modelSwitcherEnabled: true,
      modelSwitcherOverride: "openai/gpt-4o-mini",
    });
    mocks.extractApiKey.mockReturnValue(null);
    mocks.getComboModels.mockResolvedValue(null);
    mocks.getModelInfo.mockReturnValue({ provider: "openai", model: "gpt-4o-mini" });
    mocks.getProviderCredentials.mockResolvedValue({
      connectionId: "openai-1",
      connectionName: "OpenAI",
      apiKey: "sk-test",
      providerSpecificData: {},
    });
    mocks.checkAndRefreshToken.mockImplementation((_provider, credentials) => credentials);
    mocks.clearAccountError.mockResolvedValue();
    mocks.applySessionModelOverride.mockImplementation(async (body) => ({ body, model: body.model, sessionId: null, overrideModel: null }));
    mocks.handleChatCore.mockResolvedValue({ success: true, response: Response.json({ ok: true }) });
  });

  it("routes chat requests through the configured override model", async () => {
    const response = await handleChat(makeRequest("anthropic/claude-sonnet-4"));

    expect(response.status).toBe(200);
    expect(mocks.getModelInfo).toHaveBeenCalledWith("openai/gpt-4o-mini");
    expect(mocks.getProviderCredentials).toHaveBeenCalledWith("openai", expect.any(Set), "gpt-4o-mini");
    expect(mocks.handleChatCore).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ model: "openai/gpt-4o-mini" }),
        modelInfo: { provider: "openai", model: "gpt-4o-mini" },
      })
    );
  });

  it("lets a session override beat the global model switcher", async () => {
    mocks.applySessionModelOverride.mockImplementation(async (body) => ({
      body: { ...body, model: "anthropic/claude-opus-4" },
      model: "anthropic/claude-opus-4",
      sessionId: "session-1",
      overrideModel: "anthropic/claude-opus-4",
    }));
    mocks.getModelInfo.mockReturnValue({ provider: "anthropic", model: "claude-opus-4" });
    mocks.getProviderCredentials.mockResolvedValue({
      connectionId: "anthropic-1",
      connectionName: "Anthropic",
      apiKey: "sk-test",
      providerSpecificData: {},
    });

    const response = await handleChat(makeRequest("openai/gpt-4o-mini"));

    expect(response.status).toBe(200);
    expect(mocks.getModelInfo).toHaveBeenCalledWith("anthropic/claude-opus-4");
    expect(mocks.handleChatCore).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ model: "anthropic/claude-opus-4" }),
        clientRawRequest: expect.objectContaining({ sessionId: "session-1" }),
      })
    );
  });
});