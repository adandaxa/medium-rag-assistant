import { NextResponse } from "next/server";
import { CHUNK_SIZE, OVERLAP_RATIO, TOP_K } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    chunk_size: CHUNK_SIZE,
    overlap_ratio: OVERLAP_RATIO,
    top_k: TOP_K,
  });
}
