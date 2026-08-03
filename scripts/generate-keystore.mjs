#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import readline from 'node:readline/promises';

const output = 'release-keystore.jks';
const key = '.personix-release-key.pem';
const cert = '.personix-release-cert.pem';
const alias = 'personix';
const passwordIndex = process.argv.indexOf('--password');
if (passwordIndex >= 0 && passwordIndex === process.argv.length - 1) {
  console.error("Usage: npm run generate-keystore -- --password 'YOUR_STRONG_PASSWORD'");
  process.exit(1);
}

const argumentPassword = passwordIndex >= 0 ? process.argv[passwordIndex + 1] : null;
let password = argumentPassword ?? process.env.KEYSTORE_PASSWORD ?? null;
if (password === null) {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  input._writeToOutput = (value) => {
    if (value.includes('Enter keystore password')) input.output.write(value);
  };
  password = await input.question('Enter keystore password: ');
  input.output.write('\n');
  input.close();
}
if (!password) {
  console.error('Password cannot be empty.');
  process.exit(1);
}
const run = (command, args, environment = {}) =>
  execFileSync(command, args, { env: { ...process.env, ...environment }, stdio: 'pipe' });
const clean = () => {
  for (const file of [key, cert]) if (existsSync(file)) rmSync(file);
};
try {
  run('openssl', ['version']);
  if (existsSync(output)) rmSync(output);
  run('openssl', ['genrsa', '-out', key, '2048']);
  run('openssl', [
    'req',
    '-new',
    '-x509',
    '-key',
    key,
    '-out',
    cert,
    '-days',
    '9125',
    '-subj',
    '/CN=Personix/O=Personix/C=IN',
  ]);
  run(
    'openssl',
    [
      'pkcs12',
      '-export',
      '-in',
      cert,
      '-inkey',
      key,
      '-out',
      output,
      '-name',
      alias,
      '-passout',
      'env:OPENSSL_PASS',
    ],
    { OPENSSL_PASS: password },
  );
  clean();
  console.log(`Created ${output}\nAlias: ${alias}\nFormat: PKCS12`);
} catch (error) {
  clean();
  console.error(error instanceof Error ? error.message : 'Keystore generation failed.');
  process.exit(1);
}
