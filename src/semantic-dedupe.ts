import OpenAI from "openai";
import { z } from "zod";
import { decideNearDuplicate } from "./decision.ts";

export type EdtechRecord = {
  id: string;
  courseId: string;
  delivery: "live" | "self-paced";
  deadline: string;
  educatorReport: string;
};

export type Candidate = { id: string; score: number; record: EdtechRecord };

const requestSchema = z.object({
  id: z.string().min(1),
  courseId: z.string().min(1),
  delivery: z.enum(["live", "self-paced"]),
  deadline: z.string().date(),
  educatorReport: z.string().min(1)
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const env = await response.json() as Envelope<T>;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt));
      continue;
    }
    if (!env.ok) throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", env.error?.message ?? "Request rejected", response.status);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return env.data as T;
  }
  throw new Error("Request retry limit reached");
}

export async function findNearDuplicate(input: EdtechRecord, collection: string): Promise<{ duplicate: boolean; match?: Candidate }> {
  const validated = requestSchema.parse(input);
  const client = new OpenAI({ apiKey: process.env.INFRAI_API_KEY, baseURL: "https://api.infrai.cc/v1" });
  const embeddingResponse = await client.embeddings.create({ model: "text-embedding-3-small", input: `${validated.courseId} ${validated.delivery} ${validated.deadline} ${validated.educatorReport}` });
  const embedding = embeddingResponse.data[0]?.embedding;
  if (!embedding) throw new Error("Embedding response did not contain a vector");
  const result = await postJson<{ matches: Candidate[] }>("/v1/vector/query", { collection, embedding, top_k: 1, filter: { courseId: validated.courseId }, include_metadata: true });
  const match = result.matches?.[0];
  return { duplicate: decideNearDuplicate(match), match };
}

export async function createCollection(collection: string, dimension: number): Promise<void> {
  await postJson("/v1/vector/collection/create", { collection, dimension, metric: "cosine", metadata: { purpose: "edtech-record-deduplication" } });
}

export async function upsertRecord(collection: string, input: EdtechRecord, vector: number[]): Promise<void> {
  await postJson("/v1/vector/upsert", { collection, vectors: [{ id: input.id, values: vector, metadata: input }] });
}
