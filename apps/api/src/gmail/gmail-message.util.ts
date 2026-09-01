type GmailHeader = { name?: string; value?: string };
type GmailBody = { size?: number; data?: string };
type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  body?: GmailBody;
  parts?: GmailMessagePart[];
};
type GmailMessagePayload = {
  mimeType?: string;
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

export function hasAuthenticatedSender(
  message: GmailApiMessage,
  sender: string,
): boolean {
  const senderDomain = sender.match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase();
  const authentication = extractHeader(message, 'Authentication-Results');
  if (!senderDomain || !authentication) {
    return false;
  }
  const authenticatedDomains = Array.from(
    authentication.matchAll(
      /\b(?:dkim|spf)\s*=\s*pass\b[^;]*(?:header\.(?:d|i)|smtp\.mailfrom)\s*=\s*@?([a-z0-9.-]+)/gi,
    ),
    (match) => match[1].toLowerCase(),
  );
  return authenticatedDomains.some(
    (domain) =>
      domain === senderDomain ||
      domain.endsWith(`.${senderDomain}`) ||
      senderDomain.endsWith(`.${domain}`),
  );
}

function collectText(
  part: GmailMessagePart | GmailMessagePayload | undefined,
  chunks: string[],
): void {
  if (!part) {
    return;
  }

  const mimeType = 'mimeType' in part ? part.mimeType : undefined;
  if (mimeType?.toLowerCase() === 'multipart/alternative') {
    const preferred =
      part.parts?.find((child) => child.mimeType === 'text/plain') ??
      part.parts?.find((child) => child.mimeType === 'text/html') ??
      part.parts?.[0];
    collectText(preferred, chunks);
    return;
  }
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
  return (
    value
      .replace(/<style[\s\S]*?<\s*\/\s*style\s*>/gi, ' ')
      .replace(/<script[\s\S]*?<\s*\/\s*script\s*>/gi, ' ')
      .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/td|\/th)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      // &amp; must unescape last -- decoding it before &lt;/&gt;/&quot; would
      // turn an already-single-encoded "&amp;lt;" into "&lt;" and then into
      // "<", silently double-unescaping attacker-controlled email HTML into
      // characters this function is supposed to be stripping.
      .replace(/&amp;/gi, '&')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n\s*\n+/g, '\n')
      .trim()
  );
}
