import { useState, useEffect, useRef } from 'react';
import {
  Play, RotateCcw, ChevronRight, MessageSquare, Bot, Brain,
  UserPlus, Kanban, ClipboardCheck, Send, Zap, Sparkles,
  Target, Package, CreditCard, Truck, Clock, CheckCircle2,
  ArrowRight, Phone, Instagram, Pause, SkipForward, Heart,
  RefreshCw,
} from 'lucide-react';

// ============ TYPES ============
interface Mensagem {
  de: 'cliente' | 'ia';
  texto: string;
  hora: string;
}

interface DadoExtraido {
  campo: string;
  valor: string;
  icone: any;
  cor: string;
}

interface EtapaSimulacao {
  id: string;
  titulo: string;
  descricao: string;
  icone: any;
  cor: string;
  duracao: number; // ms para completar
}

// ============ DATA ============
const CONVERSA_SIMULADA: Mensagem[] = [
  { de: 'cliente', texto: 'Oi, boa tarde! Vi uma alianca no Instagram de voces que achei linda', hora: '14:02' },
  { de: 'ia', texto: 'Ola! Que bom que gostou! 😊 Somos especialistas em aliancas. Voce esta procurando para noivado ou casamento?', hora: '14:02' },
  { de: 'cliente', texto: 'E pra casamento, em ouro 18k. Queria algo com diamantes pequenos', hora: '14:03' },
  { de: 'ia', texto: 'Que lindo! Aliancas em ouro 18k com diamantes sao nossas mais procuradas. Voce ja tem uma faixa de orcamento em mente?', hora: '14:03' },
  { de: 'cliente', texto: 'Pensei em gastar entre 4 e 6 mil no par. Da pra parcelar?', hora: '14:04' },
  { de: 'ia', texto: 'Claro! Parcelamos em ate 10x sem juros no cartao. Nessa faixa temos opcoes incriveis. O casamento e em que mes?', hora: '14:04' },
  { de: 'cliente', texto: 'Em outubro. Meu nome e Camila, e meu noivo e o Rafael', hora: '14:05' },
  { de: 'ia', texto: 'Parabens, Camila e Rafael! 🎉 Outubro e uma data linda. Vou separar algumas opcoes especiais e te envio fotos. Posso mandar por aqui mesmo?', hora: '14:05' },
  { de: 'cliente', texto: 'Sim, por aqui mesmo! Ah e voces entregam? Sou de Campinas', hora: '14:06' },
  { de: 'ia', texto: 'Entregamos sim! Para Campinas o frete e cortesia em compras acima de R$3.000. Vou preparar uma selecao linda pra voces! 💍', hora: '14:06' },
];

const DADOS_EXTRAIDOS: DadoExtraido[] = [
  { campo: 'Nome', valor: 'Camila', icone: UserPlus, cor: 'blue' },
  { campo: 'Produto', valor: 'Alianca ouro 18k c/ diamantes', icone: Package, cor: 'amber' },
  { campo: 'Ocasiao', valor: 'Casamento', icone: Sparkles, cor: 'pink' },
  { campo: 'Orcamento', valor: 'R$ 4.000 - R$ 6.000', icone: CreditCard, cor: 'green' },
  { campo: 'Parcelas', valor: '10x sem juros', icone: CreditCard, cor: 'violet' },
  { campo: 'Entrega', valor: 'Campinas - SP', icone: Truck, cor: 'orange' },
  { campo: 'Prazo', valor: 'Outubro/2026', icone: Clock, cor: 'cyan' },
  { campo: 'Forma atend.', valor: 'WhatsApp', icone: Phone, cor: 'emerald' },
];

const BANT_SCORES = {
  budget: { valor: 25, max: 30, label: 'Orcamento definido (R$4-6k)' },
  authority: { valor: 10, max: 15, label: 'Decisora (menciona noivo)' },
  need: { valor: 28, max: 30, label: 'Necessidade clara (casamento)' },
  timeline: { valor: 16, max: 20, label: 'Prazo definido (outubro)' },
  bonus: { valor: 4, max: 5, label: 'Engajamento alto (perguntas)' },
};

const ETAPAS: EtapaSimulacao[] = [
  { id: 'msg', titulo: 'Lead chega - Contato', descricao: 'Cliente envia mensagem no WhatsApp. ODV criada automaticamente no bloco Qualificacao > sub-etapa Contato.', icone: MessageSquare, cor: 'emerald', duracao: 4000 },
  { id: 'bant_realtime', titulo: 'BANT preenchido em tempo real', descricao: 'ODV auto-move para sub-etapa BANT. A cada resposta do cliente, o Agente SDR preenche um campo do BANT (Necessidade, Orcamento, Decisor, Prazo, Bonus). Dados extraidos em paralelo.', icone: Target, cor: 'violet', duracao: 30000 },
  { id: 'cliente_criado', titulo: 'Perfil do cliente cadastrado', descricao: 'Cliente criado automaticamente com todos os dados extraidos pela IA. Campos auto-preenchidos ficam marcados com badge violeta.', icone: UserPlus, cor: 'cyan', duracao: 4000 },
  { id: 'qualificado', titulo: 'Score 83 QUENTE - Handoff SDR > Vendas', descricao: 'Com score BANT >= 80, a ODV move para sub-etapa Qualificado. Agente SDR emite evento "lead_qualificado" e transfere o atendimento para o Agente Vendas.', icone: ArrowRight, cor: 'indigo', duracao: 5000 },
  { id: 'tarefa', titulo: 'Tarefas auto-criadas', descricao: 'Sistema cria tarefas automaticas: enviar fotos das aliancas, follow-up em 24h, lembrete pre-casamento.', icone: ClipboardCheck, cor: 'orange', duracao: 4000 },
  { id: 'distribuicao', titulo: 'Lead distribuido', descricao: 'Lead QUENTE distribuido para a vendedora com menos ODVs em aberto (round-robin ou menos ocupada).', icone: Send, cor: 'pink', duracao: 3500 },
  { id: 'negociacao', titulo: 'Agente Vendas negocia', descricao: 'Agente Vendas envia orcamento, responde objecoes, oferece parcelamento. ODV passa por Orcamento > Negociacao > Aguardando Pagamento.', icone: CreditCard, cor: 'amber', duracao: 7000 },
  { id: 'ganho', titulo: 'Venda fechada (Ganho)', descricao: 'Pagamento confirmado. ODV vai para sub-etapa Ganho no bloco Fechamento. Sistema auto-cria registro de venda e dispara handoff para Logistica.', icone: CheckCircle2, cor: 'green', duracao: 5000 },
  { id: 'logistica', titulo: 'Agente Logistica assume', descricao: 'ODV entra no bloco Logistica: Aguardando Envio > Enviado > Entregue. Agente Logistica notifica cliente com rastreio e prazos.', icone: Truck, cor: 'blue', duracao: 6500 },
  { id: 'sucesso', titulo: 'Agente Sucesso valida', descricao: 'Apos entrega, ODV vai para bloco Sucesso do Cliente. Agente Sucesso pergunta sobre satisfacao, resolve problemas, inicia fidelizacao.', icone: Heart, cor: 'emerald', duracao: 5000 },
  { id: 'nutricao', titulo: 'Agente Nutricao cuida', descricao: 'ODV entra no bloco Nutricao > Recompra. Agente Nutricao agenda contatos 30/60/90 dias com conteudo personalizado.', icone: RefreshCw, cor: 'pink', duracao: 6000 },
  { id: 'recompra', titulo: 'Nova ODV de recompra', descricao: 'Aos 90 dias, se cliente engajou, nova ODV criada automaticamente no bloco Qualificacao. O ciclo recomeca com o Agente SDR!', icone: Sparkles, cor: 'rose', duracao: 4500 },
];

// Novo pipeline: 19 etapas em 6 blocos
const ESTAGIOS_PIPELINE = [
  { nome: 'Contato', bloco: 'Qualificacao' },
  { nome: 'BANT', bloco: 'Qualificacao' },
  { nome: 'Qualificado', bloco: 'Qualificacao' },
  { nome: 'Orcamento', bloco: 'Fechamento' },
  { nome: 'Negociacao', bloco: 'Fechamento' },
  { nome: 'Aguardando Pagamento', bloco: 'Fechamento' },
  { nome: 'Ganho', bloco: 'Fechamento' },
  { nome: 'Aguardando Envio', bloco: 'Logistica' },
  { nome: 'Enviado', bloco: 'Logistica' },
  { nome: 'Entregue', bloco: 'Logistica' },
  { nome: 'Sucesso', bloco: 'Sucesso do Cliente' },
  { nome: 'Pos-venda', bloco: 'Sucesso do Cliente' },
  { nome: 'Recompra', bloco: 'Nutricao' },
];

const FASE_CORES: Record<string, string> = {
  'Qualificacao': 'indigo',
  'Fechamento': 'amber',
  'Logistica': 'blue',
  'Sucesso do Cliente': 'emerald',
  'Nutricao': 'pink',
  'Arquivo': 'gray',
};


// ============ COMPONENT ============
export default function Simulador() {
  const [rodando, setRodando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState(-1);
  const [mensagensVisiveis, setMensagensVisiveis] = useState<number>(0);
  const [dadosVisiveis, setDadosVisiveis] = useState<number>(0);
  const [bantAnimado, setBantAnimado] = useState(false);
  const [bantAtual, setBantAtual] = useState<Record<string, number>>({ budget: 0, authority: 0, need: 0, timeline: 0, bonus: 0 });
  const bantTotal = bantAtual.budget + bantAtual.authority + bantAtual.need + bantAtual.timeline + bantAtual.bonus;
  const [estagioAtual, setEstagioAtual] = useState(0);
  const [tarefasVisiveis, setTarefasVisiveis] = useState(0);
  const [etapasCompletas, setEtapasCompletas] = useState<Set<string>>(new Set());
  const [tarefasPosVendaVisiveis, setTarefasPosVendaVisiveis] = useState(0);
  const [nutricaoVisiveis, setNutricaoVisiveis] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const pausadoRef = useRef(false);

  // sync ref
  useEffect(() => { pausadoRef.current = pausado; }, [pausado]);

  const sleep = (ms: number) => new Promise<void>((resolve) => {
    const check = () => {
      if (!pausadoRef.current) resolve();
      else setTimeout(check, 100);
    };
    setTimeout(check, ms);
  });

  const resetar = () => {
    setRodando(false);
    setPausado(false);
    setEtapaAtual(-1);
    setMensagensVisiveis(0);
    setDadosVisiveis(0);
    setBantAnimado(false);
    setBantAtual({ budget: 0, authority: 0, need: 0, timeline: 0, bonus: 0 });
    setEstagioAtual(0);
    setTarefasVisiveis(0);
    setTarefasPosVendaVisiveis(0);
    setNutricaoVisiveis(0);
    setEtapasCompletas(new Set());
  };

  const completarEtapa = (id: string) => {
    setEtapasCompletas(prev => new Set([...prev, id]));
  };

  // Anima preenchimento de um campo BANT de forma progressiva
  const animarBant = async (campo: keyof typeof BANT_SCORES, target: number) => {
    for (let v = 1; v <= target; v++) {
      await sleep(80);
      setBantAtual(prev => ({ ...prev, [campo]: v }));
    }
  };

  const iniciarSimulacao = async () => {
    resetar();
    setRodando(true);

    // ========== ETAPA 0: Lead chega - ODV em Contato ==========
    setEtapaAtual(0);
    setEstagioAtual(0); // Contato
    await sleep(1500);
    setMensagensVisiveis(1); // Cliente: "Oi, vi alianca Instagram"
    setDadosVisiveis(1); // Forma atend: WhatsApp
    await sleep(3500);
    completarEtapa('msg');

    // ========== ETAPA 1: BANT em tempo real ==========
    setEtapaAtual(1);
    setBantAnimado(true);
    await sleep(1500);
    setEstagioAtual(1); // Move para BANT
    await sleep(2500);

    // Msg 2 (IA): "Para noivado ou casamento?"
    setMensagensVisiveis(2);
    await sleep(3000);

    // Msg 3 (cliente): "casamento, ouro 18k com diamantes"
    // → Preenche NECESSIDADE (campo BANT) em tempo real
    setMensagensVisiveis(3);
    await sleep(1500);
    setDadosVisiveis(3); // Produto + Ocasiao aparecem
    await animarBant('need', BANT_SCORES.need.valor);
    await sleep(2000);

    // Msg 4 (IA): "Faixa de orcamento?"
    setMensagensVisiveis(4);
    await sleep(3000);

    // Msg 5 (cliente): "4-6 mil, parcelar"
    // → Preenche ORCAMENTO em tempo real
    setMensagensVisiveis(5);
    await sleep(1500);
    setDadosVisiveis(5); // Orcamento + Parcelas
    await animarBant('budget', BANT_SCORES.budget.valor);
    await sleep(2000);

    // Msg 6 (IA): "Em que mes e o casamento?"
    setMensagensVisiveis(6);
    await sleep(3000);

    // Msg 7 (cliente): "Outubro. Sou Camila, noivo Rafael"
    // → Preenche DECISOR (menciona noivo) + PRAZO (outubro)
    setMensagensVisiveis(7);
    await sleep(1500);
    setDadosVisiveis(7); // Nome + Prazo
    await animarBant('authority', BANT_SCORES.authority.valor);
    await sleep(500);
    await animarBant('timeline', BANT_SCORES.timeline.valor);
    await sleep(2000);

    // Msg 8 (IA): "Vou separar opcoes especiais"
    setMensagensVisiveis(8);
    await sleep(3000);

    // Msg 9 (cliente): "Voces entregam? Campinas"
    // → Preenche BONUS (engajamento alto - faz perguntas)
    setMensagensVisiveis(9);
    await sleep(1500);
    setDadosVisiveis(DADOS_EXTRAIDOS.length); // Todos os campos preenchidos
    await animarBant('bonus', BANT_SCORES.bonus.valor);
    await sleep(2000);

    // Msg 10 (IA): "Entregamos, frete cortesia"
    setMensagensVisiveis(10);
    await sleep(2500);
    completarEtapa('bant_realtime');

    // ========== ETAPA 2: Cliente criado (perfil completo) ==========
    setEtapaAtual(2);
    await sleep(4000);
    completarEtapa('cliente_criado');

    // ========== ETAPA 3: Score >= 80 - Handoff SDR > Vendas ==========
    setEtapaAtual(3);
    await sleep(2500);
    setEstagioAtual(2); // Qualificado
    await sleep(3500);
    completarEtapa('qualificado');

    // ========== ETAPA 4: Tarefas auto-criadas ==========
    setEtapaAtual(4);
    for (let i = 1; i <= 3; i++) {
      await sleep(1300);
      setTarefasVisiveis(i);
    }
    await sleep(1500);
    completarEtapa('tarefa');

    // ========== ETAPA 5: Distribuicao ==========
    setEtapaAtual(5);
    await sleep(2500);
    completarEtapa('distribuicao');

    // ========== ETAPA 6: Agente Vendas negocia ==========
    setEtapaAtual(6);
    await sleep(1500);
    setEstagioAtual(3); // Orcamento
    await sleep(2500);
    setEstagioAtual(4); // Negociacao
    await sleep(2500);
    setEstagioAtual(5); // Aguardando Pagamento
    await sleep(2000);
    completarEtapa('negociacao');

    // ========== ETAPA 7: Ganho ==========
    setEtapaAtual(7);
    await sleep(2000);
    setEstagioAtual(6); // Ganho
    await sleep(3500);
    completarEtapa('ganho');

    // ========== ETAPA 8: Agente Logistica ==========
    setEtapaAtual(8);
    await sleep(1500);
    setEstagioAtual(7); // Aguardando Envio
    for (let i = 1; i <= 3; i++) {
      await sleep(1100);
      setTarefasPosVendaVisiveis(i);
    }
    await sleep(1500);
    setEstagioAtual(8); // Enviado
    await sleep(2000);
    setEstagioAtual(9); // Entregue
    await sleep(1500);
    completarEtapa('logistica');

    // ========== ETAPA 9: Agente Sucesso ==========
    setEtapaAtual(9);
    await sleep(2000);
    setEstagioAtual(10); // Sucesso
    await sleep(1500);
    setEstagioAtual(11); // Pos-venda
    await sleep(2500);
    completarEtapa('sucesso');

    // ========== ETAPA 10: Agente Nutricao ==========
    setEtapaAtual(10);
    await sleep(1500);
    setEstagioAtual(12); // Recompra
    for (let i = 1; i <= 3; i++) {
      await sleep(1500);
      setNutricaoVisiveis(i);
    }
    await sleep(1500);
    completarEtapa('nutricao');

    // ========== ETAPA 11: Nova ODV de recompra ==========
    setEtapaAtual(11);
    await sleep(3000);
    completarEtapa('recompra');

    await sleep(1500);
    setRodando(false);
  };

  const pularParaFim = () => {
    setMensagensVisiveis(CONVERSA_SIMULADA.length);
    setDadosVisiveis(DADOS_EXTRAIDOS.length);
    setBantAnimado(true);
    setBantAtual({
      budget: BANT_SCORES.budget.valor,
      authority: BANT_SCORES.authority.valor,
      need: BANT_SCORES.need.valor,
      timeline: BANT_SCORES.timeline.valor,
      bonus: BANT_SCORES.bonus.valor,
    });
    setEstagioAtual(ESTAGIOS_PIPELINE.length - 1);
    setTarefasVisiveis(3);
    setTarefasPosVendaVisiveis(3);
    setNutricaoVisiveis(3);
    setEtapaAtual(ETAPAS.length - 1);
    setEtapasCompletas(new Set(ETAPAS.map(e => e.id)));
    setRodando(false);
  };

  // auto-scroll chat
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensagensVisiveis]);

  const corBadgeBant = bantTotal >= 80 ? 'red' : bantTotal >= 55 ? 'yellow' : bantTotal >= 25 ? 'blue' : 'gray';
  const labelBant = bantTotal >= 80 ? 'QUENTE' : bantTotal >= 55 ? 'MORNO' : bantTotal >= 25 ? 'FRIO' : 'DESCARTE';

  return (
    <div className="p-3 md:p-4 lg:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Zap size={22} className="text-amber-500" />
            Simulador
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            IA automatizando vendas do primeiro contato ao fechamento
          </p>
        </div>
        <div className="flex gap-2">
          {!rodando && etapaAtual === -1 && (
            <button onClick={iniciarSimulacao} className="flex items-center gap-2 px-5 py-2.5 bg-alisson-600 text-white rounded-lg hover:bg-alisson-700 transition font-medium shadow-lg shadow-alisson-600/30">
              <Play size={18} /> Iniciar Simulacao
            </button>
          )}
          {rodando && (
            <>
              <button onClick={() => setPausado(!pausado)} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm">
                {pausado ? <Play size={16} /> : <Pause size={16} />}
                {pausado ? 'Continuar' : 'Pausar'}
              </button>
              <button onClick={pularParaFim} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition text-sm">
                <SkipForward size={16} /> Pular
              </button>
            </>
          )}
          {(etapaAtual >= 0 && !rodando) && (
            <button onClick={resetar} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
              <RotateCcw size={16} /> Reiniciar
            </button>
          )}
        </div>
      </div>

      {/* Timeline de etapas */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {ETAPAS.map((etapa, i) => {
            const ativa = i === etapaAtual;
            const completa = etapasCompletas.has(etapa.id);
            const Icone = etapa.icone;
            return (
              <div key={etapa.id} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                  ativa ? `bg-${etapa.cor}-100 text-${etapa.cor}-700 ring-2 ring-${etapa.cor}-300 scale-105` :
                  completa ? 'bg-green-50 text-green-600' :
                  'bg-gray-50 text-gray-400'
                }`}>
                  {completa ? <CheckCircle2 size={14} className="text-green-500" /> : <Icone size={14} />}
                  <span className="hidden sm:inline">{etapa.titulo}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </div>
                {i < ETAPAS.length - 1 && (
                  <ChevronRight size={14} className={`mx-0.5 flex-shrink-0 ${completa ? 'text-green-400' : 'text-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tela vazia antes de iniciar */}
      {etapaAtual === -1 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-alisson-50 flex items-center justify-center mb-4">
            <Zap size={36} className="text-alisson-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Pronto para ver a magia acontecer?</h2>
          <p className="text-gray-500 max-w-md mb-1">
            O simulador vai mostrar uma cliente real chegando pelo WhatsApp e como a IA processa tudo automaticamente:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 max-w-3xl">
            {[
              { icone: Bot, texto: 'IA SDR auto-responde', cor: 'violet' },
              { icone: Brain, texto: 'Extracao de dados', cor: 'blue' },
              { icone: Target, texto: 'Scoring BANT', cor: 'red' },
              { icone: RefreshCw, texto: 'Ciclo de vida completo', cor: 'pink' },
            ].map((item) => (
              <div key={item.texto} className={`flex flex-col items-center gap-2 p-3 rounded-lg bg-${item.cor}-50 border border-${item.cor}-100`}>
                <item.icone size={22} className={`text-${item.cor}-500`} />
                <span className={`text-xs font-medium text-${item.cor}-700`}>{item.texto}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layout principal da simulacao */}
      {etapaAtual >= 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Coluna esquerda - Chat */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Header do chat */}
              <div className="bg-emerald-600 text-white px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-bold">C</div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Camila {mensagensVisiveis >= 7 ? 'Rodrigues' : ''}</p>
                  <p className="text-xs text-emerald-200 flex items-center gap-1">
                    <Phone size={10} /> WhatsApp
                    {etapaAtual === 1 && rodando && <span className="ml-2 animate-pulse">digitando...</span>}
                  </p>
                </div>
                {mensagensVisiveis > 0 && (
                  <span className="text-xs bg-emerald-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Bot size={12} /> Modo Auto
                  </span>
                )}
              </div>

              {/* Mensagens */}
              <div ref={chatRef} className="h-[420px] overflow-y-auto p-3 space-y-2 bg-[#e5ddd5]">
                {CONVERSA_SIMULADA.slice(0, mensagensVisiveis).map((msg, i) => (
                  <div key={i} className={`flex ${msg.de === 'cliente' ? 'justify-start' : 'justify-end'} animate-fade-in`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm shadow-sm ${
                      msg.de === 'cliente'
                        ? 'bg-white text-gray-800 rounded-tl-none'
                        : 'bg-[#dcf8c6] text-gray-800 rounded-tr-none'
                    }`}>
                      {msg.de === 'ia' && (
                        <div className="flex items-center gap-1 mb-0.5">
                          <Bot size={10} className="text-violet-500" />
                          <span className="text-[10px] text-violet-500 font-medium">IA SDR</span>
                        </div>
                      )}
                      <p>{msg.texto}</p>
                      <p className="text-[10px] text-gray-400 text-right mt-0.5">{msg.hora}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna central - Dados extraidos + BANT */}
          <div className="lg:col-span-4 space-y-4">
            {/* Descricao da etapa atual */}
            {etapaAtual >= 0 && etapaAtual < ETAPAS.length && (
              <div className={`bg-${ETAPAS[etapaAtual].cor}-50 border border-${ETAPAS[etapaAtual].cor}-200 rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  {(() => { const Ic = ETAPAS[etapaAtual].icone; return <Ic size={18} className={`text-${ETAPAS[etapaAtual].cor}-600`} />; })()}
                  <h3 className={`font-semibold text-sm text-${ETAPAS[etapaAtual].cor}-700`}>
                    Etapa {etapaAtual + 1}: {ETAPAS[etapaAtual].titulo}
                  </h3>
                </div>
                <p className={`text-xs text-${ETAPAS[etapaAtual].cor}-600`}>{ETAPAS[etapaAtual].descricao}</p>
              </div>
            )}

            {/* Dados extraidos */}
            {dadosVisiveis > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Brain size={16} className="text-blue-500" />
                  Dados extraidos pela IA
                  <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full ml-auto">auto-fill</span>
                </h3>
                <div className="space-y-2">
                  {DADOS_EXTRAIDOS.slice(0, dadosVisiveis).map((d, i) => {
                    const Ic = d.icone;
                    return (
                      <div key={i} className="flex items-center gap-2 animate-fade-in">
                        <div className={`w-7 h-7 rounded-md bg-${d.cor}-50 flex items-center justify-center flex-shrink-0`}>
                          <Ic size={14} className={`text-${d.cor}-500`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] text-gray-400 block">{d.campo}</span>
                          <span className="text-xs font-medium text-gray-700 truncate block">{d.valor}</span>
                        </div>
                        <Sparkles size={12} className="text-violet-400 flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BANT Score */}
            {bantAnimado && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-fade-in">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Target size={16} className="text-red-500" />
                  Qualificacao BANT
                  {bantTotal > 0 && (
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                      bantTotal >= 80 ? 'bg-red-100 text-red-700' :
                      bantTotal >= 55 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {bantTotal}/100 {labelBant}
                    </span>
                  )}
                </h3>
                <div className="space-y-2">
                  {Object.entries(BANT_SCORES).map(([key, s]) => {
                    const atual = bantAtual[key] || 0;
                    return (
                      <div key={key} className="space-y-0.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-500 uppercase font-medium">{key === 'bonus' ? 'Engajamento' : key === 'authority' ? 'Decisor' : key === 'need' ? 'Necessidade' : key === 'timeline' ? 'Prazo' : 'Orcamento'}</span>
                          <span className={`font-bold ${atual > 0 ? 'text-gray-700' : 'text-gray-300'}`}>{atual}/{s.max}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              key === 'budget' ? 'bg-green-400' :
                              key === 'authority' ? 'bg-blue-400' :
                              key === 'need' ? 'bg-purple-400' :
                              key === 'timeline' ? 'bg-amber-400' : 'bg-pink-400'
                            }`}
                            style={{ width: `${(atual / s.max) * 100}%` }}
                          />
                        </div>
                        <p className={`text-[10px] ${atual > 0 ? 'text-gray-500' : 'text-gray-300'}`}>{atual > 0 ? s.label : 'Aguardando resposta do cliente...'}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Coluna direita - Pipeline + Tarefas */}
          <div className="lg:col-span-3 space-y-4">
            {/* Mini Pipeline - Ciclo de Vida */}
            {estagioAtual >= 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-fade-in">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Kanban size={16} className="text-amber-500" />
                  Funil em Blocos
                </h3>
                <div className="space-y-1">
                  {ESTAGIOS_PIPELINE.map((est, i) => {
                    const ativo = i === estagioAtual;
                    const passado = i < estagioAtual;
                    const blocoAnterior = i > 0 ? ESTAGIOS_PIPELINE[i - 1].bloco : null;
                    const mostrarBloco = est.bloco !== blocoAnterior;
                    const corBloco = FASE_CORES[est.bloco] || 'gray';
                    if (i > estagioAtual + 2 && !passado && !ativo) return null;

                    return (
                      <div key={est.nome}>
                        {mostrarBloco && (
                          <div className={`text-[9px] font-bold uppercase tracking-wider text-${corBloco}-500 mt-2 mb-1 flex items-center gap-1`}>
                            <div className={`w-full h-px bg-${corBloco}-200`} />
                            <span className="whitespace-nowrap">{est.bloco}</span>
                            <div className={`w-full h-px bg-${corBloco}-200`} />
                          </div>
                        )}
                        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-500 ${
                          ativo ? `bg-${corBloco}-50 border border-${corBloco}-200 font-semibold text-${corBloco}-700` :
                          passado ? 'bg-green-50 text-green-600' :
                          'bg-gray-50 text-gray-400'
                        }`}>
                          {passado ? <CheckCircle2 size={11} className="text-green-500" /> :
                           ativo ? <ArrowRight size={11} className={`text-${corBloco}-500 animate-pulse`} /> :
                           <div className="w-2.5 h-2.5 rounded-full border border-gray-300" />}
                          <span className="text-[11px]">{est.nome}</span>
                          {ativo && <span className={`ml-auto text-[9px] bg-${corBloco}-100 text-${corBloco}-600 px-1 py-0.5 rounded`}>atual</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Card da ODV */}
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">Camila - Aliancas Casamento</span>
                  </div>
                  <p className="text-lg font-bold text-alisson-600">R$ 5.000</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Sparkles size={8} /> IA
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Package size={8} /> 1 item
                    </span>
                    <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded">
                      10x
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tarefas auto-criadas */}
            {tarefasVisiveis > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-fade-in">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <ClipboardCheck size={16} className="text-orange-500" />
                  Tarefas automaticas
                </h3>
                <div className="space-y-2">
                  {[
                    { texto: 'Enviar fotos de aliancas ouro 18k', prazo: 'Hoje 15:00', prioridade: 'alta' },
                    { texto: 'Follow-up com Camila', prazo: 'Amanha 10:00', prioridade: 'media' },
                    { texto: 'Lembrete pre-casamento (outubro)', prazo: 'Set/2026', prioridade: 'baixa' },
                  ].slice(0, tarefasVisiveis).map((t, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg animate-fade-in">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        t.prioridade === 'alta' ? 'bg-red-400' :
                        t.prioridade === 'media' ? 'bg-amber-400' : 'bg-blue-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 font-medium">{t.texto}</p>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock size={8} /> {t.prazo}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tarefas pos-venda */}
            {tarefasPosVendaVisiveis > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-fade-in">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Truck size={16} className="text-violet-500" />
                  Pos-venda automatico
                </h3>
                <div className="space-y-2">
                  {[
                    { texto: 'Preparar e embalar pedido', prazo: 'Amanha', prioridade: 'alta' },
                    { texto: 'Enviar NF e comprovante', prazo: 'Amanha', prioridade: 'media' },
                    { texto: 'Confirmar endereco entrega', prazo: 'Hoje', prioridade: 'alta' },
                  ].slice(0, tarefasPosVendaVisiveis).map((t, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-violet-50 rounded-lg animate-fade-in">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${t.prioridade === 'alta' ? 'bg-red-400' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 font-medium">{t.texto}</p>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock size={8} /> {t.prazo}
                          <Bot size={8} className="text-violet-400 ml-1" /> auto
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nutricao */}
            {nutricaoVisiveis > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-fade-in">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Heart size={16} className="text-amber-500" />
                  Nutricao automatica
                </h3>
                <div className="space-y-2">
                  {[
                    { texto: 'Contato 30 dias - como esta a peca?', dias: '30 dias', cor: 'amber' },
                    { texto: 'Contato 60 dias - novidades exclusivas', dias: '60 dias', cor: 'orange' },
                    { texto: 'Contato 90 dias - sondar recompra', dias: '90 dias', cor: 'red' },
                  ].slice(0, nutricaoVisiveis).map((n, i) => (
                    <div key={i} className={`flex items-start gap-2 p-2 bg-${n.cor}-50 rounded-lg animate-fade-in`}>
                      <Clock size={12} className={`text-${n.cor}-500 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 font-medium">{n.texto}</p>
                        <p className={`text-[10px] text-${n.cor}-500 font-medium mt-0.5`}>{n.dias} apos entrega</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Distribuicao */}
            {etapasCompletas.has('distribuicao') && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-fade-in">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Send size={16} className="text-pink-500" />
                  Lead distribuido
                </h3>
                <div className="flex items-center gap-2 p-2 bg-pink-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-pink-200 flex items-center justify-center text-xs font-bold text-pink-700">JM</div>
                  <div>
                    <p className="text-xs font-medium text-gray-700">Julia Mendes</p>
                    <p className="text-[10px] text-gray-400">Vendedora - 3 ODVs em aberto</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resultado final */}
      {!rodando && etapasCompletas.size === ETAPAS.length && (
        <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={24} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-green-800 text-lg">Simulacao completa!</h3>
              <p className="text-sm text-green-700 mt-1">
                A IA automatizou o ciclo completo: do primeiro contato ate a oportunidade de recompra.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                {[
                  { num: '10', label: 'Mensagens IA', cor: 'emerald' },
                  { num: '8', label: 'Campos auto-fill', cor: 'blue' },
                  { num: '83', label: 'Score BANT /100', cor: 'red' },
                  { num: '5', label: 'Agentes IA', cor: 'indigo' },
                  { num: '6', label: 'Blocos do Funil', cor: 'violet' },
                ].map((m) => (
                  <div key={m.label} className={`text-center p-3 bg-white rounded-lg border border-${m.cor}-100`}>
                    <p className={`text-2xl font-bold text-${m.cor}-600`}>{m.num}</p>
                    <p className="text-[10px] text-gray-500">{m.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white rounded-lg border border-indigo-100">
                  <p className="text-xs text-gray-600">
                    <strong className="text-indigo-600">Agentes especializados</strong> - SDR qualifica, Vendas negocia, Logistica entrega,
                    Sucesso fideliza e Nutricao faz recompra. Cada um expert na sua fase.
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-pink-100">
                  <p className="text-xs text-gray-600">
                    <strong className="text-pink-600">Handoffs automaticos</strong> - Ao final de cada bloco, o agente emite um evento
                    e transfere o atendimento para o proximo especialista. Zero acao manual.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
