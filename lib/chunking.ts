import { getEncoding } from "js-tiktoken";

const enc = getEncoding("cl100k_base");

export function countTokens(text: string): number {
  return enc.encode(text).length;
}

export function chunkByTokens(
  text: string,
  chunkSize: number,
  overlapRatio: number,
): string[] {
  const tokens = enc.encode(text);
  if (tokens.length === 0) return [text];

  const overlap = Math.floor(chunkSize * overlapRatio);
  const step = chunkSize - overlap;
  const chunks: string[] = [];

  for (let i = 0; i < tokens.length; i += step) {
    const slice = tokens.slice(i, i + chunkSize);
    chunks.push(enc.decode(slice));
    if (i + chunkSize >= tokens.length) break;
  }

  return chunks.length > 0 ? chunks : [text];
}
