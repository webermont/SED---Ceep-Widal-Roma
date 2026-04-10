import React, { useState, useEffect, useRef } from 'react';
import { Download, X, Filter, Loader2, Info, FileText, CheckCircle2 } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { clsx } from 'clsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Turma {
  id: string;
  nome: string;
  turno: string;
}

interface Gabarito {
  id: string;
  titulo: string;
  disciplina: string;
  respostas: string[];
  competencias?: string[]; // Optional: mapping of question to BNCC skill
}

interface AlunoPerformance {
  id: string;
  nome: string;
  respostas: string[];
}

interface SkillMastery {
  id: string;
  desc: string;
  fullDesc: string;
  mastery: number; // 0-100
  studentMastery: Record<string, number>; // alunoId -> 0 or 100 (binary for simplicity or % if multiple questions)
  turmaMastery: Record<string, number>; // turmaId -> 0-100
}

export default function MapaCalorBNCC() {
  const [loading, setLoading] = useState(false);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [gabaritos, setGabaritos] = useState<Gabarito[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [selectedGabaritoId, setSelectedGabaritoId] = useState('');
  
  const [alunos, setAlunos] = useState<AlunoPerformance[]>([]);
  const [skillsMastery, setSkillsMastery] = useState<SkillMastery[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({
    heatmap: true,
    performance: true,
    charts: true,
    pedagogicalActions: true
  });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const heatmapRef = useRef<HTMLDivElement>(null);
  const performanceRef = useRef<HTMLDivElement>(null);

  // Default BNCC skills for demo if not mapped
  const defaultSkills = [
    { id: 'EF09MA01', desc: 'Números Irracionais', fullDesc: 'Reconhecer um número irracional como um número real cuja representação decimal é infinita e não periódica.' },
    { id: 'EF09MA02', desc: 'Representações Decimais', fullDesc: 'Reconhecer as representações decimais dos números racionais como uma extensão do sistema de numeração decimal.' },
    { id: 'EF09MA03', desc: 'Cálculos com Reais', fullDesc: 'Efetuar cálculos com números reais, inclusive potências com expoentes fracionários.' },
    { id: 'EF09MA04', desc: 'Problemas com Reais', fullDesc: 'Resolver e elaborar problemas com números reais, inclusive em notação científica.' },
  ];

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
    const calculateHeatmap = async () => {
      if (!selectedGabaritoId) {
        setSkillsMastery([]);
        setAlunos([]);
        return;
      }

      try {
        setLoading(true);
        const supabase = getSupabase();
        
        // 1. Fetch current gabarito
        const currentGabarito = gabaritos.find(g => g.id === selectedGabaritoId);
        if (!currentGabarito) return;

        // 2. Fetch all student responses for this gabarito
        const { data: rData, error: rError } = await supabase
          .from('respostas_alunos')
          .select(`
            id,
            respostas,
            aluno_id,
            alunos (id, nome)
          `)
          .eq('gabarito_id', selectedGabaritoId);

        if (rError) throw rError;

        // 3. Map students
        const students: AlunoPerformance[] = (rData || []).map((r: any) => ({
          id: r.alunos.id,
          nome: r.alunos.nome,
          respostas: r.respostas
        }));
        setAlunos(students);

        // 4. Calculate mastery per skill
        // Since we don't have a real mapping yet, we'll distribute questions among default skills
        const skills: SkillMastery[] = defaultSkills.map((skill, skillIdx) => {
          const studentMastery: Record<string, number> = {};
          let totalCorrect = 0;
          let totalPossible = 0;

          // Assign roughly 1/4 of questions to each skill for demo
          const questionsForSkill = currentGabarito.respostas.map((_, i) => i)
            .filter(i => i % defaultSkills.length === skillIdx);

          students.forEach(student => {
            let correctCount = 0;
            questionsForSkill.forEach(qIdx => {
              if (student.respostas[qIdx] === currentGabarito.respostas[qIdx]) {
                correctCount++;
              }
            });
            
            const mastery = questionsForSkill.length > 0 
              ? (correctCount / questionsForSkill.length) * 100 
              : 0;
            
            studentMastery[student.id] = mastery;
            totalCorrect += correctCount;
            totalPossible += questionsForSkill.length;
          });

          const turmaMastery = totalPossible > 0 ? (totalCorrect / totalPossible) * 100 : 0;

          return {
            ...skill,
            mastery: turmaMastery,
            studentMastery,
            turmaMastery: { [selectedTurmaId]: turmaMastery }
          };
        });

        setSkillsMastery(skills);
      } catch (err) {
        console.error('Error calculating heatmap:', err);
      } finally {
        setLoading(false);
      }
    };

    calculateHeatmap();
  }, [selectedGabaritoId, gabaritos, selectedTurmaId]);

  const getHeatmapColor = (value: number) => {
    if (value < 50) return 'bg-[#DC2626]'; // Critical
    if (value < 70) return 'bg-[#D97706]'; // Basic
    if (value < 85) return 'bg-[#059669]'; // Adequate
    return 'bg-[#0066CC]'; // Advanced
  };

  const selectedSkill = skillsMastery.find(s => s.id === selectedSkillId);

  const handleExportReport = () => {
    if (skillsMastery.length === 0 || alunos.length === 0) {
      alert('Selecione uma turma e um gabarito com dados para exportar.');
      return;
    }

    const currentGabarito = gabaritos.find(g => g.id === selectedGabaritoId);
    const currentTurma = turmas.find(t => t.id === selectedTurmaId);

    // CSV Header
    const headers = [
      'Habilidade BNCC',
      'Descricao',
      'Media Turma (%)',
      ...alunos.map(a => a.nome)
    ];

    // CSV Rows
    const rows = skillsMastery.map(skill => {
      const studentValues = alunos.map(aluno => 
        Math.round(skill.studentMastery[aluno.id] || 0)
      );
      return [
        skill.id,
        `"${skill.desc.replace(/"/g, '""')}"`,
        Math.round(skill.mastery),
        ...studentValues
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const fileName = `Relatorio_BNCC_${currentTurma?.nome || 'Turma'}_${currentGabarito?.titulo || 'Avaliacao'}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGeneratePdf = async () => {
    if (!selectedGabaritoId) return;
    
    setIsGeneratingPdf(true);
    console.log('Iniciando geração de PDF com autoTable...');

    try {
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape for better heatmap view
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      const currentTurma = turmas.find(t => t.id === selectedTurmaId);
      const currentGabarito = gabaritos.find(g => g.id === selectedGabaritoId);

      // --- Title Page ---
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(15, 44, 89);
      pdf.text('Relatório Pedagógico BNCC', pageWidth / 2, 20, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      pdf.text(`Instituição: CEEP Widal Roma`, margin, 35);
      pdf.text(`Turma: ${currentTurma?.nome || 'N/A'}`, margin, 42);
      pdf.text(`Avaliação: ${currentGabarito?.titulo || 'N/A'}`, margin, 49);
      pdf.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, margin, 56);

      let currentY = 65;

      // --- 1. Heatmap Section (using autoTable) ---
      if (pdfOptions.heatmap) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(15, 44, 89);
        pdf.text('1. Matriz de Domínio (Mapa de Calor)', margin, currentY);
        
        const tableHeaders = [
          'Habilidade',
          'Média',
          ...alunos.map(a => a.nome.split(' ')[0]) // Short names for columns
        ];

        const tableRows = skillsMastery.map(skill => {
          return [
            skill.id,
            `${Math.round(skill.mastery)}%`,
            ...alunos.map(aluno => `${Math.round(skill.studentMastery[aluno.id] || 0)}%`)
          ];
        });

        autoTable(pdf, {
          startY: currentY + 5,
          head: [tableHeaders],
          body: tableRows,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
          columnStyles: {
            0: { halign: 'left', fontStyle: 'bold', cellWidth: 25 },
            1: { fontStyle: 'bold', cellWidth: 15 }
          },
          didParseCell: (data) => {
            // Apply colors based on percentage
            if (data.section === 'body' && data.column.index >= 1) {
              const valStr = data.cell.raw as string;
              const val = parseInt(valStr);
              if (!isNaN(val)) {
                if (val < 50) data.cell.styles.fillColor = [220, 38, 38]; // Red
                else if (val < 70) data.cell.styles.fillColor = [217, 119, 6]; // Orange
                else if (val < 85) data.cell.styles.fillColor = [5, 150, 105]; // Green
                else data.cell.styles.fillColor = [0, 102, 204]; // Blue
                data.cell.styles.textColor = [255, 255, 255];
              }
            }
          },
          margin: { left: margin, right: margin }
        });

        currentY = (pdf as any).lastAutoTable.finalY + 15;
      }

      // --- 2. Performance Summary ---
      if (pdfOptions.performance) {
        if (currentY > pageHeight - 40) {
          pdf.addPage();
          currentY = 20;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(15, 44, 89);
        pdf.text('2. Detalhamento por Habilidade', margin, currentY);

        const summaryRows = skillsMastery.map(skill => [
          skill.id,
          skill.desc,
          `${Math.round(skill.mastery)}%`,
          skill.mastery < 50 ? 'Crítico' : skill.mastery < 70 ? 'Básico' : skill.mastery < 85 ? 'Adequado' : 'Avançado'
        ]);

        autoTable(pdf, {
          startY: currentY + 5,
          head: [['Código', 'Descrição', 'Média', 'Status']],
          body: summaryRows,
          theme: 'striped',
          styles: { fontSize: 9 },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 25 },
            1: { cellWidth: 'auto' },
            2: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
            3: { halign: 'center', fontStyle: 'bold', cellWidth: 25 }
          },
          margin: { left: margin, right: margin }
        });

        currentY = (pdf as any).lastAutoTable.finalY + 15;
      }

      // --- 3. Pedagogical Actions ---
      if (pdfOptions.pedagogicalActions) {
        if (currentY > pageHeight - 60) {
          pdf.addPage();
          currentY = 20;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(15, 44, 89);
        pdf.text('3. Recomendações Pedagógicas', margin, currentY);
        currentY += 10;

        const critical = skillsMastery.filter(s => s.mastery < 50);
        if (critical.length > 0) {
          pdf.setFontSize(11);
          pdf.setTextColor(220, 38, 38);
          pdf.text('Ação Imediata (Habilidades Críticas):', margin, currentY);
          currentY += 6;
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(50, 50, 50);
          critical.forEach(s => {
            const txt = `• ${s.id}: ${s.desc} - Retomada de conteúdo necessária.`;
            const lines = pdf.splitTextToSize(txt, pageWidth - (margin * 2));
            pdf.text(lines, margin + 5, currentY);
            currentY += (lines.length * 5) + 2;
          });
        }
      }

      pdf.save(`Relatorio_BNCC_${currentTurma?.nome || 'Turma'}.pdf`);
      setShowPdfModal(false);
    } catch (err) {
      console.error('Erro na geração do PDF:', err);
      alert('Erro ao gerar o PDF. Por favor, tente novamente.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Page Header & Filters */}
      <div className="bg-white border-b border-[#E2E8F0] p-6 shrink-0 shadow-sm z-10 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold font-heading text-[#1A202C] leading-tight">Mapa de Calor BNCC</h1>
            <p className="text-[#64748B] text-sm mt-1">Matriz de domínio de habilidades curriculares por turma e aluno.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowPdfModal(true)}
              className="px-4 py-2 bg-[#0F2C59] text-white rounded text-sm font-semibold hover:bg-[#0f3b7d] shadow-sm transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Gerar Relatório PDF
            </button>
            <button 
              onClick={handleExportReport}
              className="px-4 py-2 bg-white border border-[#E2E8F0] rounded text-sm font-semibold text-[#1A202C] hover:bg-gray-50 shadow-sm transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-4 items-end bg-gray-50 p-4 rounded border border-[#E2E8F0]">
          <div className="flex flex-col gap-1.5 w-64">
            <label className="text-xs font-semibold text-[#1A202C] uppercase tracking-wide">Turma</label>
            <select 
              value={selectedTurmaId}
              onChange={(e) => setSelectedTurmaId(e.target.value)}
              className="w-full border-[#E2E8F0] rounded text-sm bg-white shadow-sm focus:border-[#0F2C59] focus:ring-[#0F2C59] h-10 px-3"
            >
              <option value="">Selecione a turma...</option>
              {turmas.map(t => (
                <option key={t.id} value={t.id}>{t.nome} - {t.turno}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 w-64">
            <label className="text-xs font-semibold text-[#1A202C] uppercase tracking-wide">Avaliação / Gabarito</label>
            <select 
              value={selectedGabaritoId}
              onChange={(e) => setSelectedGabaritoId(e.target.value)}
              disabled={!selectedTurmaId}
              className="w-full border-[#E2E8F0] rounded text-sm bg-white shadow-sm focus:border-[#0F2C59] focus:ring-[#0F2C59] h-10 px-3 disabled:opacity-50"
            >
              <option value="">Selecione o gabarito...</option>
              {gabaritos.map(g => (
                <option key={g.id} value={g.id}>{g.titulo} ({g.disciplina})</option>
              ))}
            </select>
          </div>
          
          <div className="ml-auto flex items-center gap-4 text-[10px] font-bold text-[#64748B] bg-white px-3 py-2 border border-[#E2E8F0] rounded shadow-sm uppercase tracking-wider">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#DC2626] rounded-sm"></div> Crítico &lt;50%</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#D97706] rounded-sm"></div> Básico 50-70%</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#059669] rounded-sm"></div> Adequado 70-85%</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#0066CC] rounded-sm"></div> Avançado &gt;85%</div>
          </div>
        </div>
      </div>

      {/* Heatmap Content Area */}
      <div className="flex-1 overflow-auto p-6 bg-[#F4F6F8] flex flex-col">
        {selectedGabaritoId ? (
          <div className="flex flex-1 min-h-0">
            {/* Matrix Container */}
            <div ref={heatmapRef} className="bg-white border border-[#E2E8F0] rounded shadow-sm overflow-hidden flex flex-col flex-1 min-w-0">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#0F2C59]" />
                  <p className="text-sm font-medium text-[#64748B]">Calculando matriz de domínio...</p>
                </div>
              ) : (
                <>
                  {/* Matrix Header (X-Axis) */}
                  <div className="flex border-b border-[#E2E8F0] bg-gray-50 min-w-max sticky top-0 z-20 shadow-sm">
                    <div className="w-48 shrink-0 p-3 flex items-center justify-start border-r border-[#E2E8F0] sticky left-0 bg-gray-50 z-30">
                      <span className="text-xs font-bold text-[#64748B] uppercase tracking-widest">Habilidades BNCC</span>
                    </div>
                    {/* Columns: Classes */}
                    <div className="flex">
                      <div className="w-[60px] h-[80px] flex items-end justify-center pb-3 border-r border-[#E2E8F0] bg-blue-50/50">
                        <span className="text-[10px] font-bold text-[#0F2C59] -rotate-90 whitespace-nowrap origin-bottom uppercase tracking-tighter">Média Turma</span>
                      </div>
                      {/* Separator */}
                      <div className="w-4 bg-gray-100 border-r border-[#E2E8F0]"></div>
                      {/* Columns: Students */}
                      {alunos.map(aluno => (
                        <div key={aluno.id} className="w-[40px] h-[80px] flex items-end justify-center pb-3 border-r border-gray-200">
                          <span className="text-[9px] font-bold text-[#64748B] -rotate-90 whitespace-nowrap origin-bottom uppercase truncate max-w-[60px]">{aluno.nome}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Matrix Body */}
                  <div className="overflow-auto min-w-max flex-1 relative">
                    {skillsMastery.map((skill) => (
                      <div key={skill.id} className={clsx(
                        "flex border-b border-[#E2E8F0] transition-colors",
                        selectedSkillId === skill.id ? "bg-blue-50/30" : "hover:bg-gray-50"
                      )}>
                        <div 
                          className={clsx(
                            "w-48 shrink-0 px-3 py-2 flex flex-col justify-center border-r border-[#E2E8F0] sticky left-0 z-10 cursor-pointer border-l-2",
                            selectedSkillId === skill.id ? "bg-blue-50 border-l-[#0F2C59]" : "bg-white border-l-transparent hover:border-l-[#0F2C59]"
                          )}
                          onClick={() => setSelectedSkillId(skill.id)}
                        >
                          <span className={clsx("text-sm font-bold", selectedSkillId === skill.id ? "text-[#0F2C59]" : "text-[#1A202C]")}>{skill.id}</span>
                          <span className="text-[10px] text-[#64748B] truncate font-medium">{skill.desc}</span>
                        </div>
                        <div className="flex">
                          {/* Turma Mastery Cell */}
                          <div 
                            className={clsx(
                              "w-[60px] h-[44px] flex items-center justify-center text-[10px] font-bold text-white relative cursor-pointer border-r border-[#E2E8F0]",
                              getHeatmapColor(skill.mastery)
                            )}
                            title={`Média Turma: ${Math.round(skill.mastery)}%`}
                          >
                            {Math.round(skill.mastery)}%
                          </div>
                          <div className="w-4 bg-gray-50 border-r border-[#E2E8F0] border-l border-[#E2E8F0]"></div>
                          {/* Student Mastery Cells */}
                          {alunos.map(aluno => {
                            const mastery = skill.studentMastery[aluno.id] || 0;
                            return (
                              <div 
                                key={aluno.id}
                                className={clsx(
                                  "w-[40px] h-[44px] flex items-center justify-center text-[9px] font-bold text-transparent hover:text-white hover:border-2 hover:border-[#1A202C] hover:z-10 relative cursor-pointer border-r border-gray-100",
                                  getHeatmapColor(mastery)
                                )}
                                title={`${aluno.nome}: ${Math.round(mastery)}%`}
                              >
                                {Math.round(mastery)}%
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {skillsMastery.length === 0 && (
                      <div className="p-12 text-center text-[#64748B] font-medium">
                        Nenhum dado pedagógico disponível para esta avaliação.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Collapsible Right Panel (Skill Legend) */}
            {selectedSkillId && selectedSkill && (
              <div className="w-80 ml-6 bg-white border border-[#E2E8F0] rounded shadow-sm flex flex-col shrink-0 overflow-hidden">
                <div className="p-4 border-b border-[#E2E8F0] flex justify-between items-center bg-gray-50">
                  <h3 className="text-sm font-bold text-[#1A202C] uppercase tracking-widest">Detalhamento BNCC</h3>
                  <button 
                    onClick={() => setSelectedSkillId(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-5 flex-1 overflow-y-auto">
                  <div className="mb-6">
                    <div className="inline-flex items-center justify-center px-2 py-1 bg-blue-100 text-[#0F2C59] text-xs font-bold rounded mb-3 border border-blue-200">
                      {selectedSkill.id}
                    </div>
                    <p className="text-sm text-[#1A202C] leading-relaxed font-medium">
                      {selectedSkill.fullDesc}
                    </p>
                  </div>
                  
                  <div className="border-t border-[#E2E8F0] pt-5">
                    <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-widest mb-4">Desempenho da Turma</h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-semibold text-[#1A202C]">Domínio Médio</span>
                          <span className={clsx("font-bold", 
                            selectedSkill.mastery < 50 ? "text-[#DC2626]" : 
                            selectedSkill.mastery < 70 ? "text-[#D97706]" : 
                            selectedSkill.mastery < 85 ? "text-[#059669]" : "text-[#0066CC]"
                          )}>
                            {Math.round(selectedSkill.mastery)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                          <div 
                            className={clsx("h-full transition-all duration-500", getHeatmapColor(selectedSkill.mastery))} 
                            style={{ width: `${selectedSkill.mastery}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded">
                    <div className="flex items-center gap-2 mb-2 text-[#0F2C59]">
                      <Info className="w-4 h-4" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">Ação Pedagógica</h4>
                    </div>
                    <p className="text-xs text-[#0F2C59] leading-relaxed">
                      {selectedSkill.mastery < 50 
                        ? "Recomendado: Retomada imediata do conteúdo com atividades de nivelamento." 
                        : selectedSkill.mastery < 70 
                        ? "Recomendado: Reforço pontual em pequenos grupos de estudo." 
                        : "Recomendado: Atividades de aprofundamento e desafios complexos."}
                    </p>
                  </div>

                  <div className="mt-6">
                    <button className="w-full py-2.5 bg-[#0F2C59] text-white text-xs font-bold rounded hover:bg-[#0f3b7d] transition-colors shadow-sm uppercase tracking-widest">
                      Ver Material de Apoio
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white border border-[#E2E8F0] rounded shadow-sm py-32">
            <div className="w-16 h-16 bg-[#F4F6F8] rounded-full flex items-center justify-center mb-4">
              <Filter className="w-8 h-8 text-[#64748B]" />
            </div>
            <h2 className="text-xl font-bold text-[#1A202C] mb-2">Selecione os filtros</h2>
            <p className="text-[#64748B] max-w-md text-center">Escolha uma turma e um gabarito oficial para gerar a matriz de calor BNCC e identificar lacunas de aprendizagem.</p>
          </div>
        )}
      </div>
      {/* PDF Generation Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-[#E2E8F0]">
            <div className="p-6 border-b border-[#E2E8F0] flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-[#0F2C59]">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1A202C] font-heading">Configurar Relatório PDF</h3>
                  <p className="text-xs text-[#64748B]">Selecione os módulos para o documento final.</p>
                </div>
              </div>
              <button 
                onClick={() => !isGeneratingPdf && setShowPdfModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 rounded border border-[#E2E8F0] hover:bg-gray-50 cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    checked={pdfOptions.heatmap}
                    onChange={(e) => setPdfOptions(prev => ({ ...prev, heatmap: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-[#0F2C59] focus:ring-[#0F2C59]"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#1A202C]">Matriz Mapa de Calor</p>
                    <p className="text-[10px] text-[#64748B]">Visualização completa das habilidades por aluno.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded border border-[#E2E8F0] hover:bg-gray-50 cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    checked={pdfOptions.performance}
                    onChange={(e) => setPdfOptions(prev => ({ ...prev, performance: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-[#0F2C59] focus:ring-[#0F2C59]"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#1A202C]">Resumo de Desempenho</p>
                    <p className="text-[10px] text-[#64748B]">Lista detalhada de médias e status por habilidade.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded border border-[#E2E8F0] hover:bg-gray-50 cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    checked={pdfOptions.pedagogicalActions}
                    onChange={(e) => setPdfOptions(prev => ({ ...prev, pedagogicalActions: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-[#0F2C59] focus:ring-[#0F2C59]"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#1A202C]">Ações Pedagógicas</p>
                    <p className="text-[10px] text-[#64748B]">Sugestões de intervenção baseadas nos resultados.</p>
                  </div>
                </label>
              </div>

              {!selectedGabaritoId && (
                <div className="p-3 bg-red-50 border border-red-100 rounded flex items-start gap-2">
                  <Info className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-700 font-medium">
                    Atenção: Você precisa selecionar uma turma e um gabarito antes de gerar o PDF.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t border-[#E2E8F0] flex gap-3">
              <button 
                onClick={() => setShowPdfModal(false)}
                disabled={isGeneratingPdf}
                className="flex-1 py-2.5 bg-white border border-[#E2E8F0] text-[#1A202C] text-sm font-bold rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf || !selectedGabaritoId}
                className="flex-1 py-2.5 bg-[#0F2C59] text-white text-sm font-bold rounded hover:bg-[#0f3b7d] transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar e Gerar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
