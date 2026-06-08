"use client";

import { useState } from "react";

interface ContextItem {
  article_id: string;
  title: string;
  chunk: string;
  score: number;
}

interface PromptResponse {
  response: string;
  context: ContextItem[];
  Augmented_prompt: { System: string; User: string };
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PromptResponse | null>(null);
  const [showContext, setShowContext] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      setResult(data as PromptResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>Medium RAG Assistant</h1>
      <p style={styles.sub}>
        Answers strictly from the retrieved Medium articles dataset.
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about the Medium articles…"
          rows={4}
          style={styles.textarea}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            ...styles.button,
            ...(loading || !question.trim() ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? "Thinking…" : "Submit"}
        </button>
      </form>

      {error && <div style={styles.error}>Error: {error}</div>}

      {result && (
        <section style={styles.results}>
          <div style={styles.responseBox}>{result.response}</div>

          <button
            type="button"
            onClick={() => setShowContext((s) => !s)}
            style={styles.toggle}
          >
            {showContext ? "▾" : "▸"} Retrieved context ({result.context.length})
          </button>

          {showContext && (
            <ul style={styles.contextList}>
              {result.context.map((c, i) => (
                <li key={`${c.article_id}-${i}`} style={styles.contextItem}>
                  <div style={styles.contextTitle}>{c.title || "(untitled)"}</div>
                  <div style={styles.contextMeta}>
                    article_id: {c.article_id} · score: {c.score.toFixed(4)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    maxWidth: 720,
    margin: "0 auto",
    padding: "2rem 1.25rem",
    color: "#1a1a1a",
  },
  h1: { fontSize: "1.6rem", margin: "0 0 0.25rem" },
  sub: { color: "#666", margin: "0 0 1.5rem", fontSize: "0.95rem" },
  form: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  textarea: {
    width: "100%",
    padding: "0.75rem",
    fontSize: "1rem",
    fontFamily: "inherit",
    border: "1px solid #ccc",
    borderRadius: 8,
    resize: "vertical",
    boxSizing: "border-box",
  },
  button: {
    alignSelf: "flex-start",
    padding: "0.6rem 1.4rem",
    fontSize: "1rem",
    color: "#fff",
    background: "#111",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  buttonDisabled: { background: "#999", cursor: "not-allowed" },
  error: {
    marginTop: "1rem",
    padding: "0.75rem",
    background: "#fdecea",
    color: "#b3261e",
    borderRadius: 8,
    fontSize: "0.95rem",
  },
  results: { marginTop: "1.75rem" },
  responseBox: {
    whiteSpace: "pre-wrap",
    lineHeight: 1.55,
    padding: "1rem",
    background: "#f7f7f8",
    border: "1px solid #eee",
    borderRadius: 8,
  },
  toggle: {
    marginTop: "1rem",
    padding: 0,
    background: "none",
    border: "none",
    color: "#0b66c3",
    fontSize: "0.95rem",
    cursor: "pointer",
  },
  contextList: {
    listStyle: "none",
    margin: "0.75rem 0 0",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  contextItem: {
    padding: "0.6rem 0.75rem",
    border: "1px solid #eee",
    borderRadius: 8,
    background: "#fff",
  },
  contextTitle: { fontWeight: 600, fontSize: "0.95rem" },
  contextMeta: { color: "#666", fontSize: "0.8rem", marginTop: "0.2rem" },
};
