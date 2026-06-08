import { openai, pineconeTarget } from "./clients";
import { EMBED_MODEL, CHAT_MODEL, TOP_K } from "./config";

export const SYSTEM_PROMPT =
  `You are a Medium-article assistant that answers questions strictly and only based on the Medium articles dataset context provided to you (metadata and article passages). You must not use any external knowledge, the open internet, or information that is not explicitly contained in the retrieved context. If the answer cannot be determined from the provided context, respond: "I don't know based on the provided Medium articles data." Always explain your answer using the given context, quoting or paraphrasing the relevant article passage or metadata when helpful.

Answer concisely. When asked to "list exactly N articles", return N DISTINCT articles (different titles), not multiple passages from one article. Label each retrieved passage in the user prompt with its article_id/title/author.`;

export interface ContextItem {
  article_id: string;
  title: string;
  chunk: string;
  score: number;
}

export async function retrieve(
  question: string,
  ns?: string,
): Promise<ContextItem[]> {
  const embRes = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: question,
  });
  const vector = embRes.data[0].embedding;

  const results = await pineconeTarget(ns).query({
    vector,
    topK: TOP_K,
    includeMetadata: true,
  });

  return (results.matches ?? []).map((m) => ({
    article_id: String(m.metadata?.article_id ?? ""),
    title: String(m.metadata?.title ?? ""),
    chunk: String(m.metadata?.chunk ?? ""),
    score: m.score ?? 0,
  }));
}

export function buildUserPrompt(
  question: string,
  context: ContextItem[],
): string {
  const passages = context
    .map(
      (c, i) =>
        `[${i + 1}] article_id=${c.article_id} | title="${c.title}"\n${c.chunk}`,
    )
    .join("\n\n");
  return `Context:\n${passages}\n\nQuestion: ${question}`;
}

export async function answer(question: string, ns?: string) {
  const context = await retrieve(question, ns);
  const userPrompt = buildUserPrompt(question, context);

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: userPrompt },
    ],
    // gpt-5 reasoning tokens count against this budget; keep it high enough
    // that the visible answer survives after internal reasoning.
    max_completion_tokens: 4096,
  });

  return {
    response: completion.choices[0].message.content ?? "",
    context,
    Augmented_prompt: {
      System: SYSTEM_PROMPT,
      User: userPrompt,
    },
  };
}
