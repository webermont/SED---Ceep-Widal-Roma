import React, { useState, useEffect } from 'react';
import { Search, Eye, X, Loader2, Filter, CheckCircle2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { getSupabase } from '../lib/supabase';

interface Turma {
  id: string;
  nome: string;
  turno: string;
  professor: string;
}

interface Gabarito {
  id: string;
  titulo: string;
  disciplina: string;
  respostas: string[];
}

interface AlunoPerformance {
  id: string;
  nome: string;
  matricula: string;
  acertos: number;
  totalQuestoes: number;
  nota: number;
  classificacao: 'Avançado' | 'Adequado' | 'Básico' | 'Crítico';
  respostas: string[];
}

export default function AnaliseTurma() {
  const [loading, setLoading] = useState(false);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [gabaritos, setGabaritos] = useState<Gabarito[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [selectedGabaritoId, setSelectedGabaritoId] = useState('');
  const [performanceData, setPerformanceData] = useState<AlunoPerformance[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'alunos' | 'questoes'>('alunos');
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedAluno, setSelectedAluno] = useState<AlunoPerformance | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const supabase = getSupabase();
        const { data: tData } = await supabase.from('turmas').select('*');
        setTurmas(tData || []);
      } catch (err) {
        console.error('Error fetching turmas:', err);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchGabaritos = async () => {
      if (!selectedTurmaId) {
        setGabaritos([]);
        setSelectedGabaritoId('');
        return;
      }
      try {
        const supabase = getSupabase();
        const { data: gData } = await supabase
          .from('gabaritos')
          .select('*')
          .eq('turma_id', selectedTurmaId);
        setGabaritos(gData || []);
      } catch (err) {
        console.error('Error fetching gabaritos:', err);
      }
    };
    fetchGabaritos();
  }, [selectedTurmaId]);

  useEffect(() => {
    const fetchPerformance = async () => {
      if (!selectedGabaritoId) {
        setPerformanceData([]);
        return;
      }

      try {
        setLoading(true);
        const supabase = getSupabase();
        
        // Fetch all student responses for this gabarito
        const { data: rData, error: rError } = await supabase
          .from('respostas_alunos')
          .select(`
            id,
            acertos,
            nota,
            respostas,
            aluno_id,
            alunos (id, nome, matricula)
          `)
          .eq('gabarito_id', selectedGabaritoId);

        if (rError) throw rError;

        const currentGabarito = gabaritos.find(g => g.id === selectedGabaritoId);
        const totalQuestoes = currentGabarito?.respostas.length || 0;

        const mapped: AlunoPerformance[] = (rData || []).map((r: any) => {
          const nota = r.nota;
          let classificacao: AlunoPerformance['classificacao'] = 'Crítico';
          if (nota >= 8.5) classificacao = 'Avançado';
          else if (nota >= 7.0) classificacao = 'Adequado';
          else if (nota >= 5.0) classificacao = 'Básico';

          return {
            id: r.alunos.id,
            nome: r.alunos.nome,
            matricula: r.alunos.matricula,
            acertos: r.acertos,
            totalQuestoes,
            nota,
            classificacao,
            respostas: r.respostas
          };
        });

        setPerformanceData(mapped);
      } catch (err) {
        console.error('Error fetching performance:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [selectedGabaritoId, gabaritos]);

  const getClassificacaoColor = (classificacao: string) => {
    switch (classificacao) {
      case 'Avançado': return 'bg-blue-100 text-[#0066CC]';
      case 'Adequado': return 'bg-green-100 text-[#059669]';
      case 'Básico': return 'bg-orange-100 text-[#D97706]';
      case 'Crítico': return 'bg-red-100 text-[#DC2626]';
      default: return 'bg-gray-100 text-[#64748B]';
    }
  };

  const getDistribution = () => {
    if (performanceData.length === 0) return { avancado: 0, adequado: 0, basico: 0, critico: 0 };
    const counts = { avancado: 0, adequado: 0, basico: 0, critico: 0 };
    performanceData.forEach(p => {
      if (p.classificacao === 'Avançado') counts.avancado++;
      else if (p.classificacao === 'Adequado') counts.adequado++;
      else if (p.classificacao === 'Básico') counts.basico++;
      else counts.critico++;
    });
    const total = performanceData.length;
    return {
      avancado: Math.round((counts.avancado / total) * 100),
      adequado: Math.round((counts.adequado / total) * 100),
      basico: Math.round((counts.basico / total) * 100),
      critico: Math.round((counts.critico / total) * 100),
      counts
    };
  };

  const distribution = getDistribution();

  const filteredPerformance = performanceData.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.matricula.includes(searchTerm)
  );

  const selectedTurma = turmas.find(t => t.id === selectedTurmaId);
  const selectedGabarito = gabaritos.find(g => g.id === selectedGabaritoId);

  const handleVerProva = (aluno: AlunoPerformance) => {
    setSelectedAluno(aluno);
    setIsDrawerOpen(true);
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto flex flex-col gap-6 h-full relative">
      {/* Filters Section */}
      <div className="flex flex-col gap-4 bg-white p-6 border border-[#E2E8F0] rounded shadow-sm">
        <div className="flex items-center gap-2 text-[#0F2C59] mb-2">
          <Filter className="w-5 h-5" />
          <h2 className="font-bold uppercase tracking-wider text-sm">Filtros de Análise</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[#64748B] uppercase">Turma</span>
            <select 
              value={selectedTurmaId}
              onChange={(e) => setSelectedTurmaId(e.target.value)}
              className="form-select rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-[#F4F6F8] h-11 px-3"
            >
              <option value="">Selecione a turma...</option>
              {turmas.map(t => (
                <option key={t.id} value={t.id}>{t.nome} - {t.turno}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[#64748B] uppercase">Avaliação / Gabarito</span>
            <select 
              value={selectedGabaritoId}
              onChange={(e) => setSelectedGabaritoId(e.target.value)}
              disabled={!selectedTurmaId}
              className="form-select rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-[#F4F6F8] h-11 px-3 disabled:opacity-50"
            >
              <option value="">Selecione o gabarito...</option>
              {gabaritos.map(g => (
                <option key={g.id} value={g.id}>{g.titulo} ({g.disciplina})</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {selectedGabaritoId ? (
        <>
          {/* Header Section */}
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold font-heading text-[#1A202C] tracking-tight">
              Análise de Turma: {selectedTurma?.nome} - {selectedGabarito?.disciplina}
            </h1>
            <p className="text-[#64748B] text-sm font-medium">
              Turno: {selectedTurma?.turno} • Prof. {selectedTurma?.professor} • Avaliação: {selectedGabarito?.titulo}
            </p>
          </div>

          {/* Summary Distribution Cards */}
          <div className="bg-white border border-[#E2E8F0] rounded p-5 shadow-sm flex flex-col gap-4">
            <h3 className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Distribuição Pedagógica</h3>
            
            {/* Stacked Bar Chart */}
            <div className="flex h-6 rounded overflow-hidden bg-gray-100 border border-[#E2E8F0]">
              <div className="bg-[#0066CC] h-full flex items-center justify-center text-xs text-white font-medium px-1 transition-all duration-500" style={{ width: `${distribution.avancado}%` }} title={`${distribution.avancado}% Avançado`}>{distribution.avancado}%</div>
              <div className="bg-[#059669] h-full flex items-center justify-center text-xs text-white font-medium px-1 transition-all duration-500" style={{ width: `${distribution.adequado}%` }} title={`${distribution.adequado}% Adequado`}>{distribution.adequado}%</div>
              <div className="bg-[#D97706] h-full flex items-center justify-center text-xs text-white font-medium px-1 transition-all duration-500" style={{ width: `${distribution.basico}%` }} title={`${distribution.basico}% Básico`}>{distribution.basico}%</div>
              <div className="bg-[#DC2626] h-full flex items-center justify-center text-xs text-white font-medium px-1 transition-all duration-500" style={{ width: `${distribution.critico}%` }} title={`${distribution.critico}% Crítico`}>{distribution.critico}%</div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[#0066CC]"></div>
                <span className="text-sm text-[#64748B] font-medium">Avançado ({distribution.counts?.avancado})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[#059669]"></div>
                <span className="text-sm text-[#64748B] font-medium">Adequado ({distribution.counts?.adequado})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[#D97706]"></div>
                <span className="text-sm text-[#64748B] font-medium">Básico ({distribution.counts?.basico})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[#DC2626]"></div>
                <span className="text-sm text-[#64748B] font-medium">Crítico ({distribution.counts?.critico})</span>
              </div>
            </div>
          </div>

          {/* Tabs & Actions */}
          <div className="flex justify-between items-end border-b border-[#E2E8F0] mt-2">
            <div className="flex gap-6">
              <button 
                onClick={() => setActiveTab('alunos')}
                className={clsx(
                  "pb-3 border-b-2 font-semibold text-sm transition-colors",
                  activeTab === 'alunos' ? "border-[#0F2C59] text-[#0F2C59]" : "border-transparent text-[#64748B] hover:text-[#1A202C]"
                )}
              >
                Alunos
              </button>
              <button 
                onClick={() => setActiveTab('questoes')}
                className={clsx(
                  "pb-3 border-b-2 font-semibold text-sm transition-colors",
                  activeTab === 'questoes' ? "border-[#0F2C59] text-[#0F2C59]" : "border-transparent text-[#64748B] hover:text-[#1A202C]"
                )}
              >
                Questões
              </button>
            </div>
            <div className="pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Buscar aluno..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#0F2C59] focus:ring-1 focus:ring-[#0F2C59] w-64 bg-white text-[#1A202C]"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-white border border-[#E2E8F0] rounded shadow-sm py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#0F2C59]" />
                <p className="text-[#64748B] font-medium">Carregando dados da turma...</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'alunos' ? (
                <div className="bg-white border border-[#E2E8F0] rounded shadow-sm overflow-hidden flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-[#E2E8F0]">
                        <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest w-1/3">Nome do Aluno</th>
                        <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest text-center">Acertos</th>
                        <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest text-center">%</th>
                        <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest text-center">Classificação</th>
                        <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-100">
                      {filteredPerformance.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="py-2.5 px-4 font-medium text-[#1A202C]">{p.nome}</td>
                          <td className="py-2.5 px-4 text-[#64748B] text-center">{p.acertos}/{p.totalQuestoes}</td>
                          <td className="py-2.5 px-4 text-[#64748B] text-center">{Math.round(p.nota * 10)}%</td>
                          <td className="py-2.5 px-4 text-center">
                            <span className={clsx("inline-block px-2 py-1 text-xs font-bold rounded", getClassificacaoColor(p.classificacao))}>
                              {p.classificacao}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button 
                              onClick={() => handleVerProva(p)}
                              className="text-[#0F2C59] hover:text-blue-800 font-medium flex items-center justify-end gap-1 ml-auto"
                            >
                              <Eye className="w-4 h-4" /> Ver Prova
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredPerformance.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-[#64748B]">Nenhum resultado encontrado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-white border border-[#E2E8F0] rounded shadow-sm p-6 flex-1">
                  <h3 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-6">Desempenho por Questão</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {selectedGabarito?.respostas.map((gabRes, i) => {
                      const total = performanceData.length;
                      const acertos = performanceData.filter(p => p.respostas[i] === gabRes).length;
                      const percent = total > 0 ? Math.round((acertos / total) * 100) : 0;
                      
                      return (
                        <div key={i} className="flex flex-col gap-2 p-4 border border-[#E2E8F0] rounded bg-gray-50">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-[#1A202C]">Questão {(i + 1).toString().padStart(2, '0')}</span>
                            <span className={clsx(
                              "text-xs font-bold px-2 py-0.5 rounded",
                              percent >= 70 ? "bg-green-100 text-[#059669]" : 
                              percent >= 40 ? "bg-orange-100 text-[#D97706]" : "bg-red-100 text-[#DC2626]"
                            )}>
                              {percent}% de Acerto
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={clsx(
                                "h-full transition-all duration-500",
                                percent >= 70 ? "bg-[#059669]" : 
                                percent >= 40 ? "bg-[#D97706]" : "bg-[#DC2626]"
                              )}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-[#64748B] font-medium uppercase">
                            <span>{acertos} Acertos</span>
                            <span>{total - acertos} Erros</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-white border border-[#E2E8F0] rounded shadow-sm py-32">
          <div className="w-16 h-16 bg-[#F4F6F8] rounded-full flex items-center justify-center mb-4">
            <Filter className="w-8 h-8 text-[#64748B]" />
          </div>
          <h2 className="text-xl font-bold text-[#1A202C] mb-2">Selecione os filtros</h2>
          <p className="text-[#64748B] max-w-md text-center">Escolha uma turma e um gabarito oficial para visualizar a análise detalhada de desempenho pedagógico.</p>
        </div>
      )}

      {/* Drawer Overlay */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Side Drawer */}
      <aside 
        className={clsx(
          "fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col border-l border-[#E2E8F0]",
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-gray-50">
          <div className="flex flex-col">
            <h2 className="font-heading font-bold text-lg text-[#1A202C]">{selectedAluno?.nome}</h2>
            <span className="text-xs text-[#64748B] uppercase tracking-wide font-bold">
              {selectedGabarito?.disciplina} • {selectedAluno?.acertos}/{selectedAluno?.totalQuestoes} ({Math.round((selectedAluno?.nota || 0) * 10)}%)
            </span>
          </div>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6 bg-[#F4F6F8]">
          {/* Performance Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase">Nota Final</span>
              <p className="text-2xl font-bold text-[#0F2C59]">{selectedAluno?.nota.toFixed(1)}</p>
            </div>
            <div className="bg-white p-4 rounded border border-[#E2E8F0] shadow-sm">
              <span className="text-[10px] font-bold text-[#64748B] uppercase">Classificação</span>
              <p className={clsx("text-lg font-bold", selectedAluno?.classificacao === 'Avançado' ? 'text-[#0066CC]' : selectedAluno?.classificacao === 'Adequado' ? 'text-[#059669]' : selectedAluno?.classificacao === 'Básico' ? 'text-[#D97706]' : 'text-[#DC2626]')}>
                {selectedAluno?.classificacao}
              </p>
            </div>
          </div>

          {/* Error Analysis List */}
          <div className="bg-white border border-[#E2E8F0] p-4 rounded shadow-sm">
            <h4 className="text-sm font-bold text-[#1A202C] mb-3 uppercase tracking-wider flex items-center gap-2">
              Detalhamento de Respostas
            </h4>
            <div className="flex flex-col gap-2">
              {selectedGabarito?.respostas.map((gabRes, i) => {
                const alunoRes = selectedAluno?.respostas[i];
                const isCorrect = alunoRes === gabRes;
                
                return (
                  <div 
                    key={i} 
                    className={clsx(
                      "flex justify-between items-center p-3 border rounded",
                      isCorrect ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"
                    )}
                  >
                    <div>
                      <span className="font-bold text-[#1A202C] text-sm">Questão {(i + 1).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#64748B]">Sua: <b className={isCorrect ? "text-[#059669]" : "text-[#DC2626]"}>{alunoRes || '-'}</b></span>
                      {!isCorrect && <span className="text-xs text-[#64748B]">Gab: <b className="text-[#0F2C59]">{gabRes}</b></span>}
                      {isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-[#DC2626]" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
