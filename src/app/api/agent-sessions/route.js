import { NextResponse } from "next/server";
import { getAgentSessions } from "@/lib/db/index.js";

export async function GET() {
  try {
    const sessions = await getAgentSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[API] Failed to get agent sessions:", error);
    return NextResponse.json({ error: "Failed to fetch agent sessions" }, { status: 500 });
  }
}
