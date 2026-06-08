export const CHUNK_SIZE = 512;       // tokens, cl100k_base; cap 1024
export const OVERLAP_RATIO = 0.15;  // cap 0.3
export const TOP_K = 10;            // cap 30
export const EMBED_DIM = 1536;

export const EMBED_MODEL =
  process.env.LLMOD_EMBED_MODEL ?? "4UHRUIN-text-embedding-3-small";
export const CHAT_MODEL =
  process.env.LLMOD_CHAT_MODEL ?? "4UHRUIN-gpt-5-mini";
export const PINECONE_INDEX_NAME =
  process.env.PINECONE_INDEX ?? "medium-rag";
