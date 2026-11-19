import { senderDomain } from './parsers/parser.helpers';

export interface ParsedEmlMessage {
  sender: string;
  subject: string;
  receivedAt: string;
  messageId?: string;
  authenticatedSender: boolean;
  body: string;
}

export function parseRawEml(rawEml: string): ParsedEmlMessage {
  const normalized = rawEml.replace(/\r\n/g, '\n');
  const splitIndex = normalized.indexOf('\n\n');
  const rawHeaderBlock =
    splitIndex >= 0 ? normalized.slice(0, splitIndex) : normalized;
  const rawBodyBlock = splitIndex >= 0 ? normalized.slice(splitIndex + 2) : '';

  const headers = parseHeaders(rawHeaderBlock);
  const decodedSender = decodeMimeWords(
    headers.get('from') || 'unknown@unknown.invalid',
  );
  const subject = decodeMimeWords(headers.get('subject') || '(no subject)');
  const dateHeader = headers.get('date');
  const parsedDate = dateHeader ? new Date(dateHeader) : new Date();
  const receivedAt = Number.isNaN(parsedDate.getTime())
    ? new Date().toISOString()
    : parsedDate.toISOString();

  const rawMessageId = headers.get('message-id')?.trim();
  const messageId = rawMessageId
    ? rawMessageId.replace(/^<|>$/g, '')
    : undefined;

  const authResults = headers.get('authentication-results') ?? '';
  const authenticatedSender = hasAlignedAuthentication(
    decodedSender,
    authResults,
  );

  const contentType = headers.get('content-type') ?? 'text/plain';
  const transferEncoding = headers.get('content-transfer-encoding') ?? '7bit';
  const body = extractMimeBody(rawBodyBlock, contentType, transferEncoding);

  return {
    sender: decodedSender,
    subject,
    receivedAt,
    messageId,
    authenticatedSender,
    body,
  };
}

function hasAlignedAuthentication(
  decodedSender: string,
  authResults: string,
): boolean {
  const domainFromSender = senderDomain(decodedSender);
  if (!domainFromSender || !authResults) {
    return false;
  }

  for (const rawClause of authResults.slice(0, 8192).split(';')) {
    const clause = rawClause.trim();
    if (!/\b(?:dkim|spf)\s*=\s*pass\b/i.test(clause)) {
      continue;
    }
    const tokenMatch = clause.match(
      /(?:header\.(?:d|i)|smtp\.mailfrom)\s*=\s*([^\s;]+)/i,
    );
    const rawToken = tokenMatch?.[1] ?? '';
    const atIdx = rawToken.lastIndexOf('@');
    const domain = (atIdx >= 0 ? rawToken.slice(atIdx + 1) : rawToken)
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '')
      .split('.')
      .filter(Boolean)
      .join('.');
    if (
      domain &&
      (domain === domainFromSender ||
        domain.endsWith(`.${domainFromSender}`) ||
        domainFromSender.endsWith(`.${domain}`))
    ) {
      return true;
    }
  }

  return false;
}

function parseHeaders(headerBlock: string): Map<string, string> {
  const unfolded = headerBlock.replace(/\n[ \t]+/g, ' ');
  const map = new Map<string, string>();
  for (const line of unfolded.split('\n')) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!map.has(key)) {
      map.set(key, value);
    } else if (key === 'authentication-results') {
      map.set(key, `${map.get(key)}; ${value}`);
    }
  }
  return map;
}

function extractMimeBody(
  body: string,
  contentType: string,
  transferEncoding: string,
): string {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (/^multipart\//i.test(contentType) && boundary) {
    const marker = `--${boundary}`;
    const parts = body.split(marker).slice(1);
    let plainCandidate: string | undefined;
    let htmlCandidate: string | undefined;

    for (const part of parts) {
      if (part.startsWith('--')) break;
      const trimmedPart = part.replace(/^\n/, '');
      const idx = trimmedPart.indexOf('\n\n');
      if (idx < 0) continue;
      const partHeaders = parseHeaders(trimmedPart.slice(0, idx));
      const partBody = trimmedPart.slice(idx + 2);
      const partCt = partHeaders.get('content-type') ?? 'text/plain';
      const partEnc = partHeaders.get('content-transfer-encoding') ?? '7bit';

      if (/^multipart\//i.test(partCt)) {
        const nested = extractMimeBody(partBody, partCt, partEnc);
        if (nested.trim() && !plainCandidate) {
          plainCandidate = nested;
        }
      } else if (/^text\/plain/i.test(partCt) && !plainCandidate) {
        plainCandidate = decodeBody(partBody, partEnc);
      } else if (/^text\/html/i.test(partCt) && !htmlCandidate) {
        htmlCandidate = decodeBody(partBody, partEnc);
      }
    }

    return (plainCandidate ?? htmlCandidate ?? '').trim();
  }

  return decodeBody(body, transferEncoding).trim();
}

function decodeBody(raw: string, encoding: string): string {
  const norm = encoding.trim().toLowerCase();
  if (norm === 'base64') {
    const cleaned = raw.replace(/\s+/g, '');
    return Buffer.from(cleaned, 'base64').toString('utf8');
  }
  if (norm === 'quoted-printable') {
    return decodeQuotedPrintable(raw);
  }
  return raw;
}

function decodeQuotedPrintable(input: string): string {
  const softJoined = input.replace(/=\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < softJoined.length; i += 1) {
    if (
      softJoined[i] === '=' &&
      /^[0-9A-Fa-f]{2}$/.test(softJoined.slice(i + 1, i + 3))
    ) {
      bytes.push(Number.parseInt(softJoined.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      const encoded = Buffer.from(softJoined[i], 'utf8');
      for (const byte of encoded) {
        bytes.push(byte);
      }
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

function decodeMimeWords(value: string): string {
  return value.replace(
    /=\?([A-Za-z0-9_-]+)\?([BbQq])\?([^?]+)\?=/g,
    (_full, _charset, mode: string, payload: string) => {
      if (mode.toUpperCase() === 'B') {
        return Buffer.from(payload, 'base64').toString('utf8');
      }
      return decodeQuotedPrintable(payload.replace(/_/g, ' '));
    },
  );
}
