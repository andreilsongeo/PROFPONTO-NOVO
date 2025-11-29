
import React, { useState, useEffect } from 'react';
import { AppState, DailySchedule } from '../types';
import { 
  generateTimesheetPDF, 
  generateCompleteBookPDF,
  generateClassSchedulePDF, 
  generateTeacherSchedulePDF,
  generateSaturdaysPDF,
  generateCalendarExtractPDF,
  generateAnnualCalendarPDF,
  generateActivityPDF,
  generateDashboardPDF,
  generateClassDisciplineExtractPDF
} from '../services/pdfService';

interface ReportsTabProps {
  state: AppState;
}

type ReportType = 'timesheet' | 'activities' | 'schedules' | 'general' | 'dashboard';

export const ReportsTab: React.FC<ReportsTabProps> = ({ state }) => {
  const [category, setCategory] = useState<ReportType>('timesheet');
  const [timesheetMode, setTimesheetMode] = useState<'individual' | 'complete'>('individual');
  const [scheduleType, setScheduleType] = useState<'teacher' | 'class'>('teacher');
  const [generalType, setGeneralType] = useState<'saturdays' | 'calendar_extract' | 'annual_calendar' | 'discipline_extract'>('annual_calendar');
  const [activityType, setActivityType] = useState<'pca' | 'ape'>('pca');

  const [selectedProf, setSelectedProf] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDisc, setSelectedDisc] = useState("");

  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableDiscs, setAvailableDiscs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (category === 'schedules' && scheduleType === 'class') {
        setAvailableClasses(Object.keys(state.horarios).sort());
        return;
    }
    if (category === 'general' && generalType === 'discipline_extract') {
        setAvailableClasses(Object.keys(state.horarios).sort());
        return;
    }

    if (!selectedProf) {
      setAvailableClasses([]);
      return;
    }

    const tSet = new Set<string>();
    Object.entries(state.horarios).forEach(([t, schedule]) => {
       Object.values(schedule).forEach((dayArr) => {
           const slots = dayArr as DailySchedule;
           if (Array.isArray(slots)) {
             slots.forEach(slot => {
                 if(slot && slot.p === selectedProf) tSet.add(t);
             });
           }
       });
    });
    setAvailableClasses(Array.from(tSet).sort());
    if(category === 'timesheet') setSelectedClass("");
  }, [selectedProf, state.horarios, category, scheduleType, generalType]);

  useEffect(() => {
      if (!selectedClass) { setAvailableDiscs([]); return; }
      
      const dSet = new Set<string>();
      const schedule = state.horarios[selectedClass];
      if (schedule) {
        Object.values(schedule).forEach((dayArr) => {
            const slots = dayArr as DailySchedule;
            if (Array.isArray(slots)) {
              slots.forEach(slot => {
                  if (slot) {
                      if (generalType === 'discipline_extract' && category === 'general') {
                          dSet.add(slot.d);
                      }
                      else if (slot.p === selectedProf) {
                          dSet.add(slot.d);
                      }
                  }
              });
            }
        });
      }
      setAvailableDiscs(Array.from(dSet).sort());
      if(category === 'timesheet' || category === 'general') setSelectedDisc("");
  }, [selectedClass, selectedProf, state.horarios, category, generalType]);

  const handleGenerate = () => {
      setLoading(true);
      // Removido setTimeout para evitar bloqueio de popup pelo navegador
      // O React pode não renderizar o 'Gerando...' imediatamente antes de travar a thread na geração do PDF,
      // mas garante que a janela abra.
      try {
        let url: string | null = null;
        if (category === 'timesheet') {
            if (timesheetMode === 'complete') url = generateCompleteBookPDF(state);
            else if (selectedProf && selectedClass && selectedDisc) url = generateTimesheetPDF(state, selectedProf, selectedClass, selectedDisc);
        } 
        else if (category === 'activities') {
            if (selectedProf) url = generateActivityPDF(state, selectedProf, activityType);
        }
        else if (category === 'schedules') {
            if (scheduleType === 'teacher' && selectedProf) url = generateTeacherSchedulePDF(state, selectedProf);
            else if (scheduleType === 'class' && selectedClass) url = generateClassSchedulePDF(state, selectedClass);
        }
        else if (category === 'general') {
            if (generalType === 'saturdays') url = generateSaturdaysPDF(state);
            if (generalType === 'calendar_extract') url = generateCalendarExtractPDF(state);
            if (generalType === 'annual_calendar') url = generateAnnualCalendarPDF(state);
            if (generalType === 'discipline_extract' && selectedClass && selectedDisc) url = generateClassDisciplineExtractPDF(state, selectedClass, selectedDisc);
        }
        else if (category === 'dashboard') {
            url = generateDashboardPDF(state);
        }

        if (url) {
            window.open(url, '_blank');
        } else {
            alert("Não foi possível gerar o relatório. Verifique os dados selecionados.");
        }
      } catch (e) {
        console.error(e);
        alert("Erro ao gerar relatório. Verifique se todos os campos estão preenchidos.");
      } finally {
        setLoading(false);
      }
  };

  const isFormValid = () => {
      if (category === 'timesheet') {
          if (timesheetMode === 'complete') return true;
          return !!selectedProf && !!selectedClass && !!selectedDisc;
      }
      if (category === 'activities') return !!selectedProf;
      if (category === 'schedules') {
          if (scheduleType === 'teacher') return !!selectedProf;
          return !!selectedClass;
      }
      if (category === 'general') {
          if (generalType === 'discipline_extract') return !!selectedClass && !!selectedDisc;
          return true;
      }
      if (category === 'dashboard') return true;
      return false;
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6 bg-gray-50 border-b">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">🖨️ Central de Relatórios</h2>
            <p className="text-gray-500 text-sm mt-1">Geração de documentos PDF padronizados (Preto e Branco).</p>
        </div>

        <div className="flex border-b text-sm font-bold text-gray-500 bg-white overflow-x-auto">
            {[
                { id: 'timesheet', label: 'Folhas de Ponto' },
                { id: 'activities', label: 'Atividades (PCA/APE)' },
                { id: 'schedules', label: 'Grades' },
                { id: 'general', label: 'Gerais' },
                { id: 'dashboard', label: '📊 Dashboard' },
            ].map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => {
                        setCategory(tab.id as any);
                        setSelectedProf(""); setSelectedClass(""); setSelectedDisc("");
                    }}
                    className={`flex-1 py-4 px-4 whitespace-nowrap hover:bg-gray-50 border-b-2 transition ${category === tab.id ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-transparent'}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>

        <div className="p-8 min-h-[300px]">
            {category === 'timesheet' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex p-1 bg-gray-100 rounded-lg mb-6">
                        <button onClick={() => setTimesheetMode('individual')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${timesheetMode === 'individual' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Individual</button>
                        <button onClick={() => setTimesheetMode('complete')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${timesheetMode === 'complete' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Livro Completo</button>
                    </div>
                    {timesheetMode === 'individual' && (
                        <div className="space-y-4">
                            <select className="w-full p-3 border rounded bg-white" value={selectedProf} onChange={e => setSelectedProf(e.target.value)}>
                                <option value="">Selecione o Professor...</option>
                                {Object.keys(state.professores).sort().map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <select className="w-full p-3 border rounded bg-white disabled:bg-gray-100" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} disabled={!selectedProf}>
                                <option value="">Selecione a Turma...</option>
                                {availableClasses.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <select className="w-full p-3 border rounded bg-white disabled:bg-gray-100" value={selectedDisc} onChange={e => setSelectedDisc(e.target.value)} disabled={!selectedClass}>
                                <option value="">Selecione a Disciplina...</option>
                                {availableDiscs.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {category === 'activities' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex gap-4 justify-center mb-6">
                        <label className="flex items-center gap-2 cursor-pointer font-bold"><input type="radio" checked={activityType === 'pca'} onChange={() => setActivityType('pca')} /> PCA</label>
                        <label className="flex items-center gap-2 cursor-pointer font-bold"><input type="radio" checked={activityType === 'ape'} onChange={() => setActivityType('ape')} /> APE</label>
                    </div>
                    <select className="w-full p-3 border rounded bg-white" value={selectedProf} onChange={e => setSelectedProf(e.target.value)}>
                        <option value="">Selecione o Professor...</option>
                        {Object.keys(state.professores).sort().map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            )}

            {category === 'schedules' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex p-1 bg-gray-100 rounded-lg mb-6">
                        <button onClick={() => setScheduleType('teacher')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${scheduleType === 'teacher' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Por Professor</button>
                        <button onClick={() => setScheduleType('class')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${scheduleType === 'class' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Por Turma</button>
                    </div>
                    {scheduleType === 'teacher' ? (
                        <select className="w-full p-3 border rounded bg-white" value={selectedProf} onChange={e => setSelectedProf(e.target.value)}>
                            <option value="">Selecione o Professor...</option>
                            {Object.keys(state.professores).sort().map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    ) : (
                        <select className="w-full p-3 border rounded bg-white" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                            <option value="">Selecione a Turma...</option>
                            {Object.keys(state.horarios).sort().map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    )}
                </div>
            )}

            {category === 'general' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <button onClick={() => setGeneralType('annual_calendar')} className={`p-3 border rounded text-sm font-bold ${generalType === 'annual_calendar' ? 'bg-indigo-50 border-indigo-500' : ''}`}>📅 Calendário Visual</button>
                        <button onClick={() => setGeneralType('calendar_extract')} className={`p-3 border rounded text-sm font-bold ${generalType === 'calendar_extract' ? 'bg-indigo-50 border-indigo-500' : ''}`}>📋 Extrato Geral</button>
                        <button onClick={() => setGeneralType('saturdays')} className={`p-3 border rounded text-sm font-bold ${generalType === 'saturdays' ? 'bg-indigo-50 border-indigo-500' : ''}`}>☀️ Sábados Letivos</button>
                        <button onClick={() => setGeneralType('discipline_extract')} className={`p-3 border rounded text-sm font-bold ${generalType === 'discipline_extract' ? 'bg-indigo-50 border-indigo-500' : ''}`}>📚 Extrato por Disciplina</button>
                    </div>
                    
                    {generalType === 'discipline_extract' && (
                        <div className="p-4 bg-gray-50 rounded border border-gray-200 space-y-3">
                            <p className="text-xs text-gray-500 font-bold">Selecione para gerar a lista de datas:</p>
                            <select className="w-full p-2 border rounded bg-white" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                                <option value="">Selecione a Turma...</option>
                                {availableClasses.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <select className="w-full p-2 border rounded bg-white disabled:bg-gray-100" value={selectedDisc} onChange={e => setSelectedDisc(e.target.value)} disabled={!selectedClass}>
                                <option value="">Selecione a Disciplina...</option>
                                {availableDiscs.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {category === 'dashboard' && (
                <div className="flex flex-col items-center justify-center h-40 text-center space-y-4 animate-fade-in">
                    <div className="text-5xl">📊</div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">Relatório Gerencial</h3>
                        <p className="text-sm text-gray-500 max-w-md">
                            Gera um arquivo PDF contendo estatísticas completas sobre professores, cargas horárias, turmas e distribuição do calendário letivo.
                        </p>
                    </div>
                </div>
            )}

            <div className="mt-8 pt-6 border-t flex justify-center">
                <button 
                    onClick={handleGenerate}
                    disabled={!isFormValid() || loading}
                    className="w-full max-w-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg transition transform active:scale-95 flex items-center justify-center gap-3 text-lg"
                >
                    {loading ? 'Gerando...' : '📄 Gerar PDF em Nova Aba'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
