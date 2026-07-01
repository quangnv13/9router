import { getAdapter } from "../driver.js";
import { makeKv } from "../helpers/kvStore.js";
import { parseJson } from "../helpers/jsonCol.js";

const OVERRIDE_SCOPE = "agentSessionModelOverrides";
const MAX_MODEL_LENGTH = 256;
const MAX_SESSION_ID_LENGTH = 256;
const MAX_SESSION_ROWS = 500;
const SESSION_IDLE_MS = 30 * 60 * 1000;
const overrides = makeKv(OVERRIDE_SCOPE);

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getSessionId(detail) {
  return firstString(
    detail?.sessionId,
    detail?.request?.sessionId,
    detail?.request?.session_id,
    detail?.request?.metadata?.sessionId,
    detail?.request?.metadata?.session_id,
    detail?.request?.request?.sessionId,
    detail?.request?.request?.session_id,
    detail?.providerRequest?.sessionId,
    detail?.providerRequest?.session_id,
    detail?.providerRequest?.request?.sessionId,
    detail?.providerRequest?.request?.session_id
  );
}

function summarizeTokens(session, detail) {
  const tokens = isObject(detail.tokens) ? detail.tokens : {};
  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      session.tokens[key] = (session.tokens[key] || 0) + value;
    }
  }
}

function readTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (typeof part === "string" ? part : part?.text || part?.input_text || "")).join(" ");
}

function getContextPreview(detail) {
  const messages = Array.isArray(detail?.request?.messages) ? detail.request.messages : [];
  const input = Array.isArray(detail?.request?.input) ? detail.request.input : [];
  const items = messages.length ? messages : input;
  const last = [...items].reverse().find((item) => item?.role === "user") || items[0];
  const text = readTextContent(last?.content);
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

function applyDetail(session, detail) {
  session.requestCount += 1;
  if (!session.lastSeen || detail.timestamp > session.lastSeen) {
    session.model = detail.model || null;
    session.provider = detail.provider || null;
    session.connectionId = detail.connectionId || null;
    session.lastSeen = detail.timestamp || null;
    session.contextPreview = getContextPreview(detail);
  }
  summarizeTokens(session, detail);
}

export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function cleanSessionId(value) {
  if (!isNonEmptyString(value)) return null;
  const sessionId = value.trim();
  return sessionId.length <= MAX_SESSION_ID_LENGTH ? sessionId : null;
}

export function cleanOverrideModel(value) {
  if (!isNonEmptyString(value)) return null;
  const model = value.trim();
  return model.length <= MAX_MODEL_LENGTH ? model : null;
}

export async function getAgentSessions(limit = MAX_SESSION_ROWS) {
  const db = await getAdapter();
  const rowLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_SESSION_ROWS) : MAX_SESSION_ROWS;
  const rows = db.all(`SELECT data FROM requestDetails ORDER BY timestamp DESC LIMIT ?`, [rowLimit]);
  const bySession = new Map();

  for (const row of rows) {
    const detail = parseJson(row.data, {});
    const sessionId = cleanSessionId(getSessionId(detail));
    if (!sessionId) continue;
    if (!bySession.has(sessionId)) {
      bySession.set(sessionId, {
        sessionId,
        model: null,
        overrideModel: null,
        provider: null,
        connectionId: null,
        lastSeen: null,
        requestCount: 0,
        tokens: {},
        contextPreview: "",
      });
    }
    applyDetail(bySession.get(sessionId), detail);
  }

  const overrideModels = await overrides.getAll();
  for (const [sessionId, model] of Object.entries(overrideModels)) {
    const cleanSession = cleanSessionId(sessionId);
    if (!cleanSession || bySession.has(cleanSession)) continue;
    bySession.set(cleanSession, {
      sessionId: cleanSession,
      model: null,
      overrideModel: cleanOverrideModel(model),
      provider: null,
      connectionId: null,
      lastSeen: null,
      requestCount: 0,
      tokens: {},
      contextPreview: "",
    });
  }
  const activeAfter = Date.now() - SESSION_IDLE_MS;
  return [...bySession.values()]
    .filter((session) => !session.lastSeen || new Date(session.lastSeen).getTime() >= activeAfter)
    .map((session) => ({
      ...session,
      overrideModel: cleanOverrideModel(overrideModels[session.sessionId]),
    }));
}

export async function getAgentSessionModelOverride(sessionId) {
  const cleanSession = cleanSessionId(sessionId);
  return cleanSession ? overrides.get(cleanSession, null) : null;
}

export async function setAgentSessionModelOverride(sessionId, model) {
  const cleanSession = cleanSessionId(sessionId);
  const normalized = cleanOverrideModel(model);
  if (!cleanSession) throw new Error("sessionId must be a non-empty string up to 256 chars");
  if (!normalized) throw new Error("model must be a non-empty string up to 256 chars");
  await overrides.set(cleanSession, normalized);
  return normalized;
}

export async function clearAgentSessionModelOverride(sessionId) {
  const cleanSession = cleanSessionId(sessionId);
  if (!cleanSession) throw new Error("sessionId must be a non-empty string up to 256 chars");
  await overrides.remove(cleanSession);
}
