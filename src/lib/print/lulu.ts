// Lulu Print API client (B-9) — the thinnest slice that turns an export into
// an order: OAuth2 token, cost quote, create print job, job status.
//
// Configuration (all env; nothing here works without James's Lulu account):
//   LULU_CLIENT_KEY / LULU_CLIENT_SECRET — from developers.lulu.com
//   LULU_SANDBOX=1                       — use api.sandbox.lulu.com (default 1)
//   LULU_POD_PACKAGE_ID                  — Lulu's SKU string encoding trim/
//     color/binding/paper, picked from their pricing calculator (e.g. an
//     8.5"-square full-colour paperback). REQUIRED — there is no safe default.
//   PUBLIC_BASE_URL                      — required for real orders only: Lulu
//     downloads the interior/cover PDFs from URLs, so the app must be hosted
//     (or tunnelled) somewhere Lulu can reach.
//
// NOTE (verify on first live call, endpoints from docs as of integration):
// token path, cost-calculation and print-job payload shapes below follow
// Lulu's OpenAPI docs; the sandbox never prints or charges.

export interface ShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code?: string;
  postcode: string;
  country_code: string; // ISO 3166-1 alpha-2, e.g. "US"
  phone_number?: string;
}

export interface QuoteInput {
  pageCount: number;
  quantity: number;
  shippingAddress: ShippingAddress;
  shippingLevel?: string; // MAIL | PRIORITY_MAIL | GROUND | EXPEDITED | EXPRESS
}

export interface OrderInput extends QuoteInput {
  title: string;
  contactEmail: string;
  interiorUrl: string;
  coverUrl: string;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function luluBaseUrl(): string {
  return env("LULU_SANDBOX") === "0" ? "https://api.lulu.com" : "https://api.sandbox.lulu.com";
}

/** Which pieces are configured — the routes report exactly what's missing. */
export function luluStatus(): { configured: boolean; missing: string[] } {
  const missing = ["LULU_CLIENT_KEY", "LULU_CLIENT_SECRET", "LULU_POD_PACKAGE_ID"].filter((k) => !env(k));
  return { configured: missing.length === 0, missing };
}

async function luluFetch(path: string, init: RequestInit & { token?: string } = {}): Promise<unknown> {
  const res = await fetch(`${luluBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Lulu ${init.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : {};
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getLuluToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) return cachedToken.token;
  const key = env("LULU_CLIENT_KEY");
  const secret = env("LULU_CLIENT_SECRET");
  if (!key || !secret) throw new Error("Lulu credentials not configured (LULU_CLIENT_KEY / LULU_CLIENT_SECRET).");
  const res = await fetch(`${luluBaseUrl()}/auth/realms/glasses/protocol/openid-connect/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Lulu auth failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

/** Price a book+shipping without uploading anything. */
export async function luluCostQuote(input: QuoteInput): Promise<unknown> {
  const token = await getLuluToken();
  return luluFetch("/print-job-cost-calculations/", {
    method: "POST",
    token,
    body: JSON.stringify({
      line_items: [
        {
          page_count: input.pageCount,
          pod_package_id: env("LULU_POD_PACKAGE_ID"),
          quantity: input.quantity,
        },
      ],
      shipping_address: input.shippingAddress,
      shipping_option: input.shippingLevel ?? "MAIL",
    }),
  });
}

/** Create a real print job (sandbox: validated but never printed/charged). */
export async function luluCreatePrintJob(input: OrderInput): Promise<unknown> {
  const token = await getLuluToken();
  return luluFetch("/print-jobs/", {
    method: "POST",
    token,
    body: JSON.stringify({
      contact_email: input.contactEmail,
      shipping_address: input.shippingAddress,
      shipping_level: input.shippingLevel ?? "MAIL",
      line_items: [
        {
          title: input.title,
          quantity: input.quantity,
          pod_package_id: env("LULU_POD_PACKAGE_ID"),
          printable_normalization: {
            interior: { source_url: input.interiorUrl },
            cover: { source_url: input.coverUrl },
          },
        },
      ],
    }),
  });
}

export async function luluGetPrintJob(jobId: string): Promise<unknown> {
  const token = await getLuluToken();
  return luluFetch(`/print-jobs/${encodeURIComponent(jobId)}/`, { token });
}
