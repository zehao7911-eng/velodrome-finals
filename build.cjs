const fs = require('node:fs');
const path = require('node:path');

const read = (file, encoding) => fs.readFileSync(path.join(__dirname, file), encoding);
const modules = ['core.mjs', 'view.mjs', 'sdk.mjs', 'app.mjs'];
const code = modules.map(file => read(file, 'utf8')
  .replace(/^import .*?;\s*/gm, '')
  .replace(/\bexport\s+/g, '')).join('\n');
const library = read('vendor/three.min.js', 'utf8');
const track = 'music/pixel-peeker-polka-faster.mp3';
const audio = read(track);
let html = read('index-source.html', 'utf8');
if (!html.includes('src="' + track + '"') || !audio.length) throw Error('Missing soundtrack in source build');
html = html
  .replace('<link rel="stylesheet" href="style.css">', () => '<style>' + read('style.css', 'utf8') + '</style>')
  .replace('<script src="vendor/three.min.js"></script>', () => '<script>' + library.replace(/<\/script/gi, '<\\/script') + '</script>')
  .replace('<script type="module" src="app.mjs"></script>', () => '<script>(()=>{' + code + '})();</script>')
  .replace('src="' + track + '"', () => 'src="data:audio/mpeg;base64,' + audio.toString('base64') + '"');
for (const file of ['index.html', 'standalone.html']) fs.writeFileSync(path.join(__dirname, file), html);
console.log('Built offline Velodrome Finals ' + Buffer.byteLength(html) + ' bytes');
