import {
  detectInterval,
  detectLifecycleIntent,
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
    const lifecycleIntent = detectLifecycleIntent(content);
    const providerName = inferProvider(input);
    if ((!money && lifecycleIntent !== 'cancellation') || !providerName) {
      return {
        parserId: this.id,
        parserVersion: this.version,
        confidence: 0,
        items: [],
        warnings: [
          !money && lifecycleIntent !== 'cancellation'
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
          billingAmount: money?.amount ?? 0,
          billingCurrency: money?.currency ?? 'USD',
          billingInterval: detectInterval(content),
          nextRenewal: renewal?.iso,
          trialEndsAt:
            lifecycleIntent === 'trial_start' ? renewal?.iso : undefined,
          lifecycleIntent,
          ...payment,
          confidence,
          evidence: evidence(
            money?.raw ?? 'cancellation',
            undefined,
            renewal?.raw,
          ),
        },
      ],
      warnings: ['Parsed with generic heuristics; review is recommended.'],
    };
  },
};
