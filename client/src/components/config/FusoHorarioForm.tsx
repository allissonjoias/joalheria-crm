import { useEffect, useState } from 'react';
import { Clock, CheckCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import api from '../../services/api';

const FUSOS_BRASIL = [
  {
    grupo: 'UTC-2 (Fernando de Noronha)',
    fusos: [
      { valor: 'America/Noronha', label: 'Fernando de Noronha (PE)' },
    ],
  },
  {
    grupo: 'UTC-3 (Brasilia)',
    fusos: [
      { valor: 'America/Fortaleza', label: 'Ceara / Piaui / Maranhao / Rio Grande do Norte / Paraiba' },
      { valor: 'America/Recife', label: 'Pernambuco / Alagoas / Sergipe' },
      { valor: 'America/Maceio', label: 'Alagoas' },
      { valor: 'America/Bahia', label: 'Bahia' },
      { valor: 'America/Araguaina', label: 'Tocantins' },
      { valor: 'America/Belem', label: 'Para (leste) / Amapa' },
      { valor: 'America/Sao_Paulo', label: 'Sao Paulo / Rio de Janeiro / Minas Gerais / Espirito Santo / Parana / Santa Catarina / Rio Grande do Sul / Goias / Distrito Federal' },
    ],
  },
  {
    grupo: 'UTC-4 (Amazonas)',
    fusos: [
      { valor: 'America/Manaus', label: 'Amazonas / Roraima / Rondonia / parte do Para (oeste)' },
      { valor: 'America/Campo_Grande', label: 'Mato Grosso do Sul' },
      { valor: 'America/Cuiaba', label: 'Mato Grosso' },
      { valor: 'America/Porto_Velho', label: 'Rondonia' },
      { valor: 'America/Boa_Vista', label: 'Roraima' },
    ],
  },
  {
    grupo: 'UTC-5 (Acre)',
    fusos: [
      { valor: 'America/Rio_Branco', label: 'Acre' },
      { valor: 'America/Eirunepe', label: 'Amazonas (oeste)' },
    ],
  },
];

export function FusoHorarioForm() {
  const [fusoAtual, setFusoAtual] = useState('America/Fortaleza');
  const [fusoSelecionado, setFusoSelecionado] = useState('America/Fortaleza');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    api.get('/config-geral')
      .then(({ data }) => {
        if (data.fuso_horario) {
          setFusoAtual(data.fuso_horario);
          setFusoSelecionado(data.fuso_horario);
        }
      })
      .catch(() => {});
  }, []);

  const handleSalvar = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      await api.put('/config-geral/fuso-horario', { fuso_horario: fusoSelecionado });
      setFusoAtual(fusoSelecionado);
      setMsg({ tipo: 'sucesso', texto: 'Fuso horario atualizado! O servidor ja esta usando o novo horario.' });
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao salvar fuso horario' });
    } finally {
      setSalvando(false);
    }
  };

  const horaAtual = () => {
    try {
      return new Date().toLocaleTimeString('pt-BR', { timeZone: fusoSelecionado, hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const alterou = fusoSelecionado !== fusoAtual;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-alisson-600 mb-4 flex items-center gap-2">
        <Clock size={20} className="text-alisson-600" /> Fuso Horario
      </h2>

      <p className="text-sm text-gray-500 mb-4">
        Define o horario usado em todo o CRM: mensagens, lembretes, agendamentos e relatorios.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fuso horario do Brasil</label>
          <select
            value={fusoSelecionado}
            onChange={(e) => { setFusoSelecionado(e.target.value); setMsg(null); }}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400 bg-white"
          >
            {FUSOS_BRASIL.map((grupo) => (
              <optgroup key={grupo.grupo} label={grupo.grupo}>
                {grupo.fusos.map((f) => (
                  <option key={f.valor} value={f.valor}>{f.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
          <Clock size={14} />
          <span>Horario atual nesse fuso: <strong>{horaAtual()}</strong></span>
          {!alterou && fusoAtual === fusoSelecionado && (
            <span className="ml-auto flex items-center gap-1 text-green-600 text-xs">
              <CheckCircle size={12} /> Ativo
            </span>
          )}
        </div>

        {msg && (
          <p className={`text-sm ${msg.tipo === 'sucesso' ? 'text-green-600' : 'text-red-600'}`}>
            {msg.texto}
          </p>
        )}

        <Button onClick={handleSalvar} disabled={!alterou || salvando}>
          {salvando ? 'Salvando...' : 'Salvar Fuso Horario'}
        </Button>
      </div>
    </Card>
  );
}
