const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const mounts = {
  senddudes: 'C:/trontstack/senddudes',
  froxel: 'C:/trontstack/froxel',
  ltc: 'C:/trontstack/ltc',
  'aqua-empire': 'C:/trontstack/aqua-empire',
  slopeloop: 'C:/trontstack/slopeloop/dist',
  ringriot: 'C:/trontstack/ringriot/dist',
  fellswoop: 'C:/trontstack/fellswoop',
  inkride: 'C:/trontstack/inkride',
  tinytreads: 'C:/trontstack/tinytreads',
  breakmass: path.join(root, '.local/sources/breakmass'),
};
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.mp4':'video/mp4','.webm':'video/webm','.wasm':'application/wasm'};
function createServer() {
  return http.createServer((req,res) => {
    try {
      let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let base = root;
      const match = name.match(/^\/capture\/([^/]+)(\/.*)?$/);
      if (match) { base = path.resolve(mounts[match[1]] || path.join(root,'.local/sources',match[1])); name = match[2] || '/'; }
      let file = path.resolve(base, '.' + name);
      if (file !== base && !file.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      const stat = fs.statSync(file);
      const headers = {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges':'bytes', 'Cache-Control': /\.(mp4|webp)$/.test(file) ? 'public, max-age=3600' : 'no-cache'};
      let start = 0, end = stat.size - 1, status = 200;
      if (req.headers.range) {
        const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
        if (!range) { res.writeHead(416); return res.end(); }
        start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]),end) : end;
        if (start > end) { res.writeHead(416, {'Content-Range':`bytes */${stat.size}`}); return res.end(); }
        status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length'] = end - start + 1;
      res.writeHead(status, headers);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file,{start,end}).pipe(res);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
}
module.exports = {createServer, root, mounts};
if (require.main === module) createServer().listen(Number(process.env.PORT || 8965),'127.0.0.1',()=>console.log('Local gallery: http://127.0.0.1:8965/games/'));
