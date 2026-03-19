import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Tooltip } from '../components/ui/Tooltip';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Produto {
  id: string;
  nome: string;
  descricao?: string;
  categoria: string;
  material: string;
  pedra?: string;
  preco: number;
  preco_custo?: number;
  estoque: number;
  foto_url?: string;
  ativo: number;
}

const CATEGORIAS = [
  { value: 'aliancas', label: 'Aliancas' },
  { value: 'aneis', label: 'Aneis' },
  { value: 'colares', label: 'Colares' },
  { value: 'brincos', label: 'Brincos' },
  { value: 'pulseiras', label: 'Pulseiras' },
  { value: 'sob_encomenda', label: 'Sob Encomenda' },
];

const CAT_CORES: Record<string, 'gold' | 'blue' | 'purple' | 'green' | 'orange' | 'red'> = {
  aliancas: 'gold', aneis: 'blue', colares: 'purple', brincos: 'green', pulseiras: 'orange', sob_encomenda: 'red',
};

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export default function Produtos() {
  const { usuario } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [form, setForm] = useState({ nome: '', descricao: '', categoria: 'aliancas', material: 'Ouro 18k', pedra: '', preco: '', preco_custo: '', estoque: '0' });

  useEffect(() => { carregar(); }, [busca, categoriaFiltro]);

  const carregar = async () => {
    const { data } = await api.get('/produtos', { params: { busca: busca || undefined, categoria: categoriaFiltro || undefined } });
    setProdutos(data);
  };

  const handleSalvar = async () => {
    try {
      const payload = { ...form, preco: parseFloat(form.preco), preco_custo: form.preco_custo ? parseFloat(form.preco_custo) : null, estoque: parseInt(form.estoque) };
      if (editando) {
        await api.put(`/produtos/${editando.id}`, payload);
      } else {
        await api.post('/produtos', payload);
      }
      setModalAberto(false);
      setEditando(null);
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao salvar');
    }
  };

  const handleEditar = (p: Produto) => {
    setEditando(p);
    setForm({ nome: p.nome, descricao: p.descricao || '', categoria: p.categoria, material: p.material, pedra: p.pedra || '', preco: p.preco.toString(), preco_custo: p.preco_custo?.toString() || '', estoque: p.estoque.toString() });
    setModalAberto(true);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Desativar este produto?')) return;
    await api.delete(`/produtos/${id}`);
    carregar();
  };

  const isAdmin = usuario?.papel === 'admin';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-alisson-600">Produtos</h1>
        {isAdmin && (
          <Tooltip texto="Cadastrar uma nova joia no catalogo com foto, preco e detalhes" posicao="left">
            <Button onClick={() => { setEditando(null); setForm({ nome: '', descricao: '', categoria: 'aliancas', material: 'Ouro 18k', pedra: '', preco: '', preco_custo: '', estoque: '0' }); setModalAberto(true); }}>
              <Plus size={16} /> Novo Produto
            </Button>
          </Tooltip>
        )}
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produtos..." className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400" />
        </div>
        <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400">
          <option value="">Todas categorias</option>
          {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {produtos.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <div className="h-40 bg-gray-100 flex items-center justify-center">
              {p.foto_url ? <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" /> : <Package size={40} className="text-gray-300" />}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-alisson-600 text-sm">{p.nome}</h3>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Tooltip texto="Editar dados do produto: nome, preco, estoque" posicao="left">
                      <button onClick={() => handleEditar(p)} className="p-1 hover:bg-gray-100 rounded"><Edit2 size={14} className="text-gray-400" /></button>
                    </Tooltip>
                    <Tooltip texto="Desativar este produto do catalogo" posicao="left">
                      <button onClick={() => handleExcluir(p.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 size={14} className="text-red-400" /></button>
                    </Tooltip>
                  </div>
                )}
              </div>
              {p.descricao && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{p.descricao}</p>}
              <div className="flex items-center gap-2 mb-2">
                <Badge cor={CAT_CORES[p.categoria] || 'gray'}>{p.categoria}</Badge>
                {p.pedra && <Badge cor="purple">{p.pedra}</Badge>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-alisson-600">{formatarMoeda(p.preco)}</span>
                <span className={`text-xs ${p.estoque > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {p.estoque > 0 ? `${p.estoque} em estoque` : 'Sob encomenda'}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Product form modal */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo={editando ? 'Editar Produto' : 'Novo Produto'}>
        <div className="space-y-4">
          <Tooltip texto="Nome da peca que aparecera no catalogo e nas vendas" posicao="right" className="w-full">
            <Input label="Nome" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} required />
          </Tooltip>
          <Tooltip texto="Descricao detalhada da peca: design, acabamento, peso" posicao="right" className="w-full">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
              <textarea value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400" rows={2} />
            </div>
          </Tooltip>
          <div className="grid grid-cols-2 gap-4">
            <Tooltip texto="Tipo de joia: aliancas, aneis, colares, brincos, pulseiras" posicao="bottom" className="w-full">
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select value={form.categoria} onChange={(e) => setForm({...form, categoria: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400">
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </Tooltip>
            <Tooltip texto="Material principal: Ouro 18k, Ouro 10k, Prata 925, Platina" posicao="bottom" className="w-full">
              <Input label="Material" value={form.material} onChange={(e) => setForm({...form, material: e.target.value})} />
            </Tooltip>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Tooltip texto="Pedra preciosa da peca (se houver): diamante, esmeralda, rubi" posicao="bottom" className="w-full">
              <Input label="Pedra" value={form.pedra} onChange={(e) => setForm({...form, pedra: e.target.value})} />
            </Tooltip>
            <Tooltip texto="Preco de venda ao cliente em reais" posicao="bottom" className="w-full">
              <Input label="Preco" type="number" step="0.01" value={form.preco} onChange={(e) => setForm({...form, preco: e.target.value})} required />
            </Tooltip>
            <Tooltip texto="Quantidade disponivel em estoque. Zero = sob encomenda" posicao="bottom" className="w-full">
              <Input label="Estoque" type="number" value={form.estoque} onChange={(e) => setForm({...form, estoque: e.target.value})} />
            </Tooltip>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
