import { useEffect, useState } from 'react';
import { Plus, Search, Phone, Mail, Tag, Calendar, Edit2, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import api from '../services/api';

interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  tipo_interesse?: string;
  material_preferido?: string;
  pedra_preferida?: string;
  orcamento_min?: number;
  orcamento_max?: number;
  ocasiao?: string;
  tags: string;
  notas?: string;
  criado_em: string;
}

interface Interacao {
  id: string;
  tipo: string;
  descricao: string;
  criado_em: string;
}

const INTERESSE_CORES: Record<string, 'gold' | 'blue' | 'purple' | 'green' | 'orange'> = {
  aliancas: 'gold',
  aneis: 'blue',
  colares: 'purple',
  brincos: 'green',
  pulseiras: 'orange',
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', tipo_interesse: '', ocasiao: '', notas: '' });

  useEffect(() => { carregar(); }, [busca]);

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
      setForm({ nome: '', telefone: '', email: '', tipo_interesse: '', ocasiao: '', notas: '' });
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao salvar');
    }
  };

  const handleEditar = (c: Cliente) => {
    setClienteSelecionado(c);
    setForm({ nome: c.nome, telefone: c.telefone || '', email: c.email || '', tipo_interesse: c.tipo_interesse || '', ocasiao: c.ocasiao || '', notas: c.notas || '' });
    setModalAberto(true);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este cliente?')) return;
    await api.delete(`/clientes/${id}`);
    carregar();
  };

  const handleVerDetalhes = async (c: Cliente) => {
    setClienteSelecionado(c);
    const { data } = await api.get(`/clientes/${c.id}/interacoes`);
    setInteracoes(data);
    setDetalhesAberto(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-charcoal-900">Clientes</h1>
        <Button onClick={() => { setClienteSelecionado(null); setForm({ nome: '', telefone: '', email: '', tipo_interesse: '', ocasiao: '', notas: '' }); setModalAberto(true); }}>
          <Plus size={16} /> Novo Cliente
        </Button>
      </div>

      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar clientes..."
          className="w-full pl-10 pr-4 py-2.5 border border-charcoal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clientes.map((c) => (
          <Card key={c.id} className="p-4" onClick={() => handleVerDetalhes(c)}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-charcoal-900">{c.nome}</h3>
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); handleEditar(c); }} className="p-1 hover:bg-charcoal-100 rounded">
                  <Edit2 size={14} className="text-charcoal-400" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleExcluir(c.id); }} className="p-1 hover:bg-red-50 rounded">
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </div>
            {c.telefone && <p className="text-sm text-charcoal-600 flex items-center gap-2 mb-1"><Phone size={14} /> {c.telefone}</p>}
            {c.email && <p className="text-sm text-charcoal-600 flex items-center gap-2 mb-1"><Mail size={14} /> {c.email}</p>}
            <div className="flex gap-2 mt-3 flex-wrap">
              {c.tipo_interesse && <Badge cor={INTERESSE_CORES[c.tipo_interesse] || 'gray'}>{c.tipo_interesse}</Badge>}
              {c.ocasiao && <Badge cor="gold">{c.ocasiao}</Badge>}
            </div>
            <p className="text-xs text-charcoal-400 mt-3 flex items-center gap-1">
              <Calendar size={12} /> {new Date(c.criado_em).toLocaleDateString('pt-BR')}
            </p>
          </Card>
        ))}
      </div>

      {clientes.length === 0 && (
        <div className="text-center py-12 text-charcoal-400">
          <p>Nenhum cliente encontrado</p>
        </div>
      )}

      {/* Form modal */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo={clienteSelecionado ? 'Editar Cliente' : 'Novo Cliente'}>
        <div className="space-y-4">
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Telefone" value={form.telefone} onChange={(e) => setForm({...form, telefone: e.target.value})} />
            <Input label="Email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">Interesse</label>
              <select value={form.tipo_interesse} onChange={(e) => setForm({...form, tipo_interesse: e.target.value})} className="w-full px-3 py-2 border border-charcoal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400">
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
              <label className="block text-sm font-medium text-charcoal-700 mb-1">Ocasiao</label>
              <select value={form.ocasiao} onChange={(e) => setForm({...form, ocasiao: e.target.value})} className="w-full px-3 py-2 border border-charcoal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400">
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
            <label className="block text-sm font-medium text-charcoal-700 mb-1">Notas</label>
            <textarea value={form.notas} onChange={(e) => setForm({...form, notas: e.target.value})} className="w-full px-3 py-2 border border-charcoal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400" rows={3} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar}>Salvar</Button>
          </div>
        </div>
      </Modal>

      {/* Details modal */}
      <Modal aberto={detalhesAberto} onFechar={() => setDetalhesAberto(false)} titulo={clienteSelecionado?.nome || ''} largura="max-w-2xl">
        {clienteSelecionado && (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><p className="text-xs text-charcoal-500">Telefone</p><p className="text-sm font-medium">{clienteSelecionado.telefone || '-'}</p></div>
              <div><p className="text-xs text-charcoal-500">Email</p><p className="text-sm font-medium">{clienteSelecionado.email || '-'}</p></div>
              <div><p className="text-xs text-charcoal-500">Interesse</p><p className="text-sm font-medium">{clienteSelecionado.tipo_interesse || '-'}</p></div>
              <div><p className="text-xs text-charcoal-500">Ocasiao</p><p className="text-sm font-medium">{clienteSelecionado.ocasiao || '-'}</p></div>
              <div><p className="text-xs text-charcoal-500">Material</p><p className="text-sm font-medium">{clienteSelecionado.material_preferido || '-'}</p></div>
              <div><p className="text-xs text-charcoal-500">Pedra</p><p className="text-sm font-medium">{clienteSelecionado.pedra_preferida || '-'}</p></div>
            </div>
            {clienteSelecionado.notas && (
              <div className="mb-6 p-3 bg-charcoal-50 rounded-lg">
                <p className="text-xs text-charcoal-500 mb-1">Notas</p>
                <p className="text-sm">{clienteSelecionado.notas}</p>
              </div>
            )}
            <h4 className="font-semibold text-charcoal-900 mb-3">Historico de Interacoes</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {interacoes.map((i) => (
                <div key={i.id} className="flex gap-3 text-sm border-l-2 border-gold-400 pl-3 py-1">
                  <Badge cor="gold">{i.tipo}</Badge>
                  <div>
                    <p className="text-charcoal-700">{i.descricao}</p>
                    <p className="text-xs text-charcoal-400">{new Date(i.criado_em).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              ))}
              {interacoes.length === 0 && <p className="text-charcoal-400 text-sm">Nenhuma interacao registrada</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
