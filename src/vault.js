// Tela do baú: cena 3D própria com suspense (tremidas, luz vazando), abertura e revelação item a item.
// Usa o mesmo renderer/composer do jogo e o mesmo número de luzes, então reaproveita os shaders já compilados.
import * as THREE from 'three';
import * as M from './models.js';
import { RARITIES, RARITY } from './core.js';
import * as UI from './ui.js';

export function createVault({ renderer, composer, renderPass, env, shadows, sfx }) {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 120);
  scene.background = new THREE.Color(0x0a0716); scene.fog = new THREE.Fog(0x0a0716, 60, 120);
  scene.environment = env; scene.environmentIntensity = 0.3;
  scene.add(new THREE.HemisphereLight(0x9a8bff, 0x150a24, 0.8));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.2); key.position.set(4, 9, 6); key.castShadow = shadows; key.shadow.mapSize.set(512, 512);
  Object.assign(key.shadow.camera, { left:-6, right:6, top:6, bottom:-6, near:1, far:30 });
  const rim = new THREE.DirectionalLight(0x7fe9ff, 1.0); rim.position.set(-6, 5, -6);
  scene.add(key, rim);
  cam.position.set(0, 4.2, 10); cam.lookAt(0, 1.9, 0);

  // Palco: plataforma, anel rúnico, pilares com cristais.
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 0.4, 48), M.mat(0x2a2440, { roughness:0.9 })); floor.position.y = -0.2; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3, 3.2, 64), M.glow(0xb45cff, 1.5)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; scene.add(ring);
  const crystals = [];
  // Pilares só atrás do baú, para nunca tapar a vista.
  for (let i = 0; i < 6; i++) {
    const a = 0.15 * Math.PI + i / 5 * 0.7 * Math.PI, x = Math.cos(a) * 6, z = -Math.sin(a) * 5 - 0.5;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.4, 0.7), M.mat(0x3a3358)); p.position.set(x, 1.7, z); p.castShadow = true; scene.add(p);
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), M.glow(0x9a7bff, 3)); c.position.set(x, 4, z); scene.add(c); crystals.push(c);
  }

  // Baú: o mesmo do mundo (dourado KayKit), maior. Uma fresta de luz na tampa mostra a cor que vem.
  // O baú é montado na primeira abertura (o modelo KayKit carrega depois desta cena ser criada).
  let chest = null;
  const seam = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 1.8), M.additive(0xffffff, 0)); seam.position.y = 0.66;
  function ensureChest() {
    const kk = M.hasModel('chest_gold');
    if (chest && chest.kk === kk) return;
    chest?.group.removeFromParent();
    chest = M.createChest(); chest.kk = kk; scene.add(chest.group); chest.group.scale.setScalar(1.6); chest.group.add(seam);
  }
  const rays = new THREE.Group(); rays.position.y = 1.2; scene.add(rays);
  for (let i = 0; i < 10; i++) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 9).translate(0, 4.5, 0), M.additive(0xffffff, 0.35, { side:THREE.DoubleSide, map:M.dotTex }));
    r.rotation.set(0, i / 10 * Math.PI, (i % 2 ? 1 : -1) * (0.15 + (i % 3) * 0.12)); rays.add(r);
  }
  rays.visible = false;
  const burst = new M.Burst(500); scene.add(burst.points);
  const sparkle = new M.Sparks({ count:40, color:0xc8a8ff, size:0.12, life:[1, 2.5],
    spawn:o => o.set((Math.random() - 0.5) * 10, Math.random() * 1.5, (Math.random() - 0.5) * 6 - 1), vel:o => o.set(0, 0.3 + Math.random() * 0.4, 0) });
  scene.add(sparkle.points);
  const holder = new THREE.Group(); scene.add(holder);

  let gen = null, wait = 0, tap = false, active = false, camShake = 0, T = 0;
  const rankOf = it => RARITY[it.rarity].rank, colorOf = rank => RARITIES[rank].color;

  function* sequence(items, done) {
    const sorted = [...items].sort((a, b) => rankOf(a) - rankOf(b)), best = rankOf(sorted.at(-1));
    chest.lid.rotation.x = 0; chest.beam.material.opacity = 0; chest.shock.material.opacity = 0; rays.visible = false; seam.material.opacity = 0;
    UI.vaultShow(); UI.vaultHint('Toque para abrir o baú');
    tap = false; while (!tap) yield 0; tap = false; UI.vaultHint(null);

    // Suspense: três tremidas; a luz da fresta sobe a escada de raridade até a melhor.
    const steps = best >= 4 ? [1, 3, 4] : best >= 2 ? [0, 1, best] : best === 1 ? [0, 0, 1] : [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const col = colorOf(steps[i]); seam.material.color.set(col).multiplyScalar(2.5);
      sfx('latch');
      for (let t = 0; t < 0.55; t += DT()) {
        chest.group.rotation.z = Math.sin(t * 50) * 0.035 * (i + 1); chest.group.position.y = Math.abs(Math.sin(t * 25)) * 0.06 * (i + 1);
        seam.material.opacity = Math.min(1, 0.25 + (t / 0.55) * 0.35 * (i + 1));
        yield 0;
      }
      chest.group.rotation.z = 0; chest.group.position.y = 0;
      burst.emit(new THREE.Vector3(0, 1.4, 0), col, 10 + i * 12, 4, 0.7, 3);
      yield 0.32;
    }

    // Abre.
    const bestCol = colorOf(best);
    sfx('chestOpen'); sfx(best >= 2 ? 'victory' : 'loot'); UI.vaultFlash('#' + bestCol.toString(16).padStart(6, '0')); camShake = 0.25 + best * 0.15;
    chest.beam.material.color.set(bestCol); rays.visible = true; rays.children.forEach(r => r.material.color.set(bestCol).multiplyScalar(1.5));
    burst.emit(new THREE.Vector3(0, 1.5, 0), bestCol, 60 + best * 40, 9, 1, 5);
    for (let t = 0; t < 0.4; t += DT()) {
      const k = t / 0.4; chest.lid.rotation.x = -2.1 * (1 - Math.pow(1 - k, 3));
      chest.beam.scale.set(0.18 + best * 0.05, 1, 0.18 + best * 0.05); chest.beam.material.opacity = 0.12 + best * 0.04;
      seam.material.opacity = 1 - k; yield 0;
    }

    // Revela do pior para o melhor; cada toque mostra o próximo.
    const shown = [];
    for (let i = 0; i < sorted.length; i++) {
      const it = sorted[i], rk = rankOf(it), col = colorOf(rk);
      const g = new THREE.Group(), model = M.createItemModel(it); model.scale.setScalar(it.slot === 'arma' ? 1.2 : 1.4); g.add(model);
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 40), M.additive(new THREE.Color(col).multiplyScalar(2), 0.9)); halo.rotation.x = -Math.PI / 2; halo.position.y = -0.3; g.add(halo);
      holder.add(g); shown.push(g);
      chest.beam.material.color.set(col);
      sfx(rk >= 3 ? 'victory' : rk >= 2 ? 'loot' : 'coin');
      if (rk >= 2) { burst.emit(new THREE.Vector3(0, 3.4, 0), col, 40 + rk * 25, 7, 0.9, 4); UI.vaultFlash('#' + col.toString(16).padStart(6, '0')); camShake = 0.15 * rk; }
      // Mítico: tremor forte, segunda explosão de partículas, tela carmesim e som próprio.
      if (rk >= 4) { camShake = 1.1; burst.emit(new THREE.Vector3(0, 1.5, 0), 0xff6080, 120, 11, 1.2, 5); UI.mythicFlash(); sfx('mythic'); }
      UI.vaultCard(it, i, sorted.length);
      for (let t = 0; t < 0.55; t += DT()) { const k = t / 0.55; g.position.set(0, 1 + 2.6 * (1 - Math.pow(1 - k, 3)), 0.6); g.scale.setScalar(0.3 + 0.7 * k); yield 0; }
      tap = false; while (!tap) yield 0; tap = false;
      const tx = (i - (sorted.length - 1) / 2) * 2.6;
      for (let t = 0; t < 0.3; t += DT()) { const k = t / 0.3; g.position.lerp(new THREE.Vector3(tx, 1.2, 2.2), k); g.scale.setScalar(1 - 0.35 * k); yield 0; }
    }
    // Reposiciona todos lado a lado e mostra o resumo.
    shown.forEach((g, i) => g.position.set((i - (shown.length - 1) / 2) * 2.6, 1.2, 2.2));
    UI.vaultCard(null); UI.vaultSummary(sorted);
    tap = false; while (!tap) yield 0; tap = false;
    UI.vaultHide(); active = false;
    for (const g of shown) { g.removeFromParent(); M.disposeTree(g); }
    rays.visible = false; chest.beam.material.opacity = 0;
    done?.();
  }

  let dtNow = 1 / 60;
  const DT = () => dtNow;
  return {
    get active() { return active; },
    tap() { tap = true; },
    open(items, done) { ensureChest(); active = true; gen = sequence(items, done); wait = 0; },
    update(dt) {
      dtNow = dt; T += dt;
      if (gen) { wait -= dt; if (wait <= 0) { const r = gen.next(); if (r.done) gen = null; else wait = r.value; } }
      for (const g of holder.children) { g.children[0].rotation.y += dt * 1.6; }
      crystals.forEach((c, i) => { c.rotation.y = T + i; c.position.y = 4 + Math.sin(T * 1.5 + i) * 0.15; });
      rays.rotation.y += dt * 0.3; ring.rotation.z += dt * 0.2;
      if (chest) chest.shock.material.opacity = 0;
      burst.update(dt); sparkle.update(dt);
      const s = camShake > 0 ? (camShake -= dt, camShake * 0.25) : 0;
      cam.position.set((Math.random() - 0.5) * s, 4.2 + (Math.random() - 0.5) * s, 10); cam.lookAt(0, 1.9, 0);
    },
    render(bloomOn) {
      if (!bloomOn) { renderer.render(scene, cam); return; }
      const s0 = renderPass.scene, c0 = renderPass.camera;
      renderPass.scene = scene; renderPass.camera = cam; composer.render();
      renderPass.scene = s0; renderPass.camera = c0;
    },
    resize() { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); },
    // Compila e desenha uma vez no carregamento para a primeira abertura não travar.
    prewarm(bloomOn) {
      ensureChest();
      const rt = bloomOn ? new THREE.WebGLRenderTarget(64, 64, { type:THREE.HalfFloatType }) : null;
      renderer.setRenderTarget(bloomOn ? composer.readBuffer : null); renderer.compile(scene, cam);
      renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null); rt?.dispose();
    },
  };
}
