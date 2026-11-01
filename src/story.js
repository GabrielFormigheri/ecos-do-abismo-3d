// História, NPCs, missões de NPC, primeiros passos, páginas de diário, dicas e Guia do Aventureiro.
// Regras puras (sem Three.js nem DOM), testadas em tests/story.test.js. Os textos ficam aqui também.
import { DUNGEONS, BOSSES, MATERIALS, POTIONS, POTION_CAP, addMaterials, dayKey } from './core.js';

// ---------- o mundo ----------
// Aurélia tinha o Coração do Eco, um cristal que devolvia a voz das pessoas como magia. O arquimago Vael quis
// um eco só dele, que respondesse sem ninguém falar, e rachou o Coração: abriu-se o Abismo, que devolve tudo torto.
// Oito lascas caíram em oito lugares (as dungeons) e cada uma tomou um dono (os chefes). A praça é o último
// lugar onde as vozes ainda soam certas. Elara, a cronista real, desceu atrás das lascas e deixou o diário pelo caminho.
export const LORE = [
  'Aurélia tinha um tesouro: o Coração do Eco, um cristal que devolvia a voz das pessoas como magia. Canção virava chuva, risada virava cura.',
  'O arquimago Vael quis um eco só dele, que respondesse sem ninguém falar. Forçou o cristal e ele rachou. Da rachadura nasceu o Abismo.',
  'Tudo que cai no Abismo volta como eco torto. Os monstros lá embaixo são ecos de coisas que um dia viveram.',
  'Oito lascas do Coração caíram em oito lugares. Cada lasca escolheu um dono: são os chefes das dungeons.',
  'A praça é o último lugar onde as vozes ainda soam certas. Por isso os aventureiros se juntam aqui antes de descer.',
];
// Lugar de cada chefe na história (mostrado no bestiário e no guia).
export const BOSS_LORE = {
  reiSlime:'O bichinho do jardineiro real. Engoliu a primeira lasca e se coroou com uma raiz.',
  cavaleiro:'Sir Aldren, capitão da guarda. Jurou proteger o jardim "até depois da morte". O Abismo levou a sério.',
  colosso:'Golem de carvão feito pelo clã de Brakk. A lasca no peito o convenceu de que é dono da forja.',
  arauto:'Vael, o arquimago que rachou o Coração. Ainda fala sozinho, esperando o eco responder.',
  ceifador:'O coveiro de Aurélia. Trocou a própria morte por uma foice que nunca para.',
  cristalino:'A maior lasca de todas. Cresceu nas grutas onde o eco nasce e repete tudo o que ouve.',
  senhorBrasas:'Torvak, irmão de Brakk. Desceu atrás do "fogo que não apaga". O fogo achou ele primeiro.',
  rainhaGelo:'A Rainha Isolde. Congelou a própria capital para frear o Abismo e ficou presa no gelo junto.',
};

// ---------- NPCs e afinidade ----------
export const NPCS = {
  brakk:  { name:'Brakk, o Ferreiro',    short:'Brakk',  station:'ferreiro' },
  mirela: { name:'Mirela, a Alquimista', short:'Mirela', station:'alquimista' },
  sylas:  { name:'Sylas, o Caçador',     short:'Sylas',  station:'bestiario' },
};
export const NPC_OF_PANEL = Object.fromEntries(Object.entries(NPCS).map(([id, n]) => [n.station, id]));
export const AFFINITY = [0, 15, 40, 80, 140];
export const AFFINITY_LABEL = ['Estranho', 'Conhecido', 'Amigo', 'Confidente', 'Leal'];
export const TALK_AFF = 3;
// Ganho de afinidade por evento: conversar (1x por dia), fabricar, estrelas do bestiário, missões.
export const AFF_GAIN = { forge:['brakk', 2], reroll:['brakk', 2], tool:['brakk', 3], brew:['mirela', 2], star:['sylas', 4], boss:['sylas', 1] };
export const affinityLevel = (save, npc) => AFFINITY.filter(n => (save.story.aff[npc] ?? 0) >= n).length - 1;
// Pontos que faltam para o próximo nível (null no máximo).
export const affinityNext = (save, npc) => { const l = affinityLevel(save, npc); return l + 1 < AFFINITY.length ? AFFINITY[l + 1] - save.story.aff[npc] : null; };
function addAff(save, npc, n) {
  const before = affinityLevel(save, npc);
  save.story.aff[npc] = Math.min(AFF_MAX, save.story.aff[npc] + n);
  const after = affinityLevel(save, npc);
  return after > before ? { npc, lvl:after } : null;
}
const AFF_MAX = 9999;

// Falas da história: uma por nível de afinidade; page = só depois de ler aquela página do diário.
export const LINES = {
  brakk:[
    { lvl:0, text:'Brakk Cinzaforja, ao seu dispor. Se tem metal, eu bato. Se tem dúvida, eu bato também.' },
    { lvl:1, text:'Meu clã fez a Forja de Cinzas lá embaixo. Até o Colosso fomos nós. Pra carregar carvão! Agora olha ele.' },
    { lvl:2, text:'Eu tinha um irmão, Torvak. Melhor ferreiro que eu, e eu odeio admitir. Desceu atrás do "fogo que não apaga".' },
    { lvl:3, text:'Toda lâmina que eu afio, penso: talvez essa chegue no Rio de Magma. Talvez traga notícia dele.' },
    { lvl:4, text:'Se um dia achar o Torvak, não precisa lutar pra trazer ele. Só diz que eu continuo martelando. Ele entende.' },
    { lvl:2, page:'7-3', text:'"A culpa não é dele"... O Torvak escreveu isso? Hm. Me dá um minuto, aventureiro. A brasa entrou no olho.' },
  ],
  mirela:[
    { lvl:0, text:'Mirela: bruxa, alquimista e ótima companhia. Eu mexo o caldeirão e o caldeirão me mexe de volta.' },
    { lvl:1, text:'Fui herbalista da Rainha Isolde. Chá pra ela dormir, pomada pros cavaleiros que caíam do cavalo. Caíam muito.' },
    { lvl:2, text:'Na noite do gelo, a rainha me mandou fugir com as sementes do jardim real. Este Vale nasceu delas.' },
    { lvl:3, text:'As ervas do Vale afinam os ecos: o que o Abismo entorta, a poção endireita. Um pouquinho por vez.' },
    { lvl:4, text:'Estou criando o Elixir do Degelo. Se der certo, a rainha acorda. Se der errado, ela acorda brava. Vale o risco.' },
    { lvl:2, page:'8-2', text:'Então ela está no trono, sozinha esse tempo todo... Vou mexer esse caldeirão até minhas mãos doerem.' },
  ],
  sylas:[
    { lvl:0, text:'Sylas. Caçador. Falo pouco, anoto muito.' },
    { lvl:1, text:'Todo monstro lá embaixo é eco de algo que viveu. O slime era bicho de estimação. O esqueleto, um guarda.' },
    { lvl:2, text:'Minha vila ficava no muro sul do cemitério. Uma noite a terra engoliu tudo. Eu tinha um arco maior que eu e muita sorte.' },
    { lvl:3, text:'Por isso o bestiário. Ninguém some de vez enquanto alguém lembra o nome.' },
    { lvl:4, text:'Você caça bem. Quando acabar, volte e me conte. Eu escrevo. É assim que se vence o Abismo: lembrando.' },
    { lvl:2, page:'5-3', text:'A Elara escreveu sobre mim? Hm. O arco continua grande demais. Mas eu cresci um pouco.' },
  ],
};
// Falas soltas quando não há nada novo para contar.
export const SMALL_TALK = {
  brakk:['Ô, aventureiro! Essa lâmina tá pedindo fogo.', 'Do +3 pra cima a forja fica brava... às vezes recusa. Mas nunca estraga nada.', 'Cada martelada é +10% de força. Quer arriscar?'],
  mirela:['Ervas do Vale, cristais das grutas... tudo vira poção na mão certa.', 'Uma golada na hora certa salva a run, querido.', 'Achou ingrediente novo? Traz que eu descubro receita nova.'],
  sylas:['Aviso no chão é presente. Aceite.', 'Elite com aura? Mate primeiro.', 'Conhece a presa antes de caçar.'],
};
const unlockedLines = (save, npc) => LINES[npc].filter(l => affinityLevel(save, npc) >= l.lvl && (!l.page || save.story.pages.includes(l.page)));
// Próxima fala da história ainda não ouvida (marca como lida) ou null.
export function nextLine(save, npc) {
  const l = unlockedLines(save, npc).find(x => !save.story.heard.includes(lineKey(npc, x)));
  if (!l) return null;
  save.story.heard.push(lineKey(npc, l)); return l.text;
}
const lineKey = (npc, l) => `${npc}:${LINES[npc].indexOf(l)}`;
export const newLines = (save, npc) => unlockedLines(save, npc).filter(x => !save.story.heard.includes(lineKey(npc, x))).length;
export const heardLines = (save, npc) => LINES[npc].filter(l => save.story.heard.includes(lineKey(npc, l))).map(l => l.text);

// ---------- missões de NPC (em sequência, uma ativa por NPC) ----------
// goal.ev: 'mat' (id do material), 'forge', 'brew', 'kill' (id do mob, opcional), 'win' (nível da dungeon).
export const QUESTS = {
  brakk:[
    { title:'Ferro para a forja', text:'Me traz 5 minérios de ferro do Vale. Picareta você já tem.', goal:{ ev:'mat', id:'ferro', n:5 }, req:0, reward:{ gems:100, aff:15 } },
    { title:'Martelo quente', text:'Aprimore equipamentos 3 vezes. Quero ouvir a bigorna cantar.', goal:{ ev:'forge', n:3 }, req:1, reward:{ gems:150, mats:{ ferro:3 }, aff:15 } },
    { title:'Notícias do rio', text:'Vença o Rio de Magma (Nível 7). Se o Torvak estiver lá... me conta.', goal:{ ev:'win', id:7, n:1 }, req:2, reward:{ gems:400, mats:{ essencia:2 }, aff:25 } },
  ],
  mirela:[
    { title:'Ervas frescas', text:'Colhe 6 Erva-cura pra mim, querido. As moitas do Vale estão cheias.', goal:{ ev:'mat', id:'erva', n:6 }, req:0, reward:{ potions:{ curaP:2 }, aff:15 } },
    { title:'Mão no caldeirão', text:'Prepare 4 poções. Alquimia se aprende mexendo.', goal:{ ev:'brew', n:4 }, req:1, reward:{ gems:150, mats:{ raiz:3 }, aff:15 } },
    { title:'Flor do inverno', text:'Traga 3 Flores de Gelo das Ruínas Congeladas. São para o Elixir do Degelo.', goal:{ ev:'mat', id:'florGelo', n:3 }, req:2, reward:{ gems:500, aff:25 } },
  ],
  sylas:[
    { title:'Primeira caçada', text:'Derrote 30 inimigos em qualquer dungeon. Depois me conte como foi.', goal:{ ev:'kill', n:30 }, req:0, reward:{ gems:100, aff:15 } },
    { title:'Ossos inquietos', text:'Derrote 40 esqueletos. Eles eram guardas. Merecem descanso.', goal:{ ev:'kill', id:'esqueleto', n:40 }, req:1, reward:{ gems:200, aff:15 } },
    { title:'O coveiro', text:'Vença o Cemitério Sombrio (Nível 5). Minha vila ficava lá.', goal:{ ev:'win', id:5, n:1 }, req:2, reward:{ gems:400, aff:25 } },
  ],
};
// Estado da missão atual do NPC: 'done' (acabou a cadeia), 'locked' (falta afinidade), 'offer', 'active', 'ready'.
export function questState(save, npc) {
  const st = save.story.quests[npc], q = QUESTS[npc][st.i];
  if (!q) return { state:'done' };
  if (!st.on) return { state:affinityLevel(save, npc) >= q.req ? 'offer' : 'locked', q };
  return { state:st.p >= q.goal.n ? 'ready' : 'active', q, p:st.p };
}
export function acceptQuest(save, npc) {
  if (questState(save, npc).state !== 'offer') return false;
  save.story.quests[npc].on = true; save.story.quests[npc].p = 0; return true;
}
function giveReward(save, r) {
  if (r.gems) save.gems += r.gems;
  if (r.mats) addMaterials(save, r.mats);
  for (const [id, n] of Object.entries(r.potions ?? {})) { save.potions[id] = Math.min(POTION_CAP, (save.potions[id] ?? 0) + n); if (!save.belt) save.belt = id; }
}
export const rewardText = r => [r.gems && `◆ ${r.gems}`, ...Object.entries(r.mats ?? {}).map(([id, n]) => `${n} ${MATERIALS[id].label}`),
  ...Object.entries(r.potions ?? {}).map(([id, n]) => `${n} ${POTIONS[id].label}`), r.aff && `+${r.aff} afinidade`].filter(Boolean).join(' · ');
// Entrega a missão pronta: dá o prêmio e libera a próxima. Devolve { q, up } ou null.
export function claimQuest(save, npc) {
  const s = questState(save, npc);
  if (s.state !== 'ready') return null;
  giveReward(save, s.q.reward);
  const st = save.story.quests[npc]; st.i++; st.p = 0; st.on = false;
  return { q:s.q, up:addAff(save, npc, s.q.reward.aff ?? 0) };
}
const matches = (goal, ev, id) => goal.ev === ev && (goal.id === undefined || goal.id === id);

// ---------- primeiros passos (guiado, um passo por vez; mark = onde a seta aponta) ----------
export const TUTORIAL = [
  { text:'Fale com Brakk, o ferreiro', mark:'ferreiro', goal:{ ev:'talk', id:'brakk', n:1 }, reward:{ gems:50 } },
  { text:'Entre numa dungeon (comece pela Cripta Esmeralda)', mark:'portal', goal:{ ev:'enter', n:1 }, reward:{ gems:80 } },
  { text:'Colha 3 Erva-cura no Vale das Ervas', mark:'vale', goal:{ ev:'mat', id:'erva', n:3 }, reward:{ mats:{ erva:2 } } },
  { text:'Prepare uma poção com Mirela', mark:'alquimista', goal:{ ev:'brew', n:1 }, reward:{ potions:{ curaP:1 } } },
  { text:'Aprimore uma arma com Brakk', mark:'ferreiro', goal:{ ev:'forge', id:'arma', n:1 }, reward:{ gems:120 } },
  { text:'Conheça Sylas, o caçador', mark:'bestiario', goal:{ ev:'talk', id:'sylas', n:1 }, reward:{ gems:150 } },
];
export const tutorialStep = save => TUTORIAL[save.story.tut.i] ?? null;

// ---------- eventos do jogo ----------
// Um ponto só para tudo que a história escuta. Devolve o que aconteceu para a tela avisar.
export function storyEvent(save, ev, { id, n = 1, now = new Date() } = {}) {
  const out = { ready:[], ups:[], tut:null };
  const S = save.story;
  if (ev === 'talk' && NPCS[id] && S.talk[id] !== dayKey(now)) { S.talk[id] = dayKey(now); const up = addAff(save, id, TALK_AFF); if (up) out.ups.push(up); }
  const gain = AFF_GAIN[ev];
  if (gain) { const up = addAff(save, gain[0], gain[1] * n); if (up) out.ups.push(up); }
  for (const npc of Object.keys(NPCS)) {
    const s = questState(save, npc);
    if (s.state === 'active' && matches(s.q.goal, ev, id)) { S.quests[npc].p = Math.min(s.q.goal.n, s.p + n); if (S.quests[npc].p >= s.q.goal.n) out.ready.push({ npc, q:s.q }); }
  }
  const t = tutorialStep(save);
  if (t && matches(t.goal, ev, id)) {
    S.tut.p += n;
    if (S.tut.p >= t.goal.n) { giveReward(save, t.reward); S.tut.i++; S.tut.p = 0; out.tut = { done:t, next:tutorialStep(save) }; }
  }
  return out;
}

// ---------- páginas do diário de Elara (3 por dungeon, em ordem) ----------
export const PAGES = [
  ['Cripta Esmeralda', [
    'Dia 1. Desci pela cripta do jardim real. O musgo brilha verde e os slimes... cantam? Não: ecoam. Repetem a última coisa que ouviram.',
    'O bichinho do jardineiro, aquele slime gorducho, está enorme. Usa uma coroa de raiz. Acho que engoliu algo que brilha.',
    'Era uma lasca do Coração do Eco. Então é verdade: o Coração rachou em pedaços, e cada pedaço arrumou um dono. Vou atrás de todos.']],
  ['Jardim do Crepúsculo', [
    'O jardim onde a corte dançava agora é sempre fim de tarde. As flores mordem. Literalmente. Perdi uma luva.',
    'Sir Aldren continua de guarda no portão. Sem carne, só osso e juramento. Jurou proteger este jardim "até depois da morte".',
    'Ele me reconheceu, eu acho. Baixou a espada por um segundo. Depois o eco falou mais alto. Que o Abismo te solte, capitão.']],
  ['Forja de Cinzas', [
    'A grande forja do clã Cinzaforja. As armaduras vazias ainda batem ferro sozinhas, no ritmo de um martelo que ninguém segura.',
    'O Colosso foi feito para carregar carvão. Agora carrega uma lasca no peito e acha que é o dono do lugar.',
    'Achei o nome "Torvak" riscado na bigorna mais funda, com uma seta para baixo. Para o magma. Que ideia ruim, Torvak.']],
  ['Cidadela do Vazio', [
    'A torre do arquimago Vael flutua em pedaços. Andar aqui é pular de ilha em ilha sobre o nada. Não olhe para baixo. Olhei.',
    'As anotações de Vael: ele queria um eco que respondesse sem ninguém falar. Uma voz só dele. Foi ele que rachou o Coração.',
    'Vael virou o Arauto do Vazio. Ainda fala sozinho, esperando resposta. O Abismo responde, mas não do jeito que ele queria.']],
  ['Cemitério Sombrio', [
    'Os mortos daqui não descansam: levantam, caem, levantam de novo. Dá para ver que estão cansados.',
    'O coveiro de Aurélia fez um trato com o Abismo para nunca morrer. Ganhou uma foice que nunca para de cortar.',
    'Havia uma vila no muro sul. Sumiu inteira. Dizem que um menino escapou correndo, com um arco maior que ele.']],
  ['Grutas Ecoantes', [
    'Aqui tudo repete. Falei "olá" e ouvi "olá" por uma hora. Os morcegos caçam pelos ecos.',
    'As grutas são onde o eco nasce. Por isso a maior lasca cresceu aqui e virou um guardião de cristal.',
    'Para refazer o Coração, precisa de todas as lascas. A maior está aqui. Lembrete para mim: trazer um martelo maior.']],
  ['Rio de Magma', [
    'Calor demais para escrever direito. Em alguns lugares o rio corre para cima. O Abismo não liga para regras.',
    'Encontrei Torvak. Ou o que ele virou: o Senhor das Brasas. Ele achou o "fogo que não apaga". O fogo achou ele primeiro.',
    'Antes de virar chama, ele gravou na pedra: "Diz pro Brakk que a culpa não é dele." Se eu sair daqui, eu digo.']],
  ['Ruínas Congeladas', [
    'A capital de Aurélia, congelada no meio de um dia comum. Um padeiro ainda segura o pão, parado no gelo.',
    'A Rainha Isolde congelou a própria cidade para o Abismo não subir. Funcionou. Mas ela ficou presa junto, no trono de gelo.',
    'Última página. Se você está lendo isto, o Abismo te ouviu também. Junte as lascas. Fale alto. Ecos obedecem a quem responde.']],
].flatMap(([place, texts], d) => texts.map((text, k) => ({ id:`${d + 1}-${k + 1}`, level:d + 1, place, n:k + 1, text })));
export const PAGE_CHANCE = 0.7, PAGE_PITY = 2, PAGE_SET_GEMS = 150;
export const PAGE_TITLE = 'Cronista do Abismo';
// Ao vencer: a próxima página que falta daquela dungeon cai com 70%; depois de 2 vitórias secas cai com certeza.
export function rollPage(save, level, rand = Math.random) {
  const S = save.story, page = PAGES.find(p => p.level === level && !S.pages.includes(p.id));
  if (!page) return null;
  if (S.pagePity < PAGE_PITY && rand() >= PAGE_CHANCE) { S.pagePity++; return null; }
  S.pagePity = 0; S.pages.push(page.id);
  const setDone = PAGES.filter(p => p.level === level).every(p => S.pages.includes(p.id));
  if (setDone) save.gems += PAGE_SET_GEMS;
  const allDone = S.pages.length === PAGES.length;
  if (allDone) S.title = PAGE_TITLE;
  return { page, setDone, allDone };
}

// ---------- dicas de primeira vez ----------
export const TIPS = {
  hub:['Bem-vindo à praça!', 'Ande com WASD ou o analógico. Chegue perto de alguém e aperte F (ou toque no botão) para conversar. A seta dourada mostra o próximo passo.'],
  dungeon:['Sua primeira dungeon', 'Mate o chefe antes do tempo acabar. Círculos e faixas no chão avisam onde o ataque vai cair: saia deles!'],
  dodge:['Esquiva', 'Shift (ou o botão de esquiva) dá um pulinho rápido e você fica invulnerável por um instante.'],
  lowhp:['Vida baixa!', 'Beba uma poção: tecla 1 ou H, ou o botão de poção. Poções são feitas com Mirela, no Vale das Ervas.'],
  gather:['Coletando', 'Fique parado até o anel encher. Ferramentas melhores (no Brakk) coletam recursos mais raros e mais rápido.'],
  potion:['Primeira poção!', 'Ela vai para o cinto. Na dungeon, use a tecla 1 ou H (ou o botão). Há recarga e um limite por dungeon.'],
  rare:['Item raro!', 'Itens raros ou melhores têm afixos (bônus extras). Abra a Mochila para comparar e equipar.'],
  forge:['A forja', 'Brakk aprimora até +5 (+10% de status cada). Também re-rola afixos e melhora suas ferramentas.'],
  elite:['Elite!', 'Inimigos com aura no chão são elites: mais fortes, com um poder especial, e soltam itens melhores.'],
  boss:['Chefe!', 'Chefes mudam de golpes na fúria (abaixo de metade da vida). Todo golpe tem aviso e rota de fuga.'],
  page:['Página do diário!', 'Você achou uma página perdida de Elara. Leia no Livro (botão 📖). Junte todas para um título especial.'],
  death:['Não desanime', 'Cada tentativa dá XP. Aprimore armas no Brakk, leve poções e tente uma dungeon mais fácil se o poder estiver baixo.'],
  vale:['Vale das Ervas', 'Veios de minério (picareta) e moitas (foice) renascem com o tempo. Mirela e o caldeirão ficam no fundo do vale.'],
  treino:['Campo de Treino', 'Bata nos bonecos para ver dano, crítico e DPS. Bom para testar armas e habilidades.'],
  'gate:lever':['Alavancas', 'Esta sala abre com alavancas: chegue perto de cada uma e aperte F.'],
  'gate:orb':['Orbe', 'Pegue o orbe e leve até o pedestal. Se levar dano, ele cai no chão.'],
  'gate:survive':['Sobreviva', 'A barreira cai sozinha depois de um tempo. Só não morra!'],
  'gate:key':['Chave do elite', 'O elite com aura carrega a chave da sala. Derrote-o.'],
  'gate:runes':['Runas', 'Pise em todas as runas apagadas da sala para abrir.'],
  'gate:mini':['Guardião', 'Um mini-chefe guarda esta sala. Ele solta um baú ao cair.'],
};
// Devolve [título, texto] se a dica é nova (e marca como vista), senão null.
export function takeTip(save, id) {
  if (!TIPS[id] || save.story.tips.includes(id)) return null;
  save.story.tips.push(id); return TIPS[id];
}

// ---------- Guia do Aventureiro ----------
// art: desenho pequeno feito em ui.js. Textos curtos: o guia é para consultar, não para ler de uma vez.
export const GUIDE = [
  { id:'historia', icon:'livro', title:'O Abismo', body:LORE },
  { id:'combate', icon:'espada', title:'Lutar e desviar', art:'dodge', body:[
    'PC: WASD anda, mouse mira, clique ou espaço ataca. Celular: analógico à esquerda, botões à direita.',
    'Todo ataque inimigo avisa antes: círculo, faixa ou cone no chão. Quando aparecer, saia dele.',
    'Shift (ou o botão de esquiva) dá um pulo rápido e invulnerável. Também atravessa buracos.'] },
  { id:'skills', icon:'skill', title:'Habilidades', body:[
    'Você leva 3 habilidades (Q, E, R ou os botões). Elas caem nas dungeons e são da sua classe.',
    'Habilidade de nível maior bate mais forte. Equipe e troque na Mochila.'] },
  { id:'equip', icon:'armadura', title:'Equipamento e raridade', art:'rarity', body:[
    'Arma, armadura e amuleto somam ataque e vida. Seu Poder é a soma de tudo.',
    'Raridades: Comum, Raro, Épico, Lendário e Mítico. Quanto mais rara, mais forte e com mais afixos.',
    'Arma mítica tem um efeito especial a cada poucos ataques.'] },
  { id:'afixos', icon:'raro', title:'Afixos', body:[
    'Afixos são bônus extras: crítico, roubo de vida, velocidade, sorte e mais. Dão nome ao item ("Letal ... do Vampiro").',
    'A barra de qualidade mostra se o valor saiu baixo ou perto do máximo.'] },
  { id:'forja', icon:'martelo', title:'Forja e re-rolar', body:[
    'Brakk aprimora itens até +5, +10% de status a cada nível. Do +3 em diante pode falhar, mas o item nunca piora.',
    'Re-rolar troca um afixo por outro sorteado. Custa gemas e materiais.'] },
  { id:'coleta', icon:'minerio', title:'Coleta e ferramentas', body:[
    'No Vale das Ervas há veios (picareta) e moitas (foice). Fique parado até o anel encher.',
    'Ferramentas melhores, feitas no Brakk, coletam recursos mais raros. Materiais raros caem nas dungeons 6 a 8 e nos chefes.'] },
  { id:'pocoes', icon:'pocao', title:'Poções e receitas', body:[
    'Mirela prepara poções de cura e tônicos de 2 minutos. Receitas novas aparecem com o nível de Alquimia e ingredientes novos.',
    'Escolha a poção do cinto e beba com 1 ou H. Há recarga e limite de 4 por dungeon.'] },
  { id:'bestiario', icon:'chefe', title:'Bestiário e charms', body:[
    'Sylas anota cada criatura que você derrota. A cada 25, 100 e 250 abates ganha uma estrela.',
    'Cada estrela vale 10 pontos de charm: bônus permanentes como mais vida ou mais crítico.'] },
  { id:'diario', icon:'missao', title:'Missões do dia', body:[
    'Três missões novas por dia, com gemas de prêmio. O baú diário da praça dá 3 itens grátis.',
    'NPCs também dão missões próprias: fale com eles para aceitar.'] },
  { id:'calendario', icon:'calendario', title:'Calendário', body:[
    'Entre todo dia para manter a sequência. O dia 7 dá itens épicos ou melhores; a cada 30 dias, um mítico.',
    'Perder um dia volta ao dia 1.'] },
  { id:'dungeons', icon:'portal', title:'Dungeons e portões', body:[
    'Oito dungeons, cada uma com chefe, criatura e regra própria. Vença o chefe antes do tempo acabar.',
    'Cada sala abre de um jeito: matar todos, alavancas, orbe, sobreviver, chave do elite, runas ou guardião.',
    'Procure paredes rachadas: becos secretos guardam baús.'] },
];

// ---------- save ----------
// Campos da história no save: qualquer valor estranho vira o padrão.
const ints = (v, max) => Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0;
const DAY = /^\d{4}-\d\d-\d\d$/;
export function cleanStory(save) {
  const o = save.story && typeof save.story === 'object' ? save.story : {};
  const pageIds = new Set(PAGES.map(p => p.id));
  const list = (a, ok) => [...new Set(Array.isArray(a) ? a.filter(x => typeof x === 'string' && ok(x)) : [])];
  save.story = {
    aff:Object.fromEntries(Object.keys(NPCS).map(n => [n, ints(o.aff?.[n], AFF_MAX)])),
    talk:Object.fromEntries(Object.keys(NPCS).map(n => [n, typeof o.talk?.[n] === 'string' && DAY.test(o.talk[n]) ? o.talk[n] : ''])),
    heard:list(o.heard, k => { const [npc, i] = k.split(':'); return !!LINES[npc]?.[Number(i)] && String(Number(i)) === i; }),
    quests:Object.fromEntries(Object.keys(NPCS).map(n => {
      const q = o.quests?.[n], i = ints(q?.i, QUESTS[n].length), goal = QUESTS[n][i]?.goal;
      return [n, { i, p:goal ? ints(q?.p, goal.n) : 0, on:!!goal && q?.on === true }];
    })),
    tut:(() => { const i = ints(o.tut?.i, TUTORIAL.length), goal = TUTORIAL[i]?.goal; return { i, p:goal ? ints(o.tut?.p, goal.n - 1) : 0 }; })(),
    pages:list(o.pages, id => pageIds.has(id)),
    pagePity:ints(o.pagePity, PAGE_PITY),
    tips:list(o.tips, id => !!TIPS[id]),
    title:o.title === PAGE_TITLE ? PAGE_TITLE : null,
  };
  if (save.story.pages.length === PAGES.length) save.story.title = PAGE_TITLE;
  return save;
}
// Chefes já citados em LORE/BOSS_LORE precisam existir (pego nos testes).
export const loreBosses = () => Object.keys(BOSS_LORE).every(b => BOSSES[b]) && DUNGEONS.every(d => BOSS_LORE[d.boss]);
