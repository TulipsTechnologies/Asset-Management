// server.js
//
// Custom server for iisnode, mirroring the sibling TulipsHRM Next.js apps'
// setup. Also reverse-proxies /asset-management/api/* to the AssetManagement
// API (/api/*) so the relative NEXT_PUBLIC_API_BASE=/asset-management keeps
// resolving same-origin when this app is served from its own subdomain rather
// than behind the gateway's path-based proxy.
const http = require('http');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

const API_PROXY_PREFIX = '/asset-management/api';

// Where /asset-management/api/* is forwarded. ONE server-side variable, the same
// one `next dev` rewrites with, so local and IIS agree. Host/port are still
// honoured for existing deployments that set them.
const parsedTarget = new URL(
  process.env.ASSET_API_PROXY_TARGET ||
    `http://${process.env.ASSET_API_HOST || 'localhost'}:${
      process.env.ASSET_API_PORT || 5199
    }`
);
const API_TARGET = {
  host: parsedTarget.hostname,
  port: Number(parsedTarget.port || (parsedTarget.protocol === 'https:' ? 443 : 80)),
};

// A data-exchange import commits thousands of rows in one transaction and can run for
// minutes. Every hop in front of it must outlast that, because a hop that gives up first
// hands the browser an error while the server keeps writing — and the operator's natural
// response, re-uploading, duplicates the whole file.
const API_PROXY_TIMEOUT_MS = 600000;

function proxyToApi(req, res, pathname, search) {
  const targetPath =
    '/api' + pathname.slice(API_PROXY_PREFIX.length) + (search || '');
  const proxyReq = http.request(
    {
      host: API_TARGET.host,
      port: API_TARGET.port,
      path: targetPath,
      method: req.method,
      headers: req.headers,
      timeout: API_PROXY_TIMEOUT_MS,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    }
  );
  // An explicit, honest 504 beats hanging forever if the API really is wedged.
  proxyReq.on('timeout', () => {
    proxyReq.destroy(new Error(`No response from the API within ${API_PROXY_TIMEOUT_MS / 1000}s`));
  });
  proxyReq.on('error', (err) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.statusCode = 504;
    res.end('Gateway Timeout: ' + err.message);
  });
  req.pipe(proxyReq, { end: true });
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    // Be sure to pass `true` as the second argument to `url.parse`.
    // This tells it to parse the query portion of the URL.
    const parsedUrl = parse(req.url, true);
    const { pathname, search } = parsedUrl;

    if (pathname && pathname.startsWith(API_PROXY_PREFIX)) {
      proxyToApi(req, res, pathname, search);
      return;
    }

    handle(req, res, parsedUrl);
  });

  // Node caps an inbound request at 5 minutes by default, which a large import can
  // exceed; keep this hop in step with the proxy above rather than letting the
  // shorter of the two decide.
  server.requestTimeout = API_PROXY_TIMEOUT_MS;
  server.headersTimeout = API_PROXY_TIMEOUT_MS;

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
