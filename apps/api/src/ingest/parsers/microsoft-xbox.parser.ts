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

export const microsoftXboxReceiptParser: EmailReceiptParser = {
  id: 'microsoft_xbox',
  version: 1,
  matches(input: ReceiptEmailInput): boolean {
    const text = `${input.subject}\n${input.body ?? ''}`;
    return (
      isSenderDomain(input.sender, 'xbox.com') ||
      (isSenderDomain(input.sender, 'microsoft.com') &&
        /\b(?:xbox|game pass|microsoft 365)\b/i.test(text)) ||
      /\bxbox\s*game\s*pass\b/i.test(text)
    );
  },
  parse(input: ReceiptEmailInput): ReceiptParseResult {
    const content = plainText(emailContent(input));
    const money = findPreferredMoney(content);
    const lifecycleIntent = detectLifecycleIntent(content);
    const renewal = detectRenewalDate(content);
    const payment = detectPayment(content);

    const isM365 =
      /\bmicrosoft\s*365\b/i.test(content) &&
      !/\bxbox|game pass\b/i.test(content);
    const providerName = isM365 ? 'Microsoft 365' : 'Xbox Game Pass';
    const planName = /\bultimate\b/i.test(content)
      ? 'Xbox Game Pass Ultimate'
      : /\bpc\s*game\s*pass\b/i.test(content)
        ? 'PC Game Pass'
        : /\bcore\b/i.test(content)
          ? 'Xbox Game Pass Core'
          : providerName;

    if (!money && lifecycleIntent !== 'cancellation') {
      return {
        parserId: this.id,
        parserVersion: this.version,
        confidence: 0,
        items: [],
        warnings: [`No ${providerName} billing amount was found.`],
      };
    }

    const trusted =
      isSenderDomain(input.sender, 'xbox.com') ||
      isSenderDomain(input.sender, 'microsoft.com');
    const confidence = trusted ? 0.95 : 0.72;

    return {
      parserId: this.id,
      parserVersion: this.version,
      confidence,
      items: [
        {
          providerName,
          merchantName: 'Microsoft',
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
