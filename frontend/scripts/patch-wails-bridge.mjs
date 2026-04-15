import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const bridgePath = resolve(process.cwd(), 'wailsjs', 'go', 'backend', 'App.js');

if (!existsSync(bridgePath)) {
  process.exit(0);
}

const source = readFileSync(bridgePath, 'utf8');

if (source.startsWith('// @ts-check')) {
  const patched = source.replace('// @ts-check', '// @ts-nocheck');
  writeFileSync(bridgePath, patched, 'utf8');
  console.log('Patched wailsjs App.js header to @ts-nocheck');
}
