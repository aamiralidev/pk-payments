// lib/payments/jazzcashHosted.ts
export type JazzCashInitRequest = {
  amountPKR: number;
  orderId: string;
  description?: string;
};

export type JazzCashInitResponse = {
  endpoint: string;                 // JazzCash form URL (sandbox/live)
  fields: Record<string, string>;   // pp_* fields incl. pp_SecureHash
};

export type InitOptions = {
  baseUrl?: string,
  initUrl?: string;
  onBeforeRedirect?: () => void;
  onError?: (err: unknown) => void;
};

export async function initHostedCheckout(
  payload: JazzCashInitRequest,
  opts: { initUrl?: string, baseUrl?: string, } = {}
): Promise<JazzCashInitResponse> {
  let initUrl: string;
  if (opts.initUrl) {
    initUrl = opts.initUrl;
  } else if (opts.baseUrl) {
    initUrl = new URL("/api/payment/jazzcash/hosted/init", opts.baseUrl).toString();
  } else {
    initUrl = "/api/payment/jazzcash/hosted/init";
  }
  const res = await fetch(initUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`JazzCash init failed (${res.status}): ${text}`);
  }
  const gson = await res.json()
  console.log("Res: ", gson)
  const data = gson as JazzCashInitResponse;

  if (!data?.endpoint || !data?.fields) {
    throw new Error("Invalid JazzCash init response: missing endpoint/fields");
  }

  return data;
}

export function submitHostedCheckout(resp: JazzCashInitResponse) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = resp.endpoint;

  Object.entries(resp.fields).forEach(([k, v]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = String(v);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

export async function payWithJazzcashHosted(
  req: JazzCashInitRequest,
  opts: InitOptions = {}
) {
  try {
    const resp = await initHostedCheckout(req, opts);
    opts.onBeforeRedirect?.();
    submitHostedCheckout(resp);
  } catch (err) {
    opts.onError?.(err);
    throw err;
  }
}
