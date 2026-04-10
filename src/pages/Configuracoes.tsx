import React, { useState, useEffect } from 'react';
import { Users, BookOpen, FileText, Plus, Save, Trash2, Edit2, Loader2, AlertCircle } from 'lucide-react';
import { getSupabase } from '../lib/supabase';

interface Turma {
  id: string;
  nome: string;
  ano: string;
  turno: string;
  professor: string;
}

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  turmaId: string;
}

export default function Configuracoes() {
  const [activeTab, setActiveTab] = useState<'turmas' | 'alunos' | 'gabaritos'>('turmas');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for Turmas
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [newTurmaName, setNewTurmaName] = useState('');
  const [newTurmaYear, setNewTurmaYear] = useState(new Date().getFullYear().toString());
  const [newTurmaTurno, setNewTurmaTurno] = useState('Matutino');
  const [newTurmaProfessor, setNewTurmaProfessor] = useState('');

  // State for Alunos
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [newAlunoName, setNewAlunoName] = useState('');
  const [newAlunoMatricula, setNewAlunoMatricula] = useState('');
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [filterTurmaId, setFilterTurmaId] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [editingAluno, setEditingAluno] = useState<Aluno | null>(null);

  // State for Gabaritos
  const [gabaritos, setGabaritos] = useState<any[]>([]);
  const [newGabaritoTitulo, setNewGabaritoTitulo] = useState('');
  const [newGabaritoDisciplina, setNewGabaritoDisciplina] = useState('');
  const [newGabaritoTurmaId, setNewGabaritoTurmaId] = useState('');
  const [newGabaritoRespostas, setNewGabaritoRespostas] = useState<string[]>(Array(10).fill(''));
  const [editingGabarito, setEditingGabarito] = useState<any | null>(null);

  // Fetch Turmas from Supabase
  const fetchTurmas = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('turmas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      } else {
        setTurmas(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching turmas:', err);
      setError(err.message || 'Erro ao carregar turmas.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Alunos from Supabase
  const fetchAlunos = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('alunos')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        throw error;
      } else {
        // Map snake_case from DB to camelCase in interface
        const mappedAlunos = (data || []).map((a: any) => ({
          id: a.id,
          nome: a.nome,
          matricula: a.matricula,
          turmaId: a.turma_id
        }));
        setAlunos(mappedAlunos);
      }
    } catch (err: any) {
      console.error('Error fetching alunos:', err);
      setError(err.message || 'Erro ao carregar alunos.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Gabaritos from Supabase
  const fetchGabaritos = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('gabaritos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      } else {
        setGabaritos(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching gabaritos:', err);
      // Don't set error here to avoid blocking the whole page if table doesn't exist yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if we have credentials
    try {
      getSupabase();
      fetchTurmas();
      fetchAlunos();
      fetchGabaritos();
    } catch (e) {
      setError('Configuração do Supabase pendente. Por favor, adicione as chaves VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
    }
  }, []);

  const handleAddTurma = async () => {
    if (!newTurmaName || !newTurmaYear || !newTurmaProfessor) return;
    
    try {
      setLoading(true);
      const supabase = getSupabase();
      // Use type casting to avoid "never" type error if Supabase types are not fully loaded
      const { error } = await (supabase
        .from('turmas') as any)
        .insert([
          { 
            nome: newTurmaName, 
            ano: newTurmaYear, 
            turno: newTurmaTurno, 
            professor: newTurmaProfessor 
          }
        ]);

      if (error) throw error;
      
      setNewTurmaName('');
      setNewTurmaProfessor('');
      fetchTurmas();
    } catch (err: any) {
      console.error('Error adding turma:', err);
      alert(err.message || 'Erro ao adicionar turma.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTurma = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta turma?')) return;

    try {
      setLoading(true);
      const supabase = getSupabase();
      const { error } = await (supabase
        .from('turmas') as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchTurmas();
    } catch (err: any) {
      console.error('Error deleting turma:', err);
      alert(err.message || 'Erro ao excluir turma.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAluno = async () => {
    if (!newAlunoName || !newAlunoMatricula || !selectedTurmaId) return;
    
    try {
      setLoading(true);
      const supabase = getSupabase();
      const { error } = await (supabase
        .from('alunos') as any)
        .insert([
          { 
            nome: newAlunoName, 
            matricula: newAlunoMatricula, 
            turma_id: selectedTurmaId 
          }
        ]);

      if (error) throw error;

      setNewAlunoName('');
      setNewAlunoMatricula('');
      fetchAlunos();
    } catch (err: any) {
      console.error('Error adding aluno:', err);
      alert(err.message || 'Erro ao adicionar aluno.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAluno = async () => {
    if (!editingAluno || !newAlunoName || !newAlunoMatricula || !selectedTurmaId) return;

    try {
      setLoading(true);
      const supabase = getSupabase();
      const { error } = await (supabase
        .from('alunos') as any)
        .update({
          nome: newAlunoName,
          matricula: newAlunoMatricula,
          turma_id: selectedTurmaId
        })
        .eq('id', editingAluno.id);

      if (error) throw error;

      setEditingAluno(null);
      setNewAlunoName('');
      setNewAlunoMatricula('');
      setSelectedTurmaId('');
      fetchAlunos();
      alert('Aluno atualizado com sucesso!');
    } catch (err: any) {
      console.error('Error updating aluno:', err);
      alert(err.message || 'Erro ao atualizar aluno.');
    } finally {
      setLoading(false);
    }
  };

  const startEditingAluno = (aluno: Aluno) => {
    setEditingAluno(aluno);
    setNewAlunoName(aluno.nome);
    setNewAlunoMatricula(aluno.matricula);
    setSelectedTurmaId(aluno.turmaId);
    setIsBulkMode(false);
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteAluno = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este aluno?')) return;

    try {
      setLoading(true);
      const supabase = getSupabase();
      const { error } = await (supabase
        .from('alunos') as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchAlunos();
    } catch (err: any) {
      console.error('Error deleting aluno:', err);
      alert(err.message || 'Erro ao excluir aluno.');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAddAlunos = async () => {
    if (!bulkText.trim() || !selectedTurmaId) {
      alert('Insira os nomes e selecione uma turma.');
      return;
    }

    const lines = bulkText.split('\n').filter(line => line.trim() !== '');
    const yearPrefix = new Date().getFullYear().toString();
    
    const newAlunosData = lines.map((line, index) => {
      // Check if line has format "Name;Matricula" or just "Name"
      const parts = line.split(';');
      const nome = parts[0].trim();
      const matricula = parts[1] ? parts[1].trim() : `${yearPrefix}${Math.floor(1000 + Math.random() * 9000)}${index}`;
      
      return {
        nome,
        matricula,
        turma_id: selectedTurmaId
      };
    });

    try {
      setLoading(true);
      const supabase = getSupabase();
      const { error } = await (supabase
        .from('alunos') as any)
        .insert(newAlunosData);

      if (error) throw error;

      setBulkText('');
      setIsBulkMode(false);
      fetchAlunos();
      alert(`${newAlunosData.length} alunos cadastrados com sucesso!`);
    } catch (err: any) {
      console.error('Error in bulk import:', err);
      alert(err.message || 'Erro na importação em lote.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGabarito = async () => {
    if (!newGabaritoTitulo || !newGabaritoDisciplina || !newGabaritoTurmaId || newGabaritoRespostas.some(r => !r)) {
      alert('Preencha todos os campos e todas as respostas do gabarito.');
      return;
    }

    try {
      setLoading(true);
      const supabase = getSupabase();
      const { error } = await (supabase
        .from('gabaritos') as any)
        .insert([
          {
            titulo: newGabaritoTitulo,
            disciplina: newGabaritoDisciplina,
            turma_id: newGabaritoTurmaId,
            respostas: newGabaritoRespostas
          }
        ]);

      if (error) throw error;

      setNewGabaritoTitulo('');
      setNewGabaritoDisciplina('');
      setNewGabaritoTurmaId('');
      setNewGabaritoRespostas(Array(10).fill(''));
      fetchGabaritos();
      alert('Gabarito salvo com sucesso!');
    } catch (err: any) {
      console.error('Error adding gabarito:', err);
      alert(err.message || 'Erro ao salvar gabarito.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGabarito = async () => {
    if (!editingGabarito || !newGabaritoTitulo || !newGabaritoDisciplina || !newGabaritoTurmaId || newGabaritoRespostas.some(r => !r)) {
      alert('Preencha todos os campos e todas as respostas do gabarito.');
      return;
    }

    try {
      setLoading(true);
      const supabase = getSupabase();
      const { error } = await (supabase
        .from('gabaritos') as any)
        .update({
          titulo: newGabaritoTitulo,
          disciplina: newGabaritoDisciplina,
          turma_id: newGabaritoTurmaId,
          respostas: newGabaritoRespostas
        })
        .eq('id', editingGabarito.id);

      if (error) throw error;

      setEditingGabarito(null);
      setNewGabaritoTitulo('');
      setNewGabaritoDisciplina('');
      setNewGabaritoTurmaId('');
      setNewGabaritoRespostas(Array(10).fill(''));
      fetchGabaritos();
      alert('Gabarito atualizado com sucesso!');
    } catch (err: any) {
      console.error('Error updating gabarito:', err);
      alert(err.message || 'Erro ao atualizar gabarito.');
    } finally {
      setLoading(false);
    }
  };

  const startEditingGabarito = (gab: any) => {
    setEditingGabarito(gab);
    setNewGabaritoTitulo(gab.titulo);
    setNewGabaritoDisciplina(gab.disciplina);
    setNewGabaritoTurmaId(gab.turma_id);
    setNewGabaritoRespostas(gab.respostas || []);
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addQuestion = () => {
    setNewGabaritoRespostas([...newGabaritoRespostas, '']);
  };

  const removeLastQuestion = () => {
    if (newGabaritoRespostas.length > 1) {
      setNewGabaritoRespostas(newGabaritoRespostas.slice(0, -1));
    }
  };

  const handleDeleteGabarito = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este gabarito?')) return;

    try {
      setLoading(true);
      const supabase = getSupabase();
      const { error } = await (supabase
        .from('gabaritos') as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchGabaritos();
    } catch (err: any) {
      console.error('Error deleting gabarito:', err);
      alert(err.message || 'Erro ao excluir gabarito.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto flex flex-col h-full">
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-[#1A202C] mb-2">Configurações do Sistema</h1>
        <p className="text-[#64748B] text-sm">Gerencie turmas, alunos e gabaritos oficiais.</p>
      </div>

      <div className="flex gap-6 border-b border-[#E2E8F0] mb-6">
        <button 
          onClick={() => setActiveTab('turmas')}
          className={`pb-3 border-b-2 font-semibold text-sm flex items-center gap-2 ${activeTab === 'turmas' ? 'border-[#0F2C59] text-[#0F2C59]' : 'border-transparent text-[#64748B] hover:text-[#1A202C]'}`}
        >
          <Users className="w-4 h-4" /> Turmas
        </button>
        <button 
          onClick={() => setActiveTab('alunos')}
          className={`pb-3 border-b-2 font-semibold text-sm flex items-center gap-2 ${activeTab === 'alunos' ? 'border-[#0F2C59] text-[#0F2C59]' : 'border-transparent text-[#64748B] hover:text-[#1A202C]'}`}
        >
          <BookOpen className="w-4 h-4" /> Alunos
        </button>
        <button 
          onClick={() => setActiveTab('gabaritos')}
          className={`pb-3 border-b-2 font-semibold text-sm flex items-center gap-2 ${activeTab === 'gabaritos' ? 'border-[#0F2C59] text-[#0F2C59]' : 'border-transparent text-[#64748B] hover:text-[#1A202C]'}`}
        >
          <FileText className="w-4 h-4" /> Gabaritos Oficiais
        </button>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded shadow-sm p-6 flex-1">
        {activeTab === 'turmas' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#1A202C]">Cadastro de Turmas</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 bg-gray-50 p-4 rounded border border-[#E2E8F0]">
              <label className="flex flex-col gap-1 lg:col-span-2">
                <span className="text-xs font-semibold text-[#1A202C] uppercase">Nome da Turma</span>
                <input 
                  type="text" 
                  value={newTurmaName}
                  onChange={(e) => setNewTurmaName(e.target.value)}
                  className="form-input rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-white" 
                  placeholder="Ex: 9º Ano A" 
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#1A202C] uppercase">Ano Letivo</span>
                <input 
                  type="text" 
                  value={newTurmaYear}
                  onChange={(e) => setNewTurmaYear(e.target.value)}
                  className="form-input rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-white" 
                  placeholder="Ex: 2024" 
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#1A202C] uppercase">Turno</span>
                <select 
                  value={newTurmaTurno}
                  onChange={(e) => setNewTurmaTurno(e.target.value)}
                  className="form-select rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-white"
                >
                  <option value="Matutino">Matutino</option>
                  <option value="Vespertino">Vespertino</option>
                  <option value="Noturno">Noturno</option>
                  <option value="Integral">Integral</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 lg:col-span-2">
                <span className="text-xs font-semibold text-[#1A202C] uppercase">Professor Responsável</span>
                <input 
                  type="text" 
                  value={newTurmaProfessor}
                  onChange={(e) => setNewTurmaProfessor(e.target.value)}
                  className="form-input rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-white" 
                  placeholder="Nome do professor" 
                />
              </label>
              <div className="flex items-end lg:col-span-3">
                <button 
                  onClick={handleAddTurma}
                  className="h-[42px] px-6 bg-[#0F2C59] text-white rounded text-sm font-bold flex items-center gap-2 hover:bg-[#0f3b7d] transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Adicionar Turma
                </button>
              </div>
            </div>
            
            <div className="mt-4">
              <h3 className="text-sm font-bold text-[#64748B] mb-4 uppercase tracking-wider">Turmas Cadastradas</h3>
              <div className="border border-[#E2E8F0] rounded overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#E2E8F0]">
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest">Nome da Turma</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest">Ano Letivo</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest">Turno</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest">Professor</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {turmas.map((turma) => (
                      <tr key={turma.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium text-[#1A202C]">{turma.nome}</td>
                        <td className="py-3 px-4 text-sm text-[#64748B]">{turma.ano}</td>
                        <td className="py-3 px-4 text-sm text-[#64748B]">{turma.turno}</td>
                        <td className="py-3 px-4 text-sm text-[#64748B]">{turma.professor}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => {
                                setFilterTurmaId(turma.id);
                                setActiveTab('alunos');
                              }}
                              className="p-1.5 text-gray-400 hover:text-[#0F2C59] transition-colors" 
                              title="Visualizar Alunos"
                            >
                              <Users className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 text-gray-400 hover:text-[#0F2C59] transition-colors" title="Editar">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteTurma(turma.id)}
                              className="p-1.5 text-gray-400 hover:text-[#DC2626] transition-colors" 
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {turmas.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-[#64748B]">Nenhuma turma cadastrada.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alunos' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#1A202C]">
                {editingAluno ? 'Editar Aluno' : 'Cadastro de Alunos'}
              </h2>
              <button 
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  setEditingAluno(null);
                  setNewAlunoName('');
                  setNewAlunoMatricula('');
                  setSelectedTurmaId('');
                }}
                className="text-sm font-semibold text-[#0F2C59] hover:underline"
              >
                {isBulkMode ? 'Voltar para cadastro individual' : 'Importação em Lote (Lista de Nomes)'}
              </button>
            </div>

            {!isBulkMode ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded border border-[#E2E8F0]">
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-xs font-semibold text-[#1A202C] uppercase">Nome do Aluno</span>
                  <input 
                    type="text" 
                    value={newAlunoName}
                    onChange={(e) => setNewAlunoName(e.target.value)}
                    className="form-input rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-white" 
                    placeholder="Nome completo" 
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[#1A202C] uppercase">Matrícula</span>
                  <input 
                    type="text" 
                    value={newAlunoMatricula}
                    onChange={(e) => setNewAlunoMatricula(e.target.value)}
                    className="form-input rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-white" 
                    placeholder="Ex: 2024001" 
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[#1A202C] uppercase">Turma</span>
                  <select 
                    value={selectedTurmaId}
                    onChange={(e) => setSelectedTurmaId(e.target.value)}
                    className="form-select rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-white"
                  >
                    <option value="">Selecione...</option>
                    {turmas.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </label>
                <div className="md:col-span-4 flex justify-end gap-3">
                  {editingAluno && (
                    <button 
                      onClick={() => {
                        setEditingAluno(null);
                        setNewAlunoName('');
                        setNewAlunoMatricula('');
                        setSelectedTurmaId('');
                      }}
                      className="h-[42px] px-6 text-[#64748B] text-sm font-bold hover:bg-gray-100 rounded transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    onClick={editingAluno ? handleUpdateAluno : handleAddAluno}
                    disabled={loading}
                    className={`h-[42px] px-6 ${editingAluno ? 'bg-[#059669] hover:bg-[#047857]' : 'bg-[#0F2C59] hover:bg-[#0f3b7d]'} text-white rounded text-sm font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50`}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingAluno ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                    {editingAluno ? 'Salvar Alterações' : 'Adicionar Aluno'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 bg-gray-50 p-4 rounded border border-[#E2E8F0]">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[#1A202C] uppercase">Turma de Destino</span>
                  <select 
                    value={selectedTurmaId}
                    onChange={(e) => setSelectedTurmaId(e.target.value)}
                    className="form-select rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-white max-w-xs"
                  >
                    <option value="">Selecione a turma...</option>
                    {turmas.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[#1A202C] uppercase">Lista de Nomes (Um por linha)</span>
                  <p className="text-[10px] text-[#64748B] mb-1 italic">Dica: Você pode usar o formato "Nome;Matricula" ou apenas o Nome.</p>
                  <textarea 
                    rows={10}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    className="form-textarea rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-white w-full font-mono"
                    placeholder="Exemplo:&#10;João Silva&#10;Maria Oliveira;2024005&#10;Pedro Santos"
                  />
                </label>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setIsBulkMode(false)}
                    className="h-[42px] px-6 text-[#64748B] text-sm font-bold hover:bg-gray-100 rounded transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleBulkAddAlunos}
                    disabled={loading || !selectedTurmaId || !bulkText.trim()}
                    className="h-[42px] px-6 bg-[#0F2C59] text-white rounded text-sm font-bold flex items-center gap-2 hover:bg-[#0f3b7d] transition-colors shadow-sm disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Processar Importação
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Alunos Cadastrados</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#64748B]">Filtrar por Turma:</span>
                  <select 
                    value={filterTurmaId}
                    onChange={(e) => setFilterTurmaId(e.target.value)}
                    className="form-select rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-xs bg-white py-1"
                  >
                    <option value="">Todas as Turmas</option>
                    {turmas.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="border border-[#E2E8F0] rounded overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#E2E8F0]">
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest">Nome</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest">Matrícula</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest">Turma</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {alunos
                      .filter(aluno => !filterTurmaId || aluno.turmaId === filterTurmaId)
                      .map((aluno) => (
                        <tr key={aluno.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-sm font-medium text-[#1A202C]">{aluno.nome}</td>
                          <td className="py-3 px-4 text-sm text-[#64748B]">{aluno.matricula}</td>
                          <td className="py-3 px-4 text-sm text-[#64748B]">
                            {turmas.find(t => t.id === aluno.turmaId)?.nome || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => startEditingAluno(aluno)}
                                className="p-1.5 text-gray-400 hover:text-[#0F2C59] transition-colors" 
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteAluno(aluno.id)}
                                className="p-1.5 text-gray-400 hover:text-[#DC2626] transition-colors" 
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {alunos.filter(aluno => !filterTurmaId || aluno.turmaId === filterTurmaId).length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-sm text-[#64748B]">Nenhum aluno encontrado para esta seleção.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gabaritos' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#1A202C]">
                {editingGabarito ? 'Editar Gabarito Oficial' : 'Lançamento de Gabarito Oficial'}
              </h2>
              {editingGabarito && (
                <button 
                  onClick={() => {
                    setEditingGabarito(null);
                    setNewGabaritoTitulo('');
                    setNewGabaritoDisciplina('');
                    setNewGabaritoTurmaId('');
                    setNewGabaritoRespostas(Array(10).fill(''));
                  }}
                  className="text-sm font-semibold text-[#DC2626] hover:underline"
                >
                  Cancelar Edição
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded border border-[#E2E8F0]">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#1A202C] uppercase">Título da Avaliação</span>
                <input 
                  type="text" 
                  value={newGabaritoTitulo}
                  onChange={(e) => setNewGabaritoTitulo(e.target.value)}
                  className="form-input rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-white" 
                  placeholder="Ex: Simulado 1" 
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#1A202C] uppercase">Disciplina</span>
                <input 
                  type="text" 
                  value={newGabaritoDisciplina}
                  onChange={(e) => setNewGabaritoDisciplina(e.target.value)}
                  className="form-input rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-white" 
                  placeholder="Ex: Matemática" 
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#1A202C] uppercase">Turma Alvo</span>
                <select 
                  value={newGabaritoTurmaId}
                  onChange={(e) => setNewGabaritoTurmaId(e.target.value)}
                  className="form-select rounded border-[#E2E8F0] focus:ring-[#0F2C59] text-sm bg-white"
                >
                  <option value="">Selecione...</option>
                  {turmas.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </label>
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-[#1A202C] uppercase tracking-wider text-[#64748B]">
                  Respostas Oficiais ({newGabaritoRespostas.length} Questões)
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={removeLastQuestion}
                    className="text-xs font-bold text-[#DC2626] hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Remover Última
                  </button>
                  <button 
                    onClick={addQuestion}
                    className="text-xs font-bold text-[#059669] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Adicionar Questão
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-4">
                {newGabaritoRespostas.map((res, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#64748B] w-6">{(i + 1).toString().padStart(2, '0')}</span>
                    <input 
                      type="text" 
                      maxLength={1} 
                      value={res}
                      onChange={(e) => {
                        const newRes = [...newGabaritoRespostas];
                        newRes[i] = e.target.value.toUpperCase();
                        setNewGabaritoRespostas(newRes);
                      }}
                      className="form-input w-12 h-10 text-center uppercase font-bold text-[#0F2C59] rounded border-[#E2E8F0] focus:ring-[#0F2C59] bg-white" 
                      placeholder="-" 
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-4 gap-3">
              {editingGabarito && (
                <button 
                  onClick={() => {
                    setEditingGabarito(null);
                    setNewGabaritoTitulo('');
                    setNewGabaritoDisciplina('');
                    setNewGabaritoTurmaId('');
                    setNewGabaritoRespostas(Array(10).fill(''));
                  }}
                  className="h-[42px] px-6 text-[#64748B] text-sm font-bold hover:bg-gray-100 rounded transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button 
                onClick={editingGabarito ? handleUpdateGabarito : handleAddGabarito}
                disabled={loading}
                className={`h-[42px] px-6 ${editingGabarito ? 'bg-[#0066CC] hover:bg-[#0052a3]' : 'bg-[#059669] hover:bg-[#047857]'} text-white rounded text-sm font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingGabarito ? 'Atualizar Gabarito' : 'Salvar Gabarito'}
              </button>
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-bold text-[#64748B] mb-4 uppercase tracking-wider">Gabaritos Salvos</h3>
              <div className="border border-[#E2E8F0] rounded overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#E2E8F0]">
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest">Título</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest">Disciplina</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest">Turma</th>
                      <th className="py-3 px-4 text-xs font-bold text-[#64748B] uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {gabaritos.map((gab) => (
                      <tr key={gab.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium text-[#1A202C]">{gab.titulo}</td>
                        <td className="py-3 px-4 text-sm text-[#64748B]">{gab.disciplina}</td>
                        <td className="py-3 px-4 text-sm text-[#64748B]">
                          {turmas.find(t => t.id === gab.turma_id)?.nome || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => startEditingGabarito(gab)}
                              className="p-1.5 text-gray-400 hover:text-[#0F2C59] transition-colors" 
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteGabarito(gab.id)}
                              className="p-1.5 text-gray-400 hover:text-[#DC2626] transition-colors" 
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {gabaritos.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-sm text-[#64748B]">Nenhum gabarito cadastrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
