import { loadHubArt } from './hub-art.js';
import { loadSurfaces } from './art-direction.js';
import { bowPhase, createBowPose, createAxePose } from './hero-animation.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as C from './core.js';
import * as S from './story.js';
import * as M from './models.js';
import { buildHub, buildDungeon } from './world.js';
import { Input } from './input.js';
import * as UI from './ui.js';
import { GameAudio } from '../audio.js';
import { createVault } from './vault.js';
import { pumpThumbs } from './thumbs.js';
import { Sound } from './sound.js';

// ---------- save ----------
const SAVE_KEY = 'ecos3d-save';
let save;
try { save = C.deserialize(localStorage.getItem(SAVE_KEY) ?? ''); } catch { save = C.newSave(); }
S.cleanStory(save);
const persist = () => { try { localStorage.setItem(SAVE_KEY, C.serialize(save)); } catch { /* modo privado: segue sem salvar */ } };
let stats = C.playerStats(save);

// ---------- render ----------
const HI = save.settings.quality === 'alto';
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// Resolução começa moderada e se ajusta ao FPS medido (ver adapt()).
const PR_MAX = Math.min(devicePixelRatio, HI ? (TOUCH ? 1.5 : 1.75) : 1);
let PR = Math.min(PR_MAX, TOUCH ? 1 : 1.25), bloomOn = HI;
const renderer = new THREE.WebGLRenderer({ antialias:HI && !TOUCH, powerPreference:'high-performance' });
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = HI; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').prepend(renderer.domElement);

const scene = new THREE.Scene(); M.setScene(scene);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 600);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.6, 0.4, 0.92);
composer.addPass(bloom); composer.addPass(new OutputPass());

// Número fixo de luzes: trocar luzes recompila todos os shaders (causava travadas).
const hemi = new THREE.HemisphereLight(0xe4f3ff, 0x4f6e37, 0.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dd, 2.4);
sun.castShadow = HI; sun.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048); sun.shadow.bias = -0.00018; sun.shadow.normalBias = .025;
Object.assign(sun.shadow.camera, { left:-30, right:30, top:30, bottom:-30, near:1, far:90 });
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0x9ab0ff, 0.6); rim.position.set(-5, 6, -8); scene.add(rim);

const input = new Input(renderer.domElement);
const audio = new GameAudio(); audio.enabled = save.settings.sound;
const sound = new Sound(audio, save.settings);
const sfx = k => sound.play(k);
// Som de mob: mais baixo quanto mais longe do jogador.
const sfxAt = (k, p) => sound.play(k, Math.max(0, 1 - dist2(p, P.pos) / 28) * 0.8);
const unlockAudio = () => sound.unlock();
addEventListener('pointerdown', unlockAudio); addEventListener('keydown', unlockAudio);
const burst = new M.Burst();
const vault = createVault({ renderer, composer, renderPass, env:scene.environment, shadows:HI, sfx });
document.getElementById('vault').addEventListener('click', e => { sound.unlock(); if (!e.target.closest('button') || e.target.id === 'vault-take') vault.tap(); });

// ---------- estado ----------
let DT = 0.016, T = 0;
let mode = 'hub', world = null, paused = false, previewSkin = null, showcase = false;
const P = { taken:0, healed:0, pb:{}, regen:null, mythicHits:0, slowT:0, pos:new THREE.Vector3(), y:0, facing:0, hp:stats.hp, iframe:0, dashT:0, dashCd:0, dashDir:new THREE.Vector2(), atkCd:0, cds:[0, 0, 0], buff:{ t:0, atk:0, shield:0, speed:0, lifesteal:0 }, anim:null, busy:false, dead:false, walk:0, moving:0,
  comboI:0, comboT:-9, swing:0, guardT:0, rage:0, rageT:0, perfectT:0, atkBuf:0, drawT:0, dashEnd:-9 };
let hero = null, weapon = null, auraSparks = null, dashTrail = null;
const mobs = [], shots = [], loots = [], orbs = [], cos = [];
let run = null, shake = 0, hitStop = 0, boost = 0, station = null, promptTap = false, camFocus = null, combo = 0, lastKill = -9;
const shakeOff = new THREE.Vector3(), camPos = new THREE.Vector3(0, 15, 14), camLook = new THREE.Vector3();
const V = () => new THREE.Vector3();
const tmp = V(), tmp2 = V(), qTmp = new THREE.Quaternion();
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const hexCol = c => '#' + c.toString(16).padStart(6, '0');

const aura = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.55, 64), M.additive(0xffffff, 0)); aura.rotation.x = -Math.PI / 2; scene.add(aura);
const auraGlow = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), M.additive(0xffffff, 0, { map:M.dotTex })); auraGlow.rotation.x = -Math.PI / 2; scene.add(auraGlow);

// ---------- corrotinas: yield n = espera n segundos (0 = próximo quadro) ----------
function go(gen, owner = null) { cos.push({ gen, wait:0, owner }); }
function updateCos(dt) {
  for (let i = cos.length - 1; i >= 0; i--) {
    const c = cos[i];
    if (c.owner?.dead) { cos.splice(i, 1); continue; }
    if (c.owner?.stun > 0) continue;
    c.wait -= dt; if (c.wait > 0) continue;
    const r = c.gen.next();
    if (r.done) cos.splice(i, 1); else c.wait = r.value;
  }
}
function* fade(obj, dur, fn) {
  for (let t = 0; t < dur; t += DT) { fn(t / dur); yield 0; }
  obj.removeFromParent(); M.disposeTree(obj);
}

// ---------- herói ----------
const IDLE = { espada:[-0.35, 0.12, 0.75], machado:[-0.3, 0.12, 0.6], arco:[-0.45, 0.1, 0.45], cajado:[-0.35, 0.1, 0.35] };
function rebuildHero() {
  stopGather();
  const eq = C.equippedItems(save);
  const keepRot = hero?.root.rotation.y ?? 0;
  hero?.dispose(); weapon?.dispose(); auraSparks?.dispose(); auraSparks = null;
  const look = { cls:save.cls, skin:previewSkin ?? save.skin, armor:eq.armadura?.rarity, armorName:eq.armadura?.name, amulet:eq.amuleto?.rarity, amuletName:eq.amuleto?.name };
  hero = M.heroModelReady(save.cls) ? M.createHeroRig(look) : M.createHero(look);
  hero.root.rotation.y = keepRot;
  dashTrail?.dispose(); dashTrail = new M.Trail(M.SKIN_TRAIL[look.skin] ?? (eq.arma && eq.arma.rarity !== 'comum' ? C.RARITY[eq.arma.rarity].color : 0x9ad8ff), 14);
  weapon = eq.arma ? M.createWeapon(eq.arma.kind, eq.arma.rarity, { variant:C.weaponVariant(eq.arma) }) : null;
  if (weapon) { hero.mount.add(weapon.group); if (hero.isRig && weapon.kind === 'arco') hero.poseBow = createBowPose(THREE, hero, weapon); if (hero.isRig && save.cls === 'berserker' && weapon.kind === 'machado') hero.poseAxe = createAxePose(THREE, hero, weapon); }
  const R = C.RARITY[eq.arma?.rarity ?? 'comum'], auraColor = eq.arma ? M.weaponGlow(eq.arma.rarity, C.weaponVariant(eq.arma)) : R.color;
  aura.material.color.set(auraColor).multiplyScalar(2); aura.material.opacity = [0, 0.25, 0.55, 0.9, 1][R.rank];
  auraGlow.material.color.set(auraColor); auraGlow.material.opacity = [0, 0.15, 0.33, 0.55, 0.8][R.rank];
  // Mítico: aura carmesim mais densa, com brasas que sobem em espiral.
  if (R.rank === 3) auraSparks = new M.Sparks({ count:40, color:auraColor, size:0.12, life:[0.8, 1.8],
    spawn:o => { const a = Math.random() * Math.PI * 2, r = rand(1.2, 1.7); return o.set(P.pos.x + Math.cos(a) * r, 0.05, P.pos.z + Math.sin(a) * r); },
    vel:o => o.set(0, rand(0.8, 2), 0) });
  else if (R.rank === 4) auraSparks = new M.Sparks({ count:70, color:0xff1a3c, size:0.14, life:[0.6, 1.6],
    spawn:o => { const a = Math.random() * Math.PI * 2, r = rand(1.1, 1.8); return o.set(P.pos.x + Math.cos(a) * r, 0.05, P.pos.z + Math.sin(a) * r); },
    vel:o => { const a = Math.random() * Math.PI * 2; return o.set(Math.cos(a) * 0.6, rand(1.2, 2.8), Math.sin(a) * 0.6); } });
  const hpRatio = P.hp / stats.hp;
  stats = C.playerStats(save);
  P.hp = mode === 'hub' ? stats.hp : Math.min(stats.hp, Math.ceil(stats.hp * hpRatio));
  UI.hubBar(save, stats);
}

function weaponColor() { const it = C.equippedItems(save).arma; return it && it.rarity !== 'comum' ? M.weaponGlow(it.rarity, C.weaponVariant(it)) : 0xdfe8ff; }
function weaponRank() { const it = C.equippedItems(save).arma; return it ? C.RARITY[it.rarity].rank : 0; }
const play = (name, dur, extra = {}) => { P.anim = { name, t:0, dur, ...extra }; };

// Herói com esqueleto: cada ação do jogo vira uma animação da KayKit, acelerada para durar o mesmo tempo.
const HERO_IDLE = { guerreiro:'Idle', berserker:'2H_Melee_Idle', arqueiro:'Idle', mago:'Idle' };
let slashFlip = false;
function heroClip(name) {
  if (name === 'slash') { slashFlip = !slashFlip; return save.cls === 'berserker' ? (slashFlip ? '2H_Melee_Attack_Chop' : '2H_Melee_Attack_Slice') : (slashFlip ? '1H_Melee_Attack_Slice_Diagonal' : '1H_Melee_Attack_Chop'); }
  return { mine:'2H_Melee_Attack_Chop', reap:hero.rig?.has('PickUp') ? 'PickUp' : '1H_Melee_Attack_Slice_Diagonal', shoot:'1H_Ranged_Shoot', cast:'Spellcast_Shoot', giro:'2H_Melee_Attack_Spinning', salto:'Jump_Full_Short', chuva:'Spellcast_Raise', meteoro:'Spellcast_Raise' }[name];
}
function animateHeroRig(dt) {
  const r = hero.rig, a = P.anim;
  if (!hero.baseSet) { r.base(HERO_IDLE[save.cls], 'Running_A'); hero.baseSet = true; }
  r.move(P.dashT > 0 ? 1 : P.moving, 1.2 * (1 + (P.buff.t > 0 ? P.buff.speed : 0)));
  if (a && !a.started) { a.started = true; const clip = a.clip ?? heroClip(a.name); if (clip && !(a.name === 'shoot' && hero.poseBow && a.draw != null)) r.once(clip, a.dur, { repeat:a.name === 'giro', impact:a.impact }); }
  if (a) { a.t += dt; if (a.t >= a.dur) P.anim = null; }
  if (hero.poseAxe) { const p = a?.name === 'slash' && P.dashT <= 0 && !P.dead ? Math.min(1, a.t / a.dur) : 0; hero.axeWeight = Math.min(1, p * 8, (1 - p) * 8); }
  if (hero.poseBow) hero.bowPhase = a?.name === 'shoot' && a.draw != null && P.dashT <= 0 && !P.dead ? bowPhase(a.t, a.draw ?? .15, Math.max(.01, a.dur - (a.draw ?? .15)), false) : null;
  if (P.dashT > 0 && !hero.dashing) { hero.dashing = true; r.once('Dodge_Forward', 0.34); } else if (P.dashT <= 0) hero.dashing = false;
  // Inclina o corpo e deixa um rastro vertical (efeito de borrão) durante a esquiva.
  r.model.rotation.x = THREE.MathUtils.lerp(r.model.rotation.x, P.dashT > 0 ? 0.35 : 0, 1 - Math.exp(-dt * 18));
  if (dashTrail) {
    dashTrail.push(tmp.set(P.pos.x, 0.3, P.pos.z), tmp2.set(P.pos.x, 2.9, P.pos.z));
    const m = dashTrail.mesh.material; m.opacity = THREE.MathUtils.lerp(m.opacity, P.dashT > 0 ? 0.85 : 0, 1 - Math.exp(-dt * (P.dashT > 0 ? 40 : 8)));
  }
  if (P.dead && !hero.deadAnim) { hero.deadAnim = true; r.once('Death_A', 0.9, { holdEnd:true }); }
  if (showcase) hero.root.rotation.y += dt * 0.6; else hero.root.rotation.y = P.facing;
  hero.root.position.set(P.pos.x, P.y, P.pos.z);
  if (weapon?.trail) {
    const on = a && (a.name === 'giro' || (a.name === 'slash' && a.t > 0.02 && a.t < a.dur * 0.85));
    const m = weapon.trail.mesh.material; m.opacity = THREE.MathUtils.lerp(m.opacity, on ? 1 : 0, 1 - Math.exp(-dt * (on ? 40 : 10)));
  }
  aura.position.set(P.pos.x, 0.03, P.pos.z); auraGlow.position.set(P.pos.x, 0.02, P.pos.z);
  aura.scale.setScalar(1 + Math.sin(T * 3) * 0.04);
}
function animateHero(dt) {
  if (hero.isRig) return animateHeroRig(dt);
  const kind = C.CLASSES[save.cls].weapon, idle = IDLE[kind];
  const bob = Math.sin(T * 2.2);
  P.walk += dt * 11 * P.moving;
  const sw = Math.sin(P.walk) * P.moving;
  hero.legL.rotation.x = sw * 0.7; hero.legR.rotation.x = -sw * 0.7;
  hero.body.position.y = bob * 0.03 + Math.abs(sw) * 0.06;
  hero.head.rotation.y = P.moving ? 0 : Math.sin(T * 0.7) * 0.12;
  let ax = idle[0] + sw * 0.25, az = idle[1], mx = idle[2], lx = 0.05 - sw * 0.5, spin = 0;
  const a = P.anim;
  if (a) {
    a.t += dt; const p = Math.min(1, a.t / a.dur);
    let w = Math.min(1, (a.dur - a.t) / 0.08); if (a.name !== 'slash') w = Math.min(w, a.t / 0.05);
    w = Math.max(0, w);
    let pose;
    if (a.name === 'slash') { const e = 1 - Math.pow(1 - p, 3); pose = [THREE.MathUtils.lerp(-2.7, 0.45, e), 0.2, THREE.MathUtils.lerp(0.6, 1.9, p), lx]; }
    else if (a.name === 'shoot') pose = [-1.5, 0.05, Math.PI / 2, -1.4];
    else if (a.name === 'cast') pose = [THREE.MathUtils.lerp(-1.9, -1.1, p), 0.1, THREE.MathUtils.lerp(1.6, 1.3, p), lx];
    else if (a.name === 'giro') { pose = [0, 1.45, Math.PI, -0.1]; spin = a.t * 15; }
    else if (a.name === 'salto') pose = [p > 0.8 ? THREE.MathUtils.lerp(-2.9, 0.3, (p - 0.8) / 0.2) : -2.9, 0.15, 1.0, -2.9];
    else if (a.name === 'chuva') pose = [-2.6, 0.1, Math.PI / 2, -0.4];
    else pose = [-2.9, 0.1, 0.4, -0.6];
    ax = THREE.MathUtils.lerp(ax, pose[0], w); az = THREE.MathUtils.lerp(az, pose[1], w); mx = THREE.MathUtils.lerp(mx, pose[2], w); lx = THREE.MathUtils.lerp(lx, pose[3], w);
    if (a.t >= a.dur) P.anim = null;
  }
  hero.armR.rotation.set(ax, 0, az); hero.mount.rotation.x = mx; hero.armL.rotation.set(lx, 0, -0.1);
  if (showcase) hero.root.rotation.y += dt * 0.6;
  else hero.root.rotation.y = P.facing + spin;
  if (hero.cape) hero.cape.rotation.x = 0.15 + Math.sin(T * 1.8) * 0.05 + P.moving * 0.35;
  hero.root.position.set(P.pos.x, P.y, P.pos.z);
  if (P.dead) hero.root.rotation.x = THREE.MathUtils.lerp(hero.root.rotation.x, -Math.PI / 2, 1 - Math.exp(-dt * 6));
  else hero.root.rotation.x = 0;
  if (weapon?.trail) {
    const on = a && (a.name === 'giro' || (a.name === 'slash' && a.t > 0.02 && a.t < a.dur * 0.85));
    const m = weapon.trail.mesh.material; m.opacity = THREE.MathUtils.lerp(m.opacity, on ? 1 : 0, 1 - Math.exp(-dt * (on ? 40 : 10)));
  }
  aura.position.set(P.pos.x, 0.03, P.pos.z); auraGlow.position.set(P.pos.x, 0.02, P.pos.z);
  aura.scale.setScalar(1 + Math.sin(T * 3) * 0.04);
}

// ---------- mundo ----------
const canStand = (x, z, r) => mode === 'dungeon' ? world.canStand(x, z, r, run?.lockedRoom) : world.canStand(x, z, r);
function tryMove(pos, dx, dz, r) {
  let moved = false;
  if (canStand(pos.x + dx, pos.z, r)) { pos.x += dx; moved = true; }
  if (canStand(pos.x, pos.z + dz, r)) { pos.z += dz; moved = true; }
  return moved;
}

const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), aimPt = V();
function nearestMob(range, from = P.pos) {
  let best = null, bd = range;
  for (const m of mobs) { if (m.dead || m.spawnT > 0) continue; const d = dist2(m.pos, from); if (d < bd) { bd = d; best = m; } }
  return best;
}
function aimPoint(range) {
  if (input.mouseAim()) { ndc.set(input.mouse.x, input.mouse.y); ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(groundPlane, aimPt)) return aimPt; }
  const m = nearestMob(range); if (m) return aimPt.set(m.pos.x, 0, m.pos.z);
  return aimPt.set(P.pos.x + Math.sin(P.facing) * 6, 0, P.pos.z + Math.cos(P.facing) * 6);
}
function faceTo(p) { const dx = p.x - P.pos.x, dz = p.z - P.pos.z; if (dx * dx + dz * dz > 0.01) P.facing = Math.atan2(dx, dz); return new THREE.Vector2(Math.sin(P.facing), Math.cos(P.facing)); }

function project(p, y = 2) {
  tmp2.set(p.x, y, p.z).project(camera);
  return [(tmp2.x + 1) / 2 * innerWidth, (1 - tmp2.y) / 2 * innerHeight];
}

// ---------- dano ----------
function hitMob(m, base, { knock = 0, from = P.pos, stun = 0, color = weaponColor(), silent = false, melee = false, heavy = false } = {}) {
  if (m.dead || m.spawnT > 0) return;
  // Execução: golpe pesado em elite/guardião atordoado. Gasta o atordoamento (não dá para emendar).
  const exec = heavy && (m.elite || m.mini) && m.stun > 0.05;
  if (exec) { base *= 2.5; m.stun = 0; stun = 0; hitStop = Math.max(hitStop, 0.14); shake = Math.max(shake, 0.4); boost = Math.max(boost, 0.4); sfx('holyImpact');
    burst.emit(tmp.set(m.pos.x, 1.4, m.pos.z), 0xffd36b, 40, 9, 0.6, 3); const [ex, ey] = project(m.pos, 3 + m.radius); UI.number(ex, ey - 24, 'EXECUÇÃO!', 'crit'); }
  // Corpo a corpo faz o mob tropeçar um instante (elite e guardião só com o golpe pesado).
  if (melee && !m.boss && !m.dummy && (heavy || !(m.elite || m.mini))) stun = Math.max(stun, 0.12);
  if (melee && m.boss) stun = 0; // chefe não trava com o ataque básico
  const crit = Math.random() < stats.crit;
  const amount = Math.max(1, Math.round(base * rand(0.9, 1.1) * (crit ? stats.critMult : 1) * (m.boss ? 1 + stats.bossDmg : 1)));
  m.hp -= amount; m.flash = 0.09; m.showBar = !m.dummy;
  if (m.model.rig && !m.boss && !m.model.rig.busy() && m.hp > 0) m.model.act('hit', 0.28);
  const steal = (P.buff.t > 0 ? P.buff.lifesteal : 0) + stats.lifesteal + (melee ? P.rage * (C.CLASSES[save.cls].rage?.steal ?? 0) : 0);
  if (steal && !P.dead) { P.hp = Math.min(stats.hp, P.hp + amount * steal); P.healed += amount * steal; }
  if (m.dummy) yardHit(m, amount, crit, from);
  else if (!m.boss) { if (knock) { tmp.set(m.pos.x - from.x, 0, m.pos.z - from.z).normalize().multiplyScalar(knock); m.knock.add(tmp); } if (stun) m.stun = Math.max(m.stun, stun); }
  else if (stun) m.stun = Math.max(m.stun, stun * 0.25);
  const [sx, sy] = project(m.pos, 2 + m.radius);
  UI.number(sx + rand(-14, 14), sy, crit ? `${amount}!` : amount, crit ? 'crit' : '');
  burst.emit(tmp.set(m.pos.x, 1.2, m.pos.z), color, crit ? 14 : 7, 4, 0.4, 2);
  if (!silent) sfx(`hit:${m.def.sound ?? m.type}`);
  if (m.hp <= 0) killMob(m);
}

// elem: 'fire' (lava/fogo) ou 'ice' (gelo): os elixires de resistência cortam esse dano.
function hurtPlayer(amount, from, elem = null) {
  if (P.dead || P.iframe > 0 || mode !== 'dungeon' || run?.won || run?.ending) return;
  const guard = P.guardT > 0 ? C.CLASSES[save.cls].guard ?? 0 : 0;
  const dmg = Math.round(amount * rand(0.9, 1.1) * (1 - (P.buff.t > 0 ? P.buff.shield : 0)) * (1 - (elem ? pb(elem) : 0)) * (1 - guard));
  if (guard) burst.emit(tmp.set(P.pos.x + Math.sin(P.facing) * 0.7, 1.4, P.pos.z + Math.cos(P.facing) * 0.7), 0xffe7a0, 12, 4, 0.3, 1.2); // a lâmina apara parte do golpe
  P.hp -= dmg; P.taken += dmg; P.iframe = 0.5; if (dmg > 0) dropCarried();
  const [sx, sy] = project(P.pos, 3.4); UI.number(sx, sy, `-${dmg}`, 'hurt');
  UI.hurtFlash(); sfx('damage'); shake = Math.max(shake, 0.18);
  if (hero.isRig && !P.anim && P.hp > dmg) hero.rig.once('Hit_A', 0.3);
  burst.emit(tmp.set(P.pos.x, 1.5, P.pos.z), 0xff3344, 10, 4, 0.4, 2);
  if (from) { tmp.set(P.pos.x - from.x, 0, P.pos.z - from.z).normalize(); tryMove(P.pos, tmp.x * 0.6, tmp.z * 0.6, 0.5); }
  if (P.hp <= 0) { P.hp = 0; P.dead = true; endRun(false, 'Você caiu na dungeon.'); }
}
const inCircle = (x, z, r) => Math.hypot(P.pos.x - x, P.pos.z - z) < r + 0.4 && P.y < 1;
function inCone(o, dir, r, ang) {
  const dx = P.pos.x - o.x, dz = P.pos.z - o.z, d = Math.hypot(dx, dz);
  if (d > r + 0.4 || d < 1e-3) return false;
  return Math.acos(Math.max(-1, Math.min(1, (dx * dir.x + dz * dir.y) / d))) < ang / 2;
}
// Herói dentro de um aviso inimigo (forma guardada em M.createTelegraph) que já passou de minP do tempo.
function inTele(t, minP = 0) {
  if (!t.shape || t.p < minP) return false;
  const o = t.group.position;
  if (t.shape === 'circle') return inCircle(o.x, o.z, t.r);
  if (t.shape === 'cone') return inCone(o, { x:t.dx, y:t.dz }, t.r, t.angle);
  return inRect(o, { x:t.dx, y:t.dz }, t.w, t.len);
}
const inDanger = (minP = 0) => mobs.some(m => !m.dead && m.teles.some(t => inTele(t, minP))) || (run?.loose ?? []).some(t => inTele(t, minP))
  || shots.some(s => !s.friendly && dist2(s.pos, P.pos) < 2.6 && s.vel.x * (P.pos.x - s.pos.x) + s.vel.z * (P.pos.z - s.pos.z) > 0);

// ---------- ataques do jogador ----------
function melee(range, arc, mult, knock, heavy = false) {
  const dir = new THREE.Vector2(Math.sin(P.facing), Math.cos(P.facing));
  let n = 0;
  for (const m of mobs) {
    if (m.dead || m.spawnT > 0) continue;
    const dx = m.pos.x - P.pos.x, dz = m.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > range + m.radius) continue;
    if (d > m.radius + 0.5 && Math.acos(Math.max(-1, Math.min(1, (dx * dir.x + dz * dir.y) / d))) > arc / 2) continue;
    hitMob(m, ATK() * mult, { knock, stun:heavy ? 0.7 : 0, melee:true, heavy }); n++;
    const k = d > 0.01 ? m.radius * 0.7 / d : 0;
    burst.emit(tmp.set(m.pos.x - dx * k, 1.3, m.pos.z - dz * k), 0xfff1c8, heavy ? 18 : 8, heavy ? 9 : 6, 0.22, heavy ? 1.4 : 0.9);
  }
  slashArc(range, arc);
  return n;
}
function slashArc(range, arc) {
  const g = new THREE.Group(), color = new THREE.Color(weaponColor()).multiplyScalar(1.6);
  const mesh = new THREE.Mesh(M.shared(`slash${range},${arc}`, () => new THREE.RingGeometry(0.6, range, 28, 1, -arc / 2, arc)), M.additive(color, 0.7, { side:THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2; g.add(mesh);
  g.position.set(P.pos.x, 1.0, P.pos.z); g.rotation.y = Math.atan2(-Math.cos(P.facing), Math.sin(P.facing));
  scene.add(g);
  go(fade(g, 0.16, k => { mesh.material.opacity = 0.7 * (1 - k); g.scale.setScalar(0.85 + k * 0.25); }));
}
function friendlyShot(kind, dir, dmg, opts = {}) {
  const color = opts.color ?? weaponColor(), rank = opts.color ? 2 : weaponRank(), orb = kind === 'orb';
  const mesh = new THREE.Mesh(orb ? M.shared(`orb${rank}`, () => new THREE.IcosahedronGeometry(0.3 + rank * 0.05, 1)) : M.shared('arrow', () => new THREE.BoxGeometry(0.12, 0.12, 1.2)), shotMat(color));
  const pos = new THREE.Vector3(P.pos.x + dir.x * 0.9, 1.6, P.pos.z + dir.y * 0.9);
  const speed = opts.speed ?? (orb ? 17 : 30);
  mesh.position.copy(opts.visualFrom ?? pos); mesh.rotation.y = Math.atan2(dir.x, dir.y); scene.add(mesh);
  shots.push({ friendly:true, kind, mesh, pos, vel:new THREE.Vector3(dir.x * speed, 0, dir.y * speed), dmg, life:opts.life ?? (orb ? 13 : 16) / speed, r:orb ? 0.5 : 0.35, color, rank, homing:opts.homing, speed, from:pos.clone(), fall:opts.falloff, visualOffset:opts.visualFrom?.clone().sub(pos), visualTime:0 });
}
const SHOT_MATS = new Map();
const shotMat = color => { let m = SHOT_MATS.get(color); if (!m) SHOT_MATS.set(color, m = M.glow(color, 3)); return m; };
function enemyShot(from, dx, dz, speed, dmg, color, slow = false) {
  const mesh = new THREE.Mesh(M.shared('eshot', () => new THREE.IcosahedronGeometry(0.42, 0)), shotMat(color));
  const pos = new THREE.Vector3(from.x, 1.5, from.z); mesh.position.copy(pos); scene.add(mesh);
  shots.push({ friendly:false, mesh, pos, vel:new THREE.Vector3(dx * speed, 0, dz * speed), dmg, life:4, r:0.35, color, slow });
}
function explode(p, r, dmg, color) {
  for (const m of mobs) if (!m.dead && dist2(m.pos, p) < r + m.radius) hitMob(m, dmg, { knock:3, from:p, color });
  ringFx(p, r, color, 0.3);
  burst.emit(tmp.set(p.x, 0.6, p.z), color, 22, 7, 0.5, 3);
}
function ringFx(p, r, color, dur = 0.35, width = 0.35) {
  const inner = Math.round((1 - width / r) * 20) / 20;
  const mesh = new THREE.Mesh(M.shared(`ring${inner}`, () => new THREE.RingGeometry(inner, 1, 48)), M.additive(new THREE.Color(color).multiplyScalar(2), 0.9));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(p.x, 0.06, p.z); scene.add(mesh);
  go(fade(mesh, dur, k => { mesh.scale.setScalar(Math.max(0.01, r * (0.3 + k * 0.7))); mesh.material.opacity = 0.9 * (1 - k); }));
}

// Combo corpo a corpo: clipes da KayKit (corte, corte, pesado). Depois de uma esquiva, o próximo ataque já sai pesado.
const COMBO_CLIPS = { guerreiro:['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'], berserker:['2H_Melee_Attack_Slice', '1H_Melee_Attack_Slice_Diagonal', '2H_Melee_Attack_Chop'] };
function doAttack() {
  const Cl = C.CLASSES[save.cls];
  if (stats.mythic && (mode === 'dungeon' || yard.on) && ++P.mythicHits >= C.MYTHIC_EVERY) { P.mythicHits = 0; go(MYTHIC_FX[Cl.weapon]()); }
  if (Cl.combo) { go(swing(Cl)); return; }
  // À distância: puxa a corda / conjura antes de soltar (anda devagar; a esquiva cancela).
  const id = ++P.swing, arrow = save.cls === 'arqueiro';
  P.atkCd = Cl.attackCd / (1 + stats.atkSpeed); P.drawT = Cl.draw;
  faceTo(aimPoint(Cl.range + 3)); play(arrow ? 'shoot' : 'cast', Cl.draw + 0.16, { draw:Cl.draw, impact:Cl.draw / (Cl.draw + 0.16) });
  go((function* () {
    yield Cl.draw;
    if (id !== P.swing || P.dead) return;
    const dir = faceTo(aimPoint(Cl.range + 3));
    if (arrow) { friendlyShot('arrow', dir, ATK() * Cl.mult, { falloff:Cl.falloff, visualFrom:hero.poseBow ? weapon?.nockWorld : undefined }); sfx('archer'); }
    else { friendlyShot('orb', dir, ATK() * Cl.mult, { visualFrom:weapon?.tw }); sfx('mage'); }
  })());
}
function* swing(Cl) {
  if (T - P.comboT > 0.55) P.comboI = 0; // parou de bater: o combo recomeça
  const spd = 1 + stats.atkSpeed, i = T - P.dashEnd < 0.3 ? Cl.combo.length - 1 : P.comboI, h = Cl.combo[i], id = ++P.swing;
  P.comboI = (i + 1) % Cl.combo.length; P.atkCd = h.t / spd; P.comboT = T + P.atkCd;
  if (Cl.guard) P.guardT = P.atkCd + 0.2;
  // Gira para o inimigo mais perto e dá um passo até ele (o golpe "gruda" no alvo).
  const tgt = nearestMob(h.range + Cl.lunge + 2.5);
  faceTo(tgt ? tgt.pos : aimPoint(h.range + 3));
  const wind = (h.heavy ? 0.2 : 0.11) / spd;
  play('slash', h.t * 1.35 / spd, { clip:COMBO_CLIPS[save.cls]?.[i], impact:wind / (h.t * 1.35 / spd) });
  sfx(save.cls === 'berserker' ? 'berserker' : 'lancer');
  const lunge = tgt ? Math.max(0, Math.min(Cl.lunge * (h.heavy ? 1.3 : 1), dist2(tgt.pos, P.pos) - tgt.radius - 1.2)) : 0;
  for (let t = 0; t < wind; t += DT) {
    if (id !== P.swing || P.dead) return;
    if (lunge && !tgt.dead) { const dir = faceTo(tgt.pos); tryMove(P.pos, dir.x * lunge / wind * DT, dir.y * lunge / wind * DT, 0.5); }
    yield 0;
  }
  if (id !== P.swing || P.dead) return;
  if (tgt && !tgt.dead) faceTo(tgt.pos);
  const n = melee(h.range, h.arc, h.mult, h.heavy ? 6 : 1, h.heavy);
  if (h.heavy) { shake = Math.max(shake, save.cls === 'berserker' ? 0.3 : 0.2); ringFx(P.pos, h.range * 0.8, weaponColor(), 0.25, 0.5); }
  if (!n) return;
  hitStop = Math.max(hitStop, h.heavy ? 0.085 : 0.045);
  if (Cl.rage) {
    const was = P.rage; P.rage = Math.min(Cl.rage.max, P.rage + (h.heavy ? 2 : 1)); P.rageT = Cl.rage.t;
    if (P.rage >= Cl.rage.max && was < Cl.rage.max) { const [rx, ry] = project(P.pos, 4); UI.number(rx, ry, 'FÚRIA MÁXIMA!', 'crit'); burst.emit(tmp.set(P.pos.x, 1.5, P.pos.z), 0xff2a3a, 30, 6, 0.6, 2); }
  }
}

// ---------- habilidades (efeito por "kind"; números vêm de C.SKILLS) ----------
// Fúria do berserker e esquiva perfeita somam ao ataque.
const ATK = () => stats.atk * (1 + (P.buff.t > 0 ? P.buff.atk : 0) + pb('atk') + P.rage * (C.CLASSES[save.cls].rage?.atk ?? 0) + (P.perfectT > 0 ? 0.3 : 0));
const clampTarget = (p, max) => { const d = dist2(p, P.pos); if (d > max) { p.x = P.pos.x + (p.x - P.pos.x) / d * max; p.z = P.pos.z + (p.z - P.pos.z) / d * max; } p.y = 0; return p; };
const castPose = () => save.cls === 'arqueiro' ? 'shoot' : save.cls === 'mago' ? 'cast' : 'slash';
function castSkill(i) {
  const item = C.equippedSkills(save)[i]; if (!item) return;
  const S = C.SKILLS[item.skill], pw = C.skillPower(item);
  P.cds[i] = S.cd * (1 - stats.cdr); sfx(`skill:${item.skill}`); if (mode === 'dungeon') mission('skills');
  go(SKILL_FX[S.kind](S, (k = 1) => ATK() * S.mult * pw * k, S.color ?? weaponColor(), pw));
}
function hitAround(p, r, dmg, opts) { for (const m of mobs) if (!m.dead && dist2(m.pos, p) < r + m.radius) hitMob(m, dmg, opts); }
// Raio em zigue-zague entre dois pontos.
function bolt(a, b, color) {
  const g = new THREE.Group(), m = M.additive(new THREE.Color(color).multiplyScalar(2.5), 1), geo = M.shared('boltSeg', () => new THREE.BoxGeometry(0.16, 0.16, 1));
  let prev = a.clone();
  for (let k = 1; k <= 5; k++) {
    const p = a.clone().lerp(b, k / 5); if (k < 5) p.add(tmp2.set(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6)));
    const seg = new THREE.Mesh(geo, m); seg.position.copy(prev).lerp(p, 0.5); seg.scale.z = prev.distanceTo(p); seg.lookAt(p); g.add(seg); prev = p;
  }
  scene.add(g); go(fade(g, 0.22, k => { m.opacity = 1 - k; }));
}
function spike(x, z, color, delay, h = 2) {
  const mesh = new THREE.Mesh(M.shared('spikeFx', () => new THREE.ConeGeometry(0.55, 1, 5).translate(0, 0.5, 0)), M.mat(color, { flatShading:true }));
  mesh.position.set(x, 0, z); mesh.rotation.set(rand(-0.25, 0.25), rand(0, 6), rand(-0.25, 0.25)); mesh.scale.set(1, 0.01, 1); mesh.castShadow = true; scene.add(mesh);
  go((function* () {
    yield delay;
    for (let t = 0; t < 0.12; t += DT) { mesh.scale.y = h * t / 0.12; yield 0; }
    yield 0.35;
    yield* fade(mesh, 0.35, k => { mesh.scale.y = h * (1 - k); });
  })());
}
function waveMesh(S, color) {
  const holder = new THREE.Group(), c = new THREE.Color(color);
  if (S.fx === 'machado') {
    const spin = new THREE.Group(), axe = M.createWeapon('machado', 'lendario', { fx:false }).group;
    axe.scale.setScalar(2.2); axe.position.y = -2.9; spin.add(axe); holder.add(spin); holder.userData.spin = spin;
  } else if (S.fx === 'flecha') {
    holder.add(new THREE.Mesh(M.shared('bigArrow', () => new THREE.BoxGeometry(0.28, 0.28, 3.2)), M.glow(color, 3)));
  } else if (S.fx === 'fenix') {
    const body = new THREE.Mesh(M.shared('fenixBody', () => new THREE.ConeGeometry(0.7, 3, 6).rotateX(Math.PI / 2)), M.glow(0xffd36b, 3)); holder.add(body);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(M.shared('fenixWing', () => new THREE.BoxGeometry(2.6, 0.1, 1.2).translate(1.3, 0, 0)), M.glow(color, 2.5));
      wing.scale.x = s; wing.position.z = -0.2; holder.add(wing); (holder.userData.wings ??= []).push(wing);
    }
  } else if (S.fx === 'orbe') {
    holder.add(new THREE.Mesh(M.shared('bigOrb', () => new THREE.IcosahedronGeometry(1.6, 1)), M.glow(color, 2.2)));
    holder.add(new THREE.Mesh(M.shared('bigOrbCore', () => new THREE.IcosahedronGeometry(0.9, 0)), M.glow(0xffffff, 4)));
  } else {
    const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2; holder.add(inner);
    const ring = new THREE.Mesh(M.shared(`crescent${S.w}`, () => new THREE.RingGeometry(S.w * 0.35, S.w * 0.55, 24, 1, -1.2, 2.4)), M.additive(c.clone().multiplyScalar(2.2), 0.9, { side:THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; inner.add(ring);
  }
  return holder;
}
function friendlyBurst(p, r, color) { ringFx(p, r, color, 0.4, Math.min(1.2, r * 0.25)); burst.emit(tmp.set(p.x, 0.5, p.z), color, 30, 8, 0.6, 3); }

const SKILL_FX = {
  *spin(S, dmg, color) {
    play('giro', S.dur); P.busy = !S.move;
    for (let h = 0; h < S.hits; h++) { hitAround(P.pos, S.r, dmg(), { knock:S.move ? 1.5 : 4, color }); ringFx(P.pos, S.r, color, 0.25); if (h % 2 === 0) sfx('lancer'); yield S.dur / S.hits; }
    P.busy = false;
  },
  *dash(S, dmg, color) {
    const dir = faceTo(aimPoint(S.len + 2)), hit = new Set(), speed = S.len / 0.25;
    P.iframe = 0.5; P.busy = true; play('slash', 0.3);
    for (let t = 0; t < 0.25; t += DT) {
      tryMove(P.pos, dir.x * speed * DT, dir.y * speed * DT, 0.5);
      for (const m of mobs) if (!m.dead && !hit.has(m) && dist2(m.pos, P.pos) < S.w / 2 + m.radius) { hit.add(m); hitMob(m, dmg(), { knock:6, color }); }
      burst.emit(tmp.set(P.pos.x, 1.2, P.pos.z), color, 4, 1.5, 0.35, 0.6); yield 0;
    }
    P.busy = false; slashArc(3.4, 2.6); sfx('lancer');
  },
  *wave(S, dmg, color) {
    const dir = faceTo(aimPoint(S.range)); play(castPose(), 0.3);
    const obj = waveMesh(S, color), pos = new THREE.Vector3(P.pos.x + dir.x, 1.4, P.pos.z + dir.y);
    obj.position.copy(pos); obj.rotation.y = Math.atan2(dir.x, dir.y); scene.add(obj);
    const hit = new Set(); let dist = 0;
    sfx(S.fx === 'flecha' || S.fx === 'fenix' ? 'archer' : S.fx === 'orbe' ? 'mage' : 'berserker');
    while (dist < S.range) {
      const step = S.speed * DT; pos.x += dir.x * step; pos.z += dir.y * step; dist += step; obj.position.copy(pos);
      if (obj.userData.spin) obj.userData.spin.rotation.x += DT * 16;
      obj.userData.wings?.forEach(w => { w.rotation.z = Math.sin(T * 18) * 0.5 * Math.sign(w.scale.x); });
      if (S.fx === 'orbe') obj.rotation.x += DT * 3;
      for (const m of mobs) if (!m.dead && !hit.has(m) && dist2(m.pos, pos) < S.w / 2 + m.radius) { hit.add(m); hitMob(m, dmg(), { knock:4, from:pos, color }); }
      burst.emit(pos, color, S.fx === 'fenix' ? 5 : 2, 1.5, 0.45, 0.6); yield 0;
    }
    yield* fade(obj, 0.15, k => obj.scale.setScalar(Math.max(0.01, 1 - k)));
  },
  *orbit(S, dmg, color) {
    const rarity = C.equippedItems(save).arma?.rarity ?? 'raro', blades = [], lastHit = new Map();
    for (let k = 0; k < S.count; k++) {
      const holder = new THREE.Group(), w = M.createWeapon('espada', rarity, { fx:false }).group;
      w.rotation.z = -Math.PI / 2; w.scale.setScalar(0.75); holder.add(w); scene.add(holder); blades.push(holder);
    }
    for (let t = 0; t < S.dur; t += DT) {
      blades.forEach((b, k) => {
        const a = t * 4.5 + k / blades.length * Math.PI * 2;
        b.position.set(P.pos.x + Math.cos(a) * S.r, 1.5, P.pos.z + Math.sin(a) * S.r); b.rotation.y = -a;
        for (const m of mobs) if (!m.dead && dist2(m.pos, b.position) < 1.3 + m.radius && t - (lastHit.get(m) ?? -9) > 0.3) { lastHit.set(m, t); hitMob(m, dmg(), { knock:2, from:b.position, color }); }
      });
      if (Math.random() < 0.6) burst.emit(blades[Math.floor(Math.random() * blades.length)].position, color, 1, 0.4, 0.3, 0.2);
      yield 0;
    }
    blades.forEach(b => go(fade(b, 0.2, k => b.scale.setScalar(Math.max(0.01, 1 - k)))));
  },
  *buff(S, dmg, color, pw) {
    play('meteoro', 0.5);
    P.buff = { atk:S.atk ?? 0, shield:S.shield ?? 0, speed:S.speed ?? 0, lifesteal:S.lifesteal ?? 0, t:S.dur, color };
    if (S.nova) { hitAround(P.pos, S.nova.r, ATK() * S.nova.mult * pw, { stun:S.nova.stun, knock:6, color }); friendlyBurst(P.pos, S.nova.r, color); shake = Math.max(shake, 0.2); }
    ringFx(P.pos, 3, color, 0.5);
    const aura = new THREE.Mesh(M.shared('buffAura', () => new THREE.CylinderGeometry(1.4, 1.4, 3.8, 24, 1, true)), M.additive(new THREE.Color(color).multiplyScalar(1.5), 0.2, { side:THREE.DoubleSide }));
    scene.add(aura);
    while (P.buff.t > 0 && !P.dead) {
      aura.position.set(P.pos.x, 1.9, P.pos.z); aura.material.opacity = 0.16 + Math.sin(T * 6) * 0.06;
      if (Math.random() < 0.4) burst.emit(tmp.set(P.pos.x + rand(-1, 1), 0.4, P.pos.z + rand(-1, 1)), color, 1, 0.4, 0.6, 2.5);
      yield 0;
    }
    yield* fade(aura, 0.3, k => { aura.material.opacity = 0.18 * (1 - k); });
  },
  *area(S, dmg, color) {
    const target = clampTarget(aimPoint(S.range).clone(), S.range); faceTo(target); play('meteoro', 0.6);
    const n = S.count ?? 1;
    for (let k = 0; k < n; k++) {
      const p = k === 0 ? target.clone() : new THREE.Vector3(target.x + rand(-S.spread, S.spread), 0, target.z + rand(-S.spread, S.spread));
      go(areaStrike(S, p, dmg, color));
      if (n > 1) yield 0.16;
    }
  },
  *leap(S, dmg, color) {
    const target = clampTarget(aimPoint(S.range).clone(), S.range); faceTo(target);
    const start = P.pos.clone(), end = target.clone();
    if (!canStand(end.x, end.z, 0.5)) end.copy(start);
    play('salto', 0.55); P.busy = true; P.iframe = 0.7;
    for (let t = 0; t < 0.5; t += DT) { const k = t / 0.5; P.pos.lerpVectors(start, end, k); P.y = Math.sin(k * Math.PI) * 2.8; yield 0; }
    P.pos.copy(end); P.y = 0; P.busy = false;
    hitAround(end, S.r, dmg(), { knock:6, from:end, stun:S.stun });
    ringFx(end, S.r, color, 0.4, 0.8); burst.emit(tmp.set(end.x, 0.3, end.z), 0xc9b79a, 30, 8, 0.6, 2.5);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; spike(end.x + Math.cos(a) * S.r * 0.8, end.z + Math.sin(a) * S.r * 0.8, 0x8a7a6a, 0, 1.2); }
    shake = Math.max(shake, 0.3); sfx('golemSlam');
  },
  *fissure(S, dmg, color) {
    const dir = faceTo(aimPoint(S.len)), base = Math.atan2(dir.y, dir.x), o = P.pos.clone();
    play('slash', 0.38);
    const lines = [];
    for (let k = 0; k < S.count; k++) {
      const a = base + (k - (S.count - 1) / 2) * 0.4, tg = M.createTelegraph('rect', { w:S.w, len:S.len, color });
      tg.group.position.set(o.x, 0.04, o.z); tg.aim(Math.cos(a), Math.sin(a)); lines.push({ tg, dx:Math.cos(a), dz:Math.sin(a) });
    }
    for (let t = 0; t < 0.3; t += DT) { lines.forEach(l => l.tg.set(t / 0.3)); yield 0; }
    for (const { tg, dx, dz } of lines) {
      tg.dispose();
      for (const m of mobs) {
        if (m.dead) continue;
        const rx = m.pos.x - o.x, rz = m.pos.z - o.z, along = rx * dx + rz * dz, perp = Math.abs(rx * dz - rz * dx);
        if (along > 0 && along < S.len + m.radius && perp < S.w / 2 + m.radius) hitMob(m, dmg(), { knock:3, from:o, stun:0.6, color });
      }
      for (let d = 1.5; d < S.len; d += 1.5) spike(o.x + dx * d, o.z + dz * d, color, d * 0.02, 1.6 + Math.random());
    }
    shake = Math.max(shake, 0.35); sfx('bossAttack');
  },
  *rain(S, dmg, color) {
    const target = clampTarget(aimPoint(S.range).clone(), S.range); faceTo(target); play('chuva', 0.45);
    const zone = M.createTelegraph('circle', { r:S.r, color }); zone.group.position.set(target.x, 0.04, target.z); zone.set(1);
    for (let i = 0; i < S.ticks; i++) {
      for (let k = 0; k < 3 + Math.round(S.r / 2); k++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * S.r, x = target.x + Math.cos(a) * r, z = target.z + Math.sin(a) * r;
        const arrow = new THREE.Mesh(M.shared('rainArrow', () => new THREE.BoxGeometry(0.08, 1.3, 0.08)), shotMat(color)); arrow.position.set(x, 9, z); scene.add(arrow);
        go((function* () { for (let t = 0; t < 0.18; t += DT) { arrow.position.y = 9 * (1 - t / 0.18); yield 0; } arrow.removeFromParent(); burst.emit(arrow.position, color, 2, 2, 0.25, 1); })());
      }
      hitAround(target, S.r, dmg(), { color });
      yield 0.12;
    }
    zone.dispose();
  },
  *fan(S, dmg, color) {
    const dir = faceTo(aimPoint(16)), base = Math.atan2(dir.y, dir.x); play('shoot', 0.3); sfx('archer');
    for (let k = 0; k < S.count; k++) { const a = base + (k / (S.count - 1) - 0.5) * S.spread; friendlyShot('arrow', new THREE.Vector2(Math.cos(a), Math.sin(a)), dmg(), { color }); }
  },
  *homing(S, dmg, color) {
    const dir = faceTo(aimPoint(16)), base = Math.atan2(dir.y, dir.x); play('shoot', 0.4);
    for (let k = 0; k < S.count; k++) {
      const a = base + (k / (S.count - 1) - 0.5) * 2.4;
      friendlyShot('arrow', new THREE.Vector2(Math.cos(a), Math.sin(a)), dmg(), { color, homing:true, speed:18, life:2.2 });
      sfx('archer'); yield 0.05;
    }
  },
  *nova(S, dmg, color) {
    play('meteoro', 0.45);
    hitAround(P.pos, S.r, dmg(), { stun:S.stun, knock:3, color });
    friendlyBurst(P.pos, S.r, color);
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, r = S.r * (0.55 + Math.random() * 0.4); spike(P.pos.x + Math.cos(a) * r, P.pos.z + Math.sin(a) * r, 0xbff0ff, Math.random() * 0.1, 1.4 + Math.random()); }
    shake = Math.max(shake, 0.2);
  },
  *chain(S, dmg, color) {
    play('cast', 0.3); sfx('thunder');
    let from = new THREE.Vector3(P.pos.x, 1.9, P.pos.z), cur = nearestMob(16);
    if (!cur) { const p = aimPoint(10); bolt(from, new THREE.Vector3(p.x, 0.3, p.z), color); return; }
    const hit = new Set();
    for (let j = 0; j < S.jumps && cur; j++) {
      const to = new THREE.Vector3(cur.pos.x, 1.4, cur.pos.z);
      bolt(from, to, color); hit.add(cur); hitMob(cur, dmg(Math.pow(0.9, j)), { color, stun:0.3, silent:true }); sfx('zap');
      from = to;
      let best = null, bd = S.range;
      for (const m of mobs) { if (m.dead || hit.has(m)) continue; const d = dist2(m.pos, to); if (d < bd) { bd = d; best = m; } }
      cur = best; yield 0.07;
    }
  },
  *storm(S, dmg, color) {
    play('meteoro', 0.6); sfx('thunder');
    for (let i = 0; i < S.strikes && !P.dead; i++) {
      const cands = mobs.filter(m => !m.dead && m.spawnT <= 0 && dist2(m.pos, P.pos) < 16);
      const p = cands.length ? cands[Math.floor(Math.random() * cands.length)].pos.clone() : new THREE.Vector3(P.pos.x + rand(-8, 8), 0, P.pos.z + rand(-8, 8));
      bolt(new THREE.Vector3(p.x + rand(-1, 1), 14, p.z + rand(-1, 1)), new THREE.Vector3(p.x, 0.2, p.z), color);
      hitAround(p, S.r, dmg(), { color, stun:0.25, silent:true });
      ringFx(p, S.r, color, 0.25); burst.emit(tmp.set(p.x, 0.4, p.z), color, 12, 5, 0.4, 3); sfx(i % 4 === 3 ? 'thunder' : 'zap');
      shake = Math.max(shake, 0.08);
      yield S.dur / S.strikes;
    }
  },
};
// Arma mítica: um efeito por tipo de arma a cada C.MYTHIC_EVERY ataques (reaproveita os efeitos das habilidades).
const MYTHIC_COLOR = 0xff1a3c;
const MYTHIC_FX = {
  *espada() { yield* SKILL_FX.wave({ speed:24, range:14, w:3.4 }, (k = 1) => ATK() * 2.5 * k, MYTHIC_COLOR); },
  *machado() {
    const o = P.pos.clone(), r = 5.5;
    hitAround(o, r, ATK() * 2.2, { knock:6, from:o, stun:0.8, color:MYTHIC_COLOR });
    friendlyBurst(o, r, MYTHIC_COLOR); ringFx(o, r * 0.6, MYTHIC_COLOR, 0.3, 0.5);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; spike(o.x + Math.cos(a) * r * 0.7, o.z + Math.sin(a) * r * 0.7, 0x5a0a14, k * 0.015, 1.4); }
    shake = Math.max(shake, 0.3); sfx('meteor');
  },
  *arco() { yield* SKILL_FX.rain({ ticks:7, r:3.6, range:14 }, (k = 1) => ATK() * 0.7 * k, MYTHIC_COLOR); },
  *cajado() { yield* SKILL_FX.chain({ jumps:6, range:8 }, (k = 1) => ATK() * 1.6 * k, MYTHIC_COLOR); },
};
function* areaStrike(S, p, dmg, color) {
  const zone = M.createTelegraph('circle', { r:S.r, color }); zone.group.position.set(p.x, 0.04, p.z);
  const sword = S.fx === 'espada';
  let obj;
  if (sword) { obj = M.createWeapon('espada', 'lendario', { fx:false }).group; obj.scale.setScalar(4); obj.rotation.x = Math.PI; }
  else obj = new THREE.Mesh(M.shared('meteor', () => new THREE.IcosahedronGeometry(1.1, 1)), M.glow(color, 3));
  scene.add(obj);
  const trail = new M.Sparks({ count:30, color, size:0.3, life:[0.2, 0.5], spawn:o => o.copy(obj.position).add(tmp2.set(rand(-0.6, 0.6), sword ? rand(0, 6) : rand(-0.6, 0.6), rand(-0.6, 0.6))), vel:o => o.set(0, 2, 0) });
  for (let t = 0; t < S.delay; t += DT) {
    const k = t / S.delay; zone.set(k);
    if (sword) obj.position.set(p.x, 9 + 22 * (1 - k) * (1 - k), p.z);
    else { obj.position.set(p.x - 5 * (1 - k), 14 * (1 - k) + 0.5, p.z - 5 * (1 - k)); obj.rotation.x += DT * 6; }
    trail.update(DT); yield 0;
  }
  zone.dispose(); trail.dispose();
  hitAround(p, S.r, dmg(), { knock:7, from:p, color });
  ringFx(p, S.r + 0.5, color, 0.5, 1.2); burst.emit(tmp.set(p.x, 0.5, p.z), color, 50, 10, 0.8, 4);
  shake = Math.max(shake, 0.4); boost = Math.max(boost, 0.4); sfx(sword ? 'holyImpact' : 'meteor');
  if (sword) { yield 0.7; yield* fade(obj, 0.4, k => { obj.position.y = 9 - k * 10; }); }
  else { obj.removeFromParent(); M.disposeTree(obj); }
}

// ---------- jogador ----------
function updatePlayer(dt) {
  P.iframe -= dt; P.slowT -= dt; P.dashCd -= dt; P.atkCd -= dt; P.buff.t -= dt; for (let i = 0; i < P.cds.length; i++) P.cds[i] -= dt;
  P.guardT -= dt; P.drawT -= dt; P.perfectT -= dt; P.atkBuf -= dt; P.rageT -= dt;
  if (P.rageT <= 0 && P.rage > 0) P.rage = Math.max(0, P.rage - dt * 3); // a Fúria esvazia sem acertos
  if (P.rage > 4 && Math.random() < P.rage / 25) burst.emit(tmp.set(P.pos.x + rand(-0.5, 0.5), rand(0.5, 2), P.pos.z + rand(-0.5, 0.5)), 0xff2a3a, 1, 1.5, 0.4, 0.5);
  if (P.perfectT > 0 && Math.random() < 0.5) burst.emit(tmp.set(P.pos.x, 1.2, P.pos.z), 0x9ae8ff, 1, 2, 0.4, 0.5);
  if (P.drawT > 0 && weapon) burst.emit(weapon.tw, weaponColor(), 2, 0.6, 0.2, 0.45); // energia juntando na ponta do arco/cajado
  if (P.dead || mode === 'results') { P.moving = 0; return; }
  const mv = showcase ? { x:0, z:0 } : input.move();
  const blocked = showcase || UI.isOpen();
  if (gather && (mv.x || mv.z)) stopGather();
  if (P.regen) {
    P.hp = Math.min(stats.hp, P.hp + P.regen.rate * Math.min(dt, P.regen.left)); P.regen.left -= dt;
    if (Math.random() < 0.15) burst.emit(tmp.set(P.pos.x + rand(-0.6, 0.6), 0.4, P.pos.z + rand(-0.6, 0.6)), 0x5aff8a, 1, 1.5, 0.6, 0.6);
    if (P.regen.left <= 0) P.regen = null;
  }
  if (input.take('potion') && !blocked) usePotion();
  if (P.dashT > 0) {
    P.dashT -= dt; if (P.dashT <= 0) P.dashEnd = T; tryMove(P.pos, P.dashDir.x * 19 * dt, P.dashDir.y * 19 * dt, 0.5);
    if (Math.random() < 0.7) burst.emit(tmp.set(P.pos.x, 1, P.pos.z), weaponColor(), 2, 1, 0.3, 0.5);
    P.moving = 1;
  } else if (!P.busy || P.anim?.name === 'giro') {
    // Golpe corpo a corpo e puxar a corda/conjurar deixam mais lento (compromisso com o ataque).
    const speed = 6.5 * (P.drawT > 0 ? 0.45 : P.anim?.name === 'slash' && C.CLASSES[save.cls].combo ? 0.55 : 1) * (P.anim?.name === 'giro' ? 0.75 : 1) * (1 + (P.buff.t > 0 ? P.buff.speed : 0) + pb('speed') + stats.moveSpeed) * (P.slowT > 0 ? 0.6 : 1);
    if (mv.x || mv.z) { tryMove(P.pos, mv.x * speed * dt, mv.z * speed * dt, 0.5); if (!P.anim) P.facing = Math.atan2(mv.x, mv.z); P.stepT = (P.stepT ?? 0) - dt; if (P.stepT <= 0) { P.stepT = 0.32; sfx('step'); } }
    P.moving = THREE.MathUtils.lerp(P.moving, mv.x || mv.z ? 1 : 0, 1 - Math.exp(-dt * 12));
    if (P.slowT > 0 && Math.random() < 0.3) burst.emit(tmp.set(P.pos.x, 0.4, P.pos.z), 0x8fe0ff, 1, 1, 0.4, 0.6); // lento: gelo nos pés
  }
  if (input.take('dash') && P.dashCd <= 0 && !P.busy && !blocked) {
    P.dashT = 0.25; P.iframe = 0.4; P.dashCd = 0.9; P.anim = null; P.swing++; P.drawT = 0; // a esquiva cancela o golpe/disparo em andamento
    // Esquiva perfeita: atravessar um golpe prestes a sair dá +30% de ataque por 2,5 s e devolve a esquiva mais cedo.
    if (mode === 'dungeon' && inDanger(0.45)) {
      P.perfectT = 2.5; P.iframe = 0.6; P.dashCd = 0.35; hitStop = Math.max(hitStop, 0.1); boost = Math.max(boost, 0.35);
      const [px, py] = project(P.pos, 3.6); UI.number(px, py, 'Esquiva perfeita!', 'crit'); sfx('coin');
      burst.emit(tmp.set(P.pos.x, 1.2, P.pos.z), 0x9ae8ff, 26, 6, 0.5, 1.6); ringFx(P.pos, 2.2, 0x9ae8ff, 0.35, 0.4);
    }
    burst.emit(tmp.set(P.pos.x, 0.2, P.pos.z), 0xc9b79a, 12, 3, 0.4, 1);
    if (mv.x || mv.z) P.dashDir.set(mv.x, mv.z).normalize(); else P.dashDir.set(Math.sin(P.facing), Math.cos(P.facing));
    P.facing = Math.atan2(P.dashDir.x, P.dashDir.y); sfx('dash');
  }
  if (blocked || (mode === 'hub' && !yard.on)) { ['skill0', 'skill1', 'skill2', 'attack'].forEach(k => input.take(k)); return; }
  if (input.take('attack')) P.atkBuf = 0.35; // toque rápido no meio de um golpe fica guardado para o próximo
  if ((input.attacking() || P.atkBuf > 0) && P.atkCd <= 0 && !P.busy && P.dashT <= 0) { P.atkBuf = 0; doAttack(); }
  for (let i = 0; i < 3; i++) if (input.take('skill' + i) && P.cds[i] <= 0 && !P.busy) castSkill(i);
}

// ---------- mobs ----------
function telegraph(owner, shape, opts, x, z) { const t = M.createTelegraph(shape, opts); t.group.position.set(x, 0.04, z); owner.teles.push(t); return t; }
function untele(owner, t) { t.dispose(); owner.teles.splice(owner.teles.indexOf(t), 1); }

// small: filhote do slime que se divide. revived: esqueleto que já levantou uma vez.
// elite: lista de afixos (C.ELITE_AFFIXES); mini: mini-chefe da run (elite com dois afixos e muito mais vida).
function spawnMob(type, x, z, { boss = false, small = false, revived = false, elite = null, mini = false } = {}) {
  const def = boss ? C.BOSSES[type] : C.MOBS[type], level = run.def.level, s = C.dungeonScale(level) * (small ? 0.4 : 1);
  const D = boss ? { hp:C.DIFFICULTY.bossHp, dmg:C.DIFFICULTY.bossDmg } : C.DIFFICULTY;
  const E = mini ? C.MINI : elite ? C.ELITE : null, aff = (elite ?? []).map(id => C.ELITE_AFFIXES[id]), mul = k => aff.reduce((v, a) => v * (a[k] ?? 1), E?.[k] ?? 1);
  const scale = def.scale * (small ? 0.62 : 1) * (E?.scale ?? 1);
  const model = M.createMob(type, run.def.theme, scale);
  const m = { type, boss, def, model, scale, pos:new THREE.Vector3(x, 0, z), y:0, hp:def.hp * s * mul('hp') * D.hp, maxHp:def.hp * s * mul('hp') * D.hp, dmg:def.dmg * s * (small ? 1.5 : 1) * mul('dmg') * D.dmg, speed:(def.speed ?? 2.4) * mul('speed'), radius:def.radius * (small ? 0.62 : 1) * (E?.scale ?? 1), small, revived,
    stun:0, flash:0, flashOn:false, knock:V(), dead:false, teles:[], spawnT:0.45, face:0, lockFace:null, squash:1, showBar:boss || !!E, phase2:false,
    elite, mini, blast:aff.some(a => a.blast), regen:aff.reduce((v, a) => v + (a.regen ?? 0), 0) };
  model.root.position.copy(m.pos); model.root.scale.setScalar(0.01);
  // Barra de vida flutuante.
  const bar = new THREE.Group(); bar.position.y = 3; model.root.add(bar);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.6, depthTest:false }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14).translate(0.6, 0, 0), new THREE.MeshBasicMaterial({ color:0xff4455, depthTest:false }));
  fg.position.x = -0.6; fg.position.z = 0.001; bar.add(bg, fg); bar.scale.setScalar(1 / scale); bar.visible = false; bg.renderOrder = fg.renderOrder = 10;
  m.bar = bar; m.barFill = fg;
  if (E) {
    // Aura colorida no chão (cor do afixo) e barra dourada.
    const col = new THREE.Color(aff[0]?.color ?? 0xffd36b), ring = new THREE.Mesh(M.shared('eliteRing', () => new THREE.RingGeometry(0.8, 1.1, 32).rotateX(-Math.PI / 2)), M.additive(col.multiplyScalar(1.6), 0.8));
    ring.position.y = 0.06 / scale; ring.scale.setScalar(m.radius * 1.4 / scale); model.root.add(ring); m.aura = ring; fg.material.color.set(0xffc23a);
  }
  burst.emit(tmp.set(x, 0.5, z), run.theme.accent, 16, 4, 0.5, 2);
  mobs.push(m);
  const ai = boss ? bossAI(m) : { slime:slimeAI, esqueleto:skeletonAI, espirito:spiritAI, golem:golemAI, arqueiroEsq:archerAI, bomba:bombAI,
    flor:florAI, armadura:armorAI, sombra:spiritAI, morcego:batAI, magmaSlime:slimeAI, espectroGelo:spiritAI }[type](m);
  go((function* () { yield 0.5; yield* ai; })(), m);
  return m;
}

function killMob(m) {
  m.dead = true;
  m.teles.forEach(t => t.dispose()); m.teles.length = 0;
  run.kills++; mission('kills');
  combo = T - lastKill < 3 ? combo + 1 : 1; lastKill = T; if (combo >= 3) UI.combo(combo); if (m.boss) mission('bosses');
  burst.emit(tmp.set(m.pos.x, 1, m.pos.z), m.boss ? 0xffd36b : run.theme.mob, m.boss ? 80 : 20, m.boss ? 12 : 5, 0.8, 3);
  sfxAt(`die:${m.def.sound ?? m.type}`, m.pos);
  const root = m.model.root;
  // Morte: esqueleto se desmonta em ossos, golem vira entulho, slime respinga.
  if (M.isBony(m.type) && M.propGeo('skull')) { spawnDebris(m.pos, 'bones', m.scale); root.removeFromParent(); M.disposeTree(root); }
  else if ((m.type === 'golem' || m.type === 'colosso') && M.propGeo('rock_single_A')) { spawnDebris(m.pos, 'rubble', m.scale); root.removeFromParent(); M.disposeTree(root); }
  else if (m.type === 'slime' || m.type === 'reiSlime' || m.type === 'bomba' || m.type === 'magmaSlime') { splat(m.pos, m.type === 'bomba' || m.type === 'magmaSlime' ? 0xff4a2a : run.theme.mob, m.scale); go(fade(root, 0.15, k => { root.scale.set(m.scale * (1 + k), m.scale * (1 - k), m.scale * (1 + k)); })); }
  else go(fade(root, 0.3, k => { root.scale.setScalar(Math.max(0.01, m.scale * (1 - k))); }));
  const lvl = run.def.level;
  const boosted = !m.boss && m.type === C.boostedCreature();
  if (!m.boss) story('kill', { id:m.type });
  if (!m.boss) { const star = C.recordKill(save, m.type); if (star) { story('star'); UI.toast(`Bestiário: ${m.def.label} ${'★'.repeat(star)} · +10 pontos de charm`, '#ffd36b'); sfx('level'); } }
  gainXp(m.boss ? 120 * lvl : Math.round(m.def.xp * (1 + (lvl - 1) * 0.8) * (boosted ? 1.5 : 1) * (m.mini ? C.MINI.xp : m.elite ? C.ELITE.xp : 1)));
  if (m.boss) return bossDefeated(m);
  if (m.key) dropKey(m.pos);
  if (m.mini) { UI.banner('Guardião derrotado!', m.def.label, '#ffd36b'); sfx('victory'); if (Math.random() < C.GEAR_CHANCE.mini) dropLoot(C.rollDrop('chest', { cls:save.cls, level:lvl }), m.pos); }
  else if (m.elite && !m.purged && Math.random() < C.GEAR_CHANCE.elite) dropLoot(C.rollDrop('mob', { cls:save.cls, level:lvl, min:'raro' }), m.pos);
  if (m.blast && !m.purged) go(blast(m.pos.clone(), m.dmg * 1.2));
  // Mecânicas da dungeon: slime se divide (Nível 1), esqueleto levanta uma vez (Nível 5).
  if (m.purged) return; // sala aberta pelo objetivo: quem sobrou cai sem se dividir nem levantar
  if (run.def.split && m.type === 'slime' && !m.small) for (const sd of [-1, 1]) { const x = m.pos.x + sd * 0.8; spawnMob('slime', canStand(x, m.pos.z, 0.6) ? x : m.pos.x, m.pos.z, { small:true }); }
  if (run.def.revive && M.isBony(m.type) && !m.revived) go(rise(m.type, m.pos.clone()));
  if (m.exploded) return;
  // Mob comum não solta equipamento; a sorte (charm, afixo, elixir, criatura do dia) aumenta o material.
  gainMats(C.rollMaterials('mob', lvl, Math.random, (boosted ? 1 : 0) + (C.hasCharm(save, 'sorte') ? 0.3 : 0) + stats.drop + pb('luck')), m.pos);
  if (Math.random() < 0.09) dropOrb(m.pos);
}

// Esqueleto do cemitério volta depois de um círculo roxo (a sala só abre quando ele cai de novo).
function* rise(type, at) {
  const room = run.lockedRoom, tg = M.createTelegraph('circle', { r:1.3, color:0xb45cff }); tg.group.position.set(at.x, 0.04, at.z);
  (run.loose ??= []).push(tg); if (room) room.spawning = (room.spawning ?? 0) + 1;
  for (let t = 0; t < 1.8; t += DT) { tg.set(t / 1.8); if (Math.random() < 0.2) burst.emit(tmp.set(at.x, 0.3, at.z), 0xb45cff, 1, 1.5, 0.4, 0.6); yield 0; }
  tg.dispose(); run.loose.splice(run.loose.indexOf(tg), 1); if (room) room.spawning--;
  if (run.won || run.ending) return;
  spawnMob(type, at.x, at.z, { revived:true }); sfxAt('mobCast', at);
}

// Pedaços físicos simples (gravidade, quique, giro) com geometria/material compartilhados: nada é compilado nem descartado.
const debris = [];
const DEBRIS = { bones:[['skull', 1, 1.2], ['ribcage', 1, 1.3], ['bone_A', 2, 1.5], ['bone_B', 2, 1.5], ['bone_C', 1, 1.5]], rubble:[['rock_single_A', 3, 7], ['rock_single_C', 3, 7], ['rock_single_E', 2, 8]] };
function spawnDebris(at, kind, scale) {
  for (const [n, count, s] of DEBRIS[kind]) {
    const p = M.propGeo(n); if (!p) continue;
    for (let k = 0; k < count; k++) {
      const mesh = new THREE.Mesh(p.geo, p.mat), sc = s * scale / 1.3 * rand(0.8, 1.1);
      mesh.position.set(at.x + rand(-0.4, 0.4) * scale, rand(0.8, 1.8) * scale, at.z + rand(-0.4, 0.4) * scale);
      mesh.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6)); mesh.scale.setScalar(sc); mesh.castShadow = true; scene.add(mesh);
      debris.push({ mesh, vel:new THREE.Vector3(rand(-3.5, 3.5), rand(3, 6.5), rand(-3.5, 3.5)), spin:new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), t:0, life:rand(1.4, 2), s0:sc });
    }
  }
  burst.emit(tmp.set(at.x, 1, at.z), kind === 'bones' ? 0xe8e2cc : 0x9a8a7a, 14, 4, 0.5, 2);
}
function updateDebris(dt) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i], m = d.mesh; d.t += dt;
    d.vel.y -= 18 * dt; m.position.addScaledVector(d.vel, dt);
    if (m.position.y < 0.1) { m.position.y = 0.1; d.vel.y *= -0.3; d.vel.x *= 0.55; d.vel.z *= 0.55; d.spin.multiplyScalar(0.5); }
    m.rotation.x += d.spin.x * dt; m.rotation.y += d.spin.y * dt; m.rotation.z += d.spin.z * dt;
    if (d.t > d.life - 0.4) { const k = Math.max(0, (d.life - d.t) / 0.4); m.scale.setScalar(d.s0 * k); }
    if (d.t >= d.life) { m.removeFromParent(); debris.splice(i, 1); }
  }
}
function splat(at, color, scale) {
  const mesh = new THREE.Mesh(M.shared('splat', () => new THREE.CircleGeometry(1, 20)), new THREE.MeshStandardMaterial({ color, transparent:true, opacity:0.8, roughness:0.1 }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(at.x, 0.05, at.z); scene.add(mesh);
  burst.emit(tmp.set(at.x, 0.8, at.z), color, 22, 5, 0.6, 3);
  go(fade(mesh, 1.6, k => { mesh.scale.setScalar(scale * (0.4 + Math.min(1, k * 4) * 1.1)); mesh.material.opacity = 0.8 * (1 - Math.max(0, k - 0.5) * 2); }));
}

function mission(kind, value) {
  const done = C.trackMission(save, kind, value);
  if (done.length) { done.forEach(m => UI.toast(`Missão concluída: ${m.label} · resgate no hub`, '#7dffa6')); sfx('coin'); persist(); }
}
// História: missões de NPC, afinidade e primeiros passos escutam os mesmos eventos (ver story.js).
function story(ev, opts) {
  const r = S.storyEvent(save, ev, opts);
  for (const { npc, q } of r.ready) UI.toast(`Missão "${q.title}" pronta: fale com ${S.NPCS[npc].short}`, '#7dffa6');
  for (const { npc, lvl } of r.ups) UI.toast(`${S.NPCS[npc].short} agora te vê como ${S.AFFINITY_LABEL[lvl]} · conversa nova!`, '#ff9ad5');
  if (r.tut) { UI.banner(r.tut.next ? 'Passo concluído!' : 'Primeiros passos completos!', `✓ ${r.tut.done.text}`, '#7dffa6'); UI.toast(`Prêmio: ${S.rewardText(r.tut.done.reward)}`, '#7fe9ff'); sfx('victory'); }
  if (r.ready.length || r.ups.length || r.tut) { sfx('coin'); UI.hubBar(save, stats); }
  UI.questTrack(S.tutorialStep(save), save.story.tut); persist();
}
// Dica de primeira vez (uma vez por save).
function tip(id) { const t = S.takeTip(save, id); if (t) { UI.tip(t[0], t[1]); persist(); } }

function moveToward(m, x, z, step) {
  const dx = x - m.pos.x, dz = z - m.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return;
  const k = Math.min(step, d) / d;
  tryMove(m.pos, dx * k, dz * k, m.radius * 0.8);
}
function* chase(m, range, minT = 0, maxT = Infinity) {
  let t = 0;
  while (t < minT || (dist2(m.pos, P.pos) > range && t < maxT)) { if (!P.dead) moveToward(m, P.pos.x, P.pos.z, m.speed * DT); t += DT; yield 0; }
}
function dirTo(a, b) { const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1; return new THREE.Vector2(dx / d, dz / d); }

function* slimeAI(m) {
  while (true) {
    yield* chase(m, 9, rand(0.6, 1.4));
    const land = new THREE.Vector3(P.pos.x + rand(-0.6, 0.6), 0, P.pos.z + rand(-0.6, 0.6));
    if (!canStand(land.x, land.z, 0.6)) land.copy(P.pos);
    const R = m.radius + 1.0, tg = telegraph(m, 'circle', { r:R }, land.x, land.z);
    for (let t = 0; t < 0.55; t += DT) { tg.set(t / 0.55); m.squash = 1 - t * 0.6; yield 0; }
    const start = m.pos.clone(); m.squash = 1.2; sfxAt('hop', m.pos);
    for (let t = 0; t < 0.42; t += DT) { const k = t / 0.42; m.pos.lerpVectors(start, land, k); m.y = Math.sin(k * Math.PI) * 2.2; yield 0; }
    m.pos.copy(land); m.y = 0; m.squash = 0.7; untele(m, tg);
    if (inCircle(land.x, land.z, R)) hurtPlayer(m.dmg, land);
    if (m.type === 'magmaSlime') go(pool(m, land.x, land.z, R * 0.8, 2.5, m.dmg * 0.5, 0xff5a1a, 0.25), m);
    burst.emit(tmp.set(land.x, 0.3, land.z), run.theme.mob, 14, 4, 0.4, 1.5); sfx('splash');
    yield rand(0.5, 0.9);
  }
}
function* skeletonAI(m) {
  while (true) {
    yield* chase(m, 7, rand(0.6, 1.2));
    const dir = dirTo(m.pos, P.pos), len = 9;
    m.lockFace = Math.atan2(dir.x, dir.y);
    const tg = telegraph(m, 'rect', { w:1.8, len }, m.pos.x, m.pos.z); tg.aim(dir.x, dir.y);
    sfx('warning');
    m.model.act?.('windup', 0.95);
    for (let t = 0; t < 0.65; t += DT) { tg.set(t / 0.65); m.model.parts.armR.rotation.x = -2.2 * (t / 0.65); yield 0; }
    untele(m, tg); m.model.parts.armR.rotation.x = -1.2; sfxAt('mobSwing', m.pos);
    let hit = false, moved = 0; const start = m.pos.clone();
    while (moved < len) {
      const step = 26 * DT; if (!tryMove(m.pos, dir.x * step, dir.y * step, m.radius)) break; moved += step;
      if (!hit && dist2(m.pos, P.pos) < 1.3 && inRect(start, dir, 1.8, len)) { hit = true; hurtPlayer(m.dmg, m.pos); } // faixa avisada tem 1,8 de largura
      if (Math.random() < 0.6) burst.emit(tmp.set(m.pos.x, 0.3, m.pos.z), 0xc9b79a, 1, 1, 0.3, 0.5);
      yield 0;
    }
    m.model.parts.armR.rotation.x = 0; m.lockFace = null;
    yield rand(0.7, 1.1);
  }
}
function* spiritAI(m) {
  while (true) {
    const T0 = rand(1.2, 2), side = Math.random() < 0.5 ? -1 : 1;
    for (let t = 0; t < T0; t += DT) {
      const d = dist2(m.pos, P.pos), dir = dirTo(m.pos, P.pos), k = d < 6 ? -1 : d > 10 ? 1 : 0;
      tryMove(m.pos, (dir.x * k - dir.y * side * 0.6) * m.speed * DT, (dir.y * k + dir.x * side * 0.6) * m.speed * DT, m.radius);
      yield 0;
    }
    if (m.type === 'sombra') yield* blink(m);
    m.model.act?.('cast', 0.7);
    for (let t = 0; t < 0.5; t += DT) { const s = 1 + t * 2; m.model.parts.handL.scale.setScalar(s); m.model.parts.handR.scale.setScalar(s); yield 0; }
    m.model.parts.handL.scale.setScalar(1); m.model.parts.handR.scale.setScalar(1);
    const dir = dirTo(m.pos, P.pos), base = Math.atan2(dir.y, dir.x);
    const ice = m.type === 'espectroGelo';
    for (const off of [-0.32, 0, 0.32]) enemyShot(m.pos, Math.cos(base + off), Math.sin(base + off), 8.5, m.dmg, ice ? 0x8fe0ff : run.theme.accent, ice);
    sfxAt('mobCast', m.pos);
    yield rand(0.4, 0.8);
  }
}
function* archerAI(m) {
  while (true) {
    for (let t = 0, T0 = rand(1, 1.8); t < T0; t += DT) {
      const d = dist2(m.pos, P.pos), dir = dirTo(m.pos, P.pos), k = d < 8 ? -1 : d > 12 ? 1 : 0;
      tryMove(m.pos, dir.x * k * m.speed * DT, dir.y * k * m.speed * DT, m.radius); yield 0;
    }
    const dir = dirTo(m.pos, P.pos); m.lockFace = Math.atan2(dir.x, dir.y);
    const tg = telegraph(m, 'rect', { w:0.7, len:18 }, m.pos.x, m.pos.z); tg.aim(dir.x, dir.y);
    m.model.act?.('aim', 0.8); sfx('warning');
    for (let t = 0; t < 0.75; t += DT) { tg.set(t / 0.75); yield 0; }
    untele(m, tg); m.model.act?.('shoot', 0.4);
    enemyShot(m.pos, dir.x, dir.y, 28, m.dmg, run.theme.accent); sfxAt('bow', m.pos);
    m.lockFace = null; yield rand(0.8, 1.3);
  }
}
// Corre até o jogador, incha piscando e explode (morre junto, sem drop).
function* bombAI(m) {
  yield* chase(m, 2.4, 0.3);
  const R = 3.2, tg = telegraph(m, 'circle', { r:R }, m.pos.x, m.pos.z); sfx('warning');
  for (let t = 0; t < 0.9; t += DT) {
    moveToward(m, P.pos.x, P.pos.z, m.speed * 0.3 * DT); tg.group.position.set(m.pos.x, 0.04, m.pos.z); tg.set(t / 0.9);
    m.model.body.scale.setScalar(1 + t * 0.4 + Math.sin(t * 40) * 0.05); m.flash = Math.sin(t * 30) > 0 ? 0.05 : 0; yield 0;
  }
  untele(m, tg);
  if (inCircle(m.pos.x, m.pos.z, R)) hurtPlayer(m.dmg, m.pos);
  ringFx(m.pos, R, 0xff6a1a, 0.4, 1); burst.emit(tmp.set(m.pos.x, 0.6, m.pos.z), 0xff6a1a, 40, 9, 0.7, 4);
  shake = Math.max(shake, 0.3); sfx('meteor');
  m.exploded = true; killMob(m);
}
// Sombra: some e reaparece a 5 m do jogador (fumaça nos dois pontos), depois atira.
function* blink(m) {
  for (let k = 0; k < 20; k++) {
    const a = rand(0, Math.PI * 2), x = P.pos.x + Math.cos(a) * 5, z = P.pos.z + Math.sin(a) * 5;
    if (!canStand(x, z, m.radius)) continue;
    burst.emit(tmp.set(m.pos.x, 1.2, m.pos.z), 0x6a2acc, 16, 4, 0.5, 2); m.model.root.visible = false; yield 0.25;
    m.pos.set(x, 0, z); m.model.root.visible = true; burst.emit(tmp.set(x, 1.2, z), 0x6a2acc, 16, 4, 0.5, 2);
    return;
  }
}
// Flor carnívora: não anda; marca 3 linhas e cospe uma semente em cada (o meio de duas linhas é seguro).
function* florAI(m) {
  while (true) {
    yield rand(0.9, 1.5);
    if (dist2(m.pos, P.pos) > 16) continue;
    const dir = dirTo(m.pos, P.pos), base = Math.atan2(dir.y, dir.x), offs = [-0.5, 0, 0.5];
    m.lockFace = Math.atan2(dir.x, dir.y);
    const tgs = offs.map(o => { const t = telegraph(m, 'rect', { w:0.7, len:14 }, m.pos.x, m.pos.z); t.aim(Math.cos(base + o), Math.sin(base + o)); return t; });
    sfx('warning');
    for (let t = 0; t < 0.8; t += DT) { tgs.forEach(g => g.set(t / 0.8)); m.model.parts.head?.scale.setScalar(1 + t * 0.4); yield 0; }
    tgs.forEach(g => untele(m, g)); m.model.parts.head?.scale.setScalar(1);
    for (const o of offs) enemyShot(m.pos, Math.cos(base + o), Math.sin(base + o), 13, m.dmg, 0xd84a8a);
    sfxAt('mobCast', m.pos); m.lockFace = null;
  }
}
// Armadura viva: anda devagar e corta em leque à frente (as costas ficam livres).
function* armorAI(m) {
  while (true) {
    yield* chase(m, 3.2, 0.5);
    const dir = dirTo(m.pos, P.pos), R = 4.4, ang = 1.9; m.lockFace = Math.atan2(dir.x, dir.y);
    const tg = telegraph(m, 'cone', { r:R, angle:ang }, m.pos.x, m.pos.z); tg.aim(dir.x, dir.y); sfx('warning'); m.model.act?.('slash', 0.95);
    for (let t = 0; t < 0.8; t += DT) { tg.set(t / 0.8); yield 0; }
    untele(m, tg);
    if (inCone(m.pos, dir, R, ang)) hurtPlayer(m.dmg, m.pos);
    sfxAt('mobSwing', m.pos); burst.emit(tmp.set(m.pos.x + dir.x * 2, 0.8, m.pos.z + dir.y * 2), 0xc9b79a, 10, 4, 0.3, 1);
    m.lockFace = null; yield rand(0.8, 1.2);
  }
}
// Morcego: voa em volta do jogador e mergulha duas vezes em linha reta.
function* batAI(m) {
  while (true) {
    const side = Math.random() < 0.5 ? -1 : 1;
    for (let t = 0, T0 = rand(1, 1.6); t < T0; t += DT) {
      const d = dist2(m.pos, P.pos), dir = dirTo(m.pos, P.pos), k = d < 5 ? -0.6 : d > 8 ? 1 : 0;
      tryMove(m.pos, (dir.x * k - dir.y * side) * m.speed * DT, (dir.y * k + dir.x * side) * m.speed * DT, m.radius); yield 0;
    }
    for (let n = 0; n < 2; n++) {
      const dir = dirTo(m.pos, P.pos), len = 10; m.lockFace = Math.atan2(dir.x, dir.y);
      const tg = telegraph(m, 'rect', { w:2.2, len }, m.pos.x, m.pos.z); tg.aim(dir.x, dir.y); sfx('warning');
      for (let t = 0; t < 0.6; t += DT) { tg.set(t / 0.6); yield 0; }
      untele(m, tg); sfxAt('mobSwing', m.pos);
      let hit = false; const start = m.pos.clone();
      for (let moved = 0; moved < len; moved += 24 * DT) {
        if (!tryMove(m.pos, dir.x * 24 * DT, dir.y * 24 * DT, m.radius)) break;
        if (!hit && dist2(m.pos, P.pos) < 1.5 && inRect(start, dir, 2.2, len)) { hit = true; hurtPlayer(m.dmg, m.pos); }
        yield 0;
      }
      yield 0.3;
    }
    m.lockFace = null; yield rand(0.8, 1.2);
  }
}
function* golemAI(m) {
  while (true) {
    yield* chase(m, m.radius + 1.8, 0.4);
    const R = m.radius + 2.6, tg = telegraph(m, 'circle', { r:R }, m.pos.x, m.pos.z);
    sfx('warning'); sfxAt('golemGrunt', m.pos);
    m.posing = true;
    for (let t = 0; t < 0.85; t += DT) { const k = t / 0.85; tg.set(k); m.model.parts.armL.rotation.x = m.model.parts.armR.rotation.x = -2.6 * k; yield 0; }
    untele(m, tg); m.model.parts.armL.rotation.x = m.model.parts.armR.rotation.x = 0.3;
    if (inCircle(m.pos.x, m.pos.z, R)) hurtPlayer(m.dmg, m.pos);
    ringFx(m.pos, R, run.theme.accent, 0.35); burst.emit(tmp.set(m.pos.x, 0.3, m.pos.z), 0xb0a090, 24, 6, 0.5, 2);
    shake = Math.max(shake, 0.12); sfxAt('golemSlam', m.pos);
    yield 0.4; m.model.parts.armL.rotation.x = m.model.parts.armR.rotation.x = 0; m.posing = false;
    yield rand(0.6, 1.0);
  }
}

// ---------- chefes ----------
// Chefes montados por código (golem/colosso/cristal) levantam e batem os braços nos ataques.
function armsUp(b, k) { const p = b.model.parts; if (b.model.rig || !p.armL || !p.armR) return; b.posing = true; p.armL.rotation.x = p.armR.rotation.x = -2.6 * Math.min(1, k); }
function armsSlam(b) { const p = b.model.parts; if (b.model.rig || !p.armL || !p.armR) return; p.armL.rotation.x = p.armR.rotation.x = 0.45; go((function* () { yield 0.35; b.posing = false; })()); }
// Regra dos chefes: todo golpe tem aviso no chão e rota de fuga. O aviso encurta com o nível e na fúria, mas nunca abaixo de 0,55 s.
const lv = () => run.def.level;
const warnT = (b, s) => Math.max(0.55, s * (1 - 0.03 * (lv() - 1)) * (b.phase2 ? 0.88 : 1));
const SAFE = 0x5dff8a;
function inRect(o, dir, w, len) { const dx = P.pos.x - o.x, dz = P.pos.z - o.z, a = dx * dir.x + dz * dir.y; return P.y < 1 && a > -0.4 && a < len + 0.4 && Math.abs(dx * dir.y - dz * dir.x) < w / 2 + 0.4; }
// Pontos livres perto do jogador (o primeiro é onde ele está), afastados entre si: sempre sobra chão seguro entre os círculos.
function spots(n, R, spread) {
  const pts = [P.pos.clone()];
  for (let k = 0; pts.length < n && k < 150; k++) { const p = V().set(P.pos.x + rand(-spread, spread), 0, P.pos.z + rand(-spread, spread)); if (canStand(p.x, p.z, 0.5) && pts.every(q => dist2(p, q) > R * 2 + 1.4)) pts.push(p); }
  return pts;
}
// Objeto de efeito que some junto se o dono morrer no meio do golpe (entra em owner.teles).
function temp(owner, obj) { scene.add(obj); const t = { dispose() { obj.removeFromParent(); M.disposeTree(obj); } }; owner.teles.push(t); return t; }
const SPIKE_MATS = new Map();
const spikeMat = color => { let m = SPIKE_MATS.get(color); if (!m) { SPIKE_MATS.set(color, m = M.glow(color, 2.5)); m.userData.shared = true; } return m; };
// Poça que fica no chão: aviso vermelho, depois queima quem pisar (a invulnerabilidade limita a 1 dano a cada 0,5 s).
// Poça alaranjada = fogo/lava (o Elixir Antichamas reduz).
const isFire = c => (c >> 16) > 0xe0 && ((c >> 8) & 255) < 0x90 && (c & 255) < 0x40;
function* pool(owner, x, z, r, dur, dmg, color, warn) {
  const tg = telegraph(owner, 'circle', { r }, x, z);
  for (let t = 0; t < warn; t += DT) { tg.set(t / warn); yield 0; }
  untele(owner, tg);
  const pz = telegraph(owner, 'circle', { r, color }, x, z), fill = pz.group.children[0].material; pz.set(1);
  burst.emit(tmp.set(x, 0.3, z), color, 12, 3, 0.5, 1.5);
  for (let t = 0; t < dur; t += DT) {
    fill.opacity = (0.42 + Math.sin(T * 6) * 0.08) * Math.min(1, (dur - t) * 2);
    if (Math.random() < 0.08) burst.emit(tmp.set(x + rand(-r, r) * 0.6, 0.2, z + rand(-r, r) * 0.6), color, 1, 1, 0.5, 0.6);
    if (inCircle(x, z, r - 0.5)) hurtPlayer(dmg, null, isFire(color) ? 'fire' : null);
    yield 0;
  }
  untele(owner, pz);
}
// Investida em linha; com trail deixa poças de fogo no caminho (dentro da faixa avisada).
function* charge(b, trail) {
  for (let i = 0; i < 1 + (b.phase2 ? 1 : 0) + (lv() >= 6 ? 1 : 0); i++) {
    const dir = dirTo(b.pos, P.pos), len = 20, T0 = warnT(b, 0.85);
    b.lockFace = Math.atan2(dir.x, dir.y);
    const tg = telegraph(b, 'rect', { w:b.radius * 1.6, len }, b.pos.x, b.pos.z); tg.aim(dir.x, dir.y); sfx('warning');
    b.model.act?.('windup', 1.0);
    for (let t = 0; t < T0; t += DT) { tg.set(t / T0); armsUp(b, t / T0 / 2); yield 0; }
    armsSlam(b); tg.set(1); // a faixa fica visível durante a corrida
    let hit = false, moved = 0, drop = 0; const start = b.pos.clone();
    while (moved < len) {
      const step = 30 * DT; if (!tryMove(b.pos, dir.x * step, dir.y * step, b.radius)) break; moved += step;
      if (!hit && dist2(b.pos, P.pos) < b.radius * 0.8 + 0.4 && inRect(start, dir, b.radius * 1.6, len)) { hit = true; hurtPlayer(b.dmg * 1.4, b.pos); } // só dentro da faixa avisada
      if (trail && (drop += step) > 2.4) { drop = 0; go(pool(b, b.pos.x, b.pos.z, 1.4, 3, b.dmg * 0.35, b.def.pool ?? 0xff5a1a, 0.3), b); }
      burst.emit(tmp.set(b.pos.x, 0.3, b.pos.z), trail ? 0xff6a1a : 0xc9b79a, 2, 2, 0.4, 0.8);
      yield 0;
    }
    untele(b, tg); shake = Math.max(shake, 0.25); sfx('bossAttack'); b.lockFace = null;
    yield 0.5;
  }
}
const PATTERNS = {
  *salto(b) {
    for (let i = 0; i < (b.phase2 ? 3 : 2); i++) {
      const land = P.pos.clone(); if (!canStand(land.x, land.z, b.radius)) land.copy(b.pos);
      const R = b.radius + 2.6, T0 = warnT(b, 0.8), tg = telegraph(b, 'circle', { r:R }, land.x, land.z); sfx('warning');
      b.model.act?.('jump', 1.3);
      for (let t = 0; t < T0; t += DT) { tg.set(t / T0); b.squash = 1 - (t / T0) * 0.4; armsUp(b, t / T0); yield 0; }
      const start = b.pos.clone(); b.squash = 1.2;
      for (let t = 0; t < 0.55; t += DT) { const k = t / 0.55; b.pos.lerpVectors(start, land, k); b.y = Math.sin(k * Math.PI) * 5; yield 0; }
      b.pos.copy(land); b.y = 0; b.squash = 0.6; untele(b, tg); armsSlam(b);
      if (inCircle(land.x, land.z, R)) hurtPlayer(b.dmg * 1.3, land);
      ringFx(land, R + 1, run.theme.accent, 0.4, 0.8); burst.emit(tmp.set(land.x, 0.3, land.z), run.theme.mob, 40, 9, 0.6, 2);
      shake = Math.max(shake, 0.35); sfx('bossAttack');
      yield 0.35;
    }
  },
  *ondas(b) {
    const warn = telegraph(b, 'circle', { r:b.radius + 0.8 }, b.pos.x, b.pos.z); sfx('warning');
    b.model.act?.('chop', 0.9);
    for (let t = 0; t < 0.6; t += DT) { warn.set(t / 0.6); armsUp(b, t / 0.6); yield 0; }
    untele(b, warn); armsSlam(b);
    // A brecha nasce perto do jogador e anda pouco a cada onda: dá para seguir andando, sem precisar de esquiva.
    let gap = Math.atan2(-(P.pos.z - b.pos.z), P.pos.x - b.pos.x) + rand(-0.7, 0.7); const side = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < (b.phase2 ? 4 : 3) + (lv() >= 6 ? 1 : 0); i++) { go(shockwave(b.pos.clone(), b.dmg, gap)); gap += side * rand(0.2, 0.35); sfx('bossAttack'); yield 0.6; }
  },
  *invocar(b) {
    if (mobs.filter(m => !m.dead && !m.boss).length >= 6) return;
    b.model.act?.('summon', 1.1);
    for (let t = 0; t < 0.8; t += DT) { b.flash = 0.05; armsUp(b, t / 0.8); yield 0; }
    armsSlam(b);
    const kinds = b.def.minions ?? run.def.mobs, n = 2 + (b.phase2 ? 1 : 0) + (lv() >= 5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, x = b.pos.x + Math.cos(a) * (b.radius + 3), z = b.pos.z + Math.sin(a) * (b.radius + 3);
      if (canStand(x, z, 0.8)) spawnMob(kinds[Math.floor(Math.random() * kinds.length)], x, z);
    }
    sfx('boss'); yield 0.5;
  },
  *investida(b) { yield* charge(b, false); },
  *rastro(b) { yield* charge(b, true); },
  *corte(b) {
    for (let i = 0; i < (b.phase2 ? 2 : 1); i++) {
      const dir = dirTo(b.pos, P.pos), R = b.radius + 6, ang = 1.8, T0 = warnT(b, 1.0);
      b.lockFace = Math.atan2(dir.x, dir.y);
      const tg = telegraph(b, 'cone', { r:R, angle:ang }, b.pos.x, b.pos.z); tg.aim(dir.x, dir.y); sfx('warning');
      b.model.act?.('slash', 0.95);
      for (let t = 0; t < T0; t += DT) { tg.set(t / T0); armsUp(b, t / T0); yield 0; }
      untele(b, tg); armsSlam(b);
      if (inCone(b.pos, dir, R, ang)) hurtPlayer(b.dmg * 1.5, b.pos);
      const g = new THREE.Group(), mesh = new THREE.Mesh(new THREE.RingGeometry(1, R, 32, 1, -ang / 2, ang), M.additive(new THREE.Color(run.theme.accent).multiplyScalar(2), 0.8, { side:THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2; g.add(mesh); g.position.set(b.pos.x, 0.5, b.pos.z); g.rotation.y = Math.atan2(-dir.y, dir.x); scene.add(g);
      go(fade(g, 0.25, k => { mesh.material.opacity = 0.8 * (1 - k); }));
      shake = Math.max(shake, 0.25); sfx('bossAttack'); b.lockFace = null;
      yield 0.4;
    }
  },
  *rajada(b) {
    const n = 12 + Math.min(6, lv()), step = Math.PI * 2 / n, color = b.def.slow ? 0x8fe0ff : run.theme.accent, T0 = warnT(b, 0.9);
    // Brecha fixa de 3 orbes perto do jogador, pintada de verde no chão: parado nela, nenhuma onda acerta.
    const gap = Math.atan2(P.pos.z - b.pos.z, P.pos.x - b.pos.x) + rand(-0.8, 0.8);
    const safe = telegraph(b, 'cone', { r:15, angle:step * 2, color:SAFE }, b.pos.x, b.pos.z); safe.aim(Math.cos(gap), Math.sin(gap));
    b.model.act?.('cast', 0.9);
    for (let t = 0; t < T0; t += DT) { b.flash = 0.05; safe.set(Math.min(1, t / T0 * 1.5)); armsUp(b, t / T0); yield 0; }
    armsSlam(b);
    for (let w = 0; w < (b.phase2 ? 3 : 2) + (lv() >= 7 ? 1 : 0); w++) {
      for (let k = 2; k <= n - 2; k++) { const a = gap + k * step; enemyShot(b.pos, Math.cos(a), Math.sin(a), 7.5, b.dmg * 0.7, color, b.def.slow); }
      sfx('enemyAttack'); yield 0.5;
    }
    yield 1.2; untele(b, safe);
  },
  *meteoros(b) {
    const R = 2.6, color = b.def.rain ?? 0xff8a2a, T0 = warnT(b, 1.0), pts = spots(4 + Math.ceil(lv() / 2) + (b.phase2 ? 2 : 0), R, 9), rocks = [];
    const tgs = pts.map(p => telegraph(b, 'circle', { r:R }, p.x, p.z)); sfx('warning');
    b.model.act?.('summon', 1.2);
    for (let t = 0; t < T0; t += DT) {
      tgs.forEach(g => g.set(t / T0)); armsUp(b, t / T0);
      // A pedra aparece no alto e cai nos últimos 0,35 s.
      if (t >= T0 - 0.35 && !rocks.length) for (const p of pts) { const r = new THREE.Mesh(M.shared('meteor', () => new THREE.IcosahedronGeometry(1.1, 1)), spikeMat(color)); r.scale.setScalar(0.7); rocks.push([r, temp(b, r), p]); }
      for (const [r, , p] of rocks) r.position.set(p.x, 0.5 + 12 * Math.max(0, (T0 - t) / 0.35), p.z);
      yield 0;
    }
    tgs.forEach(g => untele(b, g)); rocks.forEach(([, h]) => untele(b, h)); armsSlam(b);
    let hit = false;
    for (const p of pts) {
      if (!hit && inCircle(p.x, p.z, R)) { hit = true; hurtPlayer(b.dmg, p); }
      ringFx(p, R, color, 0.35); burst.emit(tmp.set(p.x, 0.4, p.z), color, 14, 6, 0.5, 3);
    }
    shake = Math.max(shake, 0.3); sfx('meteor');
    yield 0.4;
  },
  *pocas(b) {
    const R = 2.2, color = b.def.pool ?? run.theme.mob, pts = spots(3 + (b.phase2 ? 1 : 0) + (lv() >= 5 ? 1 : 0), R, 8);
    b.model.act?.('summon', 1.0); sfx('warning');
    for (const p of pts) go(pool(b, p.x, p.z, R, b.phase2 ? 5 : 4, b.dmg * 0.4, color, warnT(b, 1.0)), b);
    for (let t = 0; t < 0.8; t += DT) { armsUp(b, t / 0.8); b.squash = 1 - t * 0.3; yield 0; }
    armsSlam(b); sfx('splash'); yield 0.4;
  },
  *espinhos(b) {
    // Fileiras paralelas cruzando a sala a cada 4,4 m: a faixa livre mais próxima fica a no máximo 2,2 m.
    const color = b.def.rain ?? run.theme.accent, d = dirTo(b.pos, P.pos), side = new THREE.Vector2(-d.y, d.x), gapW = 4.4, w = 1.6, L = 30, o = P.pos.clone(), off = rand(0, gapW);
    for (let wave = 0; wave < (b.phase2 ? 2 : 1) + (lv() >= 7 ? 1 : 0); wave++) {
      const rows = [], T0 = warnT(b, 0.9);
      for (let k = -4; k <= 4; k++) {
        const a = k * gapW + off + wave * gapW / 2, x = o.x + d.x * a - side.x * L / 2, z = o.z + d.y * a - side.y * L / 2;
        const tg = telegraph(b, 'rect', { w, len:L }, x, z); tg.aim(side.x, side.y); rows.push({ tg, x, z });
      }
      sfx('warning'); b.model.act?.('summon', 0.9);
      for (let t = 0; t < T0; t += DT) { rows.forEach(r => r.tg.set(t / T0)); armsUp(b, t / T0); yield 0; }
      armsSlam(b);
      for (const r of rows) {
        untele(b, r.tg);
        if (inRect(r, side, w, L)) hurtPlayer(b.dmg * 1.1, null);
        for (let s = 0; s < L; s += 3) { const x = r.x + side.x * s, z = r.z + side.y * s; if (Math.hypot(x - P.pos.x, z - P.pos.z) < 15 && canStand(x, z, 0.2)) spike(x, z, color, rand(0, 0.08), 1.6); }
      }
      sfx('bossAttack'); shake = Math.max(shake, 0.2);
      yield 0.5;
    }
  },
  *espiral(b) {
    const arms = 3 + (lv() >= 6 ? 1 : 0), spin = (Math.random() < 0.5 ? -1 : 1) * 0.6, color = b.def.pool ?? run.theme.accent;
    const warn = telegraph(b, 'circle', { r:b.radius + 1 }, b.pos.x, b.pos.z); sfx('warning'); b.model.act?.('cast', 0.8);
    for (let t = 0; t < 0.7; t += DT) { warn.set(t / 0.7); b.flash = 0.05; armsUp(b, t / 0.7); yield 0; }
    untele(b, warn); armsSlam(b);
    // Cada braço solta 3 orbes e pula 3 (buracos de ~2 m ao longo do braço) e gira devagar.
    let a0 = rand(0, Math.PI * 2);
    for (let k = 0, n = Math.round((b.phase2 ? 3.2 : 2.4) / 0.15); k < n; k++) {
      if (k % 6 < 3) for (let i = 0; i < arms; i++) { const a = a0 + i * Math.PI * 2 / arms; enemyShot(b.pos, Math.cos(a), Math.sin(a), 6.5, b.dmg * 0.6, color); }
      if (k % 6 === 0) sfx('enemyAttack');
      a0 += spin * 0.15; yield 0.15;
    }
  },
  *piscar(b) {
    for (let i = 0; i < (b.phase2 ? 2 : 1); i++) {
      let to = null;
      for (let k = 0; k < 24 && !to; k++) { const a = rand(0, Math.PI * 2), x = P.pos.x + Math.cos(a) * 4, z = P.pos.z + Math.sin(a) * 4; if (canStand(x, z, b.radius)) to = V().set(x, 0, z); }
      if (!to) return;
      // Some e o círculo mostra onde vai surgir: saia dele.
      const R = b.radius + 2.4, T0 = warnT(b, 1.0), tg = telegraph(b, 'circle', { r:R }, to.x, to.z), root = b.model.root; sfx('warning');
      burst.emit(tmp.set(b.pos.x, 1.5, b.pos.z), run.theme.accent, 30, 6, 0.5, 3);
      for (let t = 0; t < T0; t += DT) { tg.set(t / T0); root.scale.setScalar(b.scale * Math.max(0.02, 1 - t / 0.25)); yield 0; }
      b.pos.copy(to); untele(b, tg);
      if (inCircle(to.x, to.z, R)) hurtPlayer(b.dmg * 1.2, to);
      ringFx(to, R + 0.5, run.theme.accent, 0.45, 1); burst.emit(tmp.set(to.x, 0.5, to.z), run.theme.accent, 40, 9, 0.6, 3);
      shake = Math.max(shake, 0.3); sfx('bossAttack');
      for (let t = 0; t < 0.2; t += DT) { root.scale.setScalar(b.scale * Math.max(0.02, t / 0.2)); yield 0; }
      root.scale.setScalar(b.scale); yield 0.4;
    }
  },
  *feixes(b) {
    const n = b.phase2 || lv() >= 8 ? 4 : 3, len = 15, w = 1.1, spin = (Math.random() < 0.5 ? -1 : 1) * 0.5, hex = b.def.slow ? 0x8fe0ff : run.theme.accent, T0 = warnT(b, 1.1);
    // O jogador começa no meio de uma brecha; os feixes giram devagar (5 m/s a 10 m do chefe; o jogador anda 6,5).
    let a0 = Math.atan2(P.pos.z - b.pos.z, P.pos.x - b.pos.x) + Math.PI / n;
    const dirs = () => Array.from({ length:n }, (_, i) => { const a = a0 + i * Math.PI * 2 / n; return new THREE.Vector2(Math.cos(a), Math.sin(a)); });
    const tgs = dirs().map(d => { const g = telegraph(b, 'rect', { w, len }, b.pos.x, b.pos.z); g.aim(d.x, d.y); return g; });
    sfx('warning'); b.model.act?.('cast', 1.2);
    for (let t = 0; t < T0; t += DT) { tgs.forEach(g => g.set(t / T0)); armsUp(b, t / T0); yield 0; }
    tgs.forEach(g => untele(b, g)); armsSlam(b);
    const color = new THREE.Color(hex).multiplyScalar(2);
    const beams = dirs().map(() => { const g = new THREE.Group(), mesh = new THREE.Mesh(M.shared('beam', () => new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0)), M.additive(color, 0.85)); mesh.scale.set(len, 0.5, w * 0.7); mesh.position.y = 1.2; g.add(mesh); g.position.set(b.pos.x, 0, b.pos.z); return { g, h:temp(b, g) }; });
    sfx('thunder');
    let hitCd = 0;
    for (let t = 0, dur = b.phase2 ? 3.2 : 2.6; t < dur; t += DT) {
      a0 += spin * DT; hitCd -= DT;
      const ds = dirs();
      ds.forEach((d, i) => { beams[i].g.rotation.y = Math.atan2(-d.y, d.x); if (hitCd <= 0 && inRect(b.pos, d, w, len)) { hitCd = 0.8; hurtPlayer(b.dmg * 0.9, b.pos); } });
      if (Math.random() < 0.5) { const d = ds[Math.floor(Math.random() * n)], r = rand(1, len); burst.emit(tmp.set(b.pos.x + d.x * r, 1.2, b.pos.z + d.y * r), hex, 1, 1, 0.3, 0.4); }
      yield 0;
    }
    beams.forEach(o => untele(b, o.h));
    yield 0.4;
  },
  *giro(b) {
    const R = b.radius + 1.4, T0 = warnT(b, 0.9), tg = telegraph(b, 'circle', { r:R }, b.pos.x, b.pos.z); sfx('warning'); b.model.act?.('slash', 0.9);
    for (let t = 0; t < T0; t += DT) { tg.set(t / T0); yield 0; }
    tg.set(1);
    // Persegue girando bem mais devagar que o jogador (6,5): mesmo encostado na parede dá para contornar e fugir.
    const body = b.model.body, sp = Math.min(3.8, 2.8 + lv() * 0.12) * (b.phase2 ? 1.08 : 1);
    for (let t = 0, sw = 0; t < (b.phase2 ? 2.6 : 2); t += DT) {
      moveToward(b, P.pos.x, P.pos.z, sp * DT); tg.group.position.set(b.pos.x, 0.04, b.pos.z); body.rotation.y += DT * 14;
      if (inCircle(b.pos.x, b.pos.z, R)) hurtPlayer(b.dmg * 0.7, b.pos);
      if ((sw -= DT) <= 0) { sw = 0.35; sfxAt('mobSwing', b.pos); }
      burst.emit(tmp.set(b.pos.x + rand(-R, R) * 0.7, 0.8, b.pos.z + rand(-R, R) * 0.7), b.def.rain ?? run.theme.accent, 1, 2, 0.3, 0.6);
      yield 0;
    }
    body.rotation.y = 0; untele(b, tg); yield 0.8; // tonto depois do giro: hora de bater
  },
  *eco(b) {
    // Xadrez de cristais em volta do jogador: estouram as casas de uma cor, depois as da outra (pise onde já estourou).
    const cell = 3.4, o = P.pos.clone(), color = b.def.rain ?? run.theme.accent, sets = [[], []];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const x = o.x + i * cell, z = o.z + j * cell; if (canStand(x, z, 0.3)) sets[(i + j) & 1].push(V().set(x, 0, z)); }
    b.model.act?.('summon', 1.2);
    for (let e = 0; e < (b.phase2 ? 3 : 2); e++) {
      const pts = sets[e & 1], T0 = warnT(b, e ? 0.8 : 1.0), tgs = pts.map(p => telegraph(b, 'circle', { r:1.5 }, p.x, p.z)); sfx('warning');
      for (let t = 0; t < T0; t += DT) { tgs.forEach(g => g.set(t / T0)); armsUp(b, t / T0); yield 0; }
      tgs.forEach(g => untele(b, g)); armsSlam(b);
      if (pts.some(p => inCircle(p.x, p.z, 1.5))) hurtPlayer(b.dmg * 1.1, null);
      for (const p of pts) { spike(p.x, p.z, color, 0, 2.2); spike(p.x + 0.6, p.z - 0.4, color, 0.05, 1.4); }
      sfx('bossAttack'); shake = Math.max(shake, 0.2);
      yield 0.1;
    }
  },
  *nova(b) {
    const R = b.radius + 4.5, color = b.def.slow ? 0x8fe0ff : b.def.rain ?? run.theme.accent;
    // Tempo para sair andando de colado nele até fora do círculo, mais uma folga de reação.
    const T0 = Math.max(warnT(b, 1.2), (R + 0.4 - b.radius) / 6.5 + 0.4), tg = telegraph(b, 'circle', { r:R }, b.pos.x, b.pos.z); sfx('warning');
    b.model.act?.('summon', T0);
    for (let t = 0; t < T0; t += DT) { tg.set(t / T0); armsUp(b, t / T0); b.flash = Math.sin(t * 30) > 0 ? 0.05 : 0; yield 0; }
    untele(b, tg); armsSlam(b);
    if (inCircle(b.pos.x, b.pos.z, R)) { hurtPlayer(b.dmg * 1.5, b.pos); if (b.def.slow) P.slowT = 2; }
    ringFx(b.pos, R + 0.5, color, 0.5, 1.5); burst.emit(tmp.set(b.pos.x, 0.6, b.pos.z), color, 60, 12, 0.7, 4);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, r = rand(1, R); spike(b.pos.x + Math.cos(a) * r, b.pos.z + Math.sin(a) * r, color, k * 0.01, 1.8); }
    shake = Math.max(shake, 0.4); sfx('meteor');
    yield 0.5;
  },
};
function* shockwave(center, dmg, gapAt) {
  const gap = 1.3, color = new THREE.Color(run.theme.accent).lerp(new THREE.Color(0xff3344), 0.5).multiplyScalar(2);
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64, 1, gapAt + gap / 2, Math.PI * 2 - gap), M.additive(color, 0.9, { side:THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(center.x, 0.1, center.z); scene.add(mesh);
  let hit = false;
  for (let r = 1.5; r < 24 && run && !run.won; r += 8.5 * DT) {
    mesh.scale.setScalar(r);
    if (!hit && P.y < 0.8) {
      const dx = P.pos.x - center.x, dz = P.pos.z - center.z, d = Math.hypot(dx, dz);
      const pa = Math.atan2(-dz, dx), off = Math.abs(((pa - gapAt) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (Math.abs(d - r) < Math.max(0.5, r * 0.06) && off > gap / 2) { hit = true; hurtPlayer(dmg, center); }
    }
    yield 0;
  }
  mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose();
}
// Ordem nova a cada volta (sem repetir o último golpe); os golpes de fúria (p2) só entram abaixo de 50% e o primeiro vem na hora.
function* bossAI(b) {
  yield 0.8;
  const fury = b.def.p2 ?? [];
  let last = null;
  while (true) {
    const order = b.def.patterns.filter(p => b.phase2 || !fury.includes(p)).sort(() => Math.random() - 0.5);
    if (order.length > 1 && order[0] === last) order.push(order.shift());
    if (!order.length) { yield 1; continue; }
    for (const p of order) {
      const now = b.phase2 && !b.furyDone && fury.length ? (b.furyDone = true, fury[0]) : p;
      b.pat = now; yield* PATTERNS[now](b); last = now;
      yield* chase(b, b.radius + 1.5, (b.phase2 ? 0.6 : 1.2) * (1 - 0.04 * (lv() - 1)), 2.5); // quem luta de longe também apanha
    }
  }
}

function updateMobs(dt) {
  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    if (m.dead) { if (!m.model.root.parent) mobs.splice(i, 1); continue; }
    if (m.dummy) { updateDummy(m, dt); continue; }
    const root = m.model.root;
    if (m.spawnT > 0) { m.spawnT -= dt; root.scale.setScalar(Math.max(0.01, m.scale * (1 - Math.max(0, m.spawnT) / 0.45))); }
    m.stun -= dt;
    if (m.knock.lengthSq() > 0.001) { tryMove(m.pos, m.knock.x * dt, m.knock.z * dt, m.radius * 0.8); m.knock.multiplyScalar(Math.max(0, 1 - dt * 8)); }
    for (const o of mobs) {
      if (o === m || o.dead) continue;
      const dx = m.pos.x - o.pos.x, dz = m.pos.z - o.pos.z, d = Math.hypot(dx, dz), min = (m.radius + o.radius) * 0.85;
      if (d < min && d > 0.001 && !m.boss) tryMove(m.pos, dx / d * (min - d) * 0.5, dz / d * (min - d) * 0.5, m.radius * 0.8);
    }
    const want = m.lockFace ?? Math.atan2(P.pos.x - m.pos.x, P.pos.z - m.pos.z);
    let diff = want - m.face; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); m.face += diff * Math.min(1, dt * 8);
    root.position.set(m.pos.x, m.y, m.pos.z); root.rotation.y = m.face;
    if (m.stun > 0) root.rotation.z = Math.sin(T * 30) * 0.05; else root.rotation.z = 0;
    // Animação simples por tipo.
    const sp = Math.hypot(m.pos.x - (m.lx ?? m.pos.x), m.pos.z - (m.lz ?? m.pos.z)) / Math.max(dt, 1e-4); m.lx = m.pos.x; m.lz = m.pos.z;
    m.mv = THREE.MathUtils.lerp(m.mv ?? 0, Math.min(1, sp / 2.5), 1 - Math.exp(-dt * 10));
    // Braços balançam ao andar quando não estão atacando.
    if (!m.model.rig && !m.posing && m.model.parts.armL && m.model.parts.armR) { const w = Math.sin(T * 5 + i) * 0.45 * m.mv + Math.sin(T * 1.5 + i) * 0.06; m.model.parts.armL.rotation.x = w; m.model.parts.armR.rotation.x = -w; }
    if (m.model.rig) {
      m.model.rig.move(m.mv, Math.max(0.8, sp / 4)); m.model.rig.update(m.stun > 0 ? 0 : dt); m.model.tick?.(dt);
    }
    const body = m.model.body;
    if (m.model.rig) { /* animado pelo esqueleto */ }
    else if (m.type === 'slime' || m.type === 'reiSlime' || m.type === 'magmaSlime') { m.squash = THREE.MathUtils.lerp(m.squash, 1, dt * 6); body.scale.set(1 / Math.sqrt(m.squash), m.squash, 1 / Math.sqrt(m.squash)); }
    else if (m.type === 'espirito' || m.type === 'arauto' || m.type === 'cristalino') { body.position.y = 0.4 + Math.sin(T * 3 + i) * 0.2; m.model.parts.rings?.forEach((r, k) => { r.rotation.z += dt * (k ? -1 : 1.4); }); }
    else body.position.y = Math.abs(Math.sin(T * 6 + i)) * 0.05;
    if (!m.model.rig) m.model.tick?.(dt);
    m.flash -= dt;
    if (m.regen && m.flash < -2.5 && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * m.regen * dt); // regenera sem apanhar por 2,5 s
    const on = m.flash > 0;
    if (on !== m.flashOn) { m.flashOn = on; m.model.flash(on ? 0.9 : 0); }
    if (m.aura) m.aura.material.opacity = m.stun > 0 ? 0.5 + 0.5 * Math.sin(T * 24) : 0.8; // atordoado: golpe pesado executa
    if (m.showBar && !m.boss) { m.bar.visible = true; m.bar.quaternion.copy(camera.quaternion).premultiply(qTmp.copy(root.quaternion).invert()); m.barFill.scale.x = Math.max(0.001, m.hp / m.maxHp); }
    if (m.boss && !m.phase2 && m.hp < m.maxHp * 0.5) { m.phase2 = true; m.speed *= 1.2; UI.banner('Fúria!', m.def.label, '#ff5a5a'); sfx('boss'); boost = 0.5; }
  }
}

function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.life -= dt; s.pos.addScaledVector(s.vel, dt); s.mesh.position.copy(s.pos); if (s.visualOffset) { s.visualTime += dt; s.mesh.position.addScaledVector(s.visualOffset, Math.max(0, 1 - s.visualTime / .08)); if (s.visualTime >= .08) s.visualOffset = null; }
    if (s.kind === 'orb') s.mesh.rotation.y += dt * 8;
    if (s.homing) {
      const m = nearestMob(14, s.pos);
      if (m) { tmp.set(m.pos.x - s.pos.x, 0, m.pos.z - s.pos.z).normalize().multiplyScalar(s.speed); s.vel.lerp(tmp, Math.min(1, dt * 6)).setLength(s.speed); }
      s.mesh.rotation.y = Math.atan2(s.vel.x, s.vel.z);
    }
    let done = s.life <= 0 || (mode === 'dungeon' && !world.canStand(s.pos.x, s.pos.z, 0.05));
    if (s.friendly) {
      if (s.rank >= 1 || s.kind === 'orb') burst.emit(s.pos, s.color, s.rank >= 2 ? 2 : 1, 0.3, 0.25, 0.2);
      if (!done) for (const m of mobs) {
        if (m.dead || m.spawnT > 0 || dist2(s.pos, m.pos) > s.r + m.radius) continue;
        if (s.kind === 'arrow') { const f = s.fall, k = f ? 1 - (1 - f.min) * Math.min(1, Math.max(0, (dist2(s.from, s.pos) - f.from) / (f.to - f.from))) : 1; hitMob(m, s.dmg * k, { knock:f ? 0.4 : 1.5, from:P.pos, color:s.color }); }
        done = true; break;
      }
      if (done && s.kind === 'orb') explode(s.pos, 2.1, s.dmg, s.color);
    } else {
      if (Math.random() < 0.5) burst.emit(s.pos, s.color, 1, 0.3, 0.25, 0.2);
      if (!done && dist2(s.pos, P.pos) < s.r + 0.5 && P.y < 1.2) { const hp0 = P.hp; hurtPlayer(s.dmg, s.pos, s.slow ? 'ice' : null); if (s.slow && P.hp < hp0 && !pb('ice')) P.slowT = 2; done = true; }
    }
    if (done) { s.mesh.removeFromParent(); shots.splice(i, 1); }
  }
}

// ---------- loot ----------
function dropLoot(item, at) {
  const L = M.createLootBeam(item);
  const p = new THREE.Vector3(at.x + rand(-1.2, 1.2), 0, at.z + rand(-1.2, 1.2));
  if (!canStand(p.x, p.z, 0.4)) p.set(at.x, 0, at.z);
  p.y = 0;
  L.group.position.copy(p);
  loots.push({ item, L, pos:p, t:0 });
  const rank = C.RARITY[item.rarity].rank;
  if (rank >= 2) { burst.emit(tmp.set(p.x, 1, p.z), C.RARITY[item.rarity].color, 30 + rank * 20, 6, 0.8, 4); ringFx(p, 3 + rank, C.RARITY[item.rarity].color, 0.5); sfx('loot'); }
  if (rank === 3) { shake = Math.max(shake, 0.4); boost = Math.max(boost, 0.5); UI.banner('Algo lendário caiu!', C.displayName(item), '#ffb52e'); sfx('boss'); }
  if (rank === 4) { shake = Math.max(shake, 0.9); boost = Math.max(boost, 1.2); UI.banner('ALGO MÍTICO CAIU!', C.displayName(item), '#ff2a4a', true); sfx('mythic'); UI.mythicFlash(); }
}
function dropOrb(at) {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), M.glow(0xff4466, 3)); mesh.position.set(at.x, 0.6, at.z); scene.add(mesh);
  orbs.push({ mesh, pos:new THREE.Vector3(at.x, 0, at.z) });
}
function updateLoots(dt) {
  for (let i = loots.length - 1; i >= 0; i--) {
    const l = loots[i]; l.t += dt; l.L.update(T + i);
    if (l.t < 0.5 || P.dead || dist2(l.pos, P.pos) > 1.6) continue;
    const res = C.addItem(save, l.item); persist();
    const R = C.RARITY[l.item.rarity], col = '#' + R.color.toString(16).padStart(6, '0');
    if (res.added) {
      run?.items.push(l.item); UI.toast(`${R.label}: ${C.displayName(l.item)}`, col);
      const eq = l.item.slot === 'arma' ? save.inventory.find(i => i.id === save.equipped.arma[l.item.cls]) : l.item.slot === 'skill' ? null : C.equippedItems(save)[l.item.slot];
      if (eq && C.itemPower(l.item) > C.itemPower(eq)) UI.toast('▲ Melhor que o seu! Equipe na Mochila', '#7dffa6');
    }
    if (R.rank >= 1 && res.added) tip('rare');
    if (R.rank >= 2) mission('epic');
    else UI.toast(`Mochila cheia: +${res.gems} gemas`, '#7fe9ff');
    if (R.rank >= 2) UI.banner(R.label + '!', C.displayName(l.item), col, R.rank >= 3);
    burst.emit(tmp.set(l.pos.x, 1, l.pos.z), R.color, 20, 4, 0.5, 3); sfx(R.rank >= 2 ? 'victory' : 'coin');
    l.L.group.removeFromParent(); loots.splice(i, 1);
    UI.hubBar(save, stats);
  }
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i]; o.mesh.rotation.y += dt * 3; o.mesh.position.y = 0.6 + Math.sin(T * 4 + i) * 0.1;
    if (dist2(o.pos, P.pos) > 1.4 || P.dead) continue;
    heal(0.25); o.mesh.removeFromParent(); orbs.splice(i, 1);
  }
}
function heal(frac) {
  const amount = Math.round(stats.hp * frac); P.hp = Math.min(stats.hp, P.hp + amount);
  const [sx, sy] = project(P.pos, 3.4); UI.number(sx, sy, `+${amount}`, 'heal');
  burst.emit(tmp.set(P.pos.x, 1.5, P.pos.z), 0x5aff8a, 14, 2, 0.6, 2); sfx('heal');
}
function gainXp(amount) {
  const ups = C.addXp(save, amount);
  if (ups) {
    rebuildHero(); P.hp = stats.hp;
    UI.banner('Subiu de nível!', `Nível ${save.lvl}`, '#ffd36b');
    burst.emit(tmp.set(P.pos.x, 1, P.pos.z), 0xffd36b, 50, 5, 1, 4); ringFx(P.pos, 4, 0xffd36b, 0.6); sfx('level');
  }
  persist(); UI.hubBar(save, stats);
}

// ---------- run (dungeon) ----------
function clearWorld() {
  stopGather();
  for (const m of mobs) { m.teles.forEach(t => t.dispose()); m.model.root.removeFromParent(); }
  for (const s of shots) s.mesh.removeFromParent();
  for (const l of loots) l.L.group.removeFromParent();
  for (const o of orbs) o.mesh.removeFromParent();
  for (const d of debris) d.mesh.removeFromParent();
  mobs.length = shots.length = loots.length = orbs.length = cos.length = debris.length = 0;
  run?.chest?.group.removeFromParent(); run?.exit?.group.removeFromParent(); run?.loose?.forEach(t => t.dispose());
  world?.dispose(); world = null;
}
function setTheme(T) {
  scene.background = new THREE.Color(T.fog); scene.fog = new THREE.Fog(T.fog, T.fogNear ?? 38, T.fogFar ?? 95);
  hemi.color.set(T.hemiSky); hemi.groundColor.set(T.hemiGround); sun.color.set(T.sun); sun.intensity = T.sunI;
  hemi.intensity = T.art ? .62 : .7; rim.intensity = T.art ? .28 : .6; scene.environmentIntensity = T.art ? .22 : .3; bloom.strength = T.art ? .3 : .6;
}

function enterHub() {
  clearWorld(); run = null; paused = false; UI.pauseMenu(false); UI.hideResults();
  world = buildHub(scene); setTheme(world.theme); prewarm(); world.yard.dummies.forEach(spawnDummy); setYard(false);
  syncNodes(true); Object.assign(pot, { used:0, limit:Infinity }); P.regen = null;
  // Martelo só faz som quando a forja é pedida (marteladas de trabalho são silenciosas).
  world.onHammer = forging => { if (forging && mode === 'hub') sfx('forge'); }; C.ensureDaily(save); world.setDaily(!save.daily.chest); world.setLogin(C.loginState(save).canClaim);
  mode = 'hub'; UI.setMode('hub'); input.clear(); sound.setMusic('hub');
  P.pos.copy(world.spawn); P.facing = Math.PI; P.dead = false; P.y = 0; P.busy = false; P.anim = null;
  rebuildHero(); P.hp = stats.hp;
  camPos.set(P.pos.x, 23, P.pos.z + 21);
  UI.questTrack(S.tutorialStep(save), save.story.tut); tip('hub');
}

function enterDungeon(level) {
  const def = C.DUNGEONS.find(d => d.level === level); if (!def) return;
  UI.close(); clearWorld();
  previewSkin = null; showcase = false;
  world = buildDungeon(scene, def, (Math.random() * 2 ** 31) | 0); setTheme(world.theme);
  run = { mats:{}, def, theme:world.theme, timeLeft:C.TIME_LIMIT, kills:0, items:[], xp0:totalXp(), lockedRoom:null, won:false, ending:false, bossRoom:world.rooms.find(r => r.kind === 'boss'), chest:null, exit:null, chestOpened:false };
  mode = 'dungeon'; UI.setMode('dungeon'); sound.setMusic(`dungeon_${def.theme}`); UI.resetHud(); UI.prompt(null); input.clear();
  const r0 = world.rooms[0]; P.pos.set(r0.cx, 0, r0.cz + 2); P.safe = P.pos.clone();
  prewarm(); vault.prewarm(bloomOn); P.facing = Math.PI; P.dead = false; P.y = 0; P.busy = false; P.anim = null;
  rebuildHero(); P.hp = stats.hp; P.cds.fill(0); P.buff.t = 0; P.slowT = 0; P.regen = null; P.rage = 0; P.perfectT = 0; P.comboI = 0; P.drawT = 0;
  Object.assign(pot, { used:0, cdUntil:0, limit:C.POTION_RUN_LIMIT });
  camPos.set(P.pos.x, 25, P.pos.z + 19);
  UI.banner(`Nível ${def.level}`, def.name, '#' + world.theme.accent.toString(16).padStart(6, '0'));
  if (def.twist) UI.toast(def.twist, '#ffd36b');
  sfx('boss'); story('enter', { id:level }); tip('dungeon'); tip('dodge');
}
function totalXp() { let x = save.xp; for (let l = 1; l < save.lvl; l++) x += C.xpToNext(l); return x; }

// Como cada arena abre (sorteado em layout.js, sem repetir na run).
const OBJ = {
  kill:['Derrote todos os inimigos', 'A barreira cai quando a sala estiver limpa.'],
  lever:['Puxe as alavancas', 'Chegue perto de cada alavanca e aperte F (ou toque no botão).'],
  orb:['Leve o orbe até o pedestal', 'Se você levar dano, o orbe cai no chão.'],
  survive:['Sobreviva', 'Aguente até a barreira cair sozinha.'],
  key:['Pegue a chave do elite', 'O elite com aura carrega a chave da sala.'],
  runes:['Pise em todas as runas', 'As runas apagadas ficam no chão da sala.'],
  mini:['Derrote o guardião', 'Um guardião protege esta sala.'],
};
const SURVIVE = 25;
const mobPick = () => { const pool = run.def.mobs; const t = pool[Math.floor(Math.random() * pool.length)]; return t === 'golem' && Math.random() < 0.5 ? pool[0] : t; };
// Elites não são bombas (a bomba explode sozinha e levaria a chave junto).
const elitePick = () => { const pool = run.def.mobs.filter(t => t !== 'bomba'); return pool[Math.floor(Math.random() * pool.length)]; };
function lockRoom(room) {
  world.setLocked(room, true); run.lockedRoom = room; sfx('warning');
  // Quem sobrou de uma emboscada entra junto: lá fora ficaria preso atrás da barreira.
  for (const m of mobs) if (!m.dead && !m.boss && !m.dummy && !world.canStand(m.pos.x, m.pos.z, 0.5, room)) { const p = roomSpot(room); if (p) { m.pos.set(p.x, 0, p.z); burst.emit(tmp.set(p.x, 0.5, p.z), run.theme.accent, 16, 4, 0.5, 2); } }
  if (room.kind === 'arena') {
    const type = room.obj?.type ?? 'kill', o = room.o = { type, t:0, total:0, next:2, over:false };
    if (type === 'kill') {
      const n = room.side ? 5 : 6 + Math.min(room.i, 3) * 2, first = Math.ceil(n * 0.6), elite = Math.random() < (room.side ? 0.4 : 0.5);
      room.pending = Array.from({ length:n - first }, mobPick);
      room.spawning = first;
      // Um mob por quadro: criar todos de uma vez dava um pico.
      go((function* () { for (let k = 0; k < first; k++) { if (k === 0 && elite) spawnElite(room, 1); else spawnInRoom(room, mobPick()); room.spawning--; yield 0; } })());
    } else {
      const first = type === 'mini' ? 2 : 3; room.spawning = first + 1;
      go((function* () {
        if (type === 'mini') { const p = roomSpot(room, 9) ?? room; run.mini = spawnMob(elitePick(), p.x ?? p.cx, p.z ?? p.cz, { mini:true, elite:C.eliteAffixes(2) }); camFocus = { pos:run.mini.pos, t:1.2 }; sfx('boss'); }
        else if (type === 'key') { const e = spawnElite(room, 1); e.key = true; e.aura.scale.multiplyScalar(1.3); }
        room.spawning--; yield 0;
        for (let k = 0; k < first; k++) { spawnInRoom(room, mobPick()); room.spawning--; yield 0; }
      })());
    }
    if (!room.side) UI.banner(`Sala ${world.rooms.filter(r => r.cleared && r.kind === 'arena' && !r.side).length + 1}`, OBJ[type][0], '#' + run.theme.accent.toString(16).padStart(6, '0'));
    if (type !== 'kill') tip(`gate:${type}`);
    if (type !== 'kill' && !(run.seenObj ??= new Set()).has(type)) { run.seenObj.add(type); UI.toast(OBJ[type][1], '#ffd36b'); }
  } else {
    UI.banner('Chefe', C.BOSSES[run.def.boss].label, '#ff5a5a', true); sfx('boss');
    tip('boss');
    run.boss = spawnMob(run.def.boss, room.cx, room.cz - room.r / 3, { boss:true }); sound.setMusic(`boss_${run.def.theme}`);
    camFocus = { pos:run.boss.pos, t:1.6 }; // apresentação do chefe
  }
}
// Ponto livre dentro da sala (longe do herói), para nascer ou ser puxado para dentro.
function roomSpot(room, minD = 7) {
  for (let tries = 0; tries < 30; tries++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * ((room.sr ?? room.r) - 3);
    const x = room.cx + Math.cos(a) * r, z = room.cz + Math.sin(a) * r;
    if (Math.hypot(x - P.pos.x, z - P.pos.z) > minD && world.canStand(x, z, 1, room)) return { x, z };
  }
  return null;
}
function spawnInRoom(room, type, opts) {
  const p = roomSpot(room);
  return p ? spawnMob(type, p.x, p.z, opts) : spawnMob(type, room.cx, room.cz, opts);
}
function spawnElite(room, n, at = null) {
  const aff = C.eliteAffixes(n), type = elitePick(), m = at ? spawnMob(type, at.x, at.z, { elite:aff }) : spawnInRoom(room, type, { elite:aff });
  UI.toast(`Elite: ${m.def.label} (${aff.map(a => C.ELITE_AFFIXES[a].label).join(', ')})`, '#ffc23a'); tip('elite');
  return m;
}
// Elite explosivo: círculo laranja onde caiu e explosão logo depois.
function* blast(at, dmg) {
  const R = 3.2, tg = M.createTelegraph('circle', { r:R, color:0xff9a2a }); tg.group.position.set(at.x, 0.04, at.z); (run.loose ??= []).push(tg); sfx('warning');
  for (let t = 0; t < 0.9; t += DT) { tg.set(t / 0.9); yield 0; }
  tg.dispose(); run.loose.splice(run.loose.indexOf(tg), 1);
  if (run.won || run.ending) return;
  if (inCircle(at.x, at.z, R)) hurtPlayer(dmg, at);
  ringFx(at, R, 0xff6a1a, 0.4, 1); burst.emit(tmp.set(at.x, 0.6, at.z), 0xff6a1a, 40, 9, 0.7, 4); shake = Math.max(shake, 0.3); sfx('meteor');
}
function dropKey(at) {
  const g = new THREE.Group(), km = M.glow(0xffd36b, 2.5); g.position.set(at.x, 0, at.z); world.group.add(g);
  const bow = new THREE.Mesh(M.shared('keyBow', () => new THREE.TorusGeometry(0.28, 0.08, 6, 14)), km); bow.position.y = 1.45;
  const shaft = new THREE.Mesh(M.shared('keyShaft', () => new THREE.BoxGeometry(0.1, 0.75, 0.1)), km); shaft.position.y = 0.95;
  const tooth = new THREE.Mesh(M.shared('keyTooth', () => new THREE.BoxGeometry(0.24, 0.09, 0.1)), km); tooth.position.set(0.12, 0.68, 0);
  g.add(bow, shaft, tooth); run.key = { g, x:at.x, z:at.z };
  burst.emit(tmp.set(at.x, 1, at.z), 0xffd36b, 30, 4, 0.6, 3); sfx('loot'); UI.toast('A chave caiu! Pegue para abrir a sala.', '#ffd36b');
}
// Objetivo cumprido: a barreira cai e quem sobrou na sala morre junto.
function openRoom(r, purge) {
  r.cleared = true; world.setLocked(r, false); run.lockedRoom = null; if (r.o) r.o.over = true;
  if (purge) { for (const m of mobs) if (!m.dead && !m.boss && !m.dummy) { m.purged = true; killMob(m); } run.mini = null; }
  if (run.key) { run.key.g.removeFromParent(); run.key = null; }
  heal(0.2); UI.toast('Sala limpa! O caminho abriu.', '#7fe9ff'); sfx('coin');
  // Beco lateral: recompensa por explorar fora do caminho.
  if (r.side) { sideLoot(false, new THREE.Vector3(r.cx, 0, r.cz)); UI.toast('Tesouro escondido encontrado!', '#ffd36b'); }
}
// Beco lateral e baú secreto: gemas e materiais; equipamento só muito raro no secreto.
function sideLoot(secret, at) {
  const rw = C.sideReward(run.def.level, secret);
  save.gems += rw.gems; UI.toast(`+${rw.gems} gemas`, '#7fe9ff');
  if (rw.gear) dropLoot(C.rollDrop('chest', { cls:save.cls, level:run.def.level, min:'raro' }), at);
  gainMats(rw.mats, at);
}
// Objetivos que não são "matar todos": reforços chegam enquanto o objetivo não termina.
function updateObjective(r, dt) {
  const o = r.o, alive = mobs.filter(m => !m.dead).length, surv = o.type === 'survive';
  o.t += dt;
  const cap = surv ? 6 : o.type === 'mini' ? 3 : 4, max = surv ? 99 : o.type === 'mini' ? 6 : 6 + Math.min(r.i, 3) * 2;
  if (r.spawning <= 0 && alive < cap && o.total < max && (o.next -= dt) <= 0) {
    o.next = surv ? 1.3 : o.type === 'mini' ? 5 : 2.4; o.total++;
    if (o.total === 3 && o.type !== 'mini' && o.type !== 'key' && Math.random() < 0.35) spawnElite(r, 1); else spawnInRoom(r, mobPick());
  }
  const props = world.props, mine = list => list.filter(p => p.zone === r);
  let done = false;
  if (o.type === 'survive') done = o.t >= SURVIVE;
  if (o.type === 'mini') done = r.spawning <= 0 && (!run.mini || run.mini.dead);
  if (o.type === 'lever') done = mine(props.levers).every(l => l.on);
  if (o.type === 'runes') {
    for (const ru of mine(props.runes)) if (!ru.on && Math.hypot(P.pos.x - ru.x, P.pos.z - ru.z) < 1) {
      ru.on = true; ru.m.material.color.set(run.theme.accent).multiplyScalar(3.5); ru.core.material.color.set(run.theme.accent).multiplyScalar(2);
      sfx('latch'); burst.emit(tmp.set(ru.x, 0.5, ru.z), run.theme.accent, 20, 3, 0.6, 3);
    }
    done = mine(props.runes).every(ru => ru.on);
  }
  if (o.type === 'orb') for (const ob of mine(props.orbs)) {
    ob.dropT = (ob.dropT ?? 0) - dt;
    if (!ob.carried && !ob.placed && ob.dropT <= 0 && Math.hypot(P.pos.x - ob.x, P.pos.z - ob.z) < 1.4) { ob.carried = true; ob.homeRing.visible = false; sfx('equip'); UI.toast('Orbe na mão! Leve até o pedestal.', '#7fe9ff'); }
    if (ob.carried) {
      ob.x = P.pos.x; ob.z = P.pos.z; ob.orb.position.set(P.pos.x, 4.8 + P.y + Math.sin(T * 5) * 0.1, P.pos.z); // acima do nome
      if (Math.hypot(P.pos.x - ob.ped.x, P.pos.z - ob.ped.z) < 1.9) { ob.carried = false; ob.placed = true; ob.orb.position.set(ob.ped.x, 1.6, ob.ped.z); ob.socketM.color.set(run.theme.accent).multiplyScalar(3); ob.ring.visible = false; sfx('chestOpen'); }
    }
    done = ob.placed;
  }
  if (o.type === 'key' && run.key && Math.hypot(P.pos.x - run.key.x, P.pos.z - run.key.z) < 1.5) { done = true; sfx('chestOpen'); }
  if (run.key) run.key.g.rotation.y += dt * 2;
  if (done) { UI.banner('Sala aberta!', OBJ[o.type][0], '#7fe9ff'); openRoom(r, true); }
}
// Dano faz o herói soltar o orbe onde está.
function dropCarried() {
  for (const ob of world?.props?.orbs ?? []) if (ob.carried) { ob.carried = false; ob.dropT = 0.8; ob.orb.position.set(ob.x, 1.2, ob.z); UI.toast('O orbe caiu!', '#ff8a96'); }
}
// Placa de pressão: losango acende, círculo vermelho e espinhos saem do chão (ferem mobs também).
function* trapFire(t) {
  t.glyphM.color.set(0xff3030).multiplyScalar(3); sfx('warning');
  const R = 1.9, tg = M.createTelegraph('circle', { r:R, color:0xff4040 }); tg.group.position.set(t.x, 0.04, t.z); (run.loose ??= []).push(tg);
  for (let k = 0; k < 0.55; k += DT) { tg.set(k / 0.55); yield 0; }
  tg.dispose(); run.loose.splice(run.loose.indexOf(tg), 1);
  if (run.won || run.ending) return;
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; spike(t.x + Math.cos(a) * 0.9, t.z + Math.sin(a) * 0.9, 0x9a9aa8, 0, 1.6); }
  spike(t.x, t.z, 0x9a9aa8, 0, 2); sfx('golemSlam');
  if (inCircle(t.x, t.z, R)) hurtPlayer(stats.hp * 0.12, null);
  for (const m of mobs) if (!m.dead && !m.boss && !m.dummy && Math.hypot(m.pos.x - t.x, m.pos.z - t.z) < R + m.radius) hitMob(m, m.maxHp * 0.3, { silent:true, color:0xff4040 });
  yield 1.2; t.glyphM.color.set(0x8a2a2a).multiplyScalar(0.7);
}
function updateTraps(dt) {
  for (const t of world.props.traps) {
    t.cd -= dt;
    if (t.cd > 0 || P.dead || P.y > 0.5 || P.dashT > 0 || Math.hypot(P.pos.x - t.x, P.pos.z - t.z) > 0.95) continue;
    t.cd = 5; go(trapFire(t));
  }
}
// Emboscada: ao passar pelo ponto marcado no corredor, inimigos saltam à frente e atrás.
function updateAmbush() {
  if (run.lockedRoom || run.won || run.ending) return;
  for (const a of world.ambush) {
    if (a.done || Math.hypot(P.pos.x - a.x, P.pos.z - a.z) > 4) continue;
    a.done = true; UI.banner('Emboscada!', 'Inimigos saltam das sombras', '#ff8a5a'); sfx('warning'); shake = Math.max(shake, 0.25);
    const n = 3 + (run.def.level >= 4 ? 1 : 0), elite = Math.random() < 0.4;
    go((function* () {
      for (let k = 0; k < n; k++) {
        let p = null;
        for (let t = 0; t < 60 && !p; t++) { const ang = Math.random() * Math.PI * 2, d = rand(5, 9), x = P.pos.x + Math.cos(ang) * d, z = P.pos.z + Math.sin(ang) * d; if (world.canStand(x, z, 0.8) && !world.ch.inGap(x, z) && !world.ch.hazardAt(x, z, T)) p = { x, z }; }
        if (p) { if (k === 0 && elite) spawnElite(null, 1, p); else spawnMob(mobPick(), p.x, p.z); }
        yield 0.12;
      }
    })());
  }
}
// Desafios do caminho: queda no abismo, espinhos, perigos do tema, runas do portão e dicas.
const HINTS = { gap:'Abismo à frente! Use a esquiva (Shift / botão) para pular.', spikes:'Espinhos ritmados: passe quando abaixarem.', gate:'Portão trancado: pise nas 3 runas da sala anterior.', lavaflow:'Ponte quebrada! Atravesse pela viga estreita ou a lava queima.' };
function updateChallenges() {
  const ch = world.ch; if (!ch || P.dead || run.ending) return;
  world.dashing = P.dashT > 0;
  if (P.dashT <= 0 && P.y < 0.5) {
    if (ch.inGap(P.pos.x, P.pos.z)) {
      P.pos.copy(P.safe); P.hp = Math.max(1, P.hp - Math.round(stats.hp * 0.1)); P.iframe = 0.8;
      UI.hurtFlash(); UI.toast('Caiu no abismo! Use a esquiva para atravessar.', '#ff8a96'); sfx('damage'); shake = Math.max(shake, 0.3);
    } else if (canStand(P.pos.x, P.pos.z, 0.5)) P.safe.copy(P.pos);
  }
  if (ch.spikeHit(P.pos.x, P.pos.z, T)) hurtPlayer(stats.hp * 0.15, null);
  const hz = ch.hazardAt(P.pos.x, P.pos.z, T); if (hz) hurtPlayer(stats.hp * hz.dmg, null, hz.type === 'lava' ? 'fire' : hz.type === 'frost' ? 'ice' : null);
  const rr = ch.stepRunes(P.pos.x, P.pos.z);
  if (rr === 'lit') { sfx('latch'); UI.toast('Runa acesa!', '#7fe9ff'); burst.emit(tmp.set(P.pos.x, 0.5, P.pos.z), run.theme.accent, 20, 3, 0.6, 3); }
  if (rr === 'open') { sfx('chestOpen'); UI.banner('Portão aberto!', 'As runas responderam', '#7fe9ff'); }
  const hint = ch.hintAt(P.pos.x, P.pos.z); if (hint) UI.toast(HINTS[hint], '#ffd36b');
}
function updateRun(dt) {
  updateChallenges(); updateTraps(dt); updateAmbush();
  if (!run.won && !run.ending) {
    run.timeLeft -= dt;
    if (run.timeLeft <= 0) { run.timeLeft = 0; endRun(false, 'O tempo acabou antes de vencer o chefe.'); }
  }
  const room = world.roomAt(P.pos.x, P.pos.z, 2);
  if (room && !room.cleared && !room.locked && !run.ending) lockRoom(room);
  const r = run.lockedRoom;
  if (r?.kind === 'arena' && r.o?.type === 'kill') {
    const alive = mobs.filter(m => !m.dead).length;
    if (r.spawning > 0) { /* ainda surgindo */ }
    else if (r.pending.length && alive <= 2) { const list = r.pending.splice(0); r.spawning = list.length; go((function* () { for (const t of list) { spawnInRoom(r, t); r.spawning--; yield 0; } })()); }
    else if (!r.pending.length && alive === 0) openRoom(r, false);
  } else if (r?.kind === 'arena' && r.o && !r.o.over) updateObjective(r, dt);
  // Coisas com F/toque: alavanca, parede rachada, baú secreto e o baú do chefe (o mais perto ganha).
  let act = null, label = null, best = Infinity;
  const offer = (x, z, range, text, fn) => { const d = Math.hypot(P.pos.x - x, P.pos.z - z); if (d < range && d < best) { best = d; label = text; act = fn; } };
  if (!P.dead && !run.ending) {
    for (const l of world.props.levers) if (!l.on && l.zone === r) offer(l.x, l.z, 1.9, 'Puxar alavanca', () => pullLever(l));
    const sw = world.ch.secret; if (sw && !sw.broken) {
      offer(sw.x, sw.z, 3, 'Quebrar parede rachada', () => breakWall(sw));
      if (!sw.hinted && Math.hypot(P.pos.x - sw.x, P.pos.z - sw.z) < 8) { sw.hinted = true; UI.toast('Essa parede parece rachada...', '#ffd36b'); }
    }
    for (const c of world.props.chests) if (!c.opened) offer(c.x, c.z, 2.4, 'Abrir baú secreto', () => openSecretChest(c));
    if (run.chest && !run.chestOpened) offer(run.chest.group.position.x, run.chest.group.position.z, 3.2, 'Abrir baú', () => { run.chestOpened = true; go(openChest()); });
  }
  UI.prompt(label);
  if (run.chest && !run.chestOpened) run.chest.beam.material.opacity = 0.25 + Math.sin(T * 4) * 0.1;
  if (act && (input.take('interact') || promptTap)) act();
  promptTap = false;
  if (run.exit && dist2(P.pos, run.exit.group.position) < 1.9) endRun(true, `Chefe derrotado em ${UI.fmtTime(run.time)}.`);
  run.exit?.update(T);
}
function pullLever(l) {
  l.on = true; l.knobM.color.set(0x7dff9a).multiplyScalar(2.5); l.ring.visible = false; sfx('latch'); burst.emit(tmp.set(l.x, 1.2, l.z), 0x7dff9a, 20, 3, 0.5, 2);
  go((function* () { for (let t = 0; t < 0.25; t += DT) { l.arm.rotation.x = -0.7 + 1.4 * (t / 0.25); yield 0; } l.arm.rotation.x = 0.7; })());
  const left = world.props.levers.filter(o => o.zone === l.zone && !o.on).length;
  if (left) UI.toast(`Alavanca puxada! Falta ${left}.`, '#7fe9ff');
}
function breakWall(sw) {
  sw.broken = true; sw.g.visible = false; spawnDebris(tmp.set(sw.x, 0, sw.z).clone(), 'rubble', 1.3); shake = Math.max(shake, 0.35); sfx('golemSlam');
  UI.banner('Passagem secreta!', 'Um beco escondido', '#ffd36b');
}
function openSecretChest(c) {
  c.opened = true; sfx('chestOpen'); boost = 0.4;
  go((function* () { for (let t = 0; t < 0.5; t += DT) { c.chest.lid.rotation.x = THREE.MathUtils.lerp(c.chest.lid.rotation.x, -1.9, 1 - Math.exp(-DT * 12)); c.chest.beam.material.opacity = 0.25 * (1 - t / 0.5); yield 0; } c.chest.beam.visible = false; })());
  const at = new THREE.Vector3(c.x, 0, c.z);
  sideLoot(true, at);
  UI.toast('Baú secreto aberto!', '#ffd36b');
}
function bossDefeated(b) {
  run.won = true; run.time = C.TIME_LIMIT - run.timeLeft; sound.setMusic(null); mission('wins'); mission('fast', run.time);
  for (const m of mobs) if (!m.dead && m !== b) { m.dead = true; m.teles.forEach(t => t.dispose()); m.model.root.removeFromParent(); }
  UI.banner('Vitória!', `${b.def.label} caiu em ${UI.fmtTime(run.time)}`, '#ffd36b', true);
  sfx('victory'); shake = 0.5; boost = 0.6;
  gainMats(C.rollMaterials('boss', run.def.level), b.pos); // os 3 itens vêm do baú do chefe (rollChest, com pity)
  go(chestArrives(run.bossRoom, b.pos.clone()));
  const fr = C.finishRun(save, { level:run.def.level, won:true, time:run.time }); run.gems = fr.gems; persist();
  story('boss'); story('win', { id:run.def.level });
  const pg = S.rollPage(save, run.def.level);
  if (pg) {
    run.page = pg.page; persist();
    go((function* () {
      yield 1.2; UI.banner('Página do diário!', `${pg.page.place} · ${pg.page.n}/3`, '#e8d9a8'); sfx('page'); tip('page');
      if (pg.setDone) UI.toast(`Diário de ${pg.page.place} completo: +${S.PAGE_SET_GEMS} gemas`, '#7fe9ff');
      if (pg.allDone) UI.toast(`Título novo: ${S.PAGE_TITLE}!`, '#ffd36b');
    })());
  }
}
// Depois da vitória: pausa curta, o baú cai do céu num ponto longe do jogador e só abre quando ele interage.
function* chestArrives(room, at) {
  yield 2.2;
  if (!run || run.ending) return;
  const away = new THREE.Vector3(room.cx - P.pos.x, 0, room.cz - P.pos.z);
  const spot = away.lengthSq() > 9 ? new THREE.Vector3(room.cx, 0, room.cz) : new THREE.Vector3(room.cx, 0, room.cz).addScaledVector(away.lengthSq() ? away.normalize() : new THREE.Vector3(0, 0, -1), 5);
  const ch = M.createChest(); ch.group.position.set(spot.x, 14, spot.z);
  ch.beam.material.color.set(0xffd36b); ch.beam.scale.set(0.35, 1, 0.35); sfx('warning');
  for (let t = 0; t < 0.6; t += DT) { const k = t / 0.6; ch.group.position.y = 14 * (1 - k * k); ch.group.rotation.y = (1 - k) * 4; ch.beam.material.opacity = 0.35 * k; yield 0; }
  ch.group.position.y = 0; ch.group.rotation.y = 0;
  shake = Math.max(shake, 0.35); boost = Math.max(boost, 0.3); sfx('bossAttack');
  ringFx(spot, 4, 0xffd36b, 0.5, 1); burst.emit(tmp.set(spot.x, 0.4, spot.z), 0xc9b79a, 30, 7, 0.6, 2.5); burst.emit(tmp.set(spot.x, 1, spot.z), 0xffd36b, 30, 4, 0.8, 4);
  run.chest = ch;
  run.exit = M.createPortal(0x7fe9ff, 1.8); run.exit.group.position.set(room.cx, 0, room.cz - room.r + 3.5);
  UI.toast('Um baú caiu! Abra (F) e depois entre no portal.', '#ffd36b');
}
// Baú final: os itens vão direto para a mochila e a tela do baú faz a revelação.
function* openChest() {
  const ch = run.chest, lvl = run.def.level;
  const items = C.rollChest(save, lvl);
  for (const it of items) { const r = C.addItem(save, it); if (r.added) run.items.push(it); if (C.RARITY[it.rarity].rank >= 2) mission('epic'); }
  persist(); UI.prompt(null);
  const best = items.reduce((a, b) => C.RARITY[b.rarity].rank > C.RARITY[a.rarity].rank ? b : a), R = C.RARITY[best.rarity];
  let closed = false; vault.open(items, () => { closed = true; UI.hubBar(save, stats); });
  while (!closed) yield 0;
  ch.beam.material.color.set(R.color);
  const bw = [0.3, 0.45, 0.65, 1, 1.3][R.rank];
  for (let t = 0; t < 2.6; t += DT) {
    ch.lid.rotation.x = THREE.MathUtils.lerp(ch.lid.rotation.x, -1.9, 1 - Math.exp(-DT * 12));
    ch.beam.scale.set(bw, 1, bw); ch.beam.material.opacity = Math.max(0, (0.25 + R.rank * 0.2) * (1 - t / 2.6));
    ch.shock.material.color.set(R.color).multiplyScalar(2); ch.shock.scale.setScalar(1 + t * 7 * (0.4 + R.rank * 0.25)); ch.shock.material.opacity = Math.max(0, 1 - t * 1.2) * (0.3 + R.rank * 0.25);
    yield 0;
  }
}
function endRun(won, reason) {
  if (!run || run.ending) return;
  run.ending = true;
  if (!won) { C.finishRun(save, { level:run.def.level, won:false, time:0 }); tip('death'); persist(); UI.banner('Fim de jogo', P.dead ? 'Você caiu!' : run.timeLeft <= 0 ? 'Tempo esgotado!' : 'Você saiu', '#ff5a5a', true); sfx('defeat'); }
  const r = run;
  go((function* () {
    yield won ? 0.2 : 2.0;
    mode = 'results'; UI.setMode('results');
    UI.results({ won, reason, page:r.page, time:won ? r.time : C.TIME_LIMIT - r.timeLeft, kills:r.kills, xp:Math.max(0, totalXp() - r.xp0), gems:won ? r.gems : 0, items:r.items, mats:r.mats });
    UI.hubBar(save, stats);
  })());
}

// ---------- hub ----------
function updateHub(dt) {
  const inYard = dist2(world.yard, P.pos) < world.yard.r;
  if (inYard !== yard.on) { setYard(inYard); if (inYard) tip('treino'); }
  if (yard.on && (yard.ui -= dt) <= 0) { yard.ui = 0.25; UI.yard(yardStats()); }
  sound.hum(1 - dist2(world.portalPos, P.pos) / 13);
  station = world.stations.find(s => dist2(s.pos, P.pos) < s.r) ?? null;
  const node = station || gather ? null : nearNode();
  if (gather) updateGather(dt);
  UI.prompt(gather || UI.isOpen() ? null : station ? station.label : node ? nodePrompt(node) : null);
  if (input.take('interact') && !gather && !UI.isOpen()) { if (station) openStation(station); else if (node) startGather(node); }
  if ((nodeCheck -= dt) <= 0) { nodeCheck = 1; respawnNodes(); }
  world.update(T, P.pos);
  if (dist2(world.valeCenter, P.pos) < 12) tip('vale');
  questArrow();
}
// Seta dos primeiros passos: em cima do alvo quando ele aparece na tela, senão presa na borda apontando para ele.
function questArrow() {
  const t = S.tutorialStep(save), at = !t || UI.isOpen() ? null : t.mark === 'vale' ? world.valeCenter : world.stations.find(s => s.id === t.mark)?.pos;
  if (!at || dist2(at, P.pos) < 3) { UI.questArrow(null); return; }
  const [x, y] = project(at, 4.6), behind = tmp2.z > 1, m = 48;
  if (!behind && x > m && x < innerWidth - m && y > m && y < innerHeight - m) { UI.questArrow(x, y, null); return; }
  const cx = innerWidth / 2, cy = innerHeight / 2, dx = (x - cx) * (behind ? -1 : 1), dy = (y - cy) * (behind ? -1 : 1);
  const k = Math.min((cx - m) / Math.max(1e-6, Math.abs(dx)), (cy - m) / Math.max(1e-6, Math.abs(dy)));
  UI.questArrow(cx + dx * k, cy + dy * k, Math.atan2(dy, dx));
}

// ---------- coleta no Vale ----------
// F perto de um veio/moita: o herói troca a arma pela ferramenta, bate algumas vezes e o anel enche.
let gather = null, nodeCheck = 0;
function syncNodes(instant) { const now = Date.now(); for (const n of world.nodes) world.setNode(n.id, C.nodeReady(save, n.id, now), instant); }
function respawnNodes() {
  const now = Date.now();
  for (const n of world.nodes) if (n.target === 0 && C.nodeReady(save, n.id, now)) {
    world.setNode(n.id, true);
    if (dist2(n, P.pos) < 18) { burst.emit(tmp.set(n.x, 1, n.z), C.MATERIALS[C.NODES[n.type].mat].color, 14, 2, 0.6, 2); sfx('reapDone'); }
  }
}
function nearNode() { let best = null, bd = 2.3; for (const n of world.nodes ?? []) { const d = dist2(n, P.pos); if (d < bd) { bd = d; best = n; } } return best; }
function nodePrompt(n) {
  const N = C.NODES[n.type], label = C.MATERIALS[N.mat].label;
  if (!C.nodeReady(save, n.id)) return `${label}: volta em ${UI.fmtTime(C.nodeLeft(save, n.id))}`;
  if (save.tools[N.tool] < N.tier) return `${label}: precisa de ${C.toolName(N.tool, N.tier)}`;
  return `${C.TOOLS[N.tool].verb} ${label}`;
}
function startGather(n) {
  const N = C.NODES[n.type]; tip('gather');
  if (!C.nodeReady(save, n.id)) { UI.toast(`Esgotado. Volta em ${UI.fmtTime(C.nodeLeft(save, n.id))}`, '#ffd36b'); return; }
  if (save.tools[N.tool] < N.tier) { UI.toast(`Precisa de ${C.toolName(N.tool, N.tier)}: o ferreiro Brakk melhora sua ferramenta`, '#ff8a96'); sfx('warning'); return; }
  if ((save.mats[N.mat] ?? 0) >= C.MAT_CAP) { UI.toast(`Bolsa cheia de ${C.MATERIALS[N.mat].label} (${C.MAT_CAP})`, '#ffd36b'); sfx('warning'); return; }
  const tool = M.createTool(N.tool, save.tools[N.tool]);
  if (weapon) weapon.group.visible = false;
  hero.mount.add(tool); faceTo(n);
  gather = { n, N, t:0, dur:C.gatherTime(save, n.type), swing:0, tool, cam:gatherCam(n) };
}
function stopGather() {
  if (!gather) return;
  gather.tool.removeFromParent(); if (weapon) weapon.group.visible = true;
  gather = null; UI.gatherRing(null);
}
function updateGather(dt) {
  const g = gather, n = g.n, mine = g.N.tool === 'picareta';
  g.t += dt; g.swing -= dt;
  // Minerar: golpes de picareta em loop (o impacto cai no meio do clipe). Ervas: o herói se abaixa e puxa a planta.
  const [every, clip, hitAt] = mine ? [0.6, 0.5, 0.25] : [1.1, 1.05, 0.55];
  if (g.swing <= 0 && g.t < g.dur - hitAt) {
    g.swing = every; play(mine ? 'mine' : 'reap', clip); faceTo(n);
    go((function* () {
      yield hitAt; if (gather !== g) return;
      world.hitNode(n.id); sfx(mine ? 'mine' : 'reap');
      if (mine) { burst.emit(tmp.set(n.x, 0.8, n.z), 0xc9b79a, 10, 3.5, 0.45, 2); burst.emit(tmp.set(n.x, 0.9, n.z), 0xffd27a, 8, 5, 0.25, 1); }
      else burst.emit(tmp.set(n.x, 0.5, n.z), 0x5fae48, 12, 2.2, 0.7, 2.5);
    })());
  }
  const [sx, sy] = project(n, 2.6); UI.gatherRing(sx, sy, g.t / g.dur);
  if (g.t < g.dur) return;
  stopGather();
  const r = C.gatherNode(save, n.id, n.type);
  if (!r.ok) return;
  world.setNode(n.id, false);
  const Mt = C.MATERIALS[r.mat];
  UI.number(sx, sy, `+${r.n} ${Mt.label}`, 'mat');
  burst.emit(tmp.set(n.x, 1, n.z), Mt.color, 24, 4, 0.6, 3); sfx(mine ? 'mineBreak' : 'reapDone');
  mission('gather', r.n); story('mat', { id:r.mat, n:r.n });
  if (r.up) { UI.banner('Coleta subiu!', `Nível ${r.up}`, '#7dffa6'); sfx('level'); }
  learned(r.learned); persist();
}
function learned(ids) { for (const id of ids ?? []) { UI.toast(`Receita nova no livro: ${C.POTIONS[id].label}!`, '#c77dff'); sfx('book'); } }
// Materiais de dungeon: vão direto para a bolsa (sem ocupar a mochila).
function gainMats(mats, at) {
  const list = Object.entries(mats); if (!list.length) return;
  C.addMaterials(save, mats); learned(C.learnRecipes(save));
  for (const [id, n] of list) {
    const Mt = C.MATERIALS[id]; if (run) run.mats[id] = (run.mats[id] ?? 0) + n;
    story('mat', { id, n });
    UI.toast(`+${n} ${Mt.label}`, hexCol(Mt.color)); burst.emit(tmp.set(at.x, 1, at.z), Mt.color, 16, 3, 0.6, 3);
  }
  sfx('loot'); persist();
}

// ---------- poções ----------
// pot: recarga e limite por run (na dungeon 4; no hub sem limite). P.pb[buff] = { until, v } dos tônicos de 2 min.
const pot = { t:0, cdUntil:0, used:0, limit:Infinity };
function pb(k) { const b = P.pb[k]; return b && b.until > T ? b.v : 0; }
function usePotion(id = save.belt) {
  const R = C.POTIONS[id];
  if (!R) { UI.toast('Sem poção no cinto: prepare com a alquimista do Vale', '#ffd36b'); return false; }
  if (R.kind !== 'buff' && P.hp >= stats.hp) { UI.toast('Vida cheia', '#7dffa6'); return false; }
  pot.t = T; const res = C.drinkPotion(save, id, pot);
  if (!res.ok) {
    UI.toast(res.reason === 'recarga' ? `Poção em recarga (${Math.ceil(res.left)}s)` : res.reason === 'limite' ? `Limite de ${pot.limit} poções por dungeon` : `Acabou: ${R.label}`, '#ff8a96');
    sfx('warning'); return false;
  }
  if (R.kind === 'heal') heal(R.heal);
  else if (R.kind === 'regen') P.regen = { left:R.dur, rate:stats.hp * R.heal / R.dur };
  else { P.pb[R.buff] = { until:T + C.POTION_BUFF, v:R.v }; UI.toast(`${R.label}: ${R.desc}`, hexCol(R.color)); }
  burst.emit(tmp.set(P.pos.x, 1.2, P.pos.z), R.color, 22, 3, 0.6, 3); ringFx(P.pos, 2, R.color, 0.4); sfx('drink');
  persist(); UI.refresh(); return true;
}
const BUFF_NAME = Object.fromEntries(Object.values(C.POTIONS).filter(R => R.buff).map(R => [R.buff, R.label]));
function potionHud() {
  const R = C.POTIONS[save.belt];
  UI.potionHud(R ? { label:R.label, color:R.color, n:save.potions[save.belt] ?? 0, cd:Math.max(0, pot.cdUntil - T), max:C.potionCd(save), left:pot.limit - pot.used, lim:pot.limit } : null);
  const list = Object.entries(P.pb).filter(([, b]) => b.until > T).map(([k, b]) => ({ k, label:BUFF_NAME[k], left:b.until - T, color:hexCol(Object.values(C.POTIONS).find(R => R.buff === k).color) }));
  if (P.regen) list.push({ k:'regen', label:'Regeneração', left:P.regen.left, color:'#5aff8a' });
  UI.potionBuffs(list);
}
// ---------- área de treino ----------
// Bonecos ficam em mobs para receber todo ataque/skill pelo mesmo hitMob; nunca morrem e não dão loot/XP/missão/bestiário.
const yard = { on:false, ui:0, log:[], hits:0, crits:0, max:0 };
function spawnDummy(d) {
  const model = M.createDummy(d.boss);
  const m = { type:'boneco', dummy:true, boss:d.boss, def:{ label:'Boneco de treino', sound:d.boss ? 'golem' : 'boneco' }, model, scale:1, pos:new THREE.Vector3(d.x, 0, d.z), y:0,
    hp:1e9, maxHp:1e9, dmg:0, speed:0, radius:0.5, stun:0, flash:0, flashOn:false, knock:V(), dead:false, teles:[], spawnT:0, face:d.ry, tilt:new THREE.Vector2(), tiltV:new THREE.Vector2() };
  model.root.position.copy(m.pos); model.root.rotation.y = d.ry; mobs.push(m);
}
function yardHit(m, amount, crit, from) {
  m.hp = m.maxHp; yard.log.push({ t:T, amount }); yard.hits++; if (crit) yard.crits++; yard.max = Math.max(yard.max, amount);
  tmp.set(m.pos.x - from.x, 0, m.pos.z - from.z).normalize(); m.tiltV.x += tmp.x * (crit ? 4 : 2.5); m.tiltV.y += tmp.z * (crit ? 4 : 2.5);
}
// Balanço: mola amortecida; a inclinação (no chão do mundo) é girada para o espaço do boneco.
function updateDummy(m, dt) {
  m.tiltV.addScaledVector(m.tilt, -70 * dt).multiplyScalar(Math.exp(-dt * 4)); m.tilt.addScaledVector(m.tiltV, dt).clampLength(0, 0.45);
  const c = Math.cos(m.face), s = Math.sin(m.face), body = m.model.body;
  body.rotation.x = m.tilt.x * s + m.tilt.y * c; body.rotation.z = -(m.tilt.x * c - m.tilt.y * s);
  m.flash -= dt; const on = m.flash > 0;
  if (on !== m.flashOn) { m.flashOn = on; m.model.flash(on ? 0.9 : 0); }
}
// Entrar ou sair do cercado zera o painel; fora dele o hub não tem combate.
function setYard(on) {
  yard.on = on; yard.log.length = yard.hits = yard.crits = yard.max = 0; yard.ui = 0;
  UI.yard(on ? yardStats() : null);
}
function yardStats() {
  const L = yard.log; while (L.length && T - L[0].t > 10) L.shift();
  const total = L.reduce((s, h) => s + h.amount, 0);
  return { dps:L.length ? Math.round(total / Math.max(1, T - L[0].t)) : 0, total, max:yard.max, crit:yard.hits ? Math.round(yard.crits / yard.hits * 100) : 0 };
}
function openStation(s) {
  stopGather();
  if (s.id !== 'diario') return UI.open(s.id === 'portal' ? 'dungeons' : s.id);
  const items = C.claimDailyChest(save);
  if (!items) { UI.toast('Baú diário já aberto hoje. Volte amanhã!', '#ffd36b'); return; }
  for (const it of items) C.addItem(save, it);
  persist(); UI.prompt(null); world.setDaily(false);
  vault.open(items, () => UI.hubBar(save, stats));
}

// ---------- câmera ----------
// Close de coleta: câmera em 3/4 na frente do herói (lado de onde ele olha o nó). Testa os dois lados e
// ângulos cada vez mais abertos; só aceita se a câmera e o caminho até ela estão em chão livre (sem pedra/árvore).
let camEase = 0;
function gatherCam(n) {
  const portrait = innerWidth / innerHeight < 0.8, dist = portrait ? 12.5 : 9.5, h = portrait ? 5 : 4.2;
  const fa = Math.atan2(n.x - P.pos.x, n.z - P.pos.z), look = new THREE.Vector3((P.pos.x + n.x) / 2, 1.5, (P.pos.z + n.z) / 2);
  // Primeiro 3/4 de frente; nó na beira da praça (frente = mato/árvores) cai para perfil; depois mais perto.
  for (const [off, d] of [[0.8, 1], [-0.8, 1], [1.1, 1], [-1.1, 1], [0.8, 0.7], [-0.8, 0.7], [1.45, 1], [-1.45, 1], [1.45, 0.7], [-1.45, 0.7]]) {
    const a = fa + off, x = P.pos.x + Math.sin(a) * dist * d, z = P.pos.z + Math.cos(a) * dist * d;
    let ok = true; for (let i = 2; i <= 6 && ok; i++) ok = world.canStand(P.pos.x + (x - P.pos.x) * i / 6, P.pos.z + (z - P.pos.z) * i / 6, 0.35);
    if (ok) return { pos:new THREE.Vector3(x, h, z), look };
  }
  return null; // sem lugar livre: fica a câmera de cima
}
function updateCamera(dt) {
  const portrait = innerWidth / innerHeight < 0.8, side = innerWidth > 700;
  if (showcase) {
    const front = new THREE.Vector3(P.pos.x, 0, P.pos.z);
    // Celular: folha inferior cobre 60% da tela, então o alvo fica abaixo do herói para subi-lo no quadro.
    tmp.set(front.x - (side ? 1.8 : 0), portrait ? 2.8 : 3.4, front.z + (portrait ? 16.5 : 11.5));
    tmp2.set(front.x + (side ? 2.6 : 0), portrait ? -2.1 : 1.6, front.z);
  } else if (camFocus?.t > 0) {
    camFocus.t -= dt;
    // Close no NPC, vindo do lado da praça (o herói fica escondido durante a conversa).
    // face: lado de onde o NPC é visto (a alquimista do Vale olha para o sul); sem face, vem do centro da praça.
    if (camFocus.near) { const d = Math.hypot(camFocus.pos.x, camFocus.pos.z) || 1, f = camFocus.face; if (f) { const k = portrait ? 1.6 : 1; tmp.set(camFocus.pos.x + f.x * 8.5 * k, 4.4 * k, camFocus.pos.z + f.z * 8.5 * k); } else tmp.set(camFocus.pos.x * (1 - 8.5 / d), 4.4, camFocus.pos.z * (1 - 8.5 / d) + 1.2); tmp2.set(camFocus.pos.x + (side ? 1.6 : 0), f && portrait ? -1.2 : 1.8, camFocus.pos.z); }
    else { tmp.set(camFocus.pos.x, 13, camFocus.pos.z + 13); tmp2.set(camFocus.pos.x, 3, camFocus.pos.z); }
  } else {
    const k = (portrait ? 1.4 : 1) * (run?.boss && !run.boss.dead ? 1.15 : 1);
    if (gather?.cam) { tmp.copy(gather.cam.pos); tmp2.copy(gather.cam.look); }
    else {
      // Na Estrada do Abismo o alvo da câmera corre para o norte, para o arco alto do portal caber na tela.
      const pk = mode === 'hub' && world.portalPos ? Math.max(0, 1 - dist2(world.portalPos, P.pos) / 16) : 0;
      tmp.set(P.pos.x, 23 * k, P.pos.z + 21 * k - pk * 4); tmp2.set(P.pos.x, 1 + pk * 3, P.pos.z - pk * 5);
    }
  }
  // Coleta: entra e sai do close devagar (cinema); o resto segue o herói rápido.
  if (gather?.cam) camEase = 1; else camEase = Math.max(0, camEase - dt);
  const f = 1 - Math.exp(-dt * (showcase ? 4 : camEase > 0 ? 3 : 7));
  camPos.lerp(tmp, f); camLook.lerp(tmp2, f);
  if (shake > 0) { shake -= dt; shakeOff.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake * 0.6); } else shakeOff.set(0, 0, 0);
  camera.position.copy(camPos).add(shakeOff); camera.lookAt(camLook);
  sun.position.set(P.pos.x - 12, 18, P.pos.z + 10); sun.target.position.set(P.pos.x, 0, P.pos.z);
}

// ---------- loop ----------
const clock = new THREE.Clock();
function step(dt, draw = true) {
  // Hit-stop: o mundo quase congela por alguns ms no impacto.
  if (hitStop > 0) { hitStop -= dt; dt *= 0.08; }
  DT = dt; T += dt;
  if (vault.active) { vault.update(dt); if (draw) vault.render(bloomOn); return; }
  if (input.take('blur') && mode === 'dungeon' && !run?.ending) setPaused(true);
  if (input.take('pause')) {
    if (mode === 'dungeon' && !run?.ending) setPaused(!paused);
    else if (mode === 'hub') UI.close();
  }
  if (!paused) {
    updatePlayer(dt); updateMobs(dt); updateCos(dt); updateShots(dt); updateLoots(dt); updateDebris(dt);
    if (mode === 'dungeon') updateRun(dt); else if (mode === 'hub') updateHub(dt);
    if (mode !== 'hub') sound.hum(0);
    if (world && mode !== 'hub') world.update(T, P.pos);
    burst.update(dt);
  }
  animateHero(paused ? 0 : dt);
  scene.updateMatrixWorld();
  if (!paused) { hero.update(dt, T); weapon?.update(dt, T); auraSparks?.update(dt); }
  updateCamera(dt);
  if (mode === 'dungeon' && run) {
    const main = world.rooms.filter(r => r.kind !== 'start' && !r.side), big = run.boss && !run.boss.dead ? run.boss : run.mini && !run.mini.dead ? run.mini : null;
    UI.hud({ time:run.won ? C.TIME_LIMIT - run.time : run.timeLeft, hp:P.hp, maxHp:stats.hp, dashCd:P.dashCd, buff:P.buff.t > 0, room:Math.min(main.length, main.filter(r => r.cleared).length + 1), rooms:main.length,
      boss:big ? { name:big.mini ? `Guardião: ${big.def.label}` : big.def.label, hp:big.hp, max:big.maxHp } : null, obj:objText() });
    if (P.hp < stats.hp * 0.3 && !P.dead) tip('lowhp');
  }
  if (mode !== 'results') potionHud();
  if (mode !== 'results') UI.skillsHud(C.equippedSkills(save).map((it, i) => it && { label:C.SKILLS[it.skill].label, rarity:it.rarity, cd:Math.max(0, P.cds[i]), max:C.SKILLS[it.skill].cd * (1 - stats.cdr) }));
  bloom.strength = (world?.theme?.art ? .3 : .6) + boost; boost = Math.max(0, boost - dt * 1.2);
  if (mode !== 'results') { const [nx, ny] = project(P.pos, P.y + 3.9); UI.nameplate(save.name, save.vip, nx, ny, hero.root.visible && tmp2.z < 1 && !P.dead); }
  if (!draw) return;
  pumpThumbs(renderer, scene);
  if (bloomOn) composer.render(); else renderer.render(scene, camera);
}
// Linha do objetivo da sala trancada (o mini-chefe usa a barra de chefe).
function objText() {
  const r = run.lockedRoom, o = r?.o; if (!o || o.over || o.type === 'mini' || run.ending) return null;
  const mine = list => list.filter(p => p.zone === r), on = list => `${list.filter(p => p.on).length}/${list.length}`;
  if (o.type === 'kill') return `Derrote todos · ${mobs.filter(m => !m.dead).length + r.pending.length + Math.max(0, r.spawning)} restantes`;
  if (o.type === 'lever') return `Puxe as alavancas ${on(mine(world.props.levers))}`;
  if (o.type === 'runes') return `Pise nas runas ${on(mine(world.props.runes))}`;
  if (o.type === 'survive') return `Sobreviva ${Math.ceil(Math.max(0, SURVIVE - o.t))} s`;
  if (o.type === 'orb') return mine(world.props.orbs).some(b => b.carried) ? 'Leve o orbe até o pedestal' : 'Pegue o orbe brilhante';
  if (o.type === 'key') return run.key ? 'Pegue a chave!' : 'Derrote o elite com a chave';
  return null;
}
// Mede o tempo real entre quadros e ajusta resolução (e por último o brilho) para manter ~50+ FPS.
let ema = 16, adaptT = 0, slow = 0, last = performance.now();
function adapt() {
  const now = performance.now(), ms = now - last; last = now;
  if (ms > 60 || document.hidden) return; // aba oculta/pausa: não é lentidão
  ema = ema * 0.94 + ms * 0.06; adaptT += ms;
  if (adaptT < 1500) return; adaptT = 0;
  slow = ema > 21 ? slow + 1 : 0;
  // Lento: baixa a resolução, depois tira o brilho e, por último, as sombras (celular fraco com mapa grande).
  if (slow >= 2) { slow = 0; if (PR > 0.75) setPR(Math.max(0.75, PR - 0.25)); else if (bloomOn) { bloomOn = false; prewarm(); } else if (sun.castShadow) { sun.castShadow = false; prewarm(); } }
  else if (ema < 12.5 && PR < PR_MAX) setPR(Math.min(PR_MAX, PR + 0.125));
}
function setPR(v) { PR = v; renderer.setPixelRatio(PR); composer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); }
// Compila de uma vez os shaders de tudo que pode aparecer, para não travar no primeiro golpe/drop/mob.
// Os objetos de aquecimento nunca são descartados: enquanto um material vivo usa um shader, o Three.js não o apaga,
// então efeitos que nascem e morrem (cortes, explosões, mobs) não recompilam shader a cada vez.
let warmed = false;
const KEEP = new THREE.Group();
function prewarm() {
  const g = KEEP; g.position.set(0, -50, 0); scene.add(g);
  if (!warmed) {
    const quad = M.shared('warmQuad', () => new THREE.PlaneGeometry(1, 1));
    for (const m of [M.additive(0xffffff, 0.5), M.additive(0xffffff, 0.5, { side:THREE.DoubleSide }), M.additive(0xffffff, 0.5, { map:M.dotTex }),
      M.additive(0xffffff, 0.5, { map:M.dotTex, side:THREE.DoubleSide }), M.glow(0xffffff), M.mat(0xffffff), M.mat(0xffffff, { transparent:true, opacity:0.8 }), M.mat(0xffffff, { side:THREE.DoubleSide })])
      g.add(new THREE.Mesh(quad, m));
    g.add(new M.Trail(0xffffff).mesh);
    for (const k of ['espada', 'machado', 'arco', 'cajado']) for (const { id:r } of C.RARITIES) for (let v = 0; v < 3; v++) g.add(M.createWeapon(k, r, { fx:false, variant:v }).group);
    for (const s of ['aventureiro', 'celestial', 'ceifador', 'arcanista']) { const h = M.createHero({ skin:s, armor:'lendario', amulet:'lendario' }); h.sparks.forEach(sp => sp.dispose()); g.add(h.root); }
    for (const cls of Object.keys(C.CLASSES)) if (M.heroModelReady(cls)) g.add(M.createHeroRig({ cls, armor:'lendario', armorName:'Manto do Sol', amulet:'lendario', amuletName:'Sol Aprisionado' }).root);
    for (const skin of Object.keys(C.SKINS)) { const h = M.createHeroRig({ cls:'mago', skin, armor:'epico', armorName:'Égide do Vazio' }); h.sparks.forEach(sp => sp.dispose()); g.add(h.root); }
    for (const t of [...Object.keys(C.MOBS), ...Object.keys(C.BOSSES)]) g.add(M.createMob(t, 'esmeralda', 1).root);
    for (const { id:r } of C.RARITIES) for (const slot of ['arma', 'armadura', 'amuleto']) { const it = C.makeItem({ slot, cls:'guerreiro', level:1, rarity:r }); g.add(M.createLootBeam(it).group); }
    // Mítico: herói com armadura e amuleto míticos (as armas míticas já entram no laço acima).
    { const h = M.createHero({ armor:'mitico', amulet:'mitico' }); h.sparks.forEach(sp => sp.dispose()); g.add(h.root); }
    for (const cls of Object.keys(C.CLASSES)) if (M.heroModelReady(cls)) g.add(M.createHeroRig({ cls, armor:'mitico', armorName:'Couraça do Rei Rubro', amulet:'mitico', amuletName:'Coração Carmesim' }).root);
    g.add(M.createChest().group, M.createPortal().group);
    for (const n of ['skull', 'ribcage', 'bone_A', 'bone_B', 'bone_C', 'rock_single_A', 'rock_single_C', 'rock_single_E']) { const p = M.propGeo(n); if (p) g.add(new THREE.Mesh(p.geo, p.mat)); }
    g.add(new THREE.Mesh(M.shared('splat', () => new THREE.CircleGeometry(1, 20)), new THREE.MeshStandardMaterial({ transparent:true })));
    for (const sh of ['circle', 'rect', 'cone']) g.add(M.createTelegraph(sh).group);
    warmed = true;
  }
  g.traverse(o => { o.frustumCulled = false; });
  const hidden = []; world?.group.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  // Com bloom, a cena é desenhada num buffer linear sem tone mapping: compilar nessa mesma variante.
  if (bloomOn) renderer.setRenderTarget(composer.readBuffer);
  renderer.compile(scene, camera);
  // Um desenho de verdade (num alvo minúsculo) já envia malhas e ossos para a GPU, em vez de no primeiro combate.
  const rt = bloomOn ? new THREE.WebGLRenderTarget(64, 64, { type:THREE.HalfFloatType }) : null;
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); rt?.dispose();
  hidden.forEach(o => { o.visible = false; });
  g.removeFromParent();
}
function frame() { adapt(); step(Math.min(clock.getDelta(), 0.05)); requestAnimationFrame(frame); }
function setPaused(on) { paused = on; UI.pauseMenu(on); input.clear(); }

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); vault.resize();
});

// ---------- UI ----------
UI.init({
  getSave:() => save, getStats:() => stats, getPreviewSkin:() => previewSkin ?? save.skin,
  uiSound:() => { sound.unlock(); sfx('page'); },
  onPanel:name => {
    showcase = mode === 'hub' && ['mochila', 'skins', 'classe'].includes(name);
    camFocus = name === 'ferreiro' && world?.smithPos ? { pos:world.smithPos, t:1e9, near:true }
      : name === 'alquimista' && world?.alchemist ? { pos:world.alchemist, t:1e9, near:true, face:new THREE.Vector3(0, 0, 1) } : (camFocus?.near ? null : camFocus);
    if (hero) hero.root.visible = name !== 'ferreiro' && name !== 'alquimista';
    if (S.NPC_OF_PANEL[name] && mode === 'hub') story('talk', { id:S.NPC_OF_PANEL[name] });
    if (name === 'ferreiro') tip('forge');
    if (!name && previewSkin) { previewSkin = null; rebuildHero(); }
    if (!showcase && hero) hero.root.rotation.y = P.facing;
    input.clear();
  },
  onPlay:level => enterDungeon(level),
  onEquip:(id, slot) => { if (C.equip(save, id, slot)) { persist(); rebuildHero(); sfx('equip'); } },
  onUnequipSkill:slot => { if (C.unequipSkill(save, save.cls, slot)) { persist(); sfx('equip'); } },
  onDev:action => {
    if (action === 'toggle') save.settings.dev = !save.settings.dev;
    else if (action === 'skills') { for (const id of C.skillsOf(save.cls)) if (!save.inventory.some(i => i.skill === id)) C.addItem(save, C.makeSkillItem({ skill:id, level:4 })); UI.toast('Todas as habilidades da classe na mochila', '#ffd36b'); }
    else if (action === 'legend') { for (const slot of ['arma', 'armadura', 'amuleto']) C.addItem(save, C.makeItem({ slot, cls:save.cls, level:4, rarity:'lendario' })); UI.toast('3 lendários de nível 4 na mochila', '#ffb52e'); }
    else if (action === 'pages') { for (let lvl = 1; lvl <= 8; lvl++) for (let k = 0; k < 2; k++) S.rollPage(save, lvl, () => 0); UI.toast('+2 páginas de cada dungeon', '#e8d9a8'); }
    else if (action === 'mats') { C.addMaterials(save, Object.fromEntries(Object.keys(C.MATERIALS).map(id => [id, 20]))); learned(C.learnRecipes(save)); UI.toast('+20 de cada material', '#7dffa6'); }
    else if (action === 'mythic') { for (const slot of ['arma', 'armadura', 'amuleto']) C.addItem(save, C.makeItem({ slot, cls:save.cls, level:4, rarity:'mitico' })); UI.toast('3 míticos de nível 4 na mochila', '#ff2a4a'); }
    persist(); UI.hubBar(save, stats);
  },
  onSellMany:ids => { const g = C.salvageMany(save, ids); if (g) { persist(); UI.toast(`Vendido! +${g} gemas`, '#7fe9ff'); sfx('coin'); UI.hubBar(save, stats); } },
  onSalvage:id => { const g = C.salvage(save, id); if (g) { persist(); UI.toast(`+${g} gemas`, '#7fe9ff'); sfx('coin'); UI.hubBar(save, stats); } },
  onClass:cls => { save.cls = cls; persist(); rebuildHero(); sfx('equip'); },
  onSkinPreview:id => { previewSkin = id === save.skin ? null : id; rebuildHero(); },
  onSkinUse:id => { if (save.ownedSkins.includes(id)) { save.skin = id; previewSkin = null; persist(); rebuildHero(); sfx('equip'); } },
  onSkinBuy:id => { if (C.buySkin(save, id)) { save.skin = id; previewSkin = null; persist(); rebuildHero(); UI.banner('Skin nova!', C.SKINS[id].label, '#ffd36b'); sfx('victory'); } },
  onResume:() => setPaused(false),
  onQuit:() => { setPaused(false); endRun(false, 'Você saiu da dungeon.'); },
  onPause:() => { if (mode === 'dungeon' && !run?.ending) setPaused(true); },
  onQuality:q => { save.settings.quality = q; persist(); location.reload(); },
  onSound:() => { save.settings.sound = audio.toggle(); sound.refresh(); persist(); UI.pauseMenu(paused); },
  onVolume:(k, v) => { save.settings[k] = v; sound.refresh(); persist(); if (k === 'sfx') sfx('coin'); },
  onBackToHub:() => enterHub(),
  onAgain:() => { const lvl = run?.def.level ?? 1; enterHub(); enterDungeon(lvl); },
  onForge:id => {
    const it = save.inventory.find(i => i.id === id), res = C.upgradeItem(save, id);
    if (!res.ok) { UI.smithState(false, { ok:false, text:'Faltam gemas para isso, aventureiro.' }); sfx('warning'); return; }
    persist(); UI.smithState(true); world.smithHit?.(3);
    go((function* () {
      yield 1.75;
      rebuildHero(); UI.hubBar(save, stats);
      if (res.success) { sfx('level'); UI.banner('Forjado!', `${it.name} +${it.plus}`, '#7fe9ff'); story('forge', { id:it.slot }); }
      else sfx('defeat');
      UI.smithState(false, res.success ? { ok:true, text:`Ficou uma beleza! ${it.name} agora é +${it.plus}.` } : { ok:false, text:'A forja recusou desta vez... o item continua igual. Tenta de novo?' });
    })());
  },
  onReset:() => { if (confirm('Apagar todo o progresso deste navegador? Não dá para desfazer.')) { try { localStorage.removeItem(SAVE_KEY); } catch { /* sem armazenamento */ } location.reload(); } },
  onName:n => { save.name = C.cleanName(n); persist(); UI.toast(`Nome: ${save.name}`, '#7fe9ff'); },
  onVip:() => { save.vip = !save.vip; persist(); sfx(save.vip ? 'victory' : 'equip'); },
  onCharm:id => { if (C.unlockCharm(save, id)) { persist(); rebuildHero(); sfx('victory'); UI.toast(`Charm ativo: ${C.CHARMS[id].label}`, '#ffd36b'); } },
  onClaimLogin:() => {
    const r = C.claimLogin(save); if (!r) return;
    for (const it of r.items) C.addItem(save, it);
    persist(); world?.setLogin?.(false); sfx('victory'); UI.hubBar(save, stats);
    if (r.gems) UI.toast(`Dia ${r.streak}: +${r.gems} gemas`, '#7fe9ff');
    if (r.items.length) { UI.close(); UI.prompt(null); vault.open(r.items, () => UI.hubBar(save, stats)); }
  },
  onClaimMission:i => { const g = C.claimMission(save, i); if (g) { persist(); UI.toast(`+${g} gemas`, '#7fe9ff'); sfx('victory'); UI.hubBar(save, stats); } },
  onPrompt:() => {
    if (mode !== 'hub') { promptTap = true; return; }
    if (station) openStation(station); else { const n = nearNode(); if (n && !gather) startGather(n); }
  },
  onDrink:id => usePotion(id),
  onTalk:npc => { const line = S.nextLine(save, npc); persist(); return line; },
  onQuest:(npc, what) => {
    if (what === 'accept' && S.acceptQuest(save, npc)) { sfx('page'); UI.toast(`Missão aceita: ${S.questState(save, npc).q.title}`, '#7fe9ff'); }
    if (what === 'claim') {
      const r = S.claimQuest(save, npc); if (!r) return;
      sfx('victory'); UI.banner('Missão entregue!', r.q.title, '#7dffa6'); UI.toast(`Prêmio: ${S.rewardText(r.q.reward)}`, '#7fe9ff');
      if (r.up) UI.toast(`${S.NPCS[npc].short} agora te vê como ${S.AFFINITY_LABEL[r.up.lvl]} · conversa nova!`, '#ff9ad5');
      UI.hubBar(save, stats);
    }
    persist();
  },
  onBelt:id => { if (C.POTIONS[id]) { save.belt = id; persist(); sfx('equip'); } },
  onBrew:id => {
    const R = C.POTIONS[id], res = C.brew(save, id);
    if (!res.ok) { UI.alchemyState(false, { ok:false, text:res.reason === 'cheio' ? 'Sua bolsa já está cheia dessa poção.' : 'Faltam ingredientes, querido. O Vale tem quase tudo.' }); sfx('warning'); return; }
    persist(); UI.alchemyState(true); world.brewing?.(true, R.color); sfx('bubble');
    go((function* () {
      for (let i = 0; i < 3; i++) { yield 0.45; sfx('bubble'); }
      yield 0.3; world?.brewing?.(false); sfx('brewDone'); mission('brew', res.n); story('brew', { n:res.n }); tip('potion');
      if (res.up) { UI.banner('Alquimia subiu!', `Nível ${res.up}`, '#c77dff'); sfx('level'); }
      learned(res.learned); persist();
      UI.alchemyState(false, { ok:true, text:res.n > 1 ? `Saiu em dobro! +2 ${R.label}.` : `Prontinho: +1 ${R.label}.` });
    })());
  },
  onToolUp:tool => {
    const res = C.upgradeTool(save, tool);
    if (!res.ok) { UI.smithState(false, { ok:false, text:res.reason === 'max' ? 'Essa já é a melhor que eu sei fazer.' : 'Faltam materiais ou gemas pra essa, aventureiro.' }); sfx('warning'); return; }
    persist(); UI.smithState(true); world.smithHit?.(3);
    go((function* () {
      yield 1.75; sfx('level'); UI.banner('Ferramenta nova!', C.toolName(tool, res.tier), '#7fe9ff'); UI.hubBar(save, stats); story('tool');
      UI.smithState(false, { ok:true, text:`Toma: ${C.toolName(tool, res.tier)}. Agora o Vale te dá coisa melhor.` });
    })());
  },
  onReroll:(id, idx) => {
    const res = C.rerollAffix(save, id, idx);
    if (!res.ok) { UI.smithState(false, { ok:false, text:'Faltam materiais ou gemas pra re-rolar esse.' }); sfx('warning'); return; }
    persist(); UI.smithState(true); world.smithHit?.(3);
    go((function* () {
      yield 1.75; rebuildHero(); sfx('level'); story('reroll');
      UI.smithState(false, { ok:true, text:`${C.AFFIXES[res.old.id].label} ${res.old.v}% virou ${C.AFFIXES[res.now.id].label} ${res.now.v}% (qualidade ${Math.round(C.affixQuality(res.now) * 100)}%).` });
    })());
  },
});
if (input.isTouch) {
  document.body.classList.add('touch');
  input.bindTouch({ zone:document.getElementById('joy-zone'), stick:document.getElementById('joy'), knob:document.getElementById('joy-knob'),
    attack:document.getElementById('btn-attack'), skills:[0, 1, 2].map(i => document.getElementById('sk' + i)), dash:document.getElementById('btn-dash'), potion:document.getElementById('btn-potion') });
}

await Promise.all([loadHubArt(), loadSurfaces()]);
await M.loadModels(p => { const el = document.getElementById('loading'); if (el) el.textContent = `Carregando o abismo… ${Math.round(p * 100)}%`; });
enterHub();
if (C.loginState(save).canClaim) UI.open('calendario');
requestAnimationFrame(frame);
document.getElementById('loading')?.remove();

// Atalho de depuração no console (jogo single-player, save local).
window.__ecos = { sound, camera, spawn:(type, dx = 4, boss = false) => spawnMob(type, P.pos.x + dx, P.pos.z, { boss }), get save() { return save; }, renderer, get quality() { return { PR, bloomOn, ema }; }, get run() { return run; }, get world() { return world; }, enterDungeon, enterHub, P, mobs, shots, input, danger:inDanger, get stats() { return stats; }, rebuildHero, spawnAt:spawnMob, step:dt => step(dt, false), get paused() { return paused; }, setPaused, tick:(sec, dt = 1 / 30) => { for (let t = 0; t < sec; t += dt) step(dt, t + dt >= sec); }, give:(rarity = 'lendario', slot = 'arma', level = 1) => { const it = C.makeItem({ slot, cls:save.cls, level, rarity }); C.addItem(save, it); C.equip(save, it.id); persist(); rebuildHero(); return it; } };
