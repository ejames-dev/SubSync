import {
  detectInterval,
  detectPayment,
  detectRenewalDate,
  emailContent,
  evidence,
  findPreferredMoney,
  plainText,
  senderDomain,
} from './parser.helpers';
import {
  EmailReceiptParser,
  ReceiptEmailInput,
  ReceiptParseResult,
} from './parser.types';

const SUBJECT_NOISE =
  /\b(?:your|receipt|invoice|payment|subscription|renewal|confirmation|from|for)\b/gi;

function inferProvider(input: ReceiptEmailInput): string | undefined {
  const domain = senderDomain(input.sender);
  const domainName = domain?.split('.').slice(-2, -1)[0];
  const raw =
    domainName ??
    input.subject.replace(SUBJECT_NOISE, ' ').trim().split(/\s+/)[0];
  if (!raw) {
    return undefined;
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export const genericReceiptParser: EmailReceiptParser = {
  id: 'generic',
  version: 1,
  matches(): boolean {
    return true;
  },
  parse(input: ReceiptEmailInput): ReceiptParseResult {
    const content = plainText(emailContent(input));
    const money = findPreferredMoney(content);
    const providerName = inferProvider(input);
    if (!money || !providerName) {
      return {
        parserId: this.id,
        parserVersion: this.version,
        confidence: 0,
        items: [],
        warnings: [
          !money
            ? 'No billing amount was found.'
            : 'The subscription provider could not be inferred.',
        ],
      };
    }

    const renewal = detectRenewalDate(content);
    const payment = detectPayment(content);
    const confidence = 0.45;
    return {
      parserId: this.id,
      parserVersion: this.version,
      confidence,
      items: [
        {
          providerName,
          planName: `${providerName} Imported Plan`,
          billingAmount: money.amount,
          billingCurrency: money.currency,
          billingInterval: detectInterval(content),
          nextRenewal: renewal?.iso,
          ...payment,
          confidence,
          evidence: evidence(money.raw, undefined, renewal?.raw),
        },
      ],
      warnings: ['Parsed with generic heuristics; review is recommended.'],
    };
  },
};
