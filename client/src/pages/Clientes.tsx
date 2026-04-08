import { useEffect, useState } from 'react';
import { Plus, Search, Phone, Mail, Tag, Calendar, Edit2, Trash2, MapPin, CreditCard, Cake, ShieldCheck, UserX, DollarSign, ShoppingBag, AlertTriangle, Clock, XCircle, RotateCcw } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Tooltip } from '../components/ui/Tooltip';
import api from '../services/api';

interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  cpf?: string;
  data_nascimento?: string;
  tipo_interesse?: string;
  material_preferido?: string;
  pedra_preferida?: string;
  orcamento_min?: number;
  orcamento_max?: number;
  ocasiao?: string;
  tags: string;
  notas?: string;
  origem?: string;
  forma_atendimento?: string;
  cep?: string;
  endereco?: string;
  numero_endereco?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  criado_em: string;
}

interface Interacao {
  id: string;
  tipo: string;
  descricao: string;
  criado_em: string;
}

interface ClienteOdv {
  id: string;
  titulo: string;
  valor: number;
  estagio: string;
  criado_em: string;
  atualizado_em: string;
  produto_interesse?: string;
  motivo_perda?: string;
  vendedor_nome?: string;
  estagio_tipo?: string;
  estagio_fase?: string;
  venda_ativa?: number;
  venda_estornada?: number;
  data_venda?: string;
  data_estorno?: string;
  motivo_estorno?: string;
}

interface ClienteResumo {
  total: number;
  ganhas: number;
  perdidas: number;
  estornadas: number;
  abertas: number;
  valor_total: number;
  classificacao: 'cliente' | 'lead';
}

const INTERESSE_CORES: Record<string, 'gold' | 'blue' | 'purple' | 'green' | 'orange'> = {
  aliancas: 'gold',
  aneis: 'blue',
  colares: 'purple',
  brincos: 'green',
  pulseiras: 'orange',
};

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const FORM_VAZIO = {
  nome: '', telefone: '', email: '', tipo_interesse: '', ocasiao: '', notas: '',
  cpf: '', data_nascimento: '', cep: '', endereco: '', numero_endereco: '',
  complemento: '', bairro: '', cidade: '', estado: '', origem: '', forma_atendimento: '',
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [clienteOdvs, setClienteOdvs] = useState<ClienteOdv[]>([]);
  const [clienteResumo, setClienteResumo] = useState<ClienteResumo | null>(null);
  const [abaDetalhes, setAbaDetalhes] = useState<'odvs' | 'interacoes' | 'info'>('odvs');
  const [form, setForm] = useState(FORM_VAZIO);
  const [abaForm, setAbaForm] = useState<'basico' | 'endereco' | 'preferencias'>('basico');
  const [origens, setOrigens] = useState<{ id: number; nome: string }[]>([]);

  useEffect(() => { carregar(); }, [busca]);
  useEffect(() => {
    api.get('/funil/origens-lead').then(({ data }) => setOrigens(data)).catch(() => {});
  }, []);

  const carregar = async () => {
    const { data } = await api.get('/clientes', { params: { busca: busca || undefined } });
    setClientes(data);
  };

  const handleSalvar = async () => {
    try {
      if (clienteSelecionado) {
        await api.put(`/clientes/${clienteSelecionado.id}`, form);
      } else {
        await api.post('/clientes', form);
      }
      setModalAberto(false);
      setClienteSelecionado(null);
      setForm(FORM_VAZIO);
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao salvar');
    }
  };

  const handleEditar = (c: Cliente) => {
    setClienteSelecionado(c);
    setForm({
      nome: c.nome, telefone: c.telefone || '', email: c.email || '',
      tipo_interesse: c.tipo_interesse || '', ocasiao: c.ocasiao || '', notas: c.notas || '',
      cpf: c.cpf || '', data_nascimento: c.data_nascimento || '',
      cep: c.cep || '', endereco: c.endereco || '', numero_endereco: c.numero_endereco || '',
      complemento: c.complemento || '', bairro: c.bairro || '',
      cidade: c.cidade || '', estado: c.estado || '',
      origem: c.origem || '', forma_atendimento: c.forma_atendimento || '',
    });
    setAbaForm('basico');
    setModalAberto(true);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este cliente?')) return;
    await api.delete(`/clientes/${id}`);
    carregar();
  };

  const handleVerDetalhes = async (c: Cliente) => {
    setClienteSelecionado(c);
    setAbaDetalhes('odvs');
    const [interRes, odvsRes] = await Promise.all([
      api.get(`/clientes/${c.id}/interacoes`),
      api.get(`/clientes/${c.id}/odvs`),
    ]);
    setInteracoes(interRes.data);
    setClienteOdvs(odvsRes.data.odvs);
    setClienteResumo(odvsRes.data.resumo);
    setDetalhesAberto(true);
  };

  const buscarCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        setForm(f => ({
          ...f,
          endereco: data.logradouro || f.endereco,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado,
        }));
      }
    } catch {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 md:mb-6">
        <h1 className="hidden md:block text-2xl font-bold text-alisson-600">Clientes</h1>
        <Button onClick={() => { setClienteSelecionado(null); setForm(FORM_VAZIO); setAbaForm('basico'); setModalAberto(true); }} tamanho="sm" className="md:!text-sm">
          <Plus size={16} /> <span className="hidden sm:inline">Novo Cliente</span><span className="sm:hidden">Novo</span>
        </Button>
      </div>

      <div className="mb-3 md:mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone ou email..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {clientes.map((c) => (
          <Card key={c.id} className="p-4" onClick={() => handleVerDetalhes(c)}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-alisson-600">{c.nome}</h3>
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); handleEditar(c); }} className="p-1 hover:bg-gray-100 rounded">
                  <Edit2 size={14} className="text-gray-400" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleExcluir(c.id); }} className="p-1 hover:bg-red-50 rounded">
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </div>
            {c.telefone && <p className="text-sm text-gray-600 flex items-center gap-2 mb-1"><Phone size={14} /> {c.telefone}</p>}
            {c.email && <p className="text-sm text-gray-600 flex items-center gap-2 mb-1"><Mail size={14} /> {c.email}</p>}
            {c.cidade && <p className="text-sm text-gray-500 flex items-center gap-2 mb-1"><MapPin size={14} /> {c.cidade}{c.estado ? ` - ${c.estado}` : ''}</p>}
            <div className="flex gap-2 mt-3 flex-wrap">
              {c.tipo_interesse && <Badge cor={INTERESSE_CORES[c.tipo_interesse] || 'gray'}>{c.tipo_interesse}</Badge>}
              {c.ocasiao && <Badge cor="gold">{c.ocasiao}</Badge>}
              {c.origem && <Badge cor="blue">{c.origem}</Badge>}
            </div>
            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <Calendar size={12} /> {new Date(c.criado_em).toLocaleDateString('pt-BR')}
            </p>
          </Card>
        ))}
      </div>

      {clientes.length === 0 && (
        <div className="text-center py-12 text-gray-400"><p>Nenhum cliente encontrado</p></div>
      )}

      {/* Form modal com abas */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo={clienteSelecionado ? 'Editar Cliente' : 'Novo Cliente'} largura="max-w-xl">
        <div className="space-y-4">
          {/* Abas */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {[
              { v: 'basico' as const, l: 'Dados Basicos' },
              { v: 'endereco' as const, l: 'Endereco' },
              { v: 'preferencias' as const, l: 'Preferencias' },
            ].map((a) => (
              <button
                key={a.v}
                onClick={() => setAbaForm(a.v)}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  abaForm === a.v ? 'bg-white shadow-sm text-alisson-600' : 'text-gray-500'
                }`}
              >
                {a.l}
              </button>
            ))}
          </div>

          {abaForm === 'basico' && (
            <>
              <Input label="Nome *" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <Input label="Telefone" value={form.telefone} onChange={(e) => setForm({...form, telefone: e.target.value})} placeholder="(85) 99999-9999" />
                <Input label="Email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <Input label="CPF" value={form.cpf} onChange={(e) => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00" />
                <Input label="Data de Nascimento" type="date" value={form.data_nascimento} onChange={(e) => setForm({...form, data_nascimento: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                  <select value={form.origem} onChange={(e) => setForm({...form, origem: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm">
                    <option value="">Selecionar</option>
                    {origens.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Atendimento</label>
                  <select value={form.forma_atendimento} onChange={(e) => setForm({...form, forma_atendimento: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm">
                    <option value="">Selecionar</option>
                    <option value="online">Somente Online</option>
                    <option value="presencial">Somente Presencial</option>
                    <option value="online_presencial">Online e Presencial</option>
                    <option value="presencial_online">Presencial e Online</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {abaForm === 'endereco' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <Input label="CEP" value={form.cep} onChange={(e) => setForm({...form, cep: e.target.value})} onBlur={() => buscarCep(form.cep)} placeholder="60000-000" />
                <div className="col-span-2">
                  <Input label="Endereco" value={form.endereco} onChange={(e) => setForm({...form, endereco: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <Input label="Numero" value={form.numero_endereco} onChange={(e) => setForm({...form, numero_endereco: e.target.value})} />
                <div className="col-span-2">
                  <Input label="Complemento" value={form.complemento} onChange={(e) => setForm({...form, complemento: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <Input label="Bairro" value={form.bairro} onChange={(e) => setForm({...form, bairro: e.target.value})} />
                <Input label="Cidade" value={form.cidade} onChange={(e) => setForm({...form, cidade: e.target.value})} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select value={form.estado} onChange={(e) => setForm({...form, estado: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm">
                    <option value="">UF</option>
                    {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {abaForm === 'preferencias' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interesse</label>
                  <select value={form.tipo_interesse} onChange={(e) => setForm({...form, tipo_interesse: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm">
                    <option value="">Selecionar</option>
                    <option value="aliancas">Aliancas</option>
                    <option value="aneis">Aneis</option>
                    <option value="colares">Colares</option>
                    <option value="brincos">Brincos</option>
                    <option value="pulseiras">Pulseiras</option>
                    <option value="sob_encomenda">Sob Encomenda</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ocasiao</label>
                  <select value={form.ocasiao} onChange={(e) => setForm({...form, ocasiao: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm">
                    <option value="">Selecionar</option>
                    <option value="casamento">Casamento</option>
                    <option value="noivado">Noivado</option>
                    <option value="presente">Presente</option>
                    <option value="aniversario">Aniversario</option>
                    <option value="formatura">Formatura</option>
                    <option value="uso_pessoal">Uso Pessoal</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={form.notas} onChange={(e) => setForm({...form, notas: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm" rows={3} />
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar}>Salvar</Button>
          </div>
        </div>
      </Modal>

      {/* Details modal */}
      <Modal aberto={detalhesAberto} onFechar={() => setDetalhesAberto(false)} titulo={clienteSelecionado?.nome || ''} largura="max-w-2xl">
        {clienteSelecionado && (
          <div>
            {/* Badge classificacao + resumo */}
            {clienteResumo && (
              <div className="flex items-center gap-3 mb-4">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  clienteResumo.classificacao === 'cliente'
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`}>
                  {clienteResumo.classificacao === 'cliente' ? <ShieldCheck size={14} /> : <UserX size={14} />}
                  {clienteResumo.classificacao === 'cliente' ? 'Cliente' : 'Lead'}
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  {clienteResumo.ganhas > 0 && (
                    <span className="flex items-center gap-1 text-green-600">
                      <ShoppingBag size={12} /> {clienteResumo.ganhas} venda{clienteResumo.ganhas > 1 ? 's' : ''}
                    </span>
                  )}
                  {clienteResumo.perdidas > 0 && (
                    <span className="flex items-center gap-1 text-red-500">
                      <XCircle size={12} /> {clienteResumo.perdidas} perdida{clienteResumo.perdidas > 1 ? 's' : ''}
                    </span>
                  )}
                  {clienteResumo.estornadas > 0 && (
                    <span className="flex items-center gap-1 text-orange-500">
                      <RotateCcw size={12} /> {clienteResumo.estornadas} estorno{clienteResumo.estornadas > 1 ? 's' : ''}
                    </span>
                  )}
                  {clienteResumo.abertas > 0 && (
                    <span className="flex items-center gap-1 text-blue-500">
                      <Clock size={12} /> {clienteResumo.abertas} aberta{clienteResumo.abertas > 1 ? 's' : ''}
                    </span>
                  )}
                  {clienteResumo.valor_total > 0 && (
                    <span className="flex items-center gap-1 text-green-600 font-semibold">
                      <DollarSign size={12} /> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(clienteResumo.valor_total)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Abas */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-4">
              {[
                { v: 'odvs' as const, l: `ODVs (${clienteResumo?.total || 0})` },
                { v: 'interacoes' as const, l: `Interacoes (${interacoes.length})` },
                { v: 'info' as const, l: 'Dados' },
              ].map((a) => (
                <button
                  key={a.v}
                  onClick={() => setAbaDetalhes(a.v)}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    abaDetalhes === a.v ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {a.l}
                </button>
              ))}
            </div>

            {/* Aba: ODVs */}
            {abaDetalhes === 'odvs' && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {clienteOdvs.map((odv) => (
                  <div key={odv.id} className={`p-3 rounded-lg border ${
                    odv.venda_ativa ? 'bg-green-50 border-green-200' :
                    odv.venda_estornada ? 'bg-orange-50 border-orange-200' :
                    odv.estagio_tipo === 'perdido' ? 'bg-red-50 border-red-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-800">{odv.titulo}</p>
                          {odv.venda_ativa ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-200 text-green-800 font-semibold flex items-center gap-0.5">
                              <ShieldCheck size={9} /> Venda ativa
                            </span>
                          ) : odv.venda_estornada ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-200 text-orange-800 font-semibold flex items-center gap-0.5">
                              <RotateCcw size={9} /> Estornada
                            </span>
                          ) : odv.estagio_tipo === 'perdido' ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-200 text-red-800 font-semibold flex items-center gap-0.5">
                              <XCircle size={9} /> Perdida
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-800 font-semibold">
                              {odv.estagio}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          {odv.valor > 0 && (
                            <span className="text-green-600 font-semibold">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(odv.valor)}
                            </span>
                          )}
                          {odv.produto_interesse && <span>{odv.produto_interesse}</span>}
                          {odv.vendedor_nome && <span>{odv.vendedor_nome}</span>}
                          <span>{new Date(odv.criado_em).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {odv.motivo_perda && (
                          <p className="text-xs text-red-500 mt-1">Motivo: {odv.motivo_perda}</p>
                        )}
                        {odv.motivo_estorno && (
                          <p className="text-xs text-orange-500 mt-1">Estorno: {odv.motivo_estorno}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {clienteOdvs.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Nenhuma ODV registrada para este contato</p>
                )}
              </div>
            )}

            {/* Aba: Interacoes */}
            {abaDetalhes === 'interacoes' && (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {interacoes.map((i) => (
                  <div key={i.id} className="flex gap-3 text-sm border-l-2 border-alisson-400 pl-3 py-1">
                    <Badge cor="gold">{i.tipo}</Badge>
                    <div>
                      <p className="text-gray-700">{i.descricao}</p>
                      <p className="text-xs text-gray-400">{new Date(i.criado_em).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
                {interacoes.length === 0 && <p className="text-gray-400 text-sm text-center py-6">Nenhuma interacao registrada</p>}
              </div>
            )}

            {/* Aba: Dados */}
            {abaDetalhes === 'info' && (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                  <div><p className="text-xs text-gray-500">Telefone</p><p className="text-sm font-medium">{clienteSelecionado.telefone || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Email</p><p className="text-sm font-medium">{clienteSelecionado.email || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">CPF</p><p className="text-sm font-medium">{clienteSelecionado.cpf || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Nascimento</p><p className="text-sm font-medium">{clienteSelecionado.data_nascimento ? new Date(clienteSelecionado.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Origem</p><p className="text-sm font-medium">{clienteSelecionado.origem || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Atendimento</p><p className="text-sm font-medium">{clienteSelecionado.forma_atendimento || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Interesse</p><p className="text-sm font-medium">{clienteSelecionado.tipo_interesse || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Material</p><p className="text-sm font-medium">{clienteSelecionado.material_preferido || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Pedra</p><p className="text-sm font-medium">{clienteSelecionado.pedra_preferida || '-'}</p></div>
                </div>

                {(clienteSelecionado.endereco || clienteSelecionado.cidade) && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium mb-1 flex items-center gap-1"><MapPin size={12} /> Endereco</p>
                    <p className="text-sm text-gray-700">
                      {[clienteSelecionado.endereco, clienteSelecionado.numero_endereco].filter(Boolean).join(', ')}
                      {clienteSelecionado.complemento ? ` - ${clienteSelecionado.complemento}` : ''}
                    </p>
                    <p className="text-sm text-gray-600">
                      {[clienteSelecionado.bairro, clienteSelecionado.cidade, clienteSelecionado.estado].filter(Boolean).join(' - ')}
                      {clienteSelecionado.cep ? ` | CEP: ${clienteSelecionado.cep}` : ''}
                    </p>
                  </div>
                )}

                {clienteSelecionado.notas && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Notas</p>
                    <p className="text-sm">{clienteSelecionado.notas}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
