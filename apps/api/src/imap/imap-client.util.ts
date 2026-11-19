import * as net from 'node:net';
import * as tls from 'node:tls';

export interface ImapConfig {
  host: string;
  port: number;
  tls: boolean;
  username: string;
  password: string;
  mailbox: string;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatImapSinceDate(date: Date): string {
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

export function quoteImapAtom(value: string): string {
  const sanitized = value.replace(/[\r\n]/g, '');
  return `"${sanitized.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export async function fetchRecentImapMessages(
  config: ImapConfig,
  options: {
    sinceDays?: number;
    maxMessages?: number;
    verifyOnly?: boolean;
  } = {},
): Promise<Array<{ uid: string; rawEml: string }>> {
  const socket: net.Socket = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('IMAP connection timed out.')),
      15_000,
    );
    const conn = config.tls
      ? tls.connect(
          {
            host: config.host,
            port: config.port,
            servername: config.host,
          },
          () => {
            clearTimeout(timer);
            resolve(conn);
          },
        )
      : net.createConnection({ host: config.host, port: config.port }, () => {
          clearTimeout(timer);
          resolve(conn);
        });
    conn.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  let buffer = Buffer.alloc(0);
  let tagCounter = 0;

  const waitForGreeting = () =>
    new Promise<void>((resolve, reject) => {
      const check = () => {
        const str = buffer.toString('utf8');
        if (/^\* (?:OK|PREAUTH)/m.test(str)) {
          socket.off('data', onData);
          resolve();
        } else if (/^\* BYE/m.test(str)) {
          socket.off('data', onData);
          reject(new Error('IMAP server rejected connection.'));
        }
      };
      const onData = (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        check();
      };
      socket.on('data', onData);
      check();
    });

  const sendCommand = (command: string): Promise<string> => {
    tagCounter += 1;
    const tag = `A${String(tagCounter).padStart(4, '0')}`;
    buffer = Buffer.alloc(0);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off('data', onData);
        reject(new Error(`IMAP command ${tag} timed out.`));
      }, 20_000);

      const onData = (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        const text = buffer.toString('utf8');
        const statusRegex = new RegExp(`^${tag} (OK|NO|BAD) (.*)$`, 'm');
        const match = text.match(statusRegex);
        if (!match) return;
        clearTimeout(timer);
        socket.off('data', onData);
        if (match[1] !== 'OK') {
          reject(new Error(`IMAP error: ${match[2].trim()}`));
        } else {
          resolve(text);
        }
      };

      socket.on('data', onData);
      socket.write(`${tag} ${command}\r\n`);
    });
  };

  try {
    await waitForGreeting();
    await sendCommand(
      `LOGIN ${quoteImapAtom(config.username)} ${quoteImapAtom(config.password)}`,
    );
    await sendCommand(`EXAMINE ${quoteImapAtom(config.mailbox || 'INBOX')}`);

    if (options.verifyOnly) {
      await sendCommand('LOGOUT').catch(() => undefined);
      return [];
    }

    const since = new Date(
      Date.now() - (options.sinceDays ?? 45) * 24 * 60 * 60 * 1000,
    );
    const searchResp = await sendCommand(
      `UID SEARCH SINCE ${formatImapSinceDate(since)}`,
    );
    const searchLine = searchResp
      .split(/\r?\n/)
      .find((line) => line.startsWith('* SEARCH'));
    const uids = (searchLine ?? '')
      .replace('* SEARCH', '')
      .trim()
      .split(/\s+/)
      .filter((token) => /^\d+$/.test(token))
      .slice(-(options.maxMessages ?? 25));

    const results: Array<{ uid: string; rawEml: string }> = [];
    for (const uid of uids) {
      const fetchResp = await sendCommand(`UID FETCH ${uid} (BODY.PEEK[])`);
      const literalMatch = fetchResp.match(/\{(\d+)\}\r?\n/);
      if (!literalMatch || literalMatch.index === undefined) {
        continue;
      }
      const startOffset = literalMatch.index + literalMatch[0].length;
      const byteLength = Number(literalMatch[1]);
      const rawBytes = Buffer.from(fetchResp, 'utf8').subarray(
        startOffset,
        startOffset + byteLength,
      );
      results.push({ uid, rawEml: rawBytes.toString('utf8') });
    }

    await sendCommand('LOGOUT').catch(() => undefined);
    return results;
  } finally {
    socket.destroy();
  }
}
