import "./loadEnv";

import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { openai, pinecone } from "../lib/clients";
import { chunkByTokens, countTokens } from "../lib/chunking";
import {
  EMBED_MODEL,
  EMBED_DIM,
  PINECONE_INDEX_NAME,
  CHUNK_SIZE,
  OVERLAP_RATIO,
} from "../lib/config";

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const csvPath = argValue("--csv") ?? "./medium-english-50mb.csv";
const limit = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : undefined;
const namespace = argValue("--namespace");

// ── Helpers ─────────────────────────────────────────────────────────────────
function parsePythonList(s: string): string[] {
  const matches = s.match(/'([^']*)'/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

interface Row {
  title: string;
  text: string;
  url: string;
  authors: string;
  timestamp: string;
  tags: string;
}

// ── Index bootstrap ──────────────────────────────────────────────────────────
async function ensureIndex(): Promise<void> {
  const list = await pinecone.listIndexes();
  const exists = list.indexes?.some((i) => i.name === PINECONE_INDEX_NAME) ?? false;

  if (!exists) {
    console.log(`Creating Pinecone index "${PINECONE_INDEX_NAME}" …`);
    await pinecone.createIndex({
      name: PINECONE_INDEX_NAME,
      dimension: EMBED_DIM,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
      waitUntilReady: true,
    });
    console.log("Index ready.");
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Reading CSV: ${csvPath}`);
  const raw = readFileSync(csvPath, "utf-8");
  let records: Row[] = parse(raw, {
    columns: true,
    relax_quotes: true,
    skip_empty_lines: true,
  }) as Row[];

  if (limit !== undefined) {
    records = records.slice(0, limit);
    console.log(`Limited to ${records.length} articles.`);
  } else {
    console.log(`Articles: ${records.length}`);
  }

  await ensureIndex();

  const target = pinecone.index(PINECONE_INDEX_NAME).namespace(namespace ?? "");

  // Build all chunk records first (to compute cost estimate)
  interface ChunkRecord {
    id: string;
    text: string;
    metadata: {
      article_id: string;
      title: string;
      author: string;
      url: string;
      chunk: string;
    };
  }

  const allChunks: ChunkRecord[] = [];
  let totalTokens = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const authors = parsePythonList(row.authors ?? "");
    const author = authors[0] ?? "";
    const chunks = chunkByTokens(row.text ?? "", CHUNK_SIZE, OVERLAP_RATIO);

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      totalTokens += countTokens(chunk);
      allChunks.push({
        id: `${i}-${ci}`,
        text: chunk,
        metadata: {
          article_id: String(i),
          title: row.title ?? "",
          author,
          url: row.url ?? "",
          chunk,
        },
      });
    }
  }

  console.log(`Total chunks: ${allChunks.length}`);
  console.log(
    `Estimated embedding cost: $${((totalTokens / 1e6) * 0.02).toFixed(4)}`,
  );

  // Embed + upsert in batches of 100. Resumable: if every id in a batch is
  // already present in Pinecone (free fetch), skip the paid embed + upsert.
  const BATCH = 100;
  let skipped = 0;
  for (let i = 0; i < allChunks.length; i += BATCH) {
    const batch = allChunks.slice(i, i + BATCH);
    const done = Math.min(i + BATCH, allChunks.length);

    const existing = await target.fetch(batch.map((r) => r.id));
    const allPresent = batch.every((r) => existing.records?.[r.id]);
    if (allPresent) {
      skipped += batch.length;
      process.stdout.write(
        `\rSkipped ${done} / ${allChunks.length} (already indexed)`,
      );
      continue;
    }

    const embRes = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: batch.map((r) => r.text),
    });

    const vectors = batch.map((r, j) => ({
      id: r.id,
      values: embRes.data[j].embedding,
      metadata: r.metadata,
    }));

    await target.upsert(vectors);

    process.stdout.write(`\rUpserted ${done} / ${allChunks.length} chunks`);
  }

  console.log(
    `\nIngestion complete.${skipped ? ` (${skipped} chunks skipped as already indexed)` : ""}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
