// Sons de verdade (Kenney, CC0) + música em loop. O que não tem arquivo (ou não decodifica, ex. OGG em Safari antigo)
// usa sons sintetizados mais "orgânicos" daqui, e por último o sintetizador antigo (audio.js).
// Nomes sem extensão são .ogg (Kenney); há amostras .m4a e a prévia aprovada .wav.
const SFX = {
  lancer:['drawKnife1', 'drawKnife2', 'drawKnife3'], berserker:['chop'], hit:['knifeSlice', 'knifeSlice2'], dash:['cloth1', 'cloth2', 'cloth3'],
  coin:['handleCoins'], loot:['handleCoins2'], equip:['beltHandle1', 'metalClick'], latch:['metalLatch'], chestOpen:['doorOpen_1', 'creak1'],
  forge:['metalPot1', 'metalPot2', 'metalPot3'], page:['bookFlip1'], book:['bookOpen'], step:['footstep00', 'footstep01'],
  // mobs (rubberduck / OpenGameArt, CC0)
  slimeDie:['slime1.m4a', 'slime2.m4a', 'slime3.m4a'], bossSlime:['slime1.m4a', 'slime3.m4a'], bombDie:['bombSplat1.m4a', 'bombSplat2.m4a'],
  bonesDie:['bones1.m4a', 'bones2.m4a', 'bones3.m4a'], bowSnap:['bowSnap.m4a'], rockDie:['rock1.m4a', 'rock2.m4a'],
  golemGroan:['golemGroan.m4a'], golemGrunt:['golemGrunt.m4a'], golemSlam:['golemSlam.m4a'], ghostFade:['ghostFade.m4a'], bossRoar:['bossRoar.m4a'], armorFall:['armorFall.m4a'],
  hitBone:['hitBone1.m4a', 'hitBone2.m4a'], hitSlime:['hitSlime1.m4a', 'hitSlime2.m4a'], hitRock:['hitRock1.m4a', 'hitRock2.m4a'],
  // coleta e alquimia (rubberduck, CC0)
  mineHit:['mine2.m4a'], mineChip:['mine1.m4a'], mineBreak:['mineBreak.m4a'], reapDone:['reapDone.m4a'], bubble:['bubble1.m4a', 'bubble2.m4a', 'bubble3.m4a'], glass:['glass1.m4a', 'glass2.m4a'],
  mobSwing:['swoosh.m4a'], meteor:['explosion.m4a'], thunder:['thunder1.m4a'], holyImpact:['holyImpact.m4a'], sk_meteoroLow:['sk_meteoro.m4a'], sk_giroLow:['sk_giro.m4a'],
};
// V2 aprovada: ataques e reações; mortes continuam nas amostras próprias.
SFX.lancer = [1, 2, 3, 4].map(n => `v4-espada-rasgante-${n}.wav`);
SFX.bow = ['v2-arco-cacador.wav'];
SFX.bowDark = ['v2-arco-sombrio.wav'];
SFX.thunder = SFX.zap = SFX.sparks = ['v2-raio.wav'];
SFX.golemSlam = ['v2-golem.wav'];
// Uma amostra por habilidade (sk_<id>.m4a).
for (const n of ['giro', 'investida', 'egide', 'julgamento', 'grito', 'redemoinho', 'terremoto', 'furia', 'tita', 'fenix', 'meteoro', 'nova', 'orbe']) SFX[`sk_${n}`] = [`sk_${n}.m4a`];
SFX.sk_fenix = ['v2-fogo.wav'];
// Evento -> camadas tocadas juntas (amostras ou sintetizados). Cada mob morre do seu jeito; cada habilidade tem seu som.
const COMBO = {
  'die:slime':['slimeDie'], 'die:bomba':['bombDie', 'slimeDie'], 'die:esqueleto':['bonesDie'], 'die:arqueiroEsq':['bonesDie', 'bowSnap'],
  'die:espirito':['ghostFade', 'ghostWail'], 'die:golem':['rockDie', 'golemGroan'],
  'die:reiSlime':['bossSlime', 'bossRoar'], 'die:cavaleiro':['bonesDie', 'armorFall', 'bossRoar'], 'die:colosso':['rockDie', 'meteor', 'bossRoar'],
  'die:arauto':['ghostFade', 'ghostWail', 'bossRoar'], 'die:ceifador':['bonesDie', 'ghostWail', 'bossRoar'],
  'skill:giro':['sk_giro', 'lancer'], 'skill:investida':['sk_investida', 'dash'], 'skill:onda':['lancer', 'bladeWave'], 'skill:laminas':['sk_giroLow', 'lancer'],
  'skill:egide':['sk_egide'], 'skill:julgamento':['sk_julgamento'],
  'skill:salto':['bigWhoosh', 'dash'], 'skill:grito':['sk_grito'], 'skill:redemoinho':['sk_redemoinho'], 'skill:terremoto':['sk_terremoto', 'rumble'],
  'skill:furia':['sk_furia', 'heartbeat'], 'skill:tita':['sk_tita', 'bigWhoosh'],
  'skill:chuva':['bowVolley'], 'skill:perfurante':['bowLow'], 'skill:leque':['bowFan'], 'skill:teleguiadas':['bowHigh'],
  'skill:tempestadeAco':['bowVolley'], 'skill:fenix':['bow', 'sk_fenix'],
  'skill:meteoro':['sk_meteoro'], 'skill:nova':['sk_nova'], 'skill:raios':['sparks'], 'skill:orbe':['sk_orbe'], 'skill:tempestade':['sparks', 'rumble'],
  'skill:apocalipse':['sk_meteoro', 'sk_meteoroLow'],
  mine:['mineHit', 'mineChip'], reap:['dash'], brewDone:['glass', 'bubble'], drink:['bubble', 'glass', 'heal'],
};
// Golpe no mob: corte da arma + material do mob (osso, gosma, pedra).
for (const [mat, types] of Object.entries({ hitBone:['esqueleto', 'arqueiroEsq', 'espirito', 'cavaleiro', 'arauto', 'ceifador'], hitSlime:['slime', 'bomba', 'reiSlime'], hitRock:['golem', 'colosso'] }))
  for (const t of types) COMBO[`hit:${t}`] = ['hit', mat];
// A V2 de golem é ataque, não dor. As reações V2 substituem o golpe composto.
SFX.slimeHurt = ['v2-slime.wav']; SFX.skeletonHurt = ['v2-esqueleto.wav'];
COMBO['hit:slime'] = ['slimeHurt']; COMBO['hit:esqueleto'] = ['skeletonHurt'];
COMBO['hit:boneco'] = ['hit']; // boneco de treino: só o corte da arma
const VOL = { slimeHurt:0.3, skeletonHurt:0.3, bowDark:0.7, hit:0.45, lancer:0.55, berserker:0.8, dash:0.45, coin:0.7, loot:0.8, equip:0.6, latch:0.8, chestOpen:0.9, forge:0.5, page:0.6, book:0.6, step:0.18,
  slimeDie:0.5, bossSlime:0.8, bombDie:0.45, bonesDie:0.55, bowSnap:0.35, rockDie:0.6, golemGroan:0.3, golemGrunt:0.35, golemSlam:0.6, ghostFade:0.5, bossRoar:0.6, armorFall:0.45,
  hitBone:0.3, hitSlime:0.3, hitRock:0.3, mobSwing:0.35, meteor:0.55, thunder:0.4, holyImpact:0.5,
  sk_giro:0.5, sk_investida:0.4, sk_giroLow:0.4, sk_egide:0.45, sk_julgamento:0.5, sk_grito:0.5, sk_redemoinho:0.45, sk_terremoto:0.6, sk_furia:0.45,
  sk_tita:0.5, sk_fenix:0.35, sk_meteoro:0.5, sk_meteoroLow:0.45, sk_nova:0.5, sk_orbe:0.5,
  mineHit:0.45, mineChip:0.6, mineBreak:0.55, reapDone:0.6, bubble:0.5, glass:0.45, };
// Velocidade (tom) base por tipo; em cima disso entra uma variação aleatória para repetições não soarem idênticas.
const RATE = { bossSlime:0.6, bossRoar:0.75, ghostFade:0.7, golemGroan:0.7, golemGrunt:0.8, sk_giro:1.3, sk_grito:0.85, sk_meteoroLow:0.7 };
const VARY = { mineHit:0.2, bubble:0.3, glass:0.15, hitBone:0.25, hitSlime:0.25, hitRock:0.2, bonesDie:0.2, slimeDie:0.2, hit:0.2 };
const MUSIC_VOL = { hub:0.45, dungeon:0.65, boss:0.75 };
// Faixas por cena: com mais de uma, toca em sequência embaralhada sem repetir a anterior.
const PLAYLIST = { hub:['hub.mp3', 'hub2.m4a', 'hub3.m4a', 'hub4.m4a', 'hub5.m4a', 'hub6.m4a'], dungeon:['dungeon.mp3'], boss:['boss.mp3'],
  dungeon_esmeralda:['dungeon_esmeralda.m4a'], dungeon_crepusculo:['dungeon_crepusculo.m4a'], dungeon_cemiterio:['dungeon_cemiterio.m4a'], dungeon_cinzas:['dungeon_cinzas.m4a'], dungeon_vazio:['dungeon_vazio.m4a'], boss_crepusculo:['boss_crepusculo.m4a'], boss_esmeralda:['boss_esmeralda.m4a'], boss_vazio:['boss_vazio.m4a'] };
// 'dungeon_<tema>' sem música própria cai na genérica 'dungeon' (idem boss).
const base = name => PLAYLIST[name] ? name : name.split('_')[0];
const GAP = { slimeHurt:0.09, skeletonHurt:0.09, bowDark:0.06, hit:0.07, zap:0.1, thunder:0.35, bossAttack:0.1, skill:0.15, mobSwing:0.12, mobCast:0.15, bow:0.06, hop:0.12, step:0.2,
  bonesDie:0.08, slimeDie:0.08, rockDie:0.1, bombDie:0.08, ghostFade:0.12, ghostWail:0.2, golemGroan:0.3, golemGrunt:0.3, golemSlam:0.12, bowSnap:0.1,
  hitBone:0.09, hitSlime:0.09, hitRock:0.09, meteor:0.08 };
// Com muitos sons tocando, golpes/mortes ficam mais baixos e, acima do teto, são pulados.
const MAX_VOICES = 14;

export class Sound {
  constructor(synth, settings) {
    this.synth = synth; this.settings = settings; this.raw = {}; this.buf = {}; this.last = {}; this.music = null; this.track = null;
    this.voices = 0;
    for (const n of new Set(Object.values(SFX).flat())) fetch(`assets/audio/sfx/${n.includes('.') ? n : `${n}.ogg`}`).then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (b) this.raw[n] = b; }).catch(() => {});
  }
  get ctx() { const c = this.synth.context; return this.synth.enabled && c && c.state === 'running' ? c : null; }
  decode() {
    const c = this.synth.context; if (!c) return;
    for (const [n, ab] of Object.entries(this.raw)) { delete this.raw[n]; c.decodeAudioData(ab).then(b => { this.buf[n] = b; }).catch(() => {}); }
  }
  // Chamar num gesto do usuário (toque/tecla): libera áudio no celular.
  unlock() { this.synth.unlock(); this.decode(); if (this.music?.paused && this.track) this.music.play().catch(() => {}); }

  play(kind, vol = 1) {
    const c = this.ctx; if (!c || vol <= 0.02) return;
    if (kind === 'archer') kind = 'bow';
    // Intervalo mínimo por tipo: evita metralhadora de som quando várias habilidades acertam juntas.
    const now = c.currentTime; if (now - (this.last[kind] ?? -9) < (GAP[kind] ?? 0.04)) return; this.last[kind] = now;
    if (COMBO[kind]) {
      if (this.voices >= MAX_VOICES && /^(hit|die):/.test(kind)) return;
      for (const k of COMBO[kind]) this.play(k, vol);
      return;
    }
    this.vol = vol * (this.voices > 4 ? 4 / this.voices : 1);
    if (Object.keys(this.raw).length) this.decode();
    const list = SFX[kind]?.map(n => this.buf[n]).filter(Boolean);
    if (list?.length) {
      const v = VARY[kind] ?? 0.12;
      let index = Math.floor(Math.random() * list.length);
      // Cortes consecutivos usam gravações diferentes, inclusive após falha parcial de decode.
      if (kind === 'lancer' && list.length > 1 && list[index] === this.lastSword)
        index = (index + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
      if (kind === 'lancer') this.lastSword = list[index];
      this.sampleAt(c, list[index], kind, now,
        (RATE[kind] ?? 1) * (1 - v / 2 + Math.random() * v));
      if (kind === 'berserker') this.whoosh(c, 500, 0.18);
      return;
    }
    if (kind === 'slimeHurt' || kind === 'skeletonHurt') { this.play(kind === 'slimeHurt' ? 'hitSlime' : 'hitBone', vol); return; }
    if (kind === 'sk_fenix') { this.whoosh(c, 650, 0.25, 0.3); return; }
    if (this.synthBetter(c, kind)) return;
    if (kind.includes(':') || kind.startsWith('sk_')) return; // sem arquivo e sem sintetizado: silêncio, não o bipe antigo
    this.synth.play(kind);
  }

  // ---- sintetizados melhores para o que não tem arquivo ----
  out(c, vol) { const g = c.createGain(); g.gain.value = vol * this.settings.sfx * (this.vol ?? 1); g.connect(this.synth.master); return g; }
  env(c, node, dest, vol, a, d, t0 = c.currentTime) { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); node.connect(g); g.connect(dest); return g; }
  noise(c, dur, t0 = c.currentTime) { const s = c.createBufferSource(); s.buffer = this.synth.noiseBuffer; s.start(t0, Math.random() * 0.5, dur + 0.1); return s; }
  whoosh(c, f, dur, vol = 0.35) {
    const n = this.noise(c, dur), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f * 2, c.currentTime); bp.frequency.exponentialRampToValueAtTime(f * 0.6, c.currentTime + dur);
    n.connect(bp); this.env(c, bp, this.out(c, 1), vol, 0.02, dur);
  }
  bell(c, freqs, vol = 0.12, spread = 0.07, decay = 1.1) {
    const dest = this.out(c, 1), delay = c.createDelay(), fb = c.createGain(); delay.delayTime.value = 0.18; fb.gain.value = 0.3;
    dest.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(this.synth.master);
    freqs.forEach((f, i) => {
      const t0 = c.currentTime + i * spread;
      for (const [type, mul, v] of [['sine', 1, 1], ['triangle', 2.001, 0.25]]) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = f * mul; o.start(t0); o.stop(t0 + decay + 0.1);
        this.env(c, o, dest, vol * v, 0.008, decay, t0);
      }
    });
  }
  sampleAt(c, buffer, kind, t, rate = 1) {
    if (this.voices >= MAX_VOICES) return;
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buffer; src.playbackRate.value = rate;
    g.gain.value = (VOL[kind] ?? 0.7) * this.settings.sfx * this.vol;
    src.connect(g); g.connect(this.synth.master);
    this.voices++; src.onended = () => { this.voices--; src.disconnect(); g.disconnect(); };
    src.start(t);
  }
  // Disparo percussivo; nenhuma corda/nota afinada, inclusive sem decode do WAV.
  bowAt(c, t, dark = false) {
    const kind = dark ? 'bowDark' : 'bow', buffer = this.buf[SFX[kind][0]];
    if (buffer) { this.sampleAt(c, buffer, kind, t); return; }
    if (this.voices >= MAX_VOICES) return;
    const dest = this.out(c, 1), snap = this.noise(c, 0.035, t), hp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = dark ? 1800 : 2700;
    snap.connect(hp); this.env(c, hp, dest, 0.25, 0.002, 0.03, t);
    const air = this.noise(c, 0.16, t + 0.012), bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.value = dark ? 1600 : 3500;
    air.connect(bp); this.env(c, bp, dest, 0.18, 0.004, 0.14, t + 0.012);
    this.voices++; air.onended = () => { this.voices--; };
  }
  synthBetter(c, kind) {
    const t = c.currentTime;
    if (kind === 'mythic') {
      // Drop mítico: acorde menor grave subindo até um sino agudo, com um sopro longo por baixo.
      this.bell(c, [220, 261.6, 329.6, 440, 523.3, 659.3, 880], 0.14, 0.09, 1.8); this.whoosh(c, 300, 0.9, 0.4);
      return true;
    }
    if (kind === 'bow' || kind === 'bowDark') { this.bowAt(c, t, kind === 'bowDark'); return true; }
    const BOWS = { bowLow:[0], bowHigh:[0], bowFan:[0, 0.03, 0.06], bowVolley:[0, 0.08, 0.16, 0.24] };
    if (BOWS[kind]) { for (const d of BOWS[kind]) this.bowAt(c, t + d, kind === 'bowHigh'); return true; }
    if (kind === 'bonesDie') {
      // Ossos chacoalhando: estalinhos secos espalhados + baque.
      const dest = this.out(c, 1);
      for (let k = 0; k < 7; k++) { const n = this.noise(c, 0.04), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.value = 1800 + Math.random() * 2600; n.connect(bp); this.env(c, bp, dest, 0.25, 0.002, 0.035, t + Math.random() * 0.35); }
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.15); o.start(t); o.stop(t + 0.2); this.env(c, o, dest, 0.2, 0.005, 0.15);
      return true;
    }
    if (kind === 'slimeDie' || kind === 'hop') {
      const dest = this.out(c, 1), die = kind === 'slimeDie';
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(die ? 280 : 170, t); o.frequency.exponentialRampToValueAtTime(die ? 70 : 330, t + (die ? 0.25 : 0.12)); o.start(t); o.stop(t + 0.3); this.env(c, o, dest, die ? 0.22 : 0.1, 0.01, die ? 0.25 : 0.14);
      if (die) { const n = this.noise(c, 0.3), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; n.connect(lp); this.env(c, lp, dest, 0.3, 0.01, 0.25); }
      return true;
    }
    if (kind === 'rockDie') {
      const dest = this.out(c, 1), n = this.noise(c, 0.7), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 450; n.connect(lp); this.env(c, lp, dest, 0.45, 0.02, 0.6);
      for (let k = 0; k < 3; k++) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90 - k * 15, t + k * 0.12); o.frequency.exponentialRampToValueAtTime(40, t + k * 0.12 + 0.2); o.start(t + k * 0.12); o.stop(t + k * 0.12 + 0.25); this.env(c, o, dest, 0.25, 0.005, 0.2, t + k * 0.12); }
      return true;
    }
    if (kind === 'thunder') {
      // Estalo seco + trovão grave que rola (volume contido para não cansar).
      const dest = this.out(c, 1);
      const crack = this.noise(c, 0.2), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800; crack.connect(hp); this.env(c, hp, dest, 0.35, 0.002, 0.16);
      const rum = this.noise(c, 1.3), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(80, t + 1.1); rum.connect(lp); this.env(c, lp, dest, 0.4, 0.06, 1.1, t + 0.03);
      return true;
    }
    if (kind === 'zap') {
      const dest = this.out(c, 1), n = this.noise(c, 0.08), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.value = 3800; n.connect(bp); this.env(c, bp, dest, 0.22, 0.002, 0.07);
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.07); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; o.connect(lp); o.start(t); o.stop(t + 0.09); this.env(c, lp, dest, 0.05, 0.002, 0.07);
      return true;
    }
    if (kind === 'ghostWail') {
      // Espírito se desfazendo: dois tons com vibrato descendo e sumindo, bem baixo.
      const dest = this.out(c, 1), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(dest);
      for (const [f, d] of [[520, 0], [780, 0.06]]) {
        const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(); o.type = 'sine'; lfo.frequency.value = 6 + Math.random() * 2; lg.gain.value = f * 0.03;
        lfo.connect(lg); lg.connect(o.frequency); o.frequency.setValueAtTime(f, t + d); o.frequency.exponentialRampToValueAtTime(f * 0.45, t + d + 0.9);
        o.start(t + d); lfo.start(t + d); o.stop(t + d + 1); lfo.stop(t + d + 1); this.env(c, o, lp, 0.06, 0.08, 0.85, t + d);
      }
      return true;
    }
    if (kind === 'bladeWave') { this.whoosh(c, 2600, 0.35, 0.3); this.bell(c, [1318], 0.03, 0, 0.4); return true; }
    if (kind === 'bigWhoosh') { this.whoosh(c, 380, 0.5, 0.45); return true; }
    if (kind === 'rumble') {
      const dest = this.out(c, 1), n = this.noise(c, 1), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(180, t); lp.frequency.exponentialRampToValueAtTime(60, t + 0.9);
      n.connect(lp); this.env(c, lp, dest, 0.5, 0.05, 0.9); return true;
    }
    if (kind === 'heartbeat') {
      const dest = this.out(c, 1);
      for (const d of [0, 0.22, 0.6, 0.82]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t + d); o.frequency.exponentialRampToValueAtTime(40, t + d + 0.12); o.start(t + d); o.stop(t + d + 0.16); this.env(c, o, dest, d % 0.6 ? 0.18 : 0.28, 0.005, 0.13, t + d); }
      return true;
    }
    if (kind === 'sparks') {
      // Carga elétrica: estalinhos agudos rápidos subindo de tom.
      const dest = this.out(c, 1);
      for (let k = 0; k < 9; k++) { const t0 = t + k * 0.028 + Math.random() * 0.015, n = this.noise(c, 0.03), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4; bp.frequency.value = 2500 + k * 350 + Math.random() * 800; n.connect(bp); this.env(c, bp, dest, 0.2, 0.001, 0.025, t0); }
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(480, t + 0.25); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; o.connect(lp); o.start(t); o.stop(t + 0.3); this.env(c, lp, dest, 0.05, 0.02, 0.25);
      return true;
    }
    if (kind === 'mobSwing') { this.whoosh(c, 550, 0.22, 0.35); return true; }
    if (kind === 'mobCast') { this.whoosh(c, 1700, 0.35, 0.22); const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(330, t + 0.3); o.start(t); o.stop(t + 0.35); this.env(c, o, this.out(c, 1), 0.07, 0.05, 0.3); return true; }
    if (kind === 'archer') { this.whoosh(c, 1400, 0.16, 0.4); const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.08); o.start(); o.stop(t + 0.1); this.env(c, o, this.out(c, 1), 0.15, 0.005, 0.08); return true; }
    if (kind === 'mage') { this.whoosh(c, 2400, 0.3, 0.25); this.bell(c, [880, 1320], 0.05, 0.03, 0.35); return true; }
    if (kind === 'skill') { this.whoosh(c, 1200, 0.4, 0.25); return true; }
    if (kind === 'level') { this.bell(c, [523, 659, 784, 1046], 0.1, 0.09, 1.3); return true; }
    if (kind === 'victory') { this.bell(c, [392, 523, 659, 784, 1046], 0.1, 0.11, 1.6); return true; }
    if (kind === 'heal') { this.bell(c, [659, 880], 0.07, 0.08, 0.8); return true; }
    if (kind === 'boss') {
      // Trompa grave: dente-de-serra filtrada subindo.
      const dest = this.out(c, 1), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(dest);
      for (const [f, d] of [[73.4, 0], [110, 0.35]]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.start(t + d); o.stop(t + d + 1.3); this.env(c, o, lp, 0.18, 0.12, 1.1, t + d); }
      return true;
    }
    if (kind === 'warning') { const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.2); o.start(); o.stop(t + 0.25); this.env(c, o, this.out(c, 1), 0.12, 0.01, 0.2); return true; }
    return false;
  }

  // ---- música: troca com fade, um arquivo por vez (streaming) ----
  // Zumbido grave do portal do hub: 2 osciladores ligados sempre, volume = proximidade (0..1).
  hum(level) {
    const c = this.ctx; if (!c || (!this.humNode && level <= 0)) return;
    if (!this.humNode) {
      const g = c.createGain(); g.gain.value = 0; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.connect(g); g.connect(this.synth.master);
      for (const [f, type] of [[55, 'sine'], [82.7, 'triangle'], [110.4, 'sine']]) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.connect(lp); o.start(); }
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.35; lg.gain.value = 90; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      this.humNode = g;
    }
    this.humNode.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.09 * this.settings.sfx, c.currentTime, 0.25);
  }
  setMusic(name) {
    if (this.track === name) return;
    this.track = name;
    const old = this.music; if (old) this.fade(old, 0, 700, () => { old.pause(); old.src = ''; });
    this.music = null;
    if (!name) return;
    this.playTrack(name, 1200);
  }
  playTrack(name, fadeMs) {
    const list = PLAYLIST[base(name)], pick = list.filter(f => f !== this.lastFile);
    const file = pick[Math.floor(Math.random() * pick.length)] ?? list[0]; this.lastFile = file;
    const a = new Audio(`assets/audio/music/${file}`); a.loop = list.length === 1; a.volume = 0; a.preload = 'auto';
    a.onended = () => { if (this.music === a) this.playTrack(name, 400); };
    this.music = a; a.dataset.track = name;
    a.play().catch(() => {}); // sem gesto ainda: toca no próximo unlock()
    this.fade(a, this.musicVolume(name), fadeMs);
  }
  musicVolume(name = this.track) { return this.synth.enabled ? (MUSIC_VOL[String(name).split('_')[0]] ?? 0.4) * this.settings.music : 0; }
  refresh() { if (this.music) this.music.volume = this.musicVolume(); }
  fade(a, to, ms, done) {
    const from = a.volume, t0 = performance.now();
    const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k < 1) requestAnimationFrame(step); else done?.(); };
    step();
  }
}
