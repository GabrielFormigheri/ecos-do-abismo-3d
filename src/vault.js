// Tela do baú: cena 3D própria com suspense (tremidas, luz vazando), abertura e revelação item a item.
// Usa o mesmo renderer/composer do jogo e o mesmo número de luzes, então reaproveita os shaders já compilados.
import * as THREE from 'three';
import * as M from './models.js';
import { RARITIES, RARITY } from './core.js';
import * as UI from './ui.js';
import { surface } from './art-direction.js';

export function createVault({ renderer, composer, renderPass, env, shadows, sfx }) {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 120);
  scene.background = new THREE.Color(0x0a0716); scene.fog = new THREE.Fog(0x0a0716, 60, 120);
  scene.environment = env; scene.environmentIntensity = 0.3;
  const hemi = new THREE.HemisphereLight(0x9a8bff, 0x150a24, 0.8); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d8, 2.2); key.position.set(4, 9, 6); key.castShadow = shadows; key.shadow.mapSize.set(512, 512);
  Object.assign(key.shadow.camera, { left:-6, right:6, top:6, bottom:-6, near:1, far:30 });
  const rim = new THREE.DirectionalLight(0x7fe9ff, 1.0); rim.position.set(-6, 5, -6);
  scene.add(key, rim);
  cam.position.set(0, 4.2, 10); cam.lookAt(0, 1.9, 0);

  // Palco liso: chão escuro e um foco de luz suave embaixo do baú (sem anéis nem cristais).
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 0.4, 64), M.mat(0x231d36, { roughness:0.85, flatShading:false })); floor.position.y = -0.2; floor.receiveShadow = true; scene.add(floor);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.6, 48), M.additive(0xb8a8ff, 0.22, { map:M.dotTex })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.02; scene.add(pool);
  // Clarão da abertura: luz macia atrás do baú na cor da melhor raridade, cresce e some.
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map:M.dotTex, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false })); flare.position.set(0, 1.6, -0.6); scene.add(flare);
  let flareK = 0;

  // Cenário atrás do baú (montado na primeira abertura, quando as texturas de pedra já carregaram).
  // Câmara do tesouro: parede de pedra em arco, colunas, tochas, moedas (escolhida pelo dono entre 3 opções).
  let backdrop = null;
  const uvScale = (geo, sx, sy) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); return geo; };
  const glowSprite = (color, size, x, y, z, g) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:M.dotTex, color, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false })); s.scale.setScalar(size); s.position.set(x, y, z); g.add(s); return s; };
  const prop = (name, s, x, y, z, ry, g) => { const p = M.propScene(name); if (!p) return null; p.scale.setScalar(s); p.position.set(x, y, z); p.rotation.y = ry; p.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); g.add(p); return p; };
  // Coluna torneada (perfil girado): base, fuste e capitel lisos.
  const column = (h, r, m, x, z, g) => {
    const P = [[r * 1.5, 0], [r * 1.5, 0.25], [r * 1.15, 0.35], [r, 0.5], [r * 0.9, h - 0.6], [r * 1.1, h - 0.45], [r * 1.45, h - 0.25], [r * 1.45, h], [0, h]].map(([a, b]) => new THREE.Vector2(a, b));
    const c = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0, 0), ...P], 28), m); c.position.set(x, 0, z); c.castShadow = c.receiveShadow = true; g.add(c); return c;
  };
  function buildBackdrop() {
    const g = new THREE.Group(), stone = surface('rock', { color:0x8a8494 }), paving = surface('paving', { color:0x9a92a8 });
    const ground = new THREE.Mesh(uvScale(new THREE.CircleGeometry(16, 64), 7, 7), paving); ground.rotation.x = -Math.PI / 2; ground.position.y = 0.005; ground.receiveShadow = true; g.add(ground);
    {
      const wall = new THREE.Mesh(uvScale(new THREE.CylinderGeometry(7.5, 7.5, 8, 64, 1, true, Math.PI / 2, Math.PI), 6, 2), surface('rock', { color:0x6a6470, side:THREE.BackSide })); wall.position.set(0, 4, -0.5); wall.receiveShadow = true; g.add(wall);
      for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + (i + 0.5) / 5 * Math.PI; column(6.2, 0.38, stone, Math.sin(a) * 6.9, Math.cos(a) * 6.9 - 0.5, g); }
      for (const s of [-1, 1]) {
        const t = prop('torch_lit', 1.6, s * 3.9, 2.6, -5.5, 0, g); if (t) t.rotation.z = s * 0.25;
        glowSprite(0xffa040, 1.9, s * 3.95, 3.9, -5.3, g);
        prop('coin_stack_large', 1.2, s * 3.6, 0, -1.2, s * 0.6, g);
      }
      prop('sword_shield_gold', 1.0, -4.6, 0.8, -2.6, 0.5, g); prop('barrel_large', 0.7, 4.9, 0, -2.8, 0, g);
      Object.assign(scene, { background:new THREE.Color(0x120a08) }); scene.fog.color.set(0x120a08);
      hemi.color.set(0xffd2a0); hemi.groundColor.set(0x1a0e08); pool.material.color.set(0xffc080);
    }
    return g;
  }
  function setBackdrop() { backdrop = buildBackdrop(); scene.add(backdrop); floor.visible = false; }

  // Baú: o mesmo do mundo (dourado KayKit), maior. Uma fresta de luz na tampa mostra a cor que vem.
  // O baú é montado na primeira abertura (o modelo KayKit carrega depois desta cena ser criada).
  let chest = null;
  const seam = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 1.8), M.additive(0xffffff, 0)); seam.position.y = 0.66;
  function ensureChest() {
    const kk = M.hasModel('chest_gold');
    if (!backdrop) setBackdrop();
    if (chest && chest.kk === kk) return;
    chest?.group.removeFromParent();
    chest = M.createChest(); chest.kk = kk; scene.add(chest.group); chest.group.scale.setScalar(1.6); chest.group.add(seam);
  }
  const rays = new THREE.Group(); rays.position.y = 1.2; scene.add(rays);
  for (let i = 0; i < 10; i++) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 9).translate(0, 4.5, 0), M.additive(0xffffff, 0.16, { side:THREE.DoubleSide, map:M.dotTex }));
    r.rotation.set(0, i / 10 * Math.PI, (i % 2 ? 1 : -1) * (0.15 + (i % 3) * 0.12)); rays.add(r);
  }
  rays.visible = false;
  const burst = new M.Burst(500); scene.add(burst.points);
  const sparkle = new M.Sparks({ count:40, color:0xc8a8ff, size:0.12, life:[1, 2.5],
    spawn:o => o.set((Math.random() - 0.5) * 10, Math.random() * 1.5, (Math.random() - 0.5) * 6 - 1), vel:o => o.set(0, 0.3 + Math.random() * 0.4, 0) });
  scene.add(sparkle.points);

  let gen = null, wait = 0, tap = false, active = false, camShake = 0, T = 0;
  const rankOf = it => RARITY[it.rarity].rank, colorOf = rank => RARITIES[rank].color;

  function* sequence(items, done) {
    const sorted = [...items].sort((a, b) => rankOf(a) - rankOf(b)), best = rankOf(sorted.at(-1));
    chest.lid.rotation.x = 0; chest.beam.material.opacity = 0; chest.shock.material.opacity = 0; rays.visible = false; seam.material.opacity = 0; flareK = 0;
    UI.vaultShow(items); UI.vaultHint('Toque para abrir o baú');
    tap = false; while (!tap) yield 0; tap = false; UI.vaultHint(null);

    // Suspense: três tremidas; a luz da fresta sobe a escada de raridade até a melhor.
    const steps = best >= 4 ? [1, 3, 4] : best >= 2 ? [0, 1, best] : best === 1 ? [0, 0, 1] : [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const col = colorOf(steps[i]); seam.material.color.set(col).multiplyScalar(2.5);
      sfx('latch');
      for (let t = 0; t < 0.55; t += DT()) {
        chest.group.rotation.z = Math.sin(t * 50) * 0.035 * (i + 1); chest.group.position.y = Math.abs(Math.sin(t * 25)) * 0.06 * (i + 1);
        chest.lid.rotation.x = -Math.sin(t / 0.55 * Math.PI) * 0.08 * (i + 1); // a tampa espia e fecha
        seam.material.opacity = Math.min(1, 0.25 + (t / 0.55) * 0.35 * (i + 1));
        yield 0;
      }
      chest.group.rotation.z = 0; chest.group.position.y = 0; chest.lid.rotation.x = 0;
      burst.emit(new THREE.Vector3(0, 1.4, 0), col, 10 + i * 12, 4, 0.7, 3);
      yield 0.32;
    }

    // Abre.
    const bestCol = colorOf(best);
    sfx('chestOpen'); sfx(best >= 2 ? 'victory' : 'loot'); UI.vaultFlash('#' + bestCol.toString(16).padStart(6, '0')); camShake = 0.25 + best * 0.15;
    chest.beam.material.color.set(bestCol); rays.visible = true; flare.material.color.set(bestCol); flareK = 1; rays.children.forEach(r => r.material.color.set(bestCol).multiplyScalar(1.5));
    burst.emit(new THREE.Vector3(0, 1.5, 0), bestCol, 60 + best * 40, 9, 1, 5);
    for (let t = 0; t < 0.4; t += DT()) {
      const k = t / 0.4; chest.lid.rotation.x = -2.1 * (1 - Math.pow(1 - k, 3));
      chest.beam.scale.set(0.18 + best * 0.05, 1, 0.18 + best * 0.05); chest.beam.material.opacity = 0.12 + best * 0.04;
      seam.material.opacity = 1 - k; yield 0;
    }

    // Revela do pior para o melhor em cartões; cada toque guarda o cartão na fileira de cima e mostra o próximo.
    for (let i = 0; i < sorted.length; i++) {
      const it = sorted[i], rk = rankOf(it), col = colorOf(rk);
      chest.beam.material.color.set(col);
      sfx(rk >= 3 ? 'victory' : rk >= 2 ? 'loot' : 'coin');
      if (rk >= 2) { burst.emit(new THREE.Vector3(0, 3.4, 0), col, 40 + rk * 25, 7, 0.9, 4); UI.vaultFlash('#' + col.toString(16).padStart(6, '0')); camShake = 0.15 * rk; }
      // Mítico: tremor forte, segunda explosão de partículas, tela carmesim e som próprio.
      if (rk >= 4) { camShake = 1.1; burst.emit(new THREE.Vector3(0, 1.5, 0), 0xff6080, 120, 11, 1.2, 5); UI.mythicFlash(); sfx('mythic'); }
      UI.vaultCard(it, i, sorted.length);
      yield 0.45;
      tap = false; while (!tap) yield 0; tap = false;
      UI.vaultCollect(it);
    }
    UI.vaultCard(null); UI.vaultSummary(sorted);
    tap = false; while (!tap) yield 0; tap = false;
    UI.vaultHide(); active = false;
    rays.visible = false; chest.beam.material.opacity = 0;
    done?.();
  }

  // Tela em pé (celular): câmera mais longe para o baú e as tochas caberem na largura.
  let dtNow = 1 / 60, camZ = 10 + Math.max(0, 1.1 - cam.aspect) * 8;
  const DT = () => dtNow;
  return {
    get active() { return active; },
    tap() { tap = true; },
    open(items, done) { ensureChest(); active = true; gen = sequence(items, done); wait = 0; },
    update(dt) {
      dtNow = dt; T += dt;
      if (gen) { wait -= dt; if (wait <= 0) { const r = gen.next(); if (r.done) gen = null; else wait = r.value; } }
      rays.rotation.y += dt * 0.3;
      if (flareK > 0) { flareK = Math.max(0, flareK - dt * 0.9); flare.material.opacity = flareK * 0.85; flare.scale.setScalar(3 + (1 - flareK) * 8); }
      if (chest) chest.shock.material.opacity = 0;
      burst.update(dt); sparkle.update(dt);
      const s = camShake > 0 ? (camShake -= dt, camShake * 0.25) : 0;
      cam.position.set((Math.random() - 0.5) * s, 4.2 + (Math.random() - 0.5) * s, camZ); cam.lookAt(0, 1.9, 0);
    },
    render(bloomOn) {
      if (!bloomOn) { renderer.render(scene, cam); return; }
      const s0 = renderPass.scene, c0 = renderPass.camera;
      try { renderPass.scene = scene; renderPass.camera = cam; composer.render(); }
      finally { renderPass.scene = s0; renderPass.camera = c0; }
    },
    resize() { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); camZ = 10 + Math.max(0, 1.1 - cam.aspect) * 8; },
    // Compila e desenha uma vez no carregamento para a primeira abertura não travar.
    prewarm(bloomOn) {
      ensureChest();
      const previousTarget = renderer.getRenderTarget();
      const rt = new THREE.WebGLRenderTarget(64, 64, { type:bloomOn ? THREE.HalfFloatType : THREE.UnsignedByteType });
      try {
        renderer.setRenderTarget(bloomOn ? composer.readBuffer : null); renderer.compile(scene, cam);
        renderer.setRenderTarget(rt); renderer.render(scene, cam);
      } finally { renderer.setRenderTarget(previousTarget); rt.dispose(); }
    },
  };
}
