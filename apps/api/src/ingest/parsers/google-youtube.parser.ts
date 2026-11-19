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

export const googleYoutubeReceiptParser: EmailReceiptParser = {
  id: 'google_youtube',
  version: 1,
  matches(input: ReceiptEmailInput): boolean {
    const text = `${input.subject}\n${input.body ?? ''}`;
    return (
      isSenderDomain(input.sender, 'youtube.com') ||
      (isSenderDomain(input.sender, 'google.com') &&
        /\b(?:youtube|google play|google one)\b/i.test(text)) ||
      /\byoutube\s*(?:premium|music|tv)\b/i.test(text)
    );
  },
  parse(input: ReceiptEmailInput): ReceiptParseResult {
    const content = plainText(emailContent(input));
    const money = findPreferredMoney(content);
    const lifecycleIntent = detectLifecycleIntent(content);
    const renewal = detectRenewalDate(content);
    const payment = detectPayment(content);

    const isYoutube = /\byoutube\b/i.test(content);
    const providerName = isYoutube ? 'YouTube Premium' : 'Google One';
    const planName = /\bfamily\b/i.test(content)
      ? `${providerName} Family`
      : /\bstudent\b/i.test(content)
        ? `${providerName} Student`
        : `${providerName} Individual`;

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
      isSenderDomain(input.sender, 'youtube.com') ||
      isSenderDomain(input.sender, 'google.com');
    const confidence = trusted ? 0.95 : 0.72;

    return {
      parserId: this.id,
      parserVersion: this.version,
      confidence,
      items: [
        {
          providerName,
          merchantName: 'Google',
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
