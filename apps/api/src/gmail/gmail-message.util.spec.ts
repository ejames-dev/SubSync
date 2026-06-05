import {
  extractHeader,
  extractPlainTextBody,
  GmailApiMessage,
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
});
