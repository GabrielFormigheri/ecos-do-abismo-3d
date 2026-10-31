// Regras puras do jogo (sem Three.js nem DOM), testáveis no Node.

export const TIME_LIMIT = 420; // 4 arenas (uma com mini-chefe), emboscadas e chefe: ~5-6 min jogando bem
export const INVENTORY_CAP = 60;
export const MAX_LEVEL = 30;

export const RARITIES = [
  { id:'comum',    label:'Comum',    color:0xb8bcc8, mult:1,    salvage:1 },
  { id:'raro',     label:'Raro',     color:0x3d9bff, mult:1.35, salvage:3 },
  { id:'epico',    label:'Épico',    color:0xb45cff, mult:1.8,  salvage:10 },
  { id:'lendario', label:'Lendário', color:0xffb52e, mult:2.5,  salvage:30 },
  { id:'mitico',   label:'Mítico',   color:0xe8173f, mult:3.4,  salvage:80 },
];
export const RARITY = Object.fromEntries(RARITIES.map((r, rank) => [r.id, { ...r, rank }]));

export const DROP_TABLES = {
  mob:   { comum:69.8, raro:24, epico:4.5, lendario:1.5, mitico:0.2 },
  boss:  { comum:34.4, raro:42, epico:20,  lendario:3,   mitico:0.6 },
  chest: { comum:29.4, raro:44, epico:23,  lendario:3,   mitico:0.6 },
};

// Afixos: sorteados em arma/armadura/amuleto; v é em % dentro de [min, max]. Prefixos são adjetivos sem gênero.
export const AFFIXES = {
  crit:      { label:'Chance de crítico',       min:2,  max:6,  pre:'Letal',     suf:'da Precisão' },
  critDmg:   { label:'Dano crítico',            min:10, max:30, pre:'Brutal',    suf:'do Carrasco' },
  lifesteal: { label:'Roubo de vida',           min:1,  max:4,  pre:'Voraz',     suf:'do Vampiro' },
  atkSpeed:  { label:'Velocidade de ataque',    min:4,  max:12, pre:'Feroz',     suf:'da Fúria' },
  moveSpeed: { label:'Velocidade de movimento', min:3,  max:10, pre:'Veloz',     suf:'do Vento' },
  cdr:       { label:'Redução de recarga',      min:4,  max:12, pre:'Arcano',    suf:'do Sábio' },
  hp:        { label:'Vida',                    min:4,  max:12, pre:'Robusto',   suf:'do Colosso' },
  atk:       { label:'Ataque',                  min:4,  max:12, pre:'Cruel',     suf:'do Guerreiro' },
  drop:      { label:'Chance de drop',          min:5,  max:20, pre:'Sortudo',   suf:'do Saqueador' },
  boss:      { label:'Dano contra chefes',      min:5,  max:20, pre:'Implacável', suf:'do Regicida' },
};
export const AFFIX_COUNT = { comum:0, raro:1, epico:2, lendario:3, mitico:4 };
// Qualidade do rolo: 0 = mínimo da faixa, 1 = rolo perfeito.
export const affixQuality = a => (a.v - AFFIXES[a.id].min) / (AFFIXES[a.id].max - AFFIXES[a.id].min);
export const rollQuality = it => it.affixes?.length ? it.affixes.reduce((s, a) => s + affixQuality(a), 0) / it.affixes.length : null;
// Nome exibido: prefixo do 2º afixo + nome base + sufixo do 1º ("Letal Aurora Solar do Vampiro"). O nome base fica em it.name.
export const displayName = it => { const [a, b] = it.affixes ?? []; return [b && AFFIXES[b.id].pre, it.name, a && AFFIXES[a.id].suf].filter(Boolean).join(' '); };
function rollAffixes(rarity, rand) {
  const pool = Object.keys(AFFIXES), out = [];
  for (let i = 0; i < AFFIX_COUNT[rarity]; i++) {
    const id = pool.splice(Math.floor(rand() * pool.length), 1)[0], A = AFFIXES[id];
    out.push({ id, v:Math.round((A.min + rand() * (A.max - A.min)) * 10) / 10 });
  }
  return out;
}
// Soma dos afixos equipados, em fração (0.05 = 5%).
export function affixTotals(items) {
  const t = Object.fromEntries(Object.keys(AFFIXES).map(id => [id, 0]));
  for (const it of items) for (const a of it?.affixes ?? []) t[a.id] += a.v / 100;
  return t;
}

// Arma mítica: efeito único por tipo, a cada MYTHIC_EVERY ataques básicos (ver main.js).
export const MYTHIC_EVERY = 5;
export const MYTHIC_FX = {
  espada:  { label:'Lâmina Espectral', desc:'A cada 5 golpes, lança uma lâmina espectral que atravessa os inimigos.' },
  machado: { label:'Onda de Choque',   desc:'A cada 5 golpes, solta uma onda de choque que atordoa ao redor.' },
  arco:    { label:'Chuva Carmesim',   desc:'A cada 5 disparos, uma chuva de flechas cai sobre o alvo.' },
  cajado:  { label:'Raio em Cadeia',   desc:'A cada 5 feitiços, um raio salta entre vários inimigos.' },
};

// Corpo a corpo: combo de 3 golpes (o 3º é pesado: atordoa, empurra e executa elite atordoado), avanço curto até o alvo.
//   guard: dano recebido a menos logo depois de cada golpe (guerreiro). rage: acúmulos por golpe que acerta (berserker),
//   cada um dá +atk de ataque e +steal de roubo de vida; somem t segundos depois do último acerto.
// À distância: draw = tempo puxando a corda/conjurando (anda mais devagar); falloff = dano cai com a distância percorrida.
// hpMul: multiplica a vida total (o equipamento é igual para todas as classes, então a diferença tem que ser proporcional).
export const CLASSES = {
  guerreiro: { id:'guerreiro', label:'Guerreiro', weapon:'espada',  baseHp:120, baseAtk:10, range:2.9, starter:'giro',    hpMul:1.3, guard:0.3, lunge:1.6,
               combo:[{ mult:1.05, range:2.9, arc:2.3, t:0.34 }, { mult:1.05, range:2.9, arc:2.3, t:0.34 }, { mult:2.1, range:3.4, arc:3.0, t:0.52, heavy:true }],
               attack:'Combo de 3 cortes (o último é pesado); defende 30% do dano enquanto ataca' },
  berserker: { id:'berserker', label:'Berserker', weapon:'machado', baseHp:140, baseAtk:13, range:3.3, starter:'salto',   hpMul:1.4, lunge:2,
               rage:{ max:10, atk:0.015, steal:0.01, t:3 },
               combo:[{ mult:1.35, range:3.3, arc:2.9, t:0.5 }, { mult:1.35, range:3.3, arc:2.9, t:0.5 }, { mult:2.8, range:3.8, arc:3.6, t:0.78, heavy:true }],
               attack:'Golpes largos que acumulam Fúria: mais dano e roubo de vida' },
  arqueiro:  { id:'arqueiro',  label:'Arqueiro',  weapon:'arco',    baseHp:95,  baseAtk:8,  attackCd:0.5,  range:16,  starter:'chuva',   hpMul:1, mult:1.15, draw:0.16,
               falloff:{ from:8, to:16, min:0.7 }, attack:'Flechas à distância; perdem força de muito longe' },
  mago:      { id:'mago',      label:'Mago',      weapon:'cajado',  baseHp:90,  baseAtk:11, attackCd:0.62, range:13,  starter:'meteoro', hpMul:1, mult:1.4, draw:0.22,
               attack:'Orbe que explode em área (precisa conjurar)' },
};
// Dano do ataque básico por segundo, em múltiplos do ataque, contra `targets` inimigos juntos (sem crítico, sem Fúria).
// O corpo a corpo acerta todos no arco; a flecha acerta um; o orbe explode em área. Usado nos testes de balanço.
export function basicDps(cls, targets = 1) {
  const C = CLASSES[cls];
  if (C.combo) return C.combo.reduce((s, h) => s + h.mult, 0) * targets / C.combo.reduce((s, h) => s + h.t, 0);
  return C.mult * (cls === 'mago' ? targets : 1) / C.attackCd;
}
// Força dos inimigos (multiplica MOBS/BOSSES): as dungeons estavam curtas e fáceis demais.
export const DIFFICULTY = { hp:1.5, dmg:1.6, bossHp:1.6, bossDmg:1.4 };

// Habilidades: dropam nas dungeons, presas à classe. kind define o efeito (ver main.js); os outros campos ajustam.
export const SKILLS = {
  giro:          { cls:'guerreiro', rarity:'comum',    label:'Giro Cortante',        cd:6,  kind:'spin',    mult:1.6, hits:3, r:3.8, dur:0.6, desc:'Gira com a lâmina e acerta tudo ao redor três vezes.' },
  investida:     { cls:'guerreiro', rarity:'raro',     label:'Investida Heroica',    cd:6,  kind:'dash',    mult:3.2, len:10, w:3, desc:'Avança como um raio, cortando tudo no caminho.' },
  onda:          { cls:'guerreiro', rarity:'raro',     label:'Onda de Lâmina',       cd:5,  kind:'wave',    mult:2.4, speed:20, range:15, w:3.2, fx:'crescente', desc:'Lança uma onda cortante que atravessa os inimigos.' },
  laminas:       { cls:'guerreiro', rarity:'epico',    label:'Lâminas Orbitais',     cd:12, kind:'orbit',   mult:1.0, count:3, dur:6, r:3, desc:'Três espadas giram ao seu redor por 6 segundos.' },
  egide:         { cls:'guerreiro', rarity:'epico',    label:'Égide Sagrada',        cd:14, kind:'buff',    dur:6, shield:0.45, atk:0.25, color:0xffd36b, desc:'Escudo de luz: -45% de dano recebido e +25% de ataque.' },
  julgamento:    { cls:'guerreiro', rarity:'lendario', label:'Julgamento Celestial', cd:16, kind:'area',    mult:10, r:5.5, delay:0.9, range:14, fx:'espada', color:0xffd36b, desc:'Uma espada gigante desce do céu sobre o alvo.' },

  salto:         { cls:'berserker', rarity:'comum',    label:'Salto Esmagador',      cd:7,  kind:'leap',    mult:3.8, r:3.8, stun:1.2, range:9, desc:'Salta até o alvo e atordoa quem estiver na queda.' },
  grito:         { cls:'berserker', rarity:'raro',     label:'Grito de Guerra',      cd:12, kind:'buff',    dur:6, atk:0.35, nova:{ r:5.5, mult:0.6, stun:1.5 }, color:0xff5a3a, desc:'Atordoa quem está perto e dá +35% de ataque.' },
  redemoinho:    { cls:'berserker', rarity:'raro',     label:'Redemoinho',           cd:9,  kind:'spin',    mult:0.8, hits:8, r:3.8, dur:2.4, move:true, desc:'Gira sem parar enquanto anda, acertando oito vezes.' },
  terremoto:     { cls:'berserker', rarity:'epico',    label:'Terremoto',            cd:10, kind:'fissure', mult:3.2, count:3, len:13, w:2.4, color:0xc9a06a, desc:'Abre três fendas no chão à sua frente.' },
  furia:         { cls:'berserker', rarity:'epico',    label:'Fúria Sangrenta',      cd:15, kind:'buff',    dur:7, atk:0.3, speed:0.3, lifesteal:0.12, color:0xff2a3a, desc:'+30% de ataque e velocidade; cada golpe cura 12% do dano.' },
  tita:          { cls:'berserker', rarity:'lendario', label:'Machado do Titã',      cd:14, kind:'wave',    mult:7, speed:15, range:18, w:5, fx:'machado', color:0xffb52e, desc:'Arremessa um machado colossal que esmaga a linha inteira.' },

  chuva:         { cls:'arqueiro',  rarity:'comum',    label:'Chuva de Flechas',     cd:7,  kind:'rain',    mult:0.5, ticks:11, r:3.6, range:13, desc:'Uma saraivada cai sobre a área escolhida.' },
  perfurante:    { cls:'arqueiro',  rarity:'raro',     label:'Disparo Perfurante',   cd:5,  kind:'wave',    mult:2.6, speed:36, range:20, w:1.6, fx:'flecha', desc:'Uma flecha carregada atravessa todos em linha.' },
  leque:         { cls:'arqueiro',  rarity:'raro',     label:'Leque de Flechas',     cd:6,  kind:'fan',     mult:1.0, count:7, spread:1.1, desc:'Dispara sete flechas em leque.' },
  teleguiadas:   { cls:'arqueiro',  rarity:'epico',    label:'Flechas Teleguiadas',  cd:9,  kind:'homing',  mult:0.85, count:8, color:0x7fe9ff, desc:'Oito flechas mágicas perseguem os inimigos.' },
  tempestadeAco: { cls:'arqueiro',  rarity:'epico',    label:'Tempestade de Aço',    cd:12, kind:'rain',    mult:0.55, ticks:18, r:5.5, range:14, desc:'Uma chuva de flechas enorme e mais longa.' },
  fenix:         { cls:'arqueiro',  rarity:'lendario', label:'Flecha da Fênix',      cd:15, kind:'wave',    mult:6, speed:24, range:24, w:3.6, fx:'fenix', color:0xff7a1a, desc:'Uma fênix de fogo atravessa o campo de batalha.' },

  meteoro:       { cls:'mago',      rarity:'comum',    label:'Meteoro',              cd:8,  kind:'area',    mult:5.5, r:4, delay:0.7, range:13, fx:'meteoro', color:0xff8a2a, desc:'Invoca um meteoro com impacto devastador.' },
  nova:          { cls:'mago',      rarity:'raro',     label:'Nova Glacial',         cd:8,  kind:'nova',    mult:1.8, r:5.5, stun:1.4, color:0x9ae8ff, desc:'Explosão de gelo ao seu redor que congela os inimigos.' },
  raios:         { cls:'mago',      rarity:'raro',     label:'Corrente de Raios',    cd:6,  kind:'chain',   mult:2.2, jumps:6, range:8, color:0xa8c8ff, desc:'Um raio salta entre até seis inimigos.' },
  orbe:          { cls:'mago',      rarity:'epico',    label:'Orbe Arcano',          cd:9,  kind:'wave',    mult:4.0, speed:9, range:18, w:3.4, fx:'orbe', color:0xc77dff, desc:'Uma esfera lenta e enorme que devasta o que toca.' },
  tempestade:    { cls:'mago',      rarity:'epico',    label:'Tempestade Elétrica',  cd:13, kind:'storm',   mult:0.9, strikes:14, dur:4, r:2.2, color:0xbfd4ff, desc:'Raios caem sobre os inimigos próximos por 4 segundos.' },
  apocalipse:    { cls:'mago',      rarity:'lendario', label:'Chuva de Meteoros',    cd:18, kind:'area',    mult:3.2, r:3.4, delay:0.8, range:14, count:7, spread:6, fx:'meteoro', color:0xff6a1a, desc:'Sete meteoros devastam a área escolhida.' },
};
export const SKILL_SLOTS = 3;
export const skillsOf = cls => Object.entries(SKILLS).filter(([, s]) => s.cls === cls).map(([id]) => id);
// Habilidade de nível maior bate mais forte: +12% por nível de dungeon.
export const skillPower = item => 1 + 0.12 * (item.level - 1);

export const DUNGEONS = [
  // layout: planta da dungeon (ver layout.js). Beco lateral limpo dá gemas e material; o beco secreto guarda um baú.
  // twist: o que só esta dungeon tem (mostrado ao entrar). split: slime se divide. revive: esqueletos levantam uma vez.
  { level:1, name:'Cripta Esmeralda',     theme:'esmeralda', layout:'bosque', mobs:['slime', 'esqueleto'], split:true, boss:'reiSlime',
    twist:'Slimes se dividem em dois menores ao morrer.' },
  { level:2, name:'Jardim do Crepúsculo', theme:'crepusculo', layout:'jardim', mobs:['slime', 'espirito', 'esqueleto', 'arqueiroEsq', 'flor'], boss:'cavaleiro',
    twist:'Flores carnívoras não andam, mas cospem sementes em 3 linhas.' },
  { level:3, name:'Forja de Cinzas',      theme:'cinzas',    layout:'forja', mobs:['esqueleto', 'golem', 'armadura', 'espirito', 'bomba'], boss:'colosso',
    twist:'Armaduras vivas cortam em leque à frente: ataque pelas costas.' },
  { level:4, name:'Cidadela do Vazio',    theme:'vazio',     layout:'vazio', mobs:['espirito', 'sombra', 'golem', 'arqueiroEsq', 'bomba', 'esqueleto'], boss:'arauto',
    twist:'Sombras do vazio somem e reaparecem ao seu lado.' },
  { level:5, name:'Cemitério Sombrio',    theme:'cemiterio', layout:'cemiterio', mobs:['esqueleto', 'arqueiroEsq', 'espirito', 'bomba'], revive:true, boss:'ceifador',
    twist:'Esqueletos se levantam uma vez depois de cair: acabe com eles de novo.' },
  { level:6, name:'Grutas Ecoantes',      theme:'caverna',   layout:'caverna', mobs:['esqueleto', 'morcego', 'golem', 'arqueiroEsq', 'slime'], boss:'cristalino',
    twist:'Morcegos mergulham duas vezes em linha reta.' },
  { level:7, name:'Rio de Magma',         theme:'magma',     layout:'lava', mobs:['bomba', 'magmaSlime', 'golem', 'esqueleto', 'espirito'], boss:'senhorBrasas',
    twist:'Slimes de magma deixam poças de lava onde caem.' },
  { level:8, name:'Ruínas Congeladas',    theme:'gelo',      layout:'ruina', mobs:['esqueleto', 'arqueiroEsq', 'espectroGelo', 'golem', 'bomba'], boss:'rainhaGelo',
    twist:'Orbes dos espectros gélidos deixam você lento.' },
];

// Elites: mob maior e mais forte com um afixo (o mini-chefe tem dois). color = aura no chão.
export const ELITE_AFFIXES = {
  veloz:     { label:'Veloz',       color:0x5fe8ff, speed:1.45 },
  blindado:  { label:'Blindado',    color:0xa8c0ff, hp:1.7 },
  furioso:   { label:'Furioso',     color:0xff4a3a, dmg:1.4 },
  explosivo: { label:'Explosivo',   color:0xff9a2a, blast:true },
  regenera:  { label:'Regenerador', color:0x6aff8a, regen:0.03 },
};
export const ELITE = { hp:3, dmg:1.25, scale:1.3, xp:4 };
export const MINI = { hp:8, dmg:1.4, scale:1.75, xp:12 };
export const eliteAffixes = (n, rand = Math.random) => Object.keys(ELITE_AFFIXES).map(k => [rand(), k]).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, k]) => k);

// attack: tipo de ataque (ver ATTACK_KINDS). tip: dica mostrada no bestiário.
export const MOBS = {
  slime:     { label:'Slime',     hp:40,  dmg:9,  speed:2.8, radius:1.1, scale:1.5,  xp:4, attack:'salto',
               tip:'Pula onde você está: o círculo no chão marca a queda. Saia dele e bata enquanto ele se recupera.' },
  esqueleto: { label:'Esqueleto', hp:55,  dmg:12, speed:3.4, radius:0.8, scale:1.3,  xp:5, attack:'investida',
               tip:'Mira uma faixa reta e avança por ela. Desvie para o lado, não para trás.' },
  espirito:  { label:'Espírito',  hp:36,  dmg:8,  speed:2.8, radius:0.8, scale:1.35, xp:5, attack:'magia',
               tip:'Foge se você chega perto e solta 3 orbes em leque. Pouca vida: encurrale e mate rápido.' },
  golem:     { label:'Golem',     hp:140, dmg:17, speed:2.1, radius:1.5, scale:1.5,  xp:9, attack:'pancada',
               tip:'Lento, mas a pancada pega tudo em volta. Saia do círculo e volte depois do golpe.' },
  arqueiroEsq:{ label:'Esqueleto Arqueiro', hp:38, dmg:13, speed:3.0, radius:0.8, scale:1.3, xp:6, attack:'flecha',
               tip:'Mantém distância e mostra a linha da flecha antes de atirar. Pouca vida: priorize ele.' },
  bomba:     { label:'Slime Explosivo', hp:28, dmg:22, speed:4.4, radius:0.9, scale:1.1, xp:5, attack:'explode',
               tip:'Corre até você e explode, morrendo junto (sem item). Mate de longe ou fuja do círculo.' },
  // sound: tipo cujo som de golpe/morte é usado (os novos reaproveitam os existentes).
  flor:      { label:'Flor Carnívora', hp:50, dmg:11, speed:0, radius:1.0, scale:1.4, xp:5, attack:'magia', sound:'slime',
               tip:'Não anda. Marca 3 linhas e cospe uma semente em cada: fique entre as linhas e chegue perto para cortar.' },
  armadura:  { label:'Armadura Viva', hp:120, dmg:16, speed:2.6, radius:1.0, scale:1.35, xp:8, attack:'corte', sound:'golem',
               tip:'Lenta e resistente. Marca um leque à frente antes do golpe: dê a volta e bata pelas costas.' },
  sombra:    { label:'Sombra do Vazio', hp:34, dmg:9, speed:3.0, radius:0.8, scale:1.3, xp:6, attack:'magia', sound:'espirito',
               tip:'Some e reaparece perto de você antes de atirar o leque. Ataque logo que ela surgir.' },
  morcego:   { label:'Morcego das Grutas', hp:30, dmg:10, speed:5.0, radius:0.7, scale:1.2, xp:5, attack:'investida', sound:'espirito',
               tip:'Rápido: mergulha duas vezes em linha reta. Desvie para o lado e bata quando ele parar.' },
  magmaSlime:{ label:'Slime de Magma', hp:46, dmg:11, speed:2.8, radius:1.1, scale:1.5, xp:6, attack:'salto', sound:'slime',
               tip:'Onde cai deixa uma poça de lava por alguns segundos. Não lute em cima das poças.' },
  espectroGelo:{ label:'Espectro Gélido', hp:40, dmg:9, speed:2.8, radius:0.8, scale:1.35, xp:6, attack:'magia', sound:'espirito',
               tip:'Os orbes de gelo deixam você lento por 2 s. Desvie do leque e acerte de perto.' },
};
export const ATTACK_KINDS = {
  salto:     'Salto em área',
  investida: 'Investida corpo a corpo',
  magia:     'Magia (3 orbes)',
  pancada:   'Pancada em área',
  flecha:    'Flecha à distância',
  explode:   'Explode ao chegar perto',
  corte:     'Corte em leque à frente',
};
// Golpes dos chefes (nomes de PATTERNS em main.js). Regra: todo golpe tem aviso no chão e rota de fuga.
export const BOSS_PATTERNS = {
  salto:     'Salto esmagador',
  ondas:     'Ondas de choque (ache a brecha ou esquive)',
  invocar:   'Invoca lacaios',
  investida: 'Investida em linha',
  rastro:    'Investida que deixa fogo no caminho',
  corte:     'Corte em leque',
  rajada:    'Anel de projéteis (a fatia verde é segura)',
  meteoros:  'Chuva do alto (círculos marcados)',
  pocas:     'Poças que ficam no chão',
  espinhos:  'Fileiras de espinhos (fique entre elas)',
  espiral:   'Espiral de orbes com brechas',
  piscar:    'Some e reaparece ao seu lado',
  feixes:    'Feixes giratórios (fique na brecha)',
  giro:      'Foice giratória que persegue',
  eco:       'Cristais em xadrez (dois ecos)',
  nova:      'Explosão em volta (afaste-se)',
};

// patterns: golpes do chefe; p2: os que só entram na fúria (abaixo de 50% de vida, ele também fica mais rápido).
// minions: quem ele invoca. pool/rain: cor das poças e da chuva. trail: investida deixa fogo. slow: projéteis deixam lento.
export const BOSSES = {
  reiSlime:  { label:'Rei Slime',        hp:1500, dmg:14, radius:3.4, scale:4.5, patterns:['salto', 'ondas', 'invocar', 'pocas'], p2:['pocas'], minions:['slime'],
               tip:'Os saltos acertam onde você estava: continue andando. Na fúria ele espalha poças de gosma: lute fora delas.' },
  cavaleiro: { label:'Cavaleiro Ossudo', hp:1700, dmg:15, radius:2.4, scale:2.6, patterns:['investida', 'corte', 'rajada', 'invocar', 'espinhos'], p2:['espinhos'], minions:['esqueleto', 'arqueiroEsq'],
               tip:'Depois da investida ele fica parado um instante: é a hora de bater. No anel de projéteis, fique na fatia verde.' },
  colosso:   { label:'Colosso de Cinzas', hp:2000, dmg:17, radius:3.0, scale:2.3, patterns:['salto', 'ondas', 'meteoros', 'corte', 'pocas'], p2:['pocas'], pool:0xff6a1a, rain:0xff8a2a,
               tip:'Muita vida. Fuja dos meteoros marcados e, na fúria, das poças de lava que ele derrama.' },
  arauto:    { label:'Arauto do Vazio',  hp:1900, dmg:16, radius:2.6, scale:2.6, patterns:['rajada', 'espiral', 'invocar', 'piscar', 'feixes'], p2:['feixes'], minions:['espirito', 'sombra'],
               tip:'Ataques à distância: fique na fatia verde do anel e nas brechas da espiral. Quando ele some, saia do círculo onde vai surgir.' },
  ceifador:  { label:'Ceifador Ancião',  hp:2100, dmg:17, radius:2.6, scale:2.8, patterns:['investida', 'corte', 'invocar', 'meteoros', 'giro'], p2:['giro'], minions:['esqueleto'], rain:0xb45cff,
               tip:'Guarde a esquiva para a investida e o corte. Na fúria ele gira a foice e persegue: corra, ele é mais lento que você.' },
  cristalino:{ label:'Guardião Cristalino', hp:2200, dmg:17, radius:2.8, scale:2.2, patterns:['eco', 'espinhos', 'meteoros', 'invocar', 'nova'], p2:['nova'], minions:['morcego'], rain:0x9ad8ff, sound:'colosso',
               tip:'Os cristais nascem em xadrez, em dois ecos: pise onde o primeiro já estourou. Na fúria, afaste-se quando o chão em volta dele brilhar.' },
  senhorBrasas:{ label:'Senhor das Brasas', hp:2400, dmg:18, radius:2.6, scale:2.6, speed:2.8, patterns:['rastro', 'salto', 'pocas', 'meteoros', 'espiral'], p2:['espiral'], pool:0xff5a1a, rain:0xff6a1a, trail:true, sound:'colosso',
               tip:'A investida deixa fogo no caminho: desvie para o lado, não para trás. Lute longe das poças de lava.' },
  rainhaGelo:{ label:'Rainha Glacial',   hp:2600, dmg:19, radius:2.6, scale:2.6, patterns:['feixes', 'nova', 'rajada', 'invocar', 'piscar'], p2:['piscar'], minions:['espectroGelo'], slow:true, sound:'arauto',
               tip:'A última e mais forte. Os orbes deixam você lento: fique na fatia verde do anel. Nos feixes, ande junto com a brecha.' },
};
// Velocidade dos chefes quando não definida (igual a spawnMob em main.js).
export const BOSS_SPEED = 2.4;
// Ficha do bestiário: onde aparece e se já foi descoberto (mob: 1 abate; chefe: dungeon vencida).
export const dungeonsWith = type => DUNGEONS.filter(d => d.boss === type || d.mobs.includes(type));
export const discovered = (save, type) => MOBS[type] ? (save.bestiary?.[type] ?? 0) > 0 : dungeonsWith(type).some(d => save.best?.[String(d.level)]);

export const SKINS = {
  aventureiro: { label:'Aventureiro',        price:0 },
  celestial:   { label:'Cavaleiro Celestial', price:900 },
  ceifador:    { label:'Ceifador Sombrio',   price:1200 },
  arcanista:   { label:'Arcanista Cósmico',  price:1500 },
  lorde:       { label:'Lorde Abissal',      price:2000 },
  guardiao:    { label:'Guardião do Eco',    price:1500 },
  errante:     { label:'Errante do Crepúsculo', price:1500 },
};

export const SLOTS = ['arma', 'armadura', 'amuleto', 'skill'];
export const SLOT_LABEL = { arma:'Arma', armadura:'Armadura', amuleto:'Amuleto', skill:'Habilidade' };

// Armas: 3 estilos por raridade (o índice do nome é o estilo visual: ver VARIANTS em models.js).
const NAMES = {
  espada:   { comum:['Espada de Ferro', 'Lâmina de Bronze', 'Cutelo de Osso'], raro:['Lâmina Glacial', 'Sabre da Floresta', 'Espada da Tempestade'], epico:['Fenda do Vazio', 'Presa Sangrenta', 'Ferrão Venenoso'], lendario:['Aurora Solar', 'Lâmina Celestial', 'Devoradora do Abismo'], mitico:['Lâmina do Fim', 'Coroa de Sangue', 'Eclipse Rubro'] },
  machado:  { comum:['Machado de Ferro', 'Machado de Bronze', 'Machado de Osso'], raro:['Machado Gélido', 'Machado do Bosque', 'Machado Trovejante'], epico:['Ceifa Abissal', 'Carrasco Rubro', 'Machado Pestilento'], lendario:['Fúria Vulcânica', 'Asa do Paraíso', 'Ruína Abissal'], mitico:['Juízo Sangrento', 'Machado do Rei Rubro', 'Cisão Eclipsada'] },
  arco:     { comum:['Arco de Teixo', 'Arco de Bronze', 'Arco de Osso'], raro:['Arco da Geada', 'Arco Silvestre', 'Arco do Trovão'], epico:['Corda do Vazio', 'Arco Sanguinário', 'Arco Peçonhento'], lendario:['Arco da Fênix', 'Arco Serafim', 'Arco do Eclipse'], mitico:['Arco do Juízo Final', 'Arco da Coroa Rubra', 'Arco da Lua de Sangue'] },
  cajado:   { comum:['Cajado de Carvalho', 'Cetro de Bronze', 'Cajado de Osso'], raro:['Cetro de Gelo', 'Cajado Druídico', 'Cetro da Tempestade'], epico:['Foco do Vazio', 'Cetro Carmesim', 'Cajado da Praga'], lendario:['Coração da Supernova', 'Cajado Celestial', 'Cetro do Abismo'], mitico:['Cajado do Cataclismo', 'Cetro do Rei Rubro', 'Foco da Lua de Sangue'] },
  armadura: { comum:['Couraça de Couro', 'Gibão Remendado'], raro:['Placas Glaciais', 'Cota do Vigia'], epico:['Égide do Vazio', 'Armadura Ametista'], lendario:['Manto do Sol', 'Placas da Aurora'], mitico:['Couraça do Rei Rubro', 'Placas do Juízo Final', 'Manto da Lua de Sangue'] },
  amuleto:  { comum:['Colar de Osso', 'Pingente Simples'], raro:['Gota de Safira', 'Lágrima Glacial'], epico:['Olho do Vazio', 'Estrela Ametista'], lendario:['Coração da Fênix', 'Sol Aprisionado'], mitico:['Coração Carmesim', 'Olho do Cataclismo', 'Lágrima de Sangue'] },
};
export const weaponNames = (kind, rarity) => NAMES[kind][rarity];
// Estilo visual da arma; itens antigos (sem campo) usam o índice do nome, ou o primeiro.
export const weaponVariant = it => it.variant ?? Math.max(0, NAMES[it.kind]?.[it.rarity]?.indexOf(it.name) ?? 0);

export const dungeonScale = level => Math.pow(2.3, level - 1);

// Gerador determinístico para dungeons e testes.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollRarity(table, rand = Math.random) {
  let r = rand() * 100;
  for (const id of ['mitico', 'lendario', 'epico', 'raro']) { if (r < (table[id] ?? 0)) return id; r -= table[id] ?? 0; }
  return 'comum';
}

let uidCounter = 0;
const uid = () => `${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export function makeItem({ slot, cls, level, rarity, rand = Math.random }) {
  const R = RARITY[rarity], s = dungeonScale(level), roll = 0.9 + rand() * 0.2;
  const kind = slot === 'arma' ? CLASSES[cls].weapon : slot;
  const names = NAMES[kind][rarity];
  const idx = Math.floor(rand() * names.length);
  const item = { id:uid(), slot, rarity, level, kind, cls:slot === 'arma' ? cls : null, name:names[idx], atk:0, hp:0 };
  if (slot === 'arma') item.variant = idx;
  if (slot === 'arma') item.atk = Math.round(8 * s * R.mult * roll);
  else if (slot === 'armadura') item.hp = Math.round(60 * s * R.mult * roll);
  else { item.atk = Math.round(3 * s * R.mult * roll); item.hp = Math.round(25 * s * R.mult * roll); }
  item.affixes = rollAffixes(rarity, rand);
  return item;
}

export function makeSkillItem({ skill, level }) {
  const S = SKILLS[skill];
  return { id:uid(), slot:'skill', kind:'skill', skill, cls:S.cls, rarity:S.rarity, level, name:S.label, atk:0, hp:0 };
}

// min: raridade mínima garantida. bonus: pontos % somados à chance de lendário (pity).
export function rollDrop(source, { cls, level, rand = Math.random, min = null, bonus = 0 }) {
  let rarity = rollRarity(bonus ? { ...DROP_TABLES[source], lendario:DROP_TABLES[source].lendario + bonus } : DROP_TABLES[source], rand);
  if (min && RARITY[rarity].rank < RARITY[min].rank) rarity = min;
  const r = rand();
  if (r >= 0.8 && rarity !== 'mitico') { // não há habilidade mítica: vira equipamento
    const pool = skillsOf(cls).filter(id => SKILLS[id].rarity === rarity);
    return makeSkillItem({ skill:pool[Math.floor(rand() * pool.length)], level });
  }
  const slot = r < 0.4 ? 'arma' : r < 0.65 ? 'armadura' : 'amuleto';
  return makeItem({ slot, cls, level, rarity, rand });
}

// Habilidade não soma status: o poder dela é a raridade e o nível.
// Cada afixo soma até +8% do poder base, proporcional ao valor dentro do máximo.
export const itemPower = item => {
  if (item.slot === 'skill') return Math.round((RARITY[item.rarity].rank + 1) * 40 * skillPower(item));
  const base = item.atk * 5 + item.hp * 0.5;
  return Math.round(base * (1 + (item.affixes ?? []).reduce((s, a) => s + 0.08 * a.v / AFFIXES[a.id].max, 0)));
};

export function xpToNext(lvl) { return Math.round(50 * Math.pow(lvl, 1.5)); }

export function equippedItems(save) {
  const byId = new Map(save.inventory.map(i => [i.id, i]));
  return {
    arma: byId.get(save.equipped.arma[save.cls]) ?? null,
    armadura: byId.get(save.equipped.armadura) ?? null,
    amuleto: byId.get(save.equipped.amuleto) ?? null,
  };
}

export function playerStats(save) {
  const C = CLASSES[save.cls], growth = 1 + 0.06 * (save.lvl - 1), eq = equippedItems(save), A = affixTotals(Object.values(eq));
  let atk = C.baseAtk * growth, hp = C.baseHp * growth;
  for (const it of Object.values(eq)) if (it) { atk += it.atk; hp += it.hp; }
  atk *= 1 + A.atk; hp *= (1 + A.hp) * (C.hpMul ?? 1);
  if (hasCharm(save, 'furia')) atk *= 1.08;
  if (hasCharm(save, 'vigor')) hp *= 1.1;
  atk = Math.round(atk); hp = Math.round(hp);
  return { atk, hp, crit:(hasCharm(save, 'olho') ? 0.17 : 0.12) + A.crit, critMult:1.8 + A.critDmg, lifesteal:A.lifesteal, atkSpeed:A.atkSpeed,
    moveSpeed:A.moveSpeed, cdr:A.cdr, drop:A.drop, bossDmg:A.boss, mythic:eq.arma?.rarity === 'mitico', power:Math.round(atk * 5 + hp * 0.5) };
}

// Status se o item fosse equipado (para comparar na mochila), sem mexer no save.
export function statsIfEquipped(save, id) {
  const copy = { ...save, equipped:{ ...save.equipped, arma:{ ...save.equipped.arma } } };
  equip(copy, id);
  return playerStats(copy);
}
// Atributos comparáveis: chave em playerStats, rótulo e se é porcentagem.
export const STAT_ROWS = [['atk', 'Ataque', false], ['hp', 'Vida', false], ['crit', 'Crítico', true], ['critMult', 'Dano crítico', true], ['lifesteal', 'Roubo de vida', true],
  ['atkSpeed', 'Vel. de ataque', true], ['moveSpeed', 'Vel. de movimento', true], ['cdr', 'Recarga', true], ['drop', 'Chance de drop', true], ['bossDmg', 'Dano em chefes', true]];

// Poder de alguém com equipamento entre comum e raro do mesmo nível.
export function recommendedPower(level) {
  const s = dungeonScale(level), m = 1.2, lvl = 1 + (level - 1) * 5, growth = 1 + 0.06 * (lvl - 1);
  const atk = 10 * growth + 8 * s * m + 3 * s * m, hp = 110 * growth + 60 * s * m + 25 * s * m;
  return Math.round(atk * 5 + hp * 0.5);
}

export function difficultyLabel(power, level) {
  const r = power / recommendedPower(level);
  if (r >= 1.25) return { id:'facil', label:'Fácil' };
  if (r >= 0.9) return { id:'justo', label:'Justo' };
  if (r >= 0.6) return { id:'dificil', label:'Difícil' };
  return { id:'impossivel', label:'Muito difícil' };
}

// Garante a habilidade inicial de cada classe (saves antigos não tinham habilidades).
function ensureSkills(save) {
  save.equipped.skills ??= {};
  for (const cls of Object.keys(CLASSES)) {
    const slots = (save.equipped.skills[cls] ??= [null, null, null]);
    while (slots.length < SKILL_SLOTS) slots.push(null);
    slots.length = SKILL_SLOTS;
    for (let i = 0; i < SKILL_SLOTS; i++) if (slots[i] && !save.inventory.some(it => it.id === slots[i] && it.slot === 'skill' && it.cls === cls)) slots[i] = null;
    if (!slots.some(Boolean)) {
      let it = save.inventory.find(i => i.slot === 'skill' && i.cls === cls);
      if (!it) { it = makeSkillItem({ skill:CLASSES[cls].starter, level:1 }); save.inventory.push(it); }
      slots[0] = it.id;
    }
  }
  return save;
}

// Nome exibido acima do boneco: só texto simples, 2 a 16 caracteres.
export const cleanName = n => { const t = String(n ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16); return t.length >= 2 ? t : 'Aventureiro'; };

export function newSave() {
  const inventory = Object.keys(CLASSES).map(cls => makeItem({ slot:'arma', cls, level:1, rarity:'comum' }));
  const armor = makeItem({ slot:'armadura', cls:null, level:1, rarity:'comum' });
  inventory.push(armor);
  return ensureSkills({
    v:1, name:'Aventureiro', vip:false, cls:'guerreiro', skin:'aventureiro', ownedSkins:['aventureiro'], gems:300, lvl:1, xp:0,
    inventory, equipped:{ arma:Object.fromEntries(inventory.filter(i => i.slot === 'arma').map(i => [i.cls, i.id])), armadura:armor.id, amuleto:null },
    best:{}, stats:{ runs:0, wins:0, legendaries:0 }, login:{ day:'', streak:0 }, pity:0,
    mats:{}, tools:{ picareta:1, foice:1 }, nodes:{}, prof:{ coleta:0, alquimia:0 }, recipes:[], potions:{}, belt:null, settings:{ quality:'alto', sound:true, dev:true, music:0.6, sfx:0.9 },
  });
}

export function isEquipped(save, id) {
  return Object.values(save.equipped.arma).includes(id) || save.equipped.armadura === id || save.equipped.amuleto === id
    || Object.values(save.equipped.skills ?? {}).some(s => s.includes(id));
}

// Habilidade: vai para o espaço pedido ou o primeiro livre; se já estava em outro espaço, troca de lugar.
export function equip(save, id, slotIdx = null) {
  const item = save.inventory.find(i => i.id === id);
  if (!item) return false;
  if (item.slot === 'skill') {
    const slots = save.equipped.skills[item.cls];
    const cur = slots.indexOf(id), to = slotIdx ?? (cur >= 0 ? cur : slots.indexOf(null) >= 0 ? slots.indexOf(null) : 0);
    if (cur >= 0) slots[cur] = slots[to];
    slots[to] = id;
    return true;
  }
  if (item.slot === 'arma') save.equipped.arma[item.cls] = id;
  else save.equipped[item.slot] = id;
  return true;
}

export function unequipSkill(save, cls, slotIdx) {
  const slots = save.equipped.skills[cls];
  if (slots.filter(Boolean).length <= 1) return false; // sempre fica pelo menos uma
  slots[slotIdx] = null; return true;
}

export const equippedSkills = save => save.equipped.skills[save.cls].map(id => save.inventory.find(i => i.id === id) ?? null);

export function salvage(save, id) {
  const idx = save.inventory.findIndex(i => i.id === id);
  if (idx < 0 || isEquipped(save, id)) return 0;
  const gems = RARITY[save.inventory[idx].rarity].salvage * save.inventory[idx].level;
  save.inventory.splice(idx, 1); save.gems += gems;
  return gems;
}

// Venda em lote: ignora equipados; devolve o total de gemas.
export function salvageMany(save, ids) { let g = 0; for (const id of ids) g += salvage(save, id); return g; }

// Mochila cheia: o item vira gemas em vez de sumir.
export function addItem(save, item) {
  if (item.rarity === 'lendario') save.stats.legendaries++;
  if (item.slot === 'arma') (save.found ??= {})[`${item.kind}:${item.rarity}:${weaponVariant(item)}`] = true;
  if (save.inventory.length >= INVENTORY_CAP) { const g = RARITY[item.rarity].salvage * item.level; save.gems += g; return { added:false, gems:g }; }
  save.inventory.push(item);
  return { added:true, gems:0 };
}

export function addXp(save, amount) {
  let ups = 0;
  save.xp += amount;
  while (save.lvl < MAX_LEVEL && save.xp >= xpToNext(save.lvl)) { save.xp -= xpToNext(save.lvl); save.lvl++; ups++; }
  if (save.lvl >= MAX_LEVEL) save.xp = 0;
  return ups;
}

export function buySkin(save, id) {
  const S = SKINS[id];
  if (!S || save.ownedSkins.includes(id) || (!save.settings.dev && save.gems < S.price)) return false;
  if (!save.settings.dev) save.gems -= S.price;
  save.ownedSkins.push(id);
  return true;
}

export const winGems = level => 15 * level;

export function finishRun(save, { level, won, time }) {
  save.stats.runs++;
  if (!won) return { gems:0 };
  save.stats.wins++;
  const key = String(level);
  if (!(save.best[key] <= time)) save.best[key] = Math.round(time);
  const gems = winGems(level); save.gems += gems;
  return { gems };
}

export function serialize(save) { return JSON.stringify(save); }

// Afixos do save: só ids conhecidos, sem repetir, valor dentro da faixa e no máximo o número da raridade.
function cleanAffixes(it) {
  if (it.slot === 'skill' || !Array.isArray(it.affixes)) return [];
  const seen = new Set(), out = [];
  for (const a of it.affixes) {
    const A = AFFIXES[a?.id];
    if (!A || seen.has(a.id) || !Number.isFinite(a.v) || a.v < A.min || a.v > A.max) continue;
    seen.add(a.id); out.push({ id:a.id, v:a.v });
  }
  return out.slice(0, AFFIX_COUNT[it.rarity]);
}

// Dado de localStorage é entrada não confiável: qualquer formato inesperado volta ao save novo.
export function deserialize(text) {
  try {
    const s = JSON.parse(text);
    if (!s || s.v !== 1 || !CLASSES[s.cls] || !Array.isArray(s.inventory) || typeof s.equipped?.arma !== 'object') return newSave();
    s.inventory = s.inventory.filter(i => i && SLOTS.includes(i.slot) && RARITY[i.rarity] && Number.isFinite(i.level) && Number.isFinite(i.atk) && Number.isFinite(i.hp) && (i.slot !== 'skill' || SKILLS[i.skill]?.cls === i.cls) && (i.plus === undefined || (Number.isInteger(i.plus) && i.plus >= 0 && i.plus <= 5)));
    for (const it of s.inventory) it.affixes = cleanAffixes(it);
    s.ownedSkins = (Array.isArray(s.ownedSkins) ? s.ownedSkins : []).filter(id => SKINS[id]);
    if (!s.ownedSkins.includes('aventureiro')) s.ownedSkins.unshift('aventureiro');
    if (!s.ownedSkins.includes(s.skin)) s.skin = 'aventureiro';
    for (const k of ['gems', 'lvl', 'xp']) if (!Number.isFinite(s[k]) || s[k] < 0) s[k] = k === 'lvl' ? 1 : 0;
    s.lvl = Math.min(MAX_LEVEL, Math.max(1, Math.floor(s.lvl)));
    s.name = cleanName(s.name); s.vip = s.vip === true;
    s.best = s.best && typeof s.best === 'object' ? s.best : {};
    s.stats = { runs:0, wins:0, legendaries:0, ...s.stats };
    s.found = s.found && typeof s.found === 'object' ? s.found : {};
    s.bestiary = s.bestiary && typeof s.bestiary === 'object' ? s.bestiary : {};
    s.charms = Array.isArray(s.charms) ? s.charms.filter(id => CHARMS[id]) : [];
    for (const it of s.inventory) if (it.slot === 'arma') s.found[`${it.kind}:${it.rarity}:${weaponVariant(it)}`] = true;
    s.settings = { quality:'alto', sound:true, dev:true, music:0.6, sfx:0.9, ...s.settings };
    for (const k of ['music', 'sfx']) if (!Number.isFinite(s.settings[k]) || s.settings[k] < 0 || s.settings[k] > 1) s.settings[k] = k === 'music' ? 0.6 : 0.9;
    if (!Array.isArray(s.daily?.missions) || typeof s.daily?.day !== 'string') delete s.daily;
    s.login = typeof s.login?.day === 'string' && /^(\d{4}-\d\d-\d\d)?$/.test(s.login.day) && Number.isInteger(s.login.streak) && s.login.streak >= 0 ? { day:s.login.day, streak:s.login.streak } : { day:'', streak:0 };
    s.pity = Number.isInteger(s.pity) && s.pity >= 0 && s.pity < PITY_MAX ? s.pity : 0;
    cleanCraft(s);
    return ensureSkills(s);
  } catch { return newSave(); }
}

// ---------- diário: baú grátis e missões (renovam a cada dia local) ----------
export const dayKey = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
export const MISSIONS = [
  { id:'kills',   label:'Derrote {n} inimigos',         n:[40, 80, 120], gems:60 },
  { id:'wins',    label:'Vença {n} dungeon(s)',         n:[1, 2, 3],     gems:80 },
  { id:'skills',  label:'Use habilidades {n} vezes',    n:[15, 30, 50],  gems:50 },
  { id:'epic',    label:'Consiga {n} item(ns) épico ou melhor', n:[1, 2], gems:120 },
  { id:'bosses',  label:'Derrote {n} chefe(s)',         n:[1, 2, 3],     gems:90 },
  { id:'fast',    label:'Vença uma dungeon em menos de {n}s', n:[300, 260, 220], gems:100 },
  { id:'gather',  label:'Colete {n} recursos no Vale',  n:[10, 20, 30],  gems:60 },
  { id:'brew',    label:'Prepare {n} poção(ões) com a alquimista', n:[2, 4], gems:70 },
];
export function ensureDaily(save, now = new Date()) {
  const day = dayKey(now);
  if (save.daily?.day === day) return save.daily;
  const rand = mulberry32([...day].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
  const pool = [...MISSIONS].sort(() => rand() - 0.5).slice(0, 3);
  save.daily = { day, chest:false, missions:pool.map(m => { const n = m.n[Math.floor(rand() * m.n.length)]; return { id:m.id, label:m.label.replace('{n}', n), n, p:0, done:false, claimed:false, gems:m.gems }; }) };
  return save.daily;
}
// kind: 'kills' | 'wins' | 'skills' | 'epic' | 'bosses' | 'gather' | 'brew' | 'fast' (value = tempo da vitória).
export function trackMission(save, kind, value = 1) {
  const d = ensureDaily(save), done = [];
  for (const m of d.missions) {
    if (m.id !== kind || m.done) continue;
    if (kind === 'fast') { if (value <= m.n) m.p = m.n; } else m.p = Math.min(m.n, m.p + value);
    if (m.p >= m.n) { m.done = true; done.push(m); }
  }
  return done;
}
export function claimMission(save, idx) {
  const m = ensureDaily(save).missions[idx];
  if (!m || !m.done || m.claimed) return 0;
  m.claimed = true; save.gems += m.gems; return m.gems;
}
const bestLevel = save => Math.max(1, ...Object.keys(save.best).map(Number));
// Baú diário: 3 itens do maior nível já vencido (mínimo 1).
export function claimDailyChest(save, rand = Math.random) {
  const d = ensureDaily(save);
  if (d.chest) return null;
  d.chest = true;
  return rollChest(save, bestLevel(save), rand);
}

// ---------- pity: baús (final de dungeon e diário) sem lendário ou melhor ----------
// A partir do 6º baú seco, +2% de lendário por item a cada baú; o 15º garante um lendário.
export const PITY_MAX = 15, PITY_SOFT = 5;
export const pityLeft = save => PITY_MAX - (save.pity ?? 0);
export function rollChest(save, level, rand = Math.random) {
  const p = save.pity ?? 0, bonus = Math.max(0, p - PITY_SOFT) * 2;
  const items = Array.from({ length:3 }, (_, i) => rollDrop('chest', { cls:save.cls, level, rand, bonus, min:i === 0 && p >= PITY_MAX - 1 ? 'lendario' : null }));
  save.pity = items.some(it => RARITY[it.rarity].rank >= RARITY.lendario.rank) ? 0 : p + 1;
  return items;
}

// ---------- calendário de login: ciclo de 7 dias; perder um dia zera a sequência ----------
export const LOGIN_REWARDS = [
  { gems:50 }, { gems:80 }, { chest:1 }, { gems:120 }, { gems:150 }, { chest:2, min:'raro' }, { chest:3, min:'epico', big:true },
];
export const LOGIN_SPECIAL = 30;
// A cada 30 dias seguidos o prêmio do dia vira um item mítico + 500 gemas.
export const loginReward = streak => streak % LOGIN_SPECIAL === 0 ? { gems:500, chest:1, min:'mitico', special:true } : LOGIN_REWARDS[(streak - 1) % 7];
// streak = dia que será resgatado (se canClaim) ou o último resgatado.
export function loginState(save, now = new Date()) {
  const L = save.login ?? { day:'', streak:0 }, today = dayKey(now);
  if (L.day === today) return { canClaim:false, streak:L.streak };
  const y = new Date(now); y.setDate(y.getDate() - 1);
  return { canClaim:true, streak:L.day === dayKey(y) ? L.streak + 1 : 1 };
}
export function claimLogin(save, now = new Date(), rand = Math.random) {
  const st = loginState(save, now);
  if (!st.canClaim) return null;
  save.login = { day:dayKey(now), streak:st.streak };
  const r = loginReward(st.streak), level = bestLevel(save);
  save.gems += r.gems ?? 0;
  const items = Array.from({ length:r.chest ?? 0 }, () => rollDrop('chest', { cls:save.cls, level, rand, min:r.min }));
  return { ...r, streak:st.streak, items };
}

// ---------- forja: aprimorar item (+1 a +5, +10% de status cada) ----------
export const MAX_PLUS = 5;
// Mítico custa o dobro do que a escada de raridade daria e a forja fica 10 pontos mais difícil.
export const upgradeCost = it => Math.round((RARITY[it.rarity].rank + 1) * 15 * it.level * (1 + (it.plus ?? 0)) * (it.rarity === 'mitico' ? 2 : 1));
// Chance de sucesso para o próximo nível; falhar só gasta as gemas (o item nunca piora).
export const forgeChance = it => Math.max(0, ([1, 1, 1, 0.8, 0.65, 0.5][(it.plus ?? 0) + 1] ?? 0) - (it.rarity === 'mitico' ? 0.1 : 0));
export function upgradeItem(save, id, rand = Math.random) {
  const it = save.inventory.find(i => i.id === id);
  if (!it || it.slot === 'skill' || (it.plus ?? 0) >= MAX_PLUS) return { ok:false };
  const cost = upgradeCost(it);
  if (!save.settings.dev) { if (save.gems < cost) return { ok:false }; save.gems -= cost; }
  const success = rand() < forgeChance(it);
  if (success) { it.plus = (it.plus ?? 0) + 1; it.atk = Math.round(it.atk * 1.1); it.hp = Math.round(it.hp * 1.1); }
  return { ok:true, success };
}

// ---------- bestiário e charms (inspirado no Tibia) ----------
export const BESTIARY_STAGES = [25, 100, 250];
export const CHARMS = {
  olho:  { label:'Olho Crítico',       cost:20, desc:'+5% de chance de crítico' },
  vigor: { label:'Vigor Ancestral',    cost:20, desc:'+10% de vida' },
  furia: { label:'Fúria do Caçador',   cost:30, desc:'+8% de ataque' },
  sorte: { label:'Sorte do Saqueador', cost:30, desc:'+30% de chance de itens dos inimigos' },
};
export const bestiaryStars = (save, type) => BESTIARY_STAGES.filter(n => (save.bestiary?.[type] ?? 0) >= n).length;
export const charmPoints = save => Object.keys(MOBS).reduce((p, t) => p + bestiaryStars(save, t) * 10, 0) - (save.charms ?? []).reduce((c, id) => c + (CHARMS[id]?.cost ?? 0), 0);
// Conta um abate; devolve a nova estrela quando sobe de etapa.
export function recordKill(save, type) {
  if (!MOBS[type]) return 0;
  const before = bestiaryStars(save, type);
  (save.bestiary ??= {})[type] = (save.bestiary[type] ?? 0) + 1;
  const after = bestiaryStars(save, type);
  return after > before ? after : 0;
}
export function unlockCharm(save, id) {
  if (!CHARMS[id] || (save.charms ??= []).includes(id) || charmPoints(save) < CHARMS[id].cost) return false;
  save.charms.push(id); return true;
}
export const hasCharm = (save, id) => (save.charms ?? []).includes(id);
// Criatura em destaque do dia: +50% XP e o dobro de chance de item.
export const boostedCreature = (now = new Date()) => { const keys = Object.keys(MOBS), d = dayKey(now); return keys[[...d].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5) % keys.length]; };
// ---------- coleta, ferramentas e alquimia ----------
// Materiais ficam numa bolsa à parte (não ocupam a mochila). A chave existir em save.mats = já foi visto (libera receitas).
export const MATERIALS = {
  ferro:    { label:'Minério de Ferro', color:0xd08850, kind:'minerio', where:'Veios do Vale' },
  prata:    { label:'Minério de Prata', color:0xdfe6f0, kind:'minerio', where:'Veios do Vale (Picareta de Ferro)' },
  mitril:   { label:'Mitril',           color:0x5fe0ff, kind:'minerio', where:'Veios do Vale (Picareta de Prata)' },
  erva:     { label:'Erva-cura',        color:0x6fd35a, kind:'planta',  where:'Moitas do Vale' },
  raiz:     { label:'Raiz Lunar',       color:0xa8b8ff, kind:'planta',  where:'Moitas do Vale (Foice de Ferro)' },
  florSol:  { label:'Flor Solar',       color:0xffc23a, kind:'planta',  where:'Moitas do Vale (Foice de Prata)' },
  cristal:  { label:'Cristal Ecoante',  color:0x8fe8ff, kind:'raro',    where:'Grutas Ecoantes (nível 6)' },
  brasa:    { label:'Brasa Viva',       color:0xff6a1a, kind:'raro',    where:'Rio de Magma (nível 7)' },
  florGelo: { label:'Flor de Gelo',     color:0xbfefff, kind:'raro',    where:'Ruínas Congeladas (nível 8)' },
  essencia: { label:'Essência Abissal', color:0xc77dff, kind:'raro',    where:'Chefe de qualquer dungeon' },
};
export const MAT_CAP = 999, POTION_CAP = 30;
// Material raro do tema: só cai na dungeon dele.
export const THEME_MAT = { 6:'cristal', 7:'brasa', 8:'florGelo' };
// Erva ou minério que os mobs de cada dungeon soltam (6-8: o material raro do tema).
export const MOB_MAT = { 1:'erva', 2:'raiz', 3:'ferro', 4:'prata', 5:'florSol', 6:'cristal', 7:'brasa', 8:'florGelo' };
// Mob: 4% (mais a sorte) de 1 material da dungeon. Chefe: essência (+1 a cada 3 níveis) e 2-3 do tema.
export function rollMaterials(source, level, rand = Math.random, luck = 0) {
  const out = {}, tm = THEME_MAT[level], mm = MOB_MAT[level];
  if (source === 'boss') { out.essencia = 1 + Math.floor(level / 3); if (tm) out[tm] = 2 + Math.floor(rand() * 2); }
  else if (mm && rand() < 0.04 * (1 + luck)) out[mm] = 1;
  return out;
}
// Equipamento na run: o baú do chefe dá 3 (rollChest, com pity). Fora ele só elite/guardião, raro,
// e o baú secreto, muito raro. Mob comum não solta equipamento.
export const GEAR_CHANCE = { elite:0.06, mini:0.2, secret:0.05 };
// Beco lateral e baú secreto: gemas e materiais no lugar de equipamento.
export function sideReward(level, secret, rand = Math.random) {
  const mm = MOB_MAT[level], mats = { [mm]:(secret ? 3 : 1) + Math.floor(rand() * 2) };
  if (secret) Object.assign(mats, rollMaterials('boss', level, rand));
  return { gems:(secret ? 30 : 12) * level, mats, gear:secret && rand() < GEAR_CHANCE.secret };
}
export function addMaterials(save, mats) {
  for (const [id, n] of Object.entries(mats)) if (MATERIALS[id]) save.mats[id] = Math.min(MAT_CAP, (save.mats[id] ?? 0) + n);
  return mats;
}
// Custo = gemas + materiais. No modo teste as gemas são grátis, os materiais não (a coleta é o jogo).
export const hasCost = (save, cost) => Object.entries(cost).every(([id, n]) => id === 'gems' ? save.settings.dev || save.gems >= n : (save.mats[id] ?? 0) >= n);
function payCost(save, cost) {
  if (!hasCost(save, cost)) return false;
  for (const [id, n] of Object.entries(cost)) { if (id !== 'gems') save.mats[id] -= n; else if (!save.settings.dev) save.gems -= n; }
  return true;
}

// Profissões: Coleta e Alquimia sobem de nível com o uso (bônus pequenos por nível).
export const PROF_MAX = 20;
export const PROFS = {
  coleta:   { label:'Coleta',   perks:['-2% de tempo de coleta', '+3% de chance de recurso extra'] },
  alquimia: { label:'Alquimia', perks:['+4% de chance de poção dupla', '-2% de recarga de poção'] },
};
const profNext = lvl => 20 + lvl * 15;
export function profInfo(xp) {
  let lvl = 1; while (lvl < PROF_MAX && xp >= profNext(lvl)) { xp -= profNext(lvl); lvl++; }
  return { lvl, cur:lvl >= PROF_MAX ? 0 : xp, next:profNext(lvl) };
}
export const profLevel = (save, k) => profInfo(save.prof[k]).lvl;
// Devolve o nível novo se subiu (senão 0).
function addProf(save, k, xp) { const before = profLevel(save, k); save.prof[k] += xp; const after = profLevel(save, k); return after > before ? after : 0; }

// Ferramentas: nível 1-4. Nível maior coleta nós mais raros, mais rápido e com mais chance de recurso extra.
export const TOOLS = { picareta:{ label:'Picareta', verb:'Minerar' }, foice:{ label:'Foice', verb:'Colher' } };
export const TOOL_TIERS = ['Bronze', 'Ferro', 'Prata', 'Mitril'];
export const TOOL_MAX = 4;
export const toolName = (tool, tier) => `${TOOLS[tool].label} de ${TOOL_TIERS[tier - 1]}`;
// TOOL_COST[ferramenta][nível atual] = custo para subir um nível.
export const TOOL_COST = {
  picareta: [null, { gems:80, ferro:8 }, { gems:250, prata:8, essencia:1 }, { gems:600, mitril:6, cristal:3, essencia:2 }],
  foice:    [null, { gems:80, erva:8, ferro:3 }, { gems:250, raiz:8, essencia:1 }, { gems:600, florSol:6, florGelo:3, essencia:2 }],
};
export function upgradeTool(save, tool) {
  const tier = save.tools[tool], cost = TOOL_COST[tool]?.[tier];
  if (!cost) return { ok:false, reason:'max' };
  if (!payCost(save, cost)) return { ok:false, reason:'custo' };
  save.tools[tool] = tier + 1;
  return { ok:true, tier:tier + 1 };
}

// Nós de coleta do Vale: renascem em tempo real (save.nodes[id] = quando volta, em ms).
export const NODES = {
  ferro:   { mat:'ferro',   tool:'picareta', tier:1, respawn:150 },
  prata:   { mat:'prata',   tool:'picareta', tier:2, respawn:300 },
  mitril:  { mat:'mitril',  tool:'picareta', tier:3, respawn:540 },
  erva:    { mat:'erva',    tool:'foice',    tier:1, respawn:120 },
  raiz:    { mat:'raiz',    tool:'foice',    tier:2, respawn:300 },
  florSol: { mat:'florSol', tool:'foice',    tier:3, respawn:540 },
};
// Nós da praça (id começa com 'h'): renascem bem mais devagar, 30 min (raros, nível 2+: 60 min).
export const HUB_RESPAWN = { comum:1800, raro:3600 };
export const nodeRespawn = (id, type) => id[0] === 'h' ? (NODES[type].tier > 1 ? HUB_RESPAWN.raro : HUB_RESPAWN.comum) : NODES[type].respawn;
const NODE_MAX_MS = Math.max(HUB_RESPAWN.raro, ...Object.values(NODES).map(n => n.respawn)) * 1000;
export const nodeReady = (save, id, now = Date.now()) => (save.nodes[id] ?? 0) <= now;
export const nodeLeft = (save, id, now = Date.now()) => Math.max(0, (save.nodes[id] ?? 0) - now) / 1000;
// Segundos de coleta: ferramenta melhor e nível de Coleta encurtam.
export const gatherTime = (save, type) => { const N = NODES[type]; return 3.8 / (1 + 0.12 * (save.tools[N.tool] - 1)) * (1 - 0.02 * (profLevel(save, 'coleta') - 1)); };
export function gatherNode(save, id, type, now = Date.now(), rand = Math.random) {
  const N = NODES[type];
  if (!N) return { ok:false, reason:'tipo' };
  if (!nodeReady(save, id, now)) return { ok:false, reason:'vazio' };
  if (save.tools[N.tool] < N.tier) return { ok:false, reason:'ferramenta' };
  const extra = 0.15 * (save.tools[N.tool] - N.tier) + 0.03 * (profLevel(save, 'coleta') - 1);
  const n = 1 + (rand() < 0.5 ? 1 : 0) + (rand() < extra ? 1 : 0);
  addMaterials(save, { [N.mat]:n });
  save.nodes[id] = now + nodeRespawn(id, type) * 1000;
  return { ok:true, mat:N.mat, n, up:addProf(save, 'coleta', 4 * N.tier), learned:learnRecipes(save) };
}

// Poções (receitas da alquimista). req: nível de Alquimia. A receita entra no livro quando o nível
// chega e todos os ingredientes já foram vistos. Buffs duram POTION_BUFF segundos.
export const POTION_BUFF = 120;
export const POTIONS = {
  curaP: { label:'Poção de Cura Pequena', kind:'heal',  heal:0.3,  color:0xff6a7a, mats:{ erva:2 },             req:1, desc:'Cura 30% da vida na hora.' },
  forca: { label:'Tônico de Força',       kind:'buff',  buff:'atk', v:0.05, color:0xff8a3a, mats:{ erva:2, ferro:2 }, req:1, desc:'+5% de dano por 2 minutos.' },
  curaM: { label:'Poção de Cura Média',   kind:'heal',  heal:0.55, color:0xff3a5a, mats:{ erva:3, raiz:1 },    req:2, desc:'Cura 55% da vida na hora.' },
  vento: { label:'Tônico do Vento',       kind:'buff',  buff:'speed', v:0.12, color:0x7fe9ff, mats:{ erva:1, raiz:1 }, req:2, desc:'+12% de velocidade de movimento por 2 minutos.' },
  regen: { label:'Poção de Regeneração',  kind:'regen', heal:0.6, dur:12, color:0x5aff8a, mats:{ erva:2, prata:1 }, req:3, desc:'Cura 60% da vida aos poucos, em 12 segundos.' },
  lava:  { label:'Elixir Antichamas',     kind:'buff',  buff:'fire', v:0.5, color:0xff5a1a, mats:{ erva:2, brasa:2 }, req:3, desc:'-50% de dano de lava e fogo por 2 minutos.' },
  gelo:  { label:'Elixir Antigelo',       kind:'buff',  buff:'ice', v:0.5, color:0xbfefff, mats:{ erva:2, florGelo:2 }, req:3, desc:'Sem lentidão e -50% de dano de gelo por 2 minutos.' },
  sorte: { label:'Elixir da Sorte',       kind:'buff',  buff:'luck', v:0.25, color:0xffd36b, mats:{ prata:1, florSol:1 }, req:4, desc:'+25% de chance de itens e materiais por 2 minutos.' },
  curaG: { label:'Poção de Cura Grande',  kind:'heal',  heal:1,    color:0xff1a4a, mats:{ raiz:2, florSol:1, essencia:1 }, req:5, desc:'Cura toda a vida na hora.' },
};
export function learnRecipes(save) {
  const lvl = profLevel(save, 'alquimia'), out = [];
  for (const [id, R] of Object.entries(POTIONS)) if (!save.recipes.includes(id) && lvl >= R.req && Object.keys(R.mats).every(m => m in save.mats)) { save.recipes.push(id); out.push(id); }
  return out;
}
export function brew(save, id, rand = Math.random) {
  const R = POTIONS[id];
  if (!R || !save.recipes.includes(id)) return { ok:false, reason:'receita' };
  if ((save.potions[id] ?? 0) >= POTION_CAP) return { ok:false, reason:'cheio' };
  if (!payCost(save, R.mats)) return { ok:false, reason:'custo' };
  const n = 1 + (rand() < 0.04 * (profLevel(save, 'alquimia') - 1) ? 1 : 0);
  save.potions[id] = Math.min(POTION_CAP, (save.potions[id] ?? 0) + n);
  if (!save.belt || !save.potions[save.belt]) save.belt = id;
  return { ok:true, n, up:addProf(save, 'alquimia', 6 + 4 * R.req), learned:learnRecipes(save) };
}
// Beber: recarga entre poções e limite por run (na dungeon). ctx = { t, cdUntil, used, limit } vive em main.js.
export const POTION_CD = 18, POTION_RUN_LIMIT = 4;
export const potionCd = save => POTION_CD * (1 - 0.02 * (profLevel(save, 'alquimia') - 1));
export function drinkPotion(save, id, ctx) {
  const R = POTIONS[id];
  if (!R || !(save.potions[id] > 0)) return { ok:false, reason:'vazio' };
  if (ctx.t < ctx.cdUntil) return { ok:false, reason:'recarga', left:ctx.cdUntil - ctx.t };
  if (ctx.used >= (ctx.limit ?? POTION_RUN_LIMIT)) return { ok:false, reason:'limite' };
  save.potions[id]--; ctx.used++; ctx.cdUntil = ctx.t + potionCd(save);
  // Acabou a do cinto: passa para outra com estoque (cura primeiro), para o botão não ficar vazio à toa.
  if (save.belt === id && !save.potions[id]) save.belt = Object.keys(POTIONS).filter(k => save.potions[k] > 0).sort((a, b) => (POTIONS[b].kind === 'heal') - (POTIONS[a].kind === 'heal'))[0] ?? id;
  return { ok:true, def:R };
}

// ---------- ferreiro: re-rolar um afixo (paga com gemas + materiais) ----------
export const rerollCost = it => {
  const L = it.level;
  return [null, { gems:30 * L, ferro:4, erva:2 }, { gems:60 * L, prata:4, raiz:2 }, { gems:120 * L, mitril:3, florSol:2, essencia:1 },
    { gems:250 * L, mitril:5, essencia:3, cristal:1, brasa:1, florGelo:1 }][RARITY[it.rarity].rank];
};
// Troca o afixo idx por outro sorteado (nunca repete um afixo que o item já tem; pode vir o mesmo com outro valor).
export function rerollAffix(save, id, idx, rand = Math.random) {
  const it = save.inventory.find(i => i.id === id);
  if (!it || it.slot === 'skill' || !it.affixes?.[idx]) return { ok:false, reason:'item' };
  if (!payCost(save, rerollCost(it))) return { ok:false, reason:'custo' };
  const pool = Object.keys(AFFIXES).filter(a => !it.affixes.some((x, i) => i !== idx && x.id === a));
  const aid = pool[Math.floor(rand() * pool.length)], A = AFFIXES[aid], old = it.affixes[idx];
  it.affixes[idx] = { id:aid, v:Math.round((A.min + rand() * (A.max - A.min)) * 10) / 10 };
  return { ok:true, old, now:it.affixes[idx] };
}

// Campos de coleta/alquimia do save: qualquer valor estranho vira o padrão.
const intMap = (o, ok, max) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => ok(k) && Number.isInteger(v) && v >= 0).map(([k, v]) => [k, Math.min(max, v)]));
function cleanCraft(s) {
  s.mats = intMap(s.mats, k => MATERIALS[k], MAT_CAP);
  s.potions = intMap(s.potions, k => POTIONS[k], POTION_CAP);
  const tier = v => Number.isInteger(v) && v >= 1 && v <= TOOL_MAX ? v : 1;
  s.tools = { picareta:tier(s.tools?.picareta), foice:tier(s.tools?.foice) };
  const limit = Date.now() + NODE_MAX_MS; // relógio adiantado/atrasado não trava um nó para sempre
  s.nodes = Object.fromEntries(Object.entries(s.nodes && typeof s.nodes === 'object' ? s.nodes : {}).filter(([k, v]) => /^[a-zA-Z]\w{0,15}$/.test(k) && Number.isFinite(v) && v >= 0 && v <= limit));
  const xp = v => Number.isInteger(v) && v >= 0 ? v : 0;
  s.prof = { coleta:xp(s.prof?.coleta), alquimia:xp(s.prof?.alquimia) };
  s.recipes = [...new Set(Array.isArray(s.recipes) ? s.recipes.filter(id => POTIONS[id]) : [])];
  s.belt = POTIONS[s.belt] ? s.belt : null;
}
