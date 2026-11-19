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

export const disneyHuluReceiptParser: EmailReceiptParser = {
  id: 'disney_hulu',
  version: 1,
  matches(input: ReceiptEmailInput): boolean {
    const text = `${input.subject}\n${input.body ?? ''}`;
    return (
      isSenderDomain(input.sender, 'disneyplus.com') ||
      isSenderDomain(input.sender, 'disney.com') ||
      isSenderDomain(input.sender, 'hulu.com') ||
      /\b(?:disney\+|disney plus|hulu)\b/i.test(text)
    );
  },
  parse(input: ReceiptEmailInput): ReceiptParseResult {
    const content = plainText(emailContent(input));
    const money = findPreferredMoney(content);
    const lifecycleIntent = detectLifecycleIntent(content);
    const renewal = detectRenewalDate(content);
    const payment = detectPayment(content);

    const isHuluPrimary =
      isSenderDomain(input.sender, 'hulu.com') ||
      (/\bhulu\b/i.test(content) && !/\bdisney\+|disney plus\b/i.test(content));
    const providerName = isHuluPrimary ? 'Hulu' : 'Disney+';
    const isBundle = /\b(?:bundle|duo|trio)\b/i.test(content);
    const planName = isBundle
      ? `${providerName} Bundle`
      : `${providerName} Standard`;

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
      isSenderDomain(input.sender, 'disneyplus.com') ||
      isSenderDomain(input.sender, 'disney.com') ||
      isSenderDomain(input.sender, 'hulu.com');
    const confidence = trusted ? 0.95 : 0.72;

    return {
      parserId: this.id,
      parserVersion: this.version,
      confidence,
      items: [
        {
          providerName,
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
