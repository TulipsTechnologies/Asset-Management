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
const API_TARGET = {
  host: process.env.ASSET_API_HOST || 'localhost',
  port: Number(process.env.ASSET_API_PORT || 5199),
};

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
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    }
  );
  proxyReq.on('error', (err) => {
    res.statusCode = 502;
    res.end('Bad Gateway: ' + err.message);
  });
  req.pipe(proxyReq, { end: true });
}

app.prepare().then(() => {
  createServer((req, res) => {
    // Be sure to pass `true` as the second argument to `url.parse`.
    // This tells it to parse the query portion of the URL.
    const parsedUrl = parse(req.url, true);
    const { pathname, search } = parsedUrl;

    if (pathname && pathname.startsWith(API_PROXY_PREFIX)) {
      proxyToApi(req, res, pathname, search);
      return;
    }

    handle(req, res, parsedUrl);
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
