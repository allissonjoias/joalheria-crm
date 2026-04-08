import { useState, useEffect } from 'react';
import {
  Brain, Target, Heart, Mic, Gem, TrendingUp, Code, Sparkles, User,
  Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Eye,
  CheckCircle, XCircle, Clock, FileText, BarChart3, RefreshCw,
  AlertTriangle, Lightbulb,
} from 'lucide-react';
import api from '../../services/api';

const ICONE_MAP: Record<string, any> = {
  brain: Brain, target: Target, heart: Heart, mic: Mic, gem: Gem,
  'trending-up': TrendingUp, code: Code, sparkles: Sparkles, user: User,
};

const CATEGORIA_CORES: Record<string, string> = {
  router: 'bg-violet-100 text-violet-700 border-violet-200',
  recepcao: 'bg-blue-100 text-blue-700 border-blue-200',
  qualificacao: 'bg-green-100 text-green-700 border-green-200',
  produtos: 'bg-amber-100 text-amber-700 border-amber-200',
  vendas: 'bg-orange-100 text-orange-700 border-orange-200',
  objecoes: 'bg-red-100 text-red-700 border-red-200',
  pos_venda: 'bg-pink-100 text-pink-700 border-pink-200',
  transferencia: 'bg-gray-100 text-gray-700 border-gray-200',
  personalidade: 'bg-purple-100 text-purple-700 border-purple-200',
  aprendido: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  geral: 'bg-slate-100 text-slate-700 border-slate-200',
};

const TIPO_SKILL_LABELS: Record<string, { label: string; cor: string }> = {
  mestre: { label: 'MESTRE', cor: 'bg-violet-600 text-white' },
  sub_agente: { label: 'SUB-AGENTE', cor: 'bg-alisson-600 text-white' },
  contexto: { label: 'CONTEXTO', cor: 'bg-gray-500 text-white' },
};

interface Skill {
  id: number;
  nome: string;
  tipo: string;
  tipo_skill: string; // 'mestre' | 'sub_agente' | 'contexto'
  categoria: string;
  conteudo: string;
  ativo: number;
  prioridade: number;
  icone: string;
  origem: string;
}

interface Learning {
  id: number;
  tipo: string;
  descricao: string;
  evidencias: string;
  conteudo_skill: string;
  aprovado: number;
  confianca: number;
  criado_em: string;
}

interface Report {
  id: number;
  tipo: string;
  data_referencia: string;
  conteudo: string;
  metricas: string;
  sugestoes: string;
  criado_em: string;
}

export function SkillsPanel({ agentId }: { agentId: number }) {
  const [aba, setAba] = useState<'skills' | 'aprendizado' | 'relatorios'>('skills');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [editConteudo, setEditConteudo] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState('');
  const [reportExpandido, setReportExpandido] = useState<number | null>(null);
  const [gerando, setGerando] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

  useEffect(() => {
    carregarSkills();
  }, [agentId]);

  useEffect(() => {
    if (aba === 'aprendizado') carregarLearnings();
    if (aba === 'relatorios') carregarReports();
  }, [aba]);

  const carregarSkills = () => {
    api.get(`/agentes-ia/${agentId}/skills`).then(({ data }) => setSkills(data)).catch(() => {});
  };
  const carregarLearnings = () => {
    api.get(`/agentes-ia/${agentId}/learnings`).then(({ data }) => setLearnings(data)).catch(() => {});
  };
  const carregarReports = () => {
    api.get(`/agentes-ia/${agentId}/reports`).then(({ data }) => setReports(data)).catch(() => {});
  };

  const toggleSkill = async (skill: Skill) => {
    await api.put(`/agentes-ia/${agentId}/skills/${skill.id}`, { ativo: skill.ativo ? 0 : 1 });
    carregarSkills();
  };

  const salvarEdicao = async (skillId: number) => {
    await api.put(`/agentes-ia/${agentId}/skills/${skillId}`, { conteudo: editConteudo });
    setEditando(null);
    carregarSkills();
  };

  const excluirSkill = async (skillId: number) => {
    if (!confirm('Excluir esta skill?')) return;
    await api.delete(`/agentes-ia/${agentId}/skills/${skillId}`);
    carregarSkills();
  };

  const seedSkills = async () => {
    setSeedLoading(true);
    await api.post(`/agentes-ia/${agentId}/skills/seed`);
    carregarSkills();
    setSeedLoading(false);
  };

  const verPreview = async () => {
    const { data } = await api.get(`/agentes-ia/${agentId}/skills/preview`);
    setPreviewPrompt(data.prompt);
    setPreviewOpen(!previewOpen);
  };

  const aprovarSugestao = async (id: number) => {
    await api.post(`/agentes-ia/${agentId}/learnings/${id}/aprovar`);
    carregarLearnings();
    carregarSkills();
  };

  const rejeitarSugestao = async (id: number) => {
    await api.post(`/agentes-ia/${agentId}/learnings/${id}/rejeitar`);
    carregarLearnings();
  };

  const gerarRelatorio = async () => {
    setGerando(true);
    try {
      await api.post(`/agentes-ia/${agentId}/reports/gerar`);
      carregarReports();
      carregarLearnings();
    } catch {}
    setGerando(false);
  };

  return (
    <div className="mt-4">
      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {[
          { key: 'skills' as const, label: 'Skills', icon: Brain, badge: skills.length },
          { key: 'aprendizado' as const, label: 'Aprendizado', icon: Lightbulb, badge: learnings.length },
          { key: 'relatorios' as const, label: 'Relatorios', icon: BarChart3, badge: reports.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setAba(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              aba === t.key ? 'border-alisson-500 text-alisson-600' : 'border-transparent text-gray-500'
            }`}
          >
            <t.icon size={14} />
            {t.label}
            {t.badge > 0 && (
              <span className={`ml-1 text-[10px] px-1.5 rounded-full ${
                aba === t.key ? 'bg-alisson-100 text-alisson-600' : 'bg-gray-100 text-gray-500'
              }`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== ABA SKILLS ===== */}
      {aba === 'skills' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              {skills.length === 0 && (
                <button onClick={seedSkills} disabled={seedLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-alisson-600 text-white rounded-lg text-xs font-medium hover:bg-alisson-500 disabled:opacity-50">
                  <Sparkles size={14} /> {seedLoading ? 'Criando...' : 'Criar Skills Padrao'}
                </button>
              )}
            </div>
            <button onClick={verPreview}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">
              <Eye size={14} /> {previewOpen ? 'Fechar Preview' : 'Ver Prompt Montado'}
            </button>
          </div>

          {/* Preview do prompt */}
          {previewOpen && (
            <div className="mb-4 p-3 bg-gray-900 text-green-400 rounded-lg text-xs font-mono max-h-60 overflow-y-auto whitespace-pre-wrap">
              {previewPrompt || 'Nenhuma skill ativa'}
            </div>
          )}

          {/* Lista de skills */}
          <div className="space-y-2">
            {skills.map((skill) => {
              const IconComp = ICONE_MAP[skill.icone] || Brain;
              const corCat = CATEGORIA_CORES[skill.categoria] || CATEGORIA_CORES.geral;
              const isExpanded = expandido === skill.id;
              const isEditing = editando === skill.id;

              return (
                <div key={skill.id} className={`border rounded-xl transition-all ${
                  skill.tipo_skill === 'mestre'
                    ? (skill.ativo ? 'border-violet-300 bg-violet-50' : 'border-gray-100 bg-gray-50 opacity-60')
                    : skill.tipo_skill === 'contexto'
                    ? (skill.ativo ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-gray-50 opacity-60')
                    : (skill.ativo ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60')
                }`}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <GripVertical size={14} className="text-gray-300 cursor-grab flex-shrink-0" />

                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${corCat} flex-shrink-0`}>
                      <IconComp size={16} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 truncate">{skill.nome}</span>
                        {(() => {
                          const tipoInfo = TIPO_SKILL_LABELS[skill.tipo_skill] || TIPO_SKILL_LABELS.sub_agente;
                          return <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${tipoInfo.cor}`}>{tipoInfo.label}</span>;
                        })()}
                        {skill.origem === 'aprendizado' && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-bold">APRENDIDA</span>
                        )}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${corCat}`}>{skill.categoria}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setExpandido(isExpanded ? null : skill.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg">
                        {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </button>
                      <button onClick={() => toggleSkill(skill)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${skill.ativo ? 'bg-alisson-500' : 'bg-gray-300'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${skill.ativo ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Conteudo expandido */}
                  {isExpanded && (
                    <div className="px-4 pb-3 border-t border-gray-100">
                      {isEditing ? (
                        <div className="mt-2">
                          <textarea
                            value={editConteudo}
                            onChange={(e) => setEditConteudo(e.target.value)}
                            className="w-full h-48 p-3 text-xs font-mono border border-gray-200 rounded-lg focus:ring-2 focus:ring-alisson-400 focus:outline-none resize-y"
                          />
                          <div className="flex gap-2 mt-2 justify-end">
                            <button onClick={() => setEditando(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
                            <button onClick={() => salvarEdicao(skill.id)} className="px-3 py-1.5 text-xs bg-alisson-600 text-white rounded-lg hover:bg-alisson-500">Salvar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg max-h-40 overflow-y-auto">{skill.conteudo}</pre>
                          <div className="flex gap-2 mt-2 justify-end">
                            <button onClick={() => excluirSkill(skill.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                              <Trash2 size={14} className="text-red-400" />
                            </button>
                            <button onClick={() => { setEditando(skill.id); setEditConteudo(skill.conteudo); }}
                              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">Editar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {skills.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Brain size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma skill configurada</p>
              <p className="text-xs mt-1">Clique em "Criar Skills Padrao" para comecar</p>
            </div>
          )}
        </div>
      )}

      {/* ===== ABA APRENDIZADO ===== */}
      {aba === 'aprendizado' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">{learnings.length} sugestoes pendentes</p>
            <button onClick={gerarRelatorio} disabled={gerando}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-alisson-600 text-white rounded-lg text-xs font-medium hover:bg-alisson-500 disabled:opacity-50">
              <RefreshCw size={14} className={gerando ? 'animate-spin' : ''} />
              {gerando ? 'Analisando...' : 'Analisar Agora'}
            </button>
          </div>

          <div className="space-y-3">
            {learnings.map((l) => {
              let evidencias: any = {};
              try { evidencias = JSON.parse(l.evidencias || '{}'); } catch {}

              return (
                <div key={l.id} className="border border-yellow-200 bg-yellow-50 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb size={16} className="text-yellow-600" />
                      <span className="text-sm font-medium text-gray-800">{l.descricao}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      l.confianca >= 0.8 ? 'bg-green-100 text-green-700' :
                      l.confianca >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{Math.round(l.confianca * 100)}%</span>
                  </div>

                  {evidencias.evidencia && (
                    <p className="text-xs text-gray-500 mb-2 italic">"{evidencias.evidencia}"</p>
                  )}

                  {l.conteudo_skill && (
                    <pre className="text-[11px] text-gray-600 bg-white p-2 rounded-lg mb-3 max-h-24 overflow-y-auto whitespace-pre-wrap border border-yellow-100">
                      {l.conteudo_skill}
                    </pre>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => rejeitarSugestao(l.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg">
                      <XCircle size={14} /> Rejeitar
                    </button>
                    <button onClick={() => aprovarSugestao(l.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-500">
                      <CheckCircle size={14} /> Aprovar Skill
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {learnings.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Lightbulb size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma sugestao pendente</p>
              <p className="text-xs mt-1">Clique em "Analisar Agora" para gerar insights das conversas</p>
            </div>
          )}
        </div>
      )}

      {/* ===== ABA RELATORIOS ===== */}
      {aba === 'relatorios' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">{reports.length} relatorios</p>
            <button onClick={gerarRelatorio} disabled={gerando}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-alisson-600 text-white rounded-lg text-xs font-medium hover:bg-alisson-500 disabled:opacity-50">
              <FileText size={14} />
              {gerando ? 'Gerando...' : 'Gerar Relatorio'}
            </button>
          </div>

          <div className="space-y-3">
            {reports.map((r) => {
              let conteudo: any = {};
              let metricas: any = {};
              try { conteudo = JSON.parse(r.conteudo || '{}'); } catch {}
              try { metricas = JSON.parse(r.metricas || '{}'); } catch {}
              const isExpanded = reportExpandido === r.id;

              return (
                <div key={r.id} className="border border-gray-200 bg-white rounded-xl overflow-hidden">
                  <button onClick={() => setReportExpandido(isExpanded ? null : r.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-alisson-500" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-800">{r.data_referencia}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[250px]">{conteudo.resumo || 'Relatorio diario'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {metricas.nota && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          metricas.nota >= 8 ? 'bg-green-100 text-green-700' :
                          metricas.nota >= 5 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>Nota {metricas.nota}/10</span>
                      )}
                      {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 space-y-3">
                      {/* Metricas */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                        <div className="bg-green-50 rounded-lg p-2 text-center">
                          <p className="text-lg font-bold text-green-600">{metricas.vendas || 0}</p>
                          <p className="text-[10px] text-green-600">Vendas</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-2 text-center">
                          <p className="text-lg font-bold text-red-600">{metricas.perdas || 0}</p>
                          <p className="text-[10px] text-red-600">Perdas</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 text-center">
                          <p className="text-lg font-bold text-blue-600">{metricas.total_conversas || 0}</p>
                          <p className="text-[10px] text-blue-600">Conversas</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-2 text-center">
                          <p className="text-lg font-bold text-purple-600">{conteudo.taxa_conversao_estimada || '-'}</p>
                          <p className="text-[10px] text-purple-600">Conversao</p>
                        </div>
                      </div>

                      {/* Insights */}
                      {conteudo.destaque_positivo && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-green-600 mb-1">DESTAQUE POSITIVO</p>
                          <p className="text-xs text-green-800">{conteudo.destaque_positivo}</p>
                        </div>
                      )}
                      {conteudo.ponto_melhoria && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-orange-600 mb-1">PONTO DE MELHORIA</p>
                          <p className="text-xs text-orange-800">{conteudo.ponto_melhoria}</p>
                        </div>
                      )}

                      {/* Objecoes */}
                      {conteudo.objecoes_frequentes?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Objecoes Frequentes</p>
                          {conteudo.objecoes_frequentes.map((o: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
                              <AlertTriangle size={12} className="text-orange-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-xs font-medium text-gray-700">{o.tipo}</span>
                                {o.sugestao_resposta && <p className="text-[11px] text-gray-500 mt-0.5">{o.sugestao_resposta}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Vendas perdidas */}
                      {conteudo.vendas_perdidas?.melhorias && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Melhorias Sugeridas</p>
                          <p className="text-xs text-gray-600">{conteudo.vendas_perdidas.melhorias}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {reports.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <BarChart3 size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum relatorio gerado</p>
              <p className="text-xs mt-1">Clique em "Gerar Relatorio" para analisar as conversas do dia</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
