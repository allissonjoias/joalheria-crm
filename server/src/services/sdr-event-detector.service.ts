export interface SdrEvento {
  tipo: 'novo_lead' | 'mudanca_estagio' | 'lead_inativo' | 'venda_fechada' | 'task_vencida';
  prioridade: 'critica' | 'alta' | 'media' | 'baixa';
  leadId?: number;
  leadNome?: string;
  descricao: string;
  dados?: any;
}

interface LeadSnapshot {
  kommo_lead_id: number;
  nome: string;
  pipeline_id: number;
  status_id: number;
  responsavel_id: number;
  valor: number;
  updated_at: number;
}

interface LeadKommo {
  id: number;
  name: string;
  pipeline_id: number;
  status_id: number;
  responsible_user_id: number;
  price: number;
  updated_at: number;
}

export class SdrEventDetectorService {
  detectarEventos(
    leadsKommo: LeadKommo[],
    snapshotsExistentes: Map<number, LeadSnapshot>,
    statusVendaIds: number[]
  ): SdrEvento[] {
    const eventos: SdrEvento[] = [];

    for (const lead of leadsKommo) {
      const snapshot = snapshotsExistentes.get(lead.id);

      if (!snapshot) {
        eventos.push({
          tipo: 'novo_lead',
          prioridade: 'media',
          leadId: lead.id,
          leadNome: lead.name,
          descricao: `Novo lead: *${lead.name}*${lead.price ? ` - R$ ${lead.price.toLocaleString('pt-BR')}` : ''}`,
          dados: lead,
        });
        continue;
      }

      if (snapshot.status_id !== lead.status_id) {
        const isVenda = statusVendaIds.includes(lead.status_id);

        if (isVenda) {
          eventos.push({
            tipo: 'venda_fechada',
            prioridade: 'critica',
            leadId: lead.id,
            leadNome: lead.name,
            descricao: `Venda fechada! *${lead.name}* - R$ ${(lead.price || 0).toLocaleString('pt-BR')}`,
            dados: { lead, statusAnterior: snapshot.status_id },
          });
        } else {
          eventos.push({
            tipo: 'mudanca_estagio',
            prioridade: 'alta',
            leadId: lead.id,
            leadNome: lead.name,
            descricao: `Lead *${lead.name}* mudou de estagio (status ${snapshot.status_id} → ${lead.status_id})`,
            dados: { lead, statusAnterior: snapshot.status_id },
          });
        }
      }
    }

    return eventos;
  }

  detectarInativos(
    snapshots: LeadSnapshot[],
    diasInatividade: number
  ): SdrEvento[] {
    const eventos: SdrEvento[] = [];
    const limiteTimestamp = Math.floor(Date.now() / 1000) - diasInatividade * 86400;

    for (const snap of snapshots) {
      if (snap.updated_at && snap.updated_at < limiteTimestamp) {
        const diasSemUpdate = Math.floor((Date.now() / 1000 - snap.updated_at) / 86400);
        eventos.push({
          tipo: 'lead_inativo',
          prioridade: 'baixa',
          leadId: snap.kommo_lead_id,
          leadNome: snap.nome,
          descricao: `Lead *${snap.nome}* inativo ha ${diasSemUpdate} dias`,
          dados: { diasSemUpdate },
        });
      }
    }

    return eventos;
  }

  classificarTasksVencidas(tasks: any[]): SdrEvento[] {
    const agora = Math.floor(Date.now() / 1000);

    return tasks
      .filter((t: any) => t.complete_till && t.complete_till < agora && !t.is_completed)
      .map((t: any) => ({
        tipo: 'task_vencida' as const,
        prioridade: 'alta' as const,
        leadId: t.entity_id,
        leadNome: undefined,
        descricao: `Task vencida: *${t.text?.substring(0, 50) || 'Sem titulo'}* (lead ${t.entity_id})`,
        dados: t,
      }));
  }
}
