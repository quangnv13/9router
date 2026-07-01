import { beforeEach, describe, expect, it, vi } from "vitest";

let rows = [];
let overrideRows = {};

vi.mock("@/lib/db/driver.js", () => ({
  getAdapter: vi.fn(async () => ({
    all: vi.fn((sql) => {
      if (sql.includes("requestDetails")) return rows;
      return [];
    }),
  })),
}));

vi.mock("@/lib/db/helpers/kvStore.js", () => ({
  makeKv: vi.fn(() => ({
    getAll: vi.fn(async () => overrideRows),
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  })),
}));

const { getAgentSessions } = await import("../../src/lib/db/repos/agentSessionRepo.js");

describe("agent session repo", () => {
  beforeEach(() => {
    vi.useRealTimers();
    rows = [];
    overrideRows = {};
  });

  it("lists sessions persisted in request details", async () => {
    vi.setSystemTime(new Date("2026-01-01T00:10:00.000Z"));
    rows = [{
      data: JSON.stringify({
        timestamp: "2026-01-01T00:00:00.000Z",
        model: "m",
        provider: "p",
        request: { sessionId: "saved-session", messages: [{ role: "user", content: "hello" }] },
      }),
    }];

    const sessions = await getAgentSessions();

    expect(sessions).toMatchObject([{ sessionId: "saved-session", model: "m", provider: "p", requestCount: 1, contextPreview: "hello" }]);
  });

  it("lists override-only sessions", async () => {
    overrideRows = { "manual-session": "openai/gpt-4o-mini" };

    const sessions = await getAgentSessions();

    expect(sessions).toEqual([{
      sessionId: "manual-session",
      model: null,
      overrideModel: "openai/gpt-4o-mini",
      provider: null,
      connectionId: null,
      lastSeen: null,
      requestCount: 0,
      tokens: {},
      contextPreview: "",
    }]);
  });

  it("hides sessions idle for more than 30 minutes", async () => {
    vi.setSystemTime(new Date("2026-01-01T01:00:00.000Z"));
    rows = [
      { data: JSON.stringify({ timestamp: "2026-01-01T00:20:00.000Z", model: "old", request: { sessionId: "old-session" } }) },
      { data: JSON.stringify({ timestamp: "2026-01-01T00:40:00.000Z", model: "fresh", request: { sessionId: "fresh-session" } }) },
    ];

    const sessions = await getAgentSessions();

    expect(sessions.map((session) => session.sessionId)).toEqual(["fresh-session"]);
  });
});
