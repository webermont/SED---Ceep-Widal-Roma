import React, { useState, useEffect } from 'react';
import { TrendingUp, School, AlertTriangle, CheckSquare, ArrowRight, Loader2, Calendar, Users, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { getSupabase } from '../lib/supabase';

interface DashboardStats {
  mediaGeral: number;
  alunosCriticos: number;
  totalAvaliacoes: number;
  alertas: any[];
  desempenhoPorDisciplina: any[];
  distribuicaoPedagogica: any[];
  evolucaoMedia: any[];
}

const COLORS = ['#0066CC', '#059669', '#D97706', '#DC2626'];
const LEVEL_NAMES = ['Avançado', 'Adequado', 'Básico', 'Crítico'];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    mediaGeral: 0,
    alunosCriticos: 0,
    totalAvaliacoes: 0,
    alertas: [],
    desempenhoPorDisciplina: [],
    distribuicaoPedagogica: [],
    evolucaoMedia: []
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const supabase = getSupabase();

      // 1. Fetch all responses with related data
      const { data: responses, error: rError } = await supabase
        .from('respostas_alunos')
        .select(`
          id,
          nota,
          created_at,
          gabaritos (titulo, disciplina),
          alunos (nome, turmas (nome))
        `);

      if (rError) throw rError;

      if (responses && responses.length > 0) {
        // KPIs
        const totalNotas = responses.reduce((acc, curr) => acc + (Number(curr.nota) || 0), 0);
        const media = totalNotas / responses.length;
        const criticos = responses.filter(r => (Number(r.nota) || 0) < 5).length;
        const percentCritico = (criticos / responses.length) * 100;

        // Chart 1: Desempenho por Disciplina
        const disciplinaMap: Record<string, { sum: number, count: number }> = {};
        responses.forEach(r => {
          const disc = r.gabaritos?.disciplina || 'Outros';
          if (!disciplinaMap[disc]) disciplinaMap[disc] = { sum: 0, count: 0 };
          disciplinaMap[disc].sum += Number(r.nota) || 0;
          disciplinaMap[disc].count += 1;
        });
        const desempenhoPorDisciplina = Object.entries(disciplinaMap).map(([name, data]) => ({
          name,
          media: Number((data.sum / data.count).toFixed(1))
        }));

        // Chart 2: Distribuição Pedagógica
        const distCounts = { avancado: 0, adequado: 0, basico: 0, critico: 0 };
        responses.forEach(r => {
          const n = Number(r.nota) || 0;
          if (n >= 8.5) distCounts.avancado++;
          else if (n >= 7.0) distCounts.adequado++;
          else if (n >= 5.0) distCounts.basico++;
          else distCounts.critico++;
        });
        const distribuicaoPedagogica = [
          { name: 'Avançado', value: distCounts.avancado },
          { name: 'Adequado', value: distCounts.adequado },
          { name: 'Básico', value: distCounts.basico },
          { name: 'Crítico', value: distCounts.critico },
        ];

        // Chart 3: Evolução de Média (por data)
        const evolucaoMap: Record<string, { sum: number, count: number }> = {};
        responses.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        responses.forEach(r => {
          const date = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          if (!evolucaoMap[date]) evolucaoMap[date] = { sum: 0, count: 0 };
          evolucaoMap[date].sum += Number(r.nota) || 0;
          evolucaoMap[date].count += 1;
        });
        const evolucaoMedia = Object.entries(evolucaoMap).map(([date, data]) => ({
          date,
          media: Number((data.sum / data.count).toFixed(1))
        }));

        setStats({
          mediaGeral: Number(media.toFixed(1)),
          alunosCriticos: Math.round(percentCritico),
          totalAvaliacoes: responses.length,
          alertas: responses.filter(r => (Number(r.nota) || 0) < 5).slice(0, 5),
          desempenhoPorDisciplina,
          distribuicaoPedagogica,
          evolucaoMedia
        });
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#0F2C59]" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto bg-[#F4F6F8] min-h-screen">
      {/* Page Header */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading font-bold text-[#1A202C] mb-1">Painel Institucional</h1>
          <p className="text-[#64748B] text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Atualizado em tempo real • {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/correcao" className="px-4 py-2 bg-[#0F2C59] text-white rounded text-sm font-bold hover:bg-[#0f3b7d] transition-colors shadow-sm">
            Nova Correção
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-[#E2E8F0] rounded shadow-sm p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded">
              <School className="w-5 h-5 text-[#0066CC]" />
            </div>
            <span className="text-[10px] font-bold text-[#059669] bg-green-50 px-2 py-0.5 rounded border border-green-100">+2.4%</span>
          </div>
          <div>
            <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Média Geral</p>
            <p className="text-3xl font-heading font-bold text-[#1A202C]">{stats.mediaGeral || '0.0'}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded shadow-sm p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-50 rounded">
              <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
            </div>
            <span className="text-[10px] font-bold text-[#DC2626] bg-red-50 px-2 py-0.5 rounded border border-red-100">Crítico</span>
          </div>
          <div>
            <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Alunos Críticos</p>
            <p className="text-3xl font-heading font-bold text-[#DC2626]">{stats.alunosCriticos}%</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded shadow-sm p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-50 rounded">
              <CheckSquare className="w-5 h-5 text-[#059669]" />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Avaliações</p>
            <p className="text-3xl font-heading font-bold text-[#1A202C]">{stats.totalAvaliacoes}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded shadow-sm p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 rounded">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Participação</p>
            <p className="text-3xl font-heading font-bold text-[#1A202C]">94%</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Performance Chart */}
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-heading font-bold text-[#1A202C] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#0F2C59]" /> Evolução de Médias
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.evolucaoMedia}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748B', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  domain={[0, 10]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748B', fontSize: 12 }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="media" 
                  stroke="#0F2C59" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#0F2C59', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Pie Chart */}
        <div className="bg-white border border-[#E2E8F0] rounded shadow-sm p-6">
          <h3 className="font-heading font-bold text-[#1A202C] mb-6 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#0F2C59]" /> Distribuição Pedagógica
          </h3>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.distribuicaoPedagogica}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.distribuicaoPedagogica.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {stats.distribuicaoPedagogica.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance by Subject */}
        <div className="bg-white border border-[#E2E8F0] rounded shadow-sm p-6">
          <h3 className="font-heading font-bold text-[#1A202C] mb-6">Média por Disciplina</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.desempenhoPorDisciplina} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis type="number" domain={[0, 10]} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#1A202C', fontSize: 11, fontWeight: 600 }}
                  width={100}
                />
                <Tooltip cursor={{ fill: '#F8FAFC' }} />
                <Bar dataKey="media" radius={[0, 4, 4, 0]} barSize={20}>
                  {stats.desempenhoPorDisciplina.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.media >= 7 ? '#059669' : entry.media >= 5 ? '#D97706' : '#DC2626'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts Table */}
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-gray-50">
            <h3 className="font-heading font-bold text-[#1A202C] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#DC2626]" /> Alertas Críticos Recentes
            </h3>
            <Link to="/analise" className="text-xs font-bold text-[#0F2C59] hover:underline uppercase tracking-wider">Ver Todos</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="px-6 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Aluno / Turma</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Avaliação</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider text-right">Nota</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {stats.alertas.map((alerta, i) => (
                  <tr key={i} className="border-b border-[#E2E8F0] hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-[#1A202C]">{alerta.alunos?.nome}</p>
                      <p className="text-[10px] text-[#64748B] uppercase font-medium">{alerta.alunos?.turmas?.nome}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-semibold text-[#1A202C]">{alerta.gabaritos?.titulo}</p>
                      <p className="text-[10px] text-[#64748B] uppercase">{alerta.gabaritos?.disciplina}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block px-2 py-1 font-bold text-xs rounded bg-red-50 text-[#DC2626] border border-red-100">
                        {Number(alerta.nota).toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
                {stats.alertas.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-[#64748B] text-sm italic">
                      Nenhum alerta crítico no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
