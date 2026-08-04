// Client REST fino para a Google Ads API — não existe biblioteca Node.js
// oficial (só Python/Java/PHP/.NET/Ruby/Perl), então consumimos a interface
// REST diretamente, mesmo padrão usado para outras integrações externas
// deste projeto (ex.: Resend).
//
// Backfindr e M2RMenu usam a mesma conta Google Ads — um único conjunto de
// credenciais (GOOGLE_ADS_*) cobre os dois.

const API_VERSION = 'v25';
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;

export class GoogleAdsApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`Google Ads API error (HTTP ${status}): ${JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? '',
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new GoogleAdsApiError(res.status, data);
  }

  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

function authHeaders(accessToken: string, includeLoginCustomerId: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
    Authorization: `Bearer ${accessToken}`,
  };
  if (includeLoginCustomerId && process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  }
  return headers;
}

/**
 * Lista as contas Google Ads acessíveis pelas credenciais OAuth atuais.
 * Chamada mais simples possível — não depende de customer_id nem GAQL,
 * útil como teste de conectividade/autenticação.
 */
export async function listAccessibleCustomers(): Promise<{ resourceNames: string[] }> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/customers:listAccessibleCustomers`, {
    headers: authHeaders(token, false),
  });
  const data = await res.json();
  if (!res.ok) throw new GoogleAdsApiError(res.status, data);
  return data;
}

/**
 * Executa uma query GAQL contra uma conta específica.
 * customerId sem hífens (ex: "4684527429").
 *
 * O OAuth atual acessa GOOGLE_ADS_CUSTOMER_ID (4684527429) diretamente —
 * não via delegação da MCC (7631795941) — então login-customer-id NÃO é
 * enviado por padrão (confirmado empiricamente: enviá-lo como a MCC gera
 * 403 USER_PERMISSION_DENIED). Passe includeLoginCustomerId=true só se um
 * dia isso mudar para outra conta que exija acesso via MCC.
 */
export async function gaqlSearch(
  customerId: string,
  query: string,
  includeLoginCustomerId = false
): Promise<{ results?: unknown[] }> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers: authHeaders(token, includeLoginCustomerId),
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new GoogleAdsApiError(res.status, data);
  return data;
}
