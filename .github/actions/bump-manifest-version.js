const fs = require('node:fs');

const releaseTag = process.env.TGT_RELEASE_VERSION ?? '';
const version = releaseTag.replace(/^v/, '');

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid release tag: ${releaseTag}`);
}

const manifestPath = './fxmanifest.lua';
const manifest = fs.readFileSync(manifestPath, 'utf8');
const versionPattern = /^version\s+['"][^'"]+['"]$/m;

if (!versionPattern.test(manifest)) {
  throw new Error('Could not locate the fxmanifest version field');
}

const updated = manifest.replace(versionPattern, `version '${version}'`);
fs.writeFileSync(manifestPath, updated);
