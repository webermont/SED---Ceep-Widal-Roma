import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Download, X, Filter, Loader2, Info, FileText, CheckCircle2, BarChart2, Grid, User, AlertCircle, TrendingUp } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { clsx } from 'clsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Cell 
} from 'recharts';

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
  const [viewMode, setViewMode] = useState<'heatmap' | 'overview'>('heatmap');
  
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

        if (rError) {
          console.error('Error fetching student responses:', rError);
          setLoading(false);
          return;
        }

        console.log('Fetched student responses:', rData);

        // 3. Map students - Add safety check for joined data
        const students: AlunoPerformance[] = (rData || [])
          .filter((r: any) => {
            if (!r.alunos) {
              console.warn(`Response ${r.id} has no associated student data. Check foreign key relationships.`);
              return false;
            }
            return true;
          })
          .map((r: any) => ({
            id: r.alunos.id,
            nome: r.alunos.nome,
            respostas: r.respostas
          }));
        
        if (students.length === 0) {
          console.warn('No student responses found for this gabarito.');
          setAlunos([]);
          setSkillsMastery([]);
          setLoading(false);
          return;
        }

        console.log('Mapped students for analysis:', students);

        setAlunos(students);

        // 4. Calculate mastery per skill
        let skills: SkillMastery[] = [];
        
        // Ensure competencias is an array and has at least one non-empty value
        const currentGab = gabaritos.find(g => g.id === selectedGabaritoId);
        const competencias = currentGab?.competencias;
        const hasCompetencias = Array.isArray(competencias) && competencias.some(c => c && typeof c === 'string' && c.trim() !== '');

        if (hasCompetencias) {
          // Get unique skills from the gabarito
          const uniqueSkillCodes = Array.from(new Set(
            (competencias as string[]).filter(c => c && typeof c === 'string' && c.trim() !== '')
          ));
          
          skills = uniqueSkillCodes.map(skillCode => {
            const studentMastery: Record<string, number> = {};
            let totalCorrect = 0;
            let totalPossible = 0;

            // Find all question indices that map to this skill
            const questionsForSkill = currentGabarito.competencias!
              .map((code, idx) => code === skillCode ? idx : -1)
              .filter(idx => idx !== -1);

            students.forEach(student => {
              let correctCount = 0;
              questionsForSkill.forEach(qIdx => {
                // Safety check for response index
                if (student.respostas && 
                    student.respostas[qIdx] !== undefined && 
                    student.respostas[qIdx] === currentGabarito.respostas[qIdx]) {
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
              id: skillCode,
              desc: `Habilidade ${skillCode}`,
              fullDesc: `Análise detalhada da habilidade BNCC ${skillCode} conforme mapeado no gabarito oficial.`,
              mastery: turmaMastery,
              studentMastery,
              turmaMastery: { [selectedTurmaId]: turmaMastery }
            };
          });
        } else {
          // Fallback to default skills distributed among questions
          skills = defaultSkills.map((skill, skillIdx) => {
            const studentMastery: Record<string, number> = {};
            let totalCorrect = 0;
            let totalPossible = 0;

            // Assign roughly 1/4 of questions to each skill for demo
            const questionsForSkill = currentGabarito.respostas.map((_, i) => i)
              .filter(i => i % defaultSkills.length === skillIdx);

            students.forEach(student => {
              let correctCount = 0;
              questionsForSkill.forEach(qIdx => {
                if (student.respostas && 
                    student.respostas[qIdx] !== undefined && 
                    student.respostas[qIdx] === currentGabarito.respostas[qIdx]) {
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
        }

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

  // Calculate overall student performance for this assessment
  const studentStats = useMemo(() => {
    if (alunos.length === 0 || skillsMastery.length === 0) return [];
    
    return alunos.map(aluno => {
      let totalMastery = 0;
      skillsMastery.forEach(skill => {
        totalMastery += skill.studentMastery[aluno.id] || 0;
      });
      const average = totalMastery / skillsMastery.length;
      return {
        id: aluno.id,
        nome: aluno.nome,
        average: Math.round(average),
        status: average < 50 ? 'Crítico' : average < 70 ? 'Básico' : average < 85 ? 'Adequado' : 'Avançado'
      };
    }).sort((a, b) => b.average - a.average);
  }, [alunos, skillsMastery]);

  const assessmentAverage = useMemo(() => {
    if (skillsMastery.length === 0) return 0;
    const sum = skillsMastery.reduce((acc, s) => acc + s.mastery, 0);
    return Math.round(sum / skillsMastery.length);
  }, [skillsMastery]);

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

      // --- 3. Student Performance Summary ---
      if (pdfOptions.performance) {
        if (currentY > pageHeight - 40) {
          pdf.addPage();
          currentY = 20;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(15, 44, 89);
        pdf.text('3. Desempenho por Aluno', margin, currentY);

        const studentRows = studentStats.map(s => [
          s.nome,
          `${s.average}%`,
          s.status
        ]);

        autoTable(pdf, {
          startY: currentY + 5,
          head: [['Aluno', 'Domínio Médio', 'Status']],
          body: studentRows,
          theme: 'striped',
          styles: { fontSize: 9 },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 'auto' },
            1: { halign: 'center', fontStyle: 'bold', cellWidth: 30 },
            2: { halign: 'center', fontStyle: 'bold', cellWidth: 30 }
          },
          margin: { left: margin, right: margin }
        });

        currentY = (pdf as any).lastAutoTable.finalY + 15;
      }

      // --- 4. Pedagogical Actions ---
      if (pdfOptions.pedagogicalActions) {
        if (currentY > pageHeight - 60) {
          pdf.addPage();
          currentY = 20;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(15, 44, 89);
        pdf.text('4. Recomendações Pedagógicas', margin, currentY);
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
          
          {selectedGabaritoId && (
            <div className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded border text-[10px] font-bold uppercase tracking-wider",
              (() => {
                const gab = gabaritos.find(g => g.id === selectedGabaritoId);
                return Array.isArray(gab?.competencias) && gab.competencias.some(c => c && typeof c === 'string' && c.trim() !== '');
              })()
                ? "bg-green-50 border-green-200 text-[#059669]" 
                : "bg-amber-50 border-amber-200 text-[#D97706]"
            )}>
              <CheckCircle2 className="w-3 h-3" />
              {(() => {
                const gab = gabaritos.find(g => g.id === selectedGabaritoId);
                return Array.isArray(gab?.competencias) && gab.competencias.some(c => c && typeof c === 'string' && c.trim() !== '');
              })()
                ? "Mapeamento BNCC Ativo" 
                : "Mapeamento Padrão (Demo)"}
            </div>
          )}
          
          <div className="ml-auto flex items-center gap-4 text-[10px] font-bold text-[#64748B] bg-white px-3 py-2 border border-[#E2E8F0] rounded shadow-sm uppercase tracking-wider">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#DC2626] rounded-sm"></div> Crítico &lt;50%</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#D97706] rounded-sm"></div> Básico 50-70%</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#059669] rounded-sm"></div> Adequado 70-85%</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#0066CC] rounded-sm"></div> Avançado &gt;85%</div>
          </div>
        </div>

        {/* View Tabs */}
        {selectedGabaritoId && (
          <div className="flex gap-1 mt-6 border-b border-[#E2E8F0]">
            <button 
              onClick={() => setViewMode('heatmap')}
              className={clsx(
                "px-6 py-2.5 text-sm font-bold flex items-center gap-2 transition-all border-b-2",
                viewMode === 'heatmap' 
                  ? "border-[#0F2C59] text-[#0F2C59] bg-blue-50/50" 
                  : "border-transparent text-[#64748B] hover:text-[#1A202C] hover:bg-gray-50"
              )}
            >
              <Grid className="w-4 h-4" />
              Mapa de Calor (Matriz)
            </button>
            <button 
              onClick={() => setViewMode('overview')}
              className={clsx(
                "px-6 py-2.5 text-sm font-bold flex items-center gap-2 transition-all border-b-2",
                viewMode === 'overview' 
                  ? "border-[#0F2C59] text-[#0F2C59] bg-blue-50/50" 
                  : "border-transparent text-[#64748B] hover:text-[#1A202C] hover:bg-gray-50"
              )}
            >
              <BarChart2 className="w-4 h-4" />
              Visão Geral (Gráficos)
            </button>
          </div>
        )}
      </div>

      {/* Heatmap Content Area */}
      <div className="flex-1 overflow-auto p-6 bg-[#F4F6F8] flex flex-col">
        {selectedGabaritoId ? (
          <div className="flex flex-1 min-h-0 gap-6">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 gap-6">
              {/* Summary Cards (Only in Overview or at top) */}
              {viewMode === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                  <div className="bg-white p-5 rounded border border-[#E2E8F0] shadow-sm">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1">Média da Avaliação</p>
                    <div className="flex items-baseline gap-2">
                      <span className={clsx("text-3xl font-bold", 
                        assessmentAverage < 50 ? "text-[#DC2626]" : 
                        assessmentAverage < 70 ? "text-[#D97706]" : 
                        assessmentAverage < 85 ? "text-[#059669]" : "text-[#0066CC]"
                      )}>{assessmentAverage}%</span>
                      <span className="text-xs text-[#64748B] font-medium">Domínio Geral</span>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded border border-[#E2E8F0] shadow-sm">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1">Alunos Analisados</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-[#1A202C]">{alunos.length}</span>
                      <span className="text-xs text-[#64748B] font-medium">Estudantes</span>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded border border-[#E2E8F0] shadow-sm">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1">Habilidades BNCC</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-[#1A202C]">{skillsMastery.length}</span>
                      <span className="text-xs text-[#64748B] font-medium">Mapeadas</span>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'heatmap' ? (
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
                          <div className="p-12 text-center flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                              <Info className="w-6 h-6 text-[#64748B]" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#1A202C]">Nenhum dado pedagógico encontrado</p>
                              <p className="text-xs text-[#64748B] mt-1 max-w-xs mx-auto">
                                Certifique-se de que os alunos já realizaram esta avaliação e que as respostas foram lançadas no <strong>Módulo de Correção</strong>.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-6 flex-1">
                  {/* Charts Row */}
                  <div className="bg-white border border-[#E2E8F0] rounded shadow-sm p-6 flex flex-col h-[400px]">
                    <h3 className="text-sm font-bold text-[#1A202C] uppercase tracking-widest mb-6 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#0F2C59]" /> Domínio por Habilidade (Turma)
                    </h3>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <ReBarChart data={skillsMastery} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis dataKey="id" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                          <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                          <ReTooltip 
                            cursor={{ fill: '#F8FAFC' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="mastery" radius={[4, 4, 0, 0]} barSize={40}>
                            {skillsMastery.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={
                                entry.mastery < 50 ? '#DC2626' : 
                                entry.mastery < 70 ? '#D97706' : 
                                entry.mastery < 85 ? '#059669' : '#0066CC'
                              } />
                            ))}
                          </Bar>
                        </ReBarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Student Ranking Table */}
                  <div className="bg-white border border-[#E2E8F0] rounded shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-[#E2E8F0] bg-gray-50">
                      <h3 className="text-sm font-bold text-[#1A202C] uppercase tracking-widest flex items-center gap-2">
                        <User className="w-4 h-4 text-[#0F2C59]" /> Desempenho por Aluno
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#E2E8F0]">
                            <th className="px-6 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Aluno</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider text-center">Domínio Médio</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                          {studentStats.map((student) => (
                            <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-sm font-bold text-[#1A202C]">{student.nome}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-3">
                                  <div className="w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className={clsx("h-full", 
                                        student.average < 50 ? "bg-[#DC2626]" : 
                                        student.average < 70 ? "bg-[#D97706]" : 
                                        student.average < 85 ? "bg-[#059669]" : "bg-[#0066CC]"
                                      )}
                                      style={{ width: `${student.average}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-bold text-[#1A202C] w-8">{student.average}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className={clsx(
                                  "px-2 py-1 rounded text-[10px] font-bold uppercase border",
                                  student.average < 50 ? "bg-red-50 text-[#DC2626] border-red-100" : 
                                  student.average < 70 ? "bg-amber-50 text-[#D97706] border-amber-100" : 
                                  student.average < 85 ? "bg-green-50 text-[#059669] border-green-100" : "bg-blue-50 text-[#0066CC] border-blue-100"
                                )}>
                                  {student.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible Right Panel (Skill Legend) */}
            {selectedSkillId && selectedSkill && (
              <div className="w-80 bg-white border border-[#E2E8F0] rounded shadow-sm flex flex-col shrink-0 overflow-hidden sticky top-6 h-fit max-h-[calc(100vh-200px)]">
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

                  {/* Students needing attention */}
                  <div className="mt-8 border-t border-[#E2E8F0] pt-5">
                    <h4 className="text-xs font-bold text-[#DC2626] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3" /> Alunos com Dificuldade
                    </h4>
                    <div className="space-y-2">
                      {alunos.filter(a => (selectedSkill.studentMastery[a.id] || 0) < 50).length > 0 ? (
                        alunos.filter(a => (selectedSkill.studentMastery[a.id] || 0) < 50).map(a => (
                          <div key={a.id} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-100">
                            <span className="text-xs font-medium text-[#DC2626] truncate max-w-[120px]">{a.nome}</span>
                            <span className="text-[10px] font-bold text-[#DC2626]">{Math.round(selectedSkill.studentMastery[a.id] || 0)}%</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-[#64748B] italic">Nenhum aluno no nível crítico para esta habilidade.</p>
                      )}
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
