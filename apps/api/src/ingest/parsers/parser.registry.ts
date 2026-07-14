import { appleReceiptParser } from './apple.parser';
import { genericReceiptParser } from './generic.parser';
import { netflixReceiptParser } from './netflix.parser';
import { spotifyReceiptParser } from './spotify.parser';
import {
  EmailReceiptParser,
  ReceiptEmailInput,
  ReceiptParseResult,
} from './parser.types';

export const EMAIL_RECEIPT_PARSERS: readonly EmailReceiptParser[] = [
  appleReceiptParser,
  netflixReceiptParser,
  spotifyReceiptParser,
  genericReceiptParser,
];

export function selectEmailReceiptParser(
  input: ReceiptEmailInput,
  parsers: readonly EmailReceiptParser[] = EMAIL_RECEIPT_PARSERS,
): EmailReceiptParser {
  return (
    parsers.find((parser) => parser.matches(input)) ?? genericReceiptParser
  );
}

export function parseEmailReceipt(
  input: ReceiptEmailInput,
): ReceiptParseResult {
  return selectEmailReceiptParser(input).parse(input);
}
