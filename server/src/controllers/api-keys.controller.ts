import { Request, Response } from 'express';
import { getDb } from '../config/database';

export class ApiKeysController {
  obterKeys(_req: Request, res: Response) {
    try {
      const db = getDb();
      const keys = db.prepare('SELECT id, provider, api_key, modelo, ativo, selecionado FROM api_keys ORDER BY provider').all() as any[];

      // Mascarar as keys para segurança
      const masked = keys.map((k: any) => ({
        ...k,
        api_key: k.api_key
          ? k.api_key.substring(0, 8) + '...' + k.api_key.substring(k.api_key.length - 4)
          : '',
        has_key: !!k.api_key,
      }));

      res.json(masked);
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }

  selecionarProvider(req: Request, res: Response) {
    try {
      const db = getDb();
      const { provider } = req.params;

      const existing = db.prepare('SELECT id FROM api_keys WHERE provider = ?').get(provider) as any;
      if (!existing) {
        return res.status(404).json({ erro: `Provedor ${provider} nao encontrado` });
      }

      db.prepare("UPDATE api_keys SET selecionado = 0").run();
      db.prepare("UPDATE api_keys SET selecionado = 1 WHERE provider = ?").run(provider);

      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }

  salvarKey(req: Request, res: Response) {
    try {
      const db = getDb();
      const { provider } = req.params;
      const { api_key, modelo } = req.body;

      const existing = db.prepare('SELECT id, api_key FROM api_keys WHERE provider = ?').get(provider) as any;

      if (!existing) {
        return res.status(404).json({ erro: `Provedor ${provider} nao encontrado` });
      }

      // Só atualiza a key se não for mascarada
      const keyToSave = api_key && !api_key.includes('...') ? api_key : existing.api_key;

      db.prepare(
        "UPDATE api_keys SET api_key = ?, modelo = ?, atualizado_em = datetime('now') WHERE provider = ?"
      ).run(keyToSave, modelo || '', provider);

      // Atualizar env em runtime para efeito imediato
      if (keyToSave && !api_key?.includes('...')) {
        if (provider === 'anthropic') {
          process.env.CLAUDE_API_KEY = keyToSave;
        } else if (provider === 'openai') {
          process.env.OPENAI_API_KEY = keyToSave;
        } else if (provider === 'gemini') {
          process.env.GEMINI_API_KEY = keyToSave;
        }
      }

      if (modelo) {
        if (provider === 'anthropic') {
          process.env.CLAUDE_MODEL = modelo;
        }
      }

      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }

  async testarKey(req: Request, res: Response) {
    try {
      const db = getDb();
      const { provider } = req.params;

      const config = db.prepare('SELECT api_key, modelo FROM api_keys WHERE provider = ?').get(provider) as any;
      if (!config || !config.api_key) {
        return res.json({ ok: false, erro: 'API Key nao configurada' });
      }

      if (provider === 'anthropic') {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey: config.api_key });
        await client.messages.create({
          model: config.modelo || 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Oi' }],
        });
        return res.json({ ok: true });
      }

      if (provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.modelo || 'gpt-4o',
            messages: [{ role: 'user', content: 'Oi' }],
            max_tokens: 10,
          }),
        });
        if (!response.ok) {
          const errBody: any = await response.json();
          return res.json({ ok: false, erro: errBody.error?.message || 'Erro na API OpenAI' });
        }
        return res.json({ ok: true });
      }

      if (provider === 'gemini') {
        const modelo = config.modelo || 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${config.api_key}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Oi' }] }],
          }),
        });
        if (!response.ok) {
          const errBody: any = await response.json();
          return res.json({ ok: false, erro: errBody.error?.message || 'Erro na API Gemini' });
        }
        return res.json({ ok: true });
      }

      res.json({ ok: false, erro: 'Provedor desconhecido' });
    } catch (error: any) {
      res.json({ ok: false, erro: error.message });
    }
  }
}
