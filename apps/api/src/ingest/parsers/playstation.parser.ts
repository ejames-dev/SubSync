import {
  detectInterval,
  detectLifecycleIntent,
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

export const playstationReceiptParser: EmailReceiptParser = {
  id: 'playstation',
  version: 1,
  matches(input: ReceiptEmailInput): boolean {
    const text = `${input.subject}\n${input.body ?? ''}`;
    return (
      isSenderDomain(input.sender, 'playstation.com') ||
      isSenderDomain(input.sender, 'sonyentertainmentnetwork.com') ||
      /\bplaystation\s*plus\b/i.test(text)
    );
  },
  parse(input: ReceiptEmailInput): ReceiptParseResult {
    const content = plainText(emailContent(input));
    const money = findPreferredMoney(content);
    const lifecycleIntent = detectLifecycleIntent(content);
    const renewal = detectRenewalDate(content);
    const payment = detectPayment(content);

    const tier = /\bpremium\b/i.test(content)
      ? 'Premium'
      : /\bextra\b/i.test(content)
        ? 'Extra'
        : 'Essential';
    const planName = `PlayStation Plus ${tier}`;

    if (!money && lifecycleIntent !== 'cancellation') {
      return {
        parserId: this.id,
        parserVersion: this.version,
        confidence: 0,
        items: [],
        warnings: ['No PlayStation Plus billing amount was found.'],
      };
    }

    const trusted =
      isSenderDomain(input.sender, 'playstation.com') ||
      isSenderDomain(input.sender, 'sonyentertainmentnetwork.com');
    const confidence = trusted ? 0.95 : 0.72;

    return {
      parserId: this.id,
      parserVersion: this.version,
      confidence,
      items: [
        {
          providerName: 'PlayStation Plus',
          merchantName: 'Sony',
          planName,
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
            planName,
            renewal?.raw,
          ),
        },
      ],
      warnings: [],
    };
  },
};
