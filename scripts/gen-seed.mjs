// Gera supabase/seed.sql a partir da curadoria (os 49 jogos + admin).
// Rode depois de mudar a lista: node scripts/gen-seed.mjs
import { writeFileSync } from "node:fs";

const ADMIN_EMAIL = "gabriel.fernandeshw@gmail.com";

// id, título, console, ano, youtube_id, [série, ordem], pitch, wiki_title
const GAMES = [
  ["chrono-trigger", "Chrono Trigger", "SNES", 1995, "8USTC91ckaQ", "chrono", 1, "O RPG que quase todo mundo cita como o melhor de todos os tempos.", "Chrono Trigger"],
  ["chrono-cross", "Chrono Cross", "PS1", 1999, "U709nJ_AQ-s", "chrono", 2, "Sucessor ambicioso com uma das trilhas sonoras mais bonitas já compostas.", "Chrono Cross"],
  ["zelda-alttp", "The Legend of Zelda: A Link to the Past", "SNES", 1991, "ZsexNXltd2Y", null, null, "O molde de todo Zelda que veio depois — aventura top-down impecável.", "The Legend of Zelda: A Link to the Past"],
  ["zelda-oot", "The Legend of Zelda: Ocarina of Time", "N64", 1998, "GwKLbjfjpZM", null, null, "Frequentemente eleito o melhor jogo já feito, sem ironia.", "The Legend of Zelda: Ocarina of Time"],
  ["zelda-mm", "The Legend of Zelda: Majora's Mask", "N64", 2000, "AAbKdyUDDfc", null, null, "Ciclo de três dias, tom sombrio e a ideia mais ousada da série.", "The Legend of Zelda: Majora's Mask"],
  ["zelda-la", "The Legend of Zelda: Link's Awakening DX", "GBC", 1998, "oR46QVM9bcQ", null, null, "Zelda portátil surreal, afetivo e inesquecível.", "The Legend of Zelda: Link's Awakening"],
  ["zelda-minish", "The Legend of Zelda: The Minish Cap", "GBA", 2004, "0hTrom_OtfE", null, null, "Link encolhe ao tamanho de um inseto — o Zelda portátil mais charmoso.", "The Legend of Zelda: The Minish Cap"],
  ["zelda-ages", "The Legend of Zelda: Oracle of Ages", "GBC", 2001, "TCWgLBR_N-A", null, null, "Zelda de viagem no tempo, feito pela Capcom, com puzzle pesado.", "The Legend of Zelda: Oracle of Ages and Oracle of Seasons"],
  ["ff6", "Final Fantasy VI", "SNES", 1994, "j_lr12kgGeU", null, null, "Elenco enorme, o vilão mais lembrado da série e uma ópera no meio do jogo.", "Final Fantasy VI"],
  ["ff7", "Final Fantasy VII", "PS1", 1997, "MMOHD0B0BJU", null, null, "O RPG que levou o gênero ao mainstream do mundo inteiro.", "Final Fantasy VII"],
  ["ff8", "Final Fantasy VIII", "PS1", 1999, "h9e7wdCVPcs", null, null, "Jovem, estiloso e polêmico — o FF que dividiu os fãs e marcou época.", "Final Fantasy VIII"],
  ["ff9", "Final Fantasy IX", "PS1", 2000, "iUQMWeFsY8w", null, null, "Volta às raízes de fantasia medieval — o favorito de muito fã raiz.", "Final Fantasy IX"],
  ["fft", "Final Fantasy Tactics", "PS1", 1997, "Q0xm3Oteai8", null, null, "Tático sombrio com roteiro de intriga política digno de romance.", "Final Fantasy Tactics"],
  ["tactics-ogre", "Tactics Ogre: Let Us Cling Together", "PS1", 1997, "ayhks2FuKqY", null, null, "Tático sobre limpeza étnica e escolhas sem volta — a base de Final Fantasy Tactics.", "Tactics Ogre: Let Us Cling Together"],
  ["super-metroid", "Super Metroid", "SNES", 1994, "87jXoj-4C5U", "metroid", 1, "A aula definitiva de level design, atmosfera e exploração.", "Super Metroid"],
  ["metroid-fusion", "Metroid Fusion", "GBA", 2002, "kiq4eOUDI2k", "metroid", 2, "Samus acuada, guiada e caçada — o Metroid mais linear e tenso.", "Metroid Fusion"],
  ["metroid-zm", "Metroid: Zero Mission", "GBA", 2004, "xjMan14CFeE", null, null, "Releitura enxuta e brilhante do Metroid original.", "Metroid: Zero Mission"],
  ["sotn", "Castlevania: Symphony of the Night", "PS1", 1997, "mG6-3Dthsy0", null, null, "Fundou o 'metroidvania' como a gente conhece hoje.", "Castlevania: Symphony of the Night"],
  ["castlevania-aos", "Castlevania: Aria of Sorrow", "GBA", 2003, "ZNCfiBDjUhY", null, null, "Metroidvania portátil no auge — roube a alma de cada inimigo.", "Castlevania: Aria of Sorrow"],
  ["secret-of-mana", "Secret of Mana", "SNES", 1993, "CTrawcuaHUM", null, null, "Action-RPG com co-op local que virou lenda entre amigos.", "Secret of Mana"],
  ["earthbound", "EarthBound", "SNES", 1994, "-knEvpvmlAI", "mother", 1, "Estranho, engraçado e décadas à frente do seu tempo.", "EarthBound"],
  ["mother3", "Mother 3", "GBA", 2006, "sScHQrPJ4FU", "mother", 2, "Sequência de EarthBound: engraçada, e aí de repente devastadora.", "Mother 3"],
  ["terranigma", "Terranigma", "SNES", 1995, "1f_vEnlrqyk", null, null, "Action-RPG cult sobre ressuscitar o mundo, peça por peça.", "Terranigma"],
  ["illusion-of-gaia", "Illusion of Gaia", "SNES", 1994, "o0yB3LJTqNU", null, null, "Aventura sombria e melancólica sobre crescer no meio do apocalipse.", "Illusion of Gaia"],
  ["lufia2", "Lufia II: Rise of the Sinistrals", "SNES", 1995, "WsfZkOIHztU", null, null, "JRPG cheio de puzzles com uma abertura que já entrega o final. Cult absoluto.", "Lufia II: Rise of the Sinistrals"],
  ["mgs1", "Metal Gear Solid", "PS1", 1998, "U3CZK-hO6lM", null, null, "Stealth cinematográfico que redefiniu o que narrativa em game podia ser.", "Metal Gear Solid (video game)"],
  ["re1", "Resident Evil", "PS1", 1996, "UeyBz1mhPQ4", "re", 1, "O jogo que fundou o survival horror e aterrorizou uma geração.", "Resident Evil (1996 video game)"],
  ["re2", "Resident Evil 2", "PS1", 1998, "PcDjo_uKeF4", "re", 2, "O ápice do survival horror clássico, com dois cenários entrelaçados.", "Resident Evil 2 (1998 video game)"],
  ["re3", "Resident Evil 3: Nemesis", "PS1", 1999, "DAB1YPlwiB4", "re", 3, "Raccoon City em chamas e um perseguidor que nunca para.", "Resident Evil 3: Nemesis"],
  ["silent-hill", "Silent Hill", "PS1", 1999, "_5mZKe40zDA", null, null, "Terror psicológico que ainda assombra quem jogou.", "Silent Hill (video game)"],
  ["dino-crisis", "Dino Crisis", "PS1", 1999, "LV2IuPD8TmI", null, null, "Resident Evil com dinossauros, feito pelo mesmo time. Tenso do início ao fim.", "Dino Crisis (video game)"],
  ["parasite-eve", "Parasite Eve", "PS1", 1998, "9FBb4DuEmFw", "pe", 1, "Survival horror com RPG numa Nova York de pesadelo.", "Parasite Eve (video game)"],
  ["parasite-eve-2", "Parasite Eve II", "PS1", 1999, "Ac-eFW3s-nA", "pe", 2, "Menos RPG, mais ação — survival horror puro.", "Parasite Eve II"],
  ["xenogears", "Xenogears", "PS1", 1998, "FT2Q10vNoPE", null, null, "RPG filosófico, denso e profundamente cultuado.", "Xenogears"],
  ["vagrant-story", "Vagrant Story", "PS1", 2000, "lBvFP2SIzhk", null, null, "Ação-RPG sombrio com uma profundidade de sistemas quase absurda.", "Vagrant Story"],
  ["grandia", "Grandia", "PS1", 1997, "YB7JEtniTd0", null, null, "Sistema de batalha ainda copiado hoje; aventura leve e carismática.", "Grandia (video game)"],
  ["legend-dragoon", "The Legend of Dragoon", "PS1", 1999, "utSIYd0vl5I", null, null, "Épico de quatro CDs com batalhas de timing. Cult declarado no Brasil.", "The Legend of Dragoon"],
  ["wild-arms", "Wild Arms", "PS1", 1996, "JvQaqDWoxt4", null, null, "Faroeste com magia e robôs — o primeiro RPG 3D do PlayStation.", "Wild Arms (video game)"],
  ["lunar-sssc", "Lunar: Silver Star Story Complete", "PS1", 1998, "92tSSdoLaks", null, null, "Jornada clássica de herói com cutscenes animadas e nenhuma dificuldade punitiva.", "Lunar: Silver Star Story Complete"],
  ["suikoden1", "Suikoden", "PS1", 1996, "WzLvvv5t0tE", "suikoden", 1, "Início da saga: 108 Estrelas do Destino, um exército e um castelo pra reconstruir.", "Suikoden (video game)"],
  ["suikoden2", "Suikoden II", "PS1", 1998, "rfAJ5a6V7KI", "suikoden", 2, "Guerra, política e um dos melhores vilões dos games.", "Suikoden II"],
  ["tomb-raider", "Tomb Raider", "PS1", 1996, "VkD8x9aItCs", null, null, "Lara Croft, tumbas milenares e puzzles — a aventura que definiu o gênero.", "Tomb Raider (1996 video game)"],
  ["golden-sun", "Golden Sun", "GBA", 2001, "XYFJCXcdhb0", "golden-sun", 1, "RPG portátil com puzzles de Psinergia e visual de impressionar na época.", "Golden Sun (video game)"],
  ["golden-sun-2", "Golden Sun: The Lost Age", "GBA", 2003, "R7UpzDGS7b4", "golden-sun", 2, "A outra metade da história — agora do lado de quem parecia vilão.", "Golden Sun: The Lost Age"],
  ["pokemon-emerald", "Pokémon Emerald", "GBA", 2004, "KInoJimjJzI", null, null, "Para muita gente, a definição de 'modo história' de Pokémon.", "Pokémon Emerald"],
  ["pokemon-crystal", "Pokémon Crystal", "GBC", 2000, "FUkAmzhXOZo", null, null, "A versão definitiva da gen 2 — Johto, Kanto e o Suicune com história própria.", "Pokémon Crystal"],
  ["phantasy-star-4", "Phantasy Star IV", "MD", 1993, "2ieD0rPFbAk", null, null, "O auge do RPG 16-bit e o fecho perfeito de uma saga inteira.", "Phantasy Star IV: The End of the Millennium"],
  ["shining-force-2", "Shining Force II", "MD", 1994, "CwUNky1N4PY", null, null, "Tático acessível e viciante — o melhor lugar pra começar em Shining Force.", "Shining Force II"],
  ["fire-emblem", "Fire Emblem", "GBA", 2003, "ALuRb6UqTKU", null, null, "O tático que apresentou a série ao Ocidente — permadeath e roteiro denso.", "Fire Emblem: The Blazing Blade"],
];

const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);

const rows = GAMES.map(
  ([id, t, c, y, yt, series, order, p, wiki]) =>
    `  (${q(id)}, ${q(t)}, ${q(c)}, ${y}, ${q(yt)}, ${q(p)}, ${q(series)}, ${order == null ? "null" : order}, ${q(wiki)})`
).join(",\n");

const sql = `-- GERADO por scripts/gen-seed.mjs — não editar à mão.
-- Idempotente: pode rodar de novo (upsert nos jogos, admin garantido).

insert into public.allowlist (email, role) values (${q(ADMIN_EMAIL)}, 'admin')
  on conflict (email) do update set role = 'admin';

insert into public.games (id, title, console, year, youtube_id, pitch, series, series_order, wiki_title) values
${rows}
on conflict (id) do update set
  title = excluded.title, console = excluded.console, year = excluded.year,
  youtube_id = excluded.youtube_id, pitch = excluded.pitch,
  series = excluded.series, series_order = excluded.series_order,
  wiki_title = excluded.wiki_title;
`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`seed.sql gerado — ${GAMES.length} jogos + admin ${ADMIN_EMAIL}`);
