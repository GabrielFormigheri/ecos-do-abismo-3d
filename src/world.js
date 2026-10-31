import { surface, worldUV, foliageGeometry, addPlaza, addVillageDetails, addGateArch, addRuinArchitecture, addGardenArchitecture, addForgeArchitecture, addVoidArchitecture, addGraveArchitecture, addCaveArchitecture, addMagmaArchitecture, addFrostArchitecture, gardenPlanter } from './art-direction.js';
import { addHubArt, addNaturalTrees } from './hub-art.js';
// Mundo aberto: terreno low-poly com relevo, céu, vegetação instanciada e clareiras ligadas por trilhas.
// A área jogável é a união de círculos (clareiras) e cápsulas (trilhas); o resto é cenário.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './core.js';
import { segDist, roomD, layoutDungeon, planDungeon } from './layout.js';
import * as M from './models.js';
import { THEMES, mat, glow, box, additive, dotTex, createPortal, Sparks, shared, disposeTree, propGeo, propInstMat } from './models.js';

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function perlin(seed) {
  const rand = mulberry32(seed), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512); for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => ((h & 1) ? x : -x) + ((h & 2) ? y : -y);
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y) => {
    const fx = Math.floor(x), fy = Math.floor(y), X = fx & 255, Y = fy & 255; x -= fx; y -= fy;
    const u = x * x * (3 - 2 * x), v = y * y * (3 - 2 * y), a = perm[X] + Y, b = perm[X + 1] + Y;
    return lerp(lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u), lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u), v);
  };
}
const fbm = (n, x, y, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); a *= 0.5; f *= 2; } return s; };
export { layoutDungeon };

// Textura de gradiente vertical para barreiras (base forte, topo some).
const barrierTex = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 64, 0, 0);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
})();

function makeSky(T) {
  const m = new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{ top:{ value:new THREE.Color(T.skyTop) }, hor:{ value:new THREE.Color(T.horizon) } },
    vertexShader:'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.8, 0.0, 1.0); gl_FragColor = vec4(mix(hor, top, pow(h, 0.6)), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), m); sky.renderOrder = -1; sky.frustumCulled = false;
  if (T.stars) {
    // Céu estrelado (vazio): pontos fixos na cúpula, que acompanha a câmera.
    const rand = mulberry32(7), p = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) { const a = rand() * Math.PI * 2, y = 0.05 + rand() * 0.95, r = Math.sqrt(1 - y * y) * 280; p.set([Math.cos(a) * r, y * 280, Math.sin(a) * r], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color:0xd8d0ff, size:1.6, sizeAttenuation:false, fog:false, depthWrite:false })); stars.renderOrder = -1; stars.frustumCulled = false; sky.add(stars);
  }
  return sky;
}

// Agrupa geometrias estáticas por material e por bloco do mapa e funde: poucas chamadas de desenho,
// e a câmera ainda descarta os blocos fora de vista.
const CHUNK = 84, HEAVY = 30000; // bloco do mapa (unidades) e vértices a partir dos quais vale dividir
class Static {
  constructor() { this.parts = new Map(); }
  add(geo, material, x, y, z, ry = 0, s = 1, sy = s) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, sy, s)));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.userData.cell = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    const key = material.uuid; if (!this.parts.has(key)) this.parts.set(key, { material, geos:[] });
    this.parts.get(key).geos.push(g);
  }
  build(group) {
    for (const { material, geos } of this.parts.values()) {
      // Material leve vira uma malha só; pesado (muros, pedras) vira uma por bloco, para a câmera descartar o que não vê.
      const cells = new Map(), verts = geos.reduce((n, g) => n + g.attributes.position.count, 0);
      for (const g of geos) { const k = verts > HEAVY ? g.userData.cell : ''; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(g); }
      for (const list of cells.values()) {
        const merged = mergeGeometries(list);
        const mesh = new THREE.Mesh(merged, material); mesh.castShadow = !material.isMeshBasicMaterial; mesh.receiveShadow = true; group.add(mesh);
      }
      geos.forEach(g => g.dispose());
    }
  }
}

function instanced(geo, material, items, { shadow = true, chunk = 0 } = {}) {
  if (!items.length) return null;
  const tris = (geo.index ?? geo.attributes.position).count / 3;
  if (chunk && items.length * tris > HEAVY) {
    // Conjunto pesado: um pedaço por bloco do mapa; fora de vista, o bloco inteiro nem é desenhado.
    const cells = new Map();
    for (const it of items) { const k = Math.floor(it.x / chunk) + ',' + Math.floor(it.z / chunk); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(it); }
    if (cells.size > 1) { const g = new THREE.Group(); for (const list of cells.values()) g.add(instanced(geo, material, list, { shadow })); return g; }
  }
  const mesh = new THREE.InstancedMesh(geo, material, items.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  items.forEach((it, i) => {
    e.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0); q.setFromEuler(e);
    m4.compose(p.set(it.x, it.y, it.z), q, sc.set(it.s, it.sy ?? it.s, it.s)); mesh.setMatrixAt(i, m4);
    if (it.c !== undefined) mesh.setColorAt(i, col.set(it.c));
  });
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  return mesh;
}

// Geometrias de vegetação (compartilhadas entre mundos).
const G = {
  trunk:() => shared('trunk', () => new THREE.CylinderGeometry(0.22, 0.34, 1, 5).translate(0, 0.5, 0)),
  pine:() => shared('pine', () => mergeGeometries([new THREE.ConeGeometry(1.7, 2.6, 7).translate(0, 2.2, 0), new THREE.ConeGeometry(1.3, 2.2, 7).translate(0, 3.4, 0), new THREE.ConeGeometry(0.85, 1.7, 7).translate(0, 4.5, 0)])),
  round:() => shared('round', () => mergeGeometries([new THREE.IcosahedronGeometry(1.6, 0).translate(0, 3.0, 0), new THREE.IcosahedronGeometry(1.1, 0).translate(0.9, 2.4, 0.4)])),
  blossom:() => shared('blossom', () => mergeGeometries([new THREE.IcosahedronGeometry(1.8, 1).scale(1, 0.8, 1).translate(0, 3.2, 0), new THREE.IcosahedronGeometry(1.1, 1).translate(-1.1, 2.7, 0.3)])),
  dead:() => shared('dead', () => mergeGeometries([new THREE.BoxGeometry(0.18, 1.4, 0.18).rotateZ(0.7).translate(0.5, 2.6, 0), new THREE.BoxGeometry(0.15, 1.1, 0.15).rotateZ(-0.8).translate(-0.4, 3.0, 0), new THREE.BoxGeometry(0.12, 0.8, 0.12).rotateX(0.7).translate(0, 3.4, 0.3)])),
  spike:() => shared('spike', () => new THREE.ConeGeometry(0.9, 4.5, 5).translate(0, 2.2, 0)),
  crystal:() => shared('crystal', () => mergeGeometries([new THREE.ConeGeometry(0.6, 4.2, 5).translate(0, 2.1, 0), new THREE.ConeGeometry(0.35, 2.4, 5).rotateZ(0.4).translate(0.6, 1.1, 0), new THREE.ConeGeometry(0.3, 1.8, 5).rotateZ(-0.5).translate(-0.5, 0.9, 0.2)])),
  rock:() => shared('rock', () => new THREE.DodecahedronGeometry(1, 0)),
  tuft:() => shared('tuft', () => mergeGeometries([new THREE.ConeGeometry(0.07, 0.7, 3).translate(0, 0.35, 0), new THREE.ConeGeometry(0.06, 0.55, 3).rotateZ(0.35).translate(0.1, 0.27, 0), new THREE.ConeGeometry(0.06, 0.5, 3).rotateZ(-0.4).translate(-0.1, 0.25, 0.05)])),
  flower:() => shared('flower', () => new THREE.IcosahedronGeometry(0.14, 0).translate(0, 0.3, 0)),
  stone:() => shared('stone', () => new THREE.BoxGeometry(1.3, 3.2, 0.9).translate(0, 1.4, 0)),
  rune:() => shared('rune', () => new THREE.BoxGeometry(0.5, 0.5, 0.06)),
  tile:() => shared('tile', () => new THREE.BoxGeometry(1.5, 0.12, 0.9)),
};

// Constrói terreno + cenário em volta de uma área jogável.
function buildLand(group, T, zones, paths, seed, { size, center, sparks, bareR = 0, hole = null, avoid = [] }) {
  const rand = mulberry32(seed), n1 = perlin(seed), n2 = perlin(seed + 77), n3 = perlin(seed + 191);
  const hubPreview = !!T.art, barren = ['forge', 'void', 'cave', 'magma', 'frost'].includes(T.art); // sem árvores nem grama
  const sd = (x, z) => { let d = Infinity; for (const c of zones) d = Math.min(d, roomD(c, x, z)); for (const p of paths) d = Math.min(d, segDist(x, z, p) - p.w / 2); return d; };
  const pathD = (x, z) => { let d = Infinity; for (const p of paths) d = Math.min(d, segDist(x, z, p)); return d; };
  const WATER = -0.45, voidMode = T.lake === 'void', mode = T.land;
  // Pontes sobre a lava: corredor fora das salas fica abaixo do magma (o tabuleiro é desenhado por cima).
  const inRoom = (x, z) => zones.some(c => roomD(c, x, z) < 0);
  const height = (x, z) => {
    if (hole?.(x, z)) return -7;
    const d = sd(x, z);
    if((T.art==='ruins'||T.art==='garden'||T.art==='forge'||T.art==='grave'||T.art==='frost') && d>-0.01) return smoothstep(3,12,d)*(1.2+fbm(n1,x*.07,z*.07)*3);
    if (d <= 0) return mode === 'lava' && !inRoom(x, z) ? -1.4 : 0;
    const t = smoothstep(0, 10, d), hills = fbm(n1, x * 0.045, z * 0.045) + 0.5;
    // Caverna: paredes íngremes (inclinação limitada para não esconder o herói da câmera).
    if (mode === 'cave') return Math.min(d * 1.15, 3 + hills * 11) + fbm(n2, x * 0.2, z * 0.2) * 1.6 * smoothstep(0, 4, d);
    // Mar de magma: a borda cai direto na lava; rochas vulcânicas só ao longe.
    if (mode === 'lava') return -1.6 * smoothstep(0, 1.2, d) + smoothstep(12, 30, d) * hills * 14 + Math.max(0, fbm(n3, x * 0.06, z * 0.06) - 0.12) * 18 * smoothstep(5, 9, d);
    if (voidMode) return -Math.pow(smoothstep(3, 22, d), 1.6) * 40 + fbm(n2, x * 0.12, z * 0.12) * 1.2 * t + t * 1.2;
    let h = t * (1.2 + hills * 10) + fbm(n2, x * 0.16, z * 0.16) * 1.4 * t;
    const lake = fbm(n3, x * 0.03, z * 0.03);
    if (lake > 0.06) h -= (lake - 0.06) * 30 * smoothstep(1.5, 5, d);
    return h;
  };

  // Terreno: plano denso, alturas por vértice, cor por face (visual facetado).
  const seg = Math.round(size / 1.8);
  // Altura calculada uma vez por vértice da grade (antes de duplicar os vértices por face).
  const grid = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2).translate(center.x, 0, center.z), gp = grid.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, height(gp.getX(i), gp.getZ(i)));
  if (hubPreview) grid.computeVertexNormals();
  const geo = grid.toNonIndexed(); grid.dispose();
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(T.grass), cGrass2 = new THREE.Color(T.grass2), cDirt = new THREE.Color(T.dirt), cRock = new THREE.Color(T.rock), cSand = new THREE.Color(T.sand), cTop = new THREE.Color(T.top), c = new THREE.Color();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3(), e1 = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let f = 0; f < pos.count; f += 3) {
    a.fromBufferAttribute(pos, f); b.fromBufferAttribute(pos, f + 1); cc.fromBufferAttribute(pos, f + 2);
    const x = (a.x + b.x + cc.x) / 3, z = (a.z + b.z + cc.z) / 3, y = (a.y + b.y + cc.y) / 3;
    nrm.subVectors(b, a).cross(e1.subVectors(cc, a)).normalize();
    const slope = 1 - Math.abs(nrm.y), d = sd(x, z), v = fbm(n2, x * 0.3, z * 0.3);
    if (mode === 'lava' && d > -1.5 && d < 0.8 && y > -0.3) c.copy(cSand).lerp(cDirt, 0.5 + v); // borda quente
    else if (d <= 0.6) {
      const onPath = paths.length && pathD(x, z) < paths[0].w / 2 - 0.4 + v * 1.5;
      c.copy(onPath ? cDirt : cGrass2).lerp(cGrass, 0.3 + v * 0.6);
      // Pegadas de terra nas saídas, pintadas na própria malha.
      if (hubPreview && paths.length) {
        const wear = 1 - smoothstep(1.1, 3.6, pathD(x, z));
        c.lerp(cDirt, wear * (0.36 + Math.max(0, v) * 0.2));
      }
    } else if (mode === 'cave') c.copy(cRock).lerp(cTop, smoothstep(1, 9, y)); // parede escurece ao subir
    else if (!voidMode && y < WATER + 0.25) c.copy(cSand);
    else if (slope > 0.45 || y > 9) c.copy(y > 9 ? cTop : cRock).lerp(cRock, 0.3);
    else c.copy(cGrass).lerp(cGrass2, Math.max(0, v + 0.2));
    if (voidMode && y < -1) c.copy(cRock).multiplyScalar(0.6);
    c.multiplyScalar(0.9 + v * 0.25);
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (f + k) * 3);
  }
  // Suaviza a cor nos vértices compartilhados sem alterar a malha ou os trajetos.
  if (hubPreview) {
    const sums = new Map();
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i)},${pos.getZ(i)}`;
      const v = sums.get(key) ?? [0,0,0,0];
      v[0]+=colors[i*3]; v[1]+=colors[i*3+1]; v[2]+=colors[i*3+2]; v[3]++; sums.set(key,v);
    }
    for (let i = 0; i < pos.count; i++) {
      const v = sums.get(`${pos.getX(i)},${pos.getZ(i)}`);
      colors.set([v[0]/v[3],v[1]/v[3],v[2]/v[3]],i*3);
    }
  }
  // Terreno em blocos: a câmera só desenha (e a sombra só projeta) os blocos que vê.
  const terrainM = hubPreview ? surface(barren ? 'rock' : 'earth', {vertexColors:true, normalScale:new THREE.Vector2(.35,.35), ...(T.art === 'frost' && { map:null })}) : new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:0.95, metalness:0 });
  const TILE = 84, nt = Math.max(1, Math.ceil(size / TILE)), buckets = Array.from({ length:nt * nt }, () => []);
  const x0 = center.x - size / 2, z0 = center.z - size / 2;
  for (let f = 0; f < pos.count; f += 3) {
    const x = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3, z = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
    buckets[Math.min(nt - 1, Math.floor((z - z0) / TILE)) * nt + Math.min(nt - 1, Math.floor((x - x0) / TILE))].push(f);
  }
  for (const faces of buckets) if (faces.length) {
    const P = new Float32Array(faces.length * 9), Cc = new Float32Array(faces.length * 9), N = new Float32Array(faces.length * 9);
    faces.forEach((f, i) => { P.set(pos.array.subarray(f * 3, f * 3 + 9), i * 9); Cc.set(colors.subarray(f * 3, f * 3 + 9), i * 9); if (hubPreview) N.set(geo.attributes.normal.array.subarray(f * 3, f * 3 + 9), i * 9); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(Cc, 3)); if (hubPreview) g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); else g.computeVertexNormals();
    if(hubPreview) worldUV(g,5);
    const tm = new THREE.Mesh(g, terrainM); tm.receiveShadow = true; group.add(tm);
  }
  geo.dispose();

  let water = null;
  if (T.lake === 'water' || T.lake === 'lava') {
    // Visual novo: magma com a textura da rocha no brilho (partes mais claras e mais escuras).
    const wm = T.lake === 'lava' && hubPreview ? (m => (m.emissiveMap = m.map, m))(surface('rock', { color:0x000000, emissive:0xff7a20, emissiveIntensity:3, normalScale:new THREE.Vector2(.4, .4) })) : T.lake === 'lava' ? new THREE.MeshBasicMaterial({ color:new THREE.Color(T.water).multiplyScalar(1.6) })
      : new THREE.MeshStandardMaterial({ color:T.water, transparent:true, opacity:0.82, roughness:0.15, metalness:0.1 });
    water = new THREE.Mesh(hubPreview ? worldUV(new THREE.PlaneGeometry(size, size, 1, 1).rotateX(-Math.PI / 2).translate(center.x, 0, center.z), 9).translate(-center.x, 0, -center.z) : new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), wm); water.position.set(center.x, WATER, center.z); group.add(water);
  }

  // Espalha objetos fora da área jogável, mais densos perto da borda (moldura natural).
  const scatter = (count, minD, maxD, falloff) => {
    const out = [];
    for (let tries = 0; tries < count * 30 && out.length < count; tries++) {
      const x = center.x + (rand() - 0.5) * size * 0.96, z = center.z + (rand() - 0.5) * size * 0.96, d = sd(x, z);
      if (d < minD || d > maxD || rand() > Math.exp(-(d - minD) / falloff) * 0.9 + 0.1) continue;
      // Clareiras entre manchas de vegetação e corredor visual para o portão.
      if (hubPreview && (fbm(n3, x * 0.085, z * 0.085) < -0.08 || (z < -10 && Math.abs(x) < 9))) continue;
      const y = height(x, z); if (!voidMode && y < WATER + 0.2) continue; if (voidMode && y < -2) continue;
      out.push({ x, y, z, d });
    }
    return out;
  };
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const byType = {};
  if(hubPreview && !barren && T.art !== 'grave') addNaturalTrees(group,scatter(T.art==='village'?50:160,3,45,12).map(t=>({...t,s:.75+rand()*.45,ry:rand()*6.28})));
  for (const t of scatter(hubPreview ? 0 : 560, T.treeMin ?? 1.8, 60, 14)) (byType[pick(T.trees)] ??= []).push(t);
  // Árvores e pedras com textura (KayKit) quando carregaram; senão, as blocadas de antes.
  const KK = { pine:[['tree_single_A', 4.4]], round:[['tree_single_B', 4.4]], dead:[['tree_dead_large', 1.1], ['tree_dead_medium', 1.2]], spooky:[['tree_pine_orange_large', 1.2]] };
  const kkItems = {};
  for (const type of Object.keys(byType)) {
    const opts = KK[type]?.filter(([n]) => propGeo(n)); if (!opts?.length) continue;
    for (const t of byType[type]) { const [n, sc] = pick(opts), s = sc * (0.8 + rand() * 0.5); (kkItems[n] ??= []).push({ x:t.x, y:t.y - 0.1, z:t.z, s, ry:rand() * 6.28, c:new THREE.Color(1, 1, 1).multiplyScalar(0.85 + rand() * 0.25).getHex() }); }
    delete byType[type];
  }
  if (!hubPreview && T.trees.some(t => t === 'pine' || t === 'round')) {
    const clusters = ['trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium'].filter(propGeo);
    if (clusters.length) for (const t of scatter(hubPreview ? 50 : 140, 7, 70, 30)) (kkItems[pick(clusters)] ??= []).push({ x:t.x, y:t.y - 0.2, z:t.z, s:4.6 + rand() * 1.6, ry:rand() * 6.28, c:0xffffff });
  }
  const rockNames = voidMode || hubPreview ? [] : ['rock_single_A', 'rock_single_C', 'rock_single_E'].filter(propGeo);
  for (const [n, items] of Object.entries(kkItems)) { const mesh = instanced(propGeo(n).geo, propInstMat(n), items, { chunk:CHUNK }); if (mesh) group.add(mesh); }
  const trunkItems = [];
  for (const [type, list] of Object.entries(byType)) {
    const items = list.map(t => {
      const s = 0.8 + rand() * 0.7;
      if (type !== 'spike' && type !== 'crystal') trunkItems.push({ x:t.x, y:t.y - 0.1, z:t.z, s:s * 1.1, sy:s * (type === 'dead' ? 3.8 : type === 'pine' ? 1.6 : 2.4), c:T.trunk });
      return { x:t.x, y:t.y - 0.1, z:t.z, s, ry:rand() * 6.28, c:type === 'dead' || type === 'spike' ? T.trunk : pick(T.leaf) };
    });
    const m = type === 'crystal' ? new THREE.MeshBasicMaterial({ color:new THREE.Color(0xffffff).multiplyScalar(1.4) }) : mat(0xffffff, { roughness:0.9 });
    const mesh = instanced(G[type](), m, items, { chunk:CHUNK }); if (mesh) group.add(mesh);
  }
  const tr = instanced(G.trunk(), mat(0xffffff, { roughness:1 }), trunkItems, { chunk:CHUNK }); if (tr) group.add(tr);
  const rocks = scatter(barren ? 180 : hubPreview ? 100 : 260, 0.4, 50, 18);
  if (rockNames.length) {
    const tint = new THREE.Color(0xffffff).lerp(new THREE.Color(T.rock), 0.45), byRock = {};
    for (const r of rocks) (byRock[pick(rockNames)] ??= []).push({ x:r.x, y:r.y - 0.15, z:r.z, s:5 + rand() * 9, sy:4 + rand() * 9, ry:rand() * 6.28, c:tint.clone().multiplyScalar(0.85 + rand() * 0.3).getHex() });
    for (const [n, items] of Object.entries(byRock)) { const m = instanced(propGeo(n).geo, propInstMat(n), items, { chunk:CHUNK }); if (m) group.add(m); }
  } else {
    const rm = instanced(hubPreview ? shared('organicRock', () => new THREE.IcosahedronGeometry(1,2).scale(1,.75,.85)) : G.rock(), hubPreview ? surface('rock') : mat(0xffffff, { roughness:0.95 }), rocks.map(r => ({ x:r.x, y:r.y - 0.2, z:r.z, s:0.5 + rand() * 1.6, sy:0.4 + rand() * 1.2, ry:rand() * 6.28, rx:rand() * 0.5, c:new THREE.Color(T.rock).multiplyScalar(0.8 + rand() * 0.5).getHex() })));
    if (rm) group.add(rm);
  }

  // Grama e flores dentro e na beira da área jogável (fora da trilha).
  const tufts = [], flowers = [];
  for (let i = 0; i < (barren ? 0 : 3200); i++) {
    const zc = pick(zones), ang = rand() * Math.PI * 2, r = Math.sqrt(rand()) * ((zc.sr ?? zc.r) + 5);
    const x = zc.cx + Math.cos(ang) * r, z = zc.cz + Math.sin(ang) * r, d = sd(x, z);
    if (d > 4 || hole?.(x, z) || (x * x + z * z < bareR * bareR) || zones.some(c => c.bare && (x - c.cx) ** 2 + (z - c.cz) ** 2 < c.bare ** 2) || (paths.length && pathD(x, z) < paths[0].w / 2)) continue;
    const y = height(x, z); if (!voidMode && y < WATER + 0.2) continue;
    if (hubPreview && fbm(n3, x * 0.19, z * 0.19) < -0.03) continue;
    if (rand() < 0.1) flowers.push({ x, y, z, s:0.8 + rand() * 0.8, c:pick(T.flower) });
    else tufts.push({ x, y, z, s:0.7 + rand() * 0.9, ry:rand() * 6.28, c:new THREE.Color(hubPreview ? T.tuft ?? 0x435a28 : T.grass2).multiplyScalar(0.85 + rand() * 0.4).getHex() });
  }
  // Decoração temática perto das bordas e dentro das clareiras (ex.: túmulos no cemitério).
  if (T.decor) {
    const names = T.decor.filter(([n]) => propGeo(n)), byDecor = {};
    if (names.length) for (let i = 0; i < 220; i++) {
      const zc = pick(zones), ang = rand() * Math.PI * 2, r = zc.r * (0.75 + rand() * 0.6);
      const x = zc.cx + Math.cos(ang) * r, z = zc.cz + Math.sin(ang) * r, d = sd(x, z);
      if (d < -1.5 && d > -zc.r * 0.5) continue; // não entulhar o centro da arena
      if (paths.length && pathD(x, z) < paths[0].w / 2 + 0.5) continue;
      if (avoid.some(a => Math.hypot(a.x - x, a.z - z) < a.r + 1.8)) continue; // nunca em cima de botão, alavanca ou armadilha
      const [n, sc] = pick(names); (byDecor[n] ??= []).push({ x, y:height(x, z), z, s:sc * (0.85 + rand() * 0.3), ry:rand() * 6.28 });
    }
    for (const [n, items] of Object.entries(byDecor)) { const m = instanced(propGeo(n).geo, propInstMat(n), items, { chunk:CHUNK }); if (m) group.add(m); }
  }
  const tm = instanced(hubPreview ? shared('naturalGrass',()=>foliageGeometry(true)) : G.tuft(), mat(0xffffff, { roughness:1,side:THREE.DoubleSide,flatShading:!hubPreview }), tufts, { shadow:false, chunk:CHUNK }); if (tm) group.add(tm);
  const fm = instanced(G.flower(), hubPreview ? mat(0x8f987b,{roughness:1}) : new THREE.MeshBasicMaterial({ color:0xffffff }), flowers, { shadow:false, chunk:CHUNK }); if (fm) group.add(fm);

  // Pedras flutuantes no vazio.
  if (voidMode) {
    const fl = [];
    for (let i = 0; i < 70; i++) { const x = center.x + (rand() - 0.5) * size, z = center.z + (rand() - 0.5) * size; if (sd(x, z) < 12) continue; fl.push({ x, y:-6 - rand() * 20, z, s:1 + rand() * 4, sy:0.6 + rand(), ry:rand() * 6, c:T.rock }); }
    const flm = instanced(hubPreview ? shared('organicRock', () => new THREE.IcosahedronGeometry(1,2).scale(1,.75,.85)) : G.rock(), hubPreview ? surface('rock') : mat(0xffffff), fl, { shadow:false }); if (flm) group.add(flm);
  }

  // Partículas de ambiente perto do jogador.
  const focus = new THREE.Vector3();
  const amb = {
    fireflies:{ size:0.16, life:[2, 4], vel:o => o.set((rand() - 0.5) * 0.6, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.6), y:() => 0.5 + rand() * 2.5 },
    petals:{ size:0.2, life:[3, 6], vel:o => o.set(0.6 + rand() * 0.4, -0.6 - rand() * 0.4, 0.2), y:() => 3 + rand() * 6 },
    embers:{ size:0.16, life:[1.5, 3.5], vel:o => o.set((rand() - 0.5) * 0.4, 1 + rand() * 1.5, (rand() - 0.5) * 0.4), y:() => rand() * 2 },
    snow:{ size:0.22, life:[3, 6], vel:o => o.set(0.5 + rand() * 0.4, -1.2 - rand() * 0.6, 0.3), y:() => 4 + rand() * 7 },
    motes:{ size:0.18, life:[2, 5], vel:o => o.set((rand() - 0.5) * 0.3, 0.3 + rand() * 0.4, (rand() - 0.5) * 0.3), y:() => rand() * 3 },
  }[T.ambient];
  sparks.push(new Sparks({ count:90, color:T.amb, size:amb.size, life:amb.life, vel:amb.vel,
    spawn:o => o.set(focus.x + (rand() - 0.5) * 44, amb.y(), focus.z + (rand() - 0.5) * 34) }));

  return { sd, height, focus, water };
}

function stoneRing(st, zone, paths, rand, accentMat, stoneMat) {
  const gaps = paths.filter(p => p.zones.includes(zone)).map(p => {
    const other = p.zones[0] === zone ? p.zones[1] : p.zones[0]; return Math.atan2(other.cz - zone.cz, other.cx - zone.cx);
  });
  const n = Math.round(Math.PI * 2 * zone.r / 4.2);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    if (gaps.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.32)) continue;
    const R = zone.r + 1.1, x = zone.cx + Math.cos(a) * R, z = zone.cz + Math.sin(a) * R, ry = -a + Math.PI / 2;
    const s = 0.8 + rand() * 0.4;
    st.add(G.stone(), stoneMat, x, -0.2, z, ry, s, s * (0.7 + rand() * 0.6));
    if (i % 2 === 0) st.add(G.rune(), accentMat, zone.cx + Math.cos(a) * (R - 0.48 * s), 1.9 * s, zone.cz + Math.sin(a) * (R - 0.48 * s), ry, s);
  }
  // Mosaico no chão da arena.
  for (const r of zone.kind === 'boss' ? [4, 7.5, 11] : [3.2, 6]) {
    const m = Math.round(Math.PI * 2 * r / 1.7);
    for (let i = 0; i < m; i++) { const a = i / m * Math.PI * 2; st.add(G.tile(), stoneMat, zone.cx + Math.cos(a) * r, 0.02, zone.cz + Math.sin(a) * r, -a + Math.PI / 2, 1); }
  }
}

// Desafios sorteados por run: abismo (pular com a esquiva), espinhos ritmados, portão de runas;
// obstáculos que mudam o espaço das arenas e perigos do tema (lava, veneno, fendas do vazio).
// Funde peças de um mesmo material dentro de um grupo local: uma chamada de desenho em vez de várias.
// parts: [geo, x, y, z, rx, ry, rz]
function fused(material, parts) {
  const o = new THREE.Object3D(), geos = parts.map(([geo, x, y, z, rx = 0, ry = 0, rz = 0]) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.updateMatrix(); return (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(o.matrix); });
  const m = new THREE.Mesh(mergeGeometries(geos), material); geos.forEach(g => g.dispose()); m.castShadow = !material.isMeshBasicMaterial; m.receiveShadow = true; return m;
}

function buildChallenges(group, T, theme, zones, paths, rand) {
  // Layouts novos marcam um trecho de desafio por corredor (ch, ta..tb); o antigo usa o caminho inteiro.
  const info = paths.filter(p => p.ch !== false).map((p, i) => {
    const len = Math.hypot(p.bx - p.ax, p.bz - p.az), dx = (p.bx - p.ax) / len, dz = (p.bz - p.az) / len;
    const ta = p.ta ?? p.zones[0].r, tb = p.tb ?? len - p.zones[1].r;
    return { p, i, len, dx, dz, mid:(ta + tb) / 2, rot:Math.atan2(dx, dz) };
  });
  // Perigos do tema dentro das arenas.
  const HZ = { cinzas:{ type:'lava', color:0xff5a10, dmg:0.08 }, cemiterio:{ type:'poison', color:0x7dff6a, dmg:0.05 }, vazio:{ type:'void', color:0x9a7bff, dmg:0.09 }, crepusculo:{ type:'thorn', color:0xff7ad9, dmg:0.04 },
    caverna:{ type:'poison', color:0x6affc8, dmg:0.05 }, magma:{ type:'lava', color:0xff5a10, dmg:0.08 }, gelo:{ type:'frost', color:0x9fe8ff, dmg:0.05 } }[theme];
  // Planta interna (desafios, pedras, poças, objetivos, armadilhas) sai de layout.js, com posições já validadas.
  const plan = planDungeon(zones, paths, rand, { lava:theme === 'magma', pools:!!HZ });
  info.forEach((pi, i) => { pi.kind = pi.p.kind ?? (i === 0 ? 'gap' : 'spikes'); });
  const localS = (pi, x, z) => { const rx = x - pi.p.ax, rz = z - pi.p.az; return [rx * pi.dx + rz * pi.dz, rx * pi.dz - rz * pi.dx]; };
  const local = (pi, x, z) => { const [a, s] = localS(pi, x, z); return [a, Math.abs(s)]; };
  const atPath = (pi, along, side = 0) => new THREE.Vector3(pi.p.ax + pi.dx * along + pi.dz * side, 0, pi.p.az + pi.dz * along - pi.dx * side);
  const GAP = 1.7;
  const inGap = (x, z) => info.some(pi => { if (pi.kind !== 'gap') return false; const [a, d] = local(pi, x, z); return d < pi.p.w / 2 + 1.2 && Math.abs(a - pi.mid) < GAP; });

  // --- abismo: brilho no fundo, bordas acesas e pontas da ponte quebrada ---
  const edgeM = glow(T.accent, 2), plank = mat(0x6a4a2a, { roughness:1 });
  for (const pi of info) if (pi.kind === 'gap') {
    const g = new THREE.Group(); g.position.copy(atPath(pi, pi.mid)); g.rotation.y = pi.rot; group.add(g);
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(pi.p.w + 3, GAP * 2).rotateX(-Math.PI / 2), additive(new THREE.Color(T.accent).multiplyScalar(0.8), 0.7)); bottom.position.y = -6; g.add(bottom);
    const edgeG = shared(`chEdge${pi.p.w}`, () => new THREE.BoxGeometry(pi.p.w, 0.08, 0.12)), plankG = shared('gapPlank', () => new THREE.BoxGeometry(0.5, 0.12, 0.9));
    g.add(fused(edgeM, [-1, 1].map(s => [edgeG, 0, 0.03, s * GAP])));
    g.add(fused(plank, [-1, 1].flatMap(s => [0, 1, 2].map(k => [plankG, (k - 1) * 1.6, -0.05 - k * 0.08, s * (GAP + 0.1), s * (0.25 + k * 0.1)]))));
  }
  // --- espinhos: 3 fileiras com ritmo defasado ---
  const spikeRows = [], spikeGeo = (() => { const cones = []; for (let k = 0; k < 7; k++) for (const zz of [-0.25, 0.25]) cones.push(new THREE.ConeGeometry(0.16, 0.8, 5).translate((k - 3) * 0.85, 0.4, zz)); return mergeGeometries(cones); })();
  const spikeM = mat(0x8a8f99, { metalness:0.8, roughness:0.3 });
  for (const pi of info) if (pi.kind === 'spikes') for (let k = -1; k <= 1; k++) {
    const along = pi.mid + k * 2.4, g = new THREE.Group(); g.position.copy(atPath(pi, along)); g.rotation.y = pi.rot; group.add(g);
    const plateM = new THREE.MeshBasicMaterial({ color:0x2a2a30 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(pi.p.w, 0.06, 1.1), plateM); plate.position.y = 0.03; g.add(plate);
    const sp = new THREE.Mesh(spikeGeo, spikeM); sp.position.y = -0.85; sp.castShadow = true; g.add(sp);
    spikeRows.push({ pi, along, off:(k + 1) * 0.8, sp, plateM });
  }
  const spikeUp = (row, t) => ((t + row.off) % 2.4) > 1.8;
  // --- ponte quebrada sobre a lava: só uma viga estreita atravessa o magma ---
  const FLOW = 2.4, flows = [], flowM = additive(new THREE.Color(0xff6a10).multiplyScalar(1.4), 0.6);
  for (const pi of info) if (pi.kind === 'lavaflow') {
    const g = new THREE.Group(); g.position.copy(atPath(pi, pi.mid)); g.rotation.y = pi.rot; group.add(g);
    const bo = (rand() - 0.5) * (pi.p.w - 1.6);
    const heat = new THREE.Mesh(new THREE.PlaneGeometry(pi.p.w + 1.5, FLOW * 2).rotateX(-Math.PI / 2), flowM); heat.position.y = -0.3; g.add(heat);
    const beam = box(1.3, 0.16, FLOW * 2 + 0.8, plank); beam.position.set(bo, 0.02, 0); g.add(beam);
    g.add(fused(edgeM, [-1, 1].map(s => [shared(`chEdge${pi.p.w}`, () => new THREE.BoxGeometry(pi.p.w, 0.08, 0.12)), 0, 0.05, s * FLOW])));
    flows.push({ pi, bo });
  }
  const inFlow = (x, z, pad = 0) => flows.some(f => { const [a, s] = localS(f.pi, x, z); return Math.abs(a - f.pi.mid) < FLOW + pad && Math.abs(s) < f.pi.p.w / 2 + 1; });
  // --- portão: grades + 3 runas na sala anterior ---
  const gates = [], runes = [];
  for (const pi of info) if (pi.kind === 'gate') {
    const g = new THREE.Group(); g.position.copy(atPath(pi, pi.mid)); g.rotation.y = pi.rot; group.add(g);
    const barM = mat(0x3a3a44, { metalness:0.7, roughness:0.4 }), bars = new THREE.Group(); g.add(bars);
    const nb = Math.min(8, Math.round(pi.p.w / 0.8) + 1);
    for (let k = 0; k < nb; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), barM); b.position.set((k - (nb - 1) / 2) * 0.8, 1.6, 0); b.castShadow = true; bars.add(b); }
    const beam = box(pi.p.w + 0.6, 0.3, 0.3, barM); beam.position.y = 3.2; bars.add(beam);
    const seal = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 6), glow(T.accent, 2.5)); seal.position.set(0, 1.8, 0.2); bars.add(seal);
    for (const s of [-1, 1]) { const post = box(0.6, 3.8, 0.6, mat(T.stone)); post.position.set(s * (pi.p.w / 2 + 0.4), 1.9, 0); g.add(post); }
    const gate = { pi, open:false, k:0, bars, lit:0, need:0 }; gates.push(gate);
    for (const { x, z } of plan.runes.filter(r => r.path === pi.p)) {
      gate.need++;
      const m = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 6).rotateX(-Math.PI / 2), glow(T.accent, 0.5)); m.position.set(x, 0.05, z); group.add(m);
      const core = new THREE.Mesh(new THREE.CircleGeometry(0.4, 6).rotateX(-Math.PI / 2), glow(0x222233, 1)); core.position.set(x, 0.04, z); group.add(core);
      runes.push({ gate, x, z, on:false, m, core });
    }
  }
  // --- obstáculos nas arenas ---
  const obstacles = plan.obstacles, rockN = ['rock_single_E', 'rock_single_C'].filter(propGeo), st = new Static(), stoneM = mat(T.stone, { roughness:0.95 });
  const potM = T.art === 'garden' && surface('rock', { color:0xc4b9b4, normalScale:new THREE.Vector2(.45, .45) }), bushM = potM && surface('earth', { color:0x8fb06c, normalScale:new THREE.Vector2(1.2, 1.2) });
  const stumpM = ['forge', 'void', 'grave', 'cave', 'magma', 'frost'].includes(T.art) && surface(T.art === 'void' ? 'paving' : 'rock', { color:{ forge:0x5e5654, void:0x6e6888, grave:0x7a7a86, cave:0x6a6270, magma:0x524a48, frost:0x9aa4b4 }[T.art] });
  obstacles.forEach(({ x, z, r:rad }, k) => {
    if (T.art === 'cave') st.add(shared('artStalag', () => new THREE.LatheGeometry([[1.05, 0], [0.86, 0.22], [0.55, 0.55], [0.26, 0.86], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)), 22)), stumpM, x, 0, z, rand() * 6, rad, 2.6 + rand() * 1.8);
    else if (stumpM) st.add(shared('artPillar', () => new THREE.CylinderGeometry(0.92, 1.05, 1, 22).translate(0, 0.5, 0)), stumpM, x, 0, z, rand() * 6, rad, 1.6 + rand() * 1.4);
    else if (potM) { const g = gardenPlanter(rad); st.add(g.pot, potM, x, 0, z); st.add(g.bush, bushM, x, 0, z, rand() * 6); g.pot.dispose(); g.bush.dispose(); }
    else if (rockN.length) { const p = propGeo(rockN[k % rockN.length]); st.add(p.geo, p.mat, x, -0.1, z, rand() * 6, rad * 4.4, 11 + rand() * 6); }
    else st.add(shared('pillarRock', () => new THREE.CylinderGeometry(1, 1.15, 2.6, 7).translate(0, 1.3, 0)), stoneM, x, 0, z, rand() * 6, rad);
  });
  // --- beco secreto: parede rachada que quebra com F ---
  let secret = null;
  if (plan.secret) {
    const s = plan.secret, g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = Math.atan2(s.dx, s.dz); group.add(g);
    const wallM = mat(T.stone, { roughness:0.95 }), crackM = glow(T.accent, 0.8);
    const brickG = shared(`brick${s.w}`, () => new THREE.BoxGeometry((s.w + 1.6) / 3 - 0.08, 1.3, 0.9)), crackG = shared('crack', () => new THREE.BoxGeometry(0.08, 1.4, 0.95));
    g.add(fused(wallM, [0, 1, 2].flatMap(k => [0, 1].map(j => [brickG, (k - 1) * (s.w + 1.6) / 3 + (j ? 0.3 : 0), 0.65 + j * 1.3, 0, 0, (rand() - 0.5) * 0.1, 0]))));
    g.add(fused(crackM, [0, 1, 2, 3].map(() => [crackG, (rand() - 0.5) * s.w, 1.3, 0, 0, 0, (rand() - 0.5) * 1.4])));
    secret = { ...s, g, crackM, broken:false };
  }
  st.build(group);
  // --- perigos do tema dentro das arenas ---
  const hazards = [];
  if (HZ) for (const { x, z, r:rad } of plan.hazards) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 24).rotateX(-Math.PI / 2), additive(new THREE.Color(HZ.color).multiplyScalar(1.3), 0.6)); m.position.set(x, 0.06, z); group.add(m);
    const rim = new THREE.Mesh(new THREE.RingGeometry(rad * 0.92, rad, 32).rotateX(-Math.PI / 2), glow(HZ.color, 2)); rim.position.set(x, 0.07, z); group.add(rim);
    hazards.push({ x, z, r:rad, ...HZ, m });
  }
  const voidActive = t => (t % 3) < 1, LAVA = { type:'lava', dmg:0.08 };

  return {
    info, inGap, inFlow, obstacles, hazards, runes, gates, plan, secret,
    blocked(x, z, r, dashing) {
      for (const o of obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r + r) return true;
      if (secret && !secret.broken) { const rx = x - secret.x, rz = z - secret.z, a = rx * secret.dx + rz * secret.dz, sd = Math.abs(rx * secret.dz - rz * secret.dx); if (Math.abs(a) < 0.6 + r && sd < secret.w / 2 + 1) return true; }
      if (r >= 0.3 && !dashing && inGap(x, z)) return true;
      for (const g of gates) if (!g.open) { const [a, d] = local(g.pi, x, z); if (Math.abs(a - g.pi.mid) < 0.6 + r && d < g.pi.p.w / 2 + 1) return true; }
      return false;
    },
    spikeHit(x, z, t) { return spikeRows.some(row => { if (!spikeUp(row, t)) return false; const [a, d] = local(row.pi, x, z); return Math.abs(a - row.along) < 0.75 && d < row.pi.p.w / 2; }); },
    hazardAt(x, z, t) {
      for (const f of flows) { const [a, s] = localS(f.pi, x, z); if (Math.abs(a - f.pi.mid) < FLOW - 0.1 && Math.abs(s - f.bo) > 0.85 && Math.abs(s) < f.pi.p.w / 2 + 1) return LAVA; }
      return hazards.find(h => Math.hypot(x - h.x, z - h.z) < h.r - 0.2 && (h.type !== 'void' || voidActive(t))) ?? null; },
    stepRunes(x, z) {
      for (const r of runes) if (!r.on && Math.hypot(x - r.x, z - r.z) < 1) {
        r.on = true; r.m.material.color.set(T.accent).multiplyScalar(3.5); r.core.material.color.set(T.accent).multiplyScalar(2);
        r.gate.lit++; if (r.gate.lit >= r.gate.need) { r.gate.open = true; return 'open'; }
        return 'lit';
      }
      return null;
    },
    // Dica de desafio próximo (cada um avisa uma vez).
    hintAt(x, z) {
      for (const pi of info) { if (pi.hinted) continue; const [a, d] = local(pi, x, z); if (d < pi.p.w / 2 + 2 && Math.abs(a - pi.mid) < 7) { pi.hinted = true; return pi.kind; } }
      return null;
    },
    update(t, dt) {
      for (const row of spikeRows) { const ph = (t + row.off) % 2.4, up = ph > 1.8; row.sp.position.y = THREE.MathUtils.lerp(row.sp.position.y, up ? 0 : -0.85, 1 - Math.exp(-dt * (up ? 30 : 8))); row.plateM.color.set(ph > 1.4 && !up ? 0x8a1a1a : 0x2a2a30); }
      for (const g of gates) if (g.open && g.k < 1) { g.k = Math.min(1, g.k + dt * 0.8); g.bars.position.y = -3.4 * g.k; }
      flowM.opacity = 0.45 + Math.sin(t * 2.5) * 0.15;
      if (secret && !secret.broken) secret.crackM.color.set(T.accent).multiplyScalar(0.6 + Math.sin(t * 3) * 0.4);
      for (const h of hazards) h.m.material.opacity = h.type === 'void' ? (voidActive(t) ? 0.75 : 0.15) : 0.5 + Math.sin(t * 3 + h.x) * 0.12;
    },
  };
}

// Pontos logo fora da borda das salas (e dos lados dos corredores) que não caem dentro de outra área jogável.
function edgePoints(zones, paths, land, step, out) {
  const pts = [], keep = (x, z, ry) => { if (land.sd(x, z) > out * 0.6) pts.push({ x, z, ry }); };
  for (const zn of zones) for (const s of zn.shapes ?? []) {
    if (s.hx === undefined) { const n = Math.ceil(Math.PI * 2 * (s.r + out) / step); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; keep(s.x + Math.cos(a) * (s.r + out), s.z + Math.sin(a) * (s.r + out), -a + Math.PI / 2); } continue; }
    const X = s.hx + out, Z = s.hz + out;
    for (let u = -X; u <= X; u += step) { keep(s.x + u, s.z - Z, 0); keep(s.x + u, s.z + Z, 0); }
    for (let u = -Z; u <= Z; u += step) { keep(s.x - X, s.z + u, Math.PI / 2); keep(s.x + X, s.z + u, Math.PI / 2); }
  }
  for (const p of paths) {
    const len = Math.hypot(p.bx - p.ax, p.bz - p.az), dx = (p.bx - p.ax) / len, dz = (p.bz - p.az) / len, o = p.w / 2 + out;
    for (let t = 0; t <= len; t += step) for (const sg of [-1, 1]) keep(p.ax + dx * t + dz * o * sg, p.az + dz * t - dx * o * sg, Math.atan2(dx, dz) + Math.PI / 2);
  }
  return pts;
}

// Muros por layout: cor, topo (neve, flores, brasa), altura, colunas nos cantos, piso de lajes e falhas.
const WALLS = {
  ruina:{ cap:0xc8d6e4, h:[1, 2.3], cols:true, tile:0x6f8299, gaps:0.12 },
  jardim:{ wall:0x3f6a48, cap:0xffb8e0, h:[0.9, 1.5], tile:0xb0a0b0, gaps:0.06 },
  forja:{ wall:0x3a3236, glowCap:true, h:[1, 2.3], cols:true, tile:0x4a4044, gaps:0.12 },
  cemiterio:{ h:[0.5, 1.1], gaps:0.3 },
};
// Cenário próprio de cada layout: cristais na caverna, pontes sobre a lava, muros e piso nas plantas em grade.
function themeDressing(group, st, T, layout, zones, paths, land, ch, rand) {
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  if (layout === 'caverna') {
    // Cristais luminosos colados na parede: a única luz forte da caverna.
    const items = edgePoints(zones, paths, land, 3.2, 0.7).filter(() => rand() < 0.45).map(p => ({ x:p.x, y:-0.2, z:p.z, s:0.35 + rand() * 0.35, ry:rand() * 6.28, rz:(rand() - 0.5) * 0.5, c:pick(T.leaf) }));
    const cm = instanced(G.crystal(), new THREE.MeshBasicMaterial({ color:new THREE.Color(0xffffff).multiplyScalar(1.6) }), items, { shadow:false, chunk:CHUNK }); if (cm) group.add(cm);
  }
  if (layout === 'caverna') {
    // Estalagmites um pouco mais para dentro da rocha.
    const sp = edgePoints(zones, paths, land, 2.6, 1.6).filter(() => rand() < 0.5).map(p => ({ x:p.x, y:-0.3, z:p.z, s:0.4 + rand() * 0.5, sy:0.5 + rand() * 0.7, ry:rand() * 6.28, rx:(rand() - 0.5) * 0.3, c:new THREE.Color(T.rock).multiplyScalar(1.3 + rand() * 0.5).getHex() }));
    const sm = instanced(G.spike(), mat(0xffffff, { roughness:0.9 }), sp, { chunk:CHUNK }); if (sm) group.add(sm);
  }
  if (layout === 'lava') {
    // Tabuleiro de ponte sobre os corredores (fora das ilhas), menos onde a ponte quebrou.
    const plankM = mat(0x5a3a22, { roughness:1 }), ropeM = mat(0x2a1a10);
    const plankG = w => shared(`bridgePlank${w}`, () => new THREE.BoxGeometry(w + 0.3, 0.14, 0.5)), postG = shared('bridgePost', () => new THREE.CylinderGeometry(0.09, 0.11, 1.1, 5).translate(0, 0.35, 0));
    for (const p of paths) {
      const len = Math.hypot(p.bx - p.ax, p.bz - p.az), dx = (p.bx - p.ax) / len, dz = (p.bz - p.az) / len, ry = Math.atan2(dx, dz);
      for (let t = 0; t <= len; t += 0.62) {
        const x = p.ax + dx * t, z = p.az + dz * t;
        if (zones.some(zn => roomD(zn, x, z) < -0.3) || ch.inGap(x, z) || ch.inFlow(x, z, 0.2)) continue;
        st.add(plankG(p.w), plankM, x, -0.07, z, ry + (rand() - 0.5) * 0.06);
      }
    }
    for (const pt of edgePoints([], paths, land, 2.6, 0.1)) if (!zones.some(zn => roomD(zn, pt.x, pt.z) < 1) && !ch.inGap(pt.x, pt.z) && !ch.inFlow(pt.x, pt.z, 0.6)) st.add(postG, ropeM, pt.x, -0.3, pt.z);
    // Brilho de calor ao redor das ilhas, logo acima do magma.
    const heat = edgePoints(zones, [], land, 4, 1.2).map(p => ({ x:p.x, y:-0.35, z:p.z, s:4 + rand() * 3, ry:rand() * 6.28 }));
    const hm = instanced(shared('heatQuad', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), additive(new THREE.Color(0xff5a10).multiplyScalar(0.9), 0.55, { map:dotTex }), heat, { shadow:false });
    if (hm) group.add(hm);
  }
  const W = WALLS[layout];
  if (W) {
    // Muros quebrados na borda das salas e dos corredores, com um topo de outra cor.
    const wallG = shared('ruinWall', () => new THREE.BoxGeometry(2.2, 1, 0.9).translate(0, 0.5, 0)), wallM = mat(W.wall ?? T.stone, { roughness:0.95 });
    const capM = W.glowCap ? mat(0x5a3020, { emissive:T.accent, emissiveIntensity:0.3 }) : W.cap ? mat(W.cap, { roughness:1 }) : null, [h0, h1] = W.h;
    for (const p of edgePoints(zones, paths, land, 2.1, 0.55)) {
      if (rand() < W.gaps) continue;
      const h = rand() < 0.2 ? h0 * 0.5 + rand() * h0 * 0.4 : h0 + rand() * (h1 - h0), ry = p.ry + (rand() - 0.5) * 0.12;
      st.add(wallG, wallM, p.x, -0.1, p.z, ry, 1, h);
      if (capM) st.add(wallG, capM, p.x, h - 0.12, p.z, ry, 1.04, W.glowCap ? 0.08 : 0.18);
    }
    // Colunas nos cantos dos salões.
    const colG = shared('ruinCol', () => new THREE.CylinderGeometry(0.7, 0.8, 1, 8).translate(0, 0.5, 0));
    if (W.cols) for (const zn of zones) for (const s of zn.shapes) if (s.hx !== undefined) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = s.x + sx * (s.hx + 0.9), z = s.z + sz * (s.hz + 0.9); if (land.sd(x, z) < 0.6) continue;
      const h = rand() < 0.3 ? 1 + rand() : 2.6 + rand() * 1.6; st.add(colG, wallM, x, -0.1, z, 0, 1, h); if (capM) st.add(colG, capM, x, h - 0.15, z, 0, 1.05, 0.2);
    }
    // Piso de lajes, com falhas.
    const tileG = shared('ruinTile', () => new THREE.BoxGeometry(1.9, 0.06, 1.9)), tileM = W.tile && mat(W.tile, { roughness:0.4, metalness:0.1 });
    if (tileM) for (const zn of zones) for (const s of zn.shapes) if (s.hx !== undefined) for (let x = s.x - s.hx + 1; x < s.x + s.hx; x += 2.05) for (let z = s.z - s.hz + 1; z < s.z + s.hz; z += 2.05) {
      if (rand() < 0.3) continue; st.add(tileG, tileM, x + (rand() - 0.5) * 0.15, -0.01, z + (rand() - 0.5) * 0.15, (rand() - 0.5) * 0.08);
    }
  }
}

// Objetos das salas: alavancas, orbe e pedestal, runas, placas de pressão e o baú do beco secreto.
function buildRoomProps(group, T, zones, plan) {
  const stoneM = mat(T.stone, { roughness:0.9 }), metalM = mat(0x4a4a55, { metalness:0.7, roughness:0.4 }), props = { levers:[], orbs:[], runes:[], traps:[], chests:[] }, st = new Static();
  const ringG = shared('propRing', () => new THREE.RingGeometry(0.75, 0.95, 24).rotateX(-Math.PI / 2)), at = (x, z) => { const g = new THREE.Group(); g.position.set(x, 0, z); group.add(g); return g; };
  // Anel no chão + facho de luz: dá para achar o objeto de longe; some quando ele é usado.
  const beamG = shared('propBeam', () => new THREE.CylinderGeometry(0.3, 0.3, 7, 10, 1, true).translate(0, 3.5, 0)), beamM = additive(new THREE.Color(T.accent).multiplyScalar(1.2), 0.22, { map:barrierTex, side:THREE.DoubleSide });
  const halo = (g, k = 1) => { const m = new THREE.Mesh(ringG, glow(T.accent, 0.9)); m.position.y = 0.05; m.scale.setScalar(k); m.add(new THREE.Mesh(beamG, beamM)); g.add(m); return m; };
  for (const zn of zones) {
    const o = zn.obj; if (!o?.spots?.length) continue;
    if (o.type === 'lever') for (const { x, z } of o.spots) {
      const g = at(x, z); st.add(shared('leverBase', () => new THREE.BoxGeometry(0.9, 0.45, 0.9).translate(0, 0.22, 0)), stoneM, x, 0, z);
      const arm = new THREE.Group(); arm.position.y = 0.45; arm.rotation.x = -0.7; g.add(arm);
      const stick = box(0.14, 1.3, 0.14, metalM); stick.position.y = 0.65; arm.add(stick);
      const knobM = glow(T.accent, 1.5), knob = new THREE.Mesh(shared('knob', () => new THREE.SphereGeometry(0.2, 10, 8)), knobM); knob.position.y = 1.35; arm.add(knob);
      props.levers.push({ zone:zn, x, z, on:false, arm, knobM, ring:halo(g) });
    }
    if (o.type === 'orb') {
      const [a, b] = o.spots, orbM = glow(T.accent, 3);
      const orb = new THREE.Mesh(shared('objOrb', () => new THREE.IcosahedronGeometry(0.42, 1)), orbM); orb.position.set(a.x, 1.2, a.z); group.add(orb);
      const home = at(a.x, a.z), ped = at(b.x, b.z);
      st.add(shared('pedestal', () => new THREE.CylinderGeometry(0.6, 0.85, 1.1, 8).translate(0, 0.55, 0)), stoneM, b.x, 0, b.z);
      const socketM = glow(T.accent, 0.6), socket = new THREE.Mesh(shared('socket', () => new THREE.TorusGeometry(0.4, 0.07, 6, 16).rotateX(Math.PI / 2)), socketM); socket.position.y = 1.15; ped.add(socket);
      props.orbs.push({ zone:zn, home:a, ped:b, orb, socketM, homeRing:halo(home), ring:halo(ped, 1.4), carried:false, placed:false, x:a.x, z:a.z });
    }
    if (o.type === 'runes') for (const { x, z } of o.spots) {
      const m = new THREE.Mesh(shared('runeRing', () => new THREE.RingGeometry(0.55, 0.85, 6).rotateX(-Math.PI / 2)), glow(T.accent, 0.5)); m.position.set(x, 0.05, z); group.add(m);
      const core = new THREE.Mesh(shared('runeCore', () => new THREE.CircleGeometry(0.4, 6).rotateX(-Math.PI / 2)), glow(0x222233, 1)); core.position.set(x, 0.04, z); group.add(core);
      props.runes.push({ zone:zn, x, z, on:false, m, core });
    }
    if (o.type === 'secret') {
      const { x, z } = o.spots[0], chest = M.createChest(); chest.group.position.set(x, 0, z); chest.group.rotation.y = Math.atan2(zn.cx - x, zn.cz - z); group.add(chest.group);
      chest.beam.material.color.set(0xffd36b); chest.beam.material.opacity = 0.25; chest.beam.scale.set(0.3, 0.6, 0.3);
      props.chests.push({ zone:zn, x, z, chest, opened:false });
    }
  }
  // Placas de pressão: discretas, mas com um losango vermelho para quem presta atenção.
  const plateG = shared('trapPlate', () => new THREE.BoxGeometry(1.7, 0.08, 1.7)), plateM = mat(0x2c2a30, { metalness:0.5, roughness:0.6 });
  for (const t of plan.traps) {
    st.add(plateG, plateM, t.x, 0.03, t.z);
    const glyphM = glow(0x8a2a2a, 0.7), glyph = new THREE.Mesh(shared('trapGlyph', () => new THREE.RingGeometry(0.42, 0.58, 4).rotateX(-Math.PI / 2)), glyphM); glyph.position.set(t.x, 0.08, t.z); group.add(glyph);
    props.traps.push({ zone:t.zone, x:t.x, z:t.z, glyphM, cd:0 });
  }
  st.build(group);
  return props;
}

// Jardim do Crepúsculo no visual novo: céu roxo e laranja, névoa lilás, vaga-lumes quentes.
const GARDEN = { ...THEMES.crepusculo, art:'garden', lake:'none', grass:0x8fae70, grass2:0xa4bc7e, dirt:0x9c8a80, rock:0x766e78, leaf:[0x6f8f58], fog:0x5a4466, skyTop:0x2a2258, horizon:0xff9466, hemiSky:0xf0c8f0, hemiGround:0x5a4866, sun:0xffbc88, sunI:2.5, fogNear:26, fogFar:80, stone:0x8a8090, ambient:'fireflies', amb:0xffd27a };
// Forja de Cinzas: luz-chave laranja contra sombras frias, fumaça densa, brasas.
const FORGE = { ...THEMES.cinzas, art:'forge', lake:'none', grass:0x6a605a, grass2:0x645852, dirt:0x6a5446, rock:0x4a4240, sand:0x8a4a2a, top:0x3a3434, fog:0x2e1a16, skyTop:0x140808, horizon:0xb0401c, hemiSky:0xb0b0d0, hemiGround:0x4a2618, sun:0xffaa6a, sunI:2.8, fogNear:30, fogFar:88, stone:0x5a5250 };
// Cidadela do Vazio: luz fria violeta, estrelas no céu, névoa escura.
const VOID = { ...THEMES.vazio, art:'void', grass:0x6a6488, grass2:0x7a7498, dirt:0x5a5478, rock:0x4a4668, top:0x6a6490, fog:0x161230, skyTop:0x05041a, horizon:0x3a2a78, hemiSky:0xc4baff, hemiGround:0x342c5c, sun:0xdcd4ff, sunI:2.7, fogNear:28, fogFar:84, stone:0x5a5674, stars:true };
// Cemitério Sombrio: luar azul frio, névoa baixa, estrelas; velas quentes nos mausoléus e lanternas.
const GRAVE = { ...THEMES.cemiterio, art:'grave', lake:'none', decor:null, grass:0x5e6858, grass2:0x6a7262, dirt:0x6a6052, rock:0x5e5e6a, top:0x6a6a78, tuft:0x3e4a32, fog:0x1c2436, skyTop:0x060a1e, horizon:0x3a5274, hemiSky:0xa8b8e8, hemiGround:0x3a4244, sun:0xb8ccff, sunI:2.8, fogNear:26, fogFar:80, stone:0x6e6e7a, stars:true };
// Grutas Ecoantes: rocha fria, pouca luz de cima; o brilho vem dos cristais e cogumelos.
const CAVE = { ...THEMES.caverna, art:'cave', lake:'none', decor:null, grass:0x948a80, grass2:0xa49a8c, dirt:0x7e7266, rock:0x3a3442, top:0x24202c, fog:0x0e1422, fogNear:30, fogFar:74, hemiSky:0x9ab0e0, hemiGround:0x3a3832, sun:0xb8ccff, sunI:2.9, stone:0x5e5864 };
// Rio de Magma: brilho laranja vindo de baixo contra céu de cinza escuro.
const MAGMA = { ...THEMES.magma, art:'magma', grass:0x7a6e68, grass2:0x847670, dirt:0x6a5446, rock:0x3a3232, top:0x2a2426, fog:0x3a1a12, skyTop:0x120606, horizon:0xc04a1c, hemiSky:0xb8b0c8, hemiGround:0x5a2a18, sun:0xffb070, sunI:2.8, fogNear:34, fogFar:92, stone:0x5a5052 };
// Ruínas Congeladas: sol baixo e branco, sombras azuis, neve caindo.
const FROST = { ...THEMES.gelo, art:'frost', lake:'none', grass:0xd8e2ee, grass2:0xe4ecf4, dirt:0xb4c0d0, rock:0x8a96a8, top:0xeef4fa, fog:0xa8bcd4, skyTop:0x4a6a98, horizon:0xd8e4f0, hemiSky:0xd8e6ff, hemiGround:0x6a7a92, sun:0xfff4e4, sunI:2.6, fogNear:30, fogFar:90, stone:0x8a94a6 };
const ART_THEMES = { crepusculo:GARDEN, cinzas:FORGE, vazio:VOID, cemiterio:GRAVE, caverna:CAVE, magma:MAGMA, gelo:FROST };
export function buildDungeon(scene, dungeon, seed) {
  const T = ART_THEMES[dungeon.theme] ?? (dungeon.theme === 'esmeralda' ? { ...THEMES.esmeralda, art:'ruins', lake:'none', grass:0x8e9a7a, grass2:0xa2ad87, dirt:0x9d9780, rock:0x69756a, leaf:[0x5c7052], fog:0x425b5a, hemiSky:0xa2b8bd, hemiGround:0x283529, sun:0xffd3a1, sunI:1.65, fogNear:24, fogFar:72, stone:0x727e71 } : THEMES[dungeon.theme]), group = new THREE.Group(); scene.add(group);
  const { zones, paths } = layoutDungeon(seed, dungeon.layout), rand = mulberry32(seed ^ 0x9e3779b9), sparks = [];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const z of zones) { const r = z.sr ?? z.r; x0 = Math.min(x0, z.cx - r); x1 = Math.max(x1, z.cx + r); z0 = Math.min(z0, z.cz - r); z1 = Math.max(z1, z.cz + r); }
  const size = Math.max(x1 - x0, z1 - z0) + 110, center = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const sky = makeSky(T); group.add(sky);
  const ch = buildChallenges(group, T, dungeon.theme, zones, paths, mulberry32(seed ^ 0x51ed));
  const avoid = [...ch.plan.traps, ...ch.plan.runes, ...zones.flatMap(z => z.obj?.spots ?? [])];
  const land = buildLand(group, T, zones, paths, seed, { size, center, sparks, hole:ch.inGap, avoid });
  if(T.art==='ruins') addRuinArchitecture(group,zones,paths,land,ch.inGap,seed);
  const ART = { garden:addGardenArchitecture, forge:addForgeArchitecture, void:addVoidArchitecture, grave:addGraveArchitecture, cave:addCaveArchitecture, magma:addMagmaArchitecture, frost:addFrostArchitecture }[T.art];
  if(ART) ART(group,zones,paths,land,ch.inGap,seed,{ inner:edgePoints(zones,paths,land,1.5,1.2), outer:edgePoints(zones,paths,land,1.9,2.9) });
  const props = buildRoomProps(group, T, zones, ch.plan);

  const st = new Static(), accentMat = glow(T.accent, 2.2), stoneMat = mat(T.stone, { roughness:0.9 });
  if (!dungeon.layout) { for (const z of zones) if (z.kind !== 'start') stoneRing(st, z, paths, rand, accentMat, stoneMat); }
  else if(!T.art || T.art === 'magma') themeDressing(group, st, T, dungeon.layout, zones, paths, land, ch, rand);
  // Acampamento na entrada.
  const s0 = zones[0], wood = mat(0x7a5232), cloth = mat(0xd8c8a0, { roughness:1 }), fireM = glow(0xff9a3a, 3);
  const log = () => shared('log', () => new THREE.BoxGeometry(1.6, 0.25, 0.25));
  const flame = () => shared('flame', () => new THREE.OctahedronGeometry(0.45).scale(1, 1.6, 1).translate(0, 0.7, 0));
  const P = n => propGeo(n);
  if (P('tent')) st.add(P('tent').geo, P('tent').mat, s0.cx - 5, 0, s0.cz + 3, 0.6, 8);
  else st.add(shared('tent', () => new THREE.ConeGeometry(2.2, 2.6, 4).translate(0, 1.3, 0)), cloth, s0.cx - 5, 0, s0.cz + 3, 0.6);
  for (const [n, dx, dz, s] of [['barrel_large', 5.5, -1.5, 1.1], ['crates_stacked', -6, -2.5, 1.1], ['torch_lit', 1, 5.5, 1.5], ['torch_lit', 5.5, 1, 1.5], ['flag_red', -3.5, 5.5, 8]]) if (P(n)) st.add(P(n).geo, P(n).mat, s0.cx + dx, 0, s0.cz + dz, rand() * 6, s);
  st.add(log(), wood, s0.cx + 3, 0.15, s0.cz + 2, 0.5);
  st.add(log(), wood, s0.cx + 3, 0.15, s0.cz + 2, 2.1);
  st.add(flame(), fireM, s0.cx + 3, 0, s0.cz + 2);
  if (!P('crates_stacked')) for (const [dx, dz] of [[-5.5, -2], [-4.4, -2.6], [5.5, 4.5]]) st.add(shared('crate', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), wood, s0.cx + dx, 0, s0.cz + dz, rand());
  sparks.push(new Sparks({ count:18, color:0xff9a3a, size:0.14, life:[0.5, 1.3], spawn:o => o.set(s0.cx + 3 + (rand() - 0.5) * 0.6, 0.8, s0.cz + 2 + (rand() - 0.5) * 0.6), vel:o => o.set((rand() - 0.5) * 0.3, 1.5 + rand(), (rand() - 0.5) * 0.3) }));
  // Braseiros na arena do chefe.
  const boss = zones.find(z => z.kind === 'boss'), bossFire = glow(T.accent, 3);
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * Math.PI * 2 + Math.PI / 4, x = boss.cx + Math.cos(a) * (boss.r - 1.5), z = boss.cz + Math.sin(a) * (boss.r - 1.5);
    st.add(T.art ? shared('brazierSmooth', () => new THREE.LatheGeometry([[0.62, 0], [0.7, 0.12], [0.42, 0.4], [0.32, 1.1], [0.62, 1.45], [0.66, 1.6], [0, 1.5]].map(([r, y]) => new THREE.Vector2(r, y)), 28)) : shared('brazier', () => new THREE.CylinderGeometry(0.5, 0.7, 1.6, 6).translate(0, 0.8, 0)), stoneMat, x, 0, z);
    st.add(flame(), bossFire, x, 1.4, z);
  }
  if (dungeon.theme === 'cemiterio' && !T.art && propGeo('crypt')) st.add(propGeo('crypt').geo, propGeo('crypt').mat, boss.cx, 0, boss.cz - (boss.sr ?? boss.r) - 4, 0, 3);
  const lavaC = new THREE.Color(T.water);
  const sigil = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.8, 6), glow(T.accent, 1.6)); sigil.rotation.x = -Math.PI / 2; sigil.position.set(boss.cx, 0.05, boss.cz); group.add(sigil);
  st.build(group);

  // Barreira mágica com gradiente, aparece quando a arena tranca: cilindro na clareira redonda,
  // ou uma cortina em cada boca de corredor nas salas de formato livre.
  const barM = additive(new THREE.Color(T.accent).multiplyScalar(1.4), 0.7, { map:barrierTex, side:THREE.DoubleSide });
  for (const z of zones) {
    if (!z.shapes) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(z.r + 0.3, z.r + 0.3, 4.5, 64, 1, true), barM);
      b.position.set(z.cx, 2.25, z.cz); b.visible = false; group.add(b); z.barrier = b; continue;
    }
    const b = new THREE.Group(); b.visible = false; group.add(b); z.barrier = b;
    for (const p of paths) {
      // Segmento que sai da sala: anda a partir da ponta de dentro até cruzar a borda.
      const inA = roomD(z, p.ax, p.az) < 0, inB = roomD(z, p.bx, p.bz) < 0; if (inA === inB) continue;
      const [sx, sz, ex, ez] = inA ? [p.ax, p.az, p.bx, p.bz] : [p.bx, p.bz, p.ax, p.az], len = Math.hypot(ex - sx, ez - sz);
      let t = 0; while (t < len && roomD(z, sx + (ex - sx) * t / len, sz + (ez - sz) * t / len) < 0) t += 0.25;
      const door = new THREE.Mesh(shared(`door${p.w}`, () => new THREE.PlaneGeometry(p.w + 1.5, 4.5)), barM);
      door.position.set(sx + (ex - sx) * t / len, 2.25, sz + (ez - sz) * t / len); door.rotation.y = Math.atan2(ex - sx, ez - sz); b.add(door);
    }
  }

  const inZone = (z, x, y, r) => roomD(z, x, y) < -r;
  return {
    group, theme:T, rooms:zones, paths,
    dashing:false, ch, props, ambush:ch.plan.ambush.map(a => ({ ...a, done:false })),
    canStand(x, z, r = 0.5, lockRoom = null) { return (lockRoom ? inZone(lockRoom, x, z, r) : land.sd(x, z) < -r) && !ch.blocked(x, z, r, this.dashing); },
    roomAt:(x, z, m = 1.2) => zones.find(zn => inZone(zn, x, z, m)) ?? null,
    setLocked(room, on) { room.locked = on; room.barrier.visible = on; },
    update:(t, focus) => {
      ch.update(t, 1 / 60);
      for (const o of props.orbs) { o.orb.rotation.y = t * 1.5; if (!o.carried && !o.placed) o.orb.position.y = 1.2 + Math.sin(t * 2.5) * 0.15; }
      sky.position.copy(focus); land.focus.copy(focus);
      sparks.forEach(s => s.update(1 / 60));
      sigil.rotation.z = t * 0.2;
      barM.opacity = 0.55 + Math.sin(t * 4) * 0.15;
      if (land.water && T.lake === 'lava') { const m = land.water.material; if (m.emissiveMap) m.emissiveIntensity = 3 + Math.sin(t * 1.3) * 0.35; else m.color.setScalar(1).multiply(lavaC).multiplyScalar(1.5 + Math.sin(t * 1.3) * 0.15); }
    },
    dispose:() => { sparks.forEach(s => s.dispose()); group.removeFromParent(); disposeTree(group); },
  };
}

export function buildHub(scene) {
  const T = {...THEMES.hub, art:'village', grass:0xa4b395, grass2:0xb8c49f, dirt:0xb9a584, rock:0x7d8775, hemiSky:0xb9c9d1, hemiGround:0x323e2c, sun:0xffd7a2, sunI:2.25, fog:0x91aa9d, skyTop:0x779da6, horizon:0xc9cfac, stone:0x9f9d8c}, group = new THREE.Group(); scene.add(group);
  // Vale das Ervas: trilha saindo da praça para o nordeste até um vale de coleta com a alquimista.
  const VA = -1.0, ux = Math.cos(VA), uz = Math.sin(VA), VX = ux * 37, VZ = uz * 37, VR = 12;
  const trail = { ax:ux * 13.5, az:uz * 13.5, bx:ux * 27, bz:uz * 27, w:4.4 };
  // Campo de Treino: outra trilha, para o noroeste, até uma arena própria (bonecos + painel de DPS).
  const TA = -2.2, tx = Math.cos(TA), tz = Math.sin(TA), TX = tx * 38, TZ = tz * 38, TR = 13;
  const trail2 = { ax:tx * 13.5, az:tz * 13.5, bx:tx * 26, bz:tz * 26, w:4.4 };
  // Estrada do Abismo: sai da praça para o norte até o portão de pedra com o vórtice das dungeons.
  const GZ = -29, road = { ax:0, az:-13.5, bx:0, bz:GZ + 4, w:5 };
  const R = 15, zones = [{ cx:0, cz:0, r:R + 1, kind:'hub' }, { cx:0, cz:GZ + 1, r:6.5, kind:'portal' }, { cx:VX, cz:VZ, r:VR + 1, kind:'vale' }, { cx:TX, cz:TZ, r:TR + 1, kind:'treino', bare:9 }], sparks = [];
  const sky = makeSky(T); group.add(sky);
  const land = buildLand(group, T, zones, [trail, trail2, road], 4242, { size:150, center:new THREE.Vector3(0, 0, 0), sparks, bareR:10 });
  const rand = mulberry32(99), st = new Static(), stoneMat = surface('rock',{color:0xc7c2ab}), darkStone = surface('paving',{color:0x9a9d88});

  addPlaza(group);
  addVillageDetails(group);
  // Casinhas ao redor (fora da praça), deixando o norte livre para o portal.
  const walls = mat(0xf0e2c4), roofA = mat(0xc0503a), roofB = mat(0x3a6ac0), wood = mat(0x6b4a2f), lampM = glow(0xffd36b, 3);
  // Descanso junto à praça: bancos e vasos ficam fora da área de passagem.
  const benchWood = mat(0x80603e, { roughness:1 }), flowerLeaf = mat(0x4d8440, { roughness:1 }), petal = mat(0xdfac9e, { roughness:1 });
  const seat = shared('welcomeSeat', () => new THREE.BoxGeometry(2.1, 0.18, 0.58));
  const leg = shared('welcomeLeg', () => new THREE.BoxGeometry(0.18, 0.48, 0.48));
  const pot = shared('welcomePot', () => new THREE.CylinderGeometry(0.36, 0.27, 0.52, 7).translate(0, 0.26, 0));
  const sprig = shared('welcomeSprig', () => new THREE.IcosahedronGeometry(0.29, 0).translate(0, 0.7, 0));
  const bloom = shared('welcomeBloom', () => new THREE.IcosahedronGeometry(0.11, 0).translate(0, 0.95, 0));
  for (const side of [-1, 1]) {
    const x = side * 14.5, z = 8.9, a = side * 0.6;
    st.add(seat, benchWood, x, 0.54, z, a);
    for (const q of [-0.75, 0.75]) st.add(leg, benchWood, x + Math.cos(a) * q, 0, z - Math.sin(a) * q, a);
    const px = x + side * 1.5, pz = z - 0.7;
    st.add(pot, darkStone, px, 0, pz); st.add(sprig, flowerLeaf, px, 0, pz); st.add(bloom, petal, px, 0, pz);
  }
  // Pequenas pedras unem a praça às trilhas sem fechar o caminho.
  const trailStone = shared('welcomeTrailStone', () => new THREE.BoxGeometry(0.85, 0.035, 0.52));
  for (const [vx, vz] of [[ux,uz], [tx,tz]]) for (let i = 0; i < 5; i++) {
    const d = 16 + i * 1.7, offset = i % 2 ? 0.35 : -0.35;
    st.add(trailStone, stoneMat, vx * d - vz * offset, 0.025, vz * d + vx * offset, -Math.atan2(vz,vx) + Math.PI / 2);
  }
  addHubArt(group);
  const portal = buildGate(group, st, sparks, rand, { GZ, road, darkStone, stoneMat, wood });
  // Arsenal: suporte de armas, baú dourado e escudo (KayKit); bigorna com brasa.
  const arsenal = new THREE.Group(); arsenal.position.set(-10.5, 0, -4.5); arsenal.rotation.y = 1.0; group.add(arsenal);
  const iron = mat(0x6d727c, { metalness:0.7, roughness:0.4 });
  const addProp = (n, x, y, z, ry, s) => { const p = propGeo(n); if (!p) return false; const m = new THREE.Mesh(p.geo, p.mat); m.position.set(x, y, z); m.rotation.y = ry; m.scale.setScalar(s); m.castShadow = m.receiveShadow = true; arsenal.add(m); return true; };
  if (!addProp('weaponrack', 0, 0, 0, 0, 13)) {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 0.6), wood); rack.position.y = 1.9; arsenal.add(rack);
    for (const x of [-1.3, 1.3]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.5), wood); leg.position.set(x, 1.1, 0); arsenal.add(leg); }
  }
  addProp('chest_gold', 1.9, 0, 1.4, -0.4, 1.25);
  addProp('sword_shield_gold', -2, 0, 1, 0.5, 1.2);
  addProp('barrel_large', -2.6, 0, -0.6, 0, 0.9);
  const anvil = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.6), iron); anvil.position.set(0, 0.55, 2); anvil.castShadow = true; arsenal.add(anvil);
  const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.45), mat(0x3a3f4a)); anvilBase.position.set(0, 0.17, 2); arsenal.add(anvilBase);
  const ember = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), glow(0xff8a2a, 4)); ember.position.set(0.2, 0.9, 2); arsenal.add(ember);
  // Materiais de trabalho junto ao arsenal, mantendo livre a frente da bigorna.
  const workWood = mat(0x745037, { roughness:1 }), coal = mat(0x353436, { roughness:1 });
  const workCrate = box(0.8, 0.42, 0.65, workWood); workCrate.position.set(-2.0, 0.21, -1.0); arsenal.add(workCrate);
  const coalPile = new THREE.Mesh(shared('welcomeCoal', () => new THREE.DodecahedronGeometry(0.26, 0)), coal); coalPile.position.set(-2, 0.5, -1); arsenal.add(coalPile);
  // Ferreiro: bárbaro de avental batendo na bigorna (faísca + som a cada martelada).
  arsenal.updateMatrixWorld(true);
  const anvilW = arsenal.localToWorld(new THREE.Vector3(0, 0.85, 2));
  const smith = M.createNpc('Barbarian', { tint:0xd8b090, hammer:true });
  // Atrás da bigorna, de frente para a praça.
  if (smith) { smith.root.position.copy(arsenal.localToWorld(new THREE.Vector3(0, 0, 0.9))); smith.root.lookAt(anvilW.x, 0, anvilW.z); group.add(smith.root); }
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), glow(0xffb040, 5)); flash.position.copy(anvilW); flash.scale.setScalar(0.01); group.add(flash);
  const forgeSparks = new Sparks({ count:24, color:0xffa040, size:0.12, life:[0.2, 0.6], spawn:o => o.copy(anvilW).add(new THREE.Vector3((rand() - 0.5) * 0.3, 0.05, (rand() - 0.5) * 0.3)), vel:o => o.set((rand() - 0.5) * 4, 1 + rand() * 3, (rand() - 0.5) * 4) });
  forgeSparks.points.visible = false; sparks.push(forgeSparks);
  let lastT = 0, hammerT = 1.5, hitAt = null, burstT = 0, hitFast = false;

  // Caçador de monstros: mesa com tomo aberto, crânio-troféu e uma lanterna verde; abre o bestiário.
  // Frente da mesa (+z) virada para o centro da praça; o caçador fica atrás dela.
  const lodge = new THREE.Group(); lodge.position.set(10.4, 0, 2.8); lodge.lookAt(0, 0, 0); group.add(lodge);
  const table = box(2.2, 0.12, 1.1, wood); table.position.y = 1; table.castShadow = table.receiveShadow = true; lodge.add(table);
  for (const [x, z] of [[-0.95, -0.4], [0.95, -0.4], [-0.95, 0.4], [0.95, 0.4]]) { const leg = box(0.12, 1, 0.12, wood); leg.position.set(x, 0.5, z); lodge.add(leg); }
  for (const x of [-0.27, 0.27]) { const pg = box(0.5, 0.04, 0.7, mat(0xf2e6c8)); pg.position.set(x, 1.09, 0.1); pg.rotation.z = x > 0 ? -0.12 : 0.12; lodge.add(pg); }
  const tome = box(1.15, 0.06, 0.78, mat(0x5a2a3a)); tome.position.set(0, 1.07, 0.1); lodge.add(tome);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(0xe8e0c8, { roughness:0.8 })); skull.scale.set(1, 0.9, 1.1); skull.position.set(-0.8, 1.27, -0.25); skull.castShadow = true; lodge.add(skull);
  for (const x of [-0.08, 0.08]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), glow(0x6bff9a, 3)); eye.position.set(-0.8 + x, 1.3, -0.05); lodge.add(eye); }
  const huntGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), glow(0x6bff9a, 4)); huntGem.position.set(0.85, 1.45, -0.3); lodge.add(huntGem);
  // Dois mapas dobrados dão ao caçador um pequeno espaço de expedição.
  const parchment = mat(0xd5c29c, { roughness:1 });
  for (let i = 0; i < 2; i++) { const map = box(0.35, 0.035, 0.25, parchment); map.position.set(0.35 + i * 0.18, 1.1 + i * 0.04, 0.25); map.rotation.y = i * 0.35; lodge.add(map); }
  const hunter = M.createNpc('Rogue_Hooded', { tint:0x9ab08a });
  lodge.updateMatrixWorld(true);
  if (hunter) { hunter.root.position.copy(lodge.localToWorld(new THREE.Vector3(0, 0, -1))); hunter.root.lookAt(0, 0, 0); group.add(hunter.root); }
  let pageT = 4;

  // Espelho mágico: arco dourado em degraus, superfície com brilho animado, lanternas e faíscas.
  const wardrobe = new THREE.Group(); wardrobe.position.set(10.5, 0, -4.5); wardrobe.rotation.y = -1.0; group.add(wardrobe);
  const gold = mat(0xb69b5d, { metalness:0.7, roughness:0.48 }), marble = surface('paving',{color:0xd5d2bd});
  for (const [r, h, y] of [[1.9, 0.25, 0.12], [1.5, 0.25, 0.37]]) { const step = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.1, h, 8), marble); step.position.y = y; step.receiveShadow = step.castShadow = true; wardrobe.add(step); }
  const W2 = 1.15, H2 = 2.6, base = 0.5;
  for (const x of [-W2 - 0.14, W2 + 0.14]) { const col = new THREE.Mesh(new THREE.BoxGeometry(0.28, H2, 0.3), gold); col.position.set(x, base + H2 / 2, 0); col.castShadow = true; wardrobe.add(col); }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(W2 + 0.14, 0.15, 8, 28, Math.PI), gold); arch.position.y = base + H2; arch.castShadow = true; wardrobe.add(arch);
  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), glow(0xb45cff, 4)); crown.position.y = base + H2 + W2 + 0.55; wardrobe.add(crown);
  for (const x of [-1, 1]) { const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), glow(0x5ff2ff, 4)); g.position.set(x * (W2 + 0.14), base + H2 - 0.2, 0.2); wardrobe.add(g); }
  const mirrorMat = new THREE.ShaderMaterial({
    transparent:true, side:THREE.DoubleSide,
    uniforms:{ t:{ value:0 } },
    vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:`uniform float t; varying vec2 vUv;
      void main(){
        vec3 a = vec3(0.25, 0.85, 1.0), b = vec3(0.7, 0.35, 1.0);
        float wave = sin(vUv.y * 9.0 + t * 1.4 + sin(vUv.x * 6.0 + t) * 1.5) * 0.5 + 0.5;
        vec3 c = mix(a, b, wave * 0.7 + vUv.y * 0.3);
        float sweep = smoothstep(0.08, 0.0, abs(vUv.x + vUv.y * 0.6 - fract(t * 0.25) * 2.2 + 0.4));
        c += sweep * 0.7 + pow(1.0 - abs(vUv.x - 0.5) * 2.0, 3.0) * 0.15;
        gl_FragColor = vec4(c * 0.75, 0.85);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(W2 * 2, H2), mirrorMat); surf.position.y = base + H2 / 2; wardrobe.add(surf);
  const top = new THREE.Mesh(new THREE.CircleGeometry(W2, 24, 0, Math.PI), mirrorMat); top.position.y = base + H2; wardrobe.add(top);
  for (const x of [-2.4, 2.4]) if (propGeo('lantern_standing')) { const p = propGeo('lantern_standing'), l = new THREE.Mesh(p.geo, p.mat); l.position.set(x, 0, 0.6); l.scale.setScalar(1.3); l.castShadow = true; wardrobe.add(l); }
  const mp = new THREE.Vector3();
  sparks.push(new Sparks({ count:26, color:0xc8a8ff, size:0.14, life:[1, 2.2],
    spawn:o => { wardrobe.localToWorld(mp.set((rand() - 0.5) * 3, base + rand() * 3.5, 0.3 + rand() * 0.5)); return o.copy(mp); },
    vel:o => o.set((rand() - 0.5) * 0.2, 0.3 + rand() * 0.3, (rand() - 0.5) * 0.2) }));

  // Arena do Campo de Treino: chão de terra cercado, portão virado para a trilha; bonecos em arco no fundo.
  // Sobra espaço entre a cerca e a borda da região para novos alvos (ex.: boneco que anda num trilho).
  const YX = TX, YZ = TZ, YR = 8.5, gate = Math.atan2(-tz, -tx), angOff = a => Math.abs(Math.atan2(Math.sin(a - gate), Math.cos(a - gate)));
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(YR, 48), mat(0x9a7a52, { roughness:1 })); dirt.rotation.x = -Math.PI / 2; dirt.position.set(YX, 0.03, YZ); dirt.receiveShadow = true; group.add(dirt);
  const sandRing = new THREE.Mesh(new THREE.RingGeometry(YR - 0.6, YR - 0.35, 64), mat(0xc8a878, { roughness:1 })); sandRing.rotation.x = -Math.PI / 2; sandRing.position.set(YX, 0.04, YZ); group.add(sandRing);
  const NP = 30, stepA = Math.PI * 2 / NP, chord = 2 * YR * Math.sin(stepA / 2);
  for (let k = 0; k < NP; k++) {
    const a = gate + (k + 0.5) * stepA; if (angOff(a) < 0.22) continue;
    st.add(shared('fencePost', () => new THREE.BoxGeometry(0.16, 1.1, 0.16).translate(0, 0.55, 0)), wood, YX + Math.cos(a) * YR, 0, YZ + Math.sin(a) * YR);
    const b = a + stepA; if (angOff(b) < 0.22) continue;
    const m = (a + b) / 2, rx = YX + Math.cos(m) * YR * Math.cos(stepA / 2), rz = YZ + Math.sin(m) * YR * Math.cos(stepA / 2);
    for (const y of [0.45, 0.9]) st.add(shared(`fenceRail${chord.toFixed(2)}`, () => new THREE.BoxGeometry(chord, 0.1, 0.08)), wood, rx, y, rz, -m - Math.PI / 2);
  }
  const dummies = [-1.1, -0.55, 0, 0.55, 1.1].map(o => { const a = gate + Math.PI + o, x = YX + Math.cos(a) * 4.6, z = YZ + Math.sin(a) * 4.6; return { x, z, ry:Math.atan2(YX - x, YZ - z), boss:o === 0 }; });
  // Decoração: estandartes vermelhos no portão, tochas, fardos de feno e alvos de arco fora da cerca.
  const yobst = [], banner = mat(0xb83a3a, { side:THREE.DoubleSide }), hay = mat(0xd8b860, { roughness:1 }), targetM = mat(0xf2e6c8), targetR = mat(0xc0503a);
  for (const side of [-1, 1]) {
    const a = gate + side * 0.32, x = YX + Math.cos(a) * (YR + 0.2), z = YZ + Math.sin(a) * (YR + 0.2);
    const pole = box(0.18, 3.6, 0.18, wood); pole.position.set(x, 1.8, z); group.add(pole);
    const flag = new THREE.Mesh(shared('yardFlag', () => new THREE.PlaneGeometry(0.9, 1.5).translate(0.45, 0, 0)), banner); flag.position.set(x, 2.7, z); flag.rotation.y = -a; group.add(flag);
    st.add(shared('lampTop', () => new THREE.OctahedronGeometry(0.3).translate(0, 3.2, 0)), lampM, x, 0.5, z);
    yobst.push({ x, z, r:0.3 });
  }
  for (const o of [2.1, 2.5, -2.2, -2.6, 3.1]) {
    const a = gate + o, x = YX + Math.cos(a) * (YR + 2.2), z = YZ + Math.sin(a) * (YR + 2.2);
    const h = new THREE.Mesh(shared('hay', () => new THREE.CylinderGeometry(0.7, 0.7, 1.2, 10).rotateZ(Math.PI / 2).translate(0, 0.7, 0)), hay); h.position.set(x, 0, z); h.rotation.y = a; h.castShadow = true; group.add(h);
    yobst.push({ x, z, r:0.9 });
  }
  for (const o of [1.35, -1.35]) {
    const a = gate + o, x = YX + Math.cos(a) * (YR + 2.4), z = YZ + Math.sin(a) * (YR + 2.4), tg = new THREE.Group(); tg.position.set(x, 0, z); tg.lookAt(YX, 0, YZ); group.add(tg);
    for (const lx of [-0.5, 0.5]) { const leg = box(0.12, 1.4, 0.12, wood); leg.position.set(lx, 0.7, -0.2); leg.rotation.x = -0.2; tg.add(leg); }
    [[0.75, targetM], [0.55, targetR], [0.35, targetM], [0.16, targetR]].forEach(([r, m], i) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 20).rotateX(Math.PI / 2), m); d.position.set(0, 1.5, i * 0.02); tg.add(d); });
    yobst.push({ x, z, r:0.8 });
  }
  {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#8a6a44'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#5a3d22'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 88);
    g.fillStyle = '#fff4dc'; g.textAlign = 'center'; g.font = 'bold 32px sans-serif'; g.fillText('Campo de Treino', 128, 44); g.font = 'bold 22px sans-serif'; g.fillText('bonecos · medidor de DPS', 128, 76);
    const px = -tz, pz = tx, x = tx * 14.2 + px * 3.3, z = tz * 14.2 + pz * 3.3, sign = new THREE.Group(); sign.position.set(x, 0, z); sign.rotation.y = Math.atan2(-x, -z) - 0.35; group.add(sign);
    const post = box(0.16, 2.3, 0.16, wood); post.position.y = 1.15; sign.add(post);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.64, 0.08), [wood, wood, wood, wood, mat(0xffffff, { map:tex, flatShading:false }), wood]); plank.position.y = 1.9; plank.castShadow = true; sign.add(plank);
    yobst.push({ x, z, r:0.3 });
  }
  // Cerca bloqueia, exceto no portão; bonecos e decoração são sólidos.
  const yardBlocks = (x, z, r) => { const dx = x - YX, dz = z - YZ; return (Math.abs(Math.hypot(dx, dz) - YR) < 0.15 + r && angOff(Math.atan2(dz, dx)) > 0.32) || dummies.some(d => Math.hypot(x - d.x, z - d.z) < 0.45 + r) || yobst.some(o => Math.hypot(x - o.x, z - o.z) < o.r + r); };
  const vale = buildValley(group, st, sparks, rand, { VX, VZ, ux, uz, wood, lampM });
  st.build(group);

  // Baú diário na frente da praça: brilha enquanto estiver disponível.
  const daily = M.createChest(); daily.group.position.set(6.5, 0, 8.5); daily.group.rotation.y = -0.6; group.add(daily.group);
  daily.beam.material.color.set(0xffd36b); daily.beam.scale.set(0.3, 1, 0.3);
  // Quadro do calendário, espelhado ao baú: a gema no topo pulsa quando há prêmio de login.
  const board = new THREE.Group(); board.position.set(-6.5, 0, 8.5); board.rotation.y = 0.6; group.add(board);
  for (const x of [-0.7, 0.7]) { const post = box(0.16, 2.2, 0.16, wood); post.position.set(x, 1.1, 0); post.castShadow = true; board.add(post); }
  const plank = box(1.7, 1.2, 0.12, mat(0xd8c49a)); plank.position.y = 1.6; plank.castShadow = true; board.add(plank);
  for (let i = 0; i < 7; i++) { const c = box(0.34, 0.3, 0.02, mat(i === 6 ? 0xffb52e : 0x8a6a44)); c.position.set(-0.6 + (i % 4) * 0.4, 1.85 - Math.floor(i / 4) * 0.45, 0.07); board.add(c); }
  const calGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), glow(0xffd36b, 4)); calGem.position.y = 2.55; board.add(calGem);
  const stations = [
    { id:'diario',  label:'Baú diário', pos:new THREE.Vector3(5.6, 0, 7.4), r:2.6 },
    { id:'calendario', label:'Calendário de login', pos:new THREE.Vector3(-5.6, 0, 7.4), r:2.6 },
    { id:'portal',  label:'Escolher dungeon', pos:new THREE.Vector3(0, 0, GZ + 2.2), r:3.4 },
    { id:'ferreiro', label:'Falar com o ferreiro', pos:new THREE.Vector3(-7.4, 0, -1.6), r:3.2 },
    { id:'skins',   label:'Ver skins',        pos:new THREE.Vector3(9.2, 0, -3.8), r:2.6 },
    { id:'bestiario', label:'Falar com o caçador', pos:new THREE.Vector3(8.5, 0, 2.3), r:2.8 },
    { id:'alquimista', label:'Falar com a alquimista', pos:vale.alchStation, r:2.6 },
  ];
  const inTreino = (x, z, r) => (x - TX) ** 2 + (z - TZ) ** 2 < (TR - 0.6 - r) ** 2 || segDist(x, z, trail2) < trail2.w / 2 - r;
  const inVale = (x, z, r) => (x - VX) ** 2 + (z - VZ) ** 2 < (VR - 0.6 - r) ** 2 || segDist(x, z, trail) < trail.w / 2 - r;
  const hubUpdate = (t, focus) => { daily.beam.material.opacity = daily.on ? 0.3 + Math.sin(t * 3) * 0.1 : 0; sky.position.copy(focus); land.focus.copy(focus); portal.update(t); mirrorMat.uniforms.t.value = t; crown.rotation.y = t; calGem.rotation.y = t * 2; huntGem.rotation.y = -t * 1.5; huntGem.position.y = 1.45 + Math.sin(t * 2) * 0.08; calGem.scale.setScalar(calGem.on ? 1 + Math.sin(t * 4) * 0.2 : 0.6); sparks.forEach(s => s.update(1 / 60)); };
  return {
    portalPos:portal.pos, group, theme:T, stations, spawn:new THREE.Vector3(0, 0, 4), yard:{ x:YX, z:YZ, r:YR, dummies }, treinoCenter:new THREE.Vector3(TX, 0, TZ),
    canStand:(x, z, r = 0.5) => ((x * x + z * z < (R - 0.6 - r) ** 2) || inVale(x, z, r) || inTreino(x, z, r) || portal.inside(x, z, r)) && !yardBlocks(x, z, r) && !vale.blocks(x, z, r) && !portal.blocks(x, z, r),
    nodes:vale.nodes, setNode:vale.setNode, hitNode:vale.hitNode, alchemist:vale.alchemist, brewing:vale.brewing, valeCenter:new THREE.Vector3(VX, 0, VZ),
    setDaily:on => { daily.on = on; daily.lid.rotation.x = on ? 0 : -1.2; },
    setLogin:on => { calGem.on = on; },
    smithPos:smith ? smith.root.position.clone() : anvilW.clone(), onHammer:null,
    // Martelada pedida pela forja (3 rápidas) ou o ritmo normal de trabalho.
    smithHit(n = 1) { hammerT = 0; this.queue = n; },
    update(t, focus) {
      const dt = Math.min(0.05, t - lastT); lastT = t;
      if (smith) {
        smith.update(dt); hammerT -= dt;
        if (hammerT <= 0) { const fast = this.queue > 0; this.queue = Math.max(0, (this.queue ?? 0) - 1); hammerT = fast ? 0.55 : 2.4; smith.act('1H_Melee_Attack_Chop', fast ? 0.5 : 0.9); hitAt = t + (fast ? 0.25 : 0.45); hitFast = fast; }
        if (hitAt && t >= hitAt) { hitAt = null; burstT = 0.25; flash.scale.setScalar(1); this.onHammer?.(hitFast); }
      }
      // Caçador folheia o tomo de tempos em tempos.
      if (hunter) { hunter.update(dt); pageT -= dt; if (pageT <= 0) { pageT = 5 + rand() * 4; hunter.act('Interact', 1.2); } }
      vale.update(t, dt);
      burstT -= dt; forgeSparks.points.visible = burstT > 0; flash.scale.setScalar(Math.max(0.01, flash.scale.x * (1 - dt * 10)));
      hubUpdate(t, focus);
    },
    dispose:() => { sparks.forEach(s => s.dispose()); group.removeFromParent(); disposeTree(group); },
  };
}

// ---------- Estrada do Abismo e portão das dungeons (hub) ----------
// Estrada de pedra quebrada com braseiros, ossos e pilares em ruína; no fim um arco de pedra com o vórtice
// (shader), raios de luz, runas no chão, névoa e brasas. Tudo estático vai para o Static (fundido); só o
// vórtice, as chamas e os brilhos animam.
const VORTEX_COLOR = 0xb45cff;
function runeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.translate(128, 128); g.strokeStyle = '#fff'; g.lineCap = 'round';
  for (const [r, w] of [[118, 6], [96, 3], [60, 4]]) { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  g.lineWidth = 5;
  for (let i = 0; i < 12; i++) { // glifos entre os anéis
    g.save(); g.rotate(i / 12 * Math.PI * 2); g.translate(0, -107); g.beginPath();
    const k = i % 4; if (k === 0) { g.moveTo(-6, -6); g.lineTo(6, 6); g.moveTo(6, -6); g.lineTo(-6, 6); } else if (k === 1) { g.moveTo(0, -8); g.lineTo(0, 8); g.moveTo(-6, -2); g.lineTo(6, -2); } else if (k === 2) { g.arc(0, 0, 6, 0, Math.PI); } else { g.moveTo(-6, 6); g.lineTo(0, -7); g.lineTo(6, 6); }
    g.stroke(); g.restore();
  }
  g.lineWidth = 4; g.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2 - Math.PI / 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 60, Math.sin(a) * 60); } g.stroke();
  g.beginPath(); for (let i = 0; i <= 3; i++) { const a = i / 3 * Math.PI * 2 - Math.PI / 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 60, Math.sin(a) * 60); } g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildGate(group, st, sparks, rand, { GZ, road, darkStone, stoneMat, wood }) {
  const obst = [], P = n => propGeo(n), add = (n, x, y, z, ry, sc) => { const p = P(n); if (p) st.add(p.geo, p.mat, x, y, z, ry, sc); };
  const ruinM = surface('rock',{color:0xa7b09f}), ironM = mat(0x2a2a32, { metalness:0.6, roughness:0.5 });
  // Estrada: lajes tortas com falhas, ficando mais escuras perto do portão.
  for (let z = road.az + 0.3; z > road.bz - 1.5; z -= 1.0) for (const x of [-1.6, 0, 1.6]) {
    if (rand() < 0.16) continue;
    st.add(G.tile(), z < road.bz + 3 ? ruinM : darkStone, x + (rand() - 0.5) * 0.25, 0.05, z + (rand() - 0.5) * 0.2, (rand() - 0.5) * 0.25, 0.95 + rand() * 0.1);
  }
  // Degraus baixos de pedra na frente do arco (só visual: ficam rentes ao chão).
  for (const [w, d, y, z] of [[11, 3.2, 0.05, GZ + 0.6], [9, 2.2, 0.13, GZ + 0.1]]) st.add(shared(`gstep${w}`, () => new THREE.BoxGeometry(w, 0.1, d)), darkStone, 0, y, z);
  // Braseiros: coluna de pedra, bacia de ferro e fogo (chama + brasas sobem).
  const fires = [], fireGeo = shared('brazierFire', () => new THREE.ConeGeometry(0.42, 1.3, 6).translate(0, 0.65, 0)), fireM = glow(0xff7a2a, 3.5), coreM = glow(0xffd36b, 4);
  const braziers = [[-3.3, -15.5], [3.3, -15.5], [-3.3, -20], [3.3, -20], [-3.3, GZ + 4.4], [3.3, GZ + 4.4]];
  for (const [x, z] of braziers) {
    st.add(shared('brazPost', () => new THREE.CylinderGeometry(0.28, 0.38, 1.3, 7).translate(0, 0.65, 0)), stoneMat, x, 0, z);
    st.add(shared('brazBowl', () => new THREE.CylinderGeometry(0.6, 0.35, 0.4, 8).translate(0, 1.5, 0)), ironM, x, 0, z);
    const f = new THREE.Mesh(fireGeo, fireM); f.position.set(x, 1.62, z); group.add(f);
    const c = new THREE.Mesh(fireGeo, coreM); c.scale.setScalar(0.55); c.position.set(x, 1.6, z); group.add(c);
    fires.push({ f, c, ph:rand() * 6 }); obst.push({ x, z, r:0.55 });
  }
  const embers = new Sparks({ count:46, color:0xff8a3a, size:0.14, life:[0.6, 1.6], spawn:o => { const [x, z] = braziers[Math.floor(rand() * braziers.length)]; return o.set(x + (rand() - 0.5) * 0.5, 2, z + (rand() - 0.5) * 0.5); }, vel:o => o.set((rand() - 0.5) * 0.6, 1.2 + rand() * 1.2, (rand() - 0.5) * 0.6) });
  sparks.push(embers);
  // Pilares em ruína (quebrados em alturas diferentes) com entulho, estandartes roxos e correntes.
  const banner = mat(0x3a1a52, { side:THREE.DoubleSide, emissive:0x2a0a40 });
  for (const [x, z, h] of [[-4.6, -17.6, 3.6], [4.6, -17.6, 1.6], [-4.6, -22.4, 2.1], [4.6, -22.4, 3.9]]) {
    st.add(shared('ruinCol', () => new THREE.CylinderGeometry(0.5, 0.55, 1, 8).translate(0, 0.5, 0)), ruinM, x, 0, z, rand(), 1, h);
    st.add(shared('ruinBase', () => new THREE.BoxGeometry(1.4, 0.4, 1.4).translate(0, 0.2, 0)), darkStone, x, 0, z, rand() * 0.3);
    if (h > 3) { const b = new THREE.Mesh(shared('gateBanner', () => new THREE.PlaneGeometry(0.9, 2.2).translate(0, -1.1, 0)), banner); b.position.set(x - Math.sign(x) * 0.52, h - 0.2, z); b.rotation.y = Math.PI / 2; group.add(b); }
    else add('rubble_large', x + Math.sign(x) * 0.6, 0, z + 0.7, rand() * 6, 0.9);
    obst.push({ x, z, r:0.75 });
  }
  // Ossos e crânios na beira da estrada.
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1, x = side * (2.7 + rand() * 1.3), z = road.az - 1 - rand() * (road.az - road.bz);
    add(['skull', 'bone_A', 'bone_B', 'ribcage', 'bone_C'][i % 5], x, 0, z, rand() * 6, i % 5 === 0 ? .6 : .75);
  }
  // Arco de cantaria: pedras chanfradas seguem uma silhueta curva.
  const W=3.4,H=6.6,gz=GZ-.6;
  addGateArch(group,gz);
  for(const sx of [-1,1])obst.push({x:sx*3.88,z:gz,r:1});
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), glow(VORTEX_COLOR, 5)); gem.position.set(0, 7.18, gz + .82); group.add(gem);

  const link = shared('chainLink', () => new THREE.TorusGeometry(0.13, 0.04, 4, 8));
  for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) { // corrente em arco da verga até o pilar
    const t = i / 8, x = sx * (W - 0.2 - t * 0.2), y = H - 0.1 - t * 2.6 + Math.sin(t * Math.PI) * 0.3, m = new THREE.Mesh(link, ironM);
    m.position.set(x, y, gz + 0.85); m.rotation.set(0, i % 2 ? Math.PI / 2 : 0, 0.3 * sx); group.add(m);
  }
  // Vórtice: espiral em shader dentro de uma elipse, com halo pulsante atrás e raios de luz girando.
  const vortexM = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.DoubleSide,
    uniforms:{ t:{ value:0 }, a:{ value:new THREE.Color(VORTEX_COLOR) }, b:{ value:new THREE.Color(0x3fe0ff) } },
    vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:`uniform float t; uniform vec3 a; uniform vec3 b; varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0; float r = length(p); if (r > 1.0) discard;
        float ang = atan(p.y, p.x);
        // Braços da espiral girando para dentro sobre um fundo violeta escuro (contraste com a grama clara).
        float arms = pow(sin(ang * 3.0 + log(r + 0.05) * 5.0 + t * 2.6) * 0.5 + 0.5, 3.0);
        float fine = pow(sin(ang * 6.0 - r * 16.0 + t * 4.0) * 0.5 + 0.5, 6.0);
        vec3 base = vec3(0.07, 0.01, 0.16) * (1.0 - r * 0.4);
        vec3 c = base + a * arms * (0.4 - r * 0.2) + b * fine * 0.2 * r;
        float rim = smoothstep(0.78, 0.97, r) * smoothstep(1.0, 0.96, r);
        float core = smoothstep(0.28, 0.0, r) * (0.7 + 0.3 * sin(t * 4.0));
        c += a * rim * .65 + vec3(0.6, 0.75, 1.0) * core * .6;
        gl_FragColor = vec4(c, smoothstep(1.0, 0.93, r));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const vortex = new THREE.Mesh(new THREE.PlaneGeometry(2 * W - 0.2, H - 0.3), vortexM); vortex.position.set(0, (H - 0.3) / 2 + 0.1, gz); group.add(vortex);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2 * W + 5, H + 5), additive(new THREE.Color(VORTEX_COLOR), 0.2, { map:dotTex })); halo.position.set(0, H / 2, gz - 0.3); group.add(halo);
  const rays = new THREE.Group(); rays.position.set(0, H / 2, gz + 0.2); group.add(rays);
  const rayM = additive(new THREE.Color(0xd8b0ff), 0.16);
  for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(shared('gateRay', () => new THREE.PlaneGeometry(0.5, 11).translate(0, 5.5, 0)), rayM); r.rotation.z = i / 7 * Math.PI * 2; rays.add(r); }
  // Runas no chão (anel grande girando na frente do arco) e glifos pulsando no meio da estrada.
  const runeTex = runeTexture(), runeM = additive(new THREE.Color(VORTEX_COLOR), 0.8, { map:runeTex });
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4).rotateX(-Math.PI / 2), runeM); rune.position.set(0, 0.2, GZ + 2.6); group.add(rune);
  const glyphM = additive(new THREE.Color(VORTEX_COLOR), 0.5, { map:runeTex }), glyphs = [];
  for (let z = -15; z > GZ + 5; z -= 3.2) { const g = new THREE.Mesh(shared('glyph', () => new THREE.PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2)), glyphM.clone()); g.position.set(0, 0.12, z); group.add(g); glyphs.push(g); }
  // Névoa baixa saindo do portão e motas de energia que sobem do vórtice.
  const fogM = additive(new THREE.Color(0x8a6aff), 0.16, { map:dotTex }), fog = [];
  for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(shared('gateFog', () => new THREE.PlaneGeometry(6, 2.2)), fogM); f.position.set((i - 2) * 2.2, 0.7, GZ + 1.2 + (i % 2) * 1.4); group.add(f); fog.push({ f, ph:i * 1.3 }); }
  const motes = new Sparks({ count:50, color:VORTEX_COLOR, size:0.2, life:[0.8, 2],
    spawn:o => { const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()); return o.set(Math.cos(a) * rr * (W - 0.4), H / 2 + Math.sin(a) * rr * (H / 2 - 0.4), gz + 0.3); },
    vel:o => o.set((rand() - 0.5) * 1.2, 0.6 + rand() * 1.4, 0.8 + rand() * 1.6) });
  sparks.push(motes);
  let lastT = 0;
  return {
    pos:new THREE.Vector3(0, 0, GZ),
    inside:(x, z, r) => (x ** 2 + (z - GZ - 1) ** 2 < (6.5 - 1.6 - r) ** 2) || segDist(x, z, road) < road.w / 2 - r,
    // Arco e vórtice são sólidos: o herói para na frente das runas.
    blocks:(x, z, r) => (z < GZ + 0.6 + r && Math.abs(x) < W + 1.6) || obst.some(o => Math.hypot(x - o.x, z - o.z) < o.r + r),
    update(t) {
      const dt = Math.min(0.05, t - lastT); lastT = t;
      vortexM.uniforms.t.value = t;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
      halo.material.opacity = 0.12 + pulse * 0.12; halo.scale.setScalar(1 + pulse * 0.06);
      rays.rotation.z = t * 0.15; rayM.opacity = 0;
      rune.rotation.y = t * 0.2; runeM.opacity = 0.25 + pulse * 0.1;
      glyphs.forEach((g, i) => { g.material.opacity = 0.12 + 0.15 * (0.5 + 0.5 * Math.sin(t * 2.5 - i * 0.9)); });
      gem.rotation.y = t * 1.5; gem.scale.setScalar(1 + pulse * 0.2);
      for (const F of fires) { const k = 1 + Math.sin(t * 14 + F.ph) * 0.12 + Math.sin(t * 23 + F.ph) * 0.08; F.f.scale.set(1, k, 1); F.c.scale.set(0.55, 0.55 * k * 1.1, 0.55); }
      for (const F of fog) { F.f.position.x += Math.sin(t * 0.4 + F.ph) * dt * 0.3; F.f.material.opacity = 0.12 + Math.sin(t * 0.7 + F.ph) * 0.04; }
    },
  };
}

// ---------- Vale das Ervas (hub): veios de minério, moitas e a alquimista com o caldeirão ----------
// Nós em InstancedMesh (4 malhas para todos): esgotado = pedra menor sem minério / moita cortada sem flores.
// Posições relativas ao centro do vale (x leste, z sul). A entrada da trilha fica a sudoeste.
const NODE_SPOTS = {
  ferro:[[-2, -7], [1.5, -8.6], [5, -7], [8, -4]], prata:[[3, -4.5], [9.5, -0.5]], mitril:[[-0.5, -10.2]],
  erva:[[1, 5], [4.5, 7.5], [7.5, 4], [-1.5, 9]], raiz:[[4, 2], [7.5, 7]], florSol:[[1.5, 0.5], [10, 1.5]],
};
const ORE_COLOR = { ferro:0xd08850, prata:0xeef2fa, mitril:0x5fe0ff };
const PLANT = { erva:{ leaf:0x4f9a3a, bloom:0xff4a5a }, raiz:{ leaf:0x3a7a7a, bloom:0xa8c0ff }, florSol:{ leaf:0x6a9a2a, bloom:0xffc23a } };
// Nós na borda da praça (posição absoluta), longe das estações e do cercado de treino.
const HUB_NODE_SPOTS = [['ferro', -11.6, 2.2], ['ferro', -10.6, 5.4], ['prata', -13.1, -1.2], ['erva', 10.7, 7.3], ['erva', -9.9, 8.1], ['erva', 2.8, 13.2], ['raiz', -2.8, 13.4]];
function buildValley(group, st, sparks, rand, { VX, VZ, ux, uz, wood, lampM }) {
  const obst = [], nodes = [];
  // Placa e lanternas na saída da praça.
  const px = -uz, pz = ux, at = (k, side) => [ux * k + px * side, uz * k + pz * side];
  for (const side of [-2.7, 2.7]) { const [x, z] = at(14.6, side); st.add(shared('lamp', () => new THREE.CylinderGeometry(0.12, 0.15, 3, 6).translate(0, 1.5, 0)), wood, x, 0, z); st.add(shared('lampTop', () => new THREE.OctahedronGeometry(0.3).translate(0, 3.2, 0)), lampM, x, 0, z); }
  {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#8a6a44'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#5a3d22'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 88);
    g.fillStyle = '#fff4dc'; g.textAlign = 'center'; g.font = 'bold 34px sans-serif'; g.fillText('Vale das Ervas', 128, 44); g.font = 'bold 24px sans-serif'; g.fillText('mina · alquimista', 128, 76);
    const [x, z] = at(13.2, 3.4), sign = new THREE.Group(); sign.position.set(x, 0, z); sign.rotation.y = Math.atan2(-x, -z) + 0.35; group.add(sign);
    const post = box(0.16, 2.3, 0.16, wood); post.position.y = 1.15; sign.add(post);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.64, 0.08), [wood, wood, wood, wood, mat(0xffffff, { map:tex, flatShading:false }), wood]); plank.position.y = 1.9; plank.castShadow = true; sign.add(plank);
    obst.push({ x, z, r:0.3 });
  }
  // Mina: arco de madeira na encosta norte, com boca escura e pedras em volta.
  const mine = new THREE.Group(); mine.position.set(VX + 2.5, 0, VZ - 11.9); group.add(mine);
  for (const x of [-1.5, 1.5]) { const p = box(0.4, 3.2, 0.4, wood); p.position.set(x, 1.6, 0); mine.add(p); }
  const lintel = box(3.9, 0.45, 0.5, wood); lintel.position.y = 3.3; mine.add(lintel);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 3.1), new THREE.MeshBasicMaterial({ color:0x0b0806 })); hole.position.set(0, 1.55, -0.3); mine.add(hole);
  const mLamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), glow(0xffb040, 4)); mLamp.position.set(1.1, 2.7, 0.35); mine.add(mLamp);
  const rockM = mat(0x8a8580, { roughness:0.95 });
  for (const [x, y, z, s, sy] of [[-3, 0.6, -0.4, 1.9, 1.6], [3.2, 0.5, -0.3, 1.7, 1.4], [-2.4, 2.6, -0.9, 1.4, 1.2], [2.6, 2.7, -0.8, 1.5, 1], [0, 4.3, -1, 2.4, 1.1], [-4.8, 0.3, 0.6, 1.2, 0.8], [5, 0.2, 0.8, 1, 0.7]])
    st.add(G.rock(), rockM, VX + 2.5 + x, y, VZ - 11.9 + z, rand() * 3, s, sy);
  obst.push({ x:VX + 2.5, z:VZ - 11.9, r:2.2 });
  for (let i = 0; i < 5; i++) { const s = 0.5 + rand() * 0.5; st.add(shared('crate', () => new THREE.BoxGeometry(0.9, 0.9, 0.9).translate(0, 0.45, 0)), wood, VX + 5.5 + i % 2 * 1.1, i > 2 ? 0.9 * s : 0, VZ - 10 + (i % 3) * 0.3, rand(), s); }

  // Nós de coleta.
  const ores = [], plants = [];
  const spots = [...Object.entries(NODE_SPOTS).flatMap(([type, list]) => list.map(([dx, dz], i) => [`${type}${i}`, type, VX + dx, VZ + dz])),
    ...HUB_NODE_SPOTS.map(([type, x, z], i) => [`h${type}${i}`, type, x, z])];
  for (const [id, type, x, z] of spots) {
    const n = { id, type, x, z, ry:rand() * 6.28, s:(ORE_COLOR[type] ? 1.15 : 0.95) + rand() * 0.25, k:1, target:1, shake:0 };
    (ORE_COLOR[type] ? ores : plants).push(n); nodes.push(n); obst.push({ x:n.x, z:n.z, r:0.75 });
  }
  const oreRock = instanced(shared('organicRock', () => new THREE.IcosahedronGeometry(1,2).scale(1,.75,.85)), surface('rock'), ores.map(n => ({ x:n.x, y:0.2, z:n.z, s:1, c:0x7d7a76 })));
  const oreGeo = shared('oreChunks', () => mergeGeometries([[0, 0.95, 0, 0.32], [0.45, 0.7, 0.2, 0.24], [-0.4, 0.75, -0.15, 0.26], [0.1, 0.65, 0.5, 0.2], [-0.15, 0.6, -0.5, 0.22]]
    .map(([x, y, z, r]) => new THREE.OctahedronGeometry(r).scale(1, 1.6, 1).rotateZ(x * 0.8).translate(x, y, z))));
  const oreBits = instanced(oreGeo, mat(0xffffff, { metalness:0.55, roughness:0.3, emissive:0x111111 }), ores.map(n => ({ x:n.x, y:0, z:n.z, s:1, c:ORE_COLOR[n.type] })));
  const bush = instanced(shared('naturalHerbs', () => foliageGeometry()),
    mat(0x8d9e70, {roughness:1,side:THREE.DoubleSide,flatShading:false}), plants.map(n => ({x:n.x,y:0,z:n.z,s:1,c:PLANT[n.type].leaf})));
  const bloomGeo = shared('blooms', () => mergeGeometries([[0, 1.05, 0], [0.5, 0.8, 0.35], [-0.5, 0.75, 0.25], [0.2, 0.7, -0.5], [-0.3, 0.85, -0.35], [0.6, 0.6, -0.2]].map(([x, y, z]) => new THREE.SphereGeometry(0.07, 5, 4).scale(1,.6,1).translate(x, y*.78, z))));
  const blooms = instanced(bloomGeo, mat(0xcab8af,{roughness:1}), plants.map(n => ({ x:n.x, y:0, z:n.z, s:1, c:PLANT[n.type].bloom })), { shadow:false });
  for (const m of [oreRock, oreBits, bush, blooms]) group.add(m);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const place = (mesh, i, n, y, s, sy = s) => { const sh = n.shake > 0 ? Math.sin(n.shake * 90) * n.shake * 0.4 : 0; q.setFromEuler(e.set(0, n.ry, sh)); mesh.setMatrixAt(i, m4.compose(p.set(n.x + sh * 0.5, y, n.z), q, sc.set(s, sy, s))); mesh.instanceMatrix.needsUpdate = true; };
  const draw = n => {
    const k = n.k, s = n.s;
    if (ORE_COLOR[n.type]) { const i = ores.indexOf(n); place(oreRock, i, n, 0.2, s * (0.6 + 0.4 * k), s * (0.45 + 0.3 * k)); place(oreBits, i, n, 0, Math.max(0.001, s * k)); }
    else { const i = plants.indexOf(n); place(bush, i, n, 0, s * (0.4 + 0.6 * k), s * (0.3 + 0.7 * k)); place(blooms, i, n, 0, Math.max(0.001, s * k)); }
  };
  nodes.forEach(draw);

  // Alquimista: caldeirão sobre fogo, mesa com frascos e a Mirela atrás, de frente para o sul (câmera).
  const alch = new THREE.Group(); alch.position.set(VX - 7, 0, VZ - 1.5); group.add(alch);
  const iron = mat(0x2a2a32, { metalness:0.6, roughness:0.45, side:THREE.DoubleSide });
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 10, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7), iron); pot.position.y = 1.0; pot.castShadow = true; alch.add(pot);
  const rimY = 1.0 + 0.95 * Math.cos(Math.PI * 0.3), rimR = 0.95 * Math.sin(Math.PI * 0.3);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.08, 6, 20).rotateX(Math.PI / 2), iron); rim.position.y = rimY; alch.add(rim);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, leg = box(0.12, 0.5, 0.12, iron); leg.position.set(Math.cos(a) * 0.6, 0.25, Math.sin(a) * 0.6); alch.add(leg); }
  const liquidM = new THREE.MeshBasicMaterial({ color:new THREE.Color(0x5aff8a).multiplyScalar(1.4) });
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(rimR - 0.04, 24).rotateX(-Math.PI / 2), liquidM); liquid.position.y = rimY - 0.08; alch.add(liquid);
  for (let i = 0; i < 4; i++) { const log = box(0.9, 0.14, 0.14, wood); log.position.set(0, 0.08, 0); log.rotation.y = i * 0.8; alch.add(log); }
  const fire = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), glow(0xff7a2a, 4)); fire.position.y = 0.3; alch.add(fire);
  const table = box(1.8, 0.1, 0.9, wood); table.position.set(-2.4, 0.95, -1.3); alch.add(table);
  for (const [x, z] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]]) { const leg = box(0.1, 0.95, 0.1, wood); leg.position.set(-2.4 + x, 0.47, -1.3 + z); alch.add(leg); }
  [0xff6a7a, 0x5aff8a, 0x7fe9ff, 0xffd36b, 0xff8a3a].forEach((c, i) => {
    const b = new THREE.Mesh(shared('flask', () => mergeGeometries([new THREE.SphereGeometry(0.16, 10, 8).translate(0, 0.16, 0), new THREE.CylinderGeometry(0.05, 0.06, 0.18, 8).translate(0, 0.38, 0)])), glow(c, 1.3));
    b.position.set(-3.1 + i * 0.35, 1.0, -1.3 + (i % 2 ? 0.2 : -0.15)); b.scale.setScalar(0.8 + (i % 3) * 0.15); alch.add(b);
  });
  // Ervas em secagem: agrupadas junto à mesa, longe do ponto de interação.
  const herbM = mat(0x789450, { roughness:1 }), herbStem = mat(0x786647, { roughness:1 });
  for (const x of [-3.0, -2.55, -2.1]) {
    const stem = box(0.06, 0.5, 0.06, herbStem); stem.position.set(x, 1.7, -1.75); alch.add(stem);
    const bundle = new THREE.Mesh(shared('welcomeHerbs', () => new THREE.IcosahedronGeometry(0.17, 0).scale(1, 1.4, 1)), herbM); bundle.position.set(x, 1.42, -1.75); alch.add(bundle);
  }
  const ap = (x, z) => alch.localToWorld(new THREE.Vector3(x, 0, z));
  alch.updateMatrixWorld(true);
  const npc = M.createNpc('Mage', { tint:0xc8e8b0, ladle:true });
  if (npc) { npc.root.position.copy(ap(0, -1.8)); npc.root.lookAt(alch.position.x, 0, alch.position.z); group.add(npc.root); }
  for (const [v, r] of [[alch.position, 1.1], [ap(-2.4, -1.3), 1.0], [ap(0, -1.8), 0.5]]) obst.push({ x:v.x, z:v.z, r });
  const surf = () => alch.localToWorld(p.set((rand() - 0.5) * rimR * 1.2, rimY, (rand() - 0.5) * rimR * 1.2));
  const bubbles = new Sparks({ count:14, color:0x5aff8a, size:0.18, life:[0.4, 1.1], spawn:o => o.copy(surf()), vel:o => o.set(0, 0.3 + rand() * 0.5, 0) });
  const boil = new Sparks({ count:40, color:0x5aff8a, size:0.26, life:[0.3, 0.8], spawn:o => o.copy(surf()), vel:o => o.set((rand() - 0.5) * 1.2, 1.5 + rand() * 2.5, (rand() - 0.5) * 1.2) });
  boil.points.visible = false; sparks.push(bubbles, boil);
  const base = new THREE.Color(0x5aff8a), cur = base.clone(), want = base.clone();
  let stirT = 3, brewOn = false;

  return {
    nodes, alchemist:npc ? npc.root.position.clone() : alch.position.clone(), alchStation:ap(0, 2.6),
    blocks:(x, z, r) => obst.some(o => Math.hypot(x - o.x, z - o.z) < o.r + r),
    // ready=false: esgota (encolhe); true: renasce (cresce de volta).
    setNode(id, ready, instant = false) { const n = nodes.find(o => o.id === id); if (!n) return; n.target = ready ? 1 : 0; if (instant) { n.k = n.target; draw(n); } },
    hitNode(id) { const n = nodes.find(o => o.id === id); if (n) n.shake = 0.25; },
    // Caldeirão ferve na cor da poção enquanto prepara.
    brewing(on, color = 0x5aff8a) {
      brewOn = on; want.set(on ? color : 0x5aff8a); boil.points.visible = on;
      boil.points.material.color.set(want).multiplyScalar(3); bubbles.points.material.color.set(want).multiplyScalar(3);
      if (on) npc?.act('Spellcast_Long', 1.7);
    },
    update(t, dt) {
      for (const n of nodes) if (n.k !== n.target || n.shake > 0) { n.k += Math.sign(n.target - n.k) * Math.min(Math.abs(n.target - n.k), dt * 2.5); n.shake = Math.max(0, n.shake - dt); draw(n); }
      cur.lerp(want, 1 - Math.exp(-dt * 4)); liquidM.color.copy(cur).multiplyScalar(1.3 + Math.sin(t * (brewOn ? 12 : 3)) * 0.25);
      liquid.position.y = rimY - 0.08 + (brewOn ? Math.sin(t * 20) * 0.02 : 0);
      fire.scale.setScalar(1 + Math.sin(t * 13) * 0.15 + (brewOn ? 0.5 : 0));
      if (npc) { npc.update(dt); stirT -= dt; if (stirT <= 0 && !brewOn) { stirT = 4 + rand() * 3; npc.act('Spellcast_Raise', 1.4); } }
    },
  };
}
