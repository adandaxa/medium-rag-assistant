import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { PINECONE_INDEX_NAME } from "./config";

export const openai = new OpenAI({
  baseURL: process.env.LLMOD_BASE_URL,
  apiKey: process.env.LLMOD_API_KEY ?? "unset",
  timeout: 60_000, // fail a hung request after 60s instead of freezing
  maxRetries: 5, // SDK retries with exponential backoff on timeout/429/5xx
});

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY ?? "unset",
});

/**
 * Returns a namespace-scoped index target. Precedence: explicit `ns` arg >
 * PINECONE_NAMESPACE env > default ("" = default namespace).
 */
export function pineconeTarget(ns?: string) {
  const namespace = ns ?? process.env.PINECONE_NAMESPACE ?? "";
  return pinecone.index(PINECONE_INDEX_NAME).namespace(namespace);
}
