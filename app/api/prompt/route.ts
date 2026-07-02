import { NextRequest, NextResponse } from "next/server";
import { answer } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question } = body as { question?: unknown };

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "question is required and must be a string" },
        { status: 400 },
      );
    }

    const result = await answer(question);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
