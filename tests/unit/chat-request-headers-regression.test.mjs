import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/sse/handlers/chat.js", "utf8");
const helperStart = source.indexOf("async function handleSingleModelChat");
assert.notEqual(helperStart, -1, "handleSingleModelChat exists");
const helperEnd = source.indexOf("\n    // Ensure real project ID", helperStart);
assert.notEqual(helperEnd, -1, "session-id block marker exists");
const helperPrefix = source.slice(helperStart, helperEnd);

assert.match(helperPrefix, /const requestHeaders\s*=/, "handleSingleModelChat defines local requestHeaders");
assert.match(helperPrefix, /clientRawRequest\?\.headers/, "local requestHeaders prefers clientRawRequest.headers");
assert.match(helperPrefix, /Object\.fromEntries\(request\.headers\.entries\(\)\)/, "local requestHeaders falls back to request.headers");
assert.match(helperPrefix, /headers:\s*requestHeaders/, "resolveSessionId uses local requestHeaders");
