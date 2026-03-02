import { ConversaList } from '../components/mensageria/ConversaList';
import { MensageriaWindow } from '../components/mensageria/MensageriaWindow';
import { DadosExtraidos } from '../components/chat/DadosExtraidos';
import { useMensageria } from '../hooks/useMensageria';

export default function Mensageria() {
  const {
    conversas,
    mensagens,
    dadosExtraidos,
    enviando,
    conversaAtual,
    filtroCanal,
    setFiltroCanal,
    selecionarConversa,
    enviarMensagem,
    enviarComDara,
    enviarMidia,
    toggleModoAuto,
  } = useMensageria();

  return (
    <div className="h-[calc(100vh-7rem)]">
      <div className="flex h-full rounded-xl overflow-hidden shadow-lg border border-wa-border">
        {/* Painel esquerdo - Lista de conversas (estilo WhatsApp) */}
        <div className="w-[380px] flex-shrink-0 border-r border-wa-border flex flex-col">
          <ConversaList
            conversas={conversas}
            conversaAtualId={conversaAtual?.id || null}
            filtroCanal={filtroCanal}
            onSelecionar={selecionarConversa}
            onFiltrar={setFiltroCanal}
          />
        </div>

        {/* Painel central - Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <MensageriaWindow
            conversa={conversaAtual}
            mensagens={mensagens}
            enviando={enviando}
            onEnviar={enviarMensagem}
            onEnviarComDara={enviarComDara}
            onEnviarMidia={enviarMidia}
            onToggleModoAuto={toggleModoAuto}
          />
        </div>

        {/* Painel direito - Dados do cliente */}
        {conversaAtual && (
          <div className="w-[280px] flex-shrink-0 bg-white border-l border-wa-border overflow-y-auto">
            <div className="bg-alisson-600 px-4 py-3">
              <h2 className="font-medium text-creme-100 text-sm">Dados do Cliente</h2>
            </div>
            <DadosExtraidos dados={dadosExtraidos} />
          </div>
        )}
      </div>
    </div>
  );
}
