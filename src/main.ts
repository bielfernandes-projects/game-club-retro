import "./styles.css";
import type { Game, Round, Session, StoreItem } from "./types";
import { currentSession, sendMagicLink, signOut, updateDisplayName, onAuthChange } from "./auth";
import { listGames } from "./data/games";
import { listRounds, createRound, closeRound, archiveRound } from "./data/rounds";
import { reviewAverages, listReviews, upsertReview, type ReviewWithAuthor } from "./data/reviews";
import { redeemInvite } from "./data/members";
import {
  listSuggestions, createSuggestion, deleteSuggestion, type SuggestionWithAuthor,
} from "./data/suggestions";
import { listStoreItems } from "./data/store";
import { eligibleGames, drawGame } from "./data/draw";
import { esc, badgesHtml, gameMediaHtml, catalogHtml, monthGameHtml, starsHtml, storeSectionHtml, storeCtaHtml, searchNorm } from "./components";
import { ytEmbed } from "./emu";
import { fireConfetti } from "./confetti";
import { supabase } from "./supabase";
import { renderAdmin } from "./admin";

const app = document.getElementById("app") as HTMLElement;
const modalRoot = document.getElementById("modal-root") as HTMLElement;
const confetti = document.getElementById("confetti") as HTMLCanvasElement;

// ---------- estado ----------
let session: Session | null = null;
let games: Game[] = [];
let rounds: Round[] = [];
let averages = new Map<string, { avg: number; n: number }>();
let suggestions: SuggestionWithAuthor[] = [];
let storeItems: StoreItem[] = [];
let candidate: Game | null = null;
let busy = false;
let adminBox: HTMLElement | null = null;

const activeRound = () => rounds.find((r) => r.status !== "arquivada") ?? null;
const playedIds = () => new Set(rounds.map((r) => r.game_id));
const archivedIds = () => new Set(rounds.filter((r) => r.status === "arquivada").map((r) => r.game_id));
const gameById = (id: string) => games.find((g) => g.id === id);
const isAdmin = () => session?.role === "admin";
const isMember = () => session?.role != null;

async function loadState() {
  session = await currentSession();
  const [g, r, avg, sug, store] = await Promise.all([
    listGames(), // homepage: só jogos ativos, inclusive pro admin
    listRounds(),
    reviewAverages(),
    listSuggestions().catch(() => [] as SuggestionWithAuthor[]),
    listStoreItems().catch(() => [] as StoreItem[]),
  ]);
  games = g;
  rounds = r;
  averages = avg;
  suggestions = sug;
  storeItems = store;
}

// ======================================================================
// Render
// ======================================================================
async function render() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [route, query] = raw.split("?");
  const params = new URLSearchParams(query || "");
  if (route === "entrar") return app.replaceChildren(loginView(params.get("code")));
  if (route === "perfil") return app.replaceChildren(profileView());
  if (route === "loja") return app.replaceChildren(lojaView());
  if (route === "admin") {
    if (!isAdmin()) {
      location.hash = "#/";
      return;
    }
    if (!adminBox || !adminBox.isConnected) {
      app.replaceChildren(topbar());
      adminBox = document.createElement("div");
      app.appendChild(adminBox);
    }
    // onChange redesenha só o painel admin e mantém a rolagem — nada de refresh() global.
    const onChange = async () => {
      const y = window.scrollY;
      await loadState();
      await renderAdmin(adminBox!, onChange);
      window.scrollTo(0, y);
    };
    await loadState();
    return renderAdmin(adminBox, onChange);
  }
  app.replaceChildren(homeView());
  wireHome();
}

function topbar(): HTMLElement {
  const el = document.createElement("div");
  el.className = "topbar";
  const links: string[] = [`<a href="#/">sorteador</a>`];
  if (isAdmin()) links.push(`<a href="#/admin">admin</a>`);
  let who: string;
  if (session) {
    who = `<span class="chip${isAdmin() ? " admin" : ""}">${esc(session.displayName)}${isAdmin() ? " · admin" : ""}</span>
      <a href="#/perfil">perfil</a> <button class="linkbtn" id="signout">sair</button>`;
  } else {
    who = `<a href="#/entrar">entrar</a>`;
  }
  el.innerHTML = `<span>${links.join(" · ")}</span><span class="who">${who}</span>`;
  el.querySelector("#signout")?.addEventListener("click", async () => {
    await signOut();
    location.hash = "#/";
  });
  return el;
}

function homeView(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.appendChild(topbar());

  const header = document.createElement("header");
  header.innerHTML = `
    <div class="kicker">GAME CLUB RETRÔ</div>
    <h1>Sorteador do Mês</h1>
    <p class="sub">Um clássico incontestável por mês. O sorteio decide.</p>`;
  wrap.appendChild(header);

  const stage = document.createElement("section");
  stage.className = "stage";
  stage.id = "stage";
  wrap.appendChild(stage);

  renderStage(stage);
  return wrap;
}

function renderStage(stage: HTMLElement) {
  const round = activeRound();
  const parts: string[] = [];

  // --- área principal ---
  if (isAdmin() && !round) {
    parts.push(adminDrawHtml());
  } else if (round) {
    const g = gameById(round.game_id);
    parts.push(`<div class="cabinet"><div class="screen"><div class="result">
      ${g ? monthGameHtml(g, round) : "<div class='idle-line'>jogo não encontrado</div>"}
    </div></div></div>`);
    if (isAdmin()) parts.push(adminRoundControlsHtml(round));
  } else {
    parts.push(`<div class="cabinet"><div class="screen">
      <div class="standby">
        <span class="standby-dot"></span>
        <div class="idle-line">AINDA NÃO TEM JOGO DO MÊS</div>
        <div class="standby-sub">aguardando o próximo sorteio</div>
      </div>
    </div></div>`);
    if (!session)
      parts.push(`<p class="notice">Só o admin sorteia. <a href="#/entrar">Entre</a> se você é do clube pra avaliar quando o mês fechar.</p>`);
  }

  // --- avaliações ---
  if (round && round.status === "avaliando") {
    parts.push(`<div id="review-box" class="review-box"></div>`);
  }

  // --- catálogo ---
  parts.push(catalogHtml(games, playedIds(), archivedIds(), averages));

  // --- indique seu jogo ---
  parts.push(suggestionsSectionHtml());

  // --- loja (botão piscante → #/loja) ---
  parts.push(storeCtaHtml(storeItems));

  parts.push(`<footer><p class="rules">${games.filter((g) => g.active).length} clássicos na curadoria · ${playedIds().size} já jogados</p></footer>`);

  stage.innerHTML = parts.join("");

  if (round && round.status === "avaliando") {
    void renderReviewBox(round, stage);
  }
  wireSuggestions(stage);
  wireCatalogSearch(stage);
}

/** Filtro por nome no catálogo da home. */
function wireCatalogSearch(stage: HTMLElement) {
  const input = stage.querySelector<HTMLInputElement>(".cat-search");
  const list = stage.querySelector<HTMLElement>(".catalog-list");
  const empty = stage.querySelector<HTMLElement>(".cat-empty");
  if (!input || !list) return;
  input.addEventListener("input", () => {
    const q = searchNorm(input.value.trim());
    let shown = 0;
    list.querySelectorAll<HTMLElement>("li").forEach((li) => {
      const name = searchNorm(li.querySelector(".cat-name")?.textContent ?? "");
      const hit = !q || name.includes(q);
      li.hidden = !hit;
      if (hit) shown++;
    });
    if (empty) empty.hidden = shown > 0;
  });
}

const SUG_STATUS: Record<string, string> = {
  pendente: "⏳ na fila",
  aceita: "✓ vai entrar",
  recusada: "✕ recusada",
};

function suggestionsSectionHtml(): string {
  const form = isMember()
    ? `<div class="review-form" style="margin-top:12px">
        <input type="text" id="sug-title" maxlength="120" placeholder="Nome do jogo (ex: Chrono Cross)">
        <textarea id="sug-note" maxlength="500" placeholder="Por que esse? (opcional)"></textarea>
        <div class="row"><button class="commit-btn" id="sug-send">INDICAR</button></div>
        <div class="err" id="sug-err" hidden></div>
      </div>`
    : `<p class="notice" style="margin-top:12px"><a href="#/entrar">Entre</a> como membro pra indicar um jogo.</p>`;

  const list = suggestions.length
    ? `<ul class="review-list" style="margin-top:16px">${suggestions
        .map((s) => {
          const canDel = session && (session.userId === s.suggested_by || isAdmin());
          return `<li class="review-item">
            <div class="head">
              <span class="who">${esc(s.title)}</span>
              <span class="club-avg" style="font-size:10px">${SUG_STATUS[s.status] ?? s.status}</span>
            </div>
            ${s.note ? `<div class="body">${esc(s.note)}</div>` : ""}
            <div class="body" style="font-size:11px;opacity:.7">— ${esc(s.author)}${
              s.admin_note ? ` · admin: ${esc(s.admin_note)}` : ""
            }${canDel ? ` · <button class="linkbtn sug-del" data-id="${s.id}">apagar</button>` : ""}</div>
          </li>`;
        })
        .join("")}</ul>`
    : `<p class="played-empty" style="margin-top:12px">Ninguém indicou nada ainda.</p>`;

  return `<div class="review-box" style="margin-top:24px">
    <h2 class="section" style="margin-top:0">💡 Indique seu jogo</h2>
    <p class="sub" style="margin:0">A galera coloca aqui o que quer jogar; o admin decide o que entra na curadoria.</p>
    ${form}
    ${list}
  </div>`;
}

function wireSuggestions(stage: HTMLElement) {
  stage.querySelector("#sug-send")?.addEventListener("click", async () => {
    const title = (stage.querySelector("#sug-title") as HTMLInputElement)?.value ?? "";
    const note = (stage.querySelector("#sug-note") as HTMLTextAreaElement)?.value ?? "";
    const err = stage.querySelector<HTMLElement>("#sug-err")!;
    if (title.trim().length < 2) {
      err.textContent = "Escreve o nome do jogo.";
      err.hidden = false;
      return;
    }
    err.hidden = true;
    try {
      await createSuggestion(title, note, session!.userId);
      await refresh();
    } catch (e) {
      err.textContent = "Não deu: " + (e as Error).message;
      err.hidden = false;
    }
  });
  stage.querySelectorAll<HTMLElement>(".sug-del").forEach((b) =>
    b.addEventListener("click", async () => {
      if (confirm("Apagar essa indicação?")) {
        try {
          await deleteSuggestion(b.dataset.id!);
          await refresh();
        } catch (e) {
          alert("Erro: " + (e as Error).message);
        }
      }
    }),
  );
}

// ======================================================================
// Admin: sorteio
// ======================================================================
function adminDrawHtml(): string {
  const pool = eligibleGames(games, playedIds(), archivedIds());
  if (pool.length === 0) {
    return `<div class="cabinet"><div class="screen"><div class="idle-line">🏆 VOCÊS ZERARAM O CLUBE!</div></div></div>`;
  }
  const screen = candidate ? candidateScreenHtml(candidate) : `<div class="idle-line">INSIRA UMA FICHA ▸ PRESSIONE SORTEAR</div>`;
  return `
    <div class="cabinet"><div class="screen" id="screen">${screen}</div></div>
    <button class="roll-btn" id="roll">${candidate ? "SORTEAR OUTRO" : "SORTEAR JOGO"}</button>
    <div class="toast" id="toast"></div>`;
}

function candidateScreenHtml(g: Game): string {
  return `<div class="result">
    <div class="badges">${badgesHtml(g)}</div>
    <div class="game-title">${esc(g.title)}</div>
    <p class="pitch">${esc(g.pitch ?? "")}</p>
    ${gameMediaHtml(g)}
    <div class="commit-row">
      <button class="commit-btn" id="confirm">✓ CONFIRMAR COMO JOGO DO MÊS</button>
    </div>
  </div>`;
}

function adminRoundControlsHtml(round: Round): string {
  if (round.status === "jogando") {
    return `<button class="ghost-btn" id="close-round">encerrar o mês (abrir avaliações)</button>`;
  }
  return `<button class="ghost-btn" id="archive-round">arquivar rodada e liberar o próximo sorteio</button>`;
}

function wireHome() {
  // delegação: pôster de vídeo
  app.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".play-poster") as HTMLElement | null;
    if (btn?.dataset.yt) {
      const box = btn.closest(".trailer")!;
      box.innerHTML = `<iframe src="${ytEmbed(btn.dataset.yt)}" title="Vídeo" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    }
  });

  // delegação: clicar/teclar numa linha do catálogo abre a ficha do jogo
  app.addEventListener("click", (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>(".catalog-list li[data-id]");
    if (li?.dataset.id) openGameInfo(li.dataset.id);
  });
  app.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const li = (e.target as HTMLElement).closest<HTMLElement>(".catalog-list li[data-id]");
    if (li?.dataset.id) {
      e.preventDefault();
      openGameInfo(li.dataset.id);
    }
  });

  const stage = document.getElementById("stage");
  if (!stage) return;

  stage.querySelector("#roll")?.addEventListener("click", runDraw);
  stage.querySelector("#confirm")?.addEventListener("click", confirmRound);
  stage.querySelector("#close-round")?.addEventListener("click", async () => {
    const r = activeRound();
    if (r) await guard(() => closeRound(r.id));
  });
  stage.querySelector("#archive-round")?.addEventListener("click", async () => {
    const r = activeRound();
    if (r && confirm("Arquivar esta rodada? Depois disso dá pra sortear o próximo jogo.")) {
      await guard(() => archiveRound(r.id));
    }
  });
}

async function runDraw() {
  if (busy) return;
  const pool = eligibleGames(games, playedIds(), archivedIds());
  const final = drawGame(pool, { excludeId: candidate?.id });
  if (!final) return;

  const screen = document.getElementById("screen")!;
  const rollBtn = document.getElementById("roll") as HTMLButtonElement;
  rollBtn.disabled = true;
  busy = true;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const settle = () => {
    candidate = final;
    busy = false;
    const st = document.getElementById("stage");
    if (st) {
      renderStage(st);
      wireStageButtons(st);
    }
  };

  if (reduce) return settle();

  screen.innerHTML = `<div class="result"><div class="game-title rolling" id="rolltitle">…</div></div>`;
  const title = document.getElementById("rolltitle")!;
  const total = 16;
  const startedAt = performance.now();
  let step = 0;
  const tick = () => {
    step++;
    title.textContent = games[(Math.random() * games.length) | 0]!.title;
    // trava por tempo também: se a aba estiver em 2º plano o setTimeout é estrangulado
    if (step >= total || performance.now() - startedAt > 2600) return settle();
    setTimeout(tick, 45 + Math.pow(step / total, 3) * 240);
  };
  rollBtn.textContent = "SORTEANDO…";
  tick();
}

function wireStageButtons(stage: HTMLElement) {
  stage.querySelector("#roll")?.addEventListener("click", runDraw);
  stage.querySelector("#confirm")?.addEventListener("click", confirmRound);
  stage.querySelector("#close-round")?.addEventListener("click", async () => {
    const r = activeRound();
    if (r) await guard(() => closeRound(r.id));
  });
  stage.querySelector("#archive-round")?.addEventListener("click", async () => {
    const r = activeRound();
    if (r && confirm("Arquivar esta rodada?")) await guard(() => archiveRound(r.id));
  });
}

async function confirmRound() {
  if (!candidate || !session) return;
  const g = candidate;
  await guard(async () => {
    await createRound(g.id, session!.userId);
    candidate = null;
  });
  openModal(g);
  fireConfetti(confetti);
}

// ======================================================================
// Modal de comemoração
// ======================================================================
/** Ficha do jogo a partir do catálogo — mesmo pop-up do sorteio, sem CTA de "bora jogar". */
function openGameInfo(id: string) {
  const g = gameById(id);
  if (!g) return;
  const played = playedIds().has(g.id);
  const cav = averages.get(g.id);
  const club = played && cav ? `<p class="club-avg">MÉDIA DO CLUBE · ${cav.avg.toFixed(1)}★ (${cav.n})</p>` : "";
  openModal(g, {
    kicker: played ? "JÁ JOGAMOS" : "NA CURADORIA",
    hideCover: true,
    body: `<p class="modal-pitch">${esc(g.pitch ?? "")}</p>${club}${gameMediaHtml(g)}`,
    cta: `<button class="ghost-btn" id="mok">fechar</button>`,
  });
}

function openModal(
  g: Game,
  opts: { kicker?: string; body?: string; cta?: string; hideCover?: boolean } = {},
) {
  const kicker = opts.kicker ?? "🏆 JOGO DO MÊS";
  const body = opts.body ?? `<p class="modal-pitch">${esc(g.pitch ?? "")}</p>`;
  const cta = opts.cta ?? `<button class="commit-btn" id="mok">BORA JOGAR!</button>`;
  const cover = opts.hideCover
    ? ""
    : `<div class="modal-cover">${
        g.cover_url
          ? `<img src="${esc(g.cover_url)}" alt="" referrerpolicy="no-referrer">`
          : `<span class="ph"><span class="ph-glyph">?</span><span class="ph-sub">${g.year} · sem capa</span></span>`
      }</div>`;
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="mb">
      <div class="modal" role="dialog" aria-modal="true">
        <button class="modal-x" id="mx" aria-label="Fechar">✕</button>
        <div class="modal-kicker">${esc(kicker)}</div>
        ${cover}
        <h2 class="modal-title">${esc(g.title)}</h2>
        <div class="modal-badges">${badgesHtml(g)}</div>
        ${body}
        <div class="modal-actions">${cta}</div>
      </div>
    </div>`;
  document.documentElement.classList.add("modal-open");
  document.body.classList.add("modal-open");
  const close = () => {
    modalRoot.innerHTML = "";
    document.documentElement.classList.remove("modal-open");
    document.body.classList.remove("modal-open");
  };
  modalRoot.querySelector("#mx")?.addEventListener("click", close);
  modalRoot.querySelector("#mok")?.addEventListener("click", close);
  modalRoot.querySelector(".play-poster")?.addEventListener("click", (e) => {
    const btn = e.currentTarget as HTMLElement;
    if (btn.dataset.yt) btn.closest(".trailer")!.innerHTML =
      `<iframe src="${ytEmbed(btn.dataset.yt)}" title="Vídeo" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  });
  modalRoot.querySelector("#mb")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "mb") close();
  });
  document.addEventListener("keydown", function esc2(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", esc2);
    }
  });
}

// ======================================================================
// Avaliações
// ======================================================================
async function renderReviewBox(round: Round, container: ParentNode = document) {
  const box = container.querySelector<HTMLElement>("#review-box");
  if (!box) return;
  let reviews: ReviewWithAuthor[];
  try {
    reviews = await listReviews(round.id);
  } catch (e) {
    box.innerHTML = `<div class="err">Não deu pra carregar as avaliações: ${esc((e as Error).message)}</div>`;
    return;
  }
  const mine = session ? reviews.find((r) => r.member_id === session!.userId) : undefined;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  box.innerHTML = `
    <h2 class="section" style="margin-top:0">Avaliações do clube</h2>
    ${
      reviews.length
        ? `<div class="club-avg">MÉDIA ${avg.toFixed(1)} ★ · ${reviews.length} nota${reviews.length > 1 ? "s" : ""}</div>`
        : `<div class="club-avg">ninguém avaliou ainda</div>`
    }
    ${isMember() ? reviewFormHtml(mine) : `<p class="notice" style="margin-top:14px"><a href="#/entrar">Entre</a> como membro do clube pra avaliar.</p>`}
    <ul class="review-list">${reviews.map(reviewItemHtml).join("")}</ul>`;

  if (isMember()) wireReviewForm(box, round, mine?.rating ?? 0);
}

function reviewFormHtml(mine?: ReviewWithAuthor): string {
  const rating = mine?.rating ?? 0;
  const body = mine?.body ?? "";
  let stars = '<div class="star-input" id="star-input">';
  for (let i = 1; i <= 5; i++)
    stars += `<button type="button" class="s${i <= rating ? " on" : ""}" data-v="${i}">★</button>`;
  stars += "</div>";
  return `<div class="review-form" style="margin-top:14px">
    ${stars}
    <textarea id="review-body" maxlength="280" placeholder="Sua crítica em poucas linhas...">${esc(body)}</textarea>
    <div class="row">
      <button class="commit-btn" id="review-save">${mine ? "ATUALIZAR" : "ENVIAR"}</button>
      <span class="count" id="review-count">${body.length}/280</span>
    </div>
    <div class="err" id="review-err" hidden></div>
  </div>`;
}

function reviewItemHtml(r: ReviewWithAuthor): string {
  return `<li class="review-item">
    <div class="head"><span class="who">${esc(r.author)}</span>${starsHtml(r.rating)}</div>
    ${r.body ? `<div class="body">${esc(r.body)}</div>` : ""}
  </li>`;
}

function wireReviewForm(box: HTMLElement, round: Round, initial: number) {
  let rating = initial;
  const stars = box.querySelector("#star-input");
  stars?.querySelectorAll<HTMLButtonElement>(".s").forEach((b) => {
    b.addEventListener("click", () => {
      rating = Number(b.dataset.v);
      stars.querySelectorAll(".s").forEach((s, i) => s.classList.toggle("on", i < rating));
    });
  });
  const ta = box.querySelector<HTMLTextAreaElement>("#review-body");
  ta?.addEventListener("input", () => {
    box.querySelector("#review-count")!.textContent = `${ta.value.length}/280`;
  });
  box.querySelector("#review-save")?.addEventListener("click", async () => {
    const err = box.querySelector<HTMLElement>("#review-err")!;
    if (rating < 1) {
      err.textContent = "Dá uma nota de 1 a 5 estrelas.";
      err.hidden = false;
      return;
    }
    err.hidden = true;
    try {
      await upsertReview(round.id, session!.userId, rating, ta?.value ?? "");
      await refresh();
    } catch (e) {
      err.textContent = "Não deu pra salvar: " + (e as Error).message;
      err.hidden = false;
    }
  });
}

// ======================================================================
// Login / perfil
// ======================================================================
function loginView(inviteCode?: string | null): HTMLElement {
  const el = document.createElement("div");
  el.appendChild(topbar());
  const withInvite = !!inviteCode;
  el.insertAdjacentHTML(
    "beforeend",
    `<div class="login-card">
      <div class="kicker">GAME CLUB RETRÔ</div>
      <h2 class="section">Entrar</h2>
      <p class="sub" style="margin:0">${
        withInvite
          ? "Você tem um convite do clube. Coloque seu e-mail e pronto."
          : "Coloque seu e-mail — você recebe um link mágico. Membros novos precisam de um código de convite (peça no grupo)."
      }</p>
      <input type="email" id="email" placeholder="seu@email.com" autocomplete="email">
      <input type="text" id="code" placeholder="código de convite (se for novo)" value="${esc(inviteCode ?? "")}"${withInvite ? " hidden" : ""}>
      <div class="commit-row"><button class="commit-btn" id="send">MANDAR LINK</button></div>
      <div class="toast" id="lg-msg"></div>
    </div>`,
  );
  const btn = el.querySelector("#send") as HTMLButtonElement;
  const cooldown = (secs: number) => {
    btn.disabled = true;
    let left = secs;
    const label = () => (btn.textContent = left > 0 ? `AGUARDE ${left}s` : "MANDAR LINK");
    label();
    const t = setInterval(() => {
      left -= 1;
      label();
      if (left <= 0) {
        clearInterval(t);
        btn.disabled = false;
      }
    }, 1000);
  };

  btn.addEventListener("click", async () => {
    const email = (el.querySelector("#email") as HTMLInputElement).value.trim();
    const code = (el.querySelector("#code") as HTMLInputElement).value.trim();
    const msg = el.querySelector("#lg-msg") as HTMLElement;
    if (!/.+@.+\..+/.test(email)) {
      msg.textContent = "E-mail inválido.";
      return;
    }
    btn.disabled = true;
    msg.textContent = "Enviando...";
    try {
      if (code) {
        const ok = await redeemInvite(email, code);
        if (!ok) {
          msg.textContent = "Código de convite inválido.";
          btn.disabled = false;
          return;
        }
      }
      const { error } = await sendMagicLink(email);
      if (!error) {
        msg.textContent = "Link enviado! Confere seu e-mail (e o spam). Pode fechar essa aba.";
        cooldown(60);
      } else if (/not on the|allowlist/i.test(error.message)) {
        msg.textContent = "Esse e-mail ainda não é do clube. Use um código de convite.";
        btn.disabled = false;
      } else if (/rate limit|too many|60 seconds/i.test(error.message)) {
        msg.textContent = "Muitos pedidos seguidos. Espera 1 minuto e tenta de novo (ou olha se o link anterior já chegou).";
        cooldown(60);
      } else {
        msg.textContent = "Erro: " + error.message;
        btn.disabled = false;
      }
    } catch (e) {
      msg.textContent = "Erro: " + (e as Error).message;
      btn.disabled = false;
    }
  });
  return el;
}

function lojaView(): HTMLElement {
  const el = document.createElement("div");
  el.appendChild(topbar());
  el.insertAdjacentHTML(
    "beforeend",
    `<header>
      <div class="kicker">GAME CLUB RETRÔ</div>
      <h1>Jogue de verdade</h1>
    </header>
    <div style="margin-top:26px">${storeSectionHtml(storeItems)}</div>
    <p style="text-align:center;margin-top:28px"><a href="#/">&lt;&lt; voltar pro sorteador</a></p>`,
  );
  return el;
}

function profileView(): HTMLElement {
  const el = document.createElement("div");
  el.appendChild(topbar());
  if (!session) {
    el.insertAdjacentHTML("beforeend", `<p class="notice" style="margin-top:30px"><a href="#/entrar">Entre</a> primeiro.</p>`);
    return el;
  }
  el.insertAdjacentHTML(
    "beforeend",
    `<div class="login-card">
      <h2 class="section">Seu perfil</h2>
      <p class="sub" style="margin:0">${esc(session.email)} · ${session.role ?? "sem acesso de membro"}</p>
      <input type="text" id="name" value="${esc(session.displayName)}" placeholder="como você aparece nas avaliações">
      <div class="commit-row"><button class="commit-btn" id="save">SALVAR NOME</button></div>
      <div class="toast" id="pf-msg"></div>
    </div>`,
  );
  el.querySelector("#save")?.addEventListener("click", async () => {
    const name = (el.querySelector("#name") as HTMLInputElement).value;
    const msg = el.querySelector("#pf-msg") as HTMLElement;
    try {
      await updateDisplayName(session!.userId, name);
      msg.textContent = "Salvo.";
      await loadState();
    } catch (e) {
      msg.textContent = "Erro: " + (e as Error).message;
    }
  });
  return el;
}

// ======================================================================
// Infra
// ======================================================================
async function guard(fn: () => Promise<unknown>) {
  const toast = document.getElementById("toast") || document.getElementById("lg-msg");
  try {
    await fn();
    await refresh();
  } catch (e) {
    if (toast) toast.textContent = "Erro: " + (e as Error).message;
    else alert("Erro: " + (e as Error).message);
  }
}

let refreshing = false;
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    await loadState();
    await render();
  } finally {
    refreshing = false;
  }
}

/** No painel admin, o Realtime só recarrega os dados em silêncio — não redesenha a tela
 * (o admin está editando; quem redesenha o painel são as ações dele). Fora do admin, refresh normal. */
function liveRefresh() {
  if (location.hash.startsWith("#/admin")) void loadState();
  else void refresh();
}

function subscribeRealtime() {
  supabase
    .channel("club")
    .on("postgres_changes", { event: "*", schema: "public", table: "rounds" }, liveRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, liveRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "games" }, liveRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "suggestions" }, liveRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "store_items" }, liveRefresh)
    .subscribe();
}

function cleanAuthHash() {
  if (/access_token=|error=|type=magiclink/.test(location.hash)) {
    history.replaceState(null, "", location.pathname + "#/");
  }
}

async function boot() {
  window.addEventListener("hashchange", () => render());
  onAuthChange(() => {
    cleanAuthHash();
    refresh();
  });
  subscribeRealtime();
  await supabase.auth.getSession(); // processa o #access_token do magic link
  cleanAuthHash();
  await refresh();
}

boot();
