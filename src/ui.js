// Interface em DOM sobre o canvas: HUD, menus, avisos e números de dano.
import { RARITY, RARITIES, CLASSES, DUNGEONS, SKINS, SKILLS, MOBS, BOSSES, ATTACK_KINDS, BOSS_PATTERNS, BOSS_SPEED, dungeonsWith, discovered, dungeonScale, CHARMS, BESTIARY_STAGES, bestiaryStars, charmPoints, hasCharm, boostedCreature, ensureDaily, loginState, loginReward, pityLeft, upgradeCost, MAX_PLUS, forgeChance, weaponNames, SLOT_LABEL, TIME_LIMIT, INVENTORY_CAP, equippedItems, equippedSkills, skillsOf, skillPower, itemPower, isEquipped, recommendedPower, difficultyLabel, xpToNext, AFFIXES, affixQuality, rollQuality, displayName, MYTHIC_FX, playerStats, statsIfEquipped, STAT_ROWS,
  MATERIALS, POTIONS, TOOLS, TOOL_COST, TOOL_MAX, toolName, PROFS, profInfo, hasCost, rerollCost, POTION_RUN_LIMIT } from './core.js';
import { thumbHtml } from './thumbs.js';
import * as S from './story.js';

const $ = id => document.getElementById(id);
const hex = c => '#' + c.toString(16).padStart(6, '0');
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
export const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const ICONS = {
  espada:'<path d="M19 3h2v2l-10 10-2-2z"/><path d="M6 13l5 5M4 20l3-3"/>',
  machado:'<path d="M5 21L16 6"/><path d="M13 5c3-3 8-2 8 2-3-1-5 1-6 4z"/>',
  arco:'<path d="M5 3c10 2 14 6 16 16"/><path d="M5 3l16 16"/><path d="M3 21l7-7"/>',
  cajado:'<path d="M4 21L15 9"/><circle cx="17.5" cy="6.5" r="3"/>',
  armadura:'<path d="M7 4l3-1h4l3 1 3 4-3 2v10H7V10L4 8z"/>',
  amuleto:'<path d="M6 3c0 5 3 8 6 9 3-1 6-4 6-9"/><path d="M12 12l-3 4 3 5 3-5z"/>',
  skill:'<path d="M12 2l2.4 6.6L21 9l-5.2 4.3L17.6 21 12 17.2 6.4 21l1.8-7.7L3 9l6.6-.4z"/>',
  // Armaduras: um desenho por conjunto (o mesmo visual que aparece no boneco).
  'Couraça de Couro':'<path d="M7 4l3-1h4l3 1 3 4-3 2v10H7V10L4 8z"/><path d="M10 9l2 2 2-2M10 13l2 2 2-2"/>',
  'Gibão Remendado':'<path d="M7 4l3-1h4l3 1 3 4-3 2v10H7V10L4 8z"/><rect x="9" y="12" width="3" height="3"/><path d="M14 8l1 1"/>',
  'Placas Glaciais':'<path d="M8 6l4-1 4 1v14H8z"/><path d="M8 6L4 3l2 5M16 6l4-3-2 5M12 9v8"/>',
  'Cota do Vigia':'<path d="M7 4l3-1h4l3 1 3 4-3 2v10H7V10L4 8z"/><circle cx="10" cy="11" r=".6"/><circle cx="14" cy="11" r=".6"/><circle cx="10" cy="15" r=".6"/><circle cx="14" cy="15" r=".6"/><circle cx="12" cy="13" r=".6"/>',
  'Égide do Vazio':'<path d="M8 6l4-2 4 2v14l-4-2-4 2z"/><path d="M8 6L5 4M16 6l3-2"/><circle cx="12" cy="11" r="2"/>',
  'Armadura Ametista':'<path d="M8 6l4-1 4 1v14H8z"/><path d="M12 8l2 3-2 4-2-4z"/><path d="M8 6l-2-3M16 6l2-3"/>',
  'Manto do Sol':'<path d="M6 7l6-3 6 3-1 13H7z"/><circle cx="12" cy="11" r="2.2"/><path d="M12 6.5v1.5M12 14v1.5M7.5 11H9M15 11h1.5"/>',
  'Placas da Aurora':'<path d="M9 6l3-1 3 1v13H9z"/><path d="M9 8C5 7 3 10 2 14c3-1 5-2 7-3M15 8c4-1 6 2 7 6-3-1-5-2-7-3"/>',
  amuleto0:'<path d="M6 3c0 5 3 8 6 9 3-1 6-4 6-9"/><path d="M12 12l-3 4 3 5 3-5z"/>',
  // Bestiário: um desenho por tipo de ataque (e coroa para chefes).
  salto:'<path d="M4 20h16"/><path d="M8 16c0-6 8-6 8 0"/><path d="M12 4v6M9 7l3-3 3 3"/>',
  investida:'<path d="M3 12h12"/><path d="M11 7l5 5-5 5"/><path d="M18 6v12"/>',
  magia:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/>',
  pancada:'<circle cx="12" cy="15" r="6"/><path d="M12 3v8M9 8l3 3 3-3"/>',
  corte:'<path d="M4 19c3-9 9-13 16-14"/><path d="M8 21c3-5 7-8 12-9"/>',
  flecha:'<path d="M4 20L18 6"/><path d="M13 5h6v6"/><path d="M4 16v4h4"/>',
  explode:'<circle cx="11" cy="14" r="6"/><path d="M15 9l3-3M18 3v3h3"/>',
  chefe:'<path d="M3 18h18l-2-10-4 4-3-6-3 6-4-4z"/><path d="M5 21h14"/>',
  amuleto1:'<path d="M6 3c0 5 3 8 6 9 3-1 6-4 6-9"/><circle cx="12" cy="16" r="3.5"/><circle cx="12" cy="16" r="1.2"/>',
  // Coleta e alquimia.
  minerio:'<path d="M7 4h10l4 7-9 10L3 11z"/><path d="M3 11h18M12 21L9 11l3-7 3 7z"/>',
  planta:'<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z"/><path d="M5 19L14 10"/>',
  raro:'<path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
  pocao:'<path d="M9 3h6M10 3v5L5 18a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V3"/><path d="M7 14h10"/>',
  picareta:'<path d="M4 9c4-5 12-5 16 0"/><path d="M12 5.5L8 21"/>',
  // Livro do Aventureiro.
  livro:'<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>',
  martelo:'<path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7L3 15l3 3 8-8"/>',
  missao:'<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h3"/>',
  calendario:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  portal:'<ellipse cx="12" cy="12" rx="6" ry="9"/><ellipse cx="12" cy="12" rx="2.5" ry="5"/>',
  pagina:'<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3"/><path d="M9 11c2-1 4 1 6 0M9 15c2-1 4 1 6 0"/>',
  foice:'<path d="M5 21l6-9"/><path d="M11 12c-2-6 2-10 9-9-5 1-7 4-6 9z"/>',
};
export const icon = (kind, color) => `<svg viewBox="0 0 24 24" class="ico" style="color:${color}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[kind] ?? ''}</svg>`;

let H = null, panel = null, mochilaFilter = 'tudo', selectedItem = null, lastHud = {}, bulk = null;

export function init(handlers) {
  H = handlers;
  document.addEventListener('change', e => { const k = e.target.dataset?.vol; if (k) H.onVolume(k, Number(e.target.value)); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const { act, arg } = b.dataset;
    H.uiSound?.();
    if (act === 'open') open(arg);
    else if (act === 'close') close();
    else if (act === 'play') H.onPlay(Number(arg));
    else if (act === 'filter') { mochilaFilter = arg; render(); }
    else if (act === 'bulk') { bulk = bulk ? null : new Set(); render(); }
    else if (act === 'pick') { bulk.has(arg) ? bulk.delete(arg) : bulk.add(arg); render(); }
    else if (act === 'pickall') { const save = H.getSave(); for (const i of save.inventory) if (i.rarity === arg && !isEquipped(save, i.id) && (!i.cls || i.cls === save.cls || mochilaFilter === i.slot)) bulk.add(i.id); render(); }
    else if (act === 'sellbulk') { if (bulk?.size) { H.onSellMany([...bulk]); bulk = null; render(); } }
    else if (act === 'select') { selectedItem = arg; render(); }
    else if (act === 'equip') { H.onEquip(arg, b.dataset.slot !== undefined ? Number(b.dataset.slot) : null); render(); }
    else if (act === 'unskill') { H.onUnequipSkill(Number(arg)); render(); }
    else if (act === 'dev') { H.onDev(arg); render(); }
    else if (act === 'login') { H.onClaimLogin(); refresh(); }
    else if (act === 'claim') { H.onClaimMission(Number(arg)); render(); }
    else if (act === 'charm') { H.onCharm(arg); render(); }
    else if (act === 'setname') { H.onName($('name-input').value); render(); }
    else if (act === 'vip') { H.onVip(); render(); }
    else if (act === 'smith') { if (arg === 'bag') { open('mochila'); return; } smithView = arg; smithMsg = ''; render(); }
    else if (act === 'smithsel') { smithSel = arg; render(); }
    else if (act === 'forge') H.onForge(arg);
    else if (act === 'toolup') H.onToolUp(arg);
    else if (act === 'reroll') H.onReroll(arg, Number(b.dataset.idx));
    else if (act === 'alch') { if (arg === 'bag') { mochilaFilter = 'materiais'; open('mochila'); return; } alchView = arg; alchMsg = ''; render(); }
    else if (act === 'brew') H.onBrew(arg);
    else if (act === 'drink') { H.onDrink(arg); render(); }
    else if (act === 'belt') { H.onBelt(arg); render(); }
    else if (act === 'reset') H.onReset();
    else if (act === 'talk') { const line = H.onTalk(arg); pendingLine = line ?? noNews(H.getSave(), arg); render(); }
    else if (act === 'quest') { H.onQuest(arg, b.dataset.what); render(); }
    else if (act === 'book') { bookTab = arg; render(); $('panel-body').scrollTop = 0; }
    else if (act === 'tipok') nextTip(true);
    else if (act === 'salvage') { H.onSalvage(arg); selectedItem = null; render(); }
    else if (act === 'class') { H.onClass(arg); render(); }
    else if (act === 'skin-preview') { H.onSkinPreview(arg); render(); }
    else if (act === 'skin-use') { H.onSkinUse(arg); render(); }
    else if (act === 'skin-buy') { H.onSkinBuy(arg); render(); }
    else if (act === 'resume') H.onResume();
    else if (act === 'quit') H.onQuit();
    else if (act === 'quality') H.onQuality(arg);
    else if (act === 'sound') { H.onSound(); render(); }
    else if (act === 'hub') H.onBackToHub();
    else if (act === 'again') H.onAgain();
    else if (act === 'prompt') H.onPrompt();
    else if (act === 'pause') H.onPause();
  });
}

export function setMode(mode) {
  document.body.dataset.mode = mode;
  if (mode !== 'hub') close();
}

export function hubBar(save, stats) {
  const C = CLASSES[save.cls];
  $('hb-class').textContent = C.label;
  $('hb-lvl').textContent = save.lvl;
  $('hb-xp').style.width = `${Math.min(100, save.xp / xpToNext(save.lvl) * 100)}%`;
  $('hb-power').textContent = stats.power.toLocaleString('pt-BR');
  $('hb-gems').textContent = save.settings.dev ? '∞' : save.gems.toLocaleString('pt-BR');
  const d = ensureDaily(save); $('mission-dot').hidden = !(d.missions.some(m => m.done && !m.claimed) || !d.chest);
  $('cal-dot').hidden = !loginState(save).canClaim;
}

export function hud(d) {
  const set = (k, v, fn) => { if (lastHud[k] !== v) { lastHud[k] = v; fn(v); } };
  set('time', fmtTime(d.time), v => { $('hud-time').textContent = v; });
  set('timeLow', d.time < 60, v => $('hud-time').classList.toggle('low', v));
  set('room', `${d.room}/${d.rooms}`, v => { $('hud-room').textContent = `Sala ${v}`; });
  set('obj', d.obj ?? '', v => { $('hud-obj').hidden = !v; $('hud-obj').textContent = v; });
  set('hp', `${Math.ceil(d.hp)}/${d.maxHp}`, v => { $('hud-hp-text').textContent = v; $('hud-hp').style.width = `${d.hp / d.maxHp * 100}%`; });
  set('dash', d.dashCd > 0, v => $('btn-dash').classList.toggle('cooling', v));
  set('boss', d.boss ? `${d.boss.name}|${Math.ceil(d.boss.hp)}` : '', () => {
    $('hud-boss').hidden = !d.boss;
    if (d.boss) { $('hud-boss-name').textContent = d.boss.name; $('hud-boss-fill').style.width = `${Math.max(0, d.boss.hp / d.boss.max * 100)}%`; }
  });
}
export const resetHud = () => { lastHud = {}; };

// Botões das 3 habilidades (também servem de botão de toque).
let lastSk = [];
export function skillsHud(list) {
  list.forEach((sk, i) => {
    const key = sk ? `${sk.label}|${Math.ceil(sk.cd * 10)}` : 'x';
    if (lastSk[i] === key) return;
    const prevReady = lastSk[i] && !lastSk[i].endsWith('|0') ? false : true;
    lastSk[i] = key;
    const el = $('sk' + i);
    el.classList.toggle('empty', !sk);
    el.querySelector('.nm').textContent = sk ? sk.label : 'Vazio';
    el.querySelector('.cd').textContent = sk && sk.cd > 0 ? Math.ceil(sk.cd) : '';
    if (!sk) return;
    el.style.setProperty('--c', hex(RARITY[sk.rarity].color));
    el.style.setProperty('--p', sk.cd > 0 ? 1 - sk.cd / sk.max : 1);
    const ready = sk.cd <= 0; el.classList.toggle('ready', ready);
    if (ready && !prevReady) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  });
}

export function prompt(label) {
  const el = $('prompt');
  el.hidden = !label;
  if (label) $('prompt-text').textContent = label;
}

export function toast(text, color = '#fff') {
  const el = document.createElement('div'); el.className = 'toast'; el.style.setProperty('--c', color); el.textContent = text;
  $('toasts').prepend(el); setTimeout(() => el.remove(), 3200);
  while ($('toasts').children.length > 4) $('toasts').lastChild.remove();
}

export function banner(top, title, color = '#fff', big = false) {
  const el = $('banner');
  $('banner-top').textContent = top; $('banner-title').textContent = title; el.style.color = color;
  el.classList.toggle('big', big);
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

// Pool fixo de números de dano: reaproveita elementos em vez de criar um por acerto.
const NUM_POOL = [], NUM_FRAMES = [
  { opacity:0, transform:'translate(-50%, -30%) scale(.6)' }, { opacity:1, transform:'translate(-50%, -60%) scale(1.15)', offset:0.15 },
  { opacity:0, transform:'translate(-50%, -160%) scale(1)' }];
let numNext = 0;
export function number(x, y, text, kind = '') {
  if (!NUM_POOL.length) for (let i = 0; i < 28; i++) { const el = document.createElement('div'); el.style.opacity = 0; $('nums').appendChild(el); NUM_POOL.push(el); }
  const el = NUM_POOL[numNext]; numNext = (numNext + 1) % NUM_POOL.length;
  el.className = `num ${kind}`; el.textContent = text; el.style.left = `${x}px`; el.style.top = `${y}px`;
  el.getAnimations().forEach(a => a.cancel());
  el.animate(NUM_FRAMES, { duration:900, easing:'ease-out', fill:'forwards' });
}

// Painel da área de treino (null esconde).
export function yard(d) {
  document.body.classList.toggle('yard', !!d); if (!d) return;
  $('yd-dps').textContent = d.dps; $('yd-total').textContent = d.total; $('yd-max').textContent = d.max; $('yd-crit').textContent = `${d.crit}%`;
}

export function hurtFlash() { const el = $('hurt'); el.classList.remove('on', 'mythic'); void el.offsetWidth; el.classList.add('on'); }
// Drop mítico: tela pulsa em carmesim (mais forte e mais longo que o dano).
export function mythicFlash() { const el = $('hurt'); el.classList.remove('on'); el.classList.add('mythic'); void el.offsetWidth; el.classList.add('on'); }

export function pauseMenu(show) { $('pause').hidden = !show; if (show) renderPause(); }

// ---------- painéis ----------
export const isOpen = () => panel;
export function open(name) { bulk = null; pendingLine = null; if (name === 'livro') bookTab = 'guia'; if (name === 'ferreiro') { smithView = 'talk'; smithMsg = ''; } if (name === 'alquimista') { alchView = 'talk'; alchMsg = ''; } panel = name; selectedItem = null; $('panel').hidden = false; document.body.dataset.panel = name; H.onPanel?.(name); render(); }
export function close() {
  if (!panel) return;
  panel = null; $('panel').hidden = true; delete document.body.dataset.panel; H.onPanel?.(null);
}
export function refresh() { if (panel) render(); }

function render() {
  const save = H.getSave(), stats = H.getStats();
  const body = $('panel-body');
  const titles = { dungeons:'Escolher dungeon', mochila:'Mochila', classe:'Classe', skins:'Skins', ajustes:'Ajustes', missoes:'Missões', ferreiro:'Ferreiro', bestiario:'Bestiário', calendario:'Calendário de login', alquimista:'Alquimista', livro:'Livro do Aventureiro' };
  $('panel-title').textContent = titles[panel] ?? '';
  $('panel').dataset.panel = panel;
  if (panel === 'dungeons') body.innerHTML = renderDungeons(save, stats);
  else if (panel === 'mochila') body.innerHTML = renderMochila(save);
  else if (panel === 'classe') body.innerHTML = renderClasses(save);
  else if (panel === 'skins') body.innerHTML = renderSkins(save);
  else if (panel === 'ajustes') body.innerHTML = renderSettings(save);
  else if (panel === 'missoes') body.innerHTML = renderMissions(save);
  else if (panel === 'calendario') body.innerHTML = renderCalendar(save);
  else if (panel === 'bestiario') { body.innerHTML = renderBestiary(save); typeLine(npcSay('sylas')); }
  else if (panel === 'ferreiro') { body.innerHTML = renderSmith(save); if (smithView === 'talk') typeLine(npcSay('brakk')); }
  else if (panel === 'alquimista') { body.innerHTML = renderAlchemist(save); if (alchView === 'talk') typeLine(npcSay('mirela')); }
  else if (panel === 'livro') body.innerHTML = renderBook(save);
}

function renderDungeons(save, stats) {
  return `<p class="hint">Mate o chefe em <b>${fmtTime(TIME_LIMIT)}</b>. Todas as dungeons estão abertas, mas sem poder suficiente o tempo acaba antes. Seu poder: <b>${stats.power.toLocaleString('pt-BR')}</b></p>
  <div class="cards">${DUNGEONS.map(d => {
    const rec = recommendedPower(d.level), diff = difficultyLabel(stats.power, d.level), best = save.best[String(d.level)];
    return `<div class="card dungeon theme-${d.theme}">
      <div class="card-top"><span class="lv">Nível ${d.level}</span><span class="chip ${diff.id}">${diff.label}</span></div>
      <h3>${esc(d.name)}</h3>
      <div class="meta">Poder recomendado <b>${rec.toLocaleString('pt-BR')}</b></div>
      <div class="meta">Melhor tempo <b>${best ? fmtTime(best) : '—'}</b></div>
      <button class="btn primary" data-act="play" data-arg="${d.level}">Entrar</button>
    </div>`;
  }).join('')}</div>`;
}

// Afixos com valor, faixa e qualidade do rolo (100% = rolo perfeito).
function affixList(it, compact = false) {
  if (!it.affixes?.length) return '';
  const rows = it.affixes.map(a => { const A = AFFIXES[a.id], q = Math.round(affixQuality(a) * 100);
    return `<li class="${q >= 90 ? 'perfect' : ''}"><span>+${a.v}% ${esc(A.label)}</span>${compact ? '' : `<small>${A.min}–${A.max}% · <b>${q}%</b></small>`}</li>`; }).join('');
  return `<ul class="affixes">${rows}</ul><div class="d-roll">Qualidade do rolo: <b>${Math.round(rollQuality(it) * 100)}%</b></div>`;
}
const mythicNote = it => it.rarity === 'mitico' && it.slot === 'arma' && MYTHIC_FX[it.kind] ? `<div class="d-mythic"><b>${esc(MYTHIC_FX[it.kind].label)}:</b> ${esc(MYTHIC_FX[it.kind].desc)}</div>` : '';
// Ganho/perda de cada atributo se o item for equipado no lugar do atual.
function statDiff(save, it) {
  const a = playerStats(save), b = statsIfEquipped(save, it.id);
  const rows = STAT_ROWS.map(([k, label, pct]) => {
    const d = b[k] - a[k], n = pct ? Math.round(d * 1000) / 10 : Math.round(d);
    return n ? `<li class="${n > 0 ? 'up' : 'down'}">${n > 0 ? '▲ +' : '▼ '}${n}${pct ? '%' : ''} ${label}</li>` : '';
  }).join('');
  return rows ? `<ul class="d-diff">${rows}</ul>` : '<div class="d-note">Mesmos atributos do equipado.</div>';
}

function itemStat(it) {
  if (it.slot === 'skill') { const S = SKILLS[it.skill]; return `Recarga ${S.cd}s · Poder +${Math.round((skillPower(it) - 1) * 100)}%`; }
  return [it.atk ? `+${it.atk} ATQ` : '', it.hp ? `+${it.hp} VIDA` : ''].filter(Boolean).join(' · ');
}
// Ícone pelo design: armadura pelo nome do conjunto, amuleto por formato, resto pelo tipo.
const iconKey = it => it.slot === 'armadura' && ICONS[it.name] ? it.name : it.slot === 'amuleto' ? `amuleto${['Colar de Osso', 'Gota de Safira', 'Olho do Vazio', 'Coração da Fênix'].includes(it.name) ? 0 : 1}` : it.kind;
// Miniatura 3D do item (pronta ou pedida); enquanto não fica pronta, mostra o ícone desenhado.
const itemIcon = (it, color) => thumbHtml(it, H?.getSave?.().cls, icon(iconKey(it), color));
function itemTile(save, it, selected) {
  const R = RARITY[it.rarity], eq = isEquipped(save, it.id), picked = bulk?.has(it.id);
  return `<button class="tile r-${it.rarity}${selected ? ' sel' : ''}${picked ? ' picked' : ''}" style="--c:${hex(R.color)}" data-act="${bulk && !eq ? 'pick' : 'select'}" data-arg="${it.id}" title="${esc(displayName(it))}">
    ${itemIcon(it, hex(R.color))}<span class="tlv">Nv${it.level}${it.plus ? ` +${it.plus}` : ''}</span>${eq ? '<span class="teq">E</span>' : ''}</button>`;
}

function renderMochila(save) {
  const eq = equippedItems(save);
  const slots = ['arma', 'armadura', 'amuleto'].map(s => {
    const it = eq[s];
    return `<div class="slot">${it ? itemTile(save, it, selectedItem === it.id) : `<div class="tile empty">${icon(s === 'arma' ? CLASSES[save.cls].weapon : s, '#55607e')}</div>`}<span>${SLOT_LABEL[s]}</span></div>`;
  }).join('');
  const sks = equippedSkills(save), keys = ['Q', 'E', 'R'];
  const skSlots = sks.map((it, i) => `<div class="slot">${it ? itemTile(save, it, selectedItem === it.id) : `<div class="tile empty">${icon('skill', '#55607e')}</div>`}<span>${keys[i]}</span></div>`).join('');
  const filters = [['tudo', 'Tudo'], ['materiais', 'Materiais'], ['arma', 'Armas'], ['skill', 'Habilidades'], ['armadura', 'Armaduras'], ['amuleto', 'Amuletos'], ['lendario', 'Lendários'], ['mitico', 'Míticos']];
  const list = save.inventory
    .filter(i => mochilaFilter === 'tudo' || i.slot === mochilaFilter || i.rarity === mochilaFilter)
    .filter(i => !i.cls || i.cls === save.cls || mochilaFilter === i.slot || mochilaFilter === i.rarity)
    .sort((a, b) => itemPower(b) - itemPower(a) || RARITY[b.rarity].rank - RARITY[a.rarity].rank);
  const chips = `<div class="filters">${filters.map(([id, l]) => `<button class="chipbtn${mochilaFilter === id ? ' on' : ''}" data-act="filter" data-arg="${id}">${l}</button>`).join('')}<span class="count">${save.inventory.length}/${INVENTORY_CAP}</span></div>`;
  if (mochilaFilter === 'materiais') return `<div class="slots">${slots}</div>${chips}${renderBag(save)}`;
  const sel = save.inventory.find(i => i.id === selectedItem);
  let detail = '<div class="detail empty">Toque num item para ver detalhes.</div>';
  if (sel) {
    const R = RARITY[sel.rarity], isSkill = sel.slot === 'skill';
    const cur = isSkill ? null : sel.slot === 'arma' ? save.inventory.find(i => i.id === save.equipped.arma[sel.cls]) : eq[sel.slot];
    const delta = cur && cur.id !== sel.id ? itemPower(sel) - itemPower(cur) : null;
    const equipped = isEquipped(save, sel.id), mine = !sel.cls || sel.cls === save.cls;
    const skillIdx = isSkill ? save.equipped.skills[sel.cls].indexOf(sel.id) : -1;
    const skillBtns = isSkill && mine ? keys.map((k, i) => skillIdx === i ? '' : `<button class="btn ${i === 0 && skillIdx < 0 ? 'primary' : 'ghost'}" data-act="equip" data-arg="${sel.id}" data-slot="${i}">Usar no ${k}</button>`).join('')
      + (skillIdx >= 0 ? `<button class="btn ghost" data-act="unskill" data-arg="${skillIdx}">Tirar do ${keys[skillIdx]}</button>` : '') : '';
    detail = `<div class="detail" style="--c:${hex(R.color)}">
      <div class="d-head">${itemIcon(sel, hex(R.color))}<div><div class="d-rar">${R.label} · Nível ${sel.level}</div><div class="d-name">${esc(displayName(sel))}${sel.plus ? ` +${sel.plus}` : ''}</div></div></div>
      <div class="d-stat">${itemStat(sel)}</div>
      ${affixList(sel)}${mythicNote(sel)}
      ${isSkill ? `<div class="d-desc">${esc(SKILLS[sel.skill].desc)}</div>` : ''}
      ${sel.cls && sel.cls !== save.cls ? `<div class="d-note">${isSkill ? 'Habilidade' : 'Arma'} de ${CLASSES[sel.cls].label}</div>` : ''}
      ${delta !== null ? `<div class="d-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} de poder vs. equipado</div>${mine ? statDiff(save, sel) : ''}` : ''}
      <div class="d-actions">
        ${isSkill ? skillBtns : equipped ? '<span class="pill">Equipado</span>' : `<button class="btn primary" data-act="equip" data-arg="${sel.id}">Equipar</button>`}
        ${!isSkill && (sel.plus ?? 0) < MAX_PLUS ? '<span class="pill">Forje com o ferreiro do hub</span>' : ''}
        ${equipped ? '' : `<button class="btn ghost" data-act="salvage" data-arg="${sel.id}">Desmanchar +${R.salvage * sel.level} gemas</button>`}
      </div></div>`;
  }
  return `<div class="slots">${slots}</div>
    <div class="slots sk">${skSlots}</div>
    ${chips}
    <div class="filters"><button class="chipbtn${bulk ? ' on' : ''}" data-act="bulk">${bulk ? 'Cancelar seleção' : 'Selecionar para vender'}</button>
      ${bulk ? `${['comum', 'raro', 'epico'].map(r => `<button class="chipbtn" data-act="pickall" data-arg="${r}" style="color:${hex(RARITY[r].color)}">+ ${RARITY[r].label}s</button>`).join('')}` : ''}</div>
    ${bulk ? `<button class="btn gem sellbar" data-act="sellbulk" ${bulk.size ? '' : 'disabled'}>Vender ${bulk.size} ${bulk.size === 1 ? 'item' : 'itens'} · ◆ ${[...bulk].reduce((g, id) => { const i = save.inventory.find(x => x.id === id); return g + (i ? RARITY[i.rarity].salvage * i.level : 0); }, 0)}</button>` : ''}
    <div class="grid">${list.map(i => itemTile(save, i, i.id === selectedItem)).join('') || '<p class="hint">Nada aqui ainda.</p>'}</div>
    ${detail}`;
}

function renderClasses(save) {
  return `<div class="cards">${Object.values(CLASSES).map(c => `<div class="card cls${save.cls === c.id ? ' on' : ''}">
    <div class="card-top">${icon(c.weapon, '#cfd6ff')}<h3>${c.label}</h3></div>
    <div class="meta">Ataque: ${c.attack}</div>
    <div class="meta">Habilidades (${skillsOf(c.id).filter(id => save.inventory.some(i => i.skill === id)).length}/${skillsOf(c.id).length} encontradas):</div>
    <div class="meta">Vida base ${c.baseHp} · Ataque base ${c.baseAtk}</div>
    <div class="meta">Coleção de armas (${RARITIES.reduce((n, r) => n + [0, 1, 2].filter(v => save.found?.[`${c.weapon}:${r.id}:${v}`]).length, 0)}/${RARITIES.length * 3}):</div>
    <div class="skill-list">${RARITIES.flatMap(r => weaponNames(c.weapon, r.id).map((nm, v) => { const has = save.found?.[`${c.weapon}:${r.id}:${v}`]; return `<span class="skill-chip${has ? '' : ' missing'}" style="--c:${hex(r.color)}">${has ? thumbHtml({ slot:'arma', kind:c.weapon, rarity:r.id, variant:v }, c.id, '') : '🔒 '}${esc(nm)}</span>`; })).join('')}</div>
    <div class="skill-list">${skillsOf(c.id).map(id => { const S = SKILLS[id], has = save.inventory.some(i => i.skill === id); return `<span class="skill-chip${has ? '' : ' missing'}" style="--c:${hex(RARITY[S.rarity].color)}" title="${esc(S.desc)}">${has ? '' : '🔒 '}${esc(S.label)}</span>`; }).join('')}</div>
    ${save.cls === c.id ? '<span class="pill">Em uso</span>' : `<button class="btn primary" data-act="class" data-arg="${c.id}">Usar</button>`}
  </div>`).join('')}</div>`;
}

function renderSkins(save) {
  const preview = H.getPreviewSkin();
  return `<p class="hint">Skins mudam só a aparência. Ganhe gemas vencendo dungeons e desmanchando itens.</p>
  <div class="cards">${Object.entries(SKINS).map(([id, s]) => {
    const owned = save.ownedSkins.includes(id), using = save.skin === id;
    const action = using ? '<span class="pill">Em uso</span>'
      : owned ? `<button class="btn primary" data-act="skin-use" data-arg="${id}">Usar</button>`
      : `<button class="btn gem" data-act="skin-buy" data-arg="${id}" ${!save.settings.dev && save.gems < s.price ? 'disabled' : ''}>◆ ${save.settings.dev ? 'Grátis (teste)' : s.price.toLocaleString('pt-BR')}</button>`;
    return `<div class="card skin${preview === id ? ' on' : ''}">
      <div class="card-top"><h3>${s.label}</h3>${s.price ? '<span class="chip premium">Premium</span>' : '<span class="chip">Grátis</span>'}</div>
      <div class="row2"><button class="btn ghost" data-act="skin-preview" data-arg="${id}">Ver no boneco</button>${action}</div>
    </div>`;
  }).join('')}</div>`;
}

function renderSettings(save) {
  const q = save.settings.quality;
  return `<div class="setting"><span>Gráficos</span><div class="seg">
    <button class="chipbtn${q === 'alto' ? ' on' : ''}" data-act="quality" data-arg="alto">Alto</button>
    <button class="chipbtn${q === 'baixo' ? ' on' : ''}" data-act="quality" data-arg="baixo">Baixo</button></div></div>
    <p class="hint">Baixo desliga brilho e sombras: use em celular mais fraco. A página recarrega ao trocar.</p>
    <div class="setting"><span>Seu nome</span><input id="name-input" class="txt" maxlength="16" value="${esc(save.name)}" aria-label="Nome do jogador"><button class="chipbtn" data-act="setname">Salvar</button></div>
    <div class="setting"><span>Modo teste (gemas infinitas)</span><button class="chipbtn${save.settings.dev ? ' on' : ''}" data-act="dev" data-arg="toggle">${save.settings.dev ? 'Ligado' : 'Desligado'}</button></div>
    ${save.settings.dev ? `<div class="setting"><span>VIP (teste do visual)</span><button class="chipbtn${save.vip ? ' on' : ''}" data-act="vip">${save.vip ? 'Ligado' : 'Desligado'}</button></div>` : ''}
    ${save.settings.dev ? `<div class="devrow"><button class="btn ghost" data-act="dev" data-arg="skills">Liberar habilidades da classe</button><button class="btn ghost" data-act="dev" data-arg="legend">Ganhar lendários</button><button class="btn ghost" data-act="dev" data-arg="mythic">Ganhar míticos</button><button class="btn ghost" data-act="dev" data-arg="mats">Ganhar materiais</button><button class="btn ghost" data-act="dev" data-arg="pages">Ganhar páginas</button></div>` : ''}
    <div class="setting"><span>Música</span><input type="range" min="0" max="1" step="0.05" value="${save.settings.music}" data-vol="music" aria-label="Volume da música"></div>
    <div class="setting"><span>Efeitos</span><input type="range" min="0" max="1" step="0.05" value="${save.settings.sfx}" data-vol="sfx" aria-label="Volume dos efeitos"></div>
    <div class="setting"><span>Som</span><button class="chipbtn${save.settings.sound ? ' on' : ''}" data-act="sound">${save.settings.sound ? 'Ligado' : 'Desligado'}</button></div>
    <div class="setting"><span>Progresso</span><button class="btn danger" data-act="reset">Apagar tudo</button></div>
    <h4>Controles no PC</h4>
    <p class="hint">WASD andar · mouse mirar · clique ou espaço atacar · Q, E, R habilidades (botão direito = Q) · Shift esquivar · F interagir e coletar · 1 ou H poção · Esc pausar</p>
    <h4>Controles no celular</h4>
    <p class="hint">Arraste no lado esquerdo para andar. Botões à direita: atacar (segure), três habilidades, esquiva e poção. A mira é automática. No Vale, toque no aviso para coletar.</p>`;
}

function renderMissions(save) {
  const d = ensureDaily(save);
  const boost = MOBS[boostedCreature()];
  return `<div class="mission done"><div class="mtop"><span>Criatura do dia: <b>${esc(boost.label)}</b></span></div><small class="hint">+50% XP e o dobro de chance de itens ao derrotá-la.</small></div>
  <button class="btn ghost" data-act="open" data-arg="bestiario" style="margin:8px 0">Bestiário e charms</button>
  ${npcQuestList(save)}
  <p class="hint">Renovam todo dia. O <b>baú diário</b> fica na frente da praça ${d.chest ? '(já aberto hoje)' : '(disponível!)'}.</p>
  ${pityBox(save)}
  <div class="cards">${d.missions.map((m, i) => `<div class="mission${m.done ? ' done' : ''}">
    <div class="mtop"><span>${esc(m.label)}</span><b>◆ ${m.gems}</b></div>
    <div class="bar"><i style="width:${Math.round(m.p / m.n * 100)}%"></i></div>
    ${m.claimed ? '<span class="pill">Resgatada</span>' : m.done ? `<button class="btn primary" data-act="claim" data-arg="${i}">Resgatar</button>` : `<small class="hint">${m.id === 'fast' ? 'ainda não' : `${m.p}/${m.n}`}</small>`}
  </div>`).join('')}</div>`;
}

// Lendário garantido: conta baús de fim de dungeon e o baú diário.
const pityBox = save => { const n = pityLeft(save); return `<div class="pity"><span>Lendário garantido ${n === 1 ? '<b>no próximo baú</b>' : `em <b>${n} baús</b>`}</span><small class="hint">Baús de dungeon e diário. A chance sobe a cada baú sem lendário.</small></div>`; };

// ---------- calendário de login ----------
const rewardText = r => r.special ? 'Item mítico + ◆ 500' : r.chest ? `${r.chest} ${r.chest > 1 ? 'itens' : 'item'}${r.min ? ` ${RARITY[r.min].label.toLowerCase()}+` : ''}` : `◆ ${r.gems}`;
function renderCalendar(save) {
  const st = loginState(save), done = st.canClaim ? st.streak - 1 : st.streak;
  const start = Math.floor((Math.max(1, st.streak) - 1) / 7) * 7; // primeiro dia do ciclo atual
  const cells = Array.from({ length:7 }, (_, i) => {
    const n = start + i + 1, r = loginReward(n), cls = n <= done ? 'got' : n === st.streak && st.canClaim ? 'today' : '';
    return `<div class="calday ${cls}${r.big || r.special ? ' big' : ''}"><small>Dia ${n}</small><b>${rewardText(r)}</b>${n <= done ? '<i>✓</i>' : ''}</div>`;
  }).join('');
  const toSpecial = 30 - (done % 30);
  return `<p class="hint">Entre todo dia para manter a sequência. <b>Perder um dia volta ao dia 1.</b> Sequência atual: <b>${done} ${done === 1 ? 'dia' : 'dias'}</b>.</p>
  <div class="calgrid">${cells}</div>
  <p class="hint">A cada <b>30 dias seguidos</b>: item <b style="color:${hex(RARITY.mitico.color)}">Mítico</b> garantido + ◆ 500 (faltam ${toSpecial}).</p>
  ${st.canClaim ? `<button class="btn primary" data-act="login">Resgatar dia ${st.streak}</button>` : '<span class="pill">Já resgatado hoje. Volte amanhã!</span>'}`;
}

// ---------- ferreiro ----------
let smithView = 'talk', smithSel = null, smithMsg = '', typeTimer = 0;
function typeLine(text) {
  const el = $('npc-line'); if (!el) return; let i = 0;
  clearInterval(typeTimer); typeTimer = setInterval(() => { if (!el.isConnected || i >= text.length) { clearInterval(typeTimer); return; } el.textContent = text.slice(0, ++i); }, 28);
}
function renderSmith(save) {
  if (smithView === 'talk') return `<div class="npc">${npcHead(save, 'brakk')}
    <div class="npc-opts">${npcTalk(save, 'brakk')}<button class="btn primary" data-act="smith" data-arg="forge">Forjar equipamento</button><button class="btn ghost" data-act="smith" data-arg="reroll">Re-rolar afixos</button>
      <button class="btn ghost" data-act="smith" data-arg="tools">Ferramentas de coleta</button><button class="btn ghost" data-act="smith" data-arg="bag">Ver mochila</button><button class="btn ghost" data-act="close">Até mais</button></div></div>`;
  if (smithView === 'tools') return smithWrap(renderTools(save));
  if (smithView === 'reroll') return smithWrap(renderReroll(save));
  const items = save.inventory.filter(i => i.slot !== 'skill' && (!i.cls || i.cls === save.cls))
    .sort((a, b) => Number(isEquipped(save, b.id)) - Number(isEquipped(save, a.id)) || itemPower(b) - itemPower(a));
  const sel = items.find(i => i.id === smithSel) ?? items[0];
  let detail = '';
  if (sel) {
    const R = RARITY[sel.rarity], plus = sel.plus ?? 0, maxed = plus >= MAX_PLUS;
    const next = s => Math.round(s * 1.1), stat = (a, h) => [a ? `${a} ATQ` : '', h ? `${h} VIDA` : ''].filter(Boolean).join(' · ');
    detail = `<div class="detail forge" style="--c:${hex(R.color)}">
      <div class="d-head">${itemIcon(sel, hex(R.color))}<div><div class="d-rar">${R.label} · Nível ${sel.level}</div><div class="d-name">${esc(displayName(sel))}${plus ? ` +${plus}` : ''}</div></div></div>
      ${maxed ? '<div class="d-stat">No máximo (+5). Obra-prima!</div>' : `<div class="d-stat">${stat(sel.atk, sel.hp)} → <b>${stat(next(sel.atk), next(sel.hp))}</b></div>
      <div class="d-note">Chance: <b>${Math.round(forgeChance(sel) * 100)}%</b> · Custo: ◆ ${save.settings.dev ? 'grátis (teste)' : upgradeCost(sel)}</div>
      <div class="d-actions"><button class="btn gem" data-act="forge" data-arg="${sel.id}" ${forging ? 'disabled' : ''}>${forging ? 'Martelando…' : `Forjar +${plus + 1}`}</button></div>`}
    </div>`;
  }
  return `${smithMsg ? `<div class="forge-msg ${smithMsg.ok ? 'ok' : 'bad'}">${esc(smithMsg.text)}</div>` : ''}
    <div class="grid">${items.map(i => itemTile(save, i, i.id === sel?.id).replace('data-act="select"', 'data-act="smithsel"')).join('')}</div>
    ${detail}
    <div class="row2" style="margin-top:10px"><button class="btn ghost" data-act="smith" data-arg="talk">Voltar</button></div>`;
}
let forging = false;
export function smithState(f, msg) { forging = f; if (msg) smithMsg = msg; if (panel === 'ferreiro') render(); }
const smithWrap = html => `${smithMsg ? `<div class="forge-msg ${smithMsg.ok ? 'ok' : 'bad'}">${esc(smithMsg.text)}</div>` : ''}${html}
  <div class="row2" style="margin-top:10px"><button class="btn ghost" data-act="smith" data-arg="talk">Voltar</button></div>`;

// ---------- coleta, materiais e poções ----------
const matIcon = id => icon(MATERIALS[id].kind, hex(MATERIALS[id].color));
const potIcon = id => icon('pocao', hex(POTIONS[id].color));
// Custo com o que você tem: verde quando dá, vermelho quando falta.
function costHtml(save, cost) {
  return `<div class="costs">${Object.entries(cost).map(([id, n]) => {
    if (id === 'gems') return `<span class="cost ${hasCost(save, { gems:n }) ? 'ok' : 'no'}">◆ ${save.settings.dev ? 'grátis (teste)' : n}</span>`;
    const have = save.mats[id] ?? 0;
    return `<span class="cost ${have >= n ? 'ok' : 'no'}">${matIcon(id)}${have}/${n} ${esc(MATERIALS[id].label)}</span>`;
  }).join('')}</div>`;
}
function profBar(save, k) {
  const p = profInfo(save.prof[k]);
  return `<div class="prof"><div class="mtop"><span><b>${PROFS[k].label}</b> nível ${p.lvl}</span><small class="hint">${p.cur}/${p.next}</small></div>
    <div class="bar"><i style="width:${Math.round(p.cur / p.next * 100)}%"></i></div><small class="hint">Por nível: ${PROFS[k].perks.join(' · ')}</small></div>`;
}
const TOOL_UNLOCK = { picareta:['', 'Prata', 'Mitril', 'mais rápida e mais minério extra'], foice:['', 'Raiz Lunar', 'Flor Solar', 'mais rápida e mais erva extra'] };
function renderTools(save) {
  return `<p class="hint">Ferramenta melhor coleta veios e moitas mais raros no <b>Vale das Ervas</b>, mais rápido e com mais recurso extra.</p>
  <div class="cards">${Object.keys(TOOLS).map(t => {
    const tier = save.tools[t], cost = TOOL_COST[t][tier];
    return `<div class="card tool"><div class="d-head">${icon(t, '#ffd36b')}<div><div class="d-rar">Nível ${tier}/${TOOL_MAX}</div><div class="d-name">${toolName(t, tier)}</div></div></div>
      ${cost ? `<div class="d-note">Próxima: <b>${toolName(t, tier + 1)}</b> · coleta ${TOOL_UNLOCK[t][tier]}</div>${costHtml(save, cost)}
      <button class="btn gem" data-act="toolup" data-arg="${t}" ${forging || !hasCost(save, cost) ? 'disabled' : ''}>${forging ? 'Martelando…' : 'Melhorar'}</button>` : '<span class="pill">No máximo. Obra-prima!</span>'}</div>`;
  }).join('')}</div>`;
}
function renderReroll(save) {
  const items = save.inventory.filter(i => i.affixes?.length && (!i.cls || i.cls === save.cls))
    .sort((a, b) => Number(isEquipped(save, b.id)) - Number(isEquipped(save, a.id)) || RARITY[b.rarity].rank - RARITY[a.rarity].rank);
  if (!items.length) return '<p class="hint">Nenhum item com afixos. Raros ou melhores têm afixos para re-rolar.</p>';
  const sel = items.find(i => i.id === smithSel) ?? items[0], R = RARITY[sel.rarity], cost = rerollCost(sel), can = hasCost(save, cost);
  return `<p class="hint">Escolha um afixo para trocar por outro sorteado. Os outros ficam como estão.</p>
    <div class="grid">${items.map(i => itemTile(save, i, i.id === sel.id).replace('data-act="select"', 'data-act="smithsel"')).join('')}</div>
    <div class="detail forge" style="--c:${hex(R.color)}">
      <div class="d-head">${itemIcon(sel, hex(R.color))}<div><div class="d-rar">${R.label} · Nível ${sel.level}</div><div class="d-name">${esc(displayName(sel))}${sel.plus ? ` +${sel.plus}` : ''}</div></div></div>
      <div class="d-note">Custo por troca:</div>${costHtml(save, cost)}
      <div class="rerolls">${sel.affixes.map((a, i) => `<div class="reroll"><span>${esc(AFFIXES[a.id].label)} <b>+${a.v}%</b> <small class="hint">qualidade ${Math.round(affixQuality(a) * 100)}%</small></span>
        <button class="chipbtn" data-act="reroll" data-arg="${sel.id}" data-idx="${i}" ${forging || !can ? 'disabled' : ''}>${forging ? '…' : 'Re-rolar'}</button></div>`).join('')}</div>
    </div>`;
}
function renderBag(save) {
  const pots = Object.keys(POTIONS).filter(id => save.potions[id] || save.recipes.includes(id));
  return `<h4>Poções <small class="hint">· cinto: tecla 1 ou H, botão na dungeon (máx. ${POTION_RUN_LIMIT} por dungeon)</small></h4>
    ${pots.length ? `<div class="potlist">${pots.map(id => { const R = POTIONS[id], n = save.potions[id] ?? 0, belt = save.belt === id;
      return `<div class="potrow${belt ? ' on' : ''}">${potIcon(id)}<div><b>${esc(R.label)}</b> <span class="pill">${n}</span><br><small class="hint">${esc(R.desc)}</small></div>
        <div class="potbtns">${belt ? '<span class="pill">No cinto</span>' : `<button class="chipbtn" data-act="belt" data-arg="${id}">Pôr no cinto</button>`}
        ${R.kind === 'buff' && n ? `<button class="chipbtn" data-act="drink" data-arg="${id}">Beber</button>` : ''}</div></div>`; }).join('')}</div>`
      : '<p class="hint">Nenhuma poção ainda. Colete ervas no <b>Vale das Ervas</b> (trilha a nordeste da praça) e fale com a alquimista.</p>'}
    <h4>Materiais <small class="hint">· não ocupam a mochila</small></h4>
    <div class="matgrid">${Object.entries(MATERIALS).map(([id, Mt]) => id in save.mats
      ? `<div class="mat" title="${esc(Mt.where)}">${matIcon(id)}<b>${save.mats[id]}</b><small>${esc(Mt.label)}</small></div>`
      : `<div class="mat unseen" title="${esc(Mt.where)}">${icon(Mt.kind, '#55607e')}<b>?</b><small>${esc(Mt.where)}</small></div>`).join('')}</div>
    <h4>Ferramentas e ofícios</h4>
    <div class="tools">${Object.keys(TOOLS).map(t => `<span class="pill">${icon(t, '#ffd36b')} ${toolName(t, save.tools[t])}</span>`).join('')}<small class="hint">Melhore com o ferreiro Brakk.</small></div>
    ${profBar(save, 'coleta')}${profBar(save, 'alquimia')}`;
}

// ---------- alquimista ----------
let alchView = 'talk', alchMsg = '', brewing = false;
export function alchemyState(on, msg) { brewing = on; if (msg) alchMsg = msg; if (panel === 'alquimista') render(); }
function renderAlchemist(save) {
  if (alchView === 'talk') return `<div class="npc">${npcHead(save, 'mirela')}
    <div class="npc-opts">${npcTalk(save, 'mirela')}<button class="btn primary" data-act="alch" data-arg="book">Livro de receitas</button><button class="btn ghost" data-act="alch" data-arg="bag">Ver materiais e poções</button><button class="btn ghost" data-act="close">Até mais</button></div></div>`;
  const known = Object.keys(POTIONS).filter(id => save.recipes.includes(id)).length;
  const lvl = profInfo(save.prof.alquimia).lvl;
  return `${alchMsg ? `<div class="forge-msg ${alchMsg.ok ? 'ok' : 'bad'}">${esc(alchMsg.text)}</div>` : ''}
    ${profBar(save, 'alquimia')}
    <p class="hint">Receitas: <b>${known}/${Object.keys(POTIONS).length}</b>. Novas aparecem com o nível de Alquimia e ingredientes descobertos.</p>
    <div class="cards">${Object.entries(POTIONS).map(([id, R]) => {
      if (!save.recipes.includes(id)) {
        const miss = Object.keys(R.mats).filter(m => !(m in save.mats)).map(m => MATERIALS[m].label);
        return `<div class="card recipe unknown">${icon('pocao', '#55607e')}<div><b>Receita desconhecida</b><br><small class="hint">${lvl < R.req ? `Alquimia nível ${R.req}` : ''}${lvl < R.req && miss.length ? ' · ' : ''}${miss.length ? `Descubra: ${esc(miss.join(', '))}` : ''}</small></div></div>`;
      }
      const n = save.potions[id] ?? 0, can = hasCost(save, R.mats);
      return `<div class="card recipe">${potIcon(id)}<div><b>${esc(R.label)}</b> <span class="pill">${n} na bolsa</span><br><small class="hint">${esc(R.desc)}</small>${costHtml(save, R.mats)}
        <div class="potbtns"><button class="btn gem" data-act="brew" data-arg="${id}" ${brewing || !can ? 'disabled' : ''}>${brewing ? 'Borbulhando…' : 'Preparar'}</button>
        ${n && save.belt !== id ? `<button class="chipbtn" data-act="belt" data-arg="${id}">Pôr no cinto</button>` : save.belt === id ? '<span class="pill">No cinto</span>' : ''}</div></div></div>`;
    }).join('')}</div>
    <div class="row2" style="margin-top:10px"><button class="btn ghost" data-act="alch" data-arg="talk">Voltar</button></div>`;
}

// HUD: botão de poção (cinto), buffs ativos e anel de coleta.
let lastPot = '', lastBuffs = '';
export function potionHud(p) {
  const key = p ? `${p.label}|${p.n}|${Math.ceil(p.cd * 2)}|${p.left}` : 'x'; if (key === lastPot) return; lastPot = key;
  const el = $('btn-potion');
  el.classList.toggle('empty', !p || !p.n || p.left <= 0); el.classList.toggle('cooling', !!p && p.cd > 0);
  el.querySelector('.pn').textContent = p ? p.n : '';
  el.querySelector('.cd').textContent = p && p.cd > 0 ? Math.ceil(p.cd) : '';
  // Bolinhas = quantas ainda dá para beber nesta dungeon (no hub não tem limite).
  el.querySelector('.pl').textContent = p && Number.isFinite(p.lim) ? '●'.repeat(Math.max(0, p.left)) + '○'.repeat(Math.min(p.lim, p.lim - p.left)) : '';
  el.setAttribute('aria-label', p ? `Beber ${p.label} (${p.n})${Number.isFinite(p.left) ? `, restam ${p.left} nesta dungeon` : ''}` : 'Sem poção no cinto');
  if (p) { el.style.setProperty('--c', hex(p.color)); el.style.setProperty('--p', p.cd > 0 ? 1 - p.cd / p.max : 1); }
}
export function potionBuffs(list) {
  const key = list.map(b => `${b.k}${Math.ceil(b.left)}`).join(); if (key === lastBuffs) return; lastBuffs = key;
  $('potbuffs').innerHTML = list.map(b => `<span style="--c:${b.color}">${esc(b.label)} ${fmtTime(b.left)}</span>`).join('');
}
export function gatherRing(x, y, p) {
  const el = $('gather-ring'); el.hidden = x === null;
  if (x !== null) { el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.setProperty('--p', Math.min(1, p)); }
}

function renderBestiary(save) {
  const pts = charmPoints(save), all = [...Object.keys(MOBS), ...Object.keys(BOSSES)], found = all.filter(t => discovered(save, t)).length;
  const num = n => Math.round(n).toLocaleString('pt-BR');
  const sheet = t => {
    const boss = !MOBS[t], m = boss ? BOSSES[t] : MOBS[t], where = dungeonsWith(t), ico = boss ? 'chefe' : m.attack;
    if (!discovered(save, t)) return `<div class="beast unknown"><div class="b-top"><span class="b-ico">${icon(ico, '#4a5070')}</span><div><h3>???</h3>
      <small class="hint">${boss ? 'Chefe' : 'Criatura'} · aparece a partir do Nível ${where[0]?.level ?? '?'}. ${boss ? 'Vença a dungeon' : 'Derrote um'} para revelar.</small></div></div></div>`;
    const k = save.bestiary?.[t] ?? 0, st = bestiaryStars(save, t), next = BESTIARY_STAGES[st];
    const atk = boss ? m.patterns.map(p => BOSS_PATTERNS[p] ?? p).join(' · ') : ATTACK_KINDS[m.attack];
    return `<div class="beast${boss ? ' boss' : ''}${st === 3 ? ' done' : ''}">
      <div class="b-top"><span class="b-ico">${icon(ico, boss ? '#ff8a96' : '#ffcf5a')}</span><div><h3>${esc(m.label)}</h3>
        ${boss ? '<span class="chip impossivel">Chefe</span>' : `<span class="b-stars">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>`}</div></div>
      <div class="b-stats"><span><small>Vida</small><b>${num(m.hp)}</b></span><span><small>Dano</small><b>${num(m.dmg)}</b></span><span><small>Velocidade</small><b>${(m.speed ?? BOSS_SPEED).toLocaleString('pt-BR')}</b></span>${boss ? '' : `<span><small>XP</small><b>${m.xp}</b></span>`}</div>
      <div class="meta"><b>${boss ? 'Golpes' : 'Ataque'}:</b> ${esc(atk)}</div>
      <div class="meta"><b>Dica:</b> ${esc(m.tip ?? '')}</div>
      <div class="b-where">${where.map(d => { const s = dungeonScale(d.level); return `<span title="${esc(d.name)}">Nv.${d.level} ${esc(d.name)} <i>${num(m.hp * s)} vida · ${num(m.dmg * s)} dano</i></span>`; }).join('')}</div>
      ${boss ? '' : next ? `<div class="bar"><i style="width:${Math.min(100, k / next * 100)}%"></i></div><small class="hint">${k} abates · ${next - k} para a próxima estrela (+10 pontos de charm)</small>` : `<small class="hint">${k} abates · bestiário completo!</small>`}
    </div>`;
  };
  return `<div class="npc">${npcHead(save, 'sylas')}<div class="npc-opts">${npcTalk(save, 'sylas')}</div></div>
  <p class="hint">Descobertos <b>${found}/${all.length}</b>. Etapas: ${BESTIARY_STAGES.join(' / ')} abates. Números da ficha no Nível 1; cada dungeon mostra os dela.</p>
  <h4>Criaturas</h4><div class="cards">${Object.keys(MOBS).map(sheet).join('')}</div>
  <h4>Chefes</h4><div class="cards">${Object.keys(BOSSES).map(sheet).join('')}</div>
  <h4>Charms · ${pts} pontos</h4>
  <div class="cards">${Object.entries(CHARMS).map(([id, c]) => `<div class="mission${hasCharm(save, id) ? ' done' : ''}"><div class="mtop"><span><b style="color:var(--text)">${c.label}</b></span><b>${c.cost} pts</b></div><small class="hint">${c.desc}</small>
    ${hasCharm(save, id) ? '<span class="pill">Ativo</span>' : `<button class="btn primary" data-act="charm" data-arg="${id}" ${pts < c.cost ? 'disabled' : ''}>Desbloquear</button>`}</div>`).join('')}</div>`;
}

// ---------- NPCs: afinidade, conversa e missões ----------
let pendingLine = null;
const pick = a => a[Math.floor(Math.random() * a.length)];
// O que o NPC diz ao abrir o painel: a fala pedida em "Conversar" ou uma fala solta.
const npcSay = npc => { const t = pendingLine ?? pick(S.SMALL_TALK[npc]); pendingLine = null; return t; };
const noNews = (save, npc) => `${pick(S.SMALL_TALK[npc])} (Sem história nova por agora: ${S.affinityNext(save, npc) ? 'fiquem mais próximos para ouvir mais' : 'você já ouviu tudo'}.)`;
const hearts = l => `${'♥'.repeat(l)}${'♡'.repeat(S.AFFINITY.length - 1 - l)}`;
function npcHead(save, npc) {
  const l = S.affinityLevel(save, npc), next = S.affinityNext(save, npc);
  return `<div class="npc-name">${esc(S.NPCS[npc].name)}</div>
    <div class="npc-aff"><span class="hearts">${hearts(l)}</span> ${S.AFFINITY_LABEL[l]}${next ? ` · faltam ${next} para ${S.AFFINITY_LABEL[l + 1]}` : ''}</div>
    <p id="npc-line" class="npc-line"></p>`;
}
function npcTalk(save, npc) {
  const n = S.newLines(save, npc);
  return `<button class="btn ${n ? 'primary' : 'ghost'}" data-act="talk" data-arg="${npc}">Conversar${n ? ` <span class="badge">${n} nova${n > 1 ? 's' : ''}</span>` : ''}</button>${questBox(save, npc)}`;
}
function questBox(save, npc) {
  const s = S.questState(save, npc), who = S.NPCS[npc].short;
  if (s.state === 'done') return `<div class="quest done"><small class="hint">Você fez todas as missões de ${who}.</small></div>`;
  const q = s.q, head = `<div class="q-top">${icon('missao', '#ffcf5a')}<b>${esc(q.title)}</b></div><small class="q-prize">Prêmio: ${esc(S.rewardText(q.reward))}</small>`;
  if (s.state === 'locked') return `<div class="quest locked">${head}<small class="hint">${who} ainda não confia tanto em você (precisa: ${S.AFFINITY_LABEL[q.req]}). Converse e fabrique com ${who}.</small></div>`;
  if (s.state === 'offer') return `<div class="quest">${head}<small class="hint">“${esc(q.text)}”</small><button class="btn primary" data-act="quest" data-arg="${npc}" data-what="accept">Aceitar missão</button></div>`;
  if (s.state === 'ready') return `<div class="quest ready">${head}<button class="btn gem" data-act="quest" data-arg="${npc}" data-what="claim">Entregar e pegar o prêmio</button></div>`;
  return `<div class="quest">${head}<small class="hint">${esc(q.text)}</small><div class="bar"><i style="width:${Math.round(s.p / q.goal.n * 100)}%"></i></div><small class="hint">${s.p}/${q.goal.n}</small></div>`;
}
// Resumo no painel de Missões: primeiros passos e o que cada NPC pediu.
function npcQuestList(save) {
  const t = S.tutorialStep(save), rows = Object.keys(S.NPCS).map(npc => {
    const s = S.questState(save, npc), tag = { done:'Tudo feito', locked:'Afinidade baixa', offer:'Missão nova!', active:`${s.p}/${s.q?.goal.n}`, ready:'Pronta para entregar' }[s.state];
    return `<div class="mission${s.state === 'ready' ? ' done' : ''}"><div class="mtop"><span>${esc(S.NPCS[npc].short)}${s.q ? `: ${esc(s.q.title)}` : ''}</span><b>${tag}</b></div></div>`;
  }).join('');
  return `${t ? `<div class="mission"><div class="mtop"><span>Primeiros passos ${save.story.tut.i + 1}/${S.TUTORIAL.length}: ${esc(t.text)}</span><b>${esc(S.rewardText(t.reward))}</b></div></div>` : ''}
    <h4>Missões dos NPCs</h4><div class="cards">${rows}</div><h4>Missões do dia</h4>`;
}

// ---------- Livro do Aventureiro: guia, diário de Elara e histórias ----------
let bookTab = 'guia';
const ART = {
  dodge:`<svg viewBox="0 0 220 90" class="g-art" aria-hidden="true"><circle cx="70" cy="45" r="34" fill="rgba(255,90,106,.18)" stroke="#ff5a6a" stroke-width="2" stroke-dasharray="6 4"/>
    <circle cx="70" cy="45" r="7" fill="#7fe9ff"/><path d="M80 45h70" stroke="#ffcf5a" stroke-width="4" stroke-linecap="round"/><path d="M140 34l14 11-14 11" fill="none" stroke="#ffcf5a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="178" cy="45" r="7" fill="#7fe9ff"/><text x="70" y="86" text-anchor="middle" fill="#9aa3c7" font-size="11">aviso no chão</text><text x="178" y="86" text-anchor="middle" fill="#9aa3c7" font-size="11">salvo!</text></svg>`,
  rarity:() => `<div class="g-rar">${RARITIES.map(r => `<span style="--c:${hex(r.color)}">${r.label}</span>`).join('')}</div>`,
};
function renderBook(save) {
  const tabs = [['guia', 'Guia'], ['diario', `Diário ${save.story.pages.length}/${S.PAGES.length}`], ['historias', 'Histórias']];
  const head = `<div class="tabs">${tabs.map(([id, l]) => `<button class="chipbtn${bookTab === id ? ' on' : ''}" data-act="book" data-arg="${id}">${l}</button>`).join('')}</div>`;
  if (bookTab === 'diario') return head + renderDiary(save);
  if (bookTab === 'historias') return head + renderStories(save);
  return `${head}<p class="hint">Toque num assunto para abrir.</p>
    ${S.GUIDE.map((g, i) => `<details class="guide"${i === 0 ? ' open' : ''}><summary>${icon(g.icon, '#ffcf5a')}<b>${esc(g.title)}</b></summary>
      ${g.art ? (typeof ART[g.art] === 'function' ? ART[g.art]() : ART[g.art]) : ''}${g.body.map(p => `<p>${esc(p)}</p>`).join('')}</details>`).join('')}`;
}
function renderDiary(save) {
  const have = new Set(save.story.pages), title = save.story.title;
  return `<p class="hint">Páginas perdidas de Elara, a cronista real, caem ao vencer cada dungeon (3 por dungeon). Completar uma dungeon dá ◆ ${S.PAGE_SET_GEMS}; todas dão o título <b>${S.PAGE_TITLE}</b>.</p>
    ${title ? `<div class="mission done"><div class="mtop"><span>Título conquistado</span><b>${esc(title)}</b></div></div>` : ''}
    ${DUNGEONS.map(d => { const pages = S.PAGES.filter(p => p.level === d.level), n = pages.filter(p => have.has(p.id)).length;
      return `<h4>Nv.${d.level} · ${esc(d.name)} <span class="hint">${n}/3</span></h4><div class="cards">${pages.map(p => have.has(p.id)
        ? `<div class="page"><small>Página ${p.n}</small><p>${esc(p.text)}</p></div>`
        : `<div class="page missing"><small>Página ${p.n}</small><p>???</p><small class="hint">Vença esta dungeon para encontrar.</small></div>`).join('')}</div>`; }).join('')}`;
}
function renderStories(save) {
  return `${Object.keys(S.NPCS).map(npc => { const lines = S.heardLines(save, npc);
    return `<h4>${esc(S.NPCS[npc].name)} <span class="hearts">${hearts(S.affinityLevel(save, npc))}</span></h4>${lines.length ? lines.map(l => `<p class="story-line">${esc(l)}</p>`).join('') : `<p class="hint">Converse com ${S.NPCS[npc].short} para ouvir a história.</p>`}`; }).join('')}
    <h4>Guardiões das lascas</h4><div class="cards">${DUNGEONS.map(d => discovered(save, d.boss)
      ? `<div class="page"><small>Nv.${d.level} · ${esc(BOSSES[d.boss].label)}</small><p>${esc(S.BOSS_LORE[d.boss])}</p></div>`
      : `<div class="page missing"><small>Nv.${d.level}</small><p>???</p><small class="hint">Vença o chefe desta dungeon.</small></div>`).join('')}</div>`;
}

// ---------- primeiros passos, seta e dicas ----------
export function questTrack(step, tut) {
  const el = $('quest-track'); el.hidden = !step;
  if (step) el.innerHTML = `<small>Primeiros passos ${tut.i + 1}/${S.TUTORIAL.length}</small><b>${esc(step.text)}${step.goal.n > 1 ? ` (${tut.p}/${step.goal.n})` : ''}</b>`;
}
// ang null = seta quicando em cima do alvo; número = presa na borda apontando para ele.
export function questArrow(x, y, ang) {
  const el = $('qarrow'); el.hidden = x == null || !!panel;
  if (el.hidden) return;
  el.style.left = `${x}px`; el.style.top = `${y}px`; el.classList.toggle('edge', ang != null);
  el.style.setProperty('--a', `${ang == null ? Math.PI / 2 : ang}rad`);
}
const tipQueue = []; let tipTimer = 0;
export function tip(title, text) { tipQueue.push([title, text]); if ($('tipcard').hidden) nextTip(); }
function nextTip(dismiss = false) {
  const el = $('tipcard'); clearTimeout(tipTimer);
  if (dismiss) el.hidden = true;
  const t = tipQueue.shift(); if (!t) { el.hidden = true; return; }
  el.hidden = false; $('tip-title').textContent = t[0]; $('tip-text').textContent = t[1];
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  tipTimer = setTimeout(() => nextTip(true), 11000);
}

function renderPause() {
  const save = H.getSave();
  $('pause-sound').textContent = `Som: ${save.settings.sound ? 'ligado' : 'desligado'}`;
}

export function results(r) {
  const el = $('results');
  el.hidden = false;
  el.classList.toggle('won', r.won); el.classList.toggle('lost', !r.won);
  $('res-title').textContent = r.won ? 'Vitória!' : 'Fracasso';
  $('res-reason').textContent = r.reason;
  $('res-stats').innerHTML = `
    <div><span>Tempo</span><b>${fmtTime(r.time)}</b></div>
    <div><span>Abates</span><b>${r.kills}</b></div>
    <div><span>XP</span><b>+${r.xp}</b></div>
    <div><span>Gemas</span><b>+${r.gems}</b></div>`;
  $('res-items').innerHTML = (r.page ? `<div class="res-page">${icon('pagina', '#e8d9a8')}<span>Página do diário: <b>${esc(r.page.place)} ${r.page.n}/3</b></span><small>Leia no Livro 📖</small></div>` : '') + (r.items.length
    ? r.items.map(it => { const R = RARITY[it.rarity]; return `<div class="res-item" style="--c:${hex(R.color)}">${itemIcon(it, hex(R.color))}<span>${esc(displayName(it))}</span><small>${R.label} · Nv${it.level}</small></div>`; }).join('')
    : '<p class="hint">Nenhum item desta vez.</p>');
  const mats = Object.entries(r.mats ?? {});
  if (mats.length) $('res-items').innerHTML += `<div class="costs res-mats">${mats.map(([id, n]) => `<span class="cost ok">${matIcon(id)}+${n} ${esc(MATERIALS[id].label)}</span>`).join('')}</div>`;
}
export const hideResults = () => { $('results').hidden = true; };

// ---------- tela do baú ----------
export function vaultShow() { const el = $('vault'); el.hidden = false; document.body.classList.add('vaulting'); el.classList.remove('final'); $('vault-card').hidden = true; $('vault-sum').innerHTML = ''; }
export function vaultHide() { $('vault').hidden = true; document.body.classList.remove('vaulting'); }
export function vaultHint(text) { $('vault-hint').hidden = !text; if (text) $('vault-hint').textContent = text; }
export function vaultFlash(color) { const f = $('vault-flash'); f.style.background = `radial-gradient(circle at 50% 45%, ${color}, transparent 70%)`; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
export function vaultCard(it, i, n) {
  const el = $('vault-card');
  if (!it) { el.hidden = true; return; }
  const R = RARITY[it.rarity], c = hex(R.color);
  el.hidden = false; el.style.setProperty('--c', c); el.classList.toggle('mythic', it.rarity === 'mitico');
  el.innerHTML = `<small>${R.label}${it.slot === 'skill' ? ' · Habilidade' : ''}</small><strong>${esc(displayName(it))}</strong><div>${itemStat(it)} · Nível ${it.level}</div>${affixList(it, true)}${mythicNote(it)}${it.slot === 'skill' ? `<p>${esc(SKILLS[it.skill].desc)}</p>` : ''}<em>${i + 1} de ${n} · toque para continuar</em>`;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
export function vaultSummary(items) {
  $('vault').classList.add('final');
  $('vault-sum').innerHTML = `<h3>Você ganhou</h3><div class="vs-list">${items.map(it => { const R = RARITY[it.rarity]; return `<div class="res-item" style="--c:${hex(R.color)}">${itemIcon(it, hex(R.color))}<span>${esc(displayName(it))}</span><small>${R.label} · Nv${it.level}</small></div>`; }).join('')}</div><button class="btn primary" id="vault-take">Pegar tudo</button>`;
}

let comboTimer = 0;
export function combo(n) {
  const el = $('combo'); el.textContent = `x${n} COMBO`; el.hidden = false;
  el.classList.toggle('hot', n >= 10);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(comboTimer); comboTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

// Placa de nome: texto via textContent (nunca HTML), posição atualizada a cada quadro.
let npKey = '';
export function nameplate(name, vip, x, y, visible) {
  const el = $('nameplate');
  const title = H?.getSave?.().story?.title ?? '', key = `${name}|${vip}|${title}`;
  if (key !== npKey) { npKey = key; el.querySelector('.np-name').textContent = name; el.querySelector('.np-title').textContent = title; el.classList.toggle('vip', vip); }
  el.style.visibility = visible ? 'visible' : 'hidden';
  if (visible) { el.style.left = `${x}px`; el.style.top = `${y}px`; }
}
