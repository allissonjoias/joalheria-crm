import { getDb } from '../config/database';

export class ExtracaoService {
  atualizarCliente(clienteId: string, dados: Record<string, any>) {
    const db = getDb();
    const campos: string[] = [];
    const valores: any[] = [];

    const mapeamento: Record<string, string> = {
      nome: 'nome',
      telefone: 'telefone',
      email: 'email',
      tipo_interesse: 'tipo_interesse',
      material_preferido: 'material_preferido',
      pedra_preferida: 'pedra_preferida',
      orcamento_min: 'orcamento_min',
      orcamento_max: 'orcamento_max',
      ocasiao: 'ocasiao',
    };

    for (const [chave, coluna] of Object.entries(mapeamento)) {
      if (dados[chave] !== null && dados[chave] !== undefined) {
        campos.push(`${coluna} = ?`);
        valores.push(dados[chave]);
      }
    }

    if (campos.length === 0) return;

    campos.push("atualizado_em = datetime('now', 'localtime')");
    valores.push(clienteId);

    db.prepare(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
  }

  /**
   * Auto-preenche campos da ODV (pipeline) com dados extraidos da conversa pela IA.
   * Apenas preenche campos que estao null/vazio na ODV (nao sobrescreve edits manuais).
   */
  atualizarOdv(clienteId: string, dados: Record<string, any>, conversaId?: string) {
    const db = getDb();

    // Buscar ODV mais recente do cliente (ou pela conversa)
    let odv: any = null;
    if (conversaId) {
      odv = db.prepare(
        'SELECT * FROM pipeline WHERE conversa_id = ? ORDER BY atualizado_em DESC LIMIT 1'
      ).get(conversaId);
    }
    if (!odv) {
      odv = db.prepare(
        'SELECT * FROM pipeline WHERE cliente_id = ? ORDER BY atualizado_em DESC LIMIT 1'
      ).get(clienteId);
    }
    if (!odv) return;

    const camposIa: string[] = [];
    try {
      const existentes = JSON.parse(odv.campos_ia || '[]');
      camposIa.push(...existentes);
    } catch {}

    const updates: string[] = [];
    const valores: any[] = [];

    // Mapeamento: campo extraido -> coluna da ODV
    const mapeamento: Record<string, { coluna: string; transformar?: (v: any) => any }> = {
      tipo_pedido: { coluna: 'tipo_pedido' },
      itens_pedido: { coluna: 'itens_pedido', transformar: (v) => Array.isArray(v) ? JSON.stringify(v) : v },
      desconto: { coluna: 'desconto' },
      parcelas: { coluna: 'parcelas' },
      forma_pagamento: { coluna: 'forma_pagamento' },
      valor_frete: { coluna: 'valor_frete' },
      endereco_entrega: { coluna: 'endereco_entrega' },
      data_prevista_entrega: { coluna: 'data_prevista_entrega' },
      observacao_pedido: { coluna: 'observacao_pedido' },
      forma_atendimento: { coluna: 'forma_atendimento' },
      tipo_cliente: { coluna: 'tipo_cliente' },
    };

    for (const [chave, config] of Object.entries(mapeamento)) {
      const valor = dados[chave];
      if (valor === null || valor === undefined) continue;
      if (Array.isArray(valor) && valor.length === 0) continue;

      // Nao sobrescrever campos ja preenchidos manualmente
      const valorAtual = odv[config.coluna];
      if (valorAtual && valorAtual !== '[]' && !camposIa.includes(config.coluna)) continue;

      const valorFinal = config.transformar ? config.transformar(valor) : valor;
      updates.push(`${config.coluna} = ?`);
      valores.push(valorFinal);

      if (!camposIa.includes(config.coluna)) {
        camposIa.push(config.coluna);
      }
    }

    // Atualizar valor da ODV se orcamento foi detectado e ODV tem valor 0
    if (dados.orcamento_max && (!odv.valor || odv.valor === 0)) {
      updates.push('valor = ?');
      valores.push(dados.orcamento_max);
      if (!camposIa.includes('valor')) camposIa.push('valor');
    }

    // Atualizar titulo da ODV se temos mais info
    if (dados.tipo_interesse && odv.titulo && odv.titulo.includes('Interesse em joias')) {
      const cliente = db.prepare('SELECT nome FROM clientes WHERE id = ?').get(clienteId) as any;
      const nomeCliente = cliente?.nome || dados.nome || 'Cliente';
      const interesse = dados.tipo_interesse.replace(/_/g, ' ');
      updates.push('titulo = ?');
      valores.push(`${nomeCliente} - ${interesse}${dados.ocasiao ? ' (' + dados.ocasiao + ')' : ''}`);
    }

    // Vincular conversa a ODV
    if (conversaId && !odv.conversa_id) {
      updates.push('conversa_id = ?');
      valores.push(conversaId);
    }

    if (updates.length === 0) return;

    updates.push('campos_ia = ?');
    valores.push(JSON.stringify(camposIa));

    updates.push("atualizado_em = datetime('now', 'localtime')");
    valores.push(odv.id);

    db.prepare(`UPDATE pipeline SET ${updates.join(', ')} WHERE id = ?`).run(...valores);
    console.log(`[EXTRACAO-IA] ODV ${odv.id} atualizada: ${camposIa.join(', ')}`);
  }
}
