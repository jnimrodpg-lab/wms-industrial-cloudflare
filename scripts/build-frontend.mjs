import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const srcRoot = path.join(root, 'src', 'frontend');
const manifest = JSON.parse(fs.readFileSync(path.join(srcRoot, 'manifest.json'), 'utf8'));
const output = path.join(root, manifest.output);
const source = manifest.files.map(file => fs.readFileSync(path.join(srcRoot, file), 'utf8')).join('');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, source, 'utf8');
const hash = crypto.createHash('sha256').update(source).digest('hex');
console.log(`Frontend v${manifest.version}: ${manifest.files.length} fragmentos -> ${manifest.output}`);
console.log(`SHA-256 ${hash}`);
