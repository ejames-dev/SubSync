import {
  detectInterval,
  detectPayment,
  detectRenewalDate,
  emailContent,
  evidence,
  findPreferredMoney,
  isSenderDomain,
  plainText,
} from './parser.helpers';
import {
  EmailReceiptParser,
  ReceiptEmailInput,
  ReceiptParseResult,
} from './parser.types';

const SPOTIFY_PLANS = [
  'Premium Family',
  'Premium Duo',
  'Premium Student',
  'Premium Individual',
  'Family',
  'Duo',
  'Student',
  'Individual',
  'Premium',
];

export const spotifyReceiptParser: EmailReceiptParser = {
  id: 'spotify',
  version: 1,
  matches(input: ReceiptEmailInput): boolean {
    return (
      isSenderDomain(input.sender, 'spotify.com') ||
      /\bspotify\b/i.test(`${input.subject}\n${input.body ?? ''}`)
    );
  },
  parse(input: ReceiptEmailInput): ReceiptParseResult {
    const content = plainText(emailContent(input));
    const money = findPreferredMoney(content);
    const plan = SPOTIFY_PLANS.find((candidate) =>
      new RegExp(`\\b${candidate}\\b`, 'i').test(content),
    );
    const renewal = detectRenewalDate(content);
    const payment = detectPayment(content);

    if (!money) {
      return {
        parserId: this.id,
        parserVersion: this.version,
        confidence: 0,
        items: [],
        warnings: ['No Spotify billing amount was found.'],
      };
    }

    const confidence = isSenderDomain(input.sender, 'spotify.com')
      ? 0.97
      : 0.72;
    const planName = plan?.startsWith('Premium')
      ? `Spotify ${plan}`
      : `Spotify Premium ${plan ?? 'Imported Plan'}`;
    return {
      parserId: this.id,
      parserVersion: this.version,
      confidence,
      items: [
        {
          providerName: 'Spotify',
          planName,
          billingAmount: money.amount,
          billingCurrency: money.currency,
          billingInterval: detectInterval(content),
          nextRenewal: renewal?.iso,
          ...payment,
          confidence,
          evidence: evidence(money.raw, plan, renewal?.raw),
        },
      ],
      warnings: plan ? [] : ['The Spotify plan name was not identified.'],
    };
  },
};
