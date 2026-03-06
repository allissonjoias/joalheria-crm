import { Request, Response } from 'express';
import { getDb, saveDb } from '../config/database';
import { ClaudeService, MensagemChat } from '../services/claude.service';
import fs from 'fs';
import path from 'path';
import { transcreverAudio } from '../services/media.service';

const claude = new ClaudeService();

export class AgentesIaController {
  listar(_req: Request, res: Response) {
    try {
      const db = getDb();
      const agentes = db.prepare('SELECT * FROM agentes_ia ORDER BY criado_em DESC').all();
      res.json(agentes);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  obter(req: Request, res: Response) {
    try {
      const db = getDb();
      const agente = db.prepare('SELECT * FROM agentes_ia WHERE id = ?').get(Number(req.params.id));
      if (!agente) return res.status(404).json({ erro: 'Agente nao encontrado' });
      res.json(agente);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  criar(req: Request, res: Response) {
    try {
      const { nome, area, prompt_sistema, foto_url } = req.body;
      if (!nome || !area) return res.status(400).json({ erro: 'Nome e area sao obrigatorios' });

      const db = getDb();
      const agora = new Date().toISOString().replace('T', ' ').substring(0, 19);
      db.prepare(
        'INSERT INTO agentes_ia (nome, area, prompt_sistema, foto_url, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, 1, ?, ?)'
      ).run(nome, area, prompt_sistema || '', foto_url || null, agora, agora);

      const criado = db.prepare('SELECT * FROM agentes_ia ORDER BY id DESC LIMIT 1').get();
      res.status(201).json(criado);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  atualizar(req: Request, res: Response) {
    try {
      const { nome, area, prompt_sistema, foto_url, ativo } = req.body;
      const id = Number(req.params.id);
      const db = getDb();

      const existente = db.prepare('SELECT * FROM agentes_ia WHERE id = ?').get(id) as any;
      if (!existente) return res.status(404).json({ erro: 'Agente nao encontrado' });

      const agora = new Date().toISOString().replace('T', ' ').substring(0, 19);
      db.prepare(
        `UPDATE agentes_ia SET nome = ?, area = ?, prompt_sistema = ?, foto_url = ?, ativo = ?, atualizado_em = ? WHERE id = ?`
      ).run(
        nome !== undefined ? nome : existente.nome,
        area !== undefined ? area : existente.area,
        prompt_sistema !== undefined ? prompt_sistema : existente.prompt_sistema,
        foto_url !== undefined ? foto_url : existente.foto_url,
        ativo !== undefined ? ativo : existente.ativo,
        agora,
        id
      );

      const atualizado = db.prepare('SELECT * FROM agentes_ia WHERE id = ?').get(id);
      res.json(atualizado);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  excluir(req: Request, res: Response) {
    try {
      const db = getDb();
      const existente = db.prepare('SELECT * FROM agentes_ia WHERE id = ?').get(Number(req.params.id));
      if (!existente) return res.status(404).json({ erro: 'Agente nao encontrado' });

      db.prepare('DELETE FROM agentes_ia WHERE id = ?').run(Number(req.params.id));
      saveDb();
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  uploadFoto(req: Request, res: Response) {
    try {
      const { foto_base64 } = req.body;
      if (!foto_base64) return res.status(400).json({ erro: 'foto_base64 obrigatorio' });

      const id = Number(req.params.id);
      const db = getDb();
      const existente = db.prepare('SELECT * FROM agentes_ia WHERE id = ?').get(id);
      if (!existente) return res.status(404).json({ erro: 'Agente nao encontrado' });

      // Salvar imagem no disco
      const match = foto_base64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) return res.status(400).json({ erro: 'Formato invalido. Use data:image/png;base64,...' });

      const ext = match[1];
      const data = match[2];
      const uploadsDir = path.resolve(__dirname, '../../../uploads/agentes');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const filename = `agente_${id}.${ext}`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, Buffer.from(data, 'base64'));

      const fotoUrl = `/uploads/agentes/${filename}`;
      const agora = new Date().toISOString().replace('T', ' ').substring(0, 19);
      db.prepare('UPDATE agentes_ia SET foto_url = ?, atualizado_em = ? WHERE id = ?').run(fotoUrl, agora, id);
      saveDb();

      res.json({ ok: true, foto_url: fotoUrl });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async simular(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const db = getDb();
      const agente = db.prepare('SELECT * FROM agentes_ia WHERE id = ?').get(id) as any;
      if (!agente) return res.status(404).json({ erro: 'Agente nao encontrado' });

      const { mensagens } = req.body;
      if (!mensagens || !Array.isArray(mensagens)) {
        return res.status(400).json({ erro: 'mensagens (array) obrigatorio' });
      }

      const promptBase = agente.prompt_sistema || 'Voce e um assistente virtual. Responda de forma util e concisa.';

      // Injetar instrucoes de midia no system prompt
      const instrucoesMidia = `

[INSTRUCOES DE MIDIA - COMO INTERPRETAR MENSAGENS COM ARQUIVOS]
O lead pode enviar midias pelo WhatsApp. Quando isso acontece, voce recebera uma descricao entre colchetes:

- [Lead enviou uma FOTO: nome.jpg] = O lead enviou uma imagem/foto. Pode ser:
  * Foto de uma joia que viu e gostou (referencia)
  * Foto de um catalogo ou vitrine
  * Print de um modelo da internet
  * Foto pessoal (mao, dedo para medida de anel, etc)
  Responda reconhecendo a foto, elogie se for uma joia, pergunte se quer algo parecido, use como gancho para qualificar.

- [Lead enviou um VIDEO: nome.mp4] = O lead enviou um video. Pode ser:
  * Video de uma joia em 360 graus
  * Video mostrando algo que quer
  Responda reconhecendo o video e use como contexto.

- [Lead enviou um AUDIO. Transcricao: "texto"] = O lead enviou um audio de voz. A transcricao e o que ele disse. Responda ao CONTEUDO da transcricao normalmente, como se fosse uma mensagem de texto. Nao diga "recebi seu audio", apenas responda ao que foi dito.

- [Lead enviou um AUDIO de X KB/MB] = Audio sem transcricao disponivel. Diga que recebeu o audio mas nao conseguiu ouvir, peca para digitar ou enviar novamente.

- [Lead enviou um DOCUMENTO: nome.pdf (X MB)] = O lead enviou um documento. Pode ser:
  * Orcamento de concorrente
  * Catalogo
  * Lista de convidados (casamento)
  Reconheca o documento e pergunte do que se trata.

REGRAS IMPORTANTES:
- NUNCA ignore uma midia. Sempre reconheca e responda.
- Use a midia como oportunidade para engajar e qualificar.
- Se for foto de joia, elogie e pergunte se quer algo similar.
- Se for audio com transcricao, responda ao conteudo naturalmente.
- Mantenha seu tom e personalidade ao responder sobre midias.
[FIM INSTRUCOES DE MIDIA]`;

      const systemPrompt = promptBase + instrucoesMidia;

      const mensagensIA: MensagemChat[] = mensagens.slice(-10).map((m: any) => ({
        role: m.role === 'user' || m.role === 'lead' ? 'user' as const : 'assistant' as const,
        content: m.content || m.conteudo || '',
      }));

      const resposta = await claude.simularDara(systemPrompt, mensagensIA, 1000);

      // Tentar parsear como JSON (caso o prompt peça resposta em JSON)
      let respostaLimpa = resposta.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      let parsed: any = null;
      try {
        parsed = JSON.parse(respostaLimpa);
      } catch { /* nao era JSON */ }

      res.json({
        resposta: parsed?.resposta || respostaLimpa,
        dados: parsed || null,
      });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async analisarPrompt(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const db = getDb();
      const agente = db.prepare('SELECT * FROM agentes_ia WHERE id = ?').get(id) as any;
      if (!agente) return res.status(404).json({ erro: 'Agente nao encontrado' });

      const promptAtual = agente.prompt_sistema || '';
      if (!promptAtual.trim()) {
        return res.status(400).json({ erro: 'O agente nao tem prompt para analisar. Crie um prompt primeiro.' });
      }

      const systemAnalise = `Voce e um especialista em engenharia de prompts para agentes de IA de atendimento ao cliente.

Sua tarefa: analisar o prompt recebido e identificar problemas de qualidade.

Retorne APENAS um JSON valido neste formato (sem markdown, sem texto extra):
{
  "erros": ["lista de erros gramaticais, de logica ou instrucoes impossiveis"],
  "incoerencias": ["lista de regras que se contradizem ou conflitam entre si"],
  "duplicatas": ["lista de instrucoes repetidas ou redundantes"],
  "melhorias_sugeridas": ["lista de sugestoes opcionais de melhoria"],
  "nota_geral": "resumo curto da qualidade do prompt (1-2 frases)",
  "score_qualidade": 85
}

REGRAS:
- score_qualidade: 0 a 100 (100 = perfeito)
- Se nao houver problemas em uma categoria, retorne array vazio []
- Seja especifico: cite trechos do prompt quando apontar problemas
- Foque em problemas reais, nao invente problemas
- Avalie no contexto de atendimento ao cliente via WhatsApp para joalheria`;

      const mensagemUser = `Analise este prompt de agente de IA:\n\n${promptAtual}`;
      const mensagensIA: MensagemChat[] = [{ role: 'user', content: mensagemUser }];
      const respostaRaw = await claude.simularDara(systemAnalise, mensagensIA, 2048);

      // Parsear JSON
      const limpo = respostaRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      try {
        const analise = JSON.parse(limpo);
        res.json({ ok: true, analise });
      } catch {
        res.json({ ok: true, analise: { nota_geral: limpo, erros: [], incoerencias: [], duplicatas: [], melhorias_sugeridas: [], score_qualidade: 0 } });
      }
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async melhorarPrompt(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const db = getDb();
      const agente = db.prepare('SELECT * FROM agentes_ia WHERE id = ?').get(id) as any;
      if (!agente) return res.status(404).json({ erro: 'Agente nao encontrado' });

      const { feedback, historico_conversa } = req.body;
      if (!feedback || typeof feedback !== 'string') {
        return res.status(400).json({ erro: 'feedback (string) obrigatorio' });
      }

      const promptAtual = agente.prompt_sistema || '';
      if (!promptAtual.trim()) {
        return res.status(400).json({ erro: 'O agente nao tem prompt para melhorar. Crie um prompt primeiro.' });
      }

      // Montar contexto para a IA
      let contextoConversa = '';
      if (historico_conversa && Array.isArray(historico_conversa) && historico_conversa.length > 0) {
        contextoConversa = '\n\n[CONVERSA DE TESTE QUE GEROU O FEEDBACK]\n' +
          historico_conversa.map((m: any) => `${m.papel === 'lead' ? 'Lead' : 'Agente'}: ${m.texto}`).join('\n') +
          '\n[FIM DA CONVERSA]';
      }

      const systemMelhorar = `Voce e um especialista em engenharia de prompts para agentes de IA de atendimento ao cliente.

Sua tarefa: analisar o prompt atual + feedback do usuario e retornar um PLANO DE MUDANCAS + o prompt melhorado.

Retorne APENAS um JSON valido neste formato (sem markdown, sem texto extra):
{
  "analise": {
    "mudancas": [
      { "local": "secao ou trecho do prompt", "de": "texto original resumido", "para": "texto novo resumido", "motivo": "por que mudar" }
    ],
    "erros_encontrados": ["erros no prompt original detectados ao analisar"],
    "incoerencias_encontradas": ["contradicoes detectadas"],
    "duplicatas_encontradas": ["trechos repetidos detectados"],
    "resumo": "resumo curto do que sera feito (1-2 frases)"
  },
  "prompt_melhorado": "o prompt completo melhorado aqui"
}

REGRAS ABSOLUTAS:
1. Altere SOMENTE o que o feedback pede. Nao mude nada alem do solicitado.
2. Mantenha toda a estrutura, formatacao, secoes e regras que nao foram mencionadas no feedback.
3. O campo prompt_melhorado deve conter o prompt COMPLETO, nao apenas o trecho alterado.
4. Mantenha o mesmo idioma do prompt original.
5. Se o prompt original usa XML tags, JSON format, etc, mantenha o mesmo formato.
6. Ao analisar, aproveite para detectar erros, incoerencias e duplicatas existentes no prompt.
7. Se encontrar erros/incoerencias/duplicatas, INCLUA as correcoes no prompt_melhorado e liste nas mudancas.`;

      const mensagemUser = `[PROMPT ATUAL DO AGENTE]
${promptAtual}
[FIM DO PROMPT ATUAL]
${contextoConversa}

[FEEDBACK DO USUARIO - APLIQUE SOMENTE ESTAS MUDANCAS]
${feedback}
[FIM DO FEEDBACK]

Retorne o JSON com a analise e o prompt melhorado.`;

      const mensagensIA: MensagemChat[] = [{ role: 'user', content: mensagemUser }];
      const respostaRaw = await claude.simularDara(systemMelhorar, mensagensIA, 8192);

      // Parsear JSON
      const limpo = respostaRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      try {
        const parsed = JSON.parse(limpo);
        const promptLimpo = (parsed.prompt_melhorado || '')
          .replace(/^```(?:\w+)?\s*/i, '')
          .replace(/\s*```\s*$/, '')
          .trim();

        // NAO salva automaticamente - retorna para aprovacao do usuario
        res.json({
          ok: true,
          prompt_anterior: promptAtual,
          prompt_melhorado: promptLimpo,
          analise: parsed.analise || { mudancas: [], resumo: 'Analise nao disponivel', erros_encontrados: [], incoerencias_encontradas: [], duplicatas_encontradas: [] },
        });
      } catch {
        // Fallback: resposta nao era JSON, tratar como prompt direto
        const resultado = limpo;
        res.json({
          ok: true,
          prompt_anterior: promptAtual,
          prompt_melhorado: resultado,
          analise: { mudancas: [], resumo: 'A IA retornou o prompt melhorado sem analise detalhada.', erros_encontrados: [], incoerencias_encontradas: [], duplicatas_encontradas: [] },
        });
      }
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async uploadMidia(req: Request, res: Response) {
    try {
      if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado. Verifique se o campo se chama "arquivo".' });

      const file = req.file;
      const mimetype = file.mimetype || 'application/octet-stream';
      const nomeOriginal = file.originalname || 'arquivo';
      let tipo: 'imagem' | 'video' | 'audio' | 'documento' = 'documento';
      if (mimetype.startsWith('image/')) tipo = 'imagem';
      else if (mimetype.startsWith('video/')) tipo = 'video';
      else if (mimetype.startsWith('audio/')) tipo = 'audio';

      const url = `/uploads/${file.filename}`;

      // Transcrever audio se possivel
      let transcricao: string | null = null;
      if (tipo === 'audio') {
        try {
          transcricao = await transcreverAudio(file.path);
        } catch (e) {
          console.warn('[Upload] Transcricao de audio falhou:', e);
        }
      }

      res.json({
        ok: true,
        tipo,
        url,
        nome_arquivo: nomeOriginal,
        tamanho: file.size,
        mimetype,
        transcricao,
      });
    } catch (e: any) {
      console.error('[Upload] Erro no uploadMidia:', e);
      res.status(500).json({ erro: e.message || 'Erro ao processar upload' });
    }
  }

  async aplicarMelhoria(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const db = getDb();
      const agente = db.prepare('SELECT * FROM agentes_ia WHERE id = ?').get(id) as any;
      if (!agente) return res.status(404).json({ erro: 'Agente nao encontrado' });

      const { prompt_melhorado } = req.body;
      if (!prompt_melhorado || typeof prompt_melhorado !== 'string') {
        return res.status(400).json({ erro: 'prompt_melhorado (string) obrigatorio' });
      }

      const agora = new Date().toISOString().replace('T', ' ').substring(0, 19);
      db.prepare('UPDATE agentes_ia SET prompt_sistema = ?, atualizado_em = ? WHERE id = ?')
        .run(prompt_melhorado.trim(), agora, id);
      saveDb();

      res.json({ ok: true, prompt_aplicado: prompt_melhorado.trim() });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }
}
