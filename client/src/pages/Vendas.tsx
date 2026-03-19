import { useEffect, useState } from 'react';
import { Plus, DollarSign } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Tooltip } from '../components/ui/Tooltip';
import api from '../services/api';

interface Venda {
  id: string;
  cliente_nome: string;
  produto_nome?: string;
  vendedor_nome?: string;
  valor: number;
  metodo_pagamento?: string;
  parcelas: number;
  data_venda: string;
}

const METODOS: Record<string, string> = {
  pix: 'PIX',
  cartao_credito: 'Cartao Credito',
  cartao_debito: 'Cartao Debito',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferencia',
  parcelado: 'Parcelado',
};

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export default function Vendas() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [form, setForm] = useState({ cliente_id: '', produto_id: '', valor: '', metodo_pagamento: 'pix', parcelas: '1', notas: '' });

  useEffect(() => {
    carregar();
    api.get('/clientes').then(({ data }) => setClientes(data)).catch(() => {});
    api.get('/produtos').then(({ data }) => setProdutos(data)).catch(() => {});
  }, []);

  const carregar = async () => {
    const { data } = await api.get('/vendas');
    setVendas(data);
  };

  const handleCriar = async () => {
    try {
      await api.post('/vendas', {
        ...form,
        valor: parseFloat(form.valor),
        parcelas: parseInt(form.parcelas),
        produto_id: form.produto_id || null,
      });
      setModalAberto(false);
      setForm({ cliente_id: '', produto_id: '', valor: '', metodo_pagamento: 'pix', parcelas: '1', notas: '' });
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao registrar venda');
    }
  };

  const totalVendas = vendas.reduce((acc, v) => acc + v.valor, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-alisson-600">Vendas</h1>
          <p className="text-gray-500 text-sm mt-1">{vendas.length} vendas - Total: {formatarMoeda(totalVendas)}</p>
        </div>
        <Tooltip texto="Registrar uma venda manualmente com cliente, produto e forma de pagamento" posicao="left">
          <Button onClick={() => setModalAberto(true)}>
            <Plus size={16} /> Nova Venda
          </Button>
        </Tooltip>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <Tooltip texto="Data em que a venda foi realizada" posicao="bottom"><th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Data</th></Tooltip>
                <Tooltip texto="Nome do cliente que realizou a compra" posicao="bottom"><th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Cliente</th></Tooltip>
                <Tooltip texto="Produto vendido (pode ser vazio em vendas sob encomenda)" posicao="bottom"><th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Produto</th></Tooltip>
                <Tooltip texto="Valor total da venda em reais" posicao="bottom"><th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Valor</th></Tooltip>
                <Tooltip texto="Forma de pagamento utilizada: PIX, cartao, dinheiro" posicao="bottom"><th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Pagamento</th></Tooltip>
                <Tooltip texto="Vendedor responsavel pela venda" posicao="bottom"><th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vendedor</th></Tooltip>
              </tr>
            </thead>
            <tbody>
              {vendas.map((v) => (
                <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-700">{new Date(v.data_venda).toLocaleDateString('pt-BR')}</td>
                  <td className="py-3 px-4 text-sm font-medium text-alisson-600">{v.cliente_nome}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{v.produto_nome || '-'}</td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-semibold text-alisson-600 flex items-center gap-1">
                      <DollarSign size={14} /> {formatarMoeda(v.valor)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {v.metodo_pagamento && <Badge cor="blue">{METODOS[v.metodo_pagamento] || v.metodo_pagamento}</Badge>}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{v.vendedor_nome || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {vendas.length === 0 && (
            <div className="text-center py-12 text-gray-400">Nenhuma venda registrada</div>
          )}
        </div>
      </Card>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Nova Venda">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select value={form.cliente_id} onChange={(e) => setForm({...form, cliente_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400" required>
              <option value="">Selecionar cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Produto (opcional)</label>
            <select value={form.produto_id} onChange={(e) => setForm({...form, produto_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400">
              <option value="">Nenhum produto</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} - {formatarMoeda(p.preco)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Valor" type="number" step="0.01" value={form.valor} onChange={(e) => setForm({...form, valor: e.target.value})} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pagamento</label>
              <select value={form.metodo_pagamento} onChange={(e) => setForm({...form, metodo_pagamento: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400">
                {Object.entries(METODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <Input label="Parcelas" type="number" min="1" value={form.parcelas} onChange={(e) => setForm({...form, parcelas: e.target.value})} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar}>Registrar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
