import { NextResponse } from "next/server";
import {
  clearAgentSessionModelOverride,
  getAgentSessionModelOverride,
  setAgentSessionModelOverride,
} from "@/lib/db/index.js";
import { cleanOverrideModel, cleanSessionId } from "@/lib/db/repos/agentSessionRepo.js";
import { getComboModels, getModelInfo } from "@/sse/services/model.js";
import { clearSessionModelOverrideCache } from "open-sse/utils/sessionModelOverride.js";

async function getSessionId(params) {
  const resolved = await params;
  return cleanSessionId(String(resolved?.sessionId || ""));
}

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function isKnownModel(model) {
  if (await getComboModels(model)) return true;
  const modelInfo = await getModelInfo(model);
  return !!modelInfo?.provider;
}

export async function GET(_request, { params }) {
  const sessionId = await getSessionId(params);
  if (!sessionId) return badRequest("sessionId must be a non-empty string up to 256 chars");

  try {
    const model = cleanOverrideModel(await getAgentSessionModelOverride(sessionId));
    return NextResponse.json({ sessionId, model });
  } catch (error) {
    console.error("[API] Failed to get agent session model override:", error);
    return NextResponse.json({ error: "Failed to fetch agent session model override" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const sessionId = await getSessionId(params);
  if (!sessionId) return badRequest("sessionId must be a non-empty string up to 256 chars");

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const model = cleanOverrideModel(body?.model);
  if (!model) return badRequest("model must be a non-empty string up to 256 chars");
  if (!(await isKnownModel(model))) return badRequest("model must be a known model or combo");

  try {
    await setAgentSessionModelOverride(sessionId, model);
    clearSessionModelOverrideCache(sessionId);
    return NextResponse.json({ sessionId, model });
  } catch (error) {
    console.error("[API] Failed to set agent session model override:", error);
    return NextResponse.json({ error: "Failed to set agent session model override" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const sessionId = await getSessionId(params);
  if (!sessionId) return badRequest("sessionId must be a non-empty string up to 256 chars");

  try {
    await clearAgentSessionModelOverride(sessionId);
    clearSessionModelOverrideCache(sessionId);
    return NextResponse.json({ sessionId, model: null });
  } catch (error) {
    console.error("[API] Failed to clear agent session model override:", error);
    return NextResponse.json({ error: "Failed to clear agent session model override" }, { status: 500 });
  }
}