import type { ConsoleCode, Game, Role, StoreItem } from "./types";
import {
  listGames, upsertGame, setGameActive, setGameFeatured, enrichGame, deleteGame,
} from "./data/games";
import {
  listAllowlist, addMember, removeMember, setMemberRole,
  getInviteCode, setInviteCode,
} from "./data/members";
import { listSuggestions, setSuggestionStatus, deleteSuggestion } from "./data/suggestions";
import {
  listStoreItems, upsertStoreItem, setStoreItemActive, deleteStoreItem,
} from "./data/store";
import { esc, searchNorm } from "./components";

const CONSOLES: ConsoleCode[] = ["SNES", "MD", "N64", "PS1", "GBA", "GBC"];
let tab: "jogos" | "membros" | "sugestoes" | "loja" = "jogos";
let prefillTitle = "";

export async function renderAdmin(root: HTMLElement, onChange: () => void) {
  root.innerHTML = `
    <h1>Modo admin</h1>
    <div class="admin-tabs">
      <button data-tab="jogos" class="${tab === "jogos" ? "on" : ""}">Jogos</button>
      <button data-tab="sugestoes" class="${tab === "sugestoes" ? "on" : ""}">Sugestões</button>
      <button data-tab="loja" class="${tab === "loja" ? "on" : ""}">Loja</button>
      <button data-tab="membros" class="${tab === "membros" ? "on" : ""}">Membros</button>
    </div>
    <div id="admin-body"></div>`;
  root.querySelectorAll<HTMLButtonElement>(".admin-tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      tab = b.dataset.tab as typeof tab;
      renderAdmin(root, onChange);
    }),
  );
  const body = root.querySelector("#admin-body") as HTMLElement;
  if (tab === "jogos") await renderJogos(body, onChange);
  else if (tab === "sugestoes") await renderSugestoes(body, root, onChange);
  else if (tab === "loja") await renderLoja(body, onChange);
  else await renderMembros(body);
}

// ---------------------------------------------------------------- jogos
async function renderJogos(body: HTMLElement, onChange: () => void) {
  const games = (await listGames({ includeInactive: true })).sort((a, b) =>
    a.title.localeCompare(b.title, "pt-BR"),
  );
  body.innerHTML = `
    <p class="sub" style="margin:0 0 10px">${games.length} jogos. Editar um campo salva ao sair dele. ★ = Destaque (peso 3× no sorteio).</p>
    <input type="search" id="j-search" placeholder="buscar jogo…" style="width:100%;margin-bottom:10px">
    <div class="table-scroll"><table class="table">
      <thead><tr>
        <th>ativo</th><th>★</th><th>título</th><th>cons.</th><th>ano</th>
        <th>youtube_id</th><th>saga</th><th>nº</th><th>wiki_title</th>
        <th>crítica</th><th>capa</th><th></th>
      </tr></thead>
      <tbody id="rows"></tbody>
    </table></div>
    <h2 class="section">Novo jogo</h2>
    <div class="form-grid" id="new-form">
      <label>id (slug)<input id="n-id" placeholder="ex: final-fantasy-x"></label>
      <label>título<input id="n-title" value="${esc(prefillTitle)}"></label>
      <label>console<select id="n-console">${CONSOLES.map((c) => `<option>${c}</option>`).join("")}</select></label>
      <label>ano<input id="n-year" type="number"></label>
      <label>youtube_id<input id="n-yt"></label>
      <label>saga (opcional)<input id="n-series"></label>
      <label>nº na saga<input id="n-order" type="number"></label>
      <label>wiki_title (artigo EN)<input id="n-wiki"></label>
      <label style="grid-column:1/-1">pitch<textarea id="n-pitch" rows="2"></textarea></label>
    </div>
    <div class="commit-row"><button class="commit-btn" id="add-game">ADICIONAR</button></div>
    <div class="err" id="admin-err" hidden></div>`;

  prefillTitle = "";
  const tbody = body.querySelector("#rows") as HTMLElement;
  tbody.innerHTML = games.map(rowHtml).join("");

  const showErr = (msg: string) => {
    const el = body.querySelector<HTMLElement>("#admin-err")!;
    el.textContent = msg;
    el.hidden = false;
  };
  // edição inline: grava no banco em silêncio, não redesenha (o valor já está no input/checkbox).
  const save = async (id: string, patch: Partial<Game>) => {
    const g = games.find((x) => x.id === id)!;
    Object.assign(g, patch);
    try {
      await upsertGame({ ...g });
    } catch (e) {
      showErr((e as Error).message);
    }
  };

  tbody.querySelectorAll<HTMLElement>("tr[data-id]").forEach((tr) => {
    const id = tr.dataset.id!;
    tr.querySelector<HTMLInputElement>(".c-active")?.addEventListener("change", (e) => {
      const on = (e.target as HTMLInputElement).checked;
      const g = games.find((x) => x.id === id);
      if (g) g.active = on;
      setGameActive(id, on).catch((ex) => showErr((ex as Error).message));
    });
    tr.querySelector<HTMLInputElement>(".c-featured")?.addEventListener("change", (e) => {
      const on = (e.target as HTMLInputElement).checked;
      const g = games.find((x) => x.id === id);
      if (g) g.featured = on;
      setGameFeatured(id, on).catch((ex) => showErr((ex as Error).message));
    });
    tr.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-field]").forEach((inp) => {
      inp.addEventListener("blur", () => {
        const f = inp.dataset.field as keyof Game;
        let v: unknown = inp.value.trim();
        if (f === "year" || f === "series_order" || f === "critic_score")
          v = v === "" ? null : Number(v);
        if (f === "series" && v === "") v = null;
        if (f === "critic_score") save(id, { critic_score: v as number, critic_source: "manual" });
        else save(id, { [f]: v } as Partial<Game>);
      });
    });
    tr.querySelector(".c-del")?.addEventListener("click", async () => {
      const g = games.find((x) => x.id === id)!;
      if (!confirm(`Excluir "${g.title}" de vez? Não dá pra desfazer.`)) return;
      try {
        await deleteGame(id);
        onChange();
      } catch (e) {
        showErr((e as Error).message);
      }
    });
  });

  body.querySelector<HTMLInputElement>("#j-search")?.addEventListener("input", (e) => {
    const q = searchNorm((e.target as HTMLInputElement).value.trim());
    tbody.querySelectorAll<HTMLElement>("tr[data-id]").forEach((tr) => {
      const name = searchNorm(
        tr.querySelector<HTMLInputElement>('[data-field="title"]')?.value ?? "",
      );
      tr.hidden = !!q && !name.includes(q);
    });
  });

  body.querySelector("#add-game")?.addEventListener("click", async () => {
    const val = (s: string) => (body.querySelector(`#${s}`) as HTMLInputElement).value.trim();
    const g = {
      id: val("n-id"),
      title: val("n-title"),
      console: val("n-console") as ConsoleCode,
      year: Number(val("n-year")),
      youtube_id: val("n-yt") || null,
      pitch: (body.querySelector("#n-pitch") as HTMLTextAreaElement).value.trim() || null,
      series: val("n-series") || null,
      series_order: val("n-order") ? Number(val("n-order")) : null,
      wiki_title: val("n-wiki") || null,
      critic_score: null,
      critic_source: null,
      featured: false,
      active: true,
    };
    if (!g.id || !g.title || !g.year) {
      showErr("Preencha id, título e ano.");
      return;
    }
    try {
      await upsertGame(g);
      await enrichGame(g as Game).catch(() => {});
      onChange();
    } catch (e) {
      showErr((e as Error).message);
    }
  });
}

function rowHtml(g: Game): string {
  const inp = (f: keyof Game, cls = "") =>
    `<input class="${cls}" data-field="${f}" value="${esc(g[f] ?? "")}">`;
  return `<tr data-id="${g.id}">
    <td><input type="checkbox" class="c-active" ${g.active ? "checked" : ""}></td>
    <td><input type="checkbox" class="c-featured" ${g.featured ? "checked" : ""}></td>
    <td>${inp("title")}</td>
    <td><select data-field="console">${CONSOLES.map((c) => `<option ${c === g.console ? "selected" : ""}>${c}</option>`).join("")}</select></td>
    <td>${inp("year", "num")}</td>
    <td>${inp("youtube_id")}</td>
    <td>${inp("series")}</td>
    <td>${inp("series_order", "num")}</td>
    <td>${inp("wiki_title")}</td>
    <td>${inp("critic_score", "num")}${g.critic_source ? `<small> (${g.critic_source})</small>` : ""}</td>
    <td>${g.cover_url ? "✓" : "—"}</td>
    <td><button class="ghost-btn c-del" style="border-color:rgba(255,46,136,.4);color:var(--magenta)">excluir</button></td>
  </tr>`;
}

// ----------------------------------------------------------- sugestões
async function renderSugestoes(body: HTMLElement, root: HTMLElement, onChange: () => void) {
  const all = await listSuggestions();
  const pend = all.filter((s) => s.status === "pendente");
  const done = all.filter((s) => s.status !== "pendente");

  const card = (s: (typeof all)[number], showActions: boolean) => `
    <li class="review-item" data-id="${s.id}">
      <div class="head">
        <span class="who">${esc(s.title)}</span>
        <span class="club-avg" style="font-size:10px">${
          { pendente: "⏳", aceita: "✓ vai entrar", recusada: "✕ recusada" }[s.status]
        }</span>
      </div>
      ${s.note ? `<div class="body">${esc(s.note)}</div>` : ""}
      <div class="body" style="font-size:11px;opacity:.7">— ${esc(s.author)}${
        s.admin_note ? ` · você: ${esc(s.admin_note)}` : ""
      }</div>
      ${
        showActions
          ? `<div class="row" style="margin-top:8px">
               <button class="ghost-btn s-accept">aceitar</button>
               <button class="ghost-btn s-reject">recusar</button>
             </div>`
          : `<div class="row" style="margin-top:8px">
               ${s.status === "aceita" ? `<button class="ghost-btn s-create">+ criar jogo</button>` : ""}
               <button class="linkbtn s-del">apagar</button>
             </div>`
      }
    </li>`;

  body.innerHTML = `
    <h2 class="section" style="margin-top:0">Na fila (${pend.length})</h2>
    ${pend.length ? `<ul class="review-list">${pend.map((s) => card(s, true)).join("")}</ul>` : `<p class="played-empty">Nada pendente.</p>`}
    <h2 class="section">Já decididas</h2>
    ${done.length ? `<ul class="review-list">${done.map((s) => card(s, false)).join("")}</ul>` : `<p class="played-empty">—</p>`}`;

  body.querySelectorAll<HTMLElement>("li[data-id]").forEach((li) => {
    const id = li.dataset.id!;
    const sug = all.find((s) => s.id === id)!;
    li.querySelector(".s-accept")?.addEventListener("click", async () => {
      const nota = prompt("Comentário pro membro (opcional):") ?? "";
      await setSuggestionStatus(id, "aceita", nota);
      renderSugestoes(body, root, onChange);
      onChange();
    });
    li.querySelector(".s-reject")?.addEventListener("click", async () => {
      const nota = prompt("Por que não? (opcional):") ?? "";
      await setSuggestionStatus(id, "recusada", nota);
      renderSugestoes(body, root, onChange);
      onChange();
    });
    li.querySelector(".s-create")?.addEventListener("click", () => {
      prefillTitle = sug.title;
      tab = "jogos";
      renderAdmin(root, onChange);
    });
    li.querySelector(".s-del")?.addEventListener("click", async () => {
      if (confirm("Apagar essa indicação?")) {
        await deleteSuggestion(id);
        renderSugestoes(body, root, onChange);
        onChange();
      }
    });
  });
}

// ----------------------------------------------------------------- loja
async function renderLoja(body: HTMLElement, onChange: () => void) {
  const items = await listStoreItems({ includeInactive: true });

  const row = (it: StoreItem) => {
    const inp = (f: keyof StoreItem, cls = "") =>
      `<input class="${cls}" data-field="${f}" value="${esc(it[f] ?? "")}">`;
    return `<tr data-id="${it.id}">
      <td><input type="checkbox" class="c-active" ${it.active ? "checked" : ""}></td>
      <td>${inp("sort_order", "num")}</td>
      <td>${inp("label")}</td>
      <td>${inp("price")}</td>
      <td>${inp("rating", "num")}</td>
      <td>${inp("sales", "num")}</td>
      <td>${it.image_url ? `<img src="${esc(it.image_url)}" alt="" referrerpolicy="no-referrer" style="width:32px;height:32px;object-fit:cover;border-radius:5px;vertical-align:middle;margin-right:4px">` : ""}${inp("image_url")}</td>
      <td>${inp("url")}${it.url ? ` <a href="${esc(it.url)}" target="_blank" rel="noopener" style="font-size:10px">↗</a>` : ""}</td>
      <td><button class="ghost-btn c-del" style="border-color:rgba(255,46,136,.4);color:var(--magenta)">excluir</button></td>
    </tr>`;
  };

  body.innerHTML = `
    <p class="sub" style="margin:0 0 10px">${items.length} itens. Tudo na mão: editar um campo salva ao sair dele; a ordem na página da Loja segue a coluna <b>ordem</b>. O card só aparece na home quando tem <b>link de afiliado</b>.</p>
    <div class="table-scroll"><table class="table">
      <thead><tr>
        <th>ativo</th><th>ordem</th><th>nome (card)</th><th>preço</th><th>nota</th>
        <th>vend.</th><th>imagem (url)</th><th>link de afiliado</th><th></th>
      </tr></thead>
      <tbody id="s-rows">${items.map(row).join("")}</tbody>
    </table></div>
    <h2 class="section">Novo item</h2>
    <p class="sub" style="margin:0 0 8px">Só o <b>nome</b> é obrigatório. O resto dá pra deixar em branco e preencher depois na linha da tabela.</p>
    <div class="form-grid">
      <label>nome no card *<input id="s-label" placeholder="ex: Console R36S"></label>
      <label>preço<input id="s-price" placeholder="R$ 0,00"></label>
      <label>nota (0–5)<input id="s-rating" placeholder="ex: 4.8"></label>
      <label>vendidos<input id="s-sales" placeholder="ex: 2300"></label>
      <label style="grid-column:1/-1">url da imagem<input id="s-img" placeholder="https://..."></label>
      <label style="grid-column:1/-1">link de afiliado (fica no botão do card)<input id="s-url" placeholder="https://..."></label>
    </div>
    <div class="commit-row"><button class="commit-btn" id="s-add">ADICIONAR</button></div>
    <div class="err" id="store-err" hidden></div>`;

  const err = body.querySelector<HTMLElement>("#store-err")!;
  const showErr = (msg: string) => {
    err.textContent = msg;
    err.hidden = false;
  };

  // redesenha só o painel da Loja, mantendo a rolagem.
  const rerender = async () => {
    const y = window.scrollY;
    await renderLoja(body, onChange);
    window.scrollTo(0, y);
  };

  // edição inline: salva no banco em silêncio, não mexe na tela.
  const save = async (id: string, patch: Partial<StoreItem>) => {
    const it = items.find((x) => x.id === id)!;
    Object.assign(it, patch);
    await upsertStoreItem({ ...it });
  };

  body.querySelectorAll<HTMLElement>("tr[data-id]").forEach((tr) => {
    const id = tr.dataset.id!;
    tr.querySelector<HTMLInputElement>(".c-active")?.addEventListener("change", (e) => {
      const on = (e.target as HTMLInputElement).checked;
      const it = items.find((x) => x.id === id);
      if (it) it.active = on;
      setStoreItemActive(id, on).catch((ex) => showErr((ex as Error).message));
    });
    tr.querySelectorAll<HTMLInputElement>("[data-field]").forEach((inp) => {
      inp.addEventListener("blur", () => {
        const f = inp.dataset.field as keyof StoreItem;
        const raw = inp.value.trim();
        let v: unknown = raw;
        if (f === "sort_order") v = Number(raw) || 0;
        else if (f === "rating") v = raw === "" ? null : Number(raw.replace(",", "."));
        else if (f === "sales") v = raw === "" ? null : Number(raw.replace(/\D/g, ""));
        else if (f === "price" || f === "image_url" || f === "url") v = raw === "" ? null : raw;
        if ((f === "url" || f === "image_url") && v && !/^https?:\/\//i.test(v as string)) {
          showErr(`${f}: precisa começar com http:// ou https://`);
          return;
        }
        save(id, { [f]: v } as Partial<StoreItem>).catch((e) => showErr((e as Error).message));
      });
    });
    tr.querySelector(".c-del")?.addEventListener("click", async () => {
      if (!confirm("Excluir esse item da loja?")) return;
      try {
        await deleteStoreItem(id);
        await rerender();
      } catch (ex) {
        showErr((ex as Error).message);
      }
    });
  });

  body.querySelector("#s-add")?.addEventListener("click", async () => {
    const val = (id: string) => (body.querySelector(`#${id}`) as HTMLInputElement).value.trim();
    const label = val("s-label");
    if (!label) {
      showErr("Dá um nome pro card.");
      return;
    }
    for (const [id, name] of [["s-img", "url da imagem"], ["s-url", "link de afiliado"]] as const) {
      const v = val(id);
      if (v && !/^https?:\/\//i.test(v)) {
        showErr(`${name}: precisa começar com http:// ou https://`);
        return;
      }
    }
    const btn = body.querySelector("#s-add") as HTMLButtonElement;
    btn.disabled = true;
    try {
      const item: Partial<StoreItem> & { label: string } = { label, sort_order: items.length };
      if (val("s-price")) item.price = val("s-price");
      if (val("s-rating")) item.rating = Number(val("s-rating").replace(",", "."));
      if (val("s-sales")) item.sales = Number(val("s-sales").replace(/\D/g, ""));
      if (val("s-img")) item.image_url = val("s-img");
      if (val("s-url")) item.url = val("s-url");
      await upsertStoreItem(item);
      await rerender();
    } catch (ex) {
      showErr((ex as Error).message);
      btn.disabled = false;
    }
  });
}

// -------------------------------------------------------------- membros
async function renderMembros(body: HTMLElement) {
  const [list, code] = await Promise.all([listAllowlist(), getInviteCode().catch(() => null)]);
  const inviteLink = code ? `${location.origin}/#/entrar?code=${code}` : "";
  body.innerHTML = `
    <h2 class="section" style="margin-top:0">Link de convite</h2>
    <p class="sub" style="margin:0 0 8px">Manda esse link no grupo — quem tem o link se cadastra sozinho (vira membro).</p>
    <div class="form-grid">
      <label style="grid-column:1/-1">link
        <input id="inv-link" readonly value="${esc(inviteLink)}">
      </label>
      <label>código atual<input id="inv-code" value="${esc(code ?? "")}"></label>
    </div>
    <div class="commit-row">
      <button class="ghost-btn" id="inv-copy">copiar link</button>
      <button class="ghost-btn" id="inv-save">salvar código</button>
      <button class="ghost-btn" id="inv-gen">gerar novo</button>
    </div>

    <h2 class="section">Membros</h2>
    <p class="sub" style="margin:0 0 10px">Só quem está aqui consegue logar. O nome cada um edita no próprio perfil.</p>
    <div class="table-scroll"><table class="table">
      <thead><tr><th>e-mail</th><th>papel</th><th>entrou?</th><th></th></tr></thead>
      <tbody id="m-rows">${list
        .map(
          (m) => `<tr data-email="${esc(m.email)}">
            <td>${esc(m.email)}</td>
            <td><select class="m-role">
              <option value="membro" ${m.role === "membro" ? "selected" : ""}>membro</option>
              <option value="admin" ${m.role === "admin" ? "selected" : ""}>admin</option>
            </select></td>
            <td><span class="pill ${m.joined ? "on" : ""}">${m.joined ? "sim" : "não"}</span></td>
            <td><button class="ghost-btn m-del">remover</button></td>
          </tr>`,
        )
        .join("")}</tbody>
    </table></div>
    <h2 class="section">Convidar</h2>
    <div class="form-grid">
      <label>e-mail<input id="m-email" type="email"></label>
      <label>papel<select id="m-newrole"><option value="membro">membro</option><option value="admin">admin</option></select></label>
    </div>
    <div class="commit-row"><button class="commit-btn" id="m-add">ADICIONAR À LISTA</button></div>
    <div class="err" id="m-err" hidden></div>`;

  body.querySelector("#inv-copy")?.addEventListener("click", () => {
    navigator.clipboard?.writeText(inviteLink);
    (body.querySelector("#inv-copy") as HTMLElement).textContent = "copiado!";
  });
  body.querySelector("#inv-save")?.addEventListener("click", async () => {
    const v = (body.querySelector("#inv-code") as HTMLInputElement).value.trim();
    if (v) { await setInviteCode(v); renderMembros(body); }
  });
  body.querySelector("#inv-gen")?.addEventListener("click", async () => {
    await setInviteCode(Math.random().toString(36).slice(2, 10));
    renderMembros(body);
  });

  body.querySelectorAll<HTMLElement>("tr[data-email]").forEach((tr) => {
    const email = tr.dataset.email!;
    tr.querySelector<HTMLSelectElement>(".m-role")?.addEventListener("change", (e) =>
      setMemberRole(email, (e.target as HTMLSelectElement).value as Role).then(() => renderMembros(body)),
    );
    tr.querySelector(".m-del")?.addEventListener("click", () => {
      if (confirm(`Remover ${email} da lista?`)) removeMember(email).then(() => renderMembros(body));
    });
  });

  body.querySelector("#m-add")?.addEventListener("click", async () => {
    const email = (body.querySelector("#m-email") as HTMLInputElement).value.trim();
    const role = (body.querySelector("#m-newrole") as HTMLSelectElement).value as Role;
    const err = body.querySelector<HTMLElement>("#m-err")!;
    if (!/.+@.+\..+/.test(email)) {
      err.textContent = "E-mail inválido.";
      err.hidden = false;
      return;
    }
    try {
      await addMember(email, role);
      renderMembros(body);
    } catch (e) {
      err.textContent = (e as Error).message;
      err.hidden = false;
    }
  });
}
