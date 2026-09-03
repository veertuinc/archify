import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(__dirname, '../docs/assets');
const fontSourceRoot = path.resolve(__dirname, '../archify/assets/fonts');
const SITE_ASSETS = Object.freeze([
  'site-navigation.css',
]);
const BRAND_FONTS = Object.freeze([
  'MuseoSansRounded-300.woff2',
  'MuseoSansRounded-500.woff2',
]);

export function copySiteAssets(outputHtmlPath) {
  const targetRoot = path.join(path.dirname(path.resolve(outputHtmlPath)), 'assets');
  fs.mkdirSync(targetRoot, { recursive: true });

  for (const asset of SITE_ASSETS) {
    const source = path.join(sourceRoot, asset);
    const target = path.join(targetRoot, asset);
    if (path.resolve(source) !== path.resolve(target)) fs.copyFileSync(source, target);
  }

  const fontTargetRoot = path.join(targetRoot, 'fonts');
  fs.mkdirSync(fontTargetRoot, { recursive: true });
  for (const font of BRAND_FONTS) {
    const source = path.join(fontSourceRoot, font);
    const target = path.join(fontTargetRoot, font);
    if (path.resolve(source) !== path.resolve(target)) fs.copyFileSync(source, target);
  }
}
