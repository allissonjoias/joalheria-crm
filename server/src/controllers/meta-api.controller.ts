import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../config/database';
import { metaApiService } from '../services/meta-api.service';

export class MetaApiController {

  // --- Configuracao ---

  obterConfig(req: Request, res: Response) {
    const config = metaApiService.obterConfig();
    res.json({
      configurado: metaApiService.isConfigurado(),
      config: config || null,
    });
  }

  salvarConfig(req: Request, res: Response) {
    const { access_token, phone_number_id, waba_id, token_tipo } = req.body;
    if (!access_token || !phone_number_id) {
      return res.status(400).json({ erro: 'access_token e phone_number_id sao obrigatorios' });
    }
    metaApiService.salvarConfig({ access_token, phone_number_id, waba_id, token_tipo });
    res.json({ sucesso: true });
  }

  async verificarToken(req: Request, res: Response) {
    const resultado = await metaApiService.verificarToken();
    res.json(resultado);
  }

  // --- Numeros de Telefone ---

  async adicionarNumero(req: Request, res: Response) {
    const { telefone, nome_exibicao } = req.body;
    if (!telefone) return res.status(400).json({ erro: 'telefone obrigatorio' });
    const resultado = await metaApiService.adicionarNumero(telefone, nome_exibicao || 'Alisson Joias');
    if (!resultado.ok) return res.status(400).json({ erro: resultado.erro });
    res.json({ sucesso: true, phone_number_id: resultado.phone_number_id });
  }

  async listarNumeros(req: Request, res: Response) {
    const resultado = await metaApiService.listarNumeros();
    if (!resultado.ok) return res.status(400).json({ erro: resultado.erro });
    res.json(resultado.numeros);
  }

  async solicitarCodigo(req: Request, res: Response) {
    const { phone_number_id, metodo } = req.body;
    if (!phone_number_id) return res.status(400).json({ erro: 'phone_number_id obrigatorio' });
    const resultado = await metaApiService.solicitarCodigo(phone_number_id, metodo || 'SMS');
    if (!resultado.ok) return res.status(400).json({ erro: resultado.erro });
    res.json({ sucesso: true });
  }

  async verificarCodigo(req: Request, res: Response) {
    const { phone_number_id, codigo } = req.body;
    if (!phone_number_id || !codigo) return res.status(400).json({ erro: 'phone_number_id e codigo obrigatorios' });
    const resultado = await metaApiService.verificarCodigo(phone_number_id, codigo);
    if (!resultado.ok) return res.status(400).json({ erro: resultado.erro });
    res.json({ sucesso: true });
  }

  async registrarNumero(req: Request, res: Response) {
    const { phone_number_id } = req.body;
    if (!phone_number_id) return res.status(400).json({ erro: 'phone_number_id obrigatorio' });
    const resultado = await metaApiService.registrarNumero(phone_number_id);
    if (!resultado.ok) return res.status(400).json({ erro: resultado.erro });
    res.json({ sucesso: true });
  }

  async selecionarNumero(req: Request, res: Response) {
    const { phone_number_id } = req.body;
    if (!phone_number_id) return res.status(400).json({ erro: 'phone_number_id obrigatorio' });
    // Atualizar o phone_number_id ativo na config
    const db = getDb();
    db.prepare(
      "UPDATE meta_api_config SET phone_number_id = ?, atualizado_em = datetime('now', 'localtime') WHERE id = 1"
    ).run(phone_number_id);
    saveDb();
    res.json({ sucesso: true });
  }

  // --- Templates ---

  async listarTemplates(req: Request, res: Response) {
    const resultado = await metaApiService.listarTemplates();
    if (!resultado.ok) {
      return res.status(400).json({ erro: resultado.erro });
    }
    res.json(resultado.templates);
  }

  // --- Envio direto ---

  async enviarTexto(req: Request, res: Response) {
    const { telefone, texto } = req.body;
    if (!telefone || !texto) {
      return res.status(400).json({ erro: 'telefone e texto sao obrigatorios' });
    }
    const resultado = await metaApiService.enviarTexto(telefone, texto);
    if (!resultado.ok) {
      return res.status(400).json({ erro: resultado.erro });
    }
    res.json(resultado);
  }

  async enviarTemplate(req: Request, res: Response) {
    const { telefone, template_name, language, components } = req.body;
    if (!telefone || !template_name) {
      return res.status(400).json({ erro: 'telefone e template_name sao obrigatorios' });
    }
    const resultado = await metaApiService.enviarTemplate(telefone, template_name, language, components);
    if (!resultado.ok) {
      return res.status(400).json({ erro: resultado.erro });
    }
    res.json(resultado);
  }

  // --- Campanhas via Meta API ---

  criarCampanha(req: Request, res: Response) {
    const db = getDb();
    const { nome, template_name, template_language, mensagem_template, cliente_ids } = req.body;

    if (!nome || !cliente_ids || cliente_ids.length === 0) {
      return res.status(400).json({ erro: 'nome e cliente_ids sao obrigatorios' });
    }
    if (!template_name && !mensagem_template) {
      return res.status(400).json({ erro: 'Informe template_name (template aprovado) ou mensagem_template (texto livre)' });
    }

    const id = uuidv4();
    db.prepare(
      `INSERT INTO meta_campanhas (id, nome, template_name, template_language, mensagem_template, total_contatos, status)
       VALUES (?, ?, ?, ?, ?, ?, 'rascunho')`
    ).run(id, nome, template_name || null, template_language || 'pt_BR', mensagem_template || null, cliente_ids.length);

    // Criar itens na fila
    for (const clienteId of cliente_ids) {
      const cliente = db.prepare('SELECT nome, telefone FROM clientes WHERE id = ?').get(clienteId) as any;
      if (!cliente?.telefone) continue;

      const mensagem = mensagem_template
        ? mensagem_template
            .replace(/\{\{nome\}\}/gi, cliente.nome || 'Cliente')
            .replace(/\{\{telefone\}\}/gi, cliente.telefone || '')
        : null;

      db.prepare(
        `INSERT INTO meta_fila (id, cliente_id, telefone, template_name, mensagem, status, campanha_id)
         VALUES (?, ?, ?, ?, ?, 'pendente', ?)`
      ).run(uuidv4(), clienteId, cliente.telefone, template_name || null, mensagem, id);
    }

    saveDb();
    const campanha = db.prepare('SELECT * FROM meta_campanhas WHERE id = ?').get(id);
    res.status(201).json(campanha);
  }

  listarCampanhas(req: Request, res: Response) {
    const db = getDb();
    const campanhas = db.prepare('SELECT * FROM meta_campanhas ORDER BY criado_em DESC').all();
    res.json(campanhas);
  }

  obterCampanha(req: Request, res: Response) {
    const db = getDb();
    const campanha = db.prepare('SELECT * FROM meta_campanhas WHERE id = ?').get(req.params.id);
    if (!campanha) return res.status(404).json({ erro: 'Campanha nao encontrada' });

    const fila = db.prepare(
      'SELECT id, cliente_id, telefone, status, erro_detalhe, enviado_em FROM meta_fila WHERE campanha_id = ? ORDER BY criado_em ASC'
    ).all(req.params.id);

    res.json({ ...campanha as any, fila });
  }

  async iniciarCampanha(req: Request, res: Response) {
    const db = getDb();
    const campanhaId = req.params.id as string;
    const campanha = db.prepare('SELECT * FROM meta_campanhas WHERE id = ?').get(campanhaId) as any;
    if (!campanha) return res.status(404).json({ erro: 'Campanha nao encontrada' });
    if (campanha.status === 'rodando') return res.status(400).json({ erro: 'Campanha ja esta rodando' });

    db.prepare(
      "UPDATE meta_campanhas SET status = 'rodando', atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(campanhaId);
    saveDb();

    // Processar fila em background
    this.processarFilaMeta(campanhaId);

    res.json({ sucesso: true, status: 'rodando' });
  }

  pausarCampanha(req: Request, res: Response) {
    const db = getDb();
    db.prepare(
      "UPDATE meta_campanhas SET status = 'pausada', atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(req.params.id);
    saveDb();
    res.json({ sucesso: true });
  }

  cancelarCampanha(req: Request, res: Response) {
    const db = getDb();
    db.prepare(
      "UPDATE meta_campanhas SET status = 'cancelada', atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(req.params.id);
    db.prepare(
      "UPDATE meta_fila SET status = 'cancelado' WHERE campanha_id = ? AND status = 'pendente'"
    ).run(req.params.id);
    saveDb();
    res.json({ sucesso: true });
  }

  // Processamento async da fila via Meta API
  private async processarFilaMeta(campanhaId: string) {
    const db = getDb();
    const DELAY_ENTRE_ENVIOS = 1500; // 1.5s - Meta API permite mais velocidade que Baileys

    while (true) {
      // Verificar se campanha foi cancelada/pausada
      const campanha = db.prepare('SELECT status FROM meta_campanhas WHERE id = ?').get(campanhaId) as any;
      if (!campanha || campanha.status !== 'rodando') break;

      // Pegar proximo pendente
      const item = db.prepare(
        "SELECT * FROM meta_fila WHERE campanha_id = ? AND status = 'pendente' ORDER BY criado_em ASC LIMIT 1"
      ).get(campanhaId) as any;

      if (!item) {
        // Fila vazia - concluida
        db.prepare(
          "UPDATE meta_campanhas SET status = 'concluida', atualizado_em = datetime('now', 'localtime') WHERE id = ?"
        ).run(campanhaId);
        saveDb();
        console.log(`[META-API] Campanha ${campanhaId} concluida`);
        break;
      }

      db.prepare("UPDATE meta_fila SET status = 'enviando' WHERE id = ?").run(item.id);

      try {
        let resultado;
        if (item.template_name) {
          // Enviar via template aprovado
          resultado = await metaApiService.enviarTemplate(item.telefone, item.template_name);
        } else {
          // Enviar texto livre (so funciona na janela de 24h)
          resultado = await metaApiService.enviarTexto(item.telefone, item.mensagem);
        }

        if (resultado.ok) {
          db.prepare(
            "UPDATE meta_fila SET status = 'enviado', meta_message_id = ?, enviado_em = datetime('now', 'localtime') WHERE id = ?"
          ).run(resultado.message_id || null, item.id);
          db.prepare(
            "UPDATE meta_campanhas SET total_enviados = total_enviados + 1, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
          ).run(campanhaId);

          // Registrar interacao
          db.prepare(
            "INSERT INTO interacoes (id, cliente_id, tipo, descricao) VALUES (?, ?, 'whatsapp', ?)"
          ).run(uuidv4(), item.cliente_id, `Meta API: ${(item.template_name || item.mensagem || '').substring(0, 100)}`);
        } else {
          db.prepare(
            "UPDATE meta_fila SET status = 'erro', erro_detalhe = ? WHERE id = ?"
          ).run(resultado.erro, item.id);
          db.prepare(
            "UPDATE meta_campanhas SET total_erros = total_erros + 1, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
          ).run(campanhaId);
        }
      } catch (e: any) {
        db.prepare(
          "UPDATE meta_fila SET status = 'erro', erro_detalhe = ? WHERE id = ?"
        ).run(e.message, item.id);
        db.prepare(
          "UPDATE meta_campanhas SET total_erros = total_erros + 1, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
        ).run(campanhaId);
      }

      saveDb();
      await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_ENVIOS));
    }
  }
}
