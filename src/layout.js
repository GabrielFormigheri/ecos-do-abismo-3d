// Layouts das dungeons (sem Three.js, testável no node).
// Sala = círculo "núcleo" (cx, cz, r) + formas extras (círculos e retângulos); corredor = cápsulas encadeadas.
import { mulberry32 } from './core.js';

export function segDist(x, z, p) {
  const dx = p.bx - p.ax, dz = p.bz - p.az, l2 = dx * dx + dz * dz || 1;
  const t = Math.min(1, Math.max(0, ((x - p.ax) * dx + (z - p.az) * dz) / l2));
  return Math.hypot(x - (p.ax + dx * t), z - (p.az + dz * t));
}
export function shapeD(s, x, z) {
  if (s.hx === undefined) return Math.hypot(x - s.x, z - s.z) - s.r;
  const qx = Math.abs(x - s.x) - s.hx, qz = Math.abs(z - s.z) - s.hz;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}
// Distância com sinal até a borda da sala (negativa dentro).
export function roomD(room, x, z) {
  if (!room.shapes) return Math.hypot(x - room.cx, z - room.cz) - room.r;
  let d = Infinity; for (const s of room.shapes) d = Math.min(d, shapeD(s, x, z)); return d;
}

// Cadeia de clareiras: entrada, 3 arenas, chefe. Rumo geral ao norte (-z), em zigue-zague.
function layoutArenas(seed) {
  const kinds = ['start', 'arena', 'arena', 'arena', 'boss'], radii = [9, 13, 14, 15, 19], PATH = 11, W = 6;
  for (let attempt = 0; attempt < 40; attempt++) {
    const rand = mulberry32(seed + attempt * 7919), zones = [], paths = [];
    let side = rand() < 0.5 ? -1 : 1;
    for (let i = 0; i < kinds.length; i++) {
      let cx = 0, cz = 0;
      if (i > 0) {
        const p = zones[i - 1], h = side * (0.25 + rand() * 0.6), step = p.r + PATH + radii[i];
        side = -side; cx = p.cx + Math.sin(h) * step; cz = p.cz - Math.cos(h) * step;
      }
      const zone = { i, kind:kinds[i], r:radii[i], cx, cz, cleared:i === 0, locked:false };
      zones.push(zone);
      if (i > 0) { const p = zones[i - 1]; paths.push({ ax:p.cx, az:p.cz, bx:cx, bz:cz, w:W, zones:[p, zone] }); }
    }
    const ok = zones.every((a, i) => zones.every((b, j) => Math.abs(i - j) < 2 || Math.hypot(a.cx - b.cx, a.cz - b.cz) > a.r + b.r + 8))
      && paths.every(p => zones.every(z => p.zones.includes(z) || segDist(z.cx, z.cz, p) > z.r + W / 2 + 4));
    if (ok) return { zones, paths };
  }
  throw new Error('layout impossível');
}

const room = (i, kind, cx, cz, r, shapes) => ({ i, kind, cx, cz, r, shapes:[{ x:cx, z:cz, r }, ...shapes], cleared:kind === 'start', locked:false });
// Raio que cobre a sala inteira (para sortear pontos de nascimento).
const reach = rm => Math.max(...rm.shapes.map(s => Math.hypot(s.x - rm.cx, s.z - rm.cz) + (s.hx === undefined ? s.r : Math.hypot(s.hx, s.hz))));

// Câmaras irregulares: núcleo + "bolhas" ao redor.
function blobRoom(rand, i, kind, cx, cz, r, lobes) {
  const shapes = [];
  for (let k = 0; k < lobes; k++) {
    const a = rand() * Math.PI * 2, d = r * (0.55 + rand() * 0.35), lr = r * (0.4 + rand() * 0.25);
    shapes.push({ x:cx + Math.cos(a) * d, z:cz + Math.sin(a) * d, r:lr });
  }
  return room(i, kind, cx, cz, r, shapes);
}
// Corredor sinuoso: pontos intermediários deslocados para os lados.
function windPts(rand, a, b, bends, amp) {
  const pts = [[a.cx, a.cz]], dx = b.cx - a.cx, dz = b.cz - a.cz, L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
  for (let k = 1; k <= bends; k++) { const t = k / (bends + 1), o = (rand() - 0.5) * 2 * amp; pts.push([a.cx + dx * t + nx * o, a.cz + dz * t + nz * o]); }
  pts.push([b.cx, b.cz]);
  return pts;
}

// Gerador genérico: cadeia principal (entrada, 4 arenas, chefe) + salas laterais opcionais em becos.
// radii/lobes: um valor por sala da cadeia. O primeiro beco de cada planta é secreto (parede rachada).
const CFG = {
  // Caverna: câmaras irregulares, túneis estreitos e tortos, dois becos com tesouro.
  caverna:{ radii:[8, 14, 15, 16, 16, 19], lobes:[2, 3, 3, 3, 3, 2], W:4.2, gap:16, bends:3, amp:5, sides:2, sideR:8 },
  // Lava: ilhas ligadas por pontes quase retas sobre o magma.
  lava:{ radii:[9, 14, 15, 15, 16, 19], lobes:[1, 2, 2, 2, 2, 2], W:3.8, gap:14, bends:1, amp:3, sides:2, sideR:8 },
  // Floresta: clareiras orgânicas ligadas por trilhas largas e curvas.
  bosque:{ radii:[9, 15, 15, 16, 17, 20], lobes:[1, 2, 2, 2, 2, 2], W:5.5, gap:13, bends:2, amp:4, sides:2, sideR:8 },
  // Vazio: ilhotas flutuantes ligadas por passarelas finas e retas.
  vazio:{ radii:[8, 14, 14, 15, 16, 19], lobes:[1, 2, 3, 2, 3, 1], W:3.6, gap:15, bends:1, amp:2, sides:2, sideR:8 },
  // Cemitério: alamedas tortas entre quadras irregulares, dois becos.
  cemiterio:{ radii:[8, 14, 15, 15, 16, 19], lobes:[2, 2, 3, 3, 3, 2], W:4.6, gap:14, bends:2, amp:4, sides:2, sideR:8 },
};
// Plantas em grade (salões retangulares): ruína gelada, jardim de canteiros, forja de salões.
const GRID = { ruina:{ CELL:48, W:5, sides:2 }, jardim:{ CELL:48, W:5.5, sides:2 }, forja:{ CELL:48, W:4.6, sides:2 } };
const CHAIN = 6; // entrada + 4 arenas + chefe
const shuffle = (arr, rand) => arr.map(v => [rand(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
function layoutBlobs(seed, cfg) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const rand = mulberry32(seed + attempt * 7919), zones = [], links = [];
    let side = rand() < 0.5 ? -1 : 1, heading = 0;
    const N = cfg.radii.length;
    for (let i = 0; i < N; i++) {
      const kind = i === 0 ? 'start' : i === N - 1 ? 'boss' : 'arena';
      let cx = 0, cz = 0;
      if (i > 0) {
        const p = zones[i - 1]; heading = side * (0.35 + rand() * 0.7); side = -side;
        const step = reach(p) + cfg.gap + cfg.radii[i] * 1.5;
        cx = p.cx + Math.sin(heading) * step; cz = p.cz - Math.cos(heading) * step;
      }
      zones.push(blobRoom(rand, i, kind, cx, cz, cfg.radii[i], cfg.lobes[i]));
      if (i > 0) links.push([zones[i - 1], zones[i], windPts(rand, zones[i - 1], zones[i], cfg.bends, cfg.amp), true]);
    }
    // Becos laterais saindo de arenas sorteadas, para o lado oposto ao fluxo.
    const hosts = shuffle([...Array(N - 2).keys()].map(k => k + 1), rand).slice(0, cfg.sides);
    for (const h of hosts) {
      const host = zones[h], next = zones[h + 1], prev = zones[h - 1];
      const fx = next.cx - prev.cx, fz = next.cz - prev.cz, s = rand() < 0.5 ? -1 : 1;
      const a = Math.atan2(fz, fx) + s * (Math.PI / 2 + (rand() - 0.5) * 0.6), step = reach(host) + cfg.gap * 0.8 + cfg.sideR * 1.4;
      const sr = blobRoom(rand, h, 'arena', host.cx + Math.cos(a) * step, host.cz + Math.sin(a) * step, cfg.sideR, 2);
      sr.side = true; sr.secret = !zones.some(z => z.side); zones.push(sr);
      links.push([host, sr, windPts(rand, host, sr, Math.max(1, cfg.bends - 1), cfg.amp), false]);
    }
    const out = finish(zones, links, cfg.W);
    if (out) return out;
  }
  throw new Error('layout impossível');
}

// Ruínas: grade de salões retangulares, corredores em "Z", salões em L e becos laterais.
function layoutRuins(seed, { CELL, W, sides:maxSides }) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const rand = mulberry32(seed + attempt * 7919), cells = [[0, 0]], used = new Set(['0,0']);
    let dir = 0;
    while (cells.length < CHAIN) {
      const [x, y] = cells.at(-1), opts = [[0, -1], [0, -1], [dir || -1, 0], [dir || 1, 0]].map(([dx, dy]) => [x + dx, y + dy]).filter(c => !used.has(c + ''));
      if (!opts.length) break;
      const c = opts[Math.floor(rand() * opts.length)]; dir = c[0] - x || dir;
      cells.push(c); used.add(c + '');
    }
    if (cells.length < CHAIN) continue;
    const zones = [], links = [];
    cells.forEach(([gx, gy], i) => {
      const kind = i === 0 ? 'start' : i === CHAIN - 1 ? 'boss' : 'arena';
      const cx = gx * CELL + (rand() - 0.5) * 8, cz = gy * CELL + (rand() - 0.5) * 8;
      if (kind === 'boss') { zones.push(room(i, kind, cx, cz, 17, [{ x:cx, z:cz, hx:15.5, hz:15.5 }])); return; }
      const hx = kind === 'start' ? 8 : 9 + rand() * 4, hz = kind === 'start' ? 8 : 9 + rand() * 4, shapes = [{ x:cx, z:cz, hx, hz }];
      // Ala extra colada num lado: salão em L ou T.
      if (kind === 'arena' && rand() < 0.7) {
        const ax = rand() < 0.5, s = rand() < 0.5 ? -1 : 1, ex = 4 + rand() * 3, ez = 4 + rand() * 2;
        shapes.push(ax ? { x:cx + s * (hx + ex - 2), z:cz + (rand() - 0.5) * (hz - ez) * 2, hx:ex, hz:ez } : { x:cx + (rand() - 0.5) * (hx - ez) * 2, z:cz + s * (hz + ex - 2), hx:ez, hz:ex });
      }
      zones.push(room(i, kind, cx, cz, Math.min(hx, hz), shapes));
    });
    const zpts = (a, b) => {
      // Dobra em 1/3 do caminho: um trecho reto longo para os desafios.
      if (Math.abs(b.cx - a.cx) > Math.abs(b.cz - a.cz)) { const mx = a.cx + (b.cx - a.cx) * 0.35; return [[a.cx, a.cz], [mx, a.cz], [mx, b.cz], [b.cx, b.cz]]; }
      const mz = a.cz + (b.cz - a.cz) * 0.35; return [[a.cx, a.cz], [a.cx, mz], [b.cx, mz], [b.cx, b.cz]];
    };
    for (let i = 1; i < CHAIN; i++) links.push([zones[i - 1], zones[i], zpts(zones[i - 1], zones[i]), true]);
    // Becos: células livres vizinhas de arenas.
    let sides = 0;
    for (const h of shuffle([1, 2, 3, 4], rand)) {
      if (sides >= maxSides) break;
      const [gx, gy] = cells[h], free = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [gx + dx, gy + dy]).filter(c => !used.has(c + ''));
      if (!free.length) continue;
      const [fx, fy] = free[Math.floor(rand() * free.length)]; used.add(fx + ',' + fy);
      const cx = fx * CELL + (rand() - 0.5) * 6, cz = fy * CELL + (rand() - 0.5) * 6, hx = 6 + rand() * 2, hz = 6 + rand() * 2;
      const sr = room(h, 'arena', cx, cz, Math.min(hx, hz), [{ x:cx, z:cz, hx, hz }]); sr.side = true; sr.secret = !sides; zones.push(sr);
      links.push([zones[h], sr, zpts(zones[h], sr), false]); sides++;
    }
    const out = finish(zones, links, W);
    if (out) return out;
  }
  throw new Error('layout impossível');
}

// Converte corredores em cápsulas, escolhe o trecho de desafio de cada corredor principal e valida a planta.
function finish(zones, links, W) {
  const paths = [];
  for (const [a, b, pts, main] of links) {
    const segs = [], zs = [a, b];
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      if (Math.hypot(bx - ax, bz - az) < 0.01) continue;
      segs.push({ ax, az, bx, bz, w:W, zones:zs, ch:false, main });
    }
    // Trecho livre (fora das duas salas) de cada segmento.
    let best = null;
    for (const s of segs) {
      const len = Math.hypot(s.bx - s.ax, s.bz - s.az); let ta = null, tb = null;
      for (let t = 0; t <= len; t += 0.5) {
        const x = s.ax + (s.bx - s.ax) * t / len, z = s.az + (s.bz - s.az) * t / len;
        if (roomD(a, x, z) > 1 && roomD(b, x, z) > 1) { ta ??= t; tb = t; }
      }
      if (ta !== null && (!best || tb - ta > best.tb - best.ta)) best = { s, ta, tb };
    }
    if (main) { if (!best || best.tb - best.ta < 9) return null; Object.assign(best.s, { ch:true, ta:best.ta, tb:best.tb }); }
    paths.push(...segs);
  }
  // Salas não podem encostar umas nas outras.
  for (const a of zones) for (const b of zones) if (a !== b && Math.hypot(a.cx - b.cx, a.cz - b.cz) < reach(a) + reach(b) + 5) return null;
  // Corredor passa longe das salas que não liga e dos outros corredores.
  for (const p of paths) {
    const len = Math.hypot(p.bx - p.ax, p.bz - p.az);
    for (let t = 0; t <= len; t += 1) {
      const x = p.ax + (p.bx - p.ax) * t / len, z = p.az + (p.bz - p.az) * t / len;
      if (zones.some(zn => !p.zones.includes(zn) && roomD(zn, x, z) < W / 2 + 4)) return null;
      if (p.zones.some(zn => roomD(zn, x, z) < 1.5)) continue;
      if (paths.some(q => q.zones !== p.zones && segDist(x, z, q) < W + 3)) return null;
    }
  }
  for (const zn of zones) zn.sr = reach(zn);
  return { zones, paths };
}

export function layoutDungeon(seed, kind = 'arenas') {
  const gen = GRID[kind] ? s => layoutRuins(s, GRID[kind]) : CFG[kind] ? s => layoutBlobs(s, CFG[kind]) : layoutArenas;
  // Semente azarada (nenhuma tentativa válida): tenta outra em vez de travar a run.
  for (let k = 0; ; k++) try { return gen(seed + k * 104729); } catch (e) { if (k >= 5) throw e; }
}

// ---------- O que vai dentro da planta (sem Three.js, testável) ----------
// Grade de alcance da sala: células caminháveis ligadas ao centro, desviando dos obstáculos.
const CELL_R = 0.5;
function reachGrid(room, obstacles) {
  const R = room.sr ?? room.r, n = Math.ceil(R * 2 / CELL_R) + 3, x0 = room.cx - n * CELL_R / 2, z0 = room.cz - n * CELL_R / 2;
  const free = (x, z) => roomD(room, x, z) < -0.6 && !obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.6);
  const seen = new Uint8Array(n * n), q = [], at = (x, z) => [Math.round((x - x0) / CELL_R), Math.round((z - z0) / CELL_R)];
  const [i0, j0] = at(room.cx, room.cz); seen[j0 * n + i0] = 1; q.push(i0, j0);
  while (q.length) {
    const j = q.pop(), i = q.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= n || b >= n || seen[b * n + a]) continue;
      if (!free(x0 + a * CELL_R, z0 + b * CELL_R)) { seen[b * n + a] = 2; continue; }
      seen[b * n + a] = 1; q.push(a, b);
    }
  }
  return (x, z) => { const [i, j] = at(x, z); return i >= 0 && j >= 0 && i < n && j < n && seen[j * n + i] === 1; };
}
// Ponto livre dentro da sala: longe da borda, do que já foi colocado (taken) e, se pedido, das faixas dos corredores.
export function freeSpot(room, rand, taken, r, { pad = 1, lanes = null, far = null, core = false, tries = 150 } = {}) {
  const shapes = core || !room.shapes ? [{ x:room.cx, z:room.cz, r:room.r }] : room.shapes;
  for (let k = 0; k < tries; k++) {
    const s = shapes[Math.floor(rand() * shapes.length)], round = s.hx === undefined;
    const x = s.x + (rand() * 2 - 1) * (round ? s.r : s.hx), z = s.z + (rand() * 2 - 1) * (round ? s.r : s.hz);
    if (roomD(room, x, z) > -(r + pad) || (core && Math.hypot(x - room.cx, z - room.cz) < room.r * 0.3)) continue;
    if (taken.some(t => Math.hypot(t.x - x, t.z - z) < t.r + r + pad)) continue;
    if (lanes?.some(p => segDist(x, z, p) < p.w / 2 + r + pad)) continue;
    if (far?.some(f => Math.hypot(f.x - x, f.z - z) < f.d)) continue;
    if (room.reach && !room.reach(x, z)) continue;
    const spot = { x, z, r }; taken.push(spot); return spot;
  }
  return null;
}

// Como cada arena abre. Sem repetir na run; mini-chefe no meio; runas são raras.
export const OBJECTIVES = { kill:3, lever:2, orb:2, survive:2, key:2, runes:1 };
function weighted(pool, rand) {
  let t = rand() * Object.values(pool).reduce((a, b) => a + b, 0);
  for (const [k, w] of Object.entries(pool)) if ((t -= w) <= 0) return k;
  return Object.keys(pool)[0];
}
// Tudo o que fica dentro da planta: desafio de cada corredor, pedras, poças do tema, objetivo de cada sala,
// armadilhas de pressão, pontos de emboscada e a parede do beco secreto. Todo objeto interativo nasce num ponto
// alcançável (dentro da sala com folga, fora das pedras e das poças).
export function planDungeon(zones, paths, rand, { lava = false, pools = true } = {}) {
  // Desafios: o primeiro corredor é sempre o abismo; portão de runas só às vezes (no máximo um).
  const chs = paths.filter(p => p.ch);
  const rest = shuffle(lava ? ['lavaflow', 'spikes', 'lavaflow', 'gap'] : ['spikes', 'gap', 'spikes', 'gap'], rand);
  if (rand() < 0.35) rest[Math.floor(rand() * rest.length)] = 'gate';
  chs.forEach((p, i) => { p.kind = i === 0 ? 'gap' : rest[(i - 1) % rest.length]; });
  const hasGate = chs.some(p => p.kind === 'gate');

  const obstacles = [], hazards = [];
  for (const zn of zones) {
    zn.taken = [];
    const lanes = paths.filter(p => p.zones.includes(zn));
    if (zn.kind === 'arena') for (let k = 0, n = 2 + Math.floor(rand() * 3) + (zn.side ? 0 : 1); k < n; k++) {
      const o = freeSpot(zn, rand, zn.taken, 1.1 + rand() * 0.7, { pad:2.5, lanes, core:true, tries:40 }); if (o) obstacles.push(o);
    }
    zn.reach = reachGrid(zn, zn.taken);
    if (pools && (zn.kind === 'arena' || zn.kind === 'boss')) for (let k = 0; k < 2; k++) {
      const h = freeSpot(zn, rand, zn.taken, 1.6 + rand() * 0.8, { pad:1, core:true, tries:30 }); if (h) hazards.push({ ...h, zone:zn });
    }
  }

  // Objetivos das arenas da cadeia principal.
  const main = zones.filter(z => z.kind === 'arena' && !z.side).sort((a, b) => a.i - b.i);
  const mini = main[1 + Math.floor(rand() * Math.max(1, main.length - 2))];
  const pool = { ...OBJECTIVES }; if (hasGate) delete pool.runes;
  for (const zn of main) {
    if (zn === mini) { zn.obj = { type:'mini' }; continue; }
    // Sala apertada demais para o objetivo sorteado: desfaz e sorteia outro (matar todos sempre cabe).
    for (;;) {
      const type = weighted(pool, rand), mark = zn.taken.length; delete pool[type];
      zn.obj = { type, spots:[] };
      const spot = (r, far) => { const s = freeSpot(zn, rand, zn.taken, r, { pad:1.2, far }); if (s) zn.obj.spots.push(s); return s; };
      const sep = Math.max(9, (zn.sr ?? zn.r) * 0.7);
      if (type === 'lever') { const a = spot(0.9); spot(0.9, a && [{ ...a, d:sep }]); }
      if (type === 'orb') { const a = spot(0.8); spot(1.1, a && [{ ...a, d:sep }]); }
      if (type === 'runes') for (let k = 0; k < 3; k++) spot(0.85, zn.obj.spots.map(s => ({ ...s, d:6 })));
      if (zn.obj.spots.length >= ({ lever:2, orb:2, runes:3 }[type] ?? 0) || !Object.keys(pool).length) break;
      zn.taken.length = mark;
    }
  }
  for (const zn of zones) if (zn.side) zn.obj = zn.secret ? { type:'secret', spots:[freeSpot(zn, rand, zn.taken, 1.2, { pad:1 })].filter(Boolean) } : { type:'kill', spots:[] };

  // Armadilhas de pressão: duas por arena principal (menos na do mini-chefe).
  const traps = [];
  for (const zn of main) for (let k = 0, n = zn === mini ? 1 : 2; k < n; k++) { const t = freeSpot(zn, rand, zn.taken, 0.9, { pad:1.5 }); if (t) traps.push({ ...t, zone:zn }); }

  // Portão: 3 runas na sala anterior ao corredor.
  const runes = [];
  for (const p of chs) if (p.kind === 'gate') {
    const zn = p.zones[0];
    const got = [];
    for (let k = 0; k < 3; k++) { const s = freeSpot(zn, rand, zn.taken, 0.85, { pad:1.2, far:got.map(r => ({ ...r, d:6 })) }); if (s) got.push({ ...s, path:p }); }
    if (got.length === 3) runes.push(...got); else p.kind = 'spikes'; // sem espaço para as runas: vira espinhos
  }

  // Emboscadas: no trecho livre de corredores principais (nunca no primeiro).
  const ambush = [];
  const links = [...new Set(paths.filter(p => p.main).map(p => p.zones))].slice(1);
  for (const zs of shuffle(links, rand)) {
    if (ambush.length >= 2) break;
    let best = null;
    for (const p of paths) if (p.zones === zs) {
      const len = Math.hypot(p.bx - p.ax, p.bz - p.az), mid = p.ch ? (p.ta + p.tb) / 2 : -99;
      for (let t = 0; t <= len; t += 1) {
        if (Math.abs(t - mid) < 4.5) continue; // longe do desafio do corredor
        const x = p.ax + (p.bx - p.ax) * t / len, z = p.az + (p.bz - p.az) * t / len, d = Math.min(...zs.map(zn => roomD(zn, x, z)));
        if (d > 2.5 && (!best || d > best.d)) best = { x, z, d };
      }
    }
    if (best) ambush.push({ x:best.x, z:best.z });
  }

  // Beco secreto: parede rachada logo na saída da sala de onde ele parte.
  let secret = null;
  const sz = zones.find(z => z.secret);
  if (sz) {
    const host = paths.find(p => p.zones.includes(sz)).zones.find(z => z !== sz);
    const seg = paths.find(p => p.zones.includes(sz) && (roomD(host, p.ax, p.az) < 0) !== (roomD(host, p.bx, p.bz) < 0));
    if (seg) {
      const [sx, sz2, ex, ez] = roomD(host, seg.ax, seg.az) < 0 ? [seg.ax, seg.az, seg.bx, seg.bz] : [seg.bx, seg.bz, seg.ax, seg.az];
      const len = Math.hypot(ex - sx, ez - sz2), dx = (ex - sx) / len, dz = (ez - sz2) / len;
      let t = 0; while (t < len && roomD(host, sx + dx * t, sz2 + dz * t) < 1.5) t += 0.25;
      secret = { x:sx + dx * t, z:sz2 + dz * t, dx, dz, w:seg.w, room:sz };
      sz.cleared = true; // sala do tesouro: não tranca nem tem inimigos
    }
    if (!secret) { sz.secret = false; sz.obj = { type:'kill', spots:[] }; }
  }
  return { obstacles, hazards, traps, runes, ambush, secret };
}
