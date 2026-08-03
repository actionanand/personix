#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve('android-version.json');
const version = JSON.parse(fs.readFileSync(file, 'utf8'));
const flag = process.argv[2];
version.versionCode = Number(version.versionCode) + 1;
if (flag) {
  const match = String(version.versionName).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error('versionName must use major.minor.patch format.');
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);
  if (flag === '--major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (flag === '--minor') {
    minor += 1;
    patch = 0;
  } else if (flag === '--patch') patch += 1;
  else throw new Error(`Unknown version flag: ${flag}`);
  version.versionName = `${major}.${minor}.${patch}`;
}
fs.writeFileSync(file, `${JSON.stringify(version, null, 2)}\n`);
console.log(`Personix Android ${version.versionName} (${version.versionCode})`);
