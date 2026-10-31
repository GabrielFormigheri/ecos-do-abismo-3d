// Miniaturas dos itens: o visual 3D de verdade (arma, armadura no herói, amuleto) desenhado uma vez numa
// textura pequena e guardado como imagem. A interface pede; o loop desenha no máximo uma por quadro.
import * as THREE from 'three';
import * as M from './models.js';
import { weaponVariant } from './core.js';

const SIZE = 112, cache = new Map(), queue = [], queued = new Set();
let rt = null, cam = null, ctx = null, readable = true;

// Chave: o que muda o desenho (tipo + raridade + estilo; armadura também pela classe que a veste).
export function thumbKey(it, cls) {
  if (it.slot === 'arma') return `w:${it.kind}:${it.rarity}:${weaponVariant(it)}`;
  if (it.slot === 'armadura') return `a:${cls}:${it.name}:${it.rarity}`;
  if (it.slot === 'amuleto') return `m:${it.name}:${it.rarity}`;
  return null;
}
// Devolve <img> se pronta; senão o ícone de reserva marcado para trocar quando a miniatura ficar pronta.
export function thumbHtml(it, cls, fallback) {
  const key = thumbKey(it, cls); if (!key) return fallback;
  const url = cache.get(key); if (url) return `<img class="ico thumb" src="${url}" alt="">`;
  if (!queued.has(key)) { queued.add(key); queue.push({ key, it:{ ...it }, cls }); }
  return `<span class="ico-wait" data-thumb="${key}">${fallback}</span>`;
}

// ACES (o mesmo do renderer) + sRGB: a textura fica em cor linear, sem o tone mapping da tela.
const aces = (r, g, b) => {
  r /= 0.6; g /= 0.6; b /= 0.6;
  const i = [0.59719 * r + 0.35458 * g + 0.04823 * b, 0.07600 * r + 0.90834 * g + 0.01566 * b, 0.02840 * r + 0.13383 * g + 0.83777 * b]
    .map(v => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081));
  return [1.60475 * i[0] - 0.53108 * i[1] - 0.07367 * i[2], -0.10208 * i[0] + 1.10813 * i[1] - 0.00605 * i[2], -0.00327 * i[0] - 0.07276 * i[1] + 1.07602 * i[2]];
};
const srgb = v => { v = Math.min(1, Math.max(0, v)); return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };

// Monta o objeto longe do mundo (y -400), enquadra, desenha na textura e lê os pixels.
export function pumpThumbs(renderer, scene) {
  const job = queue.shift(); if (!job) return;
  const { key, it, cls } = job;
  if (!rt) {
    rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { type:THREE.HalfFloatType });
    readable = renderer.capabilities.textureTypeReadable(THREE.HalfFloatType);
    if (!readable) { rt.dispose(); rt = new THREE.WebGLRenderTarget(SIZE, SIZE); }
    cam = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    const c = document.createElement('canvas'); c.width = c.height = SIZE; ctx = c.getContext('2d');
  }
  const holder = new THREE.Group(); holder.position.set(0, -400, 0); scene.add(holder);
  let hero = null, obj;
  if (it.slot === 'armadura') {
    hero = M.createHeroRig({ cls, armor:it.rarity, armorName:it.name });
    hero.rig.base('Idle', 'Running_A'); hero.update(0.4, 0); obj = hero.root; obj.rotation.y = 0.4;
  } else if (it.slot === 'arma') {
    obj = M.createWeapon(it.kind, it.rarity, { fx:false, variant:weaponVariant(it) }).group; obj.rotation.z = it.kind === 'arco' ? -0.5 : -Math.PI / 4;
  } else obj = M.createItemModel(it);
  holder.add(obj); holder.updateMatrixWorld(true); hero?.update(0, 0);
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), at = box.getCenter(new THREE.Vector3());
  let span = Math.max(size.x, size.y) * 1.08;
  // Armadura: retrato da cintura para cima (onde ficam chapéu, capacete e enfeites).
  if (hero) { span = size.y * 0.62; at.y = box.max.y - span * 0.5; }
  cam.position.set(at.x, at.y + span * 0.05, at.z + span / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) + size.z / 2);
  cam.lookAt(at);
  const bg = scene.background, prevRt = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  scene.background = null;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
  const img = ctx.createImageData(SIZE, SIZE), px = readable ? new Uint16Array(SIZE * SIZE * 4) : new Uint8Array(SIZE * SIZE * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, px);
  renderer.setRenderTarget(prevRt); renderer.setClearColor(prevClear, prevAlpha); scene.background = bg;
  const f = readable ? v => THREE.DataUtils.fromHalfFloat(v) : v => v / 255;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const s = ((SIZE - 1 - y) * SIZE + x) * 4, d = (y * SIZE + x) * 4, [r, g, b] = aces(f(px[s]), f(px[s + 1]), f(px[s + 2]));
    img.data[d] = srgb(r); img.data[d + 1] = srgb(g); img.data[d + 2] = srgb(b); img.data[d + 3] = Math.min(255, f(px[s + 3]) * 255);
  }
  ctx.putImageData(img, 0, 0);
  const url = ctx.canvas.toDataURL('image/png'); cache.set(key, url);
  if (hero) hero.dispose(); M.disposeTree(obj); holder.removeFromParent();
  for (const el of document.querySelectorAll(`[data-thumb="${CSS.escape(key)}"]`)) el.outerHTML = `<img class="ico thumb" src="${url}" alt="">`;
}
