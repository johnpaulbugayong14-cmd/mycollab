const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version || '')) throw new Error('Usage: node scripts/create-release.js 1.1.0');
const source = path.resolve(__dirname, '..', 'www');
const destination = path.resolve(__dirname, '..', 'updates', 'releases', version);
const allowedExtensions = new Set(['.html', '.css', '.js', '.json', '.rules', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.otf']);

if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });

function copyDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'api' || entry.name === 'backend') continue;
    const sourcePath = path.join(from, entry.name);
    const destinationPath = path.join(to, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, destinationPath);
    else if (entry.name !== 'manifest.json' && allowedExtensions.has(path.extname(entry.name).toLowerCase())) fs.copyFileSync(sourcePath, destinationPath);
  }
}

function collectFiles(directory, root = directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(filePath, root);
    const bytes = fs.readFileSync(filePath);
    return [{ path: path.relative(root, filePath).replaceAll(path.sep, '/'), size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }];
  });
}

copyDirectory(source, destination);
const files = collectFiles(destination).sort((left, right) => left.path.localeCompare(right.path));
const appManifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify({ ...appManifest, version, files }, null, 2) + '\n');
console.log(`Created ${destination} with ${files.length} files.`);
