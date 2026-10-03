import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: z.unknown(), metadata: z.unknown().optional() }),
  z.object({ ok: z.literal(false), error: errorSchema, metadata: z.unknown().optional() })
]);

const balanceSchema = z.object({ balance: z.number() });
const messageSchema = z.object({ message_id: z.string() });

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    details: Record<string, unknown>
  ) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method: "GET" | "PUT" | "POST";
  body?: Record<string, unknown>;
};

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export function createInfraiClient({ apiKey, baseUrl }: { apiKey: string; baseUrl: string }) {
  async function request(path: string, options: RequestOptions): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(new URL(path, baseUrl), {
        method: options.method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        throw new InfraiError(
          envelope.error.code,
          envelope.error.message ?? envelope.error.code,
          response.status,
          envelope.error
        );
      }
      if (response.status >= 500) {
        throw new InfraiError("HTTP_ERROR", `Infrai request returned HTTP ${response.status}`, response.status, {});
      }
      return envelope.data;
    }
    throw new Error("Retry loop ended unexpectedly");
  }

  return {
    account: {
      balance: async () => balanceSchema.parse(await request("/v1/account/balance", { method: "GET" })),
      autorecharge: {
        configure: async (body: { trigger_balance: number; recharge_amount: number }) =>
          request("/v1/account/autorecharge/configure", { method: "PUT", body })
      }
    },
    email: {
      send: async (body: { to: string; subject: string; html: string }) =>
        messageSchema.parse(await request("/v1/email/send", { method: "POST", body }))
    }
  };
}

export type InfraiClient = ReturnType<typeof createInfraiClient>;
