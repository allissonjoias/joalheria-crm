import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, DollarSign, User, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import api from '../services/api';

interface Deal {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  titulo: string;
  valor: number;
  estagio: string;
  produto_interesse?: string;
  notas?: string;
}

const ESTAGIOS = [
  { id: 'lead', label: 'Lead', cor: 'bg-gray-400' },
  { id: 'contatado', label: 'Contatado', cor: 'bg-blue-400' },
  { id: 'interessado', label: 'Interessado', cor: 'bg-yellow-400' },
  { id: 'negociacao', label: 'Negociacao', cor: 'bg-orange-400' },
  { id: 'vendido', label: 'Vendido', cor: 'bg-green-500' },
  { id: 'pos_venda', label: 'Pos-venda', cor: 'bg-purple-400' },
];

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export default function Pipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [form, setForm] = useState({ cliente_id: '', titulo: '', valor: '', produto_interesse: '', notas: '' });

  useEffect(() => {
    carregar();
    api.get('/clientes').then(({ data }) => setClientes(data)).catch(() => {});
  }, []);

  const carregar = async () => {
    const { data } = await api.get('/pipeline');
    setDeals(data);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const dealId = result.draggableId;
    const novoEstagio = result.destination.droppableId;

    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, estagio: novoEstagio } : d));

    try {
      await api.put(`/pipeline/${dealId}`, { estagio: novoEstagio });
    } catch {
      carregar();
    }
  };

  const handleCriar = async () => {
    try {
      await api.post('/pipeline', {
        ...form,
        valor: form.valor ? parseFloat(form.valor) : null,
      });
      setModalAberto(false);
      setForm({ cliente_id: '', titulo: '', valor: '', produto_interesse: '', notas: '' });
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao criar deal');
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este deal?')) return;
    await api.delete(`/pipeline/${id}`);
    carregar();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-charcoal-900">Pipeline de Vendas</h1>
        <Button onClick={() => setModalAberto(true)}>
          <Plus size={16} /> Novo Deal
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ESTAGIOS.map((estagio) => {
            const estagioDeals = deals.filter(d => d.estagio === estagio.id);
            const valorTotal = estagioDeals.reduce((acc, d) => acc + (d.valor || 0), 0);

            return (
              <div key={estagio.id} className="flex-shrink-0 w-72">
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-3 h-3 rounded-full ${estagio.cor}`} />
                    <h3 className="font-semibold text-charcoal-900 text-sm">{estagio.label}</h3>
                    <span className="text-xs text-charcoal-400 ml-auto">{estagioDeals.length}</span>
                  </div>
                  <p className="text-xs text-charcoal-500">{formatarMoeda(valorTotal)}</p>
                </div>

                <Droppable droppableId={estagio.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] rounded-xl p-2 space-y-2 transition-colors ${snapshot.isDraggingOver ? 'bg-gold-50' : 'bg-charcoal-50'}`}
                    >
                      {estagioDeals.map((deal, index) => (
                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-white rounded-lg p-3 border border-charcoal-100 shadow-sm ${snapshot.isDragging ? 'shadow-lg ring-2 ring-gold-400' : ''}`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="text-sm font-medium text-charcoal-900">{deal.titulo}</h4>
                                <button onClick={() => handleExcluir(deal.id)} className="p-0.5 hover:bg-red-50 rounded">
                                  <Trash2 size={12} className="text-charcoal-300" />
                                </button>
                              </div>
                              <p className="text-xs text-charcoal-500 flex items-center gap-1 mb-1">
                                <User size={12} /> {deal.cliente_nome}
                              </p>
                              {deal.valor > 0 && (
                                <p className="text-sm font-semibold text-gold-600 flex items-center gap-1">
                                  <DollarSign size={14} /> {formatarMoeda(deal.valor)}
                                </p>
                              )}
                              {deal.produto_interesse && (
                                <p className="text-xs text-charcoal-400 mt-1">{deal.produto_interesse}</p>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Deal">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-1">Cliente</label>
            <select value={form.cliente_id} onChange={(e) => setForm({...form, cliente_id: e.target.value})} className="w-full px-3 py-2 border border-charcoal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400" required>
              <option value="">Selecionar cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <Input label="Titulo" value={form.titulo} onChange={(e) => setForm({...form, titulo: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor" type="number" step="0.01" value={form.valor} onChange={(e) => setForm({...form, valor: e.target.value})} />
            <Input label="Produto de Interesse" value={form.produto_interesse} onChange={(e) => setForm({...form, produto_interesse: e.target.value})} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar}>Criar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
