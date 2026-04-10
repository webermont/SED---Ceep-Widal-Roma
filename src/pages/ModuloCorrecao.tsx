import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Search, Loader2, Save, User } from 'lucide-react';
import { getSupabase } from '../lib/supabase';

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  turma_id: string;
}

interface Gabarito {
  id: string;
  titulo: string;
  disciplina: string;
  turma_id: string;
  respostas: string[];
}

interface RespostaRecente {
  id: string;
  aluno_nome: string;
  aluno_matricula: string;
  turma_nome: string;
  gabarito_titulo: string;
  total_questoes: number;
  acertos: number;
  created_at: string;
  status: 'salvo' | 'erro';
}

export default function ModuloCorrecao() {
  const [loading, setLoading] = useState(false);
  const [gabaritos, setGabaritos] = useState<Gabarito[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [recentes, setRecentes] = useState<RespostaRecente[]>([]);
  
  const [selectedGabaritoId, setSelectedGabaritoId] = useState('');
  const [selectedAlunoId, setSelectedAlunoId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [respostas, setRespostas] = useState<string[]>([]);

  const fetchInitialData = async () => {
    try {
      const supabase = getSupabase();
      
      // Fetch Gabaritos
      const { data: gData } = await supabase.from('gabaritos').select('*');
      setGabaritos(gData || []);

      // Fetch Recent Entries
      const { data: rData } = await supabase
        .from('respostas_alunos')
        .select(`
          id,
          acertos,
          created_at,
          alunos (nome, matricula, turmas (nome)),
          gabaritos (titulo, respostas)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (rData) {
        const mapped = rData.map((r: any) => ({
          id: r.id,
          aluno_nome: r.alunos?.nome,
          aluno_matricula: r.alunos?.matricula,
          turma_nome: r.alunos?.turmas?.nome,
          gabarito_titulo: r.gabaritos?.titulo,
          total_questoes: r.gabaritos?.respostas?.length || 0,
          acertos: r.acertos,
          created_at: r.created_at,
          status: 'salvo'
        }));
        setRecentes(mapped);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch Alunos when Gabarito is selected (to filter by turma)
  useEffect(() => {
    const fetchAlunos = async () => {
      if (!selectedGabaritoId) {
        setAlunos([]);
        setRespostas([]);
        return;
      }
      
      const gab = gabaritos.find(g => g.id === selectedGabaritoId);
      if (!gab) return;

      // Update responses array size based on gabarito
      setRespostas(Array(gab.respostas.length).fill(''));

      const supabase = getSupabase();
      const { data } = await supabase
        .from('alunos')
        .select('*')
        .eq('turma_id', gab.turma_id);
      
      setAlunos(data || []);
    };

    fetchAlunos();
  }, [selectedGabaritoId, gabaritos]);

  const handleRespostaChange = (index: number, valor: string) => {
    const newRes = [...respostas];
    newRes[index] = valor.toUpperCase();
    setRespostas(newRes);
  };

  const handleSave = async () => {
    if (!selectedGabaritoId || !selectedAlunoId || respostas.some(r => !r)) {
      alert('Selecione o gabarito, o aluno e preencha todas as respostas.');
      return;
    }

    try {
      setLoading(true);
      const supabase = getSupabase();
      const gab = gabaritos.find(g => g.id === selectedGabaritoId);
      
      if (!gab) return;

      // Calculate score
      let acertos = 0;
      respostas.forEach((res, i) => {
        if (res === gab.respostas[i]) acertos++;
      });

      const nota = (acertos / gab.respostas.length) * 10;

      const { error } = await (supabase.from('respostas_alunos') as any).insert([{
        aluno_id: selectedAlunoId,
        gabarito_id: selectedGabaritoId,
        respostas: respostas,
        acertos: acertos,
        nota: nota
      }]);

      if (error) throw error;

      alert(`Salvo com sucesso! Acertos: ${acertos}/${gab.respostas.length}`);
      setRespostas(Array(gab.respostas.length).fill(''));
      setSelectedAlunoId('');
      fetchInitialData();
    } catch (err: any) {
      console.error('Error saving answers:', err);
      alert(err.message || 'Erro ao salvar respostas.');
    } finally {
      setLoading(false);
    }
  };

  const filteredAlunos = alunos.filter(a => 
    a.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.matricula.includes(searchTerm)
  );

  return (
    <div className="p-8 flex gap-8 h-full">
      {/* Left Pane: Manual Entry */}
      <div className="flex flex-col w-[450px] gap-6 bg-white p-6 border border-[#E2E8F0] shadow-sm rounded">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold font-heading text-[#0F2C59]">Lançamento de Respostas</h1>
          <p className="text-sm text-[#64748B]">Insira manualmente as respostas dos alunos.</p>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col">
            <p className="text-[#1A202C] text-xs font-semibold uppercase tracking-wider pb-2">Gabarito Base</p>
            <select 
              value={selectedGabaritoId}
              onChange={(e) => setSelectedGabaritoId(e.target.value)}
              className="form-select flex w-full rounded text-[#1A202C] focus:ring-[#0F2C59] border-[#E2E8F0] bg-[#F4F6F8] h-11 px-3 text-sm"
            >
              <option value="">Selecione o simulado ou prova...</option>
              {gabaritos.map(g => (
                <option key={g.id} value={g.id}>{g.titulo} - {g.disciplina}</option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <p className="text-[#1A202C] text-xs font-semibold uppercase tracking-wider">Selecionar Aluno</p>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Filtrar por nome ou matrícula..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input flex w-full rounded text-[#1A202C] focus:ring-[#0F2C59] border-[#E2E8F0] bg-[#F4F6F8] h-11 pl-10 pr-3 text-sm" 
              />
              <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            </div>
            <select 
              size={4}
              value={selectedAlunoId}
              onChange={(e) => setSelectedAlunoId(e.target.value)}
              className="form-select flex w-full rounded text-[#1A202C] focus:ring-[#0F2C59] border-[#E2E8F0] bg-white mt-1 text-sm"
            >
              <option value="" disabled>Selecione o aluno na lista...</option>
              {filteredAlunos.map(a => (
                <option key={a.id} value={a.id}>{a.nome} ({a.matricula})</option>
              ))}
              {selectedGabaritoId && filteredAlunos.length === 0 && (
                <option disabled>Nenhum aluno encontrado para esta turma.</option>
              )}
              {!selectedGabaritoId && (
                <option disabled>Selecione um gabarito primeiro.</option>
              )}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <p className="text-[#1A202C] text-xs font-semibold uppercase tracking-wider pb-1">Preenchimento de Respostas</p>
          <div className="flex-1 overflow-y-auto border border-[#E2E8F0] bg-[#F4F6F8] p-4 rounded">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {respostas.map((res, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
                  <span className="text-sm font-bold text-[#64748B] w-8">{(i + 1).toString().padStart(2, '0')}.</span>
                  <input 
                    type="text" 
                    maxLength={1} 
                    placeholder="-"
                    value={res}
                    onChange={(e) => handleRespostaChange(i, e.target.value)}
                    className="w-12 h-9 text-center uppercase font-bold text-[#0F2C59] border border-[#E2E8F0] rounded focus:ring-1 focus:ring-[#0F2C59] focus:border-[#0F2C59] outline-none bg-white" 
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-[#E2E8F0] flex justify-end gap-3">
          <button 
            onClick={() => {
              const gab = gabaritos.find(g => g.id === selectedGabaritoId);
              setRespostas(Array(gab?.respostas.length || 0).fill(''));
              setSelectedAlunoId('');
            }}
            className="flex min-w-[100px] items-center justify-center rounded h-10 px-4 bg-transparent border border-[#E2E8F0] text-[#1A202C] text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            Limpar
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="flex min-w-[140px] items-center justify-center rounded h-10 px-6 bg-[#0F2C59] text-white text-sm font-bold hover:bg-[#0f3b7d] transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Respostas
          </button>
        </div>
      </div>

      {/* Right Pane: Recent Entries */}
      <div className="flex flex-col flex-1 bg-white p-6 border border-[#E2E8F0] shadow-sm rounded overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] mb-4">
          <h2 className="text-lg font-bold font-heading text-[#1A202C]">Lançamentos Recentes</h2>
          <span className="text-sm text-[#64748B]">Acompanhamento de entradas manuais</span>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Aluno / Turma</th>
                <th className="py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Avaliação</th>
                <th className="py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-right">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {recentes.map((item) => (
                <tr key={item.id} className="hover:bg-[#F4F6F8] transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-[#1A202C]">{item.aluno_nome}</span>
                      <span className="text-xs text-[#64748B]">{item.turma_nome} - Matrícula #{item.aluno_matricula}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-[#1A202C]">{item.gabarito_titulo}</span>
                      <span className="text-[10px] text-[#64748B]">
                        {new Date(item.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded border ${
                      (item.acertos / item.total_questoes) >= 0.6 ? 'text-[#059669] bg-green-50 border-green-200' : 'text-[#DC2626] bg-red-50 border-red-200'
                    }`}>
                      {item.acertos}/{item.total_questoes} Acertos
                    </span>
                  </td>
                </tr>
              ))}
              {recentes.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-sm text-[#64748B]">Nenhum lançamento recente encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
