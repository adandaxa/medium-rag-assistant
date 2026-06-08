# Medium RAG Assistant — Build Spec & Operating Rules (CLAUDE.md)

You (Claude Code) are building and helping deploy a complete Retrieval-Augmented
Generation system over ~7,682 English Medium articles (single CSV:
`medium-english-50mb.csv`, columns: `title, text, url, authors, timestamp, tags`).
The assistant must answer **only** from retrieved dataset context — never from
external knowledge.

---

## 0. Responsibilities (read first)

### Claude Code OWNS
- Scaffolding the Next.js 14 + TypeScript project and installing dependencies.
- Writing every file in the manifest, matching the EXACT contracts below.
- Local type-checking / `next build`, and fixing build/type errors.
- Debugging runtime errors when I report them.
- Writing the README and `.env.example`.
- Guiding and (with my explicit approval) running git + Vercel deploy commands.

### Claude Code MUST NOT (without my explicit "go ahead")
- Run the ingestion script or any other PAID API call (embeddings / chat). These
  cost my limited $5 budget. Stop and ask first.
- Re-embed the corpus when only `top_k` changed (top_k is query-time only).
- Commit or print secrets (.env.local, API keys).
- Change the graded contracts (JSON shapes, system prompt, key casing,
  the reported hyperparameters) without telling me.

### I (the human) OWN
- Providing accounts/keys: LLMod.ai, Pinecone, Vercel, GitHub.
- Placing `medium-english-50mb.csv` in the project root.
- Reviewing the code before any paid run.
- Filling `.env.local`.
- Approving and triggering paid ingestion.
- Final submission (live URL + public GitHub URL) and keeping the Pinecone index
  active until graded.

---

## 1. Tech stack
- Next.js 14 (App Router) + TypeScript. Deploy target: Vercel.
- Vector DB: Pinecone.
- Models via LLMod.ai (OpenAI-compatible proxy) using the `openai` npm SDK.

## 2. Dependencies
- deps: `next@14`, `react`, `react-dom`, `openai`, `@pinecone-database/pinecone`, `js-tiktoken`
- devDeps: `typescript`, `@types/node`, `@types/react`, `tsx`, `csv-parse`, `dotenv`

## 3. Models (env-overridable; defaults below)
- Embedding: `4UHRUIN-text-embedding-3-small` (output dim 1536)
- Chat: `4UHRUIN-gpt-5-mini`
- gpt-5 uses `max_completion_tokens` (NOT `max_tokens`) and rejects a custom
  temperature — do not set temperature.

## 4. Pinecone
- Index `medium-rag`, dimension **1536**, metric **cosine**.
- Vector id = `${article_id}-${chunkIndex}`.
- Metadata per vector: `{ article_id, title, author, url, chunk }`.

## 5. Hyperparameters — define ONCE in `lib/config.ts`; `/api/stats` reads them
- `chunk_size = 512` (tokens, cl100k_base via js-tiktoken; cap 1024)
- `overlap_ratio = 0.15` (cap 0.3)
- `top_k = 10` (cap 30)

## 6. Data handling rules
- `article_id` = CSV row index (there is no id column).
- `authors` and `tags` are Python-list strings like `"['Ryan Fan']"` → parse names.
- Chunk `text` by tokens (512 size, 15% overlap) via a sliding window over the
  token array, decoding each slice back to text.

## 7. File manifest (create all)
- `lib/config.ts` — CHUNK_SIZE, OVERLAP_RATIO, TOP_K, EMBED_DIM, model + index names.
- `lib/clients.ts` — `openai` (baseURL=LLMOD_BASE_URL, apiKey=LLMOD_API_KEY) and
  `pinecone`; a `pineconeTarget(ns?)` helper (uses a namespace only if set).
- `lib/chunking.ts` — `chunkByTokens()` and `countTokens()` using cl100k_base.
- `lib/rag.ts` — SYSTEM_PROMPT (verbatim, section 9), `buildUserPrompt()`,
  `retrieve()` (embed question → Pinecone query topK), `answer()` (assemble payload).
- `app/api/prompt/route.ts` — POST handler (exact contract, section 8).
- `app/api/stats/route.ts` — GET handler returning the three hyperparameters.
- `scripts/loadEnv.ts` — preloads `.env.local` then `.env` (imported FIRST by scripts).
- `scripts/ingest.ts` — offline indexer (section 10).
- `app/layout.tsx`, `app/page.tsx` — minimal; landing page lists the two endpoints.
- `.env.example`, `.gitignore` (ignore `.env*`, `node_modules`, `.next`, the CSV),
  `next.config.js`, `tsconfig.json`, `README.md`.

## 8. EXACT CONTRACTS (graded — match precisely)

### `POST /api/prompt` — body `{ "question": string }`
```json
{
  "response": "final answer from gpt-5-mini",
  "context": [
    { "article_id": "1234", "title": "...", "chunk": "...", "score": 0.1234 }
  ],
  "Augmented_prompt": {
    "System": "the system prompt sent to the chat model",
    "User": "the user prompt sent to the chat model"
  }
}
```
- `context` = the top_k chunks actually retrieved (with their scores).
- Key casing exactly: `Augmented_prompt`, `System`, `User`.

### `GET /api/stats` — returns exactly:
```json
{ "chunk_size": 512, "overlap_ratio": 0.15, "top_k": 10 }
```

## 9. Required SYSTEM_PROMPT (verbatim; may append a short style note, don't weaken)
```
You are a Medium-article assistant that answers questions strictly and only based on the Medium articles dataset context provided to you (metadata and article passages). You must not use any external knowledge, the open internet, or information that is not explicitly contained in the retrieved context. If the answer cannot be determined from the provided context, respond: "I don't know based on the provided Medium articles data." Always explain your answer using the given context, quoting or paraphrasing the relevant article passage or metadata when helpful.
```
Append (allowed): answer concisely; when asked to "list exactly N articles", return
N DISTINCT articles (different titles), not multiple passages from one article.
Label each retrieved passage in the user prompt with its article_id/title/author.

## 10. Ingestion (`scripts/ingest.ts`) — offline, run ONCE per chunk config
- First line: `import "./loadEnv";` (so `.env.local` loads before clients build).
- Flags: `--csv <path>` (default `./medium-english-50mb.csv`), `--limit <n>`,
  `--namespace <ns>`.
- Read CSV (csv-parse/sync, `columns:true`, `relax_quotes:true`).
- For each article: build chunks → records `{ id, values(after embed), metadata }`.
- Embed in batches of 100; upsert in batches of 100.
- Ensure the index exists (create serverless aws/us-east-1 if missing).
- Print chunk count + estimated embedding cost (tokens/1e6 * $0.02) + progress.

## 11. Runtime constraints (Vercel)
- Both routes: `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
- `app/api/prompt/route.ts`: also `export const maxDuration = 60`.

## 12. Cost discipline (budget = $5; full embed ≈ $0.25)
- Only real risk is RE-embedding. Validate on `--limit 200 --namespace test200`
  before the full run. `top_k` changes never require re-ingesting.

## 13. Env vars
`LLMOD_BASE_URL`, `LLMOD_API_KEY`, `PINECONE_API_KEY`;
optional: `LLMOD_EMBED_MODEL`, `LLMOD_CHAT_MODEL`, `PINECONE_INDEX`, `PINECONE_NAMESPACE`.

## 14. Build order
1. Scaffold project + config files + install deps.
2. `lib/*`, then the two routes.
3. `scripts/loadEnv.ts` + `scripts/ingest.ts`.
4. Run `npx next build` to confirm it type-checks. Fix errors.
5. STOP. Do not run any paid API call until I review and add my keys.

## 15. Deployment (run only with my approval)
```bash
git add .
git commit -m "Medium RAG assistant"
git push -u origin main
```
Then: `npx vercel` (or import the repo in the Vercel dashboard). Set env vars
`LLMOD_BASE_URL`, `LLMOD_API_KEY`, `PINECONE_API_KEY` in Vercel → Settings →
Environment Variables → redeploy.

## 16. Acceptance tests (after keys + a subset ingest)
```bash
curl http://localhost:3000/api/stats
curl -X POST http://localhost:3000/api/prompt -H "Content-Type: application/json" \
  -d '{"question":"List exactly 3 articles about education. Return only the titles."}'
```
Check: stats has exactly 3 fields; prompt response has `response`, `context[]` with
`article_id/title/chunk/score`, and `Augmented_prompt.System` + `.User`; the
"list 3" answer names 3 DISTINCT titles.
