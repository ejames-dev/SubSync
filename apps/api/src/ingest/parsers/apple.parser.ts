import {
  averageConfidence,
  detectInterval,
  detectPayment,
  detectRenewalDate,
  emailContent,
  evidence,
  findMoney,
  isSenderDomain,
  plainText,
} from './parser.helpers';
import {
  EmailReceiptParser,
  ParsedReceiptItem,
  ReceiptEmailInput,
  ReceiptParseResult,
} from './parser.types';

const NON_PRODUCT_LINE =
  /^(?:apple|app store|receipt|invoice|subscription|description|price|order id|document no|apple id|billed to|payment method|subtotal|tax|total|monthly|quarterly|annual(?:ly)?|yearly)$/i;
const DATE_OR_PAYMENT_LINE =
  /(?:renews?|billing date|next charge|\b(?:visa|mastercard|amex|card)\b|\*{2,}\d{4})/i;
const TOTAL_LINE = /\b(?:subtotal|tax|total|balance|amount paid)\b/i;

function productName(
  lines: string[],
  amountLineIndex: number,
): string | undefined {
  const amountLine = lines[amountLineIndex];
  const inline = amountLine
    .replace(/(?:USD|EUR|GBP|CAD|AUD|\$|€|£)\s*[0-9]+(?:[.,][0-9]{2})?/gi, '')
    .replace(/[|–—-]+\s*$/, '')
    .trim();
  if (inline && !NON_PRODUCT_LINE.test(inline) && !TOTAL_LINE.test(inline)) {
    return inline;
  }

  for (
    let index = amountLineIndex - 1;
    index >= Math.max(0, amountLineIndex - 6);
    index -= 1
  ) {
    const line = lines[index].trim();
    if (
      line &&
      !findMoney(line).length &&
      !NON_PRODUCT_LINE.test(line) &&
      !DATE_OR_PAYMENT_LINE.test(line)
    ) {
      return line.replace(/^(?:item|product|subscription)\s*:\s*/i, '').trim();
    }
  }
  return undefined;
}

export const appleReceiptParser: EmailReceiptParser = {
  id: 'apple',
  version: 1,
  matches(input: ReceiptEmailInput): boolean {
    return (
      isSenderDomain(input.sender, 'apple.com') ||
      /\b(?:apple|app store)\b/i.test(`${input.subject}\n${input.body ?? ''}`)
    );
  },
  parse(input: ReceiptEmailInput): ReceiptParseResult {
    const content = plainText(emailContent(input));
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const trustedSender = isSenderDomain(input.sender, 'apple.com');
    const payment = detectPayment(content);
    const items: ParsedReceiptItem[] = [];
    const warnings: string[] = [];

    lines.forEach((line, index) => {
      if (TOTAL_LINE.test(line)) {
        return;
      }
      const money = findMoney(line)[0];
      if (!money) {
        return;
      }

      const name = productName(lines, index);
      if (!name) {
        warnings.push(`Could not identify the Apple product for ${money.raw}.`);
        return;
      }
      const context = lines.slice(Math.max(0, index - 4), index + 2).join('\n');
      const renewal = detectRenewalDate(context);
      const interval = detectInterval(context);
      const confidence = Number(
        (trustedSender ? (renewal || interval ? 0.95 : 0.86) : 0.65).toFixed(2),
      );

      items.push({
        providerName: name,
        merchantName: 'Apple',
        planName: name,
        billingAmount: money.amount,
        billingCurrency: money.currency,
        billingInterval: interval,
        nextRenewal: renewal?.iso,
        ...payment,
        confidence,
        evidence: evidence(money.raw, name, renewal?.raw),
      });
    });

    if (items.length === 0 && warnings.length === 0) {
      warnings.push('No Apple subscription line items were found.');
    }
    return {
      parserId: this.id,
      parserVersion: this.version,
      confidence: averageConfidence(items.map((item) => item.confidence)),
      items,
      warnings,
    };
  },
};
