const https = require('https');
const fs = require('fs');
const path = require('path');

const center = { x: 102973, y: 59453, z: 17 };
const outDir = 'D:/UI/playcanvas-tour/map/tiles';

function download(url, filePath) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(filePath);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KKUTour/1.0' } }, res => {
      if (res.statusCode === 200) {
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(true); });
      } else {
        file.close();
        fs.unlink(filePath, () => {});
        resolve(false);
      }
    }).on('error', () => {
      fs.unlink(filePath, () => {});
      resolve(false);
    });
  });
}

async function main() {
  console.log('Downloading Street Map tiles...');
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const tx = center.x + dx;
      const ty = center.y + dy;
      // OSM street tile
      const osmUrl = 'https://tile.openstreetmap.org/17/' + tx + '/' + ty + '.png';
      const osmPath = path.join(outDir, 'osm_' + dx + '_' + dy + '.png');
      const s1 = await download(osmUrl, osmPath);

      // ESRI Satellite tile
      const esriUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/' + ty + '/' + tx;
      const esriPath = path.join(outDir, 'sat_' + dx + '_' + dy + '.jpg');
      const s2 = await download(esriUrl, esriPath);
      console.log('Downloaded dx:', dx, 'dy:', dy, 'OSM:', s1, 'ESRI:', s2);
    }
  }
  console.log('Done downloading tiles.');
}
main();
