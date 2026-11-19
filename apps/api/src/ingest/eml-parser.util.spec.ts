import { parseRawEml } from './eml-parser.util';

describe('parseRawEml', () => {
  it('parses multipart MIME .eml messages with quoted-printable and auth headers', () => {
    const rawEml = [
      'From: "Spotify" <no-reply@spotify.com>',
      'Subject: =?UTF-8?Q?Your_Spotify_Premium_receipt?=',
      'Date: Wed, 01 Jul 2026 12:00:00 +0000',
      'Message-ID: <msg-123@spotify.com>',
      'Authentication-Results: mx.example.com; dkim=pass header.d=spotify.com',
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="bound123"',
      '',
      '--bound123',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'Spotify Premium Individual=0APayment: $11.99 monthly',
      '--bound123--',
    ].join('\r\n');

    const parsed = parseRawEml(rawEml);

    expect(parsed.sender).toBe('"Spotify" <no-reply@spotify.com>');
    expect(parsed.subject).toBe('Your Spotify Premium receipt');
    expect(parsed.messageId).toBe('msg-123@spotify.com');
    expect(parsed.authenticatedSender).toBe(true);
    expect(parsed.body).toContain('Spotify Premium Individual');
    expect(parsed.body).toContain('$11.99 monthly');
  });

  it('marks authenticatedSender false when SPF/DKIM domain does not align with From domain', () => {
    const spoofedEml = [
      'From: "Spotify" <no-reply@spotify.com>',
      'Subject: Your Spotify receipt',
      'Date: Wed, 01 Jul 2026 12:00:00 +0000',
      'Authentication-Results: mx.example.com; dkim=pass header.d=attacker.example; spf=pass smtp.mailfrom=bounce@attacker.example',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      'Spotify Premium Individual $11.99 monthly',
    ].join('\r\n');

    const parsed = parseRawEml(spoofedEml);
    expect(parsed.authenticatedSender).toBe(false);
  });

  it('ignores injected lower Authentication-Results headers and untrusted authserv-ids', () => {
    const injectedHeaderEml = [
      'Received: from attacker.example by mx.fastmail.com',
      'Authentication-Results: mx.fastmail.com; dkim=fail header.d=spotify.com; spf=fail smtp.mailfrom=spotify.com',
      'From: "Spotify" <no-reply@spotify.com>',
      'Subject: Your Spotify receipt',
      'Authentication-Results: mx.fastmail.com; dkim=pass header.d=spotify.com',
      '',
      'Spotify Premium Individual $11.99 monthly',
    ].join('\r\n');

    expect(
      parseRawEml(injectedHeaderEml, {
        trustedAuthServHost: 'imap.fastmail.com',
      }).authenticatedSender,
    ).toBe(false);

    const untrustedAuthServEml = [
      'Authentication-Results: mx.evil-relay.org; dkim=pass header.d=spotify.com',
      'From: "Spotify" <no-reply@spotify.com>',
      'Subject: Your Spotify receipt',
      '',
      'Spotify Premium Individual $11.99 monthly',
    ].join('\r\n');

    expect(
      parseRawEml(untrustedAuthServEml, {
        trustedAuthServHost: 'imap.fastmail.com',
      }).authenticatedSender,
    ).toBe(false);

    expect(
      parseRawEml(
        untrustedAuthServEml.replace('mx.evil-relay.org', 'mx.google.com'),
        { trustedAuthServHost: 'imap.gmail.com' },
      ).authenticatedSender,
    ).toBe(true);
  });

  it('supports multi-hop Gmail Received chains and Outlook authserv-id-less headers', () => {
    const gmailMultiHopEml = [
      'Received: by 2002:a05:622a:1:: with SMTP id abc123',
      'Received: from mail.spotify.com by mx.google.com with ESMTPS id def456',
      'Authentication-Results: mx.google.com; dkim=pass header.i=@spotify.com',
      'From: "Spotify" <no-reply@spotify.com>',
      'Subject: Your Spotify receipt',
      '',
      'Spotify Premium Individual $11.99 monthly',
    ].join('\r\n');

    expect(
      parseRawEml(gmailMultiHopEml, { trustedAuthServHost: 'imap.gmail.com' })
        .authenticatedSender,
    ).toBe(true);

    const outlookEml = [
      'Received: from BN8NAM04FT012.eop-NAM04.prod.protection.outlook.com by MN2PR01MB5678.prod.outlook.com',
      'Authentication-Results: spf=pass (sender IP is 1.2.3.4) smtp.mailfrom=spotify.com; dkim=pass header.d=spotify.com',
      'From: "Spotify" <no-reply@spotify.com>',
      'Subject: Your Spotify receipt',
      '',
      'Spotify Premium Individual $11.99 monthly',
    ].join('\r\n');

    expect(
      parseRawEml(outlookEml, {
        trustedAuthServHost: 'outlook.office365.com',
      }).authenticatedSender,
    ).toBe(true);

    expect(
      parseRawEml(outlookEml, {
        trustedAuthServHost: 'imap.fastmail.com',
      }).authenticatedSender,
    ).toBe(false);
  });
});
