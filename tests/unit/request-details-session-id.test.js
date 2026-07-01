import { describe, expect, it } from "vitest";
import { prepareRequestDetailRecordForTest } from "@/lib/db/repos/requestDetailsRepo.js";

describe("request detail session id persistence", () => {
  it("keeps top-level session id when request body is truncated", () => {
    const record = prepareRequestDetailRecordForTest({
      id: "detail-1",
      provider: "codex",
      model: "gpt-5.5",
      connectionId: "conn-1",
      timestamp: "2026-07-01T00:00:00.000Z",
      status: "success",
      sessionId: "session-1",
      request: { sessionId: "session-1", input: [{ content: "x".repeat(200) }] },
    }, { maxJsonSize: 50 });

    expect(record.sessionId).toBe("session-1");
    expect(record.request._truncated).toBe(true);
  });
});
