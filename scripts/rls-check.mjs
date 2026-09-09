// Verifica RLS simulando anon / membro / admin. Cada cenário é uma transação
// própria com ROLLBACK no fim — não deixa lixo.
// node --env-file=.env.local scripts/rls-check.mjs
import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: "require", max: 1, prepare: false });

const ADMIN_UID = "11111111-1111-1111-1111-111111111111";
const MEMBER_UID = "22222222-2222-2222-2222-222222222222";
const STRANGER_UID = "33333333-3333-3333-3333-333333333333";
const INST = "00000000-0000-0000-0000-000000000000";

const results = [];
const check = (name, ok) => results.push([ok, name]);
const denied = (e) =>
  /permission denied|row-level security|violates row-level|new row violates|rodada ativa/i.test(String(e?.message));

/** Roda `fn(tx)` numa transação com fixtures + a role pedida, sempre com rollback. */
async function scenario(role, uid, fn) {
  try {
    await sql.begin(async (tx) => {
      await tx`insert into auth.users (id, email, instance_id, aud, role) values
        (${ADMIN_UID}, 'gabriel.fernandeshw@gmail.com', ${INST}, 'authenticated', 'authenticated'),
        (${MEMBER_UID}, 'membro@teste.com', ${INST}, 'authenticated', 'authenticated'),
        (${STRANGER_UID}, 'estranho@fora.com', ${INST}, 'authenticated', 'authenticated')
        on conflict do nothing`;
      await tx`insert into public.allowlist (email, role) values ('membro@teste.com','membro') on conflict do nothing`;
      await tx.unsafe(`set local role ${role}`);
      await tx.unsafe(
        `set local request.jwt.claims = '${uid ? JSON.stringify({ sub: uid, role, email: `${uid}@x.com` }) : "{}"}'`,
      );
      await fn(tx);
      await tx.unsafe("rollback");
    });
  } catch (e) {
    if (!/rollback/i.test(e.message)) console.error("cenário", role, "erro:", e.message);
  }
}

// trigger + helpers
await scenario("postgres", null, async (tx) => {
  const p = await tx`select count(*)::int n from public.profiles`;
  check("trigger cria profile no signup (x3)", p[0].n === 3);
});
await scenario("authenticated", ADMIN_UID, async (tx) => {
  const [r] = await tx`select public.is_admin() a, public.is_member() m`;
  check("admin: is_admin() && is_member()", r.a === true && r.m === true);
});
await scenario("authenticated", MEMBER_UID, async (tx) => {
  const [r] = await tx`select public.is_admin() a, public.is_member() m`;
  check("membro: is_admin() false, is_member() true", r.a === false && r.m === true);
});
await scenario("authenticated", STRANGER_UID, async (tx) => {
  const [r] = await tx`select public.is_member() m`;
  check("estranho fora da allowlist: is_member() false", r.m === false);
});

// anon
await scenario("anon", null, async (tx) => {
  const g = await tx`select count(*)::int n from public.games`;
  check("anon lê games", g[0].n === 49);
});
await scenario("anon", null, async (tx) => {
  try {
    await tx`insert into public.games (id,title,console,year) values ('h','H','PS1',2000)`;
    check("anon NÃO insere games", false);
  } catch (e) {
    check("anon NÃO insere games", denied(e));
  }
});

// store_items: leitura pública, escrita só admin
await scenario("postgres", null, async (tx) => {
  await tx`insert into public.store_items (title, url) values ('SNES', 'https://shopee.com.br/x')`;
  await tx.unsafe(`set local role anon`);
  const r = await tx`select count(*)::int n from public.store_items`;
  check("anon lê store_items", r[0].n >= 1);
});
await scenario("anon", null, async (tx) => {
  try {
    await tx`insert into public.store_items (title, url) values ('h', 'https://x.com')`;
    check("anon NÃO insere store_items", false);
  } catch (e) {
    check("anon NÃO insere store_items", denied(e));
  }
});
await scenario("authenticated", MEMBER_UID, async (tx) => {
  try {
    await tx`insert into public.store_items (title, url) values ('h', 'https://x.com')`;
    check("membro NÃO insere store_items", false);
  } catch (e) {
    check("membro NÃO insere store_items", denied(e));
  }
});
await scenario("authenticated", ADMIN_UID, async (tx) => {
  const [s] = await tx`insert into public.store_items (title, url) values ('N64', 'https://shopee.com.br/z') returning id`;
  check("admin insere store_items", !!s.id);
});

// membro não escreve games/rounds
await scenario("authenticated", MEMBER_UID, async (tx) => {
  await tx`update public.games set featured = true where id = 'ff7'`;
  const [g] = await tx`select featured from public.games where id = 'ff7'`;
  check("membro NÃO altera games (update 0 linhas)", g.featured === false);
});
await scenario("authenticated", MEMBER_UID, async (tx) => {
  try {
    await tx`insert into public.rounds (game_id) values ('ff7')`;
    check("membro NÃO cria rounds", false);
  } catch (e) {
    check("membro NÃO cria rounds", denied(e));
  }
});

// admin cria round + trava de rodada única
await scenario("authenticated", ADMIN_UID, async (tx) => {
  const [rd] = await tx`insert into public.rounds (game_id, drawn_by) values ('ff7', ${ADMIN_UID}) returning id`;
  check("admin cria round", !!rd.id);
  try {
    await tx`insert into public.rounds (game_id) values ('ff6')`;
    check("2ª rodada ativa bloqueada pelo trigger", false);
  } catch (e) {
    check("2ª rodada ativa bloqueada pelo trigger", denied(e));
  }
});

// review: só quando 'avaliando', só a própria
await scenario("authenticated", ADMIN_UID, async (tx) => {
  const [rd] = await tx`insert into public.rounds (game_id, drawn_by) values ('ff7', ${ADMIN_UID}) returning id`;
  // vira membro na mesma tx: precisa trocar claims
  await tx.unsafe(
    `set local request.jwt.claims = '${JSON.stringify({ sub: MEMBER_UID, role: "authenticated", email: "m@x.com" })}'`,
  );
  try {
    await tx`insert into public.reviews (round_id, member_id, rating) values (${rd.id}, ${MEMBER_UID}, 4)`;
    check("review bloqueada enquanto 'jogando'", false);
  } catch (e) {
    check("review bloqueada enquanto 'jogando'", denied(e));
  }
  await tx.unsafe(
    `set local request.jwt.claims = '${JSON.stringify({ sub: ADMIN_UID, role: "authenticated", email: "gabriel.fernandeshw@gmail.com" })}'`,
  );
  await tx`update public.rounds set status='avaliando', closed_at=now() where id=${rd.id}`;
  await tx.unsafe(
    `set local request.jwt.claims = '${JSON.stringify({ sub: MEMBER_UID, role: "authenticated", email: "m@x.com" })}'`,
  );
  await tx`insert into public.reviews (round_id, member_id, rating, body) values (${rd.id}, ${MEMBER_UID}, 5, 'top')`;
  check("membro avalia quando 'avaliando'", true);
  try {
    await tx`insert into public.reviews (round_id, member_id, rating) values (${rd.id}, ${ADMIN_UID}, 1)`;
    check("membro NÃO avalia no lugar de outro", false);
  } catch (e) {
    check("membro NÃO avalia no lugar de outro", denied(e));
  }
});

await sql.end();

const failed = results.filter(([ok]) => !ok);
for (const [ok, name] of results) console.log(ok ? "  ✓" : "  ✗", name);
if (failed.length) {
  console.log(`\n❌ ${failed.length} falha(s)`);
  process.exitCode = 1;
} else {
  console.log(`\n✅ RLS ok — ${results.length} checagens`);
}
