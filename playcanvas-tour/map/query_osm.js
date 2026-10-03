const https = require('https');
const query = encodeURIComponent(`[out:json];(way["building"](16.471,102.821,16.476,102.827););out geom;`);
const url = 'https://overpass-api.de/api/interpreter?data=' + query;
https.get(url, { headers: { 'User-Agent': 'KKU-Tour-App/1.0' } }, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(d);
      console.log('OSM elements found:', j.elements.length);
      j.elements.forEach(e => {
        if (e.tags && (e.tags.name || e.tags['name:en'] || e.tags['building:levels'])) {
          console.log(e.id, e.tags.name || e.tags['name:en'], 'levels:', e.tags['building:levels'], 'geom len:', e.geometry?.length);
        }
      });
    } catch(e) { console.log('Err:', e.message); }
  });
});
