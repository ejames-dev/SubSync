type GmailHeader = { name?: string; value?: string };
type GmailBody = { size?: number; data?: string };
type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  body?: GmailBody;
  parts?: GmailMessagePart[];
};
type GmailMessagePayload = {
  headers?: GmailHeader[];
  body?: GmailBody;
  parts?: GmailMessagePart[];
};
export type GmailApiMessage = {
  id?: string;
  internalDate?: string;
  payload?: GmailMessagePayload;
};

const BILLING_QUERY =
  'newer_than:90d (subject:(receipt OR invoice OR billing OR payment OR subscription OR renew OR charged OR renewal) OR from:(billing OR noreply OR receipts OR no-reply))';

export function getBillingSearchQuery(): string {
  return BILLING_QUERY;
}

export function extractHeader(
  message: GmailApiMessage,
  name: string,
): string | undefined {
  const headers = message.payload?.headers ?? [];
  const match = headers.find(
    (header) => header.name?.toLowerCase() === name.toLowerCase(),
  );
  return match?.value;
}

export function extractPlainTextBody(message: GmailApiMessage): string {
  const chunks: string[] = [];
  collectText(message.payload, chunks);
  return chunks.join('\n').trim();
}

function collectText(
  part: GmailMessagePart | GmailMessagePayload | undefined,
  chunks: string[],
): void {
  if (!part) {
    return;
  }

  const mimeType = 'mimeType' in part ? part.mimeType : undefined;
  if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data);
    if (mimeType?.startsWith('text/plain') || !mimeType) {
      chunks.push(decoded);
    } else if (mimeType.startsWith('text/html')) {
      chunks.push(stripHtml(decoded));
    }
  }

  for (const child of part.parts ?? []) {
    collectText(child, chunks);
  }
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );
  return Buffer.from(padded, 'base64').toString('utf8');
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
