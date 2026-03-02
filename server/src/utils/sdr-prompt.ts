export function getResumoManhaPrompt(dados: string): string {
  return `Voce e o assistente SDR da joalheria Alisson. Gere um resumo matinal conciso para WhatsApp.

DADOS DO DIA ANTERIOR E PENDENCIAS:
${dados}

REGRAS:
- Max 500 caracteres
- Use *negrito* para destaques
- Seja direto e profissional
- Foque em: leads novos, vendas fechadas, tasks pendentes, leads inativos
- Termine com uma frase motivacional curta
- Nao use emojis excessivos, max 3
- Formato: texto corrido com quebras de linha, nao lista`;
}

export function getResumoTardePrompt(dados: string): string {
  return `Voce e o assistente SDR da joalheria Alisson. Gere um resumo vespertino conciso para WhatsApp.

DADOS DO DIA:
${dados}

REGRAS:
- Max 500 caracteres
- Use *negrito* para destaques
- Seja direto e profissional
- Foque em: progresso do dia, leads que precisam de atencao, tasks vencidas
- Termine com proximo passo recomendado
- Nao use emojis excessivos, max 3
- Formato: texto corrido com quebras de linha, nao lista`;
}
