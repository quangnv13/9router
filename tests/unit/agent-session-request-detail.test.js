import { describe, expect, it } from "vitest";

import { extractRequestConfig } from "../../open-sse/handlers/chatCore/requestDetail.js";

describe("agent session request detail", () => {
  it("persists resolved explicit session id", () => {
    const config = extractRequestConfig({ model: "m", messages: [] }, true, "resolved-session");

    expect(config.sessionId).toBe("resolved-session");
  });

  it("persists manual body session ids when no resolved id exists", () => {
    const config = extractRequestConfig({ model: "m", sessionId: "manual-session", messages: [] }, true);

    expect(config.sessionId).toBe("manual-session");
  });

  it("persists antigravity request session ids", () => {
    const config = extractRequestConfig({ model: "m", request: { sessionId: "ag-session" } }, true);

    expect(config.sessionId).toBe("ag-session");
  });
});
