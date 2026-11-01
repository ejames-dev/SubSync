const http = require('node:http');

function getServerStatus(url, timeoutMs = 1000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolvePromise(response.statusCode ?? 0);
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timed out waiting for ${url}`));
    });
    request.on('error', rejectPromise);
  });
}

module.exports = { getServerStatus };
