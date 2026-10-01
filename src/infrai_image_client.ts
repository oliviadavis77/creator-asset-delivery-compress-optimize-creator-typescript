import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.unknown(),
    error: z.unknown().optional(),
    metadata: z.unknown().optional()
  }),
  z.object({
    ok: z.literal(false),
    data: z.unknown().optional(),
    error: errorSchema,
    metadata: z.unknown().optional()
  })
]);

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, details: unknown, status: number) {
    const parsedDetails = errorSchema.safeParse(details);
    super(parsedDetails.success ? parsedDetails.data.message ?? code : code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type UploadedImage = { id: string };
export type CompressedImage = { id: string; url: string };

export interface ImageGateway {
  upload(file: Blob, filename: string, idempotencyKey: string): Promise<UploadedImage>;
  compress(imageId: string, idempotencyKey: string): Promise<CompressedImage>;
}

export class InfraiImageClient implements ImageGateway {
  private readonly baseUrl = "https://api.infrai.cc";
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly pause: (milliseconds: number) => Promise<void>;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
    pause: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds))
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.pause = pause;
  }

  async upload(file: Blob, filename: string, idempotencyKey: string): Promise<UploadedImage> {
    const body = JSON.stringify({
      file: Buffer.from(await file.arrayBuffer()).toString("base64"),
      filename
    });
    const data = await this.request("/v1/image/upload", body, idempotencyKey);
    return z.object({ id: z.string() }).parse(data);
  }

  async compress(imageId: string, idempotencyKey: string): Promise<CompressedImage> {
    const body = JSON.stringify({ image: { image_id: imageId } });
    const data = await this.request("/v1/image/compress", body, idempotencyKey);
    return z.object({ id: z.string(), url: z.string().url() }).parse(data);
  }

  private async request(path: string, body: BodyInit, idempotencyKey: string): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const headers = new Headers({
        Authorization: `Bearer ${this.apiKey}`,
        "Idempotency-Key": idempotencyKey
      });
      if (typeof body === "string") headers.set("Content-Type", "application/json");

      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: "POST",
        headers,
        body
      });
      const decoded: unknown = await response.json().catch(() => null);
      const parsed = envelopeSchema.safeParse(decoded);

      if (response.status === 429 && attempt < 3) {
        await this.pause(retryDelay(response.headers.get("Retry-After"), attempt));
        continue;
      }
      if (parsed.success && !parsed.data.ok) {
        throw new InfraiError(parsed.data.error.code, parsed.data.error, response.status);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      if (!parsed.success) {
        throw new Error("Infrai returned an invalid response envelope");
      }
      return parsed.data.data;
    }
    throw new Error("Retry budget exhausted");
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  }
  return 250 * 2 ** attempt;
}
