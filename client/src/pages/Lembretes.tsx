import { useEffect, useState } from 'react';
import { Plus, Bell, Check, Trash2, Clock } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Tooltip } from '../components/ui/Tooltip';
import api from '../services/api';

interface Lembrete {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  titulo: string;
  descricao?: string;
  data_lembrete: string;
  concluido: number;
  criado_em: string;
}

export default function Lembretes() {
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [form, setForm] = useState({ cliente_id: '', titulo: '', descricao: '', data_lembrete: '' });

  useEffect(() => {
    carregar();
    api.get('/clientes').then(({ data }) => setClientes(data)).catch(() => {});
  }, []);

  const carregar = async () => {
    const { data } = await api.get('/lembretes');
    setLembretes(data);
  };

  const handleCriar = async () => {
    try {
      await api.post('/lembretes', form);
      setModalAberto(false);
      setForm({ cliente_id: '', titulo: '', descricao: '', data_lembrete: '' });
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao criar lembrete');
    }
  };

  const handleConcluir = async (id: string) => {
    await api.put(`/lembretes/${id}`, { concluido: true });
    carregar();
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este lembrete?')) return;
    await api.delete(`/lembretes/${id}`);
    carregar();
  };

  const pendentes = lembretes.filter(l => !l.concluido);
  const concluidos = lembretes.filter(l => l.concluido);

  const isAtrasado = (data: string) => new Date(data) < new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-3 md:mb-6">
        <div>
          <h1 className="hidden md:block text-2xl font-bold text-alisson-600">Lembretes</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-1">{pendentes.length} pendentes</p>
        </div>
        <Tooltip texto="Criar um lembrete para follow-up, ligacao ou tarefa com data de vencimento" posicao="left">
          <Button onClick={() => setModalAberto(true)}>
            <Plus size={16} /> Novo Lembrete
          </Button>
        </Tooltip>
      </div>

      <div className="space-y-3 mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pendentes</h2>
        {pendentes.map((l) => (
          <Card key={l.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Tooltip texto="Clique para marcar como concluido" posicao="right">
                <button onClick={() => handleConcluir(l.id)} className="mt-1 w-5 h-5 border-2 border-gray-300 rounded hover:border-alisson-400 hover:bg-alisson-50 transition-colors flex-shrink-0" />
              </Tooltip>
                <div>
                  <h3 className="font-medium text-alisson-600">{l.titulo}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{l.cliente_nome}</p>
                  {l.descricao && <p className="text-sm text-gray-600 mt-1">{l.descricao}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <Clock size={14} className={isAtrasado(l.data_lembrete) ? 'text-red-500' : 'text-gray-400'} />
                    <span className={`text-xs ${isAtrasado(l.data_lembrete) ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                      {new Date(l.data_lembrete).toLocaleDateString('pt-BR')}
                    </span>
                    {isAtrasado(l.data_lembrete) && <Badge cor="red">Atrasado</Badge>}
                  </div>
                </div>
              </div>
              <button onClick={() => handleExcluir(l.id)} className="p-1 hover:bg-red-50 rounded">
                <Trash2 size={16} className="text-gray-300" />
              </button>
            </div>
          </Card>
        ))}
        {pendentes.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">Nenhum lembrete pendente</p>}
      </div>

      {concluidos.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Concluidos</h2>
          {concluidos.map((l) => (
            <Card key={l.id} className="p-4 opacity-60">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-5 h-5 bg-green-500 rounded flex items-center justify-center flex-shrink-0">
                  <Check size={12} className="text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-alisson-600 line-through">{l.titulo}</h3>
                  <p className="text-sm text-gray-500">{l.cliente_nome}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Lembrete">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select value={form.cliente_id} onChange={(e) => setForm({...form, cliente_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400" required>
              <option value="">Selecionar cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <Input label="Titulo" value={form.titulo} onChange={(e) => setForm({...form, titulo: e.target.value})} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
            <textarea value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400" rows={2} />
          </div>
          <Input label="Data" type="date" value={form.data_lembrete} onChange={(e) => setForm({...form, data_lembrete: e.target.value})} required />
          <div className="flex gap-2 justify-end">
            <Button variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar}>Criar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
