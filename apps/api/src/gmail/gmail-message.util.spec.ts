import {
  extractHeader,
  extractPlainTextBody,
  GmailApiMessage,
  hasAuthenticatedSender,
} from './gmail-message.util';

describe('gmail-message.util', () => {
  const message: GmailApiMessage = {
    id: 'msg_1',
    internalDate: String(Date.parse('2026-03-17T12:00:00.000Z')),
    payload: {
      headers: [
        { name: 'From', value: 'billing@netflix.com' },
        { name: 'Subject', value: 'Netflix receipt' },
      ],
      parts: [
        {
          mimeType: 'text/plain',
          body: {
            data: Buffer.from('Amount: $15.49 billed monthly', 'utf8')
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/g, ''),
          },
        },
      ],
    },
  };

  it('extracts headers and plain text body', () => {
    expect(extractHeader(message, 'From')).toBe('billing@netflix.com');
    expect(extractHeader(message, 'Subject')).toBe('Netflix receipt');
    expect(extractPlainTextBody(message)).toContain('$15.49');
  });

  it('preserves table boundaries when extracting HTML receipts', () => {
    const htmlMessage: GmailApiMessage = {
      payload: {
        parts: [
          {
            mimeType: 'text/html',
            body: {
              data: Buffer.from(
                '<table><tr><td>Apple TV+</td><td>$9.99</td></tr><tr><td>iCloud+</td><td>$2.99</td></tr></table>',
                'utf8',
              )
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/g, ''),
            },
          },
        ],
      },
    };

    const body = extractPlainTextBody(htmlMessage);
    expect(body).toContain('Apple TV+\n$9.99');
    expect(body).toContain('iCloud+\n$2.99');
  });

  it('uses only the plain part of multipart alternative messages', () => {
    const alternative: GmailApiMessage = {
      payload: {
        mimeType: 'multipart/alternative',
        parts: [
          {
            mimeType: 'text/plain',
            body: { data: Buffer.from('Apple TV+\n$9.99').toString('base64') },
          },
          {
            mimeType: 'text/html',
            body: {
              data: Buffer.from('<p>Apple TV+</p><p>$9.99</p>').toString(
                'base64',
              ),
            },
          },
        ],
      },
    };

    expect(extractPlainTextBody(alternative)).toBe('Apple TV+\n$9.99');
  });

  it('requires aligned SPF or DKIM authentication for trusted senders', () => {
    const authenticated: GmailApiMessage = {
      payload: {
        headers: [
          {
            name: 'Authentication-Results',
            value: 'mx.google.com; dkim=pass header.i=@mailer.netflix.com',
          },
        ],
      },
    };

    expect(
      hasAuthenticatedSender(authenticated, 'Netflix <info@netflix.com>'),
    ).toBe(true);
    expect(hasAuthenticatedSender(authenticated, 'attacker@example.com')).toBe(
      false,
    );
  });
});
