// Modelos 3D e efeitos gerados por código. Tudo blocado/low-poly; o brilho vem de material emissivo + bloom.
import * as THREE from 'three';
import { attackPhase } from './hero-animation.js';
import { applySkinCosmetics, visualBodyForSkin, PROCEDURAL_SKIN_LOOK } from './skin-cosmetics.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RARITY, weaponVariant } from './core.js';

let scene = null;
export const setScene = s => { scene = s; };

// Paletas por tema: terreno, céu, luz, vegetação e partículas de ambiente.
export const THEMES = {
  esmeralda:  { mob:0x56d36b, accent:0x3fffa0, wall:0x6d7a72, grass:0x5d9e45, grass2:0x86c45a, dirt:0xa88a5e, rock:0x7f858c, sand:0xd8c48e, top:0x9aa0a6,
    skyTop:0x5aa8ff, horizon:0xd6ecff, fog:0xc4e2f4, hemiSky:0xe4f3ff, hemiGround:0x4f6e37, sun:0xfff0d0, sunI:2.0, water:0x3f9fdc, lake:'water',
    trees:['pine', 'round'], leaf:[0x3f8f3a, 0x5aa83f, 0x2f7a3a, 0x6cb84a], trunk:0x6b4a2f, flower:[0xffffff, 0xffe066, 0xff7ab8, 0x9ad8ff], ambient:'fireflies', amb:0xe0ff8a, stone:0x9a9a94 },
  crepusculo: { mob:0xff8ac8, accent:0xff7ad9, wall:0x7a6a8a, grass:0x5f7d6e, grass2:0x86a088, dirt:0x9a7a86, rock:0x7a7090, sand:0xd8b8c0, top:0xa99ab8,
    skyTop:0x2b2366, horizon:0xffa3b8, fog:0xd890ac, hemiSky:0xffc3dc, hemiGround:0x3e3358, sun:0xffb48a, sunI:2.2, water:0x7a6ad8, lake:'water',
    trees:['blossom', 'round'], leaf:[0xff8ac8, 0xffb8e0, 0xe07ad6, 0xfff0f6], trunk:0x5a3a4a, flower:[0xfff0a0, 0xff7ad9, 0x9ad8ff, 0xffffff], ambient:'petals', amb:0xffc0e0, stone:0x9a90a8 },
  cinzas:     { mob:0xff8a3a, accent:0xff6a1a, wall:0x5a4a44, grass:0x4a3c36, grass2:0x5c4a40, dirt:0x6e5646, rock:0x3a3236, sand:0x2a2220, top:0x2a2428,
    skyTop:0x2a0c08, horizon:0xff8a4a, fog:0x7a3420, hemiSky:0xffa070, hemiGround:0x2a1410, sun:0xffb070, sunI:2.0, water:0xff5a10, lake:'lava',
    trees:['dead', 'spike'], leaf:[0x2a2226, 0x3a3034], trunk:0x2a2222, flower:[0xff6a1a, 0xffb040], ambient:'embers', amb:0xff8a2a, stone:0x5a5052 },
  vazio:      { mob:0x8f7bff, accent:0x7a6bff, wall:0x3a3a6a, grass:0x34346a, grass2:0x464684, dirt:0x55509a, rock:0x262650, sand:0x1a1a3a, top:0x5a5aa0,
    skyTop:0x04041a, horizon:0x3a2a80, fog:0x1e1648, hemiSky:0x9a8bff, hemiGround:0x15103a, sun:0xd0c4ff, sunI:2.2, water:0, lake:'void',
    trees:['crystal'], treeMin:5, leaf:[0x8f7bff, 0x5ff2ff, 0xff7ad9], trunk:0x2a2a50, flower:[0x8f7bff, 0x5ff2ff], ambient:'motes', amb:0xb8a8ff, stone:0x4a4a7a },
  cemiterio:  { mob:0x7dffb0, accent:0x7dffb0, wall:0x4a4a58, grass:0x2f3d3a, grass2:0x3f5048, dirt:0x4a4038, rock:0x55556a, sand:0x3a3a40, top:0x6a6a80,
    skyTop:0x05061a, horizon:0x2a3a5a, fog:0x1a2238, hemiSky:0x8aa0ff, hemiGround:0x101814, sun:0xa8c0ff, sunI:1.5, water:0x1a3a4a, lake:'water',
    trees:['dead', 'spooky'], leaf:[0x2a2226], trunk:0x2a2222, flower:[0x7dffb0, 0xffb040], ambient:'fireflies', amb:0x9affc8, stone:0x6a6a78,
    decor:[['gravestone', 2.2], ['grave_A', 2], ['grave_B', 2], ['gravemarker_A', 2.2], ['pumpkin_orange_jackolantern', 1.6], ['pumpkin_orange', 1.6], ['candle_triple', 2], ['post_lantern', 1.6], ['coffin', 1.6]] },
  // Caverna: chão de pedra, paredes íngremes, pouca luz; o brilho vem dos cristais e cogumelos.
  caverna:    { mob:0x9ad8ff, accent:0x5ff2ff, wall:0x3a3638, grass:0x6e6256, grass2:0x7e705e, dirt:0x5e5044, rock:0x1e1b22, sand:0x3a3436, top:0x16141a,
    skyTop:0x05040a, horizon:0x14101a, fog:0x0c0a12, fogNear:30, fogFar:66, hemiSky:0x7088b8, hemiGround:0x15100c, sun:0xa8c0ff, sunI:1.1, water:0x123048, lake:'water', land:'cave',
    trees:['spike'], treeMin:3.5, leaf:[0x5ff2ff, 0x8f7bff, 0x3fffa0], trunk:0x3a3438, flower:[0x5ff2ff, 0x8affd0, 0xb08aff], ambient:'motes', amb:0x7fe9ff, stone:0x5a5458,
    decor:[['skull', 1.2], ['ribcage', 1.3], ['bone_A', 1.5], ['bone_B', 1.5], ['rock_single_A', 2.2]] },
  // Magma: ilhas de basalto num mar de lava, pontes de madeira.
  magma:      { mob:0xffaa44, accent:0xff8a1a, wall:0x4a3a34, grass:0x3a302c, grass2:0x4a3c34, dirt:0x5a3a28, rock:0x221c1e, sand:0x8a3a14, top:0x161214,
    skyTop:0x1a0604, horizon:0xff5a20, fog:0x4a160a, fogNear:36, fogFar:90, hemiSky:0xffa070, hemiGround:0x4a1408, sun:0xffa060, sunI:1.8, water:0xff4a08, lake:'lava', land:'lava',
    trees:['spike', 'dead'], leaf:[0x2a2226], trunk:0x241e20, flower:[0xff6a1a, 0xffb040], ambient:'embers', amb:0xff8a2a, stone:0x4a3c38 },
  // Gelo: salões em ruínas com neve, lagos congelados.
  gelo:       { mob:0xbfe8ff, accent:0x8fe0ff, wall:0x6a7688, grass:0xa4b6c8, grass2:0x94a8bc, dirt:0x7a8ea4, rock:0x5a6a80, sand:0x9fb2c4, top:0xd8e4ee,
    skyTop:0x3a5a88, horizon:0xb0c8e0, fog:0x8ea6c0, hemiSky:0xb8cce8, hemiGround:0x4a5a70, sun:0xe0ecff, sunI:1.4, water:0x8fc4e8, lake:'water',
    trees:['dead', 'crystal'], leaf:[0xbfe8ff, 0x8fd0ff, 0xe8f6ff], trunk:0x4a5464, flower:[0xffffff, 0xbfe8ff], ambient:'snow', amb:0xdfefff, stone:0x6e7a8c },
  hub:        { mob:0xffffff, accent:0x3fe0ff, wall:0x8a8a90, grass:0x62a84a, grass2:0x8acb5e, dirt:0xb09466, rock:0x868c92, sand:0xd8c48e, top:0x9aa0a6,
    skyTop:0x4aa0ff, horizon:0xdff0ff, fog:0xcde8f8, hemiSky:0xe8f6ff, hemiGround:0x52733a, sun:0xfff2d8, sunI:1.9, water:0x3f9fdc, lake:'water',
    trees:['round', 'pine'], leaf:[0x4f9f3f, 0x6cb84a, 0x3f8f3a], trunk:0x6b4a2f, flower:[0xffffff, 0xffe066, 0xff7ab8], ambient:'fireflies', amb:0xfff0a0, stone:0x9c968a },
};

// ---------- helpers ----------
export const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness:0.75, metalness:0.05, flatShading:true, ...opts });
export const glow = (color, k = 4) => new THREE.MeshBasicMaterial({ color:new THREE.Color(color).multiplyScalar(k) });
export const additive = (color, opacity = 1, extra = {}) => new THREE.MeshBasicMaterial({ color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false, ...extra });
// Geometrias reaproveitadas entre objetos: nunca descartar as marcadas como shared.
const GEOS = new Map();
export const shared = (key, make) => { let g = GEOS.get(key); if (!g) { g = make(); g.userData.shared = true; GEOS.set(key, g); } return g; };
export function disposeTree(obj) { obj.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (!m.userData.shared) m.dispose(); }); }); }
export function box(w, h, d, m) { const mesh = new THREE.Mesh(shared(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), m); mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
export const rarityColor = id => RARITY[id].color;

export const dotTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- partículas ----------
export class Sparks {
  constructor({ count, color, size, spawn, vel, life = [0.5, 1.2] }) {
    Object.assign(this, { count, spawn, vel, lifeRange:life });
    this.pos = new Float32Array(count * 3); this.v = new Float32Array(count * 3); this.life = new Float32Array(count);
    for (let i = 0; i < count; i++) { this.life[i] = Math.random() * life[1]; this.pos[i * 3 + 1] = -99; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color:new THREE.Color(color).multiplyScalar(3), size, map:dotTex, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
    this.points.frustumCulled = false; scene.add(this.points);
    this.tmp = new THREE.Vector3();
  }
  update(dt) {
    for (let i = 0; i < this.count; i++) {
      const j = i * 3; this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.spawn(this.tmp); this.pos[j] = this.tmp.x; this.pos[j + 1] = this.tmp.y; this.pos[j + 2] = this.tmp.z;
        this.vel(this.tmp); this.v[j] = this.tmp.x; this.v[j + 1] = this.tmp.y; this.v[j + 2] = this.tmp.z;
        this.life[i] = rnd(this.lifeRange[0], this.lifeRange[1]);
      } else {
        this.pos[j] += this.v[j] * dt; this.pos[j + 1] += this.v[j + 1] * dt; this.pos[j + 2] += this.v[j + 2] * dt;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
  dispose() { scene.remove(this.points); this.points.geometry.dispose(); this.points.material.dispose(); }
}

// Pool único para explosões, acertos e mortes: cor esmaece com a vida (blend aditivo).
export class Burst {
  constructor(cap = 900) {
    this.cap = cap; this.next = 0;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.base = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap).fill(1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size:0.22, map:dotTex, vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
    this.points.frustumCulled = false; scene.add(this.points);
    this.c = new THREE.Color();
  }
  emit(p, color, n = 12, speed = 5, life = 0.6, up = 2) {
    this.c.set(color).multiplyScalar(2.5);
    for (let k = 0; k < n; k++) {
      const i = this.next, j = i * 3; this.next = (this.next + 1) % this.cap;
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.pos[j] = p.x; this.pos[j + 1] = p.y; this.pos[j + 2] = p.z;
      this.vel[j] = Math.cos(a) * s; this.vel[j + 1] = up * (0.5 + Math.random()) ; this.vel[j + 2] = Math.sin(a) * s;
      this.base[j] = this.c.r; this.base[j + 1] = this.c.g; this.base[j + 2] = this.c.b;
      this.life[i] = this.max[i] = life * (0.6 + Math.random() * 0.6);
    }
  }
  update(dt) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      const j = i * 3; this.life[i] -= dt;
      const f = Math.max(0, this.life[i] / this.max[i]);
      this.vel[j] *= 1 - dt * 2.5; this.vel[j + 2] *= 1 - dt * 2.5; this.vel[j + 1] -= 7 * dt;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] = Math.max(0.05, this.pos[j + 1] + this.vel[j + 1] * dt); this.pos[j + 2] += this.vel[j + 2] * dt;
      this.col[j] = this.base[j] * f; this.col[j + 1] = this.base[j + 1] * f; this.col[j + 2] = this.base[j + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export class Trail {
  constructor(color, len = 22) {
    this.len = len; this.filled = false;
    this.pos = new Float32Array(len * 6); const col = new Float32Array(len * 6), c = new THREE.Color(color).multiplyScalar(2.5);
    for (let i = 0; i < len; i++) {
      const f = Math.pow(1 - i / (len - 1), 1.5);
      for (let v = 0; v < 2; v++) { const k = f * (v ? 1 : 0.25), o = (i * 2 + v) * 3; col[o] = c.r * k; col[o + 1] = c.g * k; col[o + 2] = c.b * k; }
    }
    const idx = [];
    for (let i = 0; i < len - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }));
    this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  push(b, t) {
    this.pos.copyWithin(6, 0, (this.len - 1) * 6);
    this.pos.set([b.x, b.y, b.z, t.x, t.y, t.z], 0);
    if (!this.filled) { for (let i = 1; i < this.len; i++) this.pos.copyWithin(i * 6, 0, 6); this.filled = true; }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
  dispose() { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

// ---------- herói ----------
const SKIN_LOOK = {
  aventureiro: { head:0xf1c27d, torso:0x3f7d4e, arms:0x3f7d4e, legs:0x4a3828, metal:{} },
  celestial:   { head:0xe8ecf5, torso:0xe8ecf5, arms:0xdfe4ee, legs:0xc9ced9, metal:{ metalness:0.75, roughness:0.3 } },
  ceifador:    { head:0x2a2a36, torso:0x1b1b24, arms:0x22222e, legs:0x15151c, metal:{ roughness:0.9 } },
  arcanista:   { head:0xc89f7a, torso:0x1d2a6b, arms:0x23317a, legs:0x162057, metal:{} },
};
const ARMOR_LOOK = {
  comum:    { c:0x7d6a55, o:{} },
  raro:     { c:0x9fc9ff, o:{ metalness:0.8, roughness:0.3, emissive:0x1d5cff, emissiveIntensity:0.25 } },
  epico:    { c:0x6a35d6, o:{ metalness:0.5, roughness:0.3, emissive:0x9b3dff, emissiveIntensity:0.7 } },
  lendario: { c:0xffcf6a, o:{ metalness:0.85, roughness:0.25, emissive:0xff8a1a, emissiveIntensity:0.6 } },
  mitico:   { c:0x5a0a18, o:{ metalness:0.8, roughness:0.25, emissive:0xe8173f, emissiveIntensity:0.8 } },
};

export function createHero({ skin = 'aventureiro', armor = null, amulet = null } = {}) {
  const S = PROCEDURAL_SKIN_LOOK[skin] ?? SKIN_LOOK[skin] ?? SKIN_LOOK.aventureiro;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const limb = (x, y, w, h, d, m) => { const pivot = new THREE.Group(); pivot.position.set(x, y, 0); const b = box(w, h, d, m); b.position.y = -h / 2; pivot.add(b); return pivot; };
  const legM = mat(S.legs, S.metal), armM = mat(S.arms, S.metal);
  const legL = limb(-0.3, 1.2, 0.48, 1.2, 0.52, legM), legR = limb(0.3, 1.2, 0.48, 1.2, 0.52, legM);
  root.add(legL, legR);
  const torso = box(1.15, 1.2, 0.62, mat(S.torso, S.metal)); torso.position.y = 1.8; body.add(torso);
  const head = new THREE.Group(); head.position.y = 2.85; body.add(head);
  head.add(box(0.85, 0.85, 0.85, mat(S.head, S.metal)));
  const armL = limb(-0.8, 2.3, 0.4, 1.1, 0.46, armM), armR = limb(0.8, 2.3, 0.4, 1.1, 0.46, armM);
  body.add(armL, armR);
  const mount = new THREE.Group(); mount.position.set(0, -1.05, 0.08); armR.add(mount);
  const hero = { skin, root, body, head, armL, armR, legL, legR, mount, sparks:[], orbit:[], mats:[] };
  const eyes = (color, k) => { for (const x of [-0.17, 0.17]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.02), k ? glow(color, k) : mat(color)); e.position.set(x, 0.02, 0.435); head.add(e); } };
  const cape = color => { const c = new THREE.Group(); c.position.set(0, 2.35, -0.34); body.add(c); const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.95), mat(color, { side:THREE.DoubleSide })); cloth.position.y = -0.97; cloth.castShadow = true; c.add(cloth); hero.cape = c; };
  let skinPads = null;

  if (skin === 'aventureiro') {
    eyes(0x1a1a1a);
    const hair = mat(0x5a3418);
    const top = box(0.9, 0.22, 0.9, hair); top.position.y = 0.42; head.add(top);
    const fringe = box(0.9, 0.16, 0.1, hair); fringe.position.set(0, 0.26, 0.42); head.add(fringe);
  } else if (skin === 'celestial') {
    skinPads = mat(0xffc94a, { metalness:0.85, roughness:0.25 });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.13, 0.02), glow(0x5ff2ff, 5)); visor.position.set(0, 0.05, 0.435); head.add(visor);
    const crest = box(0.12, 0.35, 0.7, skinPads); crest.position.y = 0.55; head.add(crest);
    cape(0x6b1fbf);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 8, 40), glow(0xffd36b, 3)); halo.position.y = 0.78; halo.rotation.x = Math.PI / 2; head.add(halo); hero.halo = halo;
  } else if (skin === 'ceifador') {
    const hood = box(1.0, 1.0, 1.0, mat(0x111118, { roughness:1 })); hood.position.set(0, 0.06, -0.05); head.add(hood);
    const face = box(0.7, 0.55, 0.05, mat(0x050507)); face.position.set(0, -0.02, 0.46); head.add(face);
    for (const x of [-0.15, 0.15]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.02), glow(0xff2a3a, 6)); e.position.set(x, 0.04, 0.49); head.add(e); }
    cape(0x4a0d16);
    const wisp = new THREE.Vector3();
    hero.sparks.push(new Sparks({ count:26, color:0xff2a3a, size:0.1, life:[0.6, 1.4],
      spawn:o => { body.localToWorld(wisp.set(rnd(-0.6, 0.6), rnd(1.4, 2.5), rnd(-0.5, 0.2))); return o.copy(wisp); },
      vel:o => o.set(rnd(-0.2, 0.2), rnd(0.4, 0.9), rnd(-0.2, 0.2)) }));
  } else if (skin === 'guardiao') {
    eyes(0x66c8c0, 1); cape(0x263d54);
  } else if (skin === 'errante') {
    eyes(0x1a1a1a); cape(0x63445e);
  } else if (skin === 'arcanista') {
    eyes(0x7fe9ff, 3);
    const robe = box(1.25, 0.9, 0.72, mat(0x1d2a6b)); robe.position.y = 0.95; body.add(robe);
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), glow(0xffffff, 3));
      const onRobe = i > 5; s.position.set(rnd(-0.5, 0.5), onRobe ? rnd(0.6, 1.3) : rnd(1.35, 2.3), onRobe ? 0.37 : 0.32); body.add(s);
    }
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.15, 6), mat(0x23317a)); hat.position.y = 1.0; hat.rotation.z = -0.15; hat.castShadow = true; head.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.06, 12), mat(0x23317a)); brim.position.y = 0.45; head.add(brim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.1, 6), glow(0xffd36b, 2)); band.position.y = 0.55; head.add(band);
    for (let i = 0; i < 3; i++) { const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), glow(0x5ff2ff, 4)); head.add(o); hero.orbit.push({ o, ph:i * 2.09 }); }
  }

  if (armor || skinPads) {
    const am = armor ? mat(ARMOR_LOOK[armor].c, ARMOR_LOOK[armor].o) : skinPads;
    for (const x of [-0.85, 0.85]) {
      const pad = box(0.6, 0.25, 0.62, am); pad.position.set(x, 2.42, 0); body.add(pad);
      if (armor && RARITY[armor].rank >= 2) { const trim = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.64), glow(rarityColor(armor), 3)); trim.position.set(x, 2.3, 0); body.add(trim); }
    }
    const belt = box(1.18, 0.15, 0.65, am); belt.position.y = 1.3; body.add(belt);
  }
  if (amulet) {
    const k = [0, 2, 3.5, 5, 6.5][RARITY[amulet].rank];
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), k ? glow(rarityColor(amulet), k) : mat(0x9aa0aa, { metalness:0.6 }));
    gem.position.set(0, 1.98, 0.34); body.add(gem); hero.gem = gem;
  }

  hero.update = (dt, t) => {
    for (const { o, ph } of hero.orbit) o.position.set(Math.cos(t * 1.6 + ph) * 0.75, 0.25 + Math.sin(t * 2 + ph) * 0.1, Math.sin(t * 1.6 + ph) * 0.75);
    if (hero.halo) hero.halo.position.y = 0.78 + Math.sin(t * 2) * 0.04;
    if (hero.gem) hero.gem.rotation.y = t * 2;
    for (const s of hero.sparks) s.update(dt);
  };
  hero.dispose = () => { hero.sparks.forEach(s => s.dispose()); root.removeFromParent(); };
  scene.add(root);
  return hero;
}

// ---------- armas ----------
// Contorno com pontos quase alinhados vira triângulo-fio de normal zero na tampa: no shader dá NaN, e o bloom
// espalha esse pixel numa tela preta por um quadro. A normal certa da tampa é ±Z.
function fixNormals(g) {
  const n = g.attributes.normal, p = g.attributes.position;
  for (let i = 0; i < n.count; i++) if (n.getX(i) ** 2 + n.getY(i) ** 2 + n.getZ(i) ** 2 < 1e-8) n.setXYZ(i, 0, 0, Math.sign(p.getZ(i)) || 1);
  return g;
}
function extrude(points, depth = 0.05, closedMirror = true) {
  const s = new THREE.Shape(); s.moveTo(-points[0][0], points[0][1]);
  for (const [x, y] of points) s.lineTo(x, y);
  if (closedMirror) for (let i = points.length - 2; i >= 0; i--) s.lineTo(-points[i][0], points[i][1]);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled:true, bevelThickness:0.02, bevelSize:0.015, bevelSegments:1 });
  g.translate(0, 0, -depth / 2); return fixNormals(g);
}
function shapeGeo(points, depth = 0.06) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled:true, bevelThickness:0.02, bevelSize:0.02, bevelSegments:1 });
  g.translate(0, 0, -depth / 2); return fixNormals(g);
}

// 3 estilos por raridade: cor, brilho e efeitos (o formato muda pelo índice do estilo dentro de createWeapon).
const VARIANTS = {
  comum:    [{ c:0xa7adb6, accent:0x6d727c, glow:0xdfe8ff }, { c:0xc08a4a, accent:0x7a5232, glow:0xffd0a0 }, { c:0xe8e0c8, accent:0x8a7a5a, glow:0xf4f0e0, rough:true }],
  raro:     [{ c:0x8cc8ff, e:0x2a7bff, accent:0xcfe3ff, glow:0x3d9bff }, { c:0x7fdc8a, e:0x1f8a3a, accent:0x5a3d22, glow:0x5aff8a }, { c:0xd8f4ff, e:0x7fe9ff, accent:0x3a4a6a, glow:0xbff4ff }],
  epico:    [{ c:0x5a1fd1, e:0xa43dff, accent:0x2a1450, glow:0xb45cff, core:0xe6b8ff }, { c:0x8a1020, e:0xff2a3a, accent:0x2a0a10, glow:0xff3a4a, core:0xffb0b8 }, { c:0x3a7a1a, e:0x7aff3a, accent:0x1a2a10, glow:0x9aff5a, core:0xe0ffb0 }],
  lendario: [{ c:0xffcf6a, e:0xff7a12, accent:0xffcf6a, glow:0xffb52e, core:0xfff0b0, fx:'fire' }, { c:0xf4f6ff, e:0x7fe9ff, accent:0xffd36b, glow:0x9ae8ff, core:0xffffff, fx:'holy' }, { c:0x2a1a30, e:0xff2a6a, accent:0x4a0a2a, glow:0xff3a7a, core:0xff9ac0, fx:'void' }],
  // Mítico: carmesim com 3 estilos próprios (sangue escorrendo, coroa dourada, eclipse negro).
  mitico:   [{ c:0x8a0018, e:0xff1030, accent:0x1a0006, glow:0xff1a3c, core:0xffb0bc, fx:'blood' }, { c:0x2a0a10, e:0xdc143c, accent:0xffc94a, glow:0xff3050, core:0xfff0c0, fx:'crown' }, { c:0x120408, e:0xff0040, accent:0x5a0a1a, glow:0xff2050, core:0xff6080, fx:'eclipse' }],
};
const EI = [0, 0.35, 0.55, 0.65, 0.75];
export const weaponGlow = (rarity, variant = 0) => VARIANTS[rarity][variant % 3].glow;
const taper = (t, k) => t > 1 - k ? (1 - t) / k : 1;

// Cada raridade × estilo tem desenho próprio (tamanho, grossura e silhueta); as cores vêm de VARIANTS.
// Geometrias ficam em cache por desenho (shared), então trocar de arma não recria malhas.
export function createWeapon(kind, rarity, { fx = true, variant = 0 } = {}) {
  const R = RARITY[rarity], rank = R.rank, v = variant % 3, V = VARIANTS[rarity][v], color = V.glow, id = `${rarity}${v}`;
  const g = new THREE.Group();
  const w = { kind, rarity, variant:v, group:g, sparks:[], spin:[], flaps:[], trail:null, bw:new THREE.Vector3(), tw:new THREE.Vector3() };
  const add = (mesh, x, y, z = 0) => { mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh; };
  const main = mat(V.c, { flatShading:false, metalness:V.rough ? 0.1 : 0.6, roughness:V.rough ? 0.8 : 0.3, ...(V.e ? { emissive:V.e, emissiveIntensity:EI[rank] } : {}) });
  const accent = mat(V.accent, { flatShading:false, metalness:0.7, roughness:0.35, ...(rank >= 3 ? { emissive:V.e, emissiveIntensity:0.6 } : {}) });
  const smooth = { flatShading:false }, wood = mat(0x4a2e1c, smooth), bone = mat(0xe8e0c8, { ...smooth, roughness:0.8 }), dark = mat(0x1a1418, { ...smooth, metalness:0.5, roughness:0.4 }), wrap = mat(0x6a3a22, { ...smooth, roughness:0.9 });
  const gem = rank ? glow(color, 2 + rank) : accent, core = glow(V.core ?? color, rank >= 3 ? 1.8 : 1.5), leaf = mat(0x5aa83f, { roughness:0.7 });
  let gi = 0; const S = make => shared(`wp:${kind}:${id}:${gi++}`, make);
  const mesh = (geo, m, x = 0, y = 0, z = 0) => add(new THREE.Mesh(geo, m), x, y, z);
  const cyl = (r0, r1, h, m, x, y, z = 0, seg = 12) => mesh(S(() => new THREE.CylinderGeometry(r0, r1, h, seg)), m, x, y, z);
  const cone = (r, h, m, x, y, z = 0, seg = 5) => mesh(S(() => new THREE.ConeGeometry(r, h, seg)), m, x, y, z);
  const ball = (r, m, x, y, z = 0) => mesh(S(() => new THREE.SphereGeometry(r, 16, 12)), m, x, y, z);
  const crystal = (r, m, x, y, z = 0, sy = 2) => { const o = mesh(S(() => new THREE.OctahedronGeometry(r)), m, x, y, z); o.scale.y = sy; return o; };
  const tube = (pts, r, m, segs = 24) => mesh(S(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z))), segs, r, 8)), m);
  const rod = ([x0, y0], [x1, y1], r, m) => { const o = cyl(r, r, Math.hypot(x1 - x0, y1 - y0), m, (x0 + x1) / 2, (y0 + y1) / 2, 0, 6); o.rotation.z = -Math.atan2(x1 - x0, y1 - y0); return o; };
  const flat = (pts, m, x = 0, y = 0, depth = 0.06) => mesh(S(() => shapeGeo(pts, depth)), m, x, y);
  // Lâmina: half(t) devolve meia largura (ou [esquerda, direita]) ao longo do comprimento; shift(t) entorta.
  const blade = (L, half, m = main, { shift = () => 0, y = 0.38, depth = 0.05 } = {}) => mesh(S(() => {
    const n = 24, s = new THREE.Shape(), P = [];
    for (let i = 0; i <= n; i++) { const t = i / n, h = [].concat(half(t)); P.push([t, h[0], h[1] ?? h[0]]); }
    s.moveTo(-P[0][1] + shift(0), 0);
    for (const [t, l] of P) s.lineTo(-l + shift(t), t * L);
    for (let i = n; i >= 0; i--) s.lineTo(P[i][2] + shift(P[i][0]), P[i][0] * L);
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled:true, bevelThickness:0.025, bevelSize:0.02, bevelSegments:2 }); geo.translate(0, 0, -depth / 2); return fixNormals(geo);
  }), m, 0, y);
  const grip = (len = 0.6, m = wood, r = 0.055) => { cyl(r, r * 1.1, len, m, 0, 0.3 - len / 2); return 0.3 - len - 0.04; };
  let base = 0.4, tip = 2;

  if (kind === 'espada') {
    const B = 0.38;
    const fuller = (L, wdt = 0.04, sx = () => 0) => { if (rank >= 2) blade(L * 0.8, () => wdt, core, { shift:sx, y:B + L * 0.06, depth:0.08 }); };
    let L = 1.5;
    switch (id) {
      case 'comum0': { L = 1.5; blade(L, t => 0.09 * taper(t, 0.12)); add(box(0.5, 0.1, 0.16, accent), 0, 0.33); ball(0.08, accent, 0, grip(0.55)); break; }
      case 'comum1': { L = 1.2; blade(L, t => (0.07 + 0.08 * Math.sin(t * Math.PI * 0.85)) * taper(t, 0.25)); for (const s of [-1, 1]) cone(0.05, 0.3, accent, s * 0.17, 0.36).rotation.z = s * 1.9; ball(0.07, accent, 0, grip(0.45)); break; }
      case 'comum2': { L = 1.25; blade(L, t => [0.05, t < 0.85 ? 0.13 + 0.12 * t : 0.25 * (1 - t) / 0.15 + 0.05], bone); cone(0.06, 0.18, bone, 0, grip(0.5, wrap) + 0.02).rotation.z = Math.PI; break; }
      case 'raro0': { L = 2.0; blade(L, t => 0.12 * taper(t, 0.15)); fuller(L, 0.025); for (const s of [-1, 1]) { rod([s * 0.06, 0.33], [s * 0.42, 0.5], 0.045, accent); crystal(0.06, gem, s * 0.46, 0.55); } crystal(0.07, gem, 0, grip(0.6)); break; }
      case 'raro1': { L = 1.8; const sh = t => 0.35 * t * t; blade(L, t => 0.1 * taper(t, 0.3), main, { shift:sh }); tube([[-0.12, 0.33], [-0.2, 0.1], [-0.14, -0.2], [0, -0.32]], 0.03, accent); add(box(0.32, 0.08, 0.14, accent), 0, 0.33); for (const s of [-1, 1]) { const l = crystal(0.07, leaf, s * 0.2, 0.34, 0, 2.2); l.rotation.z = -s * 1.2; l.scale.z = 0.3; } grip(0.6); break; }
      case 'raro2': { L = 1.9; const sh = t => t > 0.08 ? 0.09 * Math.sign(Math.sin(t * Math.PI * 6)) * Math.min(1, (t - 0.08) * 8) : 0; blade(L, t => 0.07 * taper(t, 0.1), main, { shift:sh }); add(box(0.7, 0.06, 0.1, accent), 0, 0.33); for (const s of [-1, 1]) cone(0.05, 0.22, gem, s * 0.4, 0.33).rotation.z = -s * Math.PI / 2; grip(0.55); break; }
      case 'epico0': { L = 2.3; blade(L, t => (0.24 - 0.06 * t) * taper(t, 0.1)); blade(L * 0.85, () => 0.03, dark, { y:B + 0.1, depth:0.09 }); for (let k = 0; k < 4; k++) for (const s of [-1, 1]) crystal(0.05, gem, s * (0.24 - 0.06 * (k + 1) / 5), B + L * (k + 1) / 5.5, 0, 1.6).rotation.z = -s * 0.8; for (const s of [-1, 1]) flat([[0, 0], [0.5, 0.25], [0.35, 0], [0.5, -0.12]], accent, s * 0.05, 0.33).scale.x = s; ball(0.09, gem, 0, grip(0.7)); break; }
      case 'epico1': { L = 1.9; blade(L, t => [0.08 * taper(t, 0.2), (0.11 + 0.06 * ((t * 7) % 1)) * taper(t, 0.2)], main, { shift:t => -0.12 * t * t }); fuller(L, 0.02); for (const s of [-1, 1]) { const f = cone(0.06, 0.4, accent, s * 0.2, 0.25); f.rotation.z = s * 2.4; } ball(0.08, gem, 0, grip(0.55)); break; }
      case 'epico2': { L = 2.4; blade(L, t => 0.04 * taper(t, 0.35)); mesh(S(() => new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), accent, 0, 0.27).rotation.x = Math.PI; tube([[0.18, 0.28], [0.22, 0.0], [0.12, -0.25], [0, -0.3]], 0.025, accent); crystal(0.06, gem, 0, grip(0.55)); break; }
      case 'lendario0': { L = 2.3; const sh = t => 0.07 * Math.sin(t * Math.PI * 4); blade(L, t => (0.13 + 0.05 * Math.sin(t * Math.PI * 7)) * taper(t, 0.2), main, { shift:sh }); fuller(L, 0.03, sh); for (let k = 0; k < 7; k++) { const a = (k / 6 - 0.5) * Math.PI * 0.9; const r = cone(0.04, 0.3, gem, Math.sin(a) * 0.22, 0.33 + Math.cos(a) * 0.08); r.rotation.z = -a - (a > 0 ? 0.6 : a < 0 ? -0.6 : 0); } ball(0.09, gem, 0, grip(0.6, accent)); break; }
      case 'lendario1': { L = 2.6; blade(L, t => 0.1 * taper(t, 0.2)); fuller(L, 0.025); for (const s of [-1, 1]) flat([[0, 0], [0.55, 0.35], [0.4, 0.12], [0.6, 0.1], [0.3, -0.05]], accent, s * 0.04, 0.3).scale.x = s; crystal(0.08, gem, 0, grip(0.65)); break; }
      case 'lendario2': { L = 2.1; blade(L, t => t < 0.15 ? 0.08 + t : t < 0.75 ? 0.23 : 0.23 * Math.sqrt(Math.max(0, 1 - ((t - 0.75) / 0.25) ** 2)) + 0.001); ball(0.13, core, 0, B + L * 0.55, 0.05).scale.z = 0.5; ball(0.05, dark, 0, B + L * 0.55, 0.11); add(box(0.36, 0.14, 0.2, dark), 0, 0.32); ball(0.1, gem, 0, grip(0.7, dark)); break; }
      case 'mitico0': { L = 3.0; blade(L, t => (t > 0.42 && t < 0.48 ? 0.2 : 0.27) * taper(t, 0.1)); fuller(L, 0.05); add(box(1.0, 0.16, 0.24, accent), 0, 0.32); for (const s of [-1, 1]) cone(0.07, 0.4, accent, s * 0.45, 0.15).rotation.z = Math.PI; cone(0.07, 0.3, gem, 0, grip(0.8, dark) - 0.05).rotation.z = Math.PI; break; }
      case 'mitico1': { L = 2.5; blade(L, t => 0.15 * taper(t, 0.15)); fuller(L, 0.035); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; cone(0.05, 0.35, accent, Math.cos(a) * 0.2, 0.45, Math.sin(a) * 0.12); } add(box(0.5, 0.1, 0.2, accent), 0, 0.33); for (const s of [-1, 1]) crystal(0.06, gem, s * 0.28, 0.33); ball(0.1, gem, 0, grip(0.6, accent)); break; }
      default: { L = 2.6; const sh = t => 0.55 * t * t; blade(L, t => [0.06 * taper(t, 0.2), 0.3 * Math.sin(Math.min(1, t * 1.05) * Math.PI) * 0.9 + 0.05], main, { shift:sh }); blade(L * 0.9, t => [0.0, 0.03], core, { shift:t => sh(t) + 0.25 * Math.sin(t * Math.PI), y:B + 0.1, depth:0.07 }); add(box(0.4, 0.12, 0.2, dark), 0, 0.32); ball(0.09, gem, 0, grip(0.7, dark)); }
    }
    base = B; tip = B + L;
  } else if (kind === 'machado') {
    // Lâmina em meia-lua: fio curvo (reach/span), pontas que abrem (flare), barba para baixo (beard), dentes (notch).
    const bladeGeo = ({ reach, span, neck = 0.16, flare = 0.1, beard = 0, notch = 0 }, depth) => {
      const s = new THREE.Shape(), top = span / 2 + flare, bot = -span / 2 - flare - beard;
      s.moveTo(0, neck);
      s.quadraticCurveTo(reach * 0.35, neck * 1.1, reach * 0.88, top);
      if (notch) { const n = 7; for (let i = 1; i <= n; i++) { const t = i / n, y = top + (bot - top) * t, bulge = Math.sin(t * Math.PI) * reach * 0.14; s.lineTo(reach * 0.88 + bulge - (i % 2 ? notch : 0), y); } }
      else s.quadraticCurveTo(reach * 1.2, (top + bot) / 2, reach * 0.88, bot);
      s.quadraticCurveTo(reach * 0.35, -neck * 1.1 - beard * 0.4, 0, -neck);
      const geo = new THREE.ExtrudeGeometry(s, { depth, curveSegments:20, bevelEnabled:true, bevelThickness:0.035, bevelSize:0.045, bevelSegments:3 });
      geo.translate(0, 0, -depth / 2); return fixNormals(geo);
    };
    // Lâmina + miolo em outro tom (o fio fica claro em volta) + pedra no meio a partir do raro.
    const faceM = mat(new THREE.Color(V.c).multiplyScalar(0.1), { flatShading:false, metalness:0.8, roughness:0.35, ...(V.e ? { emissive:V.e, emissiveIntensity:EI[rank] * 0.2 } : {}) });
    const axeBlade = (p, hy, side = 1, face = faceM) => {
      const b = mesh(S(() => bladeGeo(p, 0.035)), main, side * 0.1, hy); b.scale.x = side;
      const inner = { ...p, reach:p.reach * 0.68, span:p.span * 0.62, flare:(p.flare ?? 0.1) * 0.5, beard:(p.beard ?? 0) * 0.6, notch:0 };
      for (const z of [-1, 1]) { const f = mesh(S(() => bladeGeo(inner, 0.01)), face, side * 0.1, hy, z * 0.08); f.scale.x = side; }
      if (rank) for (const z of [-1, 1]) { const c = crystal(0.055, gem, side * (0.1 + p.reach * 0.42), hy, z * 0.13, 1.6); c.scale.z = 0.5; }
    };
    // Encaixe em camadas, ponta de cima e cabo com couro enrolado; end = ponteira de baixo.
    const haft = (len, m = wood, r = 0.065, end = 'ball', grip = wrap) => {
      const y1 = len - 0.45; cyl(r, r * 1.12, len, m, 0, len / 2 - 0.45, 0, 14);
      const P = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 14; P.push([Math.cos(a) * r * 1.15, -0.4 + t * 0.75, Math.sin(a) * r * 1.15]); } tube(P, 0.018, grip, 80);
      for (const y of [-0.42, 0.36]) cyl(r * 1.35, r * 1.35, 0.06, accent, 0, y, 0, 14);
      if (end === 'ball') ball(r * 1.6, accent, 0, -0.52);
      else if (end === 'spike') cone(r * 1.2, 0.3, accent, 0, -0.6, 0, 8).rotation.z = Math.PI;
      else if (end === 'hook') tube([[0, -0.45], [0, -0.62], [0.1, -0.75], [0.16, -0.64]], 0.03, accent, 16);
      else if (end === 'gem') crystal(0.08, gem, 0, -0.56, 0, 1.8);
      return y1;
    };
    const socket = (hy, h = 0.62, r = 0.11) => { cyl(r, r, h, accent, 0, hy, 0, 12); for (const d of [-1, 1]) cyl(r * 1.3, r * 1.15, 0.08, accent, 0, hy + d * (h / 2), 0, 12); cyl(r * 0.8, r * 1.3, 0.14, accent, 0, hy - h / 2 - 0.1, 0, 12); };
    const spike = (hy, len = 0.45, m = accent) => cone(0.07, len, m, 0, hy + 0.31 + len / 2, 0, 8);
    let hy = 1.3;
    switch (id) {
      case 'comum0': { hy = haft(1.6) - 0.2; socket(hy, 0.42, 0.09); axeBlade({ reach:0.55, span:0.55, neck:0.12, flare:0.06 }, hy, 1, wood); break; }
      case 'comum1': { hy = haft(1.9, wood, 0.065, 'spike') - 0.25; socket(hy, 0.5); axeBlade({ reach:0.7, span:0.5, flare:0.05, beard:0.4 }, hy, 1, dark); break; }
      case 'comum2': { hy = haft(1.7, bone, 0.07, 'spike', dark) - 0.25; socket(hy, 0.5); axeBlade({ reach:0.65, span:0.7, flare:0.04, notch:0.06 }, hy, 1, dark); cone(0.05, 0.3, bone, -0.16, hy + 0.1).rotation.z = 1.2; break; }
      case 'raro0': { hy = haft(2.0, wood, 0.065, 'gem') - 0.3; socket(hy); axeBlade({ reach:0.7, span:0.8, flare:0.15 }, hy, 1); axeBlade({ reach:0.7, span:0.8, flare:0.15 }, hy, -1); crystal(0.08, gem, 0, hy + 0.55, 0, 3); break; }
      case 'raro1': { hy = haft(2.4, wood, 0.06, 'ball', leaf) - 0.3; socket(hy, 0.55); axeBlade({ reach:0.95, span:0.9, flare:0.28 }, hy); for (let k = 0; k < 3; k++) { const l = crystal(0.07, leaf, -0.14, hy - 0.35 - k * 0.22, 0, 2.4); l.rotation.z = 0.8; l.scale.z = 0.3; } break; }
      case 'raro2': { hy = haft(2.0, accent, 0.07, 'ball', dark) - 0.3; socket(hy); axeBlade({ reach:0.8, span:0.75, flare:0.12 }, hy); mesh(S(() => new THREE.CylinderGeometry(0.2, 0.2, 0.42, 8)), accent, -0.32, hy).rotation.z = Math.PI / 2; cyl(0.23, 0.23, 0.06, main, -0.53, hy).rotation.z = Math.PI / 2; spike(hy); break; }
      case 'epico0': { hy = haft(2.6, dark, 0.06, 'hook') - 0.2; socket(hy, 0.5, 0.09); axeBlade({ reach:1.15, span:0.35, neck:0.1, flare:0.05, beard:0.75 }, hy); cone(0.06, 0.4, accent, -0.3, hy + 0.05).rotation.z = 1.3; break; }
      case 'epico1': { hy = haft(2.0, dark, 0.085, 'spike') - 0.45; socket(hy, 0.8, 0.13); axeBlade({ reach:1.05, span:1.2, neck:0.3, flare:0.02 }, hy); break; }
      case 'epico2': { hy = haft(2.1, wood, 0.065, 'spike', leaf) - 0.3; socket(hy); for (const s of [-1, 1]) axeBlade({ reach:0.8, span:0.85, flare:0.12, notch:0.09 }, hy, s); for (let k = 0; k < 3; k++) cone(0.035, 0.22, gem, 0.15, hy - 0.5 - k * 0.25, 0.08, 6).rotation.z = Math.PI; break; }
      case 'lendario0': { hy = haft(2.5, dark, 0.075, 'gem', accent) - 0.35; socket(hy, 0.7, 0.13); for (const s of [-1, 1]) axeBlade({ reach:1.0, span:1.1, flare:0.22 }, hy, s); spike(hy + 0.08, 0.55, gem); break; }
      case 'lendario1': { hy = haft(2.3, accent, 0.065, 'gem', main) - 0.35; socket(hy, 0.6); for (const s of [-1, 1]) { axeBlade({ reach:0.95, span:0.95, flare:0.38 }, hy, s); const w2 = mesh(S(() => bladeGeo({ reach:0.65, span:0.55, flare:0.3 }, 0.03)), accent, s * 0.1, hy + 0.32, -0.04); w2.scale.x = s; } spike(hy, 0.4); break; }
      case 'lendario2': { hy = haft(2.3, dark, 0.07, 'hook', dark) - 0.3; socket(hy, 0.62); for (const s of [-1, 1]) { axeBlade({ reach:0.9, span:0.95, flare:0.18 }, hy, s); for (let k = 0; k < 3; k++) cone(0.04, 0.24, accent, s * (0.25 + k * 0.18), hy + 0.32 + k * 0.05, 0, 6).rotation.z = -s * 0.5; } spike(hy, 0.7, gem); break; }
      case 'mitico0': { hy = haft(2.8, dark, 0.085, 'hook', accent) - 0.45; socket(hy, 0.85, 0.14); for (const s of [-1, 1]) axeBlade({ reach:1.2, span:1.35, neck:0.22, flare:0.3 }, hy, s); spike(hy + 0.12, 0.8, main); break; }
      case 'mitico1': { hy = haft(2.5, accent, 0.075, 'gem', main) - 0.45; socket(hy, 0.75, 0.13); for (const s of [-1, 1]) axeBlade({ reach:1.05, span:1.15, flare:0.2, beard:0.12 }, hy, s); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; cone(0.045, 0.3, accent, Math.cos(a) * 0.13, hy + 0.5, Math.sin(a) * 0.13, 6); } crystal(0.08, gem, 0, hy + 0.55, 0, 2.2); break; }
      default: { hy = haft(3.0, dark, 0.06, 'spike', accent) - 0.6; socket(hy, 0.6, 0.09); axeBlade({ reach:0.9, span:0.75, flare:0.15, beard:0.1 }, hy); cone(0.06, 0.45, accent, -0.32, hy, 0, 6).rotation.z = Math.PI / 2; blade(0.95, t2 => 0.11 * taper(t2, 0.6), main, { y:hy + 0.32 }); }
    }
    base = hy - 0.6; tip = hy + 0.7;
  } else if (kind === 'arco') {
    // Meio arco de cima (do punho à ponta); o de baixo é espelhado. tube = curva lisa, rods = segmentos retos.
    const limb = (pts, r, m, ang = false) => { for (const s of [1, -1]) { const P = pts.map(([x, y]) => [x, y * s]); if (ang) for (let i = 1; i < P.length; i++) rod(P[i - 1], P[i], r, m); else tube(P, r, m); } const e = pts.at(-1); return e; };
    const string = ([tx, ty], m = rank ? glow(color, 2 + rank) : mat(0xdddddd)) => {
      const parts = [0, 1].map(() => add(new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, 1, 6), m), 0, 0));
      const a = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, 1.15, 6), mat(0xc8bda0));
      a.rotation.z = Math.PI / 2; g.add(a); a.visible = false;
      const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), end = new THREE.Vector3(), mid = new THREE.Vector3();
      w.bowTips = [tx, ty]; w.nockWorld = new THREE.Vector3();
      w.setDraw = (draw, showArrow) => {
        const x = tx + .43 * draw; mid.set(x, 0, 0);
        parts.forEach((part, i) => { end.set(tx, (i ? -1 : 1) * ty, 0); part.position.copy(mid).add(end).multiplyScalar(.5); const dir = end.sub(mid); part.scale.y = dir.length(); part.quaternion.copy(q.setFromUnitVectors(up, dir.normalize())); });
        a.position.set(x - .575, 0, 0); a.visible = showArrow; w.nockWorld.set(x, 0, 0); g.localToWorld(w.nockWorld);
      };
      w.setDraw(0, false);
    };
    const tips = ([tx, ty], fn) => { for (const s of [1, -1]) fn(tx, ty * s, s); };
    let e;
    switch (id) {
      case 'comum0': e = limb([[0, 0], [0.12, 0.5], [0.35, 0.95]], 0.055, wood); break;
      case 'comum1': e = limb([[0, 0], [0.1, 0.45], [0.3, 0.85], [0.26, 1.05], [0.15, 1.12]], 0.05, main); tips(e, (x, y) => ball(0.05, accent, x, y)); break;
      case 'comum2': e = limb([[0, 0], [0.04, 0.35], [0.22, 0.7], [0.42, 1.0]], 0.05, bone, true); tips(e, (x, y, s) => cone(0.05, 0.18, bone, x + 0.04, y + s * 0.08).rotation.z = s > 0 ? -0.6 : Math.PI + 0.6); break;
      case 'raro0': e = limb([[0, 0], [0.1, 0.7], [0.32, 1.38]], 0.04, main); tips(e, (x, y, s) => crystal(0.06, gem, x, y + s * 0.08, 0, 2.4)); break;
      case 'raro1': e = limb([[0, 0], [0.14, 0.45], [0.3, 0.85], [0.28, 1.15]], 0.05, wood); for (let k = 0; k < 4; k++) tips([0.12 + k * 0.05, 0.25 + k * 0.24], (x, y, s) => { const l = crystal(0.06, leaf, x - 0.08, y, 0, 2); l.rotation.z = s * 0.9; l.scale.z = 0.3; }); break;
      case 'raro2': e = limb([[0, 0], [0.16, 0.3], [0.04, 0.55], [0.3, 0.85], [0.22, 1.08]], 0.045, main, true); tips(e, (x, y) => crystal(0.05, gem, x, y)); break;
      case 'epico0': e = limb([[0, 0], [0.08, 0.4], [0.3, 0.75], [0.5, 1.05]], 0.055, dark, true); for (let k = 0; k < 3; k++) tips([0.06 + k * 0.12, 0.3 + k * 0.25], (x, y, s) => cone(0.04, 0.26, gem, x - 0.14, y, 0).rotation.z = s * 1.3); break;
      case 'epico1': e = limb([[0, 0], [0.12, 0.45], [0.36, 0.85], [0.3, 1.1], [0.16, 1.2]], 0.055, main); tips(e, (x, y, s) => cone(0.07, 0.45, accent, x - 0.12, y + s * 0.15).rotation.z = s * 0.9); break;
      case 'epico2': e = limb([[0, 0], [0.16, 0.25], [0.04, 0.5], [0.24, 0.75], [0.18, 1.0], [0.38, 1.15]], 0.05, main); tips(e, (x, y) => { ball(0.08, main, x, y); ball(0.025, gem, x + 0.05, y, 0.06); }); break;
      case 'lendario0': e = limb([[0, 0], [0.14, 0.5], [0.38, 1.0]], 0.06, main); for (let k = 0; k < 4; k++) tips([0.1 + k * 0.08, 0.35 + k * 0.17], (x, y, s) => { const f = flat([[0, 0], [0.12, 0.42], [-0.04, 0.12]], gem, x - 0.06, y, 0.03); f.rotation.z = s > 0 ? 0.8 + k * 0.15 : Math.PI - 0.8 - k * 0.15; }); break;
      case 'lendario1': e = limb([[0, 0], [0.12, 0.75], [0.36, 1.45]], 0.045, main); for (let k = 0; k < 5; k++) tips([0.06 + k * 0.06, 0.3 + k * 0.22], (x, y, s) => { const f = mesh(S(() => new THREE.PlaneGeometry(0.1, 0.42).translate(0, 0.21, 0)), additive(new THREE.Color(0xffffff).multiplyScalar(1.3), 0.7, { side:THREE.DoubleSide }), x - 0.05, y); f.rotation.z = s > 0 ? 1.1 : Math.PI - 1.1; }); break;
      case 'lendario2': e = limb([[0, 0], [0.18, 0.6], [0.55, 1.1], [0.9, 1.25]], 0.09, main); limb([[0.05, 0], [0.22, 0.58], [0.57, 1.04], [0.85, 1.17]], 0.03, core); break;
      case 'mitico0': e = limb([[0, 0], [0.1, 0.45], [0.35, 0.85], [0.55, 1.35]], 0.07, accent, true); for (let k = 0; k < 3; k++) tips([0.1 + k * 0.12, 0.35 + k * 0.33], (x, y, s) => { const b = flat([[0, 0], [0.35, 0.06], [0, 0.14]], main, x - 0.42, y - 0.07, 0.04); if (s < 0) b.scale.y = -1; }); break;
      case 'mitico1': e = limb([[0, 0], [0.14, 0.5], [0.42, 0.95], [0.36, 1.2], [0.2, 1.3]], 0.065, main); for (let k = 0; k < 3; k++) tips([0.12 + k * 0.1, 0.35 + k * 0.25], (x, y) => crystal(0.05, gem, x - 0.03, y, 0.06)); for (let k = 0; k < 3; k++) cone(0.04, 0.28, accent, -0.12, (k - 1) * 0.12).rotation.z = Math.PI / 2; break;
      default: e = limb([[0, 0], [0.22, 0.6], [0.65, 1.15], [1.05, 1.32]], 0.08, main); limb([[0.06, 0], [0.26, 0.55], [0.66, 1.06], [1.0, 1.24]], 0.03, core);
    }
    string(e); add(box(0.12, 0.32, 0.14, rank >= 3 ? accent : wrap), 0, 0, 0);
    base = -e[1]; tip = e[1];
  } else {
    // Cajado: haste (reta, torcida ou torta) + cabeça; L muda o tamanho do cajado.
    const y0 = -0.85, shaft = (L, r, m, bend = 0) => { if (bend) tube([[0, y0], [bend, y0 + L * 0.3], [-bend, y0 + L * 0.6], [bend * 0.5, y0 + L]], r, m, 16); else cyl(r * 0.8, r, L, m, 0, y0 + L / 2); return y0 + L; };
    const helix = (L, r, turns, rad, m, ph = 0) => { const P = []; for (let i = 0; i <= 24; i++) { const t = i / 24, a = ph + t * turns * Math.PI * 2; P.push([Math.cos(a) * rad, y0 + t * L, Math.sin(a) * rad]); } tube(P, r, m, 48); };
    let top = 1.8;
    switch (id) {
      case 'comum0': { top = shaft(2.5, 0.07, wood, 0.08); mesh(S(() => new THREE.DodecahedronGeometry(0.2)), wood, 0.04, top + 0.1); break; }
      case 'comum1': { top = shaft(1.7, 0.08, accent); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; tube([[0, top], [Math.cos(a) * 0.16, top + 0.18, Math.sin(a) * 0.16], [0, top + 0.38]], 0.025, accent, 8); } ball(0.1, main, 0, top + 0.19); break; }
      case 'comum2': { top = shaft(2.3, 0.06, bone); for (let k = 1; k < 5; k++) ball(0.085, bone, 0, y0 + k * 0.46); const sk = propScene('skull'); if (sk) { sk.scale.setScalar(0.42); sk.position.y = top + 0.15; g.add(sk); } break; }
      case 'raro0': { top = shaft(2.6, 0.05, main); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, c = crystal(k ? 0.09 : 0.13, gem, k ? Math.cos(a) * 0.12 : 0, top + (k ? 0.12 : 0.25), k ? Math.sin(a) * 0.12 : 0, 2.6); c.rotation.z = k ? Math.cos(a) * 0.4 : 0; } break; }
      case 'raro1': { helix(2.4, 0.04, 2.5, 0.05, wood); helix(2.4, 0.04, 2.5, 0.05, wood, Math.PI); top = y0 + 2.4; for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; tube([[0, top], [Math.cos(a) * 0.22, top + 0.25, Math.sin(a) * 0.22], [Math.cos(a) * 0.08, top + 0.5, Math.sin(a) * 0.08]], 0.03, wood, 10); } w.orb = ball(0.13, gem, 0, top + 0.27); for (let k = 0; k < 3; k++) { const l = crystal(0.05, leaf, 0.12, top - 0.1 - k * 0.15, 0, 2); l.rotation.z = -0.9; l.scale.z = 0.3; } break; }
      case 'raro2': { top = shaft(2.3, 0.055, accent); for (const x of [-1, 0, 1]) { tube([[0, top], [x * 0.2, top + 0.15], [x * 0.2, top + (x ? 0.4 : 0.55)]], 0.03, main, 8); cone(0.05, 0.16, main, x * 0.2, top + (x ? 0.47 : 0.62)); } crystal(0.07, gem, 0, top + 0.12, 0.05); break; }
      case 'epico0': { top = shaft(2.9, 0.045, dark); for (const s of [-1, 1]) tube([[0, top], [s * 0.18, top + 0.25], [s * 0.1, top + 0.55], [s * 0.02, top + 0.7]], 0.03, dark, 12); w.orb = crystal(0.11, gem, 0, top + 0.35, 0, 2.2); break; }
      case 'epico1': { top = shaft(2.5, 0.06, main); const P = []; for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * Math.PI * 3.2, r = 0.32 * (1 - t * 0.8); P.push([Math.cos(a) * r, top + 0.32 + Math.sin(a) * r]); } tube([[0, top], [0.2, top + 0.15], ...P], 0.045, main, 60); w.orb = crystal(0.08, gem, 0, top + 0.32, 0.04); break; }
      case 'epico2': { top = shaft(2.2, 0.065, main, 0.05); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, h = 0.3 + (k % 2) * 0.2; tube([[0, top - 0.05], [Math.cos(a) * 0.12, top + h * 0.5, Math.sin(a) * 0.12], [Math.cos(a) * 0.22, top + h, Math.sin(a) * 0.22]], 0.03, main, 8); ball(0.05, gem, Math.cos(a) * 0.22, top + h, Math.sin(a) * 0.22); } break; }
      case 'lendario0': { top = shaft(2.6, 0.09, accent); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; tube([[Math.cos(a) * 0.08, top - 0.05, Math.sin(a) * 0.08], [Math.cos(a) * 0.32, top + 0.25, Math.sin(a) * 0.32], [Math.cos(a) * 0.18, top + 0.6, Math.sin(a) * 0.18]], 0.04, accent, 12); } w.orb = ball(0.27, core, 0, top + 0.3); break; }
      case 'lendario1': { top = shaft(2.7, 0.055, main); for (let k = 0; k < 3; k++) cyl(0.07, 0.07, 0.06, accent, 0, top - 0.4 - k * 0.5); const m = mesh(S(() => new THREE.TorusGeometry(0.34, 0.06, 6, 24, Math.PI * 1.35)), accent, 0, top + 0.38); m.rotation.z = -Math.PI * 0.18 - Math.PI / 2; w.orb = ball(0.13, core, 0, top + 0.38); break; }
      case 'lendario2': { top = shaft(2.5, 0.06, dark); flat([[0, 0], [0.12, 0.25], [0.05, 0.5], [0.3, 0.62], [0.55, 0.55], [0.42, 0.45], [0.2, 0.42], [0.3, 0.3], [0.15, 0.2], [0.1, 0]], main, -0.05, top - 0.05, 0.1); cone(0.04, 0.25, accent, 0.1, top + 0.65).rotation.z = 0.5; ball(0.05, gem, 0.32, top + 0.52, 0.06); break; }
      case 'mitico0': { top = shaft(3.1, 0.1, dark); crystal(0.18, core, 0, top + 0.35, 0, 2.4); for (let i = 0; i < 4; i++) { const o = new THREE.Mesh(S(() => new THREE.OctahedronGeometry(0.07)), gem); o.scale.y = 2; g.add(o); w.spin.push({ o, r:0.42, y:top + 0.35, speed:1.6 + i * 0.3, ph:i * 1.57 }); } break; }
      case 'mitico1': { top = shaft(2.7, 0.07, accent); for (const s of [-1, 1]) flat([[0, 0], [0.45, 0.2], [0.62, 0.55], [0.4, 0.4], [0.5, 0.7], [0.25, 0.42], [0.08, 0.3]], main, s * 0.06, top, 0.05).scale.x = s; w.orb = ball(0.15, core, 0, top + 0.3); ball(0.06, dark, 0, top + 0.3, 0.12); for (let k = 0; k < 3; k++) cone(0.04, 0.22, accent, (k - 1) * 0.1, top + 0.55); break; }
      default: { top = shaft(2.8, 0.06, dark); helix(2.4, 0.03, 3, 0.09, main); const m = mesh(S(() => new THREE.TorusGeometry(0.42, 0.07, 6, 24, Math.PI * 1.3)), main, 0, top + 0.42); m.rotation.z = -Math.PI * 0.15 - Math.PI / 2; w.orb = ball(0.15, core, 0, top + 0.35); }
    }
    if (rank >= 2 && !w.spin.length) for (let i = 0; i < 2; i++) { const o = new THREE.Mesh(S(() => new THREE.OctahedronGeometry(0.05)), glow(color, 4)); g.add(o); w.spin.push({ o, r:0.45, y:top + 0.3, speed:2.4 + i * 0.6, ph:i * Math.PI }); }
    base = top - 0.6; tip = top + 0.5;
  }

  // Extras por estilo (sem anéis): asas no celestial, lascas no abismo, gotas no sangue.
  if (rank >= 3) {
    const mid = (base + tip) / 2;
    if (V.fx === 'holy' && kind !== 'arco') for (const s of [-1, 1]) {
      const wing = new THREE.Group(); wing.position.set(s * 0.12, base + 0.1, 0); g.add(wing);
      for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.7 - k * 0.12).translate(0, 0.35, 0), additive(new THREE.Color(0xffffff).multiplyScalar(1.4), 0.6, { side:THREE.DoubleSide })); f.rotation.z = -s * (0.9 + k * 0.3); wing.add(f); }
      w.flaps.push({ o:wing, s });
    }
    if (V.fx === 'void') for (let i = 0; i < 3; i++) { const o = new THREE.Mesh(new THREE.TetrahedronGeometry(0.09), glow(color, 4)); g.add(o); w.spin.push({ o, r:0.5, y:mid + (i - 1) * 0.4, speed:-2 - i * 0.4, ph:i * 2.1 }); }
  }
  if (rank === 4 && V.fx === 'blood') for (let k = 0; k < 3; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), glow(color, 4)); d.scale.y = 1.8; g.add(d); w.drips = [...(w.drips ?? []), { o:d, x:(k - 1) * 0.12, y0:tip - 0.2 - k * 0.3, ph:k * 0.37 }]; }

  w.base = new THREE.Object3D(); w.base.position.y = base; w.tip = new THREE.Object3D(); w.tip.position.y = tip; g.add(w.base, w.tip);
  if (fx) {
    const jitter = new THREE.Vector3();
    const along = o => o.lerpVectors(w.bw, w.tw, Math.random()).add(jitter.set(rnd(-0.13, 0.13), rnd(-0.13, 0.13), rnd(-0.13, 0.13)));
    if (rank === 1) w.sparks.push(new Sparks({ count:14, color, size:0.08, spawn:along, vel:o => o.set(rnd(-0.15, 0.15), 0.15, rnd(-0.15, 0.15)), life:[0.6, 1.4] }));
    if (rank === 2) w.sparks.push(new Sparks({ count:30, color, size:0.09, spawn:along, vel:o => o.set(rnd(-0.3, 0.3), rnd(0.3, 0.7), rnd(-0.3, 0.3)), life:[0.4, 1.0] }));
    if (rank === 3) {
      const up = V.fx === 'holy' ? [0.2, 0.6] : V.fx === 'void' ? [-0.4, 0.2] : [1.2, 2.6];
      w.sparks.push(new Sparks({ count:64, color:V.fx === 'fire' ? 0xff9a30 : color, size:0.1, spawn:along, vel:o => o.set(rnd(-0.25, 0.25), rnd(up[0], up[1]), rnd(-0.25, 0.25)), life:[0.3, 0.9] }));
    }
    if (rank === 4) {
      // Partículas míticas: brasas carmesim em espiral para fora + gotas que caem (sangue) ou faíscas douradas (coroa).
      w.sparks.push(new Sparks({ count:80, color:0xff1a3c, size:0.11, spawn:along, vel:o => { const a = Math.random() * Math.PI * 2; return o.set(Math.cos(a) * 0.7, rnd(0.4, 1.4), Math.sin(a) * 0.7); }, life:[0.3, 0.9] }));
      w.sparks.push(new Sparks({ count:30, color:V.fx === 'crown' ? 0xffc94a : V.fx === 'eclipse' ? 0xff6080 : 0x8a0018, size:0.13, spawn:along,
        vel:o => o.set(rnd(-0.1, 0.1), V.fx === 'blood' ? rnd(-2.2, -1.2) : rnd(0.1, 0.5), rnd(-0.1, 0.1)), life:[0.4, 1.1] }));
    }
    if (kind === 'espada' || kind === 'machado') w.trail = new Trail(rank ? color : 0xdfe8ff); // rastro do golpe em toda arma corpo a corpo
  }
  w.update = (dt, t) => {
    w.base.getWorldPosition(w.bw); w.tip.getWorldPosition(w.tw);
    for (const s of w.spin) {
      if (s.o) s.o.position.set(Math.cos(t * s.speed + s.ph) * s.r, s.y, Math.sin(t * s.speed + s.ph) * s.r);
      if (s.ring) s.ring.rotation[s.axis] += dt * s.speed;
    }
    for (const f of w.flaps) f.o.rotation.y = f.s * Math.sin(t * 4) * 0.35;
    if (w.orb) w.orb.rotation.y += dt * 1.5;
    if (w.aura) w.aura.material.opacity = 0.16 + Math.sin(t * 5) * 0.08;
    for (const d of w.drips ?? []) { const k = (t * 0.6 + d.ph) % 1; d.o.position.set(d.x, d.y0 - k * 0.8, 0.05); d.o.scale.setScalar(Math.max(0.01, 1 - k)); }
    for (const s of w.sparks) s.update(dt);
    if (w.trail) w.trail.push(w.bw, w.tw);
  };
  w.dispose = () => { w.sparks.forEach(s => s.dispose()); w.trail?.dispose(); g.removeFromParent(); };
  return w;
}

// Miniatura de item para feixe de loot e ícones: sem partículas.
export function createItemModel(item) {
  if (item.slot === 'arma') { const w = createWeapon(item.kind, item.rarity, { fx:false, variant:weaponVariant(item) }); return w.group; }
  const g = new THREE.Group(), rank = RARITY[item.rarity].rank, color = rarityColor(item.rarity);
  if (item.slot === 'skill') {
    // Grimório com runa brilhando na capa.
    const cover = box(1.0, 1.25, 0.3, mat(color, { roughness:0.6, emissive:color, emissiveIntensity:0.15 + rank * 0.15 }));
    const pages = box(0.9, 1.15, 0.24, mat(0xf4ecd8)); pages.position.x = 0.06;
    const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), glow(rank ? color : 0xffffff, 2 + rank)); rune.scale.z = 0.3; rune.position.z = 0.17;
    g.add(cover, pages, rune); g.rotation.x = -0.3;
  } else if (item.slot === 'armadura') {
    // Cores do conjunto pelo nome (as mesmas do herói vestido); itens antigos sem conjunto usam a cor da raridade.
    const S = ARMOR_SET[item.name], A = ARMOR_LOOK[item.rarity], m = S ? mat(S.m, S.metal ? { metalness:0.75, roughness:0.3 } : { roughness:0.8 }) : mat(A.c, A.o);
    if (S) { const t = box(1.2, 0.18, 0.64, mat(S.a, { metalness:0.6, roughness:0.35 })); t.position.y = -0.35; g.add(t); }
    g.add(box(1.15, 1.1, 0.6, m));
    for (const x of [-0.75, 0.75]) { const p = box(0.55, 0.25, 0.6, m); p.position.set(x, 0.55, 0); g.add(p); }
    if (rank >= 2) { const e = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), glow(ARMOR_SET[item.name]?.gem ?? color, 4)); e.position.set(0, 0.15, 0.33); g.add(e); }
  } else {
    const p = amuletPendant(item.name, item.rarity); p.scale.setScalar(2.6); p.position.y = -0.2; g.add(p);
  }
  g.position.y = 0.6;
  const holder = new THREE.Group(); holder.add(g); return holder;
}

// ---------- mobs e chefes ----------
function trackMats(group) {
  const mats = [];
  group.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial) { o.material = o.material.clone(); o.material.userData.shared = false; mats.push(o.material); } });
  return mats;
}

export function createMob(type, themeId, scale = 1) {
  const T = THEMES[themeId];
  if (rigMobReady(type)) return finishMob(createRigMob(type, T, scale), scale);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const m = { type, root, body, parts:{} };
  if (type === 'slime' || type === 'reiSlime' || type === 'magmaSlime') {
    const sc = type === 'magmaSlime' ? 0xff5a1a : T.mob;
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.78, 18, 12), new THREE.MeshStandardMaterial({ color:sc, transparent:true, opacity:0.86, roughness:0.12, metalness:0, emissive:sc, emissiveIntensity:type === 'magmaSlime' ? 0.5 : 0.22 }));
    blob.scale.set(1, 0.72, 1); blob.position.y = 0.55; blob.castShadow = true; body.add(blob); m.parts.blob = blob;
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glow(0xffffff, 1.4)); shine.scale.set(1.4, 0.7, 0.6); shine.position.set(-0.32, 0.9, 0.42); body.add(shine);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), glow(T.accent, 2)); core.position.y = 0.5; body.add(core);
    for (const x of [-0.24, 0.24]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0x15151a, { roughness:0.2 })); e.scale.set(0.85, 1.15, 0.5); e.position.set(x, 0.68, 0.68); body.add(e);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), glow(0xffffff, 1.5)); h.position.set(x + 0.04, 0.73, 0.73); body.add(h);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12, Math.PI), mat(0x15151a)); mouth.position.set(0, 0.52, 0.74); mouth.rotation.z = Math.PI; body.add(mouth);
    if (type === 'reiSlime') {
      const gold = mat(0xffc94a, { metalness:0.85, roughness:0.25 });
      const crown = new THREE.Group(); crown.position.y = 1.2; body.add(crown);
      crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.2, 8), gold));
      for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 4), gold); s.position.set(Math.cos(i * 1.257) * 0.38, 0.22, Math.sin(i * 1.257) * 0.38); crown.add(s); }
      const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), glow(0xff3a5a, 4)); jewel.position.set(0, 0.05, 0.45); crown.add(jewel);
    }
  } else if (type === 'bomba') {
    // Slime explosivo: corpo vermelho com espinhos e pavio aceso.
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), new THREE.MeshStandardMaterial({ color:0xff4a2a, roughness:0.25, emissive:0xff2a00, emissiveIntensity:0.3 }));
    blob.scale.set(1, 0.85, 1); blob.position.y = 0.62; blob.castShadow = true; body.add(blob);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 4), mat(0x3a1a10)); sp.position.set(Math.cos(a) * 0.7, 0.62, Math.sin(a) * 0.7); sp.rotation.set(Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57); body.add(sp); }
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 5), mat(0x2a2a2a)); fuse.position.y = 1.35; body.add(fuse);
    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), glow(0xffd36b, 5)); spark.position.y = 1.58; body.add(spark); m.parts.spark = spark;
    for (const x of [-0.24, 0.24]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.04), mat(0x15151a)); e.position.set(x, 0.78, 0.72); e.rotation.z = x > 0 ? -0.35 : 0.35; body.add(e); }
  } else if ((type === 'golem' || type === 'colosso') && GLTF.rock_single_E) {
    // Golem montado com pedras texturizadas da KayKit e núcleo brilhando.
    const R = n => { const p = propGeo(n); const mesh = new THREE.Mesh(p.geo, p.mat); mesh.castShadow = true; return mesh; };
    const big = type === 'colosso';
    const rock = (n, sx, sy, sz, x, y, z, ry = 0, parent = body) => { const r = R(n); r.scale.set(sx, sy, sz); r.position.set(x, y, z); r.rotation.y = ry; parent.add(r); return r; };
    // Pedras têm origem na base: pernas, tronco, peito e cabeça empilhados; braços pendem do ombro.
    for (const x of [-0.42, 0.42]) rock('rock_single_C', 2.4, 4, 2.4, x, 0, 0, x * 3);
    rock('rock_single_E', 3.4, 5.5, 3.6, 0, 0.72, 0, 0.2); rock('rock_single_C', 3.6, 3.4, 3.4, 0, 1.55, 0.02, 1.1);
    rock('rock_single_C', 2.2, 3, 2.2, 0, 2.1, 0.12, 0.6);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), glow(T.accent, 3.5)); core.position.set(0, 1.3, 0.62); body.add(core);
    for (const x of [-0.14, 0.14]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.02), glow(T.accent, 5)); e.position.set(x, 2.38, 0.5); body.add(e); }
    for (const s of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(s * 0.98, 1.95, 0); body.add(arm);
      rock('rock_single_C', 2.2, 3.2, 2.2, 0, -0.62, 0, s, arm); rock('rock_single_E', 2.4, 3.4, 2.6, 0, -1.38, 0.05, s * 2, arm);
      m.parts[s < 0 ? 'armL' : 'armR'] = arm;
    }
    if (big) for (let i = 0; i < 7; i++) { const crack = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5 + Math.random() * 0.5, 0.02), glow(0xff5a1a, 4)); crack.position.set((Math.random() - 0.5) * 1.1, 1.2 + Math.random() * 1.2, 0.6); crack.rotation.z = (Math.random() - 0.5) * 1.2; body.add(crack); }
  } else if (type === 'esqueleto' || type === 'cavaleiro') {
    const bone = mat(0xe8e2cc), dark = mat(0x3a3a44, { metalness:0.6, roughness:0.4 });
    const limb = (x, y, w, h, d, mm) => { const p = new THREE.Group(); p.position.set(x, y, 0); const b = box(w, h, d, mm); b.position.y = -h / 2; p.add(b); return p; };
    root.add(limb(-0.22, 1.1, 0.22, 1.1, 0.24, bone), limb(0.22, 1.1, 0.22, 1.1, 0.24, bone));
    const ribs = box(0.8, 0.9, 0.4, type === 'cavaleiro' ? dark : bone); ribs.position.y = 1.55; body.add(ribs);
    const head = box(0.6, 0.6, 0.6, bone); head.position.y = 2.35; body.add(head);
    for (const x of [-0.13, 0.13]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.02), glow(T.accent, 4)); e.position.set(x, 2.38, 0.31); body.add(e); }
    const armR = limb(0.55, 1.95, 0.18, 0.95, 0.2, bone), armL = limb(-0.55, 1.95, 0.18, 0.95, 0.2, bone); body.add(armR, armL);
    const spear = new THREE.Group(); spear.position.set(0, -0.9, 0.1); spear.rotation.x = Math.PI / 2 - 0.3; armR.add(spear);
    spear.add(box(0.07, 2.2, 0.07, mat(0x5a3d22)));
    const tipM = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), glow(T.accent, 1.5)); tipM.position.y = 1.3; spear.add(tipM);
    m.parts.armR = armR; m.parts.armL = armL;
    if (type === 'cavaleiro') {
      const helm = box(0.7, 0.35, 0.7, dark); helm.position.y = 2.6; body.add(helm);
      for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 5), bone); horn.position.set(s * 0.4, 2.85, 0); horn.rotation.z = -s * 0.6; body.add(horn); }
      for (const x of [-0.55, 0.55]) { const pad = box(0.45, 0.22, 0.5, dark); pad.position.set(x, 2.05, 0); body.add(pad); }
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), mat(0x5a0d1a, { side:THREE.DoubleSide })); c.position.set(0, 1.25, -0.25); c.rotation.x = 0.12; body.add(c);
    }
  } else if (type === 'espirito' || type === 'arauto') {
    const ghostM = mat(T.mob, { transparent:true, opacity:0.75, emissive:T.mob, emissiveIntensity:0.5 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 7), ghostM); cone.rotation.x = Math.PI; cone.position.y = 1.2; body.add(cone);
    const hd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), ghostM); hd.position.y = 2.05; body.add(hd);
    for (const x of [-0.15, 0.15]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.02), glow(0xffffff, 4)); e.position.set(x, 2.08, 0.41); body.add(e); }
    for (const s of [-1, 1]) { const hand = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), glow(T.accent, 2.5)); hand.position.set(s * 0.75, 1.5, 0.2); body.add(hand); m.parts[s < 0 ? 'handL' : 'handR'] = hand; }
    if (type === 'arauto') {
      for (let i = 0; i < 2; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9 + i * 0.3, 0.04, 6, 40), glow(T.accent, 3)); ring.position.y = 1.6; ring.rotation.x = Math.PI / 2 + i * 0.5; body.add(ring); (m.parts.rings ??= []).push(ring); }
      const crownM = glow(T.accent, 4);
      for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 4), crownM); s.position.set(Math.cos(i * 1.257) * 0.35, 2.55, Math.sin(i * 1.257) * 0.35); body.add(s); }
    }
  } else if (type === 'cristalino') {
    // Guardião de cristal: cristal grande com núcleo aceso, dois braços de cristal flutuando e lascas em órbita.
    const crys = mat(T.mob, { roughness:0.15, metalness:0.1, emissive:T.accent, emissiveIntensity:0.35, transparent:true, opacity:0.9 });
    const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), crys); main.scale.set(1, 1.9, 1); main.position.y = 1.9; main.castShadow = true; body.add(main);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), glow(T.accent, 4)); core.position.set(0, 1.9, 0.35); body.add(core);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.02), glow(0xffffff, 4)); eye.position.set(0, 2.75, 0.42); body.add(eye);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), crys); c.scale.set(0.7, 1.8, 0.7); c.position.set(Math.cos(a) * 0.85, 0.45, Math.sin(a) * 0.85); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); c.castShadow = true; body.add(c); }
    for (const s of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(s * 1.3, 2.4, 0); body.add(arm);
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), crys); c.scale.set(0.8, 2, 0.8); c.position.y = -0.75; c.castShadow = true; arm.add(c);
      m.parts[s < 0 ? 'armL' : 'armR'] = arm;
    }
    const orbit = new THREE.Group(); orbit.position.y = 1.9; body.add(orbit);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, c = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), glow(T.accent, 3)); c.position.set(Math.cos(a) * 1.8, Math.sin(a * 2) * 0.3, Math.sin(a) * 1.8); orbit.add(c); }
    m.tick = dt => { orbit.rotation.y += dt * 1.2; };
  } else if (type === 'flor') {
    // Flor carnívora: caule, folhas e uma cabeça de pétalas com boca virada para o jogador.
    const stemM = mat(0x3f8a3a), petal = mat(0xd84a8a, { emissive:0x6a1040, emissiveIntensity:0.3 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 6), stemM); stem.position.y = 0.7; stem.castShadow = true; body.add(stem);
    for (const s of [-1, 1]) { const leaf = box(0.8, 0.06, 0.32, stemM); leaf.position.set(s * 0.42, 0.35, 0); leaf.rotation.z = s * 0.45; body.add(leaf); }
    const head = new THREE.Group(); head.position.y = 1.6; body.add(head);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), petal); bulb.castShadow = true; head.add(bulb);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 4), petal); c.position.set(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.05); c.rotation.z = a - Math.PI / 2; head.add(c); }
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), mat(0x2a0a14)); mouth.position.z = 0.43; head.add(mouth);
    const seed = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), glow(0xffd36b, 4)); seed.position.z = 0.45; head.add(seed);
    m.parts.head = head;
  } else if (type === 'morcego') {
    // Morcego: corpo peludo voando alto, orelhas, olhos acesos e asas que batem (m.tick).
    const fur = mat(0x2a2232), wingM = mat(0x3a2e48, { side:THREE.DoubleSide });
    const fly = new THREE.Group(); fly.position.y = 1.5; body.add(fly);
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), fur); torso.scale.set(1, 1.1, 0.9); torso.castShadow = true; fly.add(torso);
    const wings = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), fur); ear.position.set(s * 0.18, 0.42, 0); fly.add(ear);
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), glow(T.accent, 5)); e.position.set(s * 0.13, 0.12, 0.35); fly.add(e);
      const wing = new THREE.Group(); wing.position.set(s * 0.3, 0.05, 0); fly.add(wing);
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), wingM); w.position.x = s * 0.55; w.rotation.x = -Math.PI / 2; w.castShadow = true; wing.add(w);
      wings.push([wing, s]);
    }
    let t = Math.random() * 6;
    m.tick = dt => { t += dt; for (const [w, s] of wings) w.rotation.z = s * Math.sin(t * 18) * 0.7; fly.position.y = 1.5 + Math.sin(t * 3) * 0.15; };
  } else {
    const stone = mat(T.wall, { roughness:0.95 }), core = glow(T.accent, 3);
    const torso = box(1.6, 1.3, 1.1, stone); torso.position.y = 1.6; body.add(torso);
    const head = box(0.7, 0.55, 0.65, stone); head.position.set(0, 2.45, 0.2); body.add(head);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.02), core); eye.position.set(0, 2.47, 0.53); body.add(eye);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), core); gem.position.set(0, 1.65, 0.58); body.add(gem);
    for (const s of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(s * 1.05, 2.1, 0); body.add(arm);
      const a = box(0.55, 1.3, 0.6, stone); a.position.y = -0.6; arm.add(a);
      const fist = box(0.75, 0.6, 0.75, stone); fist.position.y = -1.4; arm.add(fist);
      m.parts[s < 0 ? 'armL' : 'armR'] = arm;
      const leg = box(0.55, 1.0, 0.6, stone); leg.position.set(s * 0.45, 0.5, 0); root.add(leg);
    }
    if (type === 'colosso') {
      for (let i = 0; i < 6; i++) { const crack = new THREE.Mesh(new THREE.BoxGeometry(0.06, rnd(0.3, 0.7), 0.02), glow(0xff5a1a, 4)); crack.position.set(rnd(-0.6, 0.6), rnd(1.2, 2.1), 0.56); crack.rotation.z = rnd(-0.6, 0.6); body.add(crack); }
      for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 5), mat(0x222222)); horn.position.set(s * 0.35, 2.9, 0.2); horn.rotation.z = -s * 0.4; body.add(horn); }
    }
  }
  root.scale.setScalar(scale);
  return finishMob(m, 1);
}
function finishMob(m, rigScale) {
  const root = m.root;
  if (m.rig) root.userData.rigScale = rigScale;
  m.mats = trackMats(root);
  m.flash = k => { for (const mm of m.mats) { mm.emissive.setRGB(k, k, k); if (k === 0 && mm.userData.e0) mm.emissive.copy(mm.userData.e0); } };
  for (const mm of m.mats) mm.userData.e0 = mm.emissive.clone();
  scene.add(root);
  return m;
}

// Boneco de treino: base fixa + corpo de palha que balança (body gira a partir do chão).
// armored: placas de ferro e elmo dourado (boneco de chefe).
export function createDummy(armored = false) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const wood = mat(0x6b4a2f), straw = mat(0xd8b46a, { roughness:1 }), cloth = mat(0xb89a6a, { roughness:1 });
  const add = (mesh, x, y, z, parent = body) => { mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };
  add(box(0.9, 0.15, 0.9, wood), 0, 0.075, 0, root);
  add(box(0.16, 2.2, 0.16, wood), 0, 1.1, 0);
  add(new THREE.Mesh(shared('dummyTorso', () => new THREE.CylinderGeometry(0.38, 0.42, 1, 10)), straw), 0, 1.45, 0);
  add(box(1.5, 0.14, 0.14, wood), 0, 1.75, 0);
  add(new THREE.Mesh(shared('dummyHead', () => new THREE.SphereGeometry(0.3, 12, 10)), cloth), 0, 2.25, 0);
  const disc = r => shared(`dummyDisc${r}`, () => new THREE.CylinderGeometry(r, r, 0.04, 20).rotateX(Math.PI / 2));
  add(new THREE.Mesh(disc(0.26), mat(0xc0392b)), 0, 1.5, 0.41);
  add(new THREE.Mesh(disc(0.13), mat(0xf2e6c8)), 0, 1.5, 0.43);
  if (armored) {
    const iron = mat(0x6d727c, { metalness:0.7, roughness:0.4 }), gold = mat(0xffc94a, { metalness:0.85, roughness:0.25 });
    add(box(0.9, 0.75, 0.12, iron), 0, 1.45, -0.42);
    for (const x of [-0.7, 0.7]) add(box(0.36, 0.2, 0.36, iron), x, 1.82, 0);
    add(new THREE.Mesh(shared('dummyHelm', () => new THREE.CylinderGeometry(0.32, 0.34, 0.32, 10)), gold), 0, 2.38, 0);
  }
  return finishMob({ type:'boneco', root, body, rig:null, parts:{} }, 1);
}

// ---------- props ----------
export function createChest() {
  const group = new THREE.Group(), kk = GLTF.chest_gold && propScene('chest_gold');
  if (kk) {
    // Baú dourado texturizado da KayKit; a tampa já é uma peça com dobradiça atrás.
    kk.scale.setScalar(1.3); kk.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); group.add(kk);
    const lid = kk.getObjectByName('chest_gold_lid');
    return chestFx(group, lid);
  }
  const wood = mat(0x7a4a22), gold = mat(0xe0b040, { metalness:0.8, roughness:0.3 });
  const body = box(1.3, 0.7, 0.9, wood); body.position.y = 0.35; group.add(body);
  for (const x of [-0.45, 0.45]) { const b = box(0.12, 0.72, 0.94, gold); b.position.set(x, 0.35, 0); group.add(b); }
  const lock = box(0.2, 0.26, 0.06, gold); lock.position.set(0, 0.6, 0.47); group.add(lock);
  const lid = new THREE.Group(); lid.position.set(0, 0.7, -0.45); group.add(lid);
  const l = box(1.3, 0.32, 0.9, wood); l.position.set(0, 0.16, 0.45); lid.add(l);
  const lb = box(1.34, 0.08, 0.94, gold); lb.position.set(0, 0.22, 0.45); lid.add(lb);
  return chestFx(group, lid);
}
function chestFx(group, lid) {
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 16, 24, 1, true), additive(0xffffff, 0, { side:THREE.DoubleSide })); beam.position.y = 8; group.add(beam);
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), additive(0xffffff, 0)); shock.rotation.x = -Math.PI / 2; shock.position.y = 0.05; group.add(shock);
  scene.add(group);
  return { group, lid, beam, shock };
}

export function createLootBeam(item) {
  // Mítico: feixe com mistura normal (somar vermelho ao chão verde vira laranja); mesmo shader do aditivo, só muda o blending.
  const group = new THREE.Group(), R = RARITY[item.rarity], color = R.color;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18 + R.rank * 0.1, 0.25 + R.rank * 0.12, 10, 16, 1, true), R.rank === 4
    ? additive(new THREE.Color(0xd8001e), 0.6, { side:THREE.DoubleSide, blending:THREE.NormalBlending })
    : additive(new THREE.Color(color).multiplyScalar(1 + R.rank * 0.4), 0.18 + R.rank * 0.12, { side:THREE.DoubleSide }));
  beam.position.y = 5; group.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40), additive(new THREE.Color(color).multiplyScalar(2), 0.8)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; group.add(ring);
  const model = createItemModel(item); model.scale.setScalar(item.slot === 'arma' ? 0.55 : 0.6); group.add(model);
  scene.add(group);
  return { group, model, beam, ring, update:t => { model.rotation.y = t * 2; model.position.y = 0.5 + Math.sin(t * 3) * 0.12; ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08); } };
}

export function createPortal(color = 0x3fe0ff, radius = 1.6) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.18, 8, 48), glow(color, 2.5)); ring.position.y = radius + 0.2; group.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.95, 40), additive(new THREE.Color(color), 0.55, { map:dotTex, side:THREE.DoubleSide })); disc.position.y = radius + 0.2; group.add(disc);
  const base = box(radius * 2.4, 0.3, 1.0, mat(0x353b57)); base.position.y = 0.15; group.add(base);
  scene.add(group);
  return { group, update:t => { disc.material.opacity = 0.45 + Math.sin(t * 3) * 0.15; disc.rotation.z = t; ring.rotation.z = -t * 0.3; } };
}

// ---------- avisos no chão ----------
const TELE_RED = 0xff3344;
export function createTelegraph(shape, { r = 2, w = 1.5, len = 6, angle = Math.PI, color = TELE_RED } = {}) {
  const group = new THREE.Group(); group.position.y = 0.04;
  const fillM = additive(color, 0.28), lineM = additive(color, 0.85);
  let fill, line;
  const k = `${shape}${r.toFixed(2)},${w.toFixed(2)},${len.toFixed(2)},${angle.toFixed(2)}`;
  if (shape === 'circle') {
    fill = new THREE.Mesh(shared('tf' + k, () => new THREE.CircleGeometry(r, 40)), fillM); line = new THREE.Mesh(shared('tl' + k, () => new THREE.RingGeometry(r * 0.93, r, 48)), lineM);
  } else if (shape === 'cone') {
    fill = new THREE.Mesh(shared('tf' + k, () => new THREE.CircleGeometry(r, 32, -angle / 2, angle)), fillM); line = new THREE.Mesh(shared('tl' + k, () => new THREE.RingGeometry(r * 0.93, r, 32, 1, -angle / 2, angle)), lineM);
  } else {
    const fg = shared('tf' + k, () => new THREE.PlaneGeometry(len, w).translate(len / 2, 0, 0)); fill = new THREE.Mesh(fg, fillM);
    line = new THREE.Mesh(shared('tl' + k, () => { const g = new THREE.PlaneGeometry(len, w * 0.12).translate(len / 2, 0, 0); return g; }), lineM);
    line.position.z = 0; // linha central da investida
  }
  for (const o of [fill, line]) { o.rotation.x = -Math.PI / 2; group.add(o); }
  scene.add(group);
  // shape/r/w/len/angle/dx/dz/p: a forma fica guardada para o jogo saber se o herói está dentro (esquiva perfeita).
  return {
    group, shape, r, w, len, angle, dx:1, dz:0, p:0,
    // Direção (dx,dz) aponta o eixo +x do aviso.
    aim(dx, dz) { this.dx = dx; this.dz = dz; group.rotation.y = Math.atan2(-dz, dx); },
    set(p) { this.p = p; if (shape === 'rect') fill.scale.set(Math.max(0.01, p), 1, 1); else fill.scale.setScalar(Math.max(0.01, p)); },
    dispose() { group.removeFromParent(); fillM.dispose(); lineM.dispose(); },
  };
}

// ---------- modelos animados (KayKit, CC0) ----------
// Personagens com esqueleto e animações prontas. Se algum arquivo falhar, o jogo usa os modelos blocados acima.
const GLTF = {};
const RIG_FILES = ['Knight', 'Barbarian', 'Rogue_Hooded', 'Mage', 'Skeleton_Minion', 'Skeleton_Warrior', 'Skeleton_Mage', 'Skeleton_Rogue'];
const PROP_FILES = ['Skeleton_Blade', 'Skeleton_Staff', 'Skeleton_Shield_Small_A', 'Skeleton_Crossbow'];
// Peças de cenário (KayKit Dungeon, Halloween e Medieval Hexagon, CC0).
const SET_FILES = ['chest.glb', 'chest_gold.glb', 'coin_stack_large.gltf.glb', 'barrel_large.gltf.glb', 'crates_stacked.gltf.glb', 'torch_lit.gltf.glb', 'rubble_large.gltf.glb', 'sword_shield_gold.gltf.glb',
  'bone_A.gltf', 'bone_B.gltf', 'bone_C.gltf', 'ribcage.gltf', 'skull.gltf', 'tree_dead_large.gltf', 'tree_dead_medium.gltf', 'lantern_standing.gltf',
  'trees_A_large.gltf', 'trees_A_medium.gltf', 'trees_B_large.gltf', 'trees_B_medium.gltf', 'tree_single_A.gltf', 'tree_single_B.gltf', 'rock_single_A.gltf', 'rock_single_C.gltf', 'rock_single_E.gltf',
  'tent.gltf', 'weaponrack.gltf', 'crate_A_big.gltf', 'barrel.gltf', 'flag_red.gltf',
  'grave_A.gltf', 'grave_B.gltf', 'gravestone.gltf', 'gravemarker_A.gltf', 'pumpkin_orange_jackolantern.gltf', 'pumpkin_orange.gltf', 'crypt.gltf', 'fence.gltf', 'candle_triple.gltf', 'post_lantern.gltf', 'shrine_candles.gltf', 'tree_pine_orange_large.gltf', 'coffin.gltf'];
export async function loadModels(onProgress) {
  const loader = new GLTFLoader(), jobs = [...RIG_FILES.map(n => [n, `assets/kaykit/${n}.glb`]), ...PROP_FILES.map(n => [n, `assets/kaykit/${n}.gltf`]),
    ...SET_FILES.map(f => [f.split('.')[0], `assets/kaykit/props/${f}`])];
  let done = 0;
  await Promise.all(jobs.map(async ([n, url]) => {
    try {
      GLTF[n] = await loader.loadAsync(url);
      // Geometria e material dos arquivos são compartilhados entre cópias: nunca descartar.
      GLTF[n].scene.traverse(o => { if (o.isMesh) { o.geometry.userData.shared = true; [].concat(o.material).forEach(m => { m.userData.shared = true; }); } });
    } catch (e) { console.warn('Modelo não carregou:', n, e); }
    onProgress?.(++done / jobs.length);
  }));
}
export const hasModel = n => !!GLTF[n];
// Peça de cenário de 1 malha: geometria já com a transformação do arquivo, para instanciar/fundir.
const PROP_CACHE = {};
export function propGeo(n) {
  if (PROP_CACHE[n] !== undefined) return PROP_CACHE[n];
  const g = GLTF[n]; if (!g) return (PROP_CACHE[n] = null);
  g.scene.updateMatrixWorld(true);
  let mesh = null; g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld); geo.userData.shared = true;
  return (PROP_CACHE[n] = { geo, mat:mesh.material });
}
export const propScene = n => GLTF[n] ? GLTF[n].scene.clone() : null;
// Material próprio para InstancedMesh (não misturar o mesmo material entre malha normal e instanciada).
const INST_MAT = {};
export function propInstMat(n) { const p = propGeo(n); if (!p) return null; if (!INST_MAT[n]) { INST_MAT[n] = p.mat.clone(); INST_MAT[n].userData.shared = true; } return INST_MAT[n]; }
// Rotação com que as armas da KayKit encaixam no osso da mão (lâmina ao longo de +Y).
const HAND_ROT = new THREE.Euler(Math.PI, 0, -Math.PI);

// Prende um objeto num osso usando uma posição do espaço do modelo (pose de ligação), alinhado ao modelo.
function boneAt(rig, boneName, obj, dx = 0, dy = 0, dz = 0, from = null) {
  const bone = rig.bone(boneName); if (!bone) return null;
  rig.model.updateMatrixWorld(true);
  const base = from ?? new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(rig.model.matrixWorld).invert());
  const wp = rig.model.localToWorld(base.clone().add(new THREE.Vector3(dx, dy, dz)));
  bone.add(obj); obj.position.copy(bone.worldToLocal(wp));
  const bq = new THREE.Quaternion(); bone.getWorldQuaternion(bq); const mq = new THREE.Quaternion(); rig.model.getWorldQuaternion(mq);
  obj.quaternion.copy(bq.invert().multiply(mq));
  obj.scale.divideScalar(bone.getWorldScale(new THREE.Vector3()).x / rig.model.getWorldScale(new THREE.Vector3()).x);
  return obj;
}

// Mistura de animações: idle/corrida por velocidade + um golpe por cima. Pesos sempre somam 1 (sem pose T vazando).
function makeRig(name, scale) {
  const src = GLTF[name], model = SkeletonUtils.clone(src.scene);
  model.scale.setScalar(scale);
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  for (const slot of ['handslotr', 'handslotl']) model.getObjectByName(slot)?.children.forEach(c => { c.visible = false; });
  const mixer = new THREE.AnimationMixer(model), clips = Object.fromEntries(src.animations.map(a => [a.name, a]));
  const act = n => clips[n] ? mixer.clipAction(clips[n]) : null;
  let idle = null, run = null, one = null, oneT = 0, ow = 0, hold = false, mv = 0, prev = null, pf = 0, timing = null;
  return {
    model, mixer, bone:n => model.getObjectByName(n), has:n => !!clips[n], moving:() => mv, busy:() => !!one && oneT > 0,
    base(idleName, runName) { idle?.stop(); run?.stop(); idle = act(idleName); run = act(runName); idle?.play(); run?.play(); },
    move(m, runScale = 1) { mv = Math.max(0, Math.min(1, m)); if (run) run.timeScale = runScale; },
    once(n, dur, { repeat = false, holdEnd = false, impact = null } = {}) {
      const a = act(n); if (!a) return;
      // Golpe emendado (combo): o anterior some em ~0,08 s em vez de cortar a pose.
      if (prev === a) prev = null;
      if (one && one !== a) { prev?.stop(); prev = ow > 0.3 ? one : (one.stop(), null); pf = 1; }
      a.reset(); a.setLoop(repeat ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = true;
      a.timeScale = !repeat && dur ? clips[n].duration / dur : 1; a.setEffectiveWeight(ow); a.play();
      one = a; oneT = dur ?? clips[n].duration; hold = holdEnd; timing = impact != null && dur && !repeat ? { dur, impact, clip:clips[n] } : null; if (timing) a.paused = true;
    },
    update(dt) {
      if (one) {
        oneT -= dt;
        if (timing) one.time = attackPhase(1 - oneT / timing.dur, timing.impact) * timing.clip.duration;
        const target = oneT > 0 || hold ? 1 : 0;
        ow += (target - ow) * Math.min(1, dt * 22);
        if (target === 0 && ow < 0.02) { one.stop(); one = null; ow = 0; } else one.setEffectiveWeight(ow * (1 - (prev ? pf : 0)));
      }
      if (prev) { pf -= dt / 0.08; if (pf <= 0 || !one) { prev.stop(); prev = null; } else prev.setEffectiveWeight(ow * pf); }
      idle?.setEffectiveWeight((1 - mv) * (1 - ow)); run?.setEffectiveWeight(mv * (1 - ow));
      mixer.update(dt);
    },
  };
}

const HERO_MODEL = { guerreiro:'Knight', berserker:'Barbarian', arqueiro:'Rogue_Hooded', mago:'Mage' };
export const heroModelReady = cls => hasModel(HERO_MODEL[cls]);
// Skins lendárias trocam o corpo inteiro e somam efeitos próprios (asas, galáxia, fumaça, fogo).
const SKIN_BODY = { celestial:'Knight', ceifador:'Skeleton_Rogue', arcanista:'Mage', lorde:'Skeleton_Warrior' };
const SKIN_TINT = { celestial:{ c:0xfff6e6, e:0xffd36b, ei:0.06, metal:true }, ceifador:{ c:0x3a3040, e:0x6a0014, ei:0.2 }, arcanista:{ c:0x2a2a55, e:0x000000, ei:0 }, lorde:{ c:0x4a4048, e:0xff5a1a, ei:0.12 } };
export const SKIN_TRAIL = { celestial:0xffd36b, ceifador:0xff2a3a, arcanista:0xb45cff, lorde:0xff6a1a };
const cosmicTime = { value:0 };
// Galáxia em espaço de tela: estrelas piscando + nebulosa (o "tecido cósmico" dos jogos de skin).
function cosmic(m) {
  m.customProgramCacheKey = () => 'cosmic';
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = cosmicTime;
    sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      vec2 sp = gl_FragCoord.xy / 3.0; vec2 cell = floor(sp); float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      float star = step(0.982, h) * (0.5 + 0.5 * sin(uTime * 3.0 + h * 60.0));
      float n = 0.5 + 0.5 * sin(gl_FragCoord.x * 0.012 + uTime * 0.4) * cos(gl_FragCoord.y * 0.015 - uTime * 0.25);
      totalEmissiveRadiance += mix(vec3(0.06, 0.02, 0.2), vec3(0.35, 0.08, 0.55), n) + vec3(0.8, 0.85, 1.0) * star * 2.5;`);
  };
}

// Cores da armadura no corpo: m = roupa/metal, a = detalhes (faixas, capa), orn = enfeite feito para a cabeça da classe.
const ARMOR_SET = {
  'Couraça de Couro':  { pad:'leather', c:0x7a5232, m:0x7a5232, a:0x3a2618, orn:'feather' },
  'Gibão Remendado':   { pad:'cloth', c:0x8a7a5a, m:0x8a7a5a, a:0x6a3a2a, orn:'patch' },
  'Placas Glaciais':   { pad:'ice', c:0x9fdcff, m:0x8fc8f0, a:0xeaf8ff, gem:0x5ff2ff, orn:'ice', fx:'frost', metal:true },
  'Cota do Vigia':     { pad:'steel', c:0xb8c4d8, m:0x4a64a0, a:0xd8dde8, gem:0x3d9bff, orn:'steel', metal:true },
  'Égide do Vazio':    { pad:'spike', c:0x4a2a8a, m:0x2e1a5e, a:0xb45cff, gem:0xb45cff, ring:0xb45cff, orn:'void', metal:true },
  'Armadura Ametista': { pad:'crystal', c:0x8a4ae0, m:0x7a3ad0, a:0xe0b0ff, gem:0xd08aff, orn:'crystal', fx:'shards' },
  'Manto do Sol':      { pad:'gold', c:0xffcf6a, m:0xc8401a, a:0xffcf6a, gem:0xff7a1a, cape:0xff8a2a, sun:true, orn:'sun', fx:'embers' },
  'Placas da Aurora':  { pad:'gold', c:0xf4f0ff, m:0xf0f0ff, a:0x7fe9ff, gem:0x7fe9ff, wings:0x9ae8ff, orn:'wings', fx:'aurora', metal:true },
  'Couraça do Rei Rubro':   { pad:'spike', c:0x3a0a12, m:0x3a0a12, a:0xffc94a, gem:0xff1a3c, ring:0xff1a3c, cape:0xb0102a, orn:'crown', fx:'blood', metal:true },
  'Placas do Juízo Final':  { pad:'gold', c:0x2a0a10, m:0x1a0a10, a:0xffc94a, gem:0xff1a3c, wings:0xff3a5a, orn:'judge', fx:'blood', metal:true },
  'Manto da Lua de Sangue': { pad:'crystal', c:0xc0102a, m:0xa00c22, a:0x2a0008, gem:0xff6080, ring:0xff1a3c, cape:0x8a0018, orn:'moon', fx:'blood' },
};

// Design próprio de cada classe por armadura: [roupa, detalhe, peças]. O mago usa ARMOR_SET + o enfeite 'orn' (aprovado).
// Peças: nome:arg1,arg2 (cores em hex), montadas em dressArmor.
const CLASS_LOOK = {
  guerreiro: {
    'Couraça de Couro':  [0x6a4a30, 0xa03020, 'cloth:0x3a2618 tassel:0xa03020 rivets'],
    'Gibão Remendado':   [0x7a7468, 0x8a4a2a, 'patches rivets featherSide:0xd8d0b0'],
    'Placas Glaciais':   [0xd8f0ff, 0x5ff2ff, 'crest:ice brow:0x5ff2ff'],
    'Cota do Vigia':     [0xc8d0e0, 0x2a5ad8, 'plume:0xf4f4ff band:0x2a5ad8 gem'],
    'Égide do Vazio':    [0x1a1030, 0x7a3aff, 'brow:0xb45cff hornsBack:0x0a0614 shards'],
    'Armadura Ametista': [0xb070ff, 0x5a1a9a, 'crest:crystal gem'],
    'Manto do Sol':      [0xffd36b, 0xc03010, 'sunfan brow:0xffb52e'],
    'Placas da Aurora':  [0xffffff, 0x9ae8ff, 'helm wingsHead:0x9ae8ff gem'],
    'Couraça do Rei Rubro':   [0x6a0a14, 0xffc94a, 'crown:0xffc94a plume:0xff1a3c brow:0xff1a3c'],
    'Placas do Juízo Final':  [0x2a2a30, 0xffc94a, 'helm crest:spike wingsHead:0xff3a5a gem'],
    'Manto da Lua de Sangue': [0x2a0a14, 0xc0102a, 'moonCrest:0xff6080 brow:0xff1a3c thorns:0x5a0010'],
  },
  berserker: {
    'Couraça de Couro':  [0x5a3a22, 0x9a8a70, 'tusks fur:0x8a7a60'],
    'Gibão Remendado':   [0x6a6040, 0x3a5a30, 'tusks patches fur:0x6a5a40'],
    'Placas Glaciais':   [0xa8d8f0, 0xffffff, 'helm hornsGlow:0x8fe0ff fur:0xf0f8ff'],
    'Cota do Vigia':     [0x5a6070, 0xc8d0e0, 'helm hornsUp:0xc8d0e0 fur:0x4a4a50'],
    'Égide do Vazio':    [0x20123a, 0x9a4aff, 'hornsCurl:0x1a0e30 gem shards fur:0x1a1028'],
    'Armadura Ametista': [0x6a2aa0, 0xe0a0ff, 'hornsCrystal fur:0xd0b0f0'],
    'Manto do Sol':      [0xa02a10, 0xffb52e, 'helm flameTips fur:0xffcf6a'],
    'Placas da Aurora':  [0xe8f4ff, 0xffd36b, 'hornsCurl:0xffd36b wingsHead:0xffffff fur:0xffffff'],
    'Couraça do Rei Rubro':   [0x4a0a10, 0xffc94a, 'helm hornsBull:0x0a0408 skull fur:0x2a0a0a'],
    'Placas do Juízo Final':  [0x101014, 0xff1a3c, 'helm hornsBull:0xffc94a bladeHalo fur:0x1a1014'],
    'Manto da Lua de Sangue': [0x8a0018, 0x1a0008, 'hornsCurl:0x2a0008 moonTop:0xff6080 fur:0x3a0010'],
  },
  arqueiro: {
    'Couraça de Couro':  [0x4a6a3a, 0x7a5232, 'featherSide:0xc04020'],
    'Gibão Remendado':   [0x6a6a4a, 0x8a5a2a, 'leaves:0x5aa83f patches'],
    'Placas Glaciais':   [0xe8f8ff, 0x5ff2ff, 'icicles circlet:0x5ff2ff gem'],
    'Cota do Vigia':     [0x2a3a5a, 0xc8d0e0, 'helm featherSide:0x3d9bff gem'],
    'Égide do Vazio':    [0x0e0818, 0xb45cff, 'mask:0x2a1a4a gem shards'],
    'Armadura Ametista': [0x9a5ae0, 0x3a1a6a, 'helm antlers'],
    'Manto do Sol':      [0xe0701a, 0xffe08a, 'helm flame gem'],
    'Placas da Aurora':  [0xf4f8ff, 0x7fe9ff, 'wingsHead:0x9ae8ff circlet:0x7fe9ff gem'],
    'Couraça do Rei Rubro':   [0x5a0a14, 0xffc94a, 'thorns:0xffc94a mask:0x2a0008 gem'],
    'Placas do Juízo Final':  [0x141016, 0xffc94a, 'helm bladeHalo gem'],
    'Manto da Lua de Sangue': [0xc0102a, 0x2a0008, 'moonFront:0xff6080 mask:0x3a0010 thorns:0x2a0008'],
  },
};

// Pinta roupa e metal do modelo com as cores da armadura, sem tocar na pele; tons quentes (faixas, capa) viram o detalhe.
function armorTint(m, main, accent, rim = 0) {
  m.userData.uMain = { value:new THREE.Color(main) }; m.userData.uAcc = { value:new THREE.Color(accent) }; m.userData.uRim = { value:new THREE.Color(rim) };
  m.customProgramCacheKey = () => 'armortint';
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uMain:m.userData.uMain, uAcc:m.userData.uAcc, uRim:m.userData.uRim });
    sh.fragmentShader = 'uniform vec3 uMain; uniform vec3 uAcc; uniform vec3 uRim;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float aSkin = 0.0;
        { vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.3, 0.59, 0.11));
          float skin = step(0.4, c.r) * step(c.r * 0.42, c.g) * step(c.g + 0.08, c.r) * step(c.b + 0.04, c.g);
          float warm = (1.0 - skin) * step(0.12, c.r - c.b) * step(c.g * 1.4, c.r);
          vec3 t = mix(uMain, uAcc, warm) * (0.3 + l * 1.7);
          diffuseColor.rgb = mix(t, c, skin); aSkin = skin; }`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor *= 1.0 - aSkin; roughnessFactor = mix(roughnessFactor, 0.8, aSkin);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uRim * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);`);
  };
  return m;
}
// Materiais dos enfeites: compartilhados entre heróis (nunca descartar).
const ORN_M = new Map();
const oMat = (key, make) => { let m = ORN_M.get(key); if (!m) { m = make(); m.userData.shared = true; ORN_M.set(key, m); } return m; };
const oGlow = (c, k) => oMat(`g${c},${k}`, () => glow(c, k));
const oMetal = c => oMat(`m${c}`, () => mat(c, { metalness:0.85, roughness:0.25 }));
const oCloth = c => oMat(`c${c}`, () => mat(c, { roughness:0.85 }));
const oFx = c => oMat(`f${c}`, () => additive(new THREE.Color(c).multiplyScalar(1.4), 0.6, { side:THREE.DoubleSide }));
// Capa de tecido: malha dobrada nas costas que ondula no vento (vértices animados no shader) e levanta ao correr.
const capeTime = { value:0 };
const capeGeo = rank => shared(`cape${rank}`, () => {
  const L = 1.05 + rank * 0.1, top = 0.72, bot = 0.95 + rank * 0.06, g = new THREE.PlaneGeometry(1, 1, 14, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = p.getY(i) + 0.5, w = top + (bot - top) * (1 - v), x = p.getX(i) * w, e = x / (w / 2);
    p.setXYZ(i, x, (v - 1) * L, 0.16 * e * e - 0.04 - 0.07 * (1 - v * 0.75) * Math.cos(e * Math.PI * 3.5));
  }
  g.computeVertexNormals(); return g;
});
const capeMat = (color, trim, edge) => oMat(`cape${color},${trim},${edge}`, () => {
  const m = mat(color, { roughness:0.9, side:THREE.DoubleSide, flatShading:false }), uEdge = { value:new THREE.Color(edge).multiplyScalar(edge ? 2.5 : 0) }, uTrim = { value:new THREE.Color(trim) };
  m.customProgramCacheKey = () => 'cape';
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uTime:capeTime, uEdge, uTrim });
    sh.vertexShader = 'uniform float uTime; varying float vK;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float k = 1.0 - uv.y; vK = k;
      transformed.z -= k * k * (0.12 + 0.06 * sin(uTime * 2.6 + position.y * 3.5 + position.x * 2.5));
      transformed.x += k * k * 0.04 * sin(uTime * 1.9 + position.y * 2.0);`);
    sh.fragmentShader = 'uniform vec3 uEdge; uniform vec3 uTrim; varying float vK;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, uTrim, step(0.92, vK)) * (0.75 + 0.25 * (1.0 - vK));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += uEdge * smoothstep(0.9, 1.0, vK);`);
  };
  return m;
});
// Capacete limpo (sem capuz/pele): cúpula de metal, faixa, protetor de nariz e crista que brilha nas raridades altas.
const HELM_AT = { top:[0, 1.13, 0], front:[0, 0.62, 0.64], side:0.62, sideY:0.62, ring:[0, 0.44, 0], ringR:0.6, tilt:0 };
// Amuletos: pingente próprio por nome, pendurado numa corrente no peito. Raridade soma brilho, aro girando e pulsação.
const AMULET = {
  'Colar de Osso':      { shape:'bone', c:0xf0e8d0 },     'Pingente Simples':   { shape:'disc', c:0xc9a24a },
  'Gota de Safira':     { shape:'drop', c:0x2a7bff },     'Lágrima Glacial':    { shape:'drop', c:0x9fe8ff },
  'Olho do Vazio':      { shape:'eye', c:0xb45cff },      'Estrela Ametista':   { shape:'star', c:0xd08aff },
  'Coração da Fênix':   { shape:'heart', c:0xff7a1a },    'Sol Aprisionado':    { shape:'sun', c:0xffcf6a },
  'Coração Carmesim':   { shape:'heart', c:0xff1a3c },    'Olho do Cataclismo': { shape:'eye', c:0xff3a1a },
  'Lágrima de Sangue':  { shape:'drop', c:0xff1030 },
};
export function amuletPendant(name, rarity, chain = true) {
  const A = AMULET[name] ?? { shape:'disc', c:rarityColor(rarity) }, rank = RARITY[rarity].rank, g = new THREE.Group(), gem = new THREE.Group();
  const G = (key, make) => shared('amu' + key, make), gold = oMetal(rank >= 3 ? 0xffcf6a : 0xb8b0a0);
  const core = rank >= 2 ? oGlow(A.c, 1 + rank * 0.35) : rank ? oMetal(A.c) : A.shape === 'bone' ? oCloth(A.c) : oMetal(A.c);
  const add = (geo, m, x = 0, y = 0, z = 0, s = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.setScalar(s); gem.add(o); return o; };
  if (chain) { const c = new THREE.Mesh(G('chain', () => new THREE.TorusGeometry(0.3, 0.014, 4, 20, Math.PI)), gold); c.rotation.z = Math.PI; c.position.y = 0.3; g.add(c); }
  g.add(gem);
  switch (A.shape) {
    case 'bone': add(G('tooth', () => new THREE.ConeGeometry(0.06, 0.24, 5)), core, 0, -0.02).rotation.z = Math.PI; break;
    case 'disc': add(G('disc', () => new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12)), core).rotation.x = Math.PI / 2; break;
    case 'drop': { add(G('dropB', () => new THREE.SphereGeometry(0.09, 10, 8)), core, 0, -0.03); add(G('dropT', () => new THREE.ConeGeometry(0.085, 0.14, 10)), core, 0, 0.07); break; }
    case 'eye': { const e = add(G('eyeB', () => new THREE.SphereGeometry(0.1, 12, 8)), core); e.scale.set(1.3, 0.8, 0.6); add(G('pupil', () => new THREE.SphereGeometry(0.04, 8, 6)), oGlow(0x050003, 1), 0, 0, 0.055); break; }
    case 'star': for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, p = add(G('pt', () => new THREE.ConeGeometry(0.04, 0.12, 4).translate(0, 0.08, 0)), core); p.rotation.z = a; } add(G('dropB', () => new THREE.SphereGeometry(0.09, 10, 8)), core, 0, 0, 0, 0.6); break;
    case 'heart': for (const s of [-1, 1]) add(G('lobe', () => new THREE.SphereGeometry(0.06, 10, 8)), core, s * 0.045, 0.03); add(G('hTip', () => new THREE.ConeGeometry(0.085, 0.13, 10)), core, 0, -0.05).rotation.z = Math.PI; break;
    case 'sun': add(G('dropB', () => new THREE.SphereGeometry(0.09, 10, 8)), core, 0, 0, 0, 0.8); for (let i = 0; i < 8; i++) { const r = add(G('ray', () => new THREE.ConeGeometry(0.025, 0.08, 4).translate(0, 0.1, 0)), core); r.rotation.z = i / 8 * Math.PI * 2; } break;
  }
  // Moldura de metal atrás da pedra.
  if (A.shape !== 'bone') { const f = new THREE.Mesh(G('frame', () => new THREE.TorusGeometry(0.12, 0.018, 4, 16)), gold); f.position.z = -0.02; gem.add(f); }
  g.userData.gem = gem; g.userData.pulse = false; g.userData.color = A.c; g.userData.rank = rank;
  return g;
}
// Pontos da cabeça de cada classe (relativos ao osso head): topo do chapéu/elmo, testa, lateral, aro.
const HEAD_AT = {
  mago:      { top:[0, 1.42, -0.32], front:[0, 0.78, 0.6], side:0.72, sideY:0.72, ring:[0, 0.82, -0.05], ringR:0.42, tilt:-0.26 },
  guerreiro: { top:[0, 1.22, 0], front:[0, 0.72, 0.7], side:0.58, sideY:0.7, ring:[0, 1.0, 0], ringR:0.5, tilt:0 },
  berserker: { top:[0, 1.15, 0], front:[0, 0.8, 0.72], side:0.56, sideY:0.72, ring:[0, 0.98, 0], ringR:0.48, tilt:0 },
  arqueiro:  { top:[0, 1.0, -0.08], front:[0, 0.92, 0.56], side:0.56, sideY:0.62, ring:[0, 0.9, 0], ringR:0.48, tilt:0 },
};

export function createHeroRig({ cls, skin = 'aventureiro', armor = null, armorName = null, amulet = null, amuletName = null, armorStyle = 'tema' }) {
  const skinBody = visualBodyForSkin(skin) ?? SKIN_BODY[skin];
  const visualCls = skin === 'guardiao' ? 'guerreiro' : skin === 'errante' ? 'arqueiro' : cls;
  const rig = makeRig(skinBody && hasModel(skinBody) ? skinBody : HERO_MODEL[cls], 1.4), root = new THREE.Group(); root.add(rig.model);
  const tint = SKIN_TINT[skin], A = armor ? RARITY[armor] : null;
  rig.model.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    o.material = o.material.clone(); o.material.userData.shared = false;
    if (o.material.name === 'Glow') { o.material = glow(skin === 'lorde' ? 0xff7a1a : 0xff2a3a, 5); return; }
    if (tint) o.material.color.multiply(new THREE.Color(tint.c));
    if (tint?.metal) { o.material.metalness = 0.6; o.material.roughness = 0.35; }
    if (skin === 'arcanista') cosmic(o.material);
    // Armadura rara faz o corpo emitir de leve a cor da raridade.
    // A skin manda na cor do corpo; sem skin, a armadura rara dá um leve brilho.
    const ai = !tint && A ? [0, 0.03, 0.06, 0.1, 0.14][A.rank] : 0, ei = tint ? tint.ei : ai;
    if (ei) { o.material.emissive = new THREE.Color(tint ? tint.e : A.color); o.material.emissiveIntensity = ei; }
  });
  const mount = new THREE.Group(); mount.rotation.copy(HAND_ROT); mount.scale.setScalar(0.72); rig.bone('handslotr').add(mount);
  const head = rig.bone('head'), chest = rig.bone('chest');
  const hero = { skin, rig, root, mount, head, sparks:[], orbit:[], flaps:[], spins:[], isRig:true };
  const baseBones = []; rig.model.traverse(b => { if (b.isBone) baseBones.push({ b, p:b.position.clone(), q:b.quaternion.clone(), s:b.scale.clone() }); });

  rig.model.updateMatrixWorld(true);
  const modelInv = new THREE.Matrix4().copy(rig.model.matrixWorld).invert();
  const at = (boneName, obj, dx, dy, dz, from) => boneAt(rig, boneName, obj, dx, dy, dz, from);
  const P = n => new THREE.Vector3().setFromMatrixPosition(rig.bone(n).matrixWorld).applyMatrix4(modelInv);
  const headP = P('head'), chestP = P('chest');
  const rootP = new THREE.Vector3();
  const sparkAt = (count, color, size, spawn, vel, life = [0.6, 1.4]) => hero.sparks.push(new Sparks({ count, color, size, life, spawn, vel }));
  const around = (r, y0, y1) => o => { root.getWorldPosition(rootP); return o.set(rootP.x + rnd(-r, r), rnd(y0, y1), rootP.z + rnd(-r, r)); };

  // ----- armadura -----
  const set = armorName && ARMOR_SET[armorName], rank = A?.rank ?? -1;
  if (set && armorStyle === 'tema' && !tint) dressArmor();
  // Visual por armadura: corpo e peças da própria classe pintados + enfeite de cabeça criado para cada tema.
  function dressArmor() {
    const D = visualCls !== 'mago' && !SKIN_BODY[skin] ? CLASS_LOOK[visualCls]?.[armorName] : null, M_ = D?.[0] ?? set.m, A_ = D?.[1] ?? set.a;
    const rim = rank >= 2 ? new THREE.Color(set.gem ?? set.a).multiplyScalar(0.15 * rank) : 0;
    rig.model.traverse(o => {
      if (!o.isMesh || !o.visible || !o.material.isMeshStandardMaterial || o.material.name === 'Glow') return;
      armorTint(o.material, M_, A_, rim);
      if (set.metal) { o.material.metalness = 0.55; o.material.roughness = 0.35; }
      o.material.emissiveIntensity = 0;
    });
    // Capa de tecido no lugar da capinha do modelo; borda brilha do lendário para cima.
    rig.model.traverse(o => { if (o.isMesh && /_Cape$/.test(o.name)) o.visible = false; });
    const capeC = set.cape ?? A_, trim = capeC === A_ ? M_ : A_;
    const cape = new THREE.Mesh(capeGeo(rank), capeMat(capeC, trim, rank >= 3 ? set.gem ?? A_ : 0)); cape.castShadow = true;
    const capeH = new THREE.Group(); capeH.add(cape); at('chest', capeH, 0, 0.3, -0.34, chestP); hero.cape = cape;
    // Fecho da capa nos ombros: barra de metal com dois broches.
    const clasp = new THREE.Mesh(shared('clasp', () => new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6)), oMetal(trim)); clasp.rotation.z = Math.PI / 2; clasp.position.set(0, 0.02, -0.02); capeH.add(clasp);
    for (const sx of [-1, 1]) { const b = new THREE.Mesh(shared('brooch', () => new THREE.SphereGeometry(0.08, 8, 6)), rank >= 2 ? oGlow(set.gem ?? A_, 2.5) : oMetal(trim)); b.position.set(sx * 0.4, 0.02, 0.04); capeH.add(b); }
    const helm = !!D && D[2].split(' ').includes('helm'), H = helm ? HELM_AT : HEAD_AT[visualCls] ?? HEAD_AT.guerreiro;
    const put = (geo, m, [x, y, z], rx = 0, ry = 0, rz = 0, s = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.setScalar(s); head.add(o); return o; };
    const G = (key, make) => shared('orn' + key, make);
    const cone = G('cone', () => new THREE.ConeGeometry(0.08, 0.4, 5)), oct = G('oct', () => new THREE.OctahedronGeometry(0.12)), ball = G('ball', () => new THREE.SphereGeometry(0.08, 8, 6));
    const ringAround = (n, r, y, fn) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; fn(Math.cos(a) * r, y, Math.sin(a) * r + H.ring[2], a, i); } };
    const band = (m, r = H.ringR, y = H.ring[1], th = 0.05) => { const t = put(G(`band${r},${th}`, () => new THREE.TorusGeometry(r, th, 5, 24)), m, [0, y, H.ring[2]], Math.PI / 2 + H.tilt); return t; };
    const gemFront = (c, s = 1) => put(oct, oGlow(c, 2 + rank), H.front, 0, 0, 0, s);
    const feather = (s, c, len = 1) => { const f = put(G('feather', () => new THREE.ConeGeometry(0.09, 0.8, 4).translate(0, 0.4, 0)), oCloth(c), [s * H.side, H.sideY, -0.1], -0.4, 0, -s * 0.5, len); f.scale.z = 0.3 * len; return f; };
    const horn = (s, c, len = 1) => put(G('horn', () => new THREE.ConeGeometry(0.1, 0.6, 6).translate(0, 0.3, 0)), c, [s * H.side * 0.9, H.sideY + 0.15, 0], -0.2, 0, -s * 0.7, len);
    if (D) {
      const T = H.top, F = H.front, S = H.side, Y = H.sideY, hornG = G('horn', () => new THREE.ConeGeometry(0.1, 0.6, 6).translate(0, 0.3, 0));
      const crescent = (c, pos, s, rz = -1.15 * Math.PI) => put(G('moon', () => new THREE.TorusGeometry(0.5, 0.08, 6, 28, Math.PI * 1.3)), oGlow(c, 3), pos, 0, 0, rz, s);
      const flameAt = (pos, s = 1) => { const f = put(G('flame', () => new THREE.ConeGeometry(0.16, 0.6, 7).translate(0, 0.3, 0)), oFx(0xff8a2a), pos, 0, 0, 0, s); hero.flaps.push({ o:f, axis:'y', base:0, amp:3, sp:2 }); };
      const PIECE = {
        cloth:c => band(oCloth(c), H.ringR, H.ring[1] - 0.05, 0.05),
        band:c => band(oMetal(c), H.ringR + 0.03, H.ring[1], 0.06),
        tassel:c => { put(ball, oCloth(c), [T[0], T[1] + 0.06, T[2]], 0, 0, 0, 1.6); put(cone, oCloth(c), [T[0], T[1] - 0.05, T[2] - 0.2], -2.3, 0, 0, 1.2); },
        rivets:() => ringAround(10, H.ringR + 0.02, H.ring[1] - 0.12, (x, y, z) => put(ball, oMetal(0x9a9aa0), [x, y, z], 0, 0, 0, 0.45)),
        patches:() => { const p = G('patch', () => new THREE.BoxGeometry(0.24, 0.22, 0.04));
          put(p, oCloth(0xb0503a), [F[0] - 0.2, F[1] + 0.12, F[2] - 0.06], 0, -0.3, 0.2); put(p, oCloth(0x4a7ab0), [S * 0.95, Y + 0.1, 0.05], 0, Math.PI / 2, -0.15, 0.9); },
        featherSide:c => feather(1, c, 1.3),
        plume:c => { for (let i = 0; i < 7; i++) put(G('plume', () => new THREE.BoxGeometry(0.09, 0.4, 0.15)), oCloth(c), [0, T[1] + 0.05 + Math.sin(i / 6 * Math.PI) * 0.22, T[2] + 0.35 - i * 0.14], -0.6 + i * 0.25); },
        crest:kind => { for (let i = 0; i < 7; i++) { const t = i / 6, m = kind === 'ice' ? oGlow(set.gem ?? A_, 1.5) : kind === 'crystal' ? oGlow(i % 2 ? A_ : set.gem, 2.2) : oMetal(A_);
          const c = put(kind === 'crystal' ? oct : cone, m, [0, T[1] - 0.08 + Math.sin(t * Math.PI) * 0.1, F[2] - 0.15 - t * 1.05], -0.5 + t, 0, 0, 0.7 + Math.sin(t * Math.PI) * 0.6); if (kind === 'crystal') c.scale.y *= 2.2; } },
        brow:c => { const g = put(oct, oGlow(c, 3), [0, F[1] + 0.24, F[2] - 0.06], 0, 0, 0, 0.9); g.scale.z = 0.35; },
        hornsBack:c => { for (const s of [-1, 1]) put(hornG, oMetal(c), [s * 0.38, Y + 0.3, -0.1], -1.1, 0, -s * 0.35, 1.4); },
        hornsUp:c => { for (const s of [-1, 1]) horn(s, oMetal(c), 1.3); },
        hornsGlow:c => { for (const s of [-1, 1]) horn(s, oGlow(c, 1.6), 1.5); },
        hornsBull:c => { for (const s of [-1, 1]) { put(hornG, oMetal(c), [s * S * 0.9, Y + 0.1, 0.05], 0, 0, -s * 1.35, 1.4); put(hornG, oMetal(c), [s * (S + 0.72), Y + 0.15, 0.05], 0, 0, -s * 0.15, 1); } },
        hornsCurl:c => { for (const s of [-1, 1]) put(G('curl', () => new THREE.TorusGeometry(0.24, 0.08, 6, 16, Math.PI * 1.5)), oMetal(c), [s * (S + 0.04), Y, 0.05], 0, Math.PI / 2, s > 0 ? 0.6 : 0.6); },
        hornsCrystal:() => { for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const c = put(oct, oGlow(k ? A_ : set.gem, 2.2), [s * (S + 0.05 + k * 0.2), Y + 0.25 + k * 0.3, 0], 0, 0, -s * 0.5, 1.1 - k * 0.3); c.scale.y *= 2.4; } },
        flameTips:() => { for (const s of [-1, 1]) { const h = horn(s, oMetal(0xffb52e), 1.3), f = new THREE.Mesh(G('flame', () => new THREE.ConeGeometry(0.16, 0.6, 7).translate(0, 0.3, 0)), oFx(0xff8a2a));
          f.position.y = 0.55; f.scale.setScalar(0.7); h.add(f); hero.flaps.push({ o:f, axis:'y', base:0, amp:3, sp:2 }); } },
        flame:() => flameAt([T[0], T[1] - 0.02, T[2]], 1.1),
        shards:() => { for (let i = 0; i < 4; i++) { const o = new THREE.Mesh(G('tet', () => new THREE.TetrahedronGeometry(0.12)), oGlow(set.gem, 3)); root.add(o); hero.orbit.push({ o, ph:i * 1.57, r:0.85, y:3.2 }); } },
        sunfan:() => { const h = new THREE.Group(); h.position.set(0, Y + 0.15, -0.55); head.add(h);
          for (let i = 0; i <= 8; i++) { const r = new THREE.Mesh(G('ray', () => new THREE.ConeGeometry(0.07, 0.55, 4).translate(0, 0.55, 0)), oGlow(i % 2 ? 0xffb52e : 0xffe08a, 3)); r.rotation.z = (i / 8 - 0.5) * Math.PI * 1.1; h.add(r); }
          hero.flaps.push({ o:h, axis:'z', base:0, amp:0.08, sp:1.5 }); },
        wingsHead:c => { for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * S, Y + 0.1, -0.05); head.add(w);
          for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(G('wf', () => new THREE.PlaneGeometry(0.16, 0.6).translate(0, 0.3, 0)), oFx(c)); f.rotation.z = -s * (0.5 + i * 0.35); w.add(f); }
          hero.flaps.push({ o:w, axis:'y', base:-s * 0.3, amp:s * 0.25, sp:4 }); } },
        halo:c => put(G('halo', () => new THREE.TorusGeometry(0.36, 0.035, 6, 32)), oGlow(c, 3), [T[0], T[1] + 0.3, T[2]], Math.PI / 2),
        crown:c => { band(oMetal(c), H.ringR + 0.03, H.ring[1], 0.06);
          ringAround(8, H.ringR + 0.03, H.ring[1] + 0.18, (x, y, z, a, i) => put(cone, oMetal(c), [x, y, z], 0, 0, 0, i % 2 ? 0.6 : 0.9));
          ringAround(4, H.ringR + 0.1, H.ring[1], (x, y, z) => put(oct, oGlow(set.gem, 4), [x, y, z], 0, 0, 0, 0.5)); },
        thorns:c => ringAround(9, H.ringR + 0.02, H.ring[1] - 0.05, (x, y, z, a) => put(cone, oMetal(c), [x, y, z], Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6, 0.65)),
        moonCrest:c => crescent(c, [0, T[1] + 0.35, T[2] - 0.1], 0.7),
        moonTop:c => crescent(c, [0, T[1] + 0.45, 0], 0.65),
        moonFront:c => crescent(c, [F[0], F[1] + 0.12, F[2] + 0.02], 0.3),
        bladeHalo:() => { const h = new THREE.Group(); h.position.set(0, Y + 0.2, -0.6); head.add(h);
          for (let i = 0; i < 10; i++) { const b = new THREE.Mesh(G('blade', () => new THREE.ConeGeometry(0.06, 0.5, 4).translate(0, 0.45, 0)), oGlow(i % 2 ? 0xffc94a : set.gem, 3)); b.rotation.z = i / 10 * Math.PI * 2; b.scale.z = 0.3; h.add(b); }
          hero.spins.push({ o:h, axis:'z', speed:0.7 }); },
        tusks:() => { for (const s of [-1, 1]) put(hornG, oCloth(0xf0e8d0), [s * (S - 0.05), Y - 0.15, 0.35], 1.0, 0, -s * 0.5, 0.8); },
        skull:() => { const sk = propScene('skull'); if (sk) { sk.position.set(F[0], F[1] + 0.05, F[2] - 0.05); sk.scale.setScalar(0.32); head.add(sk); } },
        leaves:c => { for (let i = 0; i < 4; i++) { const l = put(oct, oCloth(c), [S * 0.95, Y + 0.1 + i * 0.12, -0.15 + i * 0.05], 0, 0, -0.6 - i * 0.3, 1); l.scale.set(0.5, 1.6, 0.25); } },
        icicles:() => { for (let i = 0; i < 7; i++) { const a = Math.PI * (0.12 + i / 6 * 0.76); put(cone, oGlow(set.gem, 1.4), [Math.cos(a) * 0.5, 0.45 + Math.sin(a) * 0.5, F[2] - 0.02], Math.PI, 0, 0, 0.5 + (i % 2) * 0.3); } },
        circlet:c => band(oMetal(c), 0.53, 0.72, 0.05),
        mask:c => put(G('mask', () => new THREE.BoxGeometry(0.62, 0.2, 0.14)), oCloth(c), [0, 0.13, F[2] - 0.1]),
        antlers:() => { for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const c = put(oct, oGlow(k ? A_ : set.gem, 2), [s * (0.3 + k * 0.14), T[1] + 0.1 + k * 0.12, T[2]], 0, 0, -s * (0.3 + k * 0.4), 0.9 - k * 0.15); c.scale.y *= 2.4; } },
        gem:() => gemFront(set.gem ?? A_),
        helm:() => {
          // Tira capuz/pele/elmo da classe; o arqueiro ganha o rosto do cavaleiro (o capuz faz parte da cabeça dele).
          rig.model.traverse(o => { if (o.isMesh && /_(Hat|Helmet)$/.test(o.name)) o.visible = false; });
          const hood = rig.model.getObjectByName('Rogue_Head_Hooded'), src = GLTF.Knight?.scene.getObjectByName('Knight_Head');
          if (hood && src) {
            const skel = new THREE.Skeleton(src.skeleton.bones.map(b => rig.model.getObjectByName(b.name)), src.skeleton.boneInverses);
            const face = new THREE.SkinnedMesh(src.geometry, armorTint(src.material.clone(), M_, A_, rim)); face.material.userData.shared = false;
            face.bind(skel, src.bindMatrix); face.castShadow = true; face.frustumCulled = false; hood.parent.add(face); hood.visible = false;
          }
          put(G('dome', () => new THREE.SphereGeometry(0.63, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.56)), oMat(`dome${M_}`, () => mat(M_, { metalness:0.85, roughness:0.22, flatShading:false })), [0, 0.47, -0.02], 0, 0, 0, 1).scale.set(1.04, 0.98, 1.06);
          band(oMetal(A_), 0.62, 0.42, 0.05);
          put(G('nose', () => new THREE.BoxGeometry(0.09, 0.32, 0.06)), oMetal(A_), [0, 0.36, 0.63]);
          put(G('ridge', () => new THREE.TorusGeometry(0.645, 0.04, 5, 22, Math.PI)), rank >= 2 ? oGlow(set.gem ?? A_, 2.5) : oMetal(A_), [0, 0.5, -0.02], 0, Math.PI / 2, 0);
        },
        fur:() => {},
      };
      for (const p of D[2].split(' ')) { const [k, arg] = p.split(':'); PIECE[k]?.(arg === undefined ? undefined : arg === 'ice' || arg === 'crystal' || arg === 'spike' ? arg : Number(arg)); }
      // Peça de corpo de cada classe: ombreiras (guerreiro), gola de pele (berserker), aljava (arqueiro).
      if (visualCls === 'guerreiro') for (const s of [-1, 1]) {
        const g = new THREE.Group(), side = s < 0 ? 'upperarml' : 'upperarmr';
        const pad = new THREE.Mesh(G('pad', () => new THREE.SphereGeometry(0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), set.metal ? oMetal(M_) : oCloth(M_)); pad.scale.set(1.15, 0.75, 1.1); g.add(pad);
        const rimT = new THREE.Mesh(G('padRim', () => new THREE.TorusGeometry(0.27, 0.035, 4, 16)), oMetal(A_)); rimT.rotation.x = Math.PI / 2; rimT.scale.set(1.15, 1.1, 1); g.add(rimT);
        if (rank >= 2) { const gm = new THREE.Mesh(oct, oGlow(set.gem ?? A_, 3)); gm.position.set(s * 0.12, 0.12, 0.18); gm.scale.setScalar(0.5); g.add(gm); }
        at(side, g, s * 0.04, 0.17, 0, P(side));
      } else if (visualCls === 'berserker') {
        const fc = Number(D[2].match(/fur:(\w+)/)?.[1] ?? 0x8a7a60);
        const fur = new THREE.Mesh(G('fur', () => new THREE.TorusGeometry(0.42, 0.14, 5, 10)), oCloth(fc)); fur.rotation.x = Math.PI / 2;
        const h = new THREE.Group(); h.add(fur); at('chest', h, 0, 0.38, 0, chestP);
        if (rank >= 2) for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(cone, oCloth(0xf0e8d0)); const a = (i / 4 - 0.5) * 1.6; t.position.set(Math.sin(a) * 0.4, -0.12, Math.cos(a) * 0.4); t.rotation.x = Math.PI; t.scale.setScalar(0.45); h.add(t); }
      } else if (visualCls === 'arqueiro') {
        const q = new THREE.Group(); q.rotation.z = -0.45;
        const tube = new THREE.Mesh(G('quiver', () => new THREE.CylinderGeometry(0.14, 0.11, 0.8, 8)), oCloth(A_)); q.add(tube);
        for (let i = 0; i < 3; i++) { const sh = new THREE.Mesh(G('shaft', () => new THREE.BoxGeometry(0.025, 0.35, 0.025)), oCloth(0xd8c8a0)); sh.position.set((i - 1) * 0.06, 0.52, 0); q.add(sh);
          const fl = new THREE.Mesh(oct, rank >= 2 ? oGlow(set.gem ?? A_, 2.5) : oCloth(M_)); fl.position.set((i - 1) * 0.06, 0.68, 0); fl.scale.set(0.35, 0.9, 0.12); q.add(fl); }
        at('chest', q, 0.05, 0.05, -0.62, chestP);
      }
      return;
    }
    switch (set.orn) {
      case 'feather': band(oCloth(0x3a2618), H.ringR, H.ring[1] - 0.05, 0.04); feather(1, 0xc8b8a0); break;
      case 'patch':
        put(G('patch', () => new THREE.BoxGeometry(0.24, 0.22, 0.04)), oCloth(0xb0503a), [H.front[0] - 0.18, H.front[1] + 0.1, H.front[2] - 0.04], 0, -0.3, 0.2);
        put(G('patch', () => new THREE.BoxGeometry(0.24, 0.22, 0.04)), oCloth(0x4a7ab0), [H.side * 0.95, H.sideY + 0.1, 0.05], 0, Math.PI / 2, -0.15, 0.9);
        put(ball, oCloth(0xe0d0a0), H.top, 0, 0, 0, 1.4); break;
      case 'ice':
        ringAround(7, H.ringR + 0.04, H.ring[1], (x, y, z, a, i) => put(cone, oGlow(set.gem, 1.4), [x, y + 0.1, z], Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5, 0.8 + (i % 2) * 0.5));
        { const c = put(oct, oGlow(set.gem, 3), H.top, 0, 0, 0, 1.3); c.scale.y = 2.6; hero.spins.push({ o:c, axis:'y', speed:1.2 }); } break;
      case 'steel':
        band(oMetal(set.a), H.ringR + 0.03, H.ring[1], 0.06);
        for (let i = 0; i < 6; i++) put(G('plume', () => new THREE.BoxGeometry(0.08, 0.34, 0.14)), oCloth(0x2a5ad8), [0, H.top[1] - 0.02 + Math.sin(i / 5 * Math.PI) * 0.18, H.top[2] + 0.25 - i * 0.12], -0.5 + i * 0.25);
        gemFront(set.gem); break;
      case 'void':
        for (const s of [-1, 1]) horn(s, oMetal(0x1a0e30), 1.2);
        { const e = gemFront(set.gem, 1.3); e.scale.z = 0.4; }
        for (let i = 0; i < 4; i++) { const o = new THREE.Mesh(G('tet', () => new THREE.TetrahedronGeometry(0.12)), oGlow(set.gem, 3)); root.add(o); hero.orbit.push({ o, ph:i * 1.57, r:0.85, y:3.3 }); } break;
      case 'crystal':
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, c = put(oct, oGlow(i ? set.a : set.gem, 2.2), [H.top[0] + (i ? Math.cos(a) * 0.14 : 0), H.top[1] - (i ? 0.08 : -0.05), H.top[2] + (i ? Math.sin(a) * 0.14 : 0)], i ? Math.sin(a) * 0.5 : 0, 0, i ? -Math.cos(a) * 0.5 : 0, i ? 0.8 : 1.3); c.scale.y *= 2.4; }
        for (const s of [-1, 1]) { const c = put(oct, oGlow(set.gem, 2), [s * H.side, H.sideY, 0], 0, 0, -s * 0.4, 0.7); c.scale.y *= 2; } break;
      case 'sun':
        band(oMetal(0xffcf6a), H.ringR + 0.03, H.ring[1], 0.06);
        ringAround(10, H.ringR + 0.06, H.ring[1] + 0.08, (x, y, z, a, i) => put(cone, oGlow(i % 2 ? 0xffb52e : 0xffe08a, 3), [x, y, z], Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35, i % 2 ? 0.7 : 1.1));
        { const f = put(G('flame', () => new THREE.ConeGeometry(0.16, 0.6, 7).translate(0, 0.3, 0)), oFx(0xff8a2a), H.top); hero.flaps.push({ o:f, axis:'y', base:0, amp:3, sp:2 }); }
        gemFront(set.gem); break;
      case 'wings':
        for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * H.side, H.sideY + 0.1, -0.05); head.add(w);
          for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(G('wf', () => new THREE.PlaneGeometry(0.16, 0.6).translate(0, 0.3, 0)), oFx(set.wings)); f.rotation.z = -s * (0.5 + i * 0.35); w.add(f); }
          hero.flaps.push({ o:w, axis:'y', base:-s * 0.3, amp:s * 0.25, sp:4 }); }
        { const h = put(G('halo', () => new THREE.TorusGeometry(0.36, 0.035, 6, 32)), oGlow(set.a, 3), [H.top[0], H.top[1] + 0.3, H.top[2]], Math.PI / 2); void h; } gemFront(set.gem); break;
      case 'crown':
        band(oMetal(0xffc94a), H.ringR + 0.03, H.ring[1], 0.06);
        ringAround(8, H.ringR + 0.03, H.ring[1] + 0.18, (x, y, z, a, i) => put(cone, oMetal(0xffc94a), [x, y, z], 0, 0, 0, i % 2 ? 0.6 : 0.9));
        ringAround(4, H.ringR + 0.1, H.ring[1], (x, y, z) => put(oct, oGlow(set.gem, 4), [x, y, z], 0, 0, 0, 0.5));
        for (const s of [-1, 1]) horn(s, oMetal(0x1a0a0e), 1.6); break;
      case 'judge': {
        const h = new THREE.Group(); h.position.set(0, H.sideY + 0.2, -0.6); head.add(h);
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, b = new THREE.Mesh(G('blade', () => new THREE.ConeGeometry(0.06, 0.5, 4).translate(0, 0.45, 0)), oGlow(i % 2 ? 0xffc94a : set.gem, 3)); b.rotation.z = a; b.scale.z = 0.3; h.add(b); }
        hero.spins.push({ o:h, axis:'z', speed:0.7 });
        for (const s of [-1, 1]) horn(s, oMetal(0x0a0408), 0.9); gemFront(set.gem, 1.2); break; }
      case 'moon': {
        const m = put(G('moon', () => new THREE.TorusGeometry(0.5, 0.08, 6, 28, Math.PI * 1.3)), oGlow(set.gem, 3), [0, H.sideY + 0.35, -0.55], 0, 0, -0.65 * Math.PI);
        hero.flaps.push({ o:m, axis:'y', base:0, amp:0.4, sp:1.2 });
        ringAround(7, H.ringR + 0.02, H.ring[1] + 0.05, (x, y, z, a) => put(cone, oMetal(0x5a0010), [x, y, z], Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6, 0.7));
        gemFront(0xff1a3c, 1.2); break; }
    }
  }
  if (set && (armorStyle === 'atual' || tint)) {
    const padM = set.pad === 'ice' || set.pad === 'crystal' ? glow(set.c, 1.6) : mat(set.c, set.pad === 'leather' || set.pad === 'cloth' ? { roughness:0.9 } : { metalness:0.75, roughness:0.3, emissive:set.gem ?? 0, emissiveIntensity:rank >= 2 ? 0.25 : 0 });
    for (const s of [-1, 1]) {
      const g = new THREE.Group(), side = s < 0 ? 'upperarml' : 'upperarmr';
      if (set.pad === 'ice') for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35 + k * 0.06, 5), padM); c.position.set(s * k * 0.05, 0.12, (k - 1.5) * 0.08); c.rotation.z = -s * (0.3 + k * 0.15); g.add(c); }
      else if (set.pad === 'crystal') for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.12 - k * 0.02), padM); c.scale.y = 1.8; c.position.set(s * k * 0.06, 0.12 + k * 0.05, (k - 1) * 0.1); c.rotation.z = -s * 0.4; g.add(c); }
      else {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), padM); pad.scale.set(1.1, set.pad === 'cloth' ? 0.5 : 0.75, 1); pad.castShadow = true; g.add(pad);
        if (set.pad === 'spike' || set.pad === 'gold') for (let k = 0; k < (set.pad === 'spike' ? 3 : 2); k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 5), set.pad === 'spike' ? glow(set.ring, 2) : padM); sp.position.set(s * 0.05, 0.16, (k - 0.5) * 0.14); sp.rotation.z = -s * 0.5; g.add(sp); }
        if (rank >= 2 && set.gem) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), glow(set.gem, 4)); gem.position.set(s * 0.12, 0.08, 0.16); g.add(gem); }
      }
      const shoulder = P(side);
      at(side, g, s * 0.04, 0.16, 0, shoulder);
    }
    if (rank >= 1) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.05, 6), padM); plate.rotation.x = Math.PI / 2; plate.castShadow = true;
      const holder = new THREE.Group(); holder.add(plate);
      if (set.gem) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), glow(set.gem, 4)); gem.position.z = 0.06; holder.add(gem); hero.gem ??= gem; }
      at('chest', holder, 0, 0.1, 0.36, chestP);
    }
  }
  if (set) {
    if (set.cape && rank >= 3 && armorStyle !== 'tema') {
      const cape = new THREE.Group();
      for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 1.1).translate(0, -0.55, 0), additive(new THREE.Color(set.cape).multiplyScalar(1.4), 0.55, { side:THREE.DoubleSide })); p.position.x = (k - 1) * 0.28; cape.add(p); hero.flaps.push({ o:p, axis:'x', base:0.2, amp:0.25, sp:6 + k }); }
      at('chest', cape, 0, 0.2, -0.34, chestP);
    }
    if (set.sun && rank >= 3) { const sun = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 16), glow(0xffb52e, 3)); const h = new THREE.Group(); h.add(sun); at('head', h, 0, 0.1, -0.45, headP); hero.spins.push({ o:sun, axis:'z', speed:0.8 }); }
    if (set.wings && rank >= 3) buildWings(set.wings, 0.45);
    const fxColor = set.gem ?? set.c;
    if (set.fx === 'frost') sparkAt(16, 0xbff0ff, 0.09, around(0.6, 1.2, 2.6), o => o.set(rnd(-0.1, 0.1), -0.3, rnd(-0.1, 0.1)));
    if (set.fx === 'shards') for (let i = 0; i < 3; i++) { const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), glow(fxColor, 4)); root.add(o); hero.orbit.push({ o, ph:i * 2.09, r:1.0, y:1.6 }); }
    if (set.fx === 'embers') sparkAt(30, 0xff8a2a, 0.1, around(0.5, 0.6, 2.4), o => o.set(rnd(-0.2, 0.2), rnd(0.8, 1.6), rnd(-0.2, 0.2)), [0.4, 1]);
    if (set.fx === 'blood') sparkAt(36, 0xff1a3c, 0.11, around(0.6, 0.4, 2.6), o => o.set(rnd(-0.15, 0.15), rnd(0.6, 1.4), rnd(-0.15, 0.15)), [0.5, 1.2]);
    if (set.fx === 'aurora') sparkAt(24, 0x9ae8ff, 0.12, around(0.8, 1, 3), o => o.set(0, rnd(0.2, 0.5), 0), [1, 2]);
  }

  // ----- skin -----
  function buildWings(color, size) {
    for (const s of [-1, 1]) {
      const wing = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 1.2 - k * 0.14).translate(0, 0.55, 0), additive(new THREE.Color(color).multiplyScalar(1.3), 0.5, { side:THREE.DoubleSide }));
        f.rotation.z = -s * (0.5 + k * 0.28); f.position.x = s * k * 0.06; wing.add(f);
      }
      wing.scale.setScalar(size / 0.45);
      const h = new THREE.Group(); h.add(wing); at('chest', h, s * 0.18, 0.15, -0.3, chestP);
      hero.flaps.push({ o:wing, axis:'y', base:-s * 0.5, amp:s * 0.35, sp:3 });
    }
  }
  if (skin === 'arcanista') {
    for (let i = 0; i < 3; i++) {
      const pl = new THREE.Group(), ball = new THREE.Mesh(new THREE.SphereGeometry(0.1 + i * 0.03, 12, 8), glow([0x5ff2ff, 0xffb52e, 0xff7ad9][i], 2.5)); pl.add(ball);
      if (i === 1) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.015, 4, 24), glow(0xffe6a0, 2)); ring.rotation.x = 1.2; pl.add(ring); }
      root.add(pl); hero.orbit.push({ o:pl, ph:i * 2.09, r:1.1 + i * 0.15, y:2.2 + i * 0.25 });
    }
    sparkAt(22, 0xc8b8ff, 0.08, around(0.9, 0.5, 3.2), o => o.set(0, rnd(0.05, 0.2), 0), [1.5, 3]);
  } else if (skin === 'lorde') {
    for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.55, 6), mat(0x1a1416, { roughness:0.4 })); horn.rotation.z = -s * 0.55; const h = new THREE.Group(); h.add(horn); at('head', h, s * 0.3, 0.75, 0, headP); }
    sparkAt(40, 0xff6a1a, 0.13, around(0.55, 0.2, 2.2), o => o.set(rnd(-0.15, 0.15), rnd(1, 2), rnd(-0.15, 0.15)), [0.4, 1]);
  }
  if (amulet && amuletName) {
    const pend = amuletPendant(amuletName, amulet); pend.scale.setScalar(0.85); at('chest', pend, 0, -0.12, 0.42, chestP); hero.pendant = pend;
  } else if (amulet && !hero.gem) {
    const k = [0, 2, 3.5, 5, 6.5][RARITY[amulet].rank];
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), k ? glow(rarityColor(amulet), k) : mat(0x9aa0aa, { metalness:0.6 }));
    const h = new THREE.Group(); h.add(gem); at('chest', h, 0, -0.05, 0.4, chestP); hero.gem = gem;
  }
  hero.skinEquipment = { armor:!!armor, chest:!!armor || !!amulet, cape:!!hero.cape || !!(set?.cape && rank >= 3 && armorStyle !== 'tema') };
  applySkinCosmetics(hero, skin);
  hero.update = (dt, t) => {
    if (hero.poseBow || hero.poseAxe) for (const x of baseBones) { x.b.position.copy(x.p); x.b.quaternion.copy(x.q); x.b.scale.copy(x.s); }
    rig.update(dt);
    if (hero.poseBow || hero.poseAxe) { for (const x of baseBones) { x.p.copy(x.b.position); x.q.copy(x.b.quaternion); x.s.copy(x.b.scale); } hero.poseBow?.(hero.bowPhase); hero.poseAxe?.(hero.axeWeight); }
    cosmicTime.value = t; capeTime.value = t;
    if (hero.pendant) { const u = hero.pendant.userData; u.gem.rotation.z = Math.sin(t * 2.2) * 0.12; if (u.ring) u.ring.rotation.y = t * 2.5; if (u.pulse) u.gem.scale.setScalar(1 + Math.sin(t * 5) * 0.12); }
    if (hero.cape) hero.cape.rotation.x += (0.1 + rig.moving() * 0.75 - hero.cape.rotation.x) * Math.min(1, dt * 6);
    for (const { o, ph, r = 0.7, y = 0.9 } of hero.orbit) o.position.set(Math.cos(t * 1.6 + ph) * r, y + Math.sin(t * 2 + ph) * 0.1, Math.sin(t * 1.6 + ph) * r);
    for (const f of hero.flaps) f.o.rotation[f.axis] = f.base + Math.sin(t * f.sp) * f.amp;
    for (const s of hero.spins) s.o.rotation[s.axis] += dt * s.speed;
    if (hero.halo) hero.halo.position.z = Math.sin(t * 2) * 0.03;
    if (hero.gem) hero.gem.rotation.y = t * 2;
    for (const s of hero.sparks) s.update(dt);
  };
  hero.dispose = () => { hero.sparks.forEach(s => s.dispose()); root.removeFromParent(); };
  scene.add(root);
  return hero;
}

// Mobs com esqueleto: tipo do jogo -> modelos possíveis.
const MOB_MODEL = { esqueleto:['Skeleton_Minion', 'Skeleton_Rogue'], espirito:['Skeleton_Mage'], cavaleiro:['Skeleton_Warrior'], arauto:['Skeleton_Mage'], arqueiroEsq:['Skeleton_Rogue'], ceifador:['Skeleton_Rogue'],
  sombra:['Skeleton_Mage'], espectroGelo:['Skeleton_Mage'], armadura:['Knight'], senhorBrasas:['Barbarian'], rainhaGelo:['Mage'] };
// Arma por tipo ('' = sem arma do pacote; o ceifador ganha uma foice feita aqui).
const TYPE_PROP = { arqueiroEsq:'Skeleton_Crossbow', ceifador:'', rainhaGelo:'Skeleton_Staff', senhorBrasas:'Skeleton_Blade', armadura:'Skeleton_Blade' };
// Cor do corpo (multiplica a textura) e brilho próprio por tipo.
const MOB_TINT = { ceifador:{ c:0x8a7a9a, e:0x4a0a6a, ei:0.35 }, sombra:{ c:0x3a2a55, e:0x6a2acc, ei:0.45 }, espectroGelo:{ c:0xbfe8ff, e:0x3aa8ff, ei:0.5 },
  armadura:{ c:0x6a6a78, e:0x000000, ei:0 }, senhorBrasas:{ c:0x6a3a2a, e:0xff3a00, ei:0.1 }, rainhaGelo:{ c:0xe0f4ff, e:0x3aa8ff, ei:0.22 } };
const MOB_PROP = { Skeleton_Minion:'Skeleton_Blade', Skeleton_Rogue:'Skeleton_Blade', Skeleton_Warrior:'Skeleton_Blade', Skeleton_Mage:'Skeleton_Staff' };
export const isBony = type => !!MOB_MODEL[type]?.every(n => n.startsWith('Skeleton'));
const MOB_ACT = { aim:'1H_Ranged_Aiming', shoot:'1H_Ranged_Shoot', windup:'1H_Melee_Attack_Stab', slash:'2H_Melee_Attack_Slice', chop:'2H_Melee_Attack_Chop', cast:'Spellcast_Shoot', summon:'Spellcast_Summon', jump:'Jump_Full_Short', hit:'Hit_A', death:'Death_A', spawn:'Spawn_Ground_Skeletons', taunt:'Taunt' };
const rigMobReady = type => MOB_MODEL[type]?.every(hasModel);
function createRigMob(type, T, scale) {
  const options = MOB_MODEL[type], name = options[Math.floor(Math.random() * options.length)];
  const rig = makeRig(name, 1.25), root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.add(rig.model);
  const prop = GLTF[TYPE_PROP[type] ?? MOB_PROP[name]];
  if (prop) { const p = prop.scene.clone(); p.rotation.copy(HAND_ROT); p.traverse(o => { if (o.isMesh) o.castShadow = true; }); rig.bone('handslotr').add(p); }
  if ((type === 'cavaleiro' || type === 'armadura') && GLTF.Skeleton_Shield_Small_A) { const s = GLTF.Skeleton_Shield_Small_A.scene.clone(); s.rotation.copy(HAND_ROT); rig.bone('handslotl').add(s); }
  // Olhos (material "Glow") na cor do tema.
  rig.model.traverse(o => { if (o.isMesh && o.material.name === 'Glow') o.material = glow(T.accent, 4); });
  const tint = MOB_TINT[type];
  if (tint) rig.model.traverse(o => {
    if (!o.isMesh || !o.material.isMeshStandardMaterial) return;
    o.material = o.material.clone(); o.material.userData.shared = false; o.material.color.multiply(new THREE.Color(tint.c));
    if (tint.ei) { o.material.emissive = new THREE.Color(tint.e); o.material.emissiveIntensity = tint.ei; }
  });
  rig.base(rig.has('Idle_Combat') ? 'Idle_Combat' : 'Idle', 'Running_A');
  rig.once(MOB_ACT.spawn, 0.9);
  const dummy = () => new THREE.Object3D();
  const m = { type, root, body, rig, parts:{ armR:dummy(), armL:dummy(), handL:dummy(), handR:dummy() } };
  if (type === 'arauto') {
    // Arauto: mago esqueleto gigante com anéis do vazio girando em volta.
    const rings = [0, 1].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.3 + i * 0.4, 0.05, 6, 48), glow(T.accent, 3)); r.position.y = 1.6; r.rotation.x = Math.PI / 2 + i * 0.5; body.add(r); return r; });
    m.tick = dt => rings.forEach((r, k) => { r.rotation.z += dt * (k ? -1 : 1.4); });
  } else if (type === 'ceifador') {
    // Foice na mão e três almas girando em volta.
    const sc = new THREE.Group(); sc.rotation.copy(HAND_ROT); rig.bone('handslotr').add(sc);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), mat(0x2a2028)); handle.position.y = 0.6; sc.add(handle);
    const blade = box(1.1, 0.12, 0.04, mat(0x9aa0b0, { metalness:0.8, roughness:0.3 })); blade.position.set(0.5, 1.62, 0); blade.rotation.z = -0.35; sc.add(blade);
    const edge = box(1.0, 0.03, 0.05, glow(0xb45cff, 3)); edge.position.set(0.5, 1.55, 0); edge.rotation.z = -0.35; sc.add(edge);
    const souls = new THREE.Group(); souls.position.y = 1.4; body.add(souls);
    for (let i = 0; i < 3; i++) { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), glow(0xb45cff, 3)); o.position.set(Math.cos(i * 2.09) * 1.1, 0, Math.sin(i * 2.09) * 1.1); souls.add(o); }
    m.tick = dt => { souls.rotation.y += dt * 1.6; };
  } else if (type === 'senhorBrasas') {
    // Chifres escuros, coroa de brasas e um coração de fogo no peito.
    const hornM = mat(0x1a1416, { roughness:0.4 });
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 6), hornM); h.rotation.z = -s * 0.55; boneAt(rig, 'head', h, s * 0.32, 0.75, 0); }
    for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 4), glow(0xff6a1a, 4)); boneAt(rig, 'head', f, Math.cos(i * 1.257) * 0.22, 0.95, Math.sin(i * 1.257) * 0.22); }
    boneAt(rig, 'chest', new THREE.Mesh(new THREE.OctahedronGeometry(0.16), glow(0xff5a1a, 5)), 0, 0, 0.42);
  } else if (type === 'rainhaGelo') {
    // Coroa de gelo e três lascas geladas em órbita.
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, i === 0 ? 0.5 : 0.34, 4), glow(0x8fe0ff, 3.5)); boneAt(rig, 'head', c, Math.sin(i * 1.257) * 0.26, 1.05, Math.cos(i * 1.257) * 0.26); }
    const ice = new THREE.Group(); ice.position.y = 1.5; body.add(ice);
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), glow(0x8fe0ff, 2.5)); c.scale.y = 2; c.position.set(Math.cos(i * 2.09) * 1.2, 0, Math.sin(i * 2.09) * 1.2); ice.add(c); }
    m.tick = dt => { ice.rotation.y -= dt * 1.2; };
  }
  m.act = (what, dur) => rig.once(MOB_ACT[what], dur, { holdEnd:what === 'death' });
  return m;
}

// NPC animado (ex.: ferreiro do hub) com martelo opcional na mão.
export function createNpc(name, { tint = null, hammer = false, ladle = false } = {}) {
  if (!hasModel(name)) return null;
  const rig = makeRig(name, 1.45), root = new THREE.Group(); root.add(rig.model);
  rig.model.traverse(o => { if (o.isMesh && o.visible) { o.material = o.material.clone(); o.material.userData.shared = false; if (tint) o.material.color.multiply(new THREE.Color(tint)); } });
  if (hammer) {
    const h = new THREE.Group(); h.rotation.copy(HAND_ROT);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.95, 6), mat(0x5a3d22)); handle.position.y = 0.35; h.add(handle);
    const head = box(0.42, 0.24, 0.24, mat(0x6d727c, { metalness:0.8, roughness:0.35 })); head.position.y = 0.82; h.add(head);
    rig.bone('handslotr').add(h);
  }
  // Concha de mexer o caldeirão (alquimista).
  if (ladle) {
    const h = new THREE.Group(); h.rotation.copy(HAND_ROT);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), mat(0x8a6a44)); handle.position.y = 0.4; h.add(handle);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0x8a6a44, { side:THREE.DoubleSide })); cup.position.y = 0.98; h.add(cup);
    rig.bone('handslotr').add(h);
  }
  rig.base('Idle', 'Running_A');
  return { root, rig, update:dt => rig.update(dt), act:(n, d) => rig.once(n, d) };
}
// Ferramenta de coleta na mão do herói (picareta ou foice), cor do metal pelo nível.
const TOOL_METAL = [0xb87333, 0x9aa0a8, 0xe0e8f0, 0x5fe0ff];
const TOOL_MATS = new Map();
const toolMat = (key, make) => { let m = TOOL_MATS.get(key); if (!m) { m = make(); m.userData.shared = true; TOOL_MATS.set(key, m); } return m; };
export function createTool(kind, tier) {
  const g = new THREE.Group();
  const wood = toolMat('wood', () => mat(0x6b4a2f)), metal = toolMat(`m${tier}`, () => mat(TOOL_METAL[tier - 1], { metalness:0.8, roughness:0.3, ...(tier === 4 ? { emissive:0x1a6a88 } : {}) }));
  const handle = new THREE.Mesh(shared('toolHandle', () => new THREE.CylinderGeometry(0.045, 0.055, 1.1, 6).translate(0, 0.45, 0)), wood); g.add(handle);
  if (kind === 'picareta') {
    const head = new THREE.Mesh(shared('pickHead', () => new THREE.TorusGeometry(0.42, 0.06, 5, 12, Math.PI * 0.9).rotateZ(Math.PI * 0.05).scale(1, 0.55, 1).translate(0, 0.82, 0)), metal); g.add(head);
  } else {
    const blade = new THREE.Mesh(shared('sickleBlade', () => new THREE.TorusGeometry(0.3, 0.035, 4, 14, Math.PI * 1.25).scale(1, 1, 0.5).translate(0.3, 0.98, 0)), metal); g.add(blade);
  }
  // Maior que a escala real: a câmera do hub é alta e a ferramenta fina sumia.
  g.scale.setScalar(1.45);
  g.traverse(o => { o.castShadow = true; });
  return g;
}
