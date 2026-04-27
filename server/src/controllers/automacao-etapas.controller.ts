import { Request, Response } from 'express';
import { getDb, saveDb } from '../config/database';

function getSystemPromptAutomacao(): string {
  const db = getDb();
  const estagios = db.prepare(
    "SELECT nome, tipo, fase FROM funil_estagios WHERE funil_id = 10 AND ativo = 1 ORDER BY ordem"
  ).all() as any[];
  const listaEstagios = estagios.map((e: any) => e.nome).join(', ');

  return `Voce e um assistente especialista em automacao de funis de venda para um CRM de joalheria.

ETAPAS DO FUNIL ATUAL: ${listaEstagios}

GATILHOS DISPONIVEIS:
- ao_entrar_etapa: dispara quando ODV entra em uma etapa especifica
- ao_cliente_responder: dispara quando o cliente envia mensagem e esta em determinada etapa
- por_lead_score: dispara quando o score BANT do lead atinge um valor (escala 0-150)

ACOES DISPONIVEIS:
- mover_estagio: move a ODV para outra etapa (config: { estagio_alvo: "nome" })
- enviar_whatsapp: envia mensagem WhatsApp ao cliente (config: { mensagem: "texto com {nome} {valor} {estagio}" })
- criar_tarefa: cria tarefa automatica (config: { titulo: "texto", dias_vencimento: N })
- notificar_equipe: notifica a equipe (config: { mensagem: "texto" })
- atualizar_campo: atualiza campo da ODV (config: { campo: "nome_campo", valor: "valor" })

FORMATO DE RESPOSTA:
Responda SEMPRE com um JSON array contendo as automacoes. Cada automacao deve ter:
{
  "gatilho": "ao_entrar_etapa|ao_cliente_responder|por_lead_score",
  "estagio_origem": "etapa onde o lead deve estar (obrigatorio para ao_cliente_responder e por_lead_score)",
  "estagio_destino": "etapa de destino (obrigatorio para ao_entrar_etapa)",
  "tipo_acao": "mover_estagio|enviar_whatsapp|criar_tarefa|notificar_equipe|atualizar_campo",
  "config": { ... configs especificas da acao },
  "descricao": "descricao curta e clara da automacao",
  "explicacao": "texto amigavel explicando o que essa automacao faz para o usuario"
}

REGRAS:
- Use EXATAMENTE os nomes das etapas listadas acima
- Para "mover_estagio", o estagio_alvo vai dentro de config
- Para "por_lead_score", inclua score_minimo (e opcionalmente score_maximo) dentro de config
- Se o usuario pedir algo que nao faz sentido, retorne um JSON com campo "erro" explicando
- Sempre retorne um array, mesmo que seja uma unica automacao
- O campo "explicacao" deve ser conversacional, como se voce estivesse explicando para o usuario
- Se o usuario pedir multiplas automacoes em uma frase, crie todas

Responda SOMENTE o JSON, sem markdown, sem texto antes ou depois.`;
}

async function callAIInternal(userMessage: string): Promise<string> {
  const { ClaudeService } = require('../services/claude.service');
  const claude = new ClaudeService();
  const systemPrompt = getSystemPromptAutomacao();
  return claude.enviarMensagemComVisao(systemPrompt, [
    { role: 'user' as const, content: userMessage }
  ], 2048);
}

export class AutomacaoEtapasController {

  listar(req: Request, res: Response) {
    const db = getDb();
    const funilId = Number(req.query.funil_id) || 10;
    const automacoes = db.prepare(
      'SELECT * FROM automacao_etapas WHERE funil_id = ? ORDER BY COALESCE(estagio_origem, estagio_destino), ordem'
    ).all(funilId);
    res.json(automacoes);
  }

  criar(req: Request, res: Response) {
    const db = getDb();
    const { estagio_origem, estagio_destino, tipo_acao, config, ordem, descricao, funil_id, gatilho } = req.body;

    if (!tipo_acao) {
      return res.status(400).json({ erro: 'tipo_acao e obrigatorio' });
    }

    // Para gatilhos ao_cliente_responder e por_lead_score, estagio_origem é obrigatório
    const tipoGatilho = gatilho || 'ao_entrar_etapa';
    if (tipoGatilho !== 'ao_entrar_etapa' && !estagio_origem) {
      return res.status(400).json({ erro: 'estagio_origem e obrigatorio para este tipo de gatilho' });
    }
    if (tipoGatilho === 'ao_entrar_etapa' && !estagio_destino) {
      return res.status(400).json({ erro: 'estagio_destino e obrigatorio para gatilho ao_entrar_etapa' });
    }

    const result = db.prepare(
      `INSERT INTO automacao_etapas (estagio_origem, estagio_destino, tipo_acao, config, ordem, descricao, funil_id, gatilho)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      estagio_origem || null,
      estagio_destino || null,
      tipo_acao,
      JSON.stringify(config || {}),
      ordem || 0,
      descricao || null,
      funil_id || 10,
      tipoGatilho
    );

    saveDb();
    const ultimo = db.prepare('SELECT * FROM automacao_etapas ORDER BY id DESC LIMIT 1').get();
    res.status(201).json(ultimo);
  }

  atualizar(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const campos: string[] = [];
    const valores: any[] = [];
    const permitidos = ['estagio_origem', 'estagio_destino', 'tipo_acao', 'config', 'ordem', 'ativo', 'descricao', 'gatilho'];

    for (const campo of permitidos) {
      if (req.body[campo] !== undefined) {
        campos.push(`${campo} = ?`);
        valores.push(campo === 'config' ? JSON.stringify(req.body[campo]) : req.body[campo]);
      }
    }

    if (campos.length === 0) return res.status(400).json({ erro: 'Nenhum campo' });

    campos.push("atualizado_em = datetime('now', 'localtime')");
    valores.push(id);

    db.prepare(`UPDATE automacao_etapas SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
    saveDb();

    const automacao = db.prepare('SELECT * FROM automacao_etapas WHERE id = ?').get(id);
    res.json(automacao);
  }

  excluir(req: Request, res: Response) {
    const db = getDb();
    db.prepare('DELETE FROM automacao_etapas WHERE id = ?').run(req.params.id);
    saveDb();
    res.json({ ok: true });
  }

  // IA: gerar automacoes a partir de texto livre
  async gerarComIA(req: Request, res: Response) {
    const { mensagem } = req.body;
    if (!mensagem || typeof mensagem !== 'string') {
      return res.status(400).json({ erro: 'Campo mensagem e obrigatorio' });
    }

    try {
      const resposta = await callAIInternal(mensagem);

      // Extrair JSON da resposta
      const jsonMatch = resposta.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        // Pode ser um erro ou resposta simples
        const erroMatch = resposta.match(/\{[\s\S]*\}/);
        if (erroMatch) {
          const parsed = JSON.parse(erroMatch[0]);
          if (parsed.erro) {
            return res.json({ automacoes: [], erro: parsed.erro });
          }
        }
        return res.status(400).json({ erro: 'Nao foi possivel interpretar a resposta da IA', raw: resposta });
      }

      const automacoes = JSON.parse(jsonMatch[0]);
      res.json({ automacoes });
    } catch (e: any) {
      console.error('[AUTOMACAO-IA] Erro:', e.message);
      res.status(500).json({ erro: 'Erro ao gerar automacao com IA: ' + e.message });
    }
  }

  // Listar log de execucoes
  listarLog(req: Request, res: Response) {
    const db = getDb();
    const limite = Math.min(Number(req.query.limite) || 50, 200);
    const logs = db.prepare(
      `SELECT l.*, a.tipo_acao, a.estagio_destino, a.descricao as automacao_descricao
       FROM automacao_etapas_log l
       LEFT JOIN automacao_etapas a ON l.automacao_id = a.id
       ORDER BY l.criado_em DESC LIMIT ?`
    ).all(limite);
    res.json(logs);
  }
}

export const automacaoEtapasController = new AutomacaoEtapasController();
