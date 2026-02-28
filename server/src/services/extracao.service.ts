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

    campos.push("atualizado_em = datetime('now')");
    valores.push(clienteId);

    db.prepare(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
  }
}
