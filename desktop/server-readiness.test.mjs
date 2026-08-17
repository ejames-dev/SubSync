import assert from 'node:assert/strict';
import http from 'node:http';
import { afterEach, test } from 'node:test';
import readiness from './server-readiness.cjs';

const { getServerStatus } = readiness;
const servers = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
});

async function listen(server) {
  servers.push(server);
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  assert(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}`;
}

test('reads readiness status with node:http', async () => {
  const url = await listen(
    http.createServer((_request, response) => {
      response.writeHead(204).end();
    }),
  );

  assert.equal(await getServerStatus(url), 204);
});

test('times out a stalled readiness request', async () => {
  const url = await listen(http.createServer(() => {}));
  await assert.rejects(getServerStatus(url, 50), /Timed out waiting/);
});
