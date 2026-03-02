import { useState, useEffect } from 'react';
import {
  Smartphone, QrCode, Send, Zap, Shield, Play, Pause,
  XCircle, AlertCircle, CheckCircle, RefreshCw, Plus, Trash2, Wifi, WifiOff, Loader2
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useWhatsApp, Instancia } from '../hooks/useWhatsApp';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
}

function InstanceCard({
  inst,
  onConectar,
  onDesconectar,
  onRemover,
  onObterQR,
}: {
  inst: Instancia;
  onConectar: (id: string) => void;
  onDesconectar: (id: string) => void;
  onRemover: (id: string) => void;
  onObterQR: (id: string) => Promise<string | null>;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [carregandoQR, setCarregandoQR] = useState(false);

  const handleConectar = async () => {
    onConectar(inst.id);
    setCarregandoQR(true);
    // Polling QR
    for (let i = 0; i < 30; i++) {
      const qrCode = await onObterQR(inst.id);
      if (qrCode) {
        setQr(qrCode);
        setCarregandoQR(false);
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    setCarregandoQR(false);
  };

  // Limpar QR quando conectou
  useEffect(() => {
    if (inst.status === 'conectado') setQr(null);
  }, [inst.status]);

  // Polling QR enquanto conectando
  useEffect(() => {
    if (inst.status !== 'conectando' || qr) return;
    let cancelled = false;
    const poll = async () => {
      for (let i = 0; i < 20; i++) {
        if (cancelled) return;
        const qrCode = await onObterQR(inst.id);
        if (qrCode) {
          setQr(qrCode);
          return;
        }
        await new Promise(r => setTimeout(r, 1500));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [inst.status, inst.id, qr, onObterQR]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            inst.status === 'conectado' ? 'bg-green-100' :
            inst.status === 'conectando' ? 'bg-yellow-100' : 'bg-gray-100'
          }`}>
            <Smartphone size={20} className={
              inst.status === 'conectado' ? 'text-green-600' :
              inst.status === 'conectando' ? 'text-yellow-600' : 'text-gray-400'
            } />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{inst.nome}</h3>
            <div className="flex items-center gap-1 mt-0.5">
              {inst.status === 'conectado' ? (
                <Badge cor="green"><Wifi size={10} /> Conectado</Badge>
              ) : inst.status === 'conectando' ? (
                <Badge cor="orange"><Loader2 size={10} className="animate-spin" /> Conectando</Badge>
              ) : (
                <Badge cor="red"><WifiOff size={10} /> Desconectado</Badge>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => onRemover(inst.id)}
          className="text-gray-300 hover:text-red-500 transition-colors"
          title="Remover instancia"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* QR Code */}
      {inst.status === 'conectando' && qr && (
        <div className="text-center mb-4">
          <p className="text-sm text-gray-600 mb-2">Escaneie o QR Code:</p>
          <div className="inline-block p-3 bg-white border-2 border-alisson-200 rounded-xl">
            <img
              src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
              alt="QR Code"
              className="w-52 h-52"
            />
          </div>
        </div>
      )}

      {inst.status === 'conectando' && !qr && carregandoQR && (
        <div className="text-center py-6 mb-4">
          <Loader2 size={24} className="animate-spin text-alisson-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Gerando QR Code...</p>
        </div>
      )}

      {/* Acoes */}
      <div className="flex gap-2">
        {inst.status === 'desconectado' && (
          <Button tamanho="sm" onClick={handleConectar}>
            <QrCode size={14} /> Conectar
          </Button>
        )}
        {inst.status === 'conectado' && (
          <Button tamanho="sm" variante="perigo" onClick={() => onDesconectar(inst.id)}>
            Desconectar
          </Button>
        )}
      </div>
    </div>
  );
}

export default function WhatsAppPage() {
  const { usuario } = useAuth();
  const {
    instancias, conectado, warmup, campanhas,
    carregando, erro,
    carregarInstancias, carregarWarmup, carregarCampanhas,
    adicionarInstancia, removerInstancia,
    conectarInstancia, desconectarInstancia, obterQRCode,
    enviarMensagem,
    criarCampanha, iniciarCampanha, pausarCampanha, cancelarCampanha,
  } = useWhatsApp();

  // Nova instancia
  const [modalNova, setModalNova] = useState(false);
  const [nomeNova, setNomeNova] = useState('');

  // Envio direto
  const [envioTel, setEnvioTel] = useState('');
  const [envioTexto, setEnvioTexto] = useState('');
  const [envioStatus, setEnvioStatus] = useState<string | null>(null);

  // Campanha
  const [modalCampanha, setModalCampanha] = useState(false);
  const [campForm, setCampForm] = useState({ nome: '', template: '' });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesSelecionados, setClientesSelecionados] = useState<string[]>([]);
  const [filtroCliente, setFiltroCliente] = useState('');

  const isAdmin = usuario?.papel === 'admin';

  useEffect(() => {
    const rodando = campanhas.some(c => c.status === 'rodando');
    if (rodando) {
      const interval = setInterval(() => {
        carregarCampanhas();
        carregarWarmup();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [campanhas, carregarCampanhas, carregarWarmup]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Acesso restrito a administradores</p>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-alisson-600" size={24} />
      </div>
    );
  }

  const handleAdicionarInstancia = async () => {
    if (!nomeNova.trim()) return;
    try {
      await adicionarInstancia(nomeNova.trim());
      setModalNova(false);
      setNomeNova('');
    } catch {}
  };

  const handleRemover = async (id: string) => {
    if (!confirm('Remover esta instancia? A conexao sera perdida.')) return;
    await removerInstancia(id);
  };

  const handleEnviar = async () => {
    if (!envioTel || !envioTexto) return;
    setEnvioStatus(null);
    try {
      await enviarMensagem('manual', envioTel, envioTexto);
      setEnvioStatus('Mensagem enviada!');
      setEnvioTexto('');
    } catch {
      setEnvioStatus('Erro ao enviar');
    }
  };

  const handleAbrirCampanha = async () => {
    setModalCampanha(true);
    try {
      const { data } = await api.get('/clientes', { params: { busca: '' } });
      setClientes(data.filter((c: Cliente) => c.telefone));
    } catch {}
  };

  const handleCriarCampanha = async () => {
    if (!campForm.nome || !campForm.template || clientesSelecionados.length === 0) return;
    try {
      await criarCampanha(campForm.nome, campForm.template, clientesSelecionados);
      setModalCampanha(false);
      setCampForm({ nome: '', template: '' });
      setClientesSelecionados([]);
    } catch {}
  };

  const toggleCliente = (id: string) => {
    setClientesSelecionados(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selecionarTodos = () => {
    const filtrados = clientes.filter(c =>
      !filtroCliente || c.nome?.toLowerCase().includes(filtroCliente.toLowerCase())
    );
    setClientesSelecionados(filtrados.map(c => c.id));
  };

  const clientesFiltrados = clientes.filter(c =>
    !filtroCliente || c.nome?.toLowerCase().includes(filtroCliente.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-alisson-600 flex items-center gap-2">
          <Smartphone size={24} /> WhatsApp
        </h1>
        <div className="flex items-center gap-2">
          <Button tamanho="sm" variante="ghost" onClick={carregarInstancias}>
            <RefreshCw size={14} />
          </Button>
          <Button tamanho="sm" onClick={() => setModalNova(true)}>
            <Plus size={14} /> Adicionar WhatsApp
          </Button>
        </div>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      {/* Instancias */}
      {instancias.length === 0 ? (
        <Card className="p-8 text-center">
          <Smartphone size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg text-gray-500 mb-2">Nenhum WhatsApp configurado</p>
          <p className="text-sm text-gray-400 mb-4">Adicione uma instancia para conectar seu WhatsApp</p>
          <Button onClick={() => setModalNova(true)}>
            <Plus size={16} /> Adicionar WhatsApp
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {instancias.map(inst => (
            <InstanceCard
              key={inst.id}
              inst={inst}
              onConectar={conectarInstancia}
              onDesconectar={desconectarInstancia}
              onRemover={handleRemover}
              onObterQR={obterQRCode}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Anti-ban / Warmup */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-alisson-600 mb-4 flex items-center gap-2">
            <Shield size={20} /> Protecao Anti-Ban
          </h2>

          {warmup ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-creme-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-alisson-600">{warmup.enviados}</p>
                  <p className="text-xs text-gray-600">Enviados hoje</p>
                </div>
                <div className="p-3 bg-creme-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-alisson-600">{warmup.limite}</p>
                  <p className="text-xs text-gray-600">Limite diario</p>
                </div>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-alisson-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (warmup.enviados / warmup.limite) * 100)}%` }}
                />
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Dia de warmup: <strong>{warmup.dia}</strong></p>
                <p>Horario comercial: {warmup.dentroHorario
                  ? <Badge cor="green">Ativo (8h-20h)</Badge>
                  : <Badge cor="red">Fora do horario</Badge>
                }</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Conecte um WhatsApp para ver o status.</p>
          )}

          {conectado && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                <Send size={14} /> Enviar Mensagem
              </h3>
              <div className="space-y-2">
                <Input
                  placeholder="Telefone (ex: 11999998888)"
                  value={envioTel}
                  onChange={e => setEnvioTel(e.target.value)}
                />
                <textarea
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm"
                  rows={3}
                  placeholder="Mensagem..."
                  value={envioTexto}
                  onChange={e => setEnvioTexto(e.target.value)}
                />
                <Button tamanho="sm" onClick={handleEnviar} disabled={!envioTel || !envioTexto}>
                  <Send size={14} /> Enviar
                </Button>
                {envioStatus && (
                  <p className={`text-xs ${envioStatus.includes('Erro') ? 'text-red-500' : 'text-green-600'}`}>
                    {envioStatus}
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Campanhas */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-alisson-600 flex items-center gap-2">
              <Zap size={20} /> Campanhas
            </h2>
            <div className="flex gap-2">
              <Button tamanho="sm" variante="ghost" onClick={carregarCampanhas}>
                <RefreshCw size={14} />
              </Button>
              {conectado && (
                <Button tamanho="sm" onClick={handleAbrirCampanha}>
                  <Plus size={14} /> Nova
                </Button>
              )}
            </div>
          </div>

          {!conectado && (
            <p className="text-sm text-gray-500">Conecte um WhatsApp para criar campanhas.</p>
          )}

          {campanhas.length > 0 && (
            <div className="space-y-2">
              {campanhas.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge cor={
                        c.status === 'concluida' ? 'green' :
                        c.status === 'rodando' ? 'blue' :
                        c.status === 'pausada' ? 'orange' :
                        c.status === 'cancelada' ? 'red' : 'gray'
                      }>
                        {c.status}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {c.total_enviados}/{c.total_contatos}
                      </span>
                      {c.total_erros > 0 && (
                        <span className="text-xs text-red-500">{c.total_erros} erros</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    {(c.status === 'rascunho' || c.status === 'pausada') && (
                      <button onClick={() => iniciarCampanha(c.id)} className="text-green-600 hover:text-green-800" title="Iniciar">
                        <Play size={16} />
                      </button>
                    )}
                    {c.status === 'rodando' && (
                      <button onClick={() => pausarCampanha(c.id)} className="text-orange-500 hover:text-orange-700" title="Pausar">
                        <Pause size={16} />
                      </button>
                    )}
                    {(c.status === 'rodando' || c.status === 'pausada') && (
                      <button onClick={() => cancelarCampanha(c.id)} className="text-red-500 hover:text-red-700" title="Cancelar">
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Modal Nova Instancia */}
      <Modal aberto={modalNova} onFechar={() => setModalNova(false)} titulo="Adicionar WhatsApp">
        <div className="space-y-4">
          <Input
            label="Nome da instancia"
            placeholder="Ex: WhatsApp Vendas, WhatsApp Suporte..."
            value={nomeNova}
            onChange={e => setNomeNova(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdicionarInstancia()}
          />
          <p className="text-xs text-gray-500">
            De um nome para identificar este WhatsApp. Voce pode adicionar quantos quiser.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variante="secundario" onClick={() => setModalNova(false)}>Cancelar</Button>
            <Button onClick={handleAdicionarInstancia} disabled={!nomeNova.trim()}>
              <Plus size={16} /> Adicionar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Nova Campanha */}
      <Modal aberto={modalCampanha} onFechar={() => setModalCampanha(false)} titulo="Nova Campanha WhatsApp">
        <div className="space-y-4">
          <Input
            label="Nome da Campanha"
            placeholder="Ex: Promocao Marco 2026"
            value={campForm.nome}
            onChange={e => setCampForm({ ...campForm, nome: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensagem (use {'{{nome}}'} para personalizar)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm"
              rows={4}
              placeholder="Ola {{nome}}! Temos novidades especiais para voce..."
              value={campForm.template}
              onChange={e => setCampForm({ ...campForm, template: e.target.value })}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Contatos ({clientesSelecionados.length} de {clientesFiltrados.length})
              </label>
              <button onClick={selecionarTodos} className="text-xs text-alisson-600 hover:underline">
                Selecionar todos
              </button>
            </div>
            <Input
              placeholder="Filtrar por nome..."
              value={filtroCliente}
              onChange={e => setFiltroCliente(e.target.value)}
            />
            <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
              {clientesFiltrados.slice(0, 100).map(c => (
                <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={clientesSelecionados.includes(c.id)}
                    onChange={() => toggleCliente(c.id)}
                    className="rounded text-alisson-600"
                  />
                  <span>{c.nome}</span>
                  <span className="text-xs text-gray-400 ml-auto">{c.telefone}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variante="secundario" onClick={() => setModalCampanha(false)}>Cancelar</Button>
            <Button
              onClick={handleCriarCampanha}
              disabled={!campForm.nome || !campForm.template || clientesSelecionados.length === 0}
            >
              Criar ({clientesSelecionados.length} contatos)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
