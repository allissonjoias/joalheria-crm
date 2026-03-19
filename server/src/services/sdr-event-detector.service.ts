export interface SdrEvento {
  tipo: 'novo_lead' | 'mudanca_estagio' | 'lead_inativo' | 'venda_fechada' | 'task_vencida';
  prioridade: 'critica' | 'alta' | 'media' | 'baixa';
  leadId?: string;
  leadNome?: string;
  descricao: string;
  dados?: any;
}

interface DealLocal {
  id: string;
  titulo: string;
  cliente_nome?: string;
  estagio: string;
  valor: number;
  vendedor_id?: string;
  atualizado_em: string;
  criado_em: string;
}

interface DealSnapshot {
  deal_id: string;
  estagio: string;
  valor: number;
  atualizado_em: string;
}

export class SdrEventDetectorService {
  detectarEventos(
    dealsAtuais: DealLocal[],
    snapshotsExistentes: Map<string, DealSnapshot>,
    estagiosGanho: string[]
  ): SdrEvento[] {
    const eventos: SdrEvento[] = [];

    for (const deal of dealsAtuais) {
      const snapshot = snapshotsExistentes.get(deal.id);

      if (!snapshot) {
        eventos.push({
          tipo: 'novo_lead',
          prioridade: 'media',
          leadId: deal.id,
          leadNome: deal.cliente_nome || deal.titulo,
          descricao: `Novo lead: *${deal.cliente_nome || deal.titulo}*${deal.valor ? ` - R$ ${deal.valor.toLocaleString('pt-BR')}` : ''}`,
          dados: deal,
        });
        continue;
      }

      if (snapshot.estagio !== deal.estagio) {
        const isVenda = estagiosGanho.includes(deal.estagio);

        if (isVenda) {
          eventos.push({
            tipo: 'venda_fechada',
            prioridade: 'critica',
            leadId: deal.id,
            leadNome: deal.cliente_nome || deal.titulo,
            descricao: `Venda fechada! *${deal.cliente_nome || deal.titulo}* - R$ ${(deal.valor || 0).toLocaleString('pt-BR')}`,
            dados: { deal, estagioAnterior: snapshot.estagio },
          });
        } else {
          eventos.push({
            tipo: 'mudanca_estagio',
            prioridade: 'alta',
            leadId: deal.id,
            leadNome: deal.cliente_nome || deal.titulo,
            descricao: `Lead *${deal.cliente_nome || deal.titulo}* mudou de estagio (${snapshot.estagio} → ${deal.estagio})`,
            dados: { deal, estagioAnterior: snapshot.estagio },
          });
        }
      }
    }

    return eventos;
  }

  detectarInativos(
    deals: DealLocal[],
    diasInatividade: number
  ): SdrEvento[] {
    const eventos: SdrEvento[] = [];
    const limite = new Date(Date.now() - diasInatividade * 86400000).toISOString();

    for (const deal of deals) {
      if (deal.atualizado_em && deal.atualizado_em < limite) {
        const diasSemUpdate = Math.floor((Date.now() - new Date(deal.atualizado_em).getTime()) / 86400000);
        eventos.push({
          tipo: 'lead_inativo',
          prioridade: 'baixa',
          leadId: deal.id,
          leadNome: deal.cliente_nome || deal.titulo,
          descricao: `Lead *${deal.cliente_nome || deal.titulo}* inativo ha ${diasSemUpdate} dias`,
          dados: { diasSemUpdate },
        });
      }
    }

    return eventos;
  }

  classificarTarefasVencidas(tarefas: any[]): SdrEvento[] {
    const agora = new Date().toISOString();

    return tarefas
      .filter((t: any) => t.status === 'pendente' && t.data_vencimento && t.data_vencimento < agora)
      .map((t: any) => ({
        tipo: 'task_vencida' as const,
        prioridade: 'alta' as const,
        leadId: t.pipeline_id || undefined,
        leadNome: t.deal_titulo || undefined,
        descricao: `Tarefa vencida: *${(t.titulo || 'Sem titulo').substring(0, 50)}*${t.cliente_nome ? ` (${t.cliente_nome})` : ''}`,
        dados: t,
      }));
  }
}
