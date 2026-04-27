import { useEffect, useState } from 'react';
import { DollarSign, Users, ShoppingBag, TrendingUp, Bell, Kanban, Crown, Repeat, Trophy } from 'lucide-react';
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
  const [rankingClientes, setRankingClientes] = useState<any[]>([]);
  const [indicadores, setIndicadores] = useState<any>(null);
  const [ordemRanking, setOrdemRanking] = useState('valor_total');

  useEffect(() => {
    api.get('/dashboard/resumo').then(({ data }) => setResumo(data)).catch(() => {
      setResumo({ vendas_total: 0, vendas_valor: 0, vendas_mes_total: 0, vendas_mes_valor: 0, ticket_medio: 0, clientes_total: 0, pipeline: [], lembretes_pendentes: 0 });
    });
    api.get('/dashboard/vendas-periodo?dias=30').then(({ data }) => setVendasPeriodo(data)).catch(() => {});
    api.get('/dashboard/vendas-categoria').then(({ data }) => setVendasCategoria(data)).catch(() => {});
    api.get('/dashboard/top-produtos').then(({ data }) => setTopProdutos(data)).catch(() => {});
    api.get('/dashboard/indicadores-clientes').then(({ data }) => setIndicadores(data)).catch(() => {});
    api.get('/dashboard/ranking-clientes?ordem=valor_total&limite=10').then(({ data }) => setRankingClientes(data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get(`/dashboard/ranking-clientes?ordem=${ordemRanking}&limite=10`).then(({ data }) => setRankingClientes(data)).catch(() => {});
  }, [ordemRanking]);

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
      <h1 className="hidden md:block text-2xl font-bold text-alisson-600 mb-6">Painel</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        {metricas.map((m) => (
          <Tooltip key={m.label} texto={m.dica} posicao="bottom">
            <Card className="p-3 md:p-5 w-full">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-500 truncate">{m.label}</p>
                  <p className="text-lg md:text-2xl font-bold text-alisson-600 mt-1 truncate">{m.valor}</p>
                  <p className="text-[10px] md:text-xs text-gray-400 mt-1">{m.sub}</p>
                </div>
                <div className={`p-2 md:p-3 rounded-lg ${m.cor} flex-shrink-0 ml-2`}>
                  <m.icon size={16} className="md:hidden" />
                  <m.icon size={20} className="hidden md:block" />
                </div>
              </div>
            </Card>
          </Tooltip>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
        <Tooltip texto="Grafico de barras com o valor total de vendas por dia nos ultimos 30 dias" posicao="bottom">
          <Card className="p-3 md:p-5 w-full">
            <h3 className="text-base md:text-lg font-semibold text-alisson-600 mb-3 md:mb-4">Vendas - Ultimos 30 dias</h3>
            {vendasPeriodo.length > 0 ? (
              <ResponsiveContainer width="100%" height={200} className="md:!h-[300px]">
                <BarChart data={vendasPeriodo}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} width={50} />
                  <RechartsTooltip formatter={(v: number) => formatarMoeda(v)} labelFormatter={(l) => `Data: ${l}`} />
                  <Bar dataKey="valor" fill="#184036" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] md:h-[300px] flex items-center justify-center text-gray-400">Nenhuma venda no periodo</div>
            )}
          </Card>
        </Tooltip>

        <Tooltip texto="Distribuicao das vendas por categoria de produto (aliancas, aneis, colares, etc)" posicao="bottom">
          <Card className="p-3 md:p-5 w-full">
            <h3 className="text-base md:text-lg font-semibold text-alisson-600 mb-3 md:mb-4">Vendas por Categoria</h3>
            {vendasCategoria.length > 0 ? (
              <ResponsiveContainer width="100%" height={200} className="md:!h-[300px]">
                <PieChart>
                  <Pie data={vendasCategoria} dataKey="valor" nameKey="categoria" cx="50%" cy="50%" outerRadius={70} label={({ categoria, percent }) => `${categoria} (${(percent * 100).toFixed(0)}%)`} labelLine={{ strokeWidth: 1 }}>
                    {vendasCategoria.map((_, i) => (
                      <Cell key={i} fill={CORES_PIZZA[i % CORES_PIZZA.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(v: number) => formatarMoeda(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] md:h-[300px] flex items-center justify-center text-gray-400">Sem dados de categoria</div>
            )}
          </Card>
        </Tooltip>
      </div>

      {/* Pipeline + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Tooltip texto="Quantidade de ODVs e valor total em cada estagio do funil de vendas" posicao="bottom">
          <Card className="p-3 md:p-5 w-full">
            <h3 className="text-base md:text-lg font-semibold text-alisson-600 mb-3 md:mb-4 flex items-center gap-2">
              <Kanban size={18} className="text-alisson-600" />
              Resumo do Pipeline
            </h3>
            <div className="space-y-2 md:space-y-3">
              {resumo.pipeline.map((p) => (
                <div key={p.estagio} className="flex items-center justify-between py-1.5 md:py-2 border-b border-gray-50">
                  <span className="text-xs md:text-sm text-gray-700">{ESTAGIOS_LABEL[p.estagio] || p.estagio}</span>
                  <div className="flex items-center gap-2 md:gap-4">
                    <span className="text-xs md:text-sm text-gray-500">{p.total} ODVs</span>
                    <span className="text-xs md:text-sm font-medium text-alisson-600">{formatarMoeda(p.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Tooltip>

        <Tooltip texto="Ranking dos produtos mais vendidos por quantidade e valor total" posicao="bottom">
          <Card className="p-3 md:p-5 w-full">
            <h3 className="text-base md:text-lg font-semibold text-alisson-600 mb-3 md:mb-4 flex items-center gap-2">
              <ShoppingBag size={18} className="text-alisson-600" />
              Top Produtos
            </h3>
            {topProdutos.length > 0 ? (
              <div className="space-y-2 md:space-y-3">
                {topProdutos.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 md:py-2 border-b border-gray-50">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs md:text-sm font-medium text-alisson-600">{p.nome}</span>
                      <span className="text-[10px] md:text-xs text-gray-400 ml-1 md:ml-2">{p.categoria}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className="text-xs md:text-sm font-medium text-alisson-600">{p.vendas}x</span>
                      <span className="text-[10px] md:text-xs text-gray-500 ml-1 md:ml-2">{formatarMoeda(p.valor_total)}</span>
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

      {/* Indicadores de Clientes */}
      {indicadores && (
        <>
          <h2 className="text-lg md:text-xl font-bold text-alisson-600 mt-6 md:mt-8 mb-3 md:mb-4 flex items-center gap-2">
            <Crown size={20} />
            Indicadores de Clientes
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
            <Card className="p-3 md:p-5">
              <p className="text-xs md:text-sm text-gray-500">Clientes Compradores</p>
              <p className="text-lg md:text-2xl font-bold text-alisson-600">{indicadores.clientes_compradores}</p>
            </Card>
            <Card className="p-3 md:p-5">
              <p className="text-xs md:text-sm text-gray-500">Ticket Medio</p>
              <p className="text-lg md:text-2xl font-bold text-alisson-600">{formatarMoeda(indicadores.ticket_medio_geral)}</p>
            </Card>
            <Card className="p-3 md:p-5">
              <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1"><Repeat size={14} /> Recorrentes</p>
              <p className="text-lg md:text-2xl font-bold text-alisson-600">{indicadores.clientes_recorrentes}</p>
              <p className="text-[10px] md:text-xs text-gray-400">{indicadores.taxa_recorrencia}% de recorrencia</p>
            </Card>
            <Card className="p-3 md:p-5">
              <p className="text-xs md:text-sm text-gray-500">Total Vendas</p>
              <p className="text-lg md:text-2xl font-bold text-alisson-600">{formatarMoeda(indicadores.valor_total)}</p>
              <p className="text-[10px] md:text-xs text-gray-400">{indicadores.total_vendas} vendas</p>
            </Card>
          </div>

          {/* Faixas de Valor */}
          {indicadores.faixas_valor?.length > 0 && (
            <Card className="p-3 md:p-5 mb-4 md:mb-6">
              <h3 className="text-base md:text-lg font-semibold text-alisson-600 mb-3">Clientes por Faixa de Valor</h3>
              <ResponsiveContainer width="100%" height={200} className="md:!h-[280px]">
                <BarChart data={indicadores.faixas_valor} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="faixa" type="category" tick={{ fontSize: 10 }} width={120} />
                  <RechartsTooltip
                    formatter={(v: number, name: string) => [name === 'clientes' ? `${v} clientes` : formatarMoeda(v), name === 'clientes' ? 'Clientes' : 'Valor Total']}
                  />
                  <Bar dataKey="clientes" fill="#184036" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}

      {/* Ranking de Clientes */}
      <Card className="p-3 md:p-5 mb-4 md:mb-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="text-base md:text-lg font-semibold text-alisson-600 flex items-center gap-2">
            <Trophy size={18} className="text-alisson-600" />
            Ranking de Clientes
          </h3>
          <select
            value={ordemRanking}
            onChange={(e) => setOrdemRanking(e.target.value)}
            className="text-xs md:text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-alisson-500"
          >
            <option value="valor_total">Maior Valor</option>
            <option value="quantidade">Mais Compras</option>
            <option value="ticket_medio">Maior Ticket</option>
            <option value="recente">Mais Recente</option>
          </select>
        </div>
        {rankingClientes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 pr-2">#</th>
                  <th className="pb-2 pr-2">Cliente</th>
                  <th className="pb-2 pr-2 text-right">Compras</th>
                  <th className="pb-2 pr-2 text-right">Valor Total</th>
                  <th className="pb-2 text-right hidden md:table-cell">Ticket Medio</th>
                  <th className="pb-2 text-right hidden md:table-cell">Ultima Compra</th>
                </tr>
              </thead>
              <tbody>
                {rankingClientes.map((c: any, i: number) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-2">
                      {i < 3 ? (
                        <span className={`inline-flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full text-white text-[10px] md:text-xs font-bold ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : 'bg-amber-700'}`}>
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-gray-400">{i + 1}</span>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <div className="font-medium text-alisson-600 truncate max-w-[120px] md:max-w-[200px]">{c.nome}</div>
                      <div className="text-[10px] text-gray-400 truncate">{c.telefone || c.email || c.cidade || ''}</div>
                    </td>
                    <td className="py-2 pr-2 text-right font-medium">{c.total_compras}</td>
                    <td className="py-2 pr-2 text-right font-medium text-alisson-600">{formatarMoeda(c.valor_total)}</td>
                    <td className="py-2 text-right hidden md:table-cell">{formatarMoeda(c.ticket_medio)}</td>
                    <td className="py-2 text-right hidden md:table-cell text-gray-500">{c.ultima_compra ? c.ultima_compra.slice(0, 10) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Nenhuma venda registrada</p>
        )}
      </Card>
    </div>
  );
}
