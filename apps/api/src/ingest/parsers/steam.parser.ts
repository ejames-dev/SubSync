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

export const steamReceiptParser: EmailReceiptParser = {
  id: 'steam',
  version: 1,
  matches(input: ReceiptEmailInput): boolean {
    const text = `${input.subject}\n${input.body ?? ''}`;
    return (
      isSenderDomain(input.sender, 'steampowered.com') ||
      /\bsteam\s*(?:subscription|recurring|purchase)\b/i.test(text)
    );
  },
  parse(input: ReceiptEmailInput): ReceiptParseResult {
    const content = plainText(emailContent(input));
    const money = findPreferredMoney(content);
    const lifecycleIntent = detectLifecycleIntent(content);
    const renewal = detectRenewalDate(content);
    const payment = detectPayment(content);

    const planMatch = content.match(
      /\b(?:subscription|item|game)\s*:\s*([^\n]{3,60})/i,
    );
    const planName = planMatch?.[1]?.trim() ?? 'Steam Recurring Subscription';

    if (!money && lifecycleIntent !== 'cancellation') {
      return {
        parserId: this.id,
        parserVersion: this.version,
        confidence: 0,
        items: [],
        warnings: ['No Steam subscription billing amount was found.'],
      };
    }

    const confidence = isSenderDomain(input.sender, 'steampowered.com')
      ? 0.94
      : 0.7;

    return {
      parserId: this.id,
      parserVersion: this.version,
      confidence,
      items: [
        {
          providerName: 'Steam',
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
