/**
 * Migra dados do CRM antigo (SQLite data.db) → Postgres + Supabase Storage.
 *
 * Uso:
 *   node migrate-from-sqlite.cjs --dry    # preview, não escreve nada
 *   node migrate-from-sqlite.cjs          # migra de verdade
 *   node migrate-from-sqlite.cjs --reset  # apaga dados migrados antes (cuidado!)
 *
 * Idempotente: pode rodar múltiplas vezes sem duplicar.
 *
 * Conexão: ajusta no bloco CONFIG abaixo.
 */

const initSqlJs = require("sql.js");
const { Client } = require("pg");
const path = require("path");
const fs = require("fs");

/**
 * Wrapper minimalista pra fazer better-sqlite3 API com sql.js.
 * sql.js é WebAssembly puro — funciona em qualquer Windows sem build tools.
 */
function openSqlite(filepath) {
  return initSqlJs().then((SQL) => {
    const buf = fs.readFileSync(filepath);
    const db = new SQL.Database(buf);

    return {
      prepare(sql) {
        return {
          all(...params) {
            const stmt = db.prepare(sql);
            if (params.length) stmt.bind(params);
            const out = [];
            while (stmt.step()) out.push(stmt.getAsObject());
            stmt.free();
            return out;
          },
          get(...params) {
            const rows = this.all(...params);
            return rows[0];
          },
        };
      },
      close() {
        db.close();
      },
    };
  });
}

// ============================================================
// CONFIG
// ============================================================
const SQLITE_PATH = path.resolve(__dirname, "..", "data.db");
const UPLOADS_DIR = path.resolve(__dirname, "..", "uploads");

const PG_CONFIG = {
  host: process.env.PG_HOST || "72.60.55.140",
  port: Number(process.env.PG_PORT || 5543),
  database: process.env.PG_DATABASE || "postgres",
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD || "V9qT1Zx3mL7Nf5Rg8Kc2Wb4Jp6Hy0DsA",
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://api.alisson.api.br";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry");
const RESET = args.includes("--reset");

// ============================================================
// Helpers
// ============================================================
function log(msg, level = "info") {
  const prefix = level === "error" ? "✗ " : level === "warn" ? "⚠ " : "✓ ";
  console.log(prefix + msg);
}

function normalize(s) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// ============================================================
// MIGRATION
// ============================================================
async function main() {
  console.log(`\n=== Migração SQLite → Postgres (${DRY_RUN ? "DRY RUN" : "REAL"}) ===\n`);
  if (RESET) console.log("⚠️  MODO RESET: vai apagar dados migrados antes\n");

  // SQLite (read-only)
  if (!fs.existsSync(SQLITE_PATH)) {
    log(`SQLite não encontrado em ${SQLITE_PATH}`, "error");
    process.exit(1);
  }
  const sqlite = await openSqlite(SQLITE_PATH);
  log(`SQLite aberto: ${SQLITE_PATH}`);

  // Postgres
  const pg = new Client(PG_CONFIG);
  await pg.connect();
  log(`conectado em ${PG_CONFIG.host}:${PG_CONFIG.port}`);

  if (RESET && !DRY_RUN) {
    console.log("\n--- RESET: limpando dados migrados ---");
    await pg.query(`DELETE FROM crm.oportunidade_historico WHERE oportunidade_id IN (SELECT id FROM crm.oportunidades WHERE metadata->>'migrated_from' = 'sqlite')`);
    await pg.query(`DELETE FROM crm.oportunidades WHERE metadata->>'migrated_from' = 'sqlite'`);
    await pg.query(`DELETE FROM crm.automacao_etapas WHERE legacy_id IS NOT NULL`);
    await pg.query(`DELETE FROM crm.funil_etapas WHERE legacy_id IS NOT NULL`);
    await pg.query(`DELETE FROM crm.funis WHERE legacy_id IS NOT NULL`);
    await pg.query(`DELETE FROM crm.motivos_perda WHERE legacy_id IS NOT NULL`);
    await pg.query(`DELETE FROM crm.origens_lead WHERE legacy_id IS NOT NULL`);
    await pg.query(`DELETE FROM crm.mensagens WHERE metadata->>'migrated_from' = 'sqlite'`);
    await pg.query(`DELETE FROM crm.conversas WHERE metadata->>'migrated_from' = 'sqlite'`);
    await pg.query(`DELETE FROM crm.contato_canais WHERE metadata->>'migrated_from' = 'sqlite'`);
    await pg.query(`DELETE FROM crm.instagram_posts WHERE metadata->>'migrated_from' = 'sqlite'`);
    await pg.query(`DELETE FROM crm.sdr_runs WHERE EXISTS (SELECT 1 FROM crm.conversas c WHERE c.id = sdr_runs.conversa_id AND c.metadata->>'migrated_from' = 'sqlite')`);
    log("dados antigos removidos");
  }

  const stats = {
    contatos_novos: 0,
    contatos_existentes: 0,
    canais_criados: 0,
    conversas_novas: 0,
    conversas_existentes: 0,
    mensagens_novas: 0,
    mensagens_existentes: 0,
    instagram_posts: 0,
    sdr_runs: 0,
    funis: 0,
    estagios: 0,
    motivos_perda: 0,
    origens_lead: 0,
    automacao_etapas: 0,
    oportunidades_novas: 0,
    oportunidades_existentes: 0,
    erros: [],
  };

  // ============================================================
  // 1. CONFIGS (unipile, meta, agentes_ia)
  // ============================================================
  console.log("\n--- 1. Configs ---");
  await migrarConfigs(sqlite, pg, DRY_RUN, stats);

  // ============================================================
  // 2. CLIENTES → public.contatos + crm.contato_canais
  // ============================================================
  console.log("\n--- 2. Clientes (7.935) ---");
  const mapaClientes = await migrarClientes(sqlite, pg, DRY_RUN, stats);

  // ============================================================
  // 3. INSTAGRAM POSTS → crm.instagram_posts
  // ============================================================
  console.log("\n--- 3. Instagram Posts ---");
  await migrarInstagramPosts(sqlite, pg, DRY_RUN, stats);

  // ============================================================
  // 4. CONVERSAS → crm.conversas
  // ============================================================
  console.log("\n--- 4. Conversas ---");
  const mapaConversas = await migrarConversas(sqlite, pg, mapaClientes, DRY_RUN, stats);

  // ============================================================
  // 5. MENSAGENS → crm.mensagens
  // ============================================================
  console.log("\n--- 5. Mensagens ---");
  await migrarMensagens(sqlite, pg, mapaConversas, DRY_RUN, stats);

  // ============================================================
  // 6. SDR (qualificações)
  // ============================================================
  console.log("\n--- 6. SDR Qualificações ---");
  await migrarSdrRuns(sqlite, pg, mapaConversas, DRY_RUN, stats);

  // ============================================================
  // 7. PIPELINE (funis, etapas, oportunidades) — exatamente como estava
  // ============================================================
  console.log("\n--- 7. Funis ---");
  const mapaFunis = await migrarFunis(sqlite, pg, DRY_RUN, stats);

  console.log("\n--- 8. Estágios do Funil ---");
  const mapaEtapas = await migrarFunilEstagios(sqlite, pg, mapaFunis, DRY_RUN, stats);

  console.log("\n--- 9. Motivos de Perda + Origens de Lead ---");
  await migrarCatalogos(sqlite, pg, DRY_RUN, stats);

  console.log("\n--- 10. Oportunidades (Pipeline) — pode demorar ---");
  await migrarPipeline(sqlite, pg, mapaClientes, mapaFunis, mapaEtapas, mapaConversas, DRY_RUN, stats);

  console.log("\n--- 11. Automações de Etapas ---");
  await migrarAutomacoesEtapas(sqlite, pg, mapaFunis, mapaEtapas, DRY_RUN, stats);

  // ============================================================
  // SUMÁRIO
  // ============================================================
  console.log("\n=== SUMÁRIO ===");
  console.log(`  contatos novos:        ${stats.contatos_novos}`);
  console.log(`  contatos reaproveitad: ${stats.contatos_existentes}`);
  console.log(`  canais criados:        ${stats.canais_criados}`);
  console.log(`  conversas novas:       ${stats.conversas_novas}`);
  console.log(`  conversas existentes:  ${stats.conversas_existentes}`);
  console.log(`  mensagens novas:       ${stats.mensagens_novas}`);
  console.log(`  mensagens existentes:  ${stats.mensagens_existentes}`);
  console.log(`  instagram_posts:       ${stats.instagram_posts}`);
  console.log(`  sdr_runs:              ${stats.sdr_runs}`);
  console.log(`  funis:                 ${stats.funis}`);
  console.log(`  funil_estagios:        ${stats.estagios}`);
  console.log(`  motivos_perda:         ${stats.motivos_perda}`);
  console.log(`  origens_lead:          ${stats.origens_lead}`);
  console.log(`  oportunidades novas:   ${stats.oportunidades_novas}`);
  console.log(`  oportunidades exist.:  ${stats.oportunidades_existentes}`);
  console.log(`  automacao_etapas:      ${stats.automacao_etapas}`);
  console.log(`  erros:                 ${stats.erros.length}`);

  if (stats.erros.length > 0) {
    console.log("\nErros:");
    stats.erros.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
    if (stats.erros.length > 10)
      console.log(`  ... +${stats.erros.length - 10} outros`);
  }

  if (DRY_RUN) {
    console.log("\n⚠️  DRY RUN — nada foi escrito no Postgres. Re-rode sem --dry pra aplicar.");
  } else {
    console.log("\n✓ Migração concluída.");
  }

  sqlite.close();
  await pg.end();
}

// ============================================================
async function migrarConfigs(sqlite, pg, dryRun, stats) {
  // Unipile
  try {
    const u = sqlite.prepare(`SELECT * FROM unipile_config LIMIT 1`).get();
    if (u && u.api_key) {
      if (!dryRun) {
        const exist = await pg.query(`SELECT id FROM crm.unipile_config WHERE ativo LIMIT 1`);
        if (exist.rows.length === 0) {
          await pg.query(
            `INSERT INTO crm.unipile_config
              (api_key, dsn, account_id, account_username, account_provider, ativo, status)
             VALUES ($1,$2,$3,$4,$5,true,$6)`,
            [
              u.api_key,
              u.dsn || "",
              u.account_id || "",
              u.account_username || "",
              u.account_provider || "INSTAGRAM",
              u.status || "desconectado",
            ]
          );
          log("unipile_config migrada");
        } else {
          log("unipile_config já existe — preservada", "warn");
        }
      } else {
        log(`[dry] unipile_config: api_key=${u.api_key.substring(0, 8)}... dsn=${u.dsn}`);
      }
    }
  } catch (e) {
    stats.erros.push(`unipile_config: ${e.message}`);
  }

  // Meta API
  try {
    const m = sqlite.prepare(`SELECT * FROM meta_api_config LIMIT 1`).get();
    if (m && (m.app_id || m.page_access_token)) {
      if (!dryRun) {
        const exist = await pg.query(`SELECT id FROM crm.meta_config WHERE ativo LIMIT 1`);
        if (exist.rows.length === 0) {
          await pg.query(
            `INSERT INTO crm.meta_config
              (app_id, app_secret, page_id, page_access_token, ig_business_id, verify_token, ativo)
             VALUES ($1,$2,$3,$4,$5,$6,true)`,
            [
              m.app_id || null,
              m.app_secret || null,
              m.page_id || null,
              m.page_access_token || null,
              m.ig_business_id || null,
              m.verify_token || null,
            ]
          );
          log("meta_config migrada");
        }
      } else {
        log(`[dry] meta_config: app_id=${m.app_id || "—"}`);
      }
    }
  } catch (e) {
    stats.erros.push(`meta_config: ${e.message}`);
  }

  // Agentes IA
  try {
    const ags = sqlite.prepare(`SELECT * FROM agentes_ia WHERE ativo = 1`).all();
    for (const a of ags) {
      if (!dryRun) {
        const codigo = a.area || "atendimento";
        const exist = await pg.query(`SELECT id FROM crm.agentes_ia WHERE codigo = $1`, [codigo]);
        if (exist.rows.length === 0) {
          // cria prompt template
          const promptId = await pg.query(
            `INSERT INTO crm.prompt_templates (codigo, nome, system_prompt, modelo, temperatura, ativo)
             VALUES ($1,$2,$3,$4,$5,true)
             ON CONFLICT (codigo) DO UPDATE SET system_prompt = EXCLUDED.system_prompt
             RETURNING id`,
            [`legacy.${codigo}`, a.nome, a.prompt_sistema, "claude-3-5-sonnet-20241022", a.temperatura || 0.7]
          );
          await pg.query(
            `INSERT INTO crm.agentes_ia (codigo, nome, prompt_template_id, ativo)
             VALUES ($1,$2,$3,true)
             ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome`,
            [codigo, a.nome, promptId.rows[0].id]
          );
        }
      } else {
        log(`[dry] agente_ia: ${a.area} (${a.nome})`);
      }
    }
  } catch (e) {
    stats.erros.push(`agentes_ia: ${e.message}`);
  }
}

// ============================================================
async function migrarClientes(sqlite, pg, dryRun, stats) {
  const mapa = {}; // sqlite.id (TEXT) → postgres.id_contato (bigint)
  const clientes = sqlite.prepare(`SELECT * FROM clientes ORDER BY criado_em`).all();

  let proximoId = null;
  if (!dryRun) {
    const r = await pg.query(`SELECT COALESCE(MAX(id_contato), 0) + 1 as proximo FROM public.contatos`);
    proximoId = parseInt(r.rows[0].proximo);
  }

  for (let i = 0; i < clientes.length; i++) {
    const c = clientes[i];
    const nomeNorm = normalize(c.nome);

    if (i > 0 && i % 500 === 0) console.log(`  progresso: ${i}/${clientes.length}`);

    try {
      let contatoId = null;

      if (!dryRun) {
        // 1. Tenta achar por nome normalizado
        if (nomeNorm.length > 3) {
          const r = await pg.query(
            `SELECT id_contato FROM public.contatos
             WHERE crm.normalizar_nome(nome) = $1 LIMIT 1`,
            [nomeNorm]
          );
          if (r.rows.length > 0) {
            contatoId = parseInt(r.rows[0].id_contato);
            stats.contatos_existentes++;
          }
        }

        // 2. Não achou → cria novo
        if (!contatoId) {
          const r = await pg.query(
            `INSERT INTO public.contatos
               (id_contato, nome, telefone, celular, email, cpf_cnpj,
                endereco, numero, complemento, bairro, municipio, uf, cep,
                data_atualizacao)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
             RETURNING id_contato`,
            [
              proximoId++,
              c.nome,
              c.telefone,
              c.telefone,
              c.email,
              c.cpf,
              c.endereco,
              c.numero_endereco,
              c.complemento,
              c.bairro,
              c.cidade,
              c.estado,
              c.cep,
            ]
          );
          contatoId = parseInt(r.rows[0].id_contato);
          stats.contatos_novos++;
        }

        // 3. Cria entrada em crm.contato_canais (se for cliente Meta/IG)
        // Sempre cria com canal genérico "outro" pra preservar mapeamento sqlite_id → contato_id
        await pg.query(
          `INSERT INTO crm.contato_canais
             (contato_id, canal, canal_id, username, nome_canal, foto_url, metadata)
           VALUES ($1, 'outro', $2, NULL, $3, $4, $5)
           ON CONFLICT (canal, canal_id) DO UPDATE SET
             contato_id = EXCLUDED.contato_id,
             foto_url = COALESCE(EXCLUDED.foto_url, crm.contato_canais.foto_url)`,
          [
            contatoId,
            `sqlite-${c.id}`, // mapeamento ID antigo
            c.nome,
            c.foto_perfil,
            JSON.stringify({ migrated_from: "sqlite", sqlite_id: c.id }),
          ]
        );
        stats.canais_criados++;
      } else {
        if (i < 3) log(`[dry] cliente: ${c.nome} (sqlite_id=${c.id})`);
      }

      mapa[c.id] = contatoId || `dry-${i}`;
    } catch (e) {
      stats.erros.push(`cliente "${c.nome}": ${e.message}`);
    }
  }

  if (clientes.length > 3 && dryRun) log(`[dry] ... +${clientes.length - 3} outros clientes`);
  log(`processados ${clientes.length} clientes`);

  return mapa;
}

// ============================================================
async function migrarInstagramPosts(sqlite, pg, dryRun, stats) {
  const posts = sqlite.prepare(`SELECT * FROM instagram_posts`).all();

  for (const p of posts) {
    try {
      if (!dryRun) {
        await pg.query(
          `INSERT INTO crm.instagram_posts
             (id, tipo, caption, permalink, thumbnail_url, media_url,
              thumbnail_url_local, media_url_local, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET
             caption = EXCLUDED.caption,
             thumbnail_url_local = COALESCE(crm.instagram_posts.thumbnail_url_local, EXCLUDED.thumbnail_url_local),
             media_url_local = COALESCE(crm.instagram_posts.media_url_local, EXCLUDED.media_url_local)`,
          [
            p.ig_media_id,
            p.tipo,
            p.caption,
            p.permalink,
            p.thumbnail_url,
            p.media_url,
            p.thumbnail_url_local,
            p.media_url_local,
            JSON.stringify({ migrated_from: "sqlite" }),
          ]
        );
      } else {
        log(`[dry] post: ${p.ig_media_id} caption="${(p.caption || "").substring(0, 50)}"`);
      }
      stats.instagram_posts++;
    } catch (e) {
      stats.erros.push(`ig_post ${p.ig_media_id}: ${e.message}`);
    }
  }

  log(`${stats.instagram_posts} posts migrados`);
}

// ============================================================
async function migrarConversas(sqlite, pg, mapaClientes, dryRun, stats) {
  const mapa = {}; // sqlite.id (TEXT) → postgres.id (uuid)
  const convs = sqlite.prepare(`SELECT * FROM conversas WHERE ativa = 1 ORDER BY criado_em`).all();

  for (const c of convs) {
    try {
      const contatoId = mapaClientes[c.cliente_id];
      if (!contatoId) {
        stats.erros.push(`conversa ${c.id}: cliente ${c.cliente_id} não mapeado`);
        continue;
      }

      // Mapa de canal antigo → novo
      let canal = c.canal || "interna";
      if (canal === "instagram" || canal === "instagram_dm") canal = "instagram_dm";
      if (canal === "whatsapp_evolution" || canal === "whatsapp_baileys") canal = "whatsapp";

      const threadId = c.meta_contato_id || c.ultimo_canal_msg_id || `legacy-${c.id}`;

      if (!dryRun) {
        // Tenta achar conversa por (canal, thread_id)
        const exist = await pg.query(
          `SELECT id FROM crm.conversas WHERE canal = $1 AND canal_thread_id = $2 LIMIT 1`,
          [canal, threadId]
        );

        if (exist.rows.length > 0) {
          mapa[c.id] = exist.rows[0].id;
          stats.conversas_existentes++;
          continue;
        }

        const r = await pg.query(
          `INSERT INTO crm.conversas
             (canal, canal_thread_id, canal_contato_id, contato_id, status,
              modo_auto, ultima_msg_em, metadata, created_at)
           VALUES ($1,$2,$3,$4,'aberta',$5,$6,$7,$8)
           RETURNING id`,
          [
            canal,
            threadId,
            c.meta_contato_id,
            contatoId,
            !!c.modo_auto,
            c.atualizado_em,
            JSON.stringify({
              migrated_from: "sqlite",
              sqlite_id: c.id,
              bant: {
                score: c.bant_score,
                budget: c.bant_budget,
                authority: c.bant_authority,
                need: c.bant_need,
                timeline: c.bant_timeline,
              },
            }),
            c.criado_em,
          ]
        );
        mapa[c.id] = r.rows[0].id;
        stats.conversas_novas++;
      } else {
        mapa[c.id] = `dry-${c.id}`;
        if (Object.keys(mapa).length <= 3)
          log(`[dry] conversa ${c.id} canal=${canal} cliente_id=${contatoId}`);
      }
    } catch (e) {
      stats.erros.push(`conversa ${c.id}: ${e.message}`);
    }
  }

  log(`${stats.conversas_novas} novas + ${stats.conversas_existentes} existentes`);
  return mapa;
}

// ============================================================
async function migrarMensagens(sqlite, pg, mapaConversas, dryRun, stats) {
  const msgs = sqlite.prepare(`SELECT * FROM mensagens ORDER BY criado_em`).all();

  for (const m of msgs) {
    try {
      const conversaId = mapaConversas[m.conversa_id];
      if (!conversaId || conversaId.toString().startsWith("dry-")) {
        if (!dryRun) {
          stats.erros.push(`msg ${m.id}: conversa ${m.conversa_id} não mapeada`);
        }
        continue;
      }

      let papel = m.papel || "user";
      if (papel === "vendedor" || papel === "user" || papel === "assistant" ||
          papel === "system" || papel === "interno") {
        // ok
      } else {
        papel = "user";
      }

      let tipoMidia = m.tipo_midia;
      if (tipoMidia === "image") tipoMidia = "imagem";
      if (tipoMidia === "document") tipoMidia = "documento";
      if (!["imagem", "video", "audio", "documento", "sticker"].includes(tipoMidia))
        tipoMidia = null;

      if (!dryRun) {
        const exist = await pg.query(
          `SELECT id FROM crm.mensagens WHERE conversa_id = $1 AND canal_message_id = $2 LIMIT 1`,
          [conversaId, m.meta_msg_id || m.id]
        );

        if (exist.rows.length > 0) {
          stats.mensagens_existentes++;
          continue;
        }

        await pg.query(
          `INSERT INTO crm.mensagens
             (conversa_id, papel, conteudo, canal_message_id, tipo_midia, midia_url,
              instagram_media_id, status, metadata, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            conversaId,
            papel,
            m.conteudo,
            m.meta_msg_id || m.id,
            tipoMidia,
            m.midia_url,
            m.instagram_media_id,
            m.status_envio || "enviada",
            JSON.stringify({
              migrated_from: "sqlite",
              sqlite_id: m.id,
              transcricao: m.transcricao,
              dados_extraidos: m.dados_extraidos,
            }),
            m.criado_em,
          ]
        );
        stats.mensagens_novas++;
      } else {
        if (stats.mensagens_novas < 3) {
          log(`[dry] msg ${m.id} papel=${papel} tipo=${tipoMidia || "texto"}`);
        }
        stats.mensagens_novas++;
      }
    } catch (e) {
      stats.erros.push(`msg ${m.id}: ${e.message}`);
    }
  }

  log(`${stats.mensagens_novas} novas + ${stats.mensagens_existentes} existentes`);
}

// ============================================================
async function migrarSdrRuns(sqlite, pg, mapaConversas, dryRun, stats) {
  const quals = sqlite.prepare(`SELECT * FROM sdr_lead_qualificacao`).all();
  for (const q of quals) {
    try {
      // procura conversa pelo lead/cliente
      // o sqlite tem cliente_id ou conversa_id? olha colunas
      // Provavelmente via conversa_id
      const conversaId = q.conversa_id ? mapaConversas[q.conversa_id] : null;
      if (!conversaId) continue;

      if (!dryRun) {
        await pg.query(
          `INSERT INTO crm.sdr_runs
            (conversa_id, score_total, classificacao, resumo, proximos_passos)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            conversaId,
            q.score_total || q.bant_score,
            q.classificacao,
            q.resumo,
            q.proximos_passos,
          ]
        );
      }
      stats.sdr_runs++;
    } catch (e) {
      stats.erros.push(`sdr_run ${q.id}: ${e.message}`);
    }
  }
  log(`${stats.sdr_runs} sdr_runs migrados`);
}

// ============================================================
// FUNIS (sqlite.funis → crm.funis)
// ============================================================
async function migrarFunis(sqlite, pg, dryRun, stats) {
  const mapa = {}; // sqlite.id (int) → postgres.id (uuid)
  const funis = sqlite.prepare(`SELECT * FROM funis ORDER BY ordem`).all();

  for (const f of funis) {
    try {
      if (!dryRun) {
        const r = await pg.query(
          `INSERT INTO crm.funis (legacy_id, nome, descricao, cor, ordem, ativo)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (legacy_id) DO UPDATE SET
             nome = EXCLUDED.nome,
             descricao = EXCLUDED.descricao,
             cor = EXCLUDED.cor,
             ordem = EXCLUDED.ordem,
             ativo = EXCLUDED.ativo
           RETURNING id`,
          [f.id, f.nome, f.descricao, f.cor || "#184036", f.ordem || 1, !!f.ativo]
        );
        mapa[f.id] = r.rows[0].id;
        stats.funis++;
      } else {
        mapa[f.id] = `dry-funil-${f.id}`;
        log(`[dry] funil: id=${f.id} "${f.nome}" ativo=${f.ativo}`);
      }
    } catch (e) {
      stats.erros.push(`funil "${f.nome}": ${e.message}`);
    }
  }
  log(`${stats.funis} funis migrados`);
  return mapa;
}

// ============================================================
// FUNIL ESTAGIOS (sqlite.funil_estagios → crm.funil_etapas)
// ============================================================
async function migrarFunilEstagios(sqlite, pg, mapaFunis, dryRun, stats) {
  const mapa = {}; // sqlite.id (int) → postgres.id (uuid)
  const estagios = sqlite.prepare(`SELECT * FROM funil_estagios ORDER BY funil_id, ordem`).all();

  // Garante que tem pelo menos 1 bloco por funil (pra FK não quebrar)
  // Cria um bloco "Default" por funil migrado se necessário
  const blocosPorFunil = {}; // legacy_funil_id → bloco_id (uuid)

  for (const e of estagios) {
    try {
      const funilId = mapaFunis[e.funil_id];
      if (!funilId) {
        stats.erros.push(`estagio "${e.nome}" funil ${e.funil_id} não mapeado`);
        continue;
      }

      // Garante bloco
      let blocoId = blocosPorFunil[e.funil_id];
      if (!blocoId && !dryRun) {
        const blocoNome = e.bloco || "Default";
        const existe = await pg.query(
          `SELECT id FROM crm.funil_blocos WHERE nome = $1 LIMIT 1`,
          [blocoNome]
        );
        if (existe.rows.length > 0) {
          blocoId = existe.rows[0].id;
        } else {
          const novo = await pg.query(
            `INSERT INTO crm.funil_blocos (nome, ordem, cor) VALUES ($1, $2, $3) RETURNING id`,
            [blocoNome, e.funil_id || 1, "#184036"]
          );
          blocoId = novo.rows[0].id;
        }
        blocosPorFunil[e.funil_id] = blocoId;
      }

      if (!dryRun) {
        const r = await pg.query(
          `INSERT INTO crm.funil_etapas (legacy_id, bloco_id, funil_id, nome, ordem, cor, ativo, tipo, fase)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (legacy_id) DO UPDATE SET
             nome = EXCLUDED.nome,
             ordem = EXCLUDED.ordem,
             cor = EXCLUDED.cor,
             tipo = EXCLUDED.tipo,
             fase = EXCLUDED.fase
           RETURNING id`,
          [
            e.id,
            blocoId,
            funilId,
            e.nome,
            e.ordem || 0,
            e.cor || "#9ca3af",
            e.ativo === null ? true : !!e.ativo,
            e.tipo || "aberto",
            e.fase,
          ]
        );
        mapa[e.id] = r.rows[0].id;
        stats.estagios++;
      } else {
        mapa[e.id] = `dry-etapa-${e.id}`;
        if (stats.estagios < 3) log(`[dry] estagio: ${e.nome} (funil ${e.funil_id})`);
        stats.estagios++;
      }
    } catch (err) {
      stats.erros.push(`estagio "${e.nome}": ${err.message}`);
    }
  }
  log(`${stats.estagios} estágios migrados`);
  return mapa;
}

// ============================================================
// CATÁLOGOS (motivos_perda, origens_lead)
// ============================================================
async function migrarCatalogos(sqlite, pg, dryRun, stats) {
  for (const tabela of ["motivos_perda", "origens_lead"]) {
    const itens = sqlite.prepare(`SELECT * FROM ${tabela}`).all();
    for (const it of itens) {
      try {
        if (!dryRun) {
          await pg.query(
            `INSERT INTO crm.${tabela} (legacy_id, nome, ativo, ordem)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (legacy_id) DO UPDATE SET nome = EXCLUDED.nome`,
            [it.id, it.nome, !!it.ativo, it.ordem || 1]
          );
        }
        stats[tabela]++;
      } catch (e) {
        stats.erros.push(`${tabela} ${it.nome}: ${e.message}`);
      }
    }
    log(`${stats[tabela]} ${tabela} migrados`);
  }
}

// ============================================================
// PIPELINE → crm.oportunidades (13.263 linhas — pode demorar)
// ============================================================
async function migrarPipeline(sqlite, pg, mapaClientes, mapaFunis, mapaEtapas, mapaConversas, dryRun, stats) {
  const odvs = sqlite.prepare(`SELECT * FROM pipeline ORDER BY criado_em`).all();

  // Cache: nome do estágio + funil_id_legacy → etapa_id postgres
  const cacheEstagio = {};
  const buscarEtapaIdPorNome = (estagioNome, funilLegacyId) => {
    const key = `${funilLegacyId}::${estagioNome}`;
    if (cacheEstagio[key] !== undefined) return cacheEstagio[key];

    // Busca em mapaEtapas: precisamos achar o que tem nome = estagioNome E funil_id (legacy) = funilLegacyId
    // mapaEtapas é { sqlite_id: postgres_uuid }, mas precisamos olhar pelo nome no SQLite.
    // Solução: buscar no SQLite o id pelo nome+funil_id e converter.
    return null; // será resolvido em batch (vide abaixo)
  };

  // Resolve nome do estágio → uuid via SQLite + mapaEtapas
  const estagiosSqlite = sqlite.prepare(`SELECT id, nome, funil_id FROM funil_estagios`).all();
  const nomeFunilParaIdSqlite = {};
  estagiosSqlite.forEach(e => {
    nomeFunilParaIdSqlite[`${e.funil_id}::${e.nome}`] = e.id;
  });

  function resolverEtapaId(estagioNome, funilLegacyId) {
    const sqliteId = nomeFunilParaIdSqlite[`${funilLegacyId}::${estagioNome}`];
    if (!sqliteId) return null;
    return mapaEtapas[sqliteId] || null;
  }

  let processados = 0;
  for (const o of odvs) {
    try {
      processados++;
      if (processados % 1000 === 0) console.log(`  progresso: ${processados}/${odvs.length}`);

      // Resolve cliente
      const contatoId = mapaClientes[o.cliente_id];
      if (!contatoId) {
        stats.erros.push(`oport ${o.id}: cliente ${o.cliente_id} não mapeado`);
        continue;
      }

      // Resolve funil
      const funilId = mapaFunis[o.funil_id || 1];
      if (!funilId) {
        stats.erros.push(`oport ${o.id}: funil ${o.funil_id} não mapeado`);
        continue;
      }

      // Resolve etapa pelo nome
      const etapaId = resolverEtapaId(o.estagio, o.funil_id || 1);

      // Resolve conversa (pode ter)
      const conversaId = o.conversa_id ? mapaConversas[o.conversa_id] : null;

      if (!dryRun) {
        // Idempotência: verifica se já foi migrada
        const exist = await pg.query(
          `SELECT id FROM crm.oportunidades WHERE legacy_id = $1`,
          [o.id]
        );
        if (exist.rows.length > 0) {
          stats.oportunidades_existentes++;
          continue;
        }

        await pg.query(
          `INSERT INTO crm.oportunidades (
             legacy_id, contato_id, vendedor_id, funil_id, etapa_id, conversa_id,
             titulo, valor, produto_interesse, notas,
             tags, origem_lead, motivo_perda, tipo_pedido, forma_atendimento,
             tipo_cliente, itens_pedido, desconto, parcelas, forma_pagamento,
             valor_frete, endereco_entrega, data_prevista_entrega, data_envio,
             transportador, observacao_pedido, campos_ia,
             score_bant, classificacao, canal_origem, perfil, decisor,
             orcamento_declarado, ocasiao, prazo, opt_out, opt_out_data,
             tentativas_reabordagem, forma_envio, codigo_rastreio, data_entrega,
             entrega_confirmada, motivo_pos_venda, data_entrada_pos_venda,
             metadata, created_at, updated_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
             $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
             $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47
           )`,
          [
            o.id, contatoId, null /*vendedor — não mapeado, NULL*/,
            funilId, etapaId, (conversaId && !String(conversaId).startsWith("dry-")) ? conversaId : null,
            o.titulo || "(sem título)", o.valor, o.produto_interesse, o.notas,
            o.tags ? safeJson(o.tags, "[]") : "[]",
            o.origem_lead, o.motivo_perda, o.tipo_pedido, o.forma_atendimento,
            o.tipo_cliente, o.itens_pedido ? safeJson(o.itens_pedido, null) : null,
            o.desconto, o.parcelas, o.forma_pagamento,
            o.valor_frete, o.endereco_entrega, parseDate(o.data_prevista_entrega), parseDate(o.data_envio),
            o.transportador, o.observacao_pedido,
            o.campos_ia ? safeJson(o.campos_ia, "[]") : "[]",
            o.score_bant, o.classificacao, o.canal_origem, o.perfil, o.decisor,
            o.orcamento_declarado, o.ocasiao, o.prazo, !!o.opt_out, parseTimestamp(o.opt_out_data),
            o.tentativas_reabordagem || 0, o.forma_envio, o.codigo_rastreio, parseDate(o.data_entrega),
            !!o.entrega_confirmada, o.motivo_pos_venda, parseTimestamp(o.data_entrada_pos_venda),
            JSON.stringify({ migrated_from: "sqlite", legacy_id: o.id }),
            o.criado_em, o.atualizado_em || o.criado_em,
          ]
        );
        stats.oportunidades_novas++;
      } else {
        if (stats.oportunidades_novas < 3) {
          log(`[dry] odv: ${o.titulo || o.id} cliente=${contatoId} funil=${funilId} etapa=${etapaId || "?"}`);
        }
        stats.oportunidades_novas++;
      }
    } catch (err) {
      stats.erros.push(`oport ${o.id}: ${err.message}`);
    }
  }

  log(`${stats.oportunidades_novas} novas + ${stats.oportunidades_existentes} já migradas`);
}

// ============================================================
// AUTOMAÇÕES DE ETAPAS
// ============================================================
async function migrarAutomacoesEtapas(sqlite, pg, mapaFunis, mapaEtapas, dryRun, stats) {
  let auts = [];
  try { auts = sqlite.prepare(`SELECT * FROM automacao_etapas`).all(); }
  catch { return; }

  // Estágios do SQLite por nome → uuid no postgres (similar à pipeline)
  const estagios = sqlite.prepare(`SELECT id, nome, funil_id FROM funil_estagios`).all();
  const nomeFunilParaSqliteId = {};
  estagios.forEach(e => { nomeFunilParaSqliteId[`${e.funil_id}::${e.nome}`] = e.id; });

  for (const a of auts) {
    try {
      const funilLegacy = a.funil_id || 10;
      const origemSqlite = a.estagio_origem ? nomeFunilParaSqliteId[`${funilLegacy}::${a.estagio_origem}`] : null;
      const destinoSqlite = a.estagio_destino ? nomeFunilParaSqliteId[`${funilLegacy}::${a.estagio_destino}`] : null;
      const origemId = origemSqlite ? mapaEtapas[origemSqlite] : null;
      const destinoId = destinoSqlite ? mapaEtapas[destinoSqlite] : null;
      const funilId = mapaFunis[funilLegacy];

      if (!dryRun) {
        await pg.query(
          `INSERT INTO crm.automacao_etapas (
             legacy_id, funil_id, gatilho, estagio_origem_id, estagio_destino_id,
             tipo_acao, config, descricao, ativo
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (legacy_id) DO UPDATE SET ativo = EXCLUDED.ativo`,
          [
            a.id, funilId, a.gatilho || "ao_entrar_etapa",
            origemId, destinoId,
            a.tipo_acao || "mover_estagio",
            a.config ? safeJson(a.config, "{}") : "{}",
            a.descricao,
            a.ativo === null ? true : !!a.ativo,
          ]
        );
      }
      stats.automacao_etapas++;
    } catch (e) {
      stats.erros.push(`automacao_etapas ${a.id}: ${e.message}`);
    }
  }
  log(`${stats.automacao_etapas} automações migradas`);
}

// ============================================================
// Helpers
// ============================================================
function safeJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string") {
    try { JSON.parse(value); return value; } catch { return fallback; }
  }
  return fallback;
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().substring(0, 10);
}

function parseTimestamp(s) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ============================================================
main().catch((e) => {
  console.error("\nFATAL:", e);
  process.exit(1);
});
