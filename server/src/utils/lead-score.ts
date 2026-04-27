/**
 * Lead Score BANT - Joalheria Premium
 * Escala 0-100 (alinhado com Luma SDR)
 *
 * B - Orcamento: 30 pts max
 * A - Decisor: 15 pts max
 * N - Necessidade: 30 pts max
 * T - Prazo: 20 pts max
 * Bonus: 5 pts max
 *
 * Classificacao:
 * QUENTE: 80-100
 * MORNO: 55-79
 * FRIO: 25-54
 * DESCARTE: 0-24
 */

export interface BANTScores {
  budget_score: number;
  authority_score: number;
  need_score: number;
  timeline_score: number;
  bonus_score: number;
}

export interface LeadScoreResult {
  total: number;
  scores: BANTScores;
  classificacao: 'QUENTE' | 'MORNO' | 'FRIO' | 'DESCARTE';
}

interface BANTInput {
  budget?: string | null;
  authority?: string | null;
  need?: string | null;
  timeline?: string | null;
  engajamento?: number;
  historico_compras?: boolean;
  recorrente?: boolean;
}

// Budget/Orcamento: max 30 pts
// +5k=30, 2-5k=20, 1-2k=12, 800-1k=6, <800=0
function calcularBudgetScore(budget: string | null | undefined): number {
  if (!budget) return 0;
  const lower = budget.toLowerCase();

  // Extrair valor numerico
  const nums = lower.match(/[\d.,]+/g);
  if (nums) {
    const valor = parseFloat(nums[nums.length - 1].replace(/\./g, '').replace(',', '.'));
    if (valor >= 5000) return 30;
    if (valor >= 2000) return 20;
    if (valor >= 1000) return 12;
    if (valor >= 800) return 6;
    return 0;
  }

  // Palavras-chave
  if (lower.includes('alto') || lower.includes('sem limite') || lower.includes('qualquer') || lower.includes('nao importa')) return 30;
  if (lower.includes('medio') || lower.includes('razoavel') || lower.includes('bom')) return 20;
  if (lower.includes('baixo') || lower.includes('barato') || lower.includes('economico') || lower.includes('simples')) return 6;

  return 0;
}

// Authority/Decisor: max 15 pts
// sozinho=15, lidera=10, consulta=5, terceiro=0
function calcularAuthorityScore(authority: string | null | undefined): number {
  if (!authority) return 0;
  const lower = authority.toLowerCase();

  if (lower.includes('sozin') || lower.includes('eu mesm') || lower.includes('eu decid') ||
      lower.includes('ela mesm') || lower.includes('ele mesm') || lower.includes('minha decisao')) return 15;
  if (lower.includes('presente') || lower.includes('surpresa') || lower.includes('lider') ||
      lower.includes('principal')) return 10;
  if (lower.includes('casal') || lower.includes('juntos') || lower.includes('noiv') ||
      lower.includes('marido') || lower.includes('esposa') || lower.includes('consultar') ||
      lower.includes('perguntar') || lower.includes('familia')) return 5;

  return 0;
}

// Need/Necessidade: max 30 pts
// alianca+casamento=30, solitario=28, presente+data=25, colecao=23,
// produto+vaga=15, personalizada=14, vaga=10, reparo=8, explorando=5
function calcularNeedScore(need: string | null | undefined): number {
  if (!need) return 0;
  const lower = need.toLowerCase();

  // Alianca/casamento/noivado
  if ((lower.includes('alianca') || lower.includes('aliança')) &&
      (lower.includes('casamento') || lower.includes('noivado'))) return 30;
  if (lower.includes('alianca') || lower.includes('aliança') || lower.includes('casamento') || lower.includes('noivado')) return 28;

  // Solitario
  if (lower.includes('solitario') || lower.includes('solitário')) return 28;

  // Presente com data especial
  if (lower.includes('presente') && (lower.includes('aniversario') || lower.includes('natal') ||
      lower.includes('dia das maes') || lower.includes('dia dos namorados') ||
      lower.includes('formatura') || lower.includes('data'))) return 25;

  // Colecao / conjunto
  if (lower.includes('colecao') || lower.includes('coleção') || lower.includes('conjunto') ||
      lower.includes('kit')) return 23;

  // Produto especifico
  if (lower.includes('anel') || lower.includes('colar') || lower.includes('brinco') ||
      lower.includes('pulseira') || lower.includes('corrente') || lower.includes('pingente') ||
      lower.includes('gargantilha')) return 15;

  // Personalizado / sob encomenda
  if (lower.includes('personaliz') || lower.includes('sob encomenda') || lower.includes('exclusiv')) return 14;

  // Presente genérico
  if (lower.includes('presente') || lower.includes('joia')) return 10;

  // Reparo / conserto
  if (lower.includes('reparo') || lower.includes('consert') || lower.includes('ajuste') ||
      lower.includes('limpe')) return 8;

  // Explorando
  if (lower.includes('explor') || lower.includes('olhando') || lower.includes('curios') ||
      lower.includes('ver')) return 5;

  return 5; // mencionou algo
}

// Timeline/Prazo: max 20 pts
// 7d=20, 8-15d=16, 16-30d=12, 31-60d=6, +60d=2
function calcularTimelineScore(timeline: string | null | undefined): number {
  if (!timeline) return 0;
  const lower = timeline.toLowerCase();

  // Urgente / hoje / agora
  if (lower.includes('hoje') || lower.includes('agora') || lower.includes('urgente') ||
      lower.includes('imediato') || lower.includes('ja')) return 20;

  // Esta semana (7 dias)
  if (lower.includes('esta semana') || lower.includes('essa semana') || lower.includes('proximo') ||
      lower.includes('proxima') || lower.includes('amanha')) return 20;

  // 8-15 dias
  if (lower.includes('quinzena') || lower.includes('15 dias') || lower.includes('duas semanas') ||
      lower.includes('semana que vem')) return 16;

  // 16-30 dias (este mes)
  if (lower.includes('este mes') || lower.includes('mes que vem') || lower.includes('30 dias') ||
      lower.includes('um mes')) return 12;

  // 31-60 dias
  if (lower.includes('2 meses') || lower.includes('dois meses') || lower.includes('60 dias')) return 6;

  // +60 dias
  if (lower.includes('3 meses') || lower.includes('semestre') || lower.includes('6 meses') ||
      lower.includes('ano') || lower.includes('sem pressa') || lower.includes('ainda nao')) return 2;

  // Datas específicas (meses)
  const meses = ['janeiro','fevereiro','marco','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  for (const mes of meses) {
    if (lower.includes(mes)) return 12;
  }

  return 2;
}

// Bonus contextual: max 5 pts
// existente=+5, indicacao=+4, viu preco=+3, data=+3, migrou=+2, modelo=+2, rapido=+1
function calcularBonusScore(input: BANTInput): number {
  let bonus = 0;

  if (input.historico_compras) bonus += 5;   // cliente existente
  if (input.recorrente) bonus += 4;          // indicacao/recorrente

  // Engajamento como proxy
  if (input.engajamento) {
    if (input.engajamento >= 15) bonus += 3;
    else if (input.engajamento >= 8) bonus += 2;
    else if (input.engajamento >= 3) bonus += 1;
  }

  return Math.min(bonus, 5);
}

export function calcularLeadScore(input: BANTInput): LeadScoreResult {
  const scores: BANTScores = {
    budget_score: calcularBudgetScore(input.budget),
    authority_score: calcularAuthorityScore(input.authority),
    need_score: calcularNeedScore(input.need),
    timeline_score: calcularTimelineScore(input.timeline),
    bonus_score: calcularBonusScore(input),
  };

  const total = Math.min(
    scores.budget_score + scores.authority_score + scores.need_score + scores.timeline_score + scores.bonus_score,
    100
  );

  return {
    total,
    scores,
    classificacao: classificarLead(total),
  };
}

export function classificarLead(score: number): 'QUENTE' | 'MORNO' | 'FRIO' | 'DESCARTE' {
  if (score >= 80) return 'QUENTE';
  if (score >= 55) return 'MORNO';
  if (score >= 25) return 'FRIO';
  return 'DESCARTE';
}

// Contar campos BANT preenchidos (0-5)
export function contarCamposBant(campos: {
  produto?: string | null;
  ocasiao?: string | null;
  prazo?: string | null;
  orcamento?: string | null;
  decisor?: string | null;
}): number {
  let count = 0;
  if (campos.produto) count++;
  if (campos.ocasiao) count++;
  if (campos.prazo) count++;
  if (campos.orcamento) count++;
  if (campos.decisor) count++;
  return count;
}

// Mapeamento legado
export function getStatusNomePorClassificacao(classificacao: string): string {
  switch (classificacao) {
    case 'QUENTE': return 'Qualificado';
    case 'MORNO': return 'BANT';
    case 'FRIO': return 'BANT';
    case 'DESCARTE': return 'Perdido';
    default: return 'BANT';
  }
}
