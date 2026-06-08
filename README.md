# Medium RAG Assistant

RAG system over ~7,682 English Medium articles.

## Setup

1. Copy `.env.example` to `.env.local` and fill in your keys.
2. `medium-english-50mb.csv` must be in the project root.
3. `npm install`

## Ingestion (run once, paid — review first)

```bash
# Validate on a small subset first (~$0.00004):
npm run ingest -- --limit 200 --namespace test200

# Full corpus (~$0.25):
npm run ingest
```

## Local dev

```bash
npm run dev
```

## Endpoints

- `GET  /api/stats` — returns `{ chunk_size, overlap_ratio, top_k }`
- `POST /api/prompt` — body `{ "question": string }` — returns RAG answer

## Acceptance tests

```bash
curl http://localhost:3000/api/stats

curl -X POST http://localhost:3000/api/prompt \
  -H "Content-Type: application/json" \
  -d '{"question":"List exactly 3 articles about education. Return only the titles."}'
```

## Deploy

```bash
git add . && git commit -m "Medium RAG assistant" && git push -u origin main
npx vercel
```

Set `LLMOD_BASE_URL`, `LLMOD_API_KEY`, `PINECONE_API_KEY` in Vercel → Settings → Environment Variables → redeploy.
