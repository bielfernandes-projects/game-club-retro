// Configura o Auth do Supabase via Management API.
// Precisa de SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens).
// SMTP opcional: RESEND_API_KEY  +  SMTP_SENDER_EMAIL (default clube@bf.dev.br).
//
//   SUPABASE_ACCESS_TOKEN=sbp_... node --env-file=.env.local scripts/setup-auth.mjs
import { readFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Faltou SUPABASE_ACCESS_TOKEN. Gere em https://supabase.com/dashboard/account/tokens");
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL || "";
const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref) {
  console.error("Não achei o project ref no VITE_SUPABASE_URL");
  process.exit(1);
}

const SITE = "https://gameclub.bf.dev.br";
const REDIRECTS = [
  `${SITE}/**`,
  "http://localhost:5173/**",
  "https://game-club-retro-*-bielfernandes-projects-projects.vercel.app/**",
];

const body = {
  site_url: SITE,
  uri_allow_list: REDIRECTS.join(","),
  // barra signup fora da allowlist
  hook_before_user_created_enabled: true,
  hook_before_user_created_uri: "pg-functions://postgres/public/hook_before_user_created",
  // magic link ativo, sem confirmação extra
  external_email_enabled: true,
  mailer_autoconfirm: false,
};

const resendKey = process.env.RESEND_API_KEY;
if (resendKey) {
  Object.assign(body, {
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: resendKey,
    smtp_admin_email: process.env.SMTP_SENDER_EMAIL || "clube@bf.dev.br",
    smtp_sender_name: "Game Club Retrô",
    smtp_max_frequency: 5,
  });
}

const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;

async function patch(payload) {
  const r = await fetch(api, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

console.log(`Projeto ${ref} — aplicando config de auth...`);
let res = await patch(body);

// bug conhecido: PATCH /config/auth às vezes falha junto com campos de hook.
// Se falhar, tenta sem os campos de hook e avisa pra ligar no dashboard.
if (!res.ok && /hook/i.test(res.text)) {
  console.warn("PATCH com hook falhou — tentando sem o hook (ligue no dashboard depois).");
  const { hook_before_user_created_enabled, hook_before_user_created_uri, ...rest } = body;
  res = await patch(rest);
}

if (res.ok) {
  console.log("✅ Auth configurado.");
  console.log("   Site URL:", SITE);
  console.log("   Redirects:", REDIRECTS.join(" · "));
  console.log(resendKey ? "   SMTP: Resend" : "   SMTP: nativo (troque por Resend — RESEND_API_KEY)");
  console.log(
    body.hook_before_user_created_enabled
      ? "   Hook before-user-created: pedido (confira em Auth → Hooks)"
      : "   ⚠ Hook before-user-created: LIGUE no dashboard (Auth → Hooks → public.hook_before_user_created)",
  );
} else {
  console.error(`❌ Falhou (${res.status}): ${res.text.slice(0, 400)}`);
  console.error("Faça pelo dashboard — ver SETUP.md item 2, opção B.");
  process.exitCode = 1;
}

// mostra o que ficou
try {
  const cur = await fetch(api, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json());
  console.log("\nEstado atual (trecho):", JSON.stringify({
    site_url: cur.site_url,
    uri_allow_list: cur.uri_allow_list,
    smtp_host: cur.smtp_host,
    hook_before_user_created_enabled: cur.hook_before_user_created_enabled,
  }, null, 2));
} catch {
  void readFileSync; // noop
}
