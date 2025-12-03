// lib/payment/easypaisa/hosted.ts

export type EasypaisaHostedInitRequest = {
  amountPKR: number;
  orderRefNum: string;           // Easypaisa uses orderRefNum
  emailAddr?: string;
  mobileNum?: string;
  autoRedirect?: "0" | "1";      // "1" (default) redirects automatically
};

export type EasypaisaHostedInitResponse = {
  endpoint: string;                 // Easypaisa Index.jsf URL (sandbox/live)
  fields: Record<string, string>;   // amount, orderRefNum, storeId, merchantHashedReq, etc.
};

export type InitOptions = {
  baseUrl?: string;
  initUrl?: string;
  onBeforeRedirect?: () => void;
  onError?: (err: unknown) => void;
};

export async function initHostedCheckout(
  payload: EasypaisaHostedInitRequest,
  opts: { initUrl?: string; baseUrl?: string } = {}
): Promise<EasypaisaHostedInitResponse> {
  let initUrl: string;

  if (opts.initUrl) {
    initUrl = opts.initUrl;
  } else if (opts.baseUrl) {
    initUrl = new URL("/api/payment/easypaisa/hosted/init", opts.baseUrl).toString();
  } else {
    initUrl = "/api/payment/easypaisa/hosted/init";
  }

  const res = await fetch(initUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Easypaisa init failed (${res.status}): ${text}`);
  }

  const gson = await res.json();
  console.log("Easypaisa init response:", gson);

  // If you kept the backend shape I suggested: { ok, endpoint, fields }
  const ok = gson.ok ?? true;
  if (!ok) {
    throw new Error(
      `Easypaisa init error: ${gson.error || "Backend returned ok = false"}`
    );
  }

  const data: EasypaisaHostedInitResponse = {
    endpoint: gson.endpoint,
    fields: gson.fields,
  };

  if (!data?.endpoint || !data?.fields) {
    throw new Error("Invalid Easypaisa init response: missing endpoint/fields");
  }

  return data;
}

export function submitHostedCheckout(resp: EasypaisaHostedInitResponse) {
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

export async function payWithEasypaisaHosted(
  req: EasypaisaHostedInitRequest,
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
