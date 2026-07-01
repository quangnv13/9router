import { describe, expect, it } from "vitest";

import { openaiToOpenAIResponsesResponse } from "../../open-sse/translator/response/openai-responses.js";

function createState() {
  return {
    seq: 0,
    responseId: "resp_test",
    created: 1,
    started: false,
    msgTextBuf: {},
    msgItemAdded: {},
    msgContentAdded: {},
    msgItemDone: {},
    reasoningId: "",
    reasoningIndex: -1,
    reasoningBuf: "",
    reasoningPartAdded: false,
    reasoningDone: false,
    inThinking: false,
    funcArgsBuf: {},
    funcNames: {},
    funcCallIds: {},
    funcArgsDone: {},
    funcItemDone: {},
    completedSent: false,
  };
}

function translateAll(chunks) {
  const state = createState();
  return chunks.flatMap((chunk) => openaiToOpenAIResponsesResponse(chunk, state));
}

describe("OpenAI Responses tool-call stream regression", () => {
  it("emits a complete function_call item when upstream tool deltas omit id", () => {
    const events = translateAll([
      {
        id: "chatcmpl_tool",
        choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { name: "list_dir" } }] }, finish_reason: null }],
      },
      {
        id: "chatcmpl_tool",
        choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"path":"/"}' } }] }, finish_reason: null }],
      },
      {
        id: "chatcmpl_tool",
        choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
      },
    ]);

    const added = events.find((entry) => entry.event === "response.output_item.added" && entry.data.item?.type === "function_call");
    const argDelta = events.find((entry) => entry.event === "response.function_call_arguments.delta");
    const argsDone = events.find((entry) => entry.event === "response.function_call_arguments.done");
    const itemDone = events.find((entry) => entry.event === "response.output_item.done" && entry.data.item?.type === "function_call");
    const completed = events.find((entry) => entry.event === "response.completed");

    expect(added?.data.item.call_id).toBeTruthy();
    expect(added?.data.item.name).toBe("list_dir");
    expect(argDelta?.data.delta).toBe('{"path":"/"}');
    expect(argsDone?.data.arguments).toBe('{"path":"/"}');
    expect(itemDone?.data.item.call_id).toBe(added.data.item.call_id);
    expect(itemDone?.data.item.name).toBe("list_dir");
    expect(completed?.data.response.output).toEqual([itemDone.data.item]);
  });
});
