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

const NETFLIX_PLANS = ['Premium', 'Standard', 'Basic', 'Ad-supported'];

export const netflixReceiptParser: EmailReceiptParser = {
  id: 'netflix',
  version: 1,
  matches(input: ReceiptEmailInput): boolean {
    return (
      isSenderDomain(input.sender, 'netflix.com') ||
      /\bnetflix\b/i.test(`${input.subject}\n${input.body ?? ''}`)
    );
  },
  parse(input: ReceiptEmailInput): ReceiptParseResult {
    const content = plainText(emailContent(input));
    const money = findPreferredMoney(content);
    const plan = NETFLIX_PLANS.find((candidate) =>
      new RegExp(`\\b${candidate.replace('-', '[ -]')}\\b`, 'i').test(content),
    );
    const renewal = detectRenewalDate(content);
    const payment = detectPayment(content);

    if (!money) {
      return {
        parserId: this.id,
        parserVersion: this.version,
        confidence: 0,
        items: [],
        warnings: ['No Netflix billing amount was found.'],
      };
    }

    const confidence = isSenderDomain(input.sender, 'netflix.com')
      ? 0.97
      : 0.72;
    const planName = `Netflix ${plan ?? 'Imported Plan'}`;
    return {
      parserId: this.id,
      parserVersion: this.version,
      confidence,
      items: [
        {
          providerName: 'Netflix',
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
      warnings: plan ? [] : ['The Netflix plan name was not identified.'],
    };
  },
};
