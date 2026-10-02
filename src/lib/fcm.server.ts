// FCM HTTP v1 sender for Cloudflare Workers (uses Web Crypto for RS256 JWT signing).

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

let cachedToken: { token: string; exp: number } | null = null;

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else bytes = new Uint8Array(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FCM_SERVICE_ACCOUNT_JSON not configured");
  return JSON.parse(raw) as ServiceAccount;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const sa = loadServiceAccount();
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch(claims.aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok) throw new Error(`FCM token exchange failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: body.access_token, exp: now + body.expires_in };
  return body.access_token;
}

export type FcmMessage = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type FcmResult = { ok: boolean; status: number; token: string; error?: string };

export async function sendFcmMessage(msg: FcmMessage): Promise<FcmResult> {
  const sa = loadServiceAccount();
  // The service account project is authoritative; using a stale override can cause
  // FCM SENDER_ID_MISMATCH for tokens registered by the current Firebase project.
  const projectId = sa.project_id;
  const accessToken = await getAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const data = Object.fromEntries(
    Object.entries(msg.data ?? {}).filter(([key]) => key !== "from" && key !== "gcm" && !key.startsWith("google."))
  );
  const payload = {
    message: {
      token: msg.token,
      notification: { title: msg.title, body: msg.body },
      data,
      android: {
        priority: "HIGH" as const,
        ttl: "2419200s",
        notification: {
          sound: "default",
          channel_id: "jalwa_default",
        },
      },
      apns: { payload: { aps: { sound: "default" } } },
    },
  };
  async function send(access: string) {
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  let res = await send(accessToken);

  // Refresh once when a Vercel instance has a stale cached OAuth token.
  // This prevents background pushes from being lost after credentials rotate.
  if (res.status === 401) {
    cachedToken = null;
    try {
      const freshToken = await getAccessToken();
      res = await send(freshToken);
    } catch (e) {
      return {
        ok: false,
        status: 401,
        token: msg.token,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  if (res.ok) return { ok: true, status: res.status, token: msg.token };
  const errText = await res.text();
  return { ok: false, status: res.status, token: msg.token, error: errText };
}

export function isDeadFcmError(status: number, errText?: string): boolean {
  if (status === 404) return true;
  if (status === 400 && errText && /UNREGISTERED|INVALID_ARGUMENT/i.test(errText)) return true;
  return false;
}
