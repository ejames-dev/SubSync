import { amazonPrimeReceiptParser } from './amazon-prime.parser';
import { appleReceiptParser } from './apple.parser';
import { disneyHuluReceiptParser } from './disney-hulu.parser';
import { genericReceiptParser } from './generic.parser';
import { googleYoutubeReceiptParser } from './google-youtube.parser';
import { microsoftXboxReceiptParser } from './microsoft-xbox.parser';
import { netflixReceiptParser } from './netflix.parser';
import {
  EmailReceiptParser,
  ReceiptEmailInput,
  ReceiptParseResult,
} from './parser.types';
import { playstationReceiptParser } from './playstation.parser';
import { spotifyReceiptParser } from './spotify.parser';
import { steamReceiptParser } from './steam.parser';

export const EMAIL_RECEIPT_PARSERS: readonly EmailReceiptParser[] = [
  appleReceiptParser,
  netflixReceiptParser,
  spotifyReceiptParser,
  amazonPrimeReceiptParser,
  disneyHuluReceiptParser,
  googleYoutubeReceiptParser,
  microsoftXboxReceiptParser,
  playstationReceiptParser,
  steamReceiptParser,
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
