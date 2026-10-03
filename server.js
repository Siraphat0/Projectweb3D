const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = 'd:\\UI\\playcanvas-tour';
const PORT = 8080;

const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.sog': 'application/octet-stream',
    '.glb': 'model/gltf-binary',
    '.mp4': 'video/mp4',
    '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    
    // Capture storage sync
    if (parsed.pathname === '/api/sync') {
        const data = parsed.query;
        console.log('[STORAGE_SYNC_RECEIVED]:', JSON.stringify(data));
        fs.writeFileSync(path.join(__dirname, 'synced_storage.json'), JSON.stringify(data, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    let filePath = path.join(ROOT, decodeURIComponent(parsed.pathname));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://127.0.0.1:${PORT}`);
});
