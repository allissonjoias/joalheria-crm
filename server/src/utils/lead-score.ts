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
  engajamento?: number; // quantidade de mensagens
  historico_compras?: boolean;
  recorrente?: boolean;
}

// Budget: max 35 pts
function calcularBudgetScore(budget: string | null | undefined): number {
  if (!budget) return 0;
  const lower = budget.toLowerCase();

  // Tentar extrair valor numerico
  const nums = lower.match(/[\d.,]+/g);
  if (nums) {
    const valor = parseFloat(nums[nums.length - 1].replace('.', '').replace(',', '.'));
    if (valor >= 10000) return 35;
    if (valor >= 5000) return 30;
    if (valor >= 3000) return 25;
    if (valor >= 1500) return 20;
    if (valor >= 500) return 15;
    return 10;
  }

  if (lower.includes('alto') || lower.includes('sem limite') || lower.includes('qualquer')) return 30;
  if (lower.includes('medio') || lower.includes('razoavel')) return 20;
  if (lower.includes('baixo') || lower.includes('barato') || lower.includes('economico')) return 10;

  return 5; // mencionou algo mas nao da pra classificar
}

// Authority: max 15 pts
function calcularAuthorityScore(authority: string | null | undefined): number {
  if (!authority) return 0;
  const lower = authority.toLowerCase();

  if (lower.includes('sozin') || lower.includes('eu mesm') || lower.includes('eu decid') || lower.includes('ela mesm') || lower.includes('ele mesm')) return 15;
  if (lower.includes('casal') || lower.includes('juntos') || lower.includes('noiov') || lower.includes('marido') || lower.includes('esposa')) return 12;
  if (lower.includes('consultar') || lower.includes('perguntar') || lower.includes('familia')) return 8;
  if (lower.includes('presente') || lower.includes('surpresa')) return 10;

  return 5;
}

// Need: max 25 pts
function calcularNeedScore(need: string | null | undefined): number {
  if (!need) return 0;
  const lower = need.toLowerCase();
  let score = 5; // mencionou algo

  // Tipo de interesse (max +10)
  if (lower.includes('alianca') || lower.includes('casamento') || lower.includes('noivado')) score += 10;
  else if (lower.includes('anel') || lower.includes('colar') || lower.includes('brinco') || lower.includes('pulseira')) score += 8;
  else if (lower.includes('sob encomenda') || lower.includes('personaliz') || lower.includes('exclusiv')) score += 10;
  else if (lower.includes('presente') || lower.includes('joia')) score += 6;

  // Urgencia/especificidade
  if (lower.includes('especific') || lower.includes('exatamente') || lower.includes('quero')) score += 5;

  return Math.min(score, 25);
}

// Timeline: max 25 pts
function calcularTimelineScore(timeline: string | null | undefined): number {
  if (!timeline) return 0;
  const lower = timeline.toLowerCase();

  if (lower.includes('hoje') || lower.includes('agora') || lower.includes('urgente') || lower.includes('imediato')) return 25;
  if (lower.includes('esta semana') || lower.includes('proximo') || lower.includes('proxima')) return 22;
  if (lower.includes('este mes') || lower.includes('mes que vem') || lower.includes('30 dias')) return 20;
  if (lower.includes('2 meses') || lower.includes('dois meses') || lower.includes('60 dias')) return 15;
  if (lower.includes('3 meses') || lower.includes('tres meses')) return 12;
  if (lower.includes('semestre') || lower.includes('6 meses')) return 8;
  if (lower.includes('ano') || lower.includes('ainda nao') || lower.includes('sem pressa')) return 5;

  // Tentar detectar datas/meses
  const meses = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  for (const mes of meses) {
    if (lower.includes(mes)) return 15;
  }

  return 5;
}

// Bonus contextual: max 50 pts
function calcularBonusScore(input: BANTInput): number {
  let bonus = 0;

  // Engajamento (muitas mensagens = mais interessado)
  if (input.engajamento) {
    if (input.engajamento >= 20) bonus += 20;
    else if (input.engajamento >= 10) bonus += 15;
    else if (input.engajamento >= 5) bonus += 10;
    else bonus += 5;
  }

  if (input.historico_compras) bonus += 15;
  if (input.recorrente) bonus += 15;

  return Math.min(bonus, 50);
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
    150
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

// Mapeamento de classificacao para nomes de status no Kommo
// Os IDs reais serao resolvidos dinamicamente via fetchPipelines
export function getStatusNomePorClassificacao(classificacao: string): string {
  switch (classificacao) {
    case 'QUENTE': return 'Quente Transferir';
    case 'MORNO': return 'Morno Follow-up';
    case 'FRIO': return 'Em Qualificacao';
    case 'DESCARTE': return 'Perdido';
    default: return 'Em Qualificacao';
  }
}
