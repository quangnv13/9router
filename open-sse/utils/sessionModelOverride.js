import { makeKv } from "@/lib/db/helpers/kvStore.js";
import { extractClientSessionId } from "./sessionManager.js";

const sessionOverrides = makeKv("agentSessionModelOverrides");
const cache = new Map();
const CACHE_TTL_MS = 5000;

function cleanModel(model) {
  if (typeof model !== "string") return null;
  const value = model.trim();
  return value && value.length <= 256 ? value : null;
}

async function getOverrideModel(sessionId) {
  const now = Date.now();
  const cached = cache.get(sessionId);
  if (cached && cached.expiresAt > now) return cached.model;
  const model = cleanModel(await sessionOverrides.get(sessionId));
  cache.set(sessionId, { model, expiresAt: now + CACHE_TTL_MS });
  return model;
}

export async function applySessionModelOverride(body, { headers } = {}) {
  const sessionId = extractClientSessionId(headers, body);
  const originalModel = body?.model;
  if (!sessionId) return { body, model: originalModel, sessionId: null, overrideModel: null };

  const overrideModel = await getOverrideModel(sessionId);
  if (!overrideModel) return { body, model: originalModel, sessionId, overrideModel: null };

  return {
    body: { ...body, model: overrideModel },
    model: overrideModel,
    sessionId,
    overrideModel,
  };
}

export function clearSessionModelOverrideCache(sessionId) {
  if (sessionId) cache.delete(sessionId);
  else cache.clear();
}
