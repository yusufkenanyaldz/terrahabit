// Three.js ve kullandığımız eklentileri node_modules'tan assets/lib altına kopyalar.
// Böylece uygulama CDN'e ihtiyaç duymadan, internetsiz çalışır.
// Kullanım (repo kökünde): npm ci && node NoralAliskanlik/scripts/vendor-three.mjs
import { readFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const three = resolve(here, '../../node_modules/three');
const out = resolve(here, '../app/src/main/assets/lib');
const jsm = join(three, 'examples/jsm');

// Çekirdek: three.module.js, three.core.js'i içe aktarır.
for (const f of ['three.module.js', 'three.core.js']) {
  mkdirSync(out, { recursive: true });
  copyFileSync(join(three, 'build', f), join(out, f));
}

// Doğrudan kullandığımız eklentiler; bağımlılıkları otomatik bulunur.
const entries = [
  'loaders/GLTFLoader.js',
  'loaders/DRACOLoader.js',
  'environments/RoomEnvironment.js',
  'postprocessing/ShaderPass.js',
  'controls/OrbitControls.js',
  'postprocessing/EffectComposer.js',
  'postprocessing/RenderPass.js',
  'postprocessing/UnrealBloomPass.js',
  'postprocessing/OutputPass.js',
];

const seen = new Set();
function copyAddon(rel) {
  if (seen.has(rel)) return;
  seen.add(rel);
  const src = join(jsm, rel);
  const dst = join(out, 'addons', rel);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  // Göreli importları ('./x.js', '../y/z.js') takip et.
  const code = readFileSync(src, 'utf8');
  for (const m of code.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
    copyAddon(relative(jsm, resolve(dirname(src), m[1])));
  }
}
entries.forEach(copyAddon);

// Draco çözücü (sıkıştırılmış GLB için).
const dracoSrc = join(jsm, 'libs/draco/gltf');
mkdirSync(join(out, 'draco'), { recursive: true });
for (const f of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
  if (existsSync(join(dracoSrc, f))) copyFileSync(join(dracoSrc, f), join(out, 'draco', f));
}
console.log('Kopyalanan eklentiler:', [...seen].join(', '));
