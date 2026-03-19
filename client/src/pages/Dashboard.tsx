import { useEffect, useState } from 'react';
import { DollarSign, Users, ShoppingBag, TrendingUp, Bell, Kanban } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card } from '../components/ui/Card';
import { Tooltip } from '../components/ui/Tooltip';
import api from '../services/api';

interface Resumo {
  vendas_total: number;
  vendas_valor: number;
  vendas_mes_total: number;
  vendas_mes_valor: number;
  ticket_medio: number;
  clientes_total: number;
  pipeline: { estagio: string; total: number; valor: number }[];
  lembretes_pendentes: number;
}

const CORES_PIZZA = ['#184036', '#1f5c45', '#2d7a5e', '#6ec4a8', '#9dd8c5', '#c5e8dc'];

const ESTAGIOS_LABEL: Record<string, string> = {
  lead: 'Lead',
  contatado: 'Contatado',
  interessado: 'Interessado',
  negociacao: 'Negociacao',
  vendido: 'Vendido',
  pos_venda: 'Pos-venda',
};

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export default function Dashboard() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [vendasPeriodo, setVendasPeriodo] = useState<any[]>([]);
  const [vendasCategoria, setVendasCategoria] = useState<any[]>([]);
  const [topProdutos, setTopProdutos] = useState<any[]>([]);

  useEffect(() => {
    api.get('/dashboard/resumo').then(({ data }) => setResumo(data)).catch(() => {});
    api.get('/dashboard/vendas-periodo?dias=30').then(({ data }) => setVendasPeriodo(data)).catch(() => {});
    api.get('/dashboard/vendas-categoria').then(({ data }) => setVendasCategoria(data)).catch(() => {});
    api.get('/dashboard/top-produtos').then(({ data }) => setTopProdutos(data)).catch(() => {});
  }, []);

  if (!resumo) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-alisson-600" /></div>;
  }

  const metricas = [
    { label: 'Vendas Total', valor: formatarMoeda(resumo.vendas_valor), sub: `${resumo.vendas_total} vendas`, icon: DollarSign, cor: 'text-alisson-600 bg-alisson-50', dica: 'Valor total de todas as vendas registradas no sistema' },
    { label: 'Vendas do Mes', valor: formatarMoeda(resumo.vendas_mes_valor), sub: `${resumo.vendas_mes_total} vendas`, icon: TrendingUp, cor: 'text-alisson-600 bg-alisson-50', dica: 'Valor das vendas feitas neste mes - atualizado em tempo real' },
    { label: 'Ticket Medio', valor: formatarMoeda(resumo.ticket_medio), sub: 'por venda', icon: ShoppingBag, cor: 'text-alisson-600 bg-alisson-50', dica: 'Media de valor por venda: quanto cada cliente gasta em media' },
    { label: 'Clientes', valor: resumo.clientes_total.toString(), sub: 'cadastrados', icon: Users, cor: 'text-alisson-600 bg-alisson-50', dica: 'Total de clientes cadastrados no CRM, incluindo leads e compradores' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-alisson-600 mb-6">Painel</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metricas.map((m) => (
          <Tooltip key={m.label} texto={m.dica} posicao="bottom">
            <Card className="p-5 w-full">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{m.label}</p>
                  <p className="text-2xl font-bold text-alisson-600 mt-1">{m.valor}</p>
                  <p className="text-xs text-gray-400 mt-1">{m.sub}</p>
                </div>
                <div className={`p-3 rounded-lg ${m.cor}`}>
                  <m.icon size={20} />
                </div>
              </div>
            </Card>
          </Tooltip>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Tooltip texto="Grafico de barras com o valor total de vendas por dia nos ultimos 30 dias" posicao="bottom">
          <Card className="p-5 w-full">
            <h3 className="text-lg font-semibold text-alisson-600 mb-4">Vendas - Ultimos 30 dias</h3>
            {vendasPeriodo.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={vendasPeriodo}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                  <RechartsTooltip formatter={(v: number) => formatarMoeda(v)} labelFormatter={(l) => `Data: ${l}`} />
                  <Bar dataKey="valor" fill="#184036" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">Nenhuma venda no periodo</div>
            )}
          </Card>
        </Tooltip>

        <Tooltip texto="Distribuicao das vendas por categoria de produto (aliancas, aneis, colares, etc)" posicao="bottom">
          <Card className="p-5 w-full">
            <h3 className="text-lg font-semibold text-alisson-600 mb-4">Vendas por Categoria</h3>
            {vendasCategoria.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={vendasCategoria} dataKey="valor" nameKey="categoria" cx="50%" cy="50%" outerRadius={100} label={({ categoria, percent }) => `${categoria} (${(percent * 100).toFixed(0)}%)`}>
                    {vendasCategoria.map((_, i) => (
                      <Cell key={i} fill={CORES_PIZZA[i % CORES_PIZZA.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(v: number) => formatarMoeda(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">Sem dados de categoria</div>
            )}
          </Card>
        </Tooltip>
      </div>

      {/* Pipeline + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tooltip texto="Quantidade de ODVs e valor total em cada estagio do funil de vendas" posicao="bottom">
          <Card className="p-5 w-full">
            <h3 className="text-lg font-semibold text-alisson-600 mb-4 flex items-center gap-2">
              <Kanban size={20} className="text-alisson-600" />
              Resumo do Pipeline
            </h3>
            <div className="space-y-3">
              {resumo.pipeline.map((p) => (
                <div key={p.estagio} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-700">{ESTAGIOS_LABEL[p.estagio] || p.estagio}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{p.total} ODVs</span>
                    <span className="text-sm font-medium text-alisson-600">{formatarMoeda(p.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Tooltip>

        <Tooltip texto="Ranking dos produtos mais vendidos por quantidade e valor total" posicao="bottom">
          <Card className="p-5 w-full">
            <h3 className="text-lg font-semibold text-alisson-600 mb-4 flex items-center gap-2">
              <ShoppingBag size={20} className="text-alisson-600" />
              Top Produtos
            </h3>
            {topProdutos.length > 0 ? (
              <div className="space-y-3">
                {topProdutos.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div>
                      <span className="text-sm font-medium text-alisson-600">{p.nome}</span>
                      <span className="text-xs text-gray-400 ml-2">{p.categoria}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-alisson-600">{p.vendas}x</span>
                      <span className="text-xs text-gray-500 ml-2">{formatarMoeda(p.valor_total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Nenhuma venda registrada</p>
            )}
          </Card>
        </Tooltip>
      </div>
    </div>
  );
}
