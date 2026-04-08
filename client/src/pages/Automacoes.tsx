import { useState, useEffect, useCallback } from 'react';
import { Plus, Play, Pause, Trash2, Copy, BarChart3, Pencil, Zap, Mail, MessageSquare, Instagram } from 'lucide-react';
import api from '../services/api';
import FlowEditor from '../components/automacao/FlowEditor';

interface Fluxo {
  id: string;
  nome: string;
  descricao: string;
  ativo: number;
  canal: string;
  criado_em: string;
  atualizado_em: string;
  stats?: { total_execucoes: number; ativas: number; concluidas: number; erros: number };
}

interface Template {
  id: string;
  nome: string;
  canal: string;
  tipo: string;
  conteudo: string;
}

type Aba = 'fluxos' | 'campanhas' | 'templates';

export default function Automacoes() {
  const [aba, setAba] = useState<Aba>('fluxos');
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor
  const [editorAberto, setEditorAberto] = useState(false);
  const [fluxoEditando, setFluxoEditando] = useState<string | null>(null);

  // Modal novo fluxo
  const [modalNovo, setModalNovo] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoDescricao, setNovoDescricao] = useState('');
  const [novoCanal, setNovoCanal] = useState('todos');

  // Modal template
  const [modalTemplate, setModalTemplate] = useState(false);
  const [templateNome, setTemplateNome] = useState('');
  const [templateCanal, setTemplateCanal] = useState('whatsapp');
  const [templateConteudo, setTemplateConteudo] = useState('');

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const [f, t, c] = await Promise.all([
        api.get('/automacao/fluxos'),
        api.get('/automacao/templates'),
        api.get('/automacao/campanhas'),
      ]);
      setFluxos(f.data);
      setTemplates(t.data);
      setCampanhas(c.data);
    } catch (e) {
      console.error('Erro ao carregar automacoes:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const criarFluxo = async () => {
    if (!novoNome.trim()) return;
    try {
      const resp = await api.post('/automacao/fluxos', {
        nome: novoNome,
        descricao: novoDescricao,
        canal: novoCanal,
      });
      setModalNovo(false);
      setNovoNome('');
      setNovoDescricao('');
      setFluxoEditando(resp.data.id);
      setEditorAberto(true);
      carregarDados();
    } catch (e) {
      console.error('Erro ao criar fluxo:', e);
    }
  };

  const toggleFluxo = async (id: string) => {
    try {
      await api.post(`/automacao/fluxos/${id}/toggle`);
      carregarDados();
    } catch (e) {
      console.error('Erro ao toggle:', e);
    }
  };

  const excluirFluxo = async (id: string) => {
    if (!confirm('Excluir este fluxo?')) return;
    try {
      await api.delete(`/automacao/fluxos/${id}`);
      carregarDados();
    } catch (e) {
      console.error('Erro ao excluir:', e);
    }
  };

  const criarTemplate = async () => {
    if (!templateNome.trim() || !templateConteudo.trim()) return;
    try {
      await api.post('/automacao/templates', {
        nome: templateNome,
        canal: templateCanal,
        conteudo: templateConteudo,
      });
      setModalTemplate(false);
      setTemplateNome('');
      setTemplateConteudo('');
      carregarDados();
    } catch (e) {
      console.error('Erro ao criar template:', e);
    }
  };

  const canalIcon = (canal: string) => {
    if (canal === 'whatsapp') return <MessageSquare size={14} className="text-green-500" />;
    if (canal === 'instagram') return <Instagram size={14} className="text-pink-500" />;
    if (canal === 'email') return <Mail size={14} className="text-blue-500" />;
    return <Zap size={14} className="text-yellow-500" />;
  };

  if (editorAberto && fluxoEditando) {
    return (
      <FlowEditor
        fluxoId={fluxoEditando}
        onVoltar={() => {
          setEditorAberto(false);
          setFluxoEditando(null);
          carregarDados();
        }}
      />
    );
  }

  return (
    <div className="p-3 md:p-6">
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Automacoes</h1>
          <p className="text-xs md:text-sm text-gray-500">Fluxos automatizados para WhatsApp e Instagram</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-4 md:mb-6 bg-gray-100 rounded-lg p-1 w-full md:w-fit overflow-x-auto">
        {([
          { key: 'fluxos' as Aba, label: 'Fluxos', icon: Zap },
          { key: 'campanhas' as Aba, label: 'Campanhas', icon: Mail },
          { key: 'templates' as Aba, label: 'Templates', icon: Copy },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setAba(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              aba === t.key ? 'bg-white text-alisson-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* === FLUXOS === */}
      {aba === 'fluxos' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setModalNovo(true)}
              className="flex items-center gap-2 bg-alisson-600 text-white px-4 py-2 rounded-lg hover:bg-alisson-700 transition-colors"
            >
              <Plus size={18} />
              Novo Fluxo
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Carregando...</div>
          ) : fluxos.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <Zap size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum fluxo criado</h3>
              <p className="text-sm text-gray-400 mb-4">Crie seu primeiro fluxo de automacao</p>
              <button
                onClick={() => setModalNovo(true)}
                className="bg-alisson-600 text-white px-6 py-2 rounded-lg hover:bg-alisson-700"
              >
                Criar Fluxo
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {fluxos.map(f => (
                <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {canalIcon(f.canal)}
                      <h3 className="font-semibold text-gray-800">{f.nome}</h3>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      f.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {f.descricao && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{f.descricao}</p>}

                  {f.stats && (
                    <div className="flex gap-4 text-xs text-gray-400 mb-4">
                      <span>{f.stats.total_execucoes} execucoes</span>
                      <span>{f.stats.ativas} ativas</span>
                      <span>{f.stats.erros} erros</span>
                    </div>
                  )}

                  <div className="flex gap-2 border-t border-gray-100 pt-3">
                    <button
                      onClick={() => { setFluxoEditando(f.id); setEditorAberto(true); }}
                      className="flex items-center gap-1 text-xs text-alisson-600 hover:text-alisson-700 font-medium"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                    <button
                      onClick={() => toggleFluxo(f.id)}
                      className={`flex items-center gap-1 text-xs font-medium ${
                        f.ativo ? 'text-orange-500 hover:text-orange-600' : 'text-green-600 hover:text-green-700'
                      }`}
                    >
                      {f.ativo ? <Pause size={14} /> : <Play size={14} />}
                      {f.ativo ? 'Pausar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => excluirFluxo(f.id)}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium ml-auto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === CAMPANHAS === */}
      {aba === 'campanhas' && (
        <div>
          {campanhas.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <Mail size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhuma campanha</h3>
              <p className="text-sm text-gray-400">Campanhas permitem enviar mensagens em massa para segmentos de clientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campanhas.map(c => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{c.nome}</h3>
                    <div className="flex gap-4 text-xs text-gray-400 mt-1">
                      <span>{c.total_contatos} contatos</span>
                      <span>{c.enviados || 0} enviados</span>
                      <span>{c.status}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    c.status === 'concluida' ? 'bg-green-100 text-green-700' :
                    c.status === 'enviando' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === TEMPLATES === */}
      {aba === 'templates' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setModalTemplate(true)}
              className="flex items-center gap-2 bg-alisson-600 text-white px-4 py-2 rounded-lg hover:bg-alisson-700"
            >
              <Plus size={18} />
              Novo Template
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <Copy size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum template</h3>
              <p className="text-sm text-gray-400">Crie templates reutilizaveis para suas automacoes</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map(t => (
                <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    {canalIcon(t.canal)}
                    <h3 className="font-semibold text-gray-800">{t.nome}</h3>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-3 bg-gray-50 rounded p-2">{t.conteudo}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Novo Fluxo */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Novo Fluxo de Automacao</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: Boas-vindas novo lead"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
                <textarea
                  value={novoDescricao}
                  onChange={e => setNovoDescricao(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Descricao opcional do fluxo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
                <select
                  value={novoCanal}
                  onChange={e => setNovoCanal(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="todos">Todos os canais</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalNovo(false)}
                className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={criarFluxo}
                className="flex-1 px-4 py-2 bg-alisson-600 text-white rounded-lg text-sm hover:bg-alisson-700"
              >
                Criar e Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Template */}
      {modalTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Novo Template</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  value={templateNome}
                  onChange={e => setTemplateNome(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: Mensagem de boas-vindas"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
                <select
                  value={templateCanal}
                  onChange={e => setTemplateCanal(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conteudo</label>
                <textarea
                  value={templateConteudo}
                  onChange={e => setTemplateConteudo(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={4}
                  placeholder="Ola {{nome}}, tudo bem? ..."
                />
                <p className="text-xs text-gray-400 mt-1">Variaveis: {'{{nome}}'}, {'{{telefone}}'}, {'{{email}}'}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalTemplate(false)}
                className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={criarTemplate}
                className="flex-1 px-4 py-2 bg-alisson-600 text-white rounded-lg text-sm hover:bg-alisson-700"
              >
                Criar Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
