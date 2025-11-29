import React, { useState } from 'react';
import { AppState, DailySchedule, SpecialActivitySchedule, DAYS_OF_WEEK } from '../types';

interface ResourcesTabProps {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

type EditType = 'professor' | 'disciplina' | 'turma';

interface EditModalState {
  isOpen: boolean;
  type: EditType | null;
  originalName: string;
  newName: string;
  extraField?: string; // Para o turno da turma
}

interface ActivityScheduleModalState {
  isOpen: boolean;
  profName: string;
  type: 'pca' | 'ape';
  schedule: SpecialActivitySchedule;
}

const EMPTY_ACTIVITY_SCHEDULE: SpecialActivitySchedule = {
  "Segunda-feira": Array(9).fill(false),
  "Terça-feira": Array(9).fill(false),
  "Quarta-feira": Array(9).fill(false),
  "Quinta-feira": Array(9).fill(false),
  "Sexta-feira": Array(9).fill(false)
};

export const ResourcesTab: React.FC<ResourcesTabProps> = ({ state, updateState }) => {
  // Input states for adding new items
  const [newProfName, setNewProfName] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [newClassTurno, setNewClassTurno] = useState<'Manhã'|'Tarde'|'Noite'|'Integral'>("Manhã");
  const [newSubject, setNewSubject] = useState("");

  // Generic Edit Modal State
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    type: null,
    originalName: "",
    newName: "",
  });

  // Activity Schedule Modal State
  const [actModal, setActModal] = useState<ActivityScheduleModalState>({
    isOpen: false,
    profName: "",
    type: 'pca',
    schedule: EMPTY_ACTIVITY_SCHEDULE
  });

  // --- HELPER: Update References in Schedule ---
  const updateScheduleReferences = (type: 'p' | 'd', oldName: string, newName: string, currentHorarios: AppState['horarios']) => {
    const newHorarios = { ...currentHorarios };
    
    Object.keys(newHorarios).forEach(turmaKey => {
      const schedule = { ...newHorarios[turmaKey] };
      let hasChanges = false;

      Object.keys(schedule).forEach(dayKey => {
        const slots = schedule[dayKey] as DailySchedule;
        if (Array.isArray(slots)) {
          const newSlots = slots.map(slot => {
            if (!slot) return null;
            if (type === 'p' && slot.p === oldName) return { ...slot, p: newName };
            if (type === 'd' && slot.d === oldName) return { ...slot, d: newName };
            return slot;
          });
          
          if (JSON.stringify(newSlots) !== JSON.stringify(slots)) {
            schedule[dayKey] = newSlots;
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        newHorarios[turmaKey] = schedule;
      }
    });

    return newHorarios;
  };

  // --- PROFESSORS LOGIC ---

  const addProfessor = () => {
    const trimmed = newProfName.trim();
    if (!trimmed || state.professores[trimmed]) return;
    updateState({
      professores: { ...state.professores, [trimmed]: [] },
      professoresMetaData: { 
        ...state.professoresMetaData, 
        [trimmed]: { color: '#e0e7ff', pca: false, ape: false } 
      }
    });
    setNewProfName("");
  };

  const deleteProfessor = (name: string) => {
    if (!confirm(`Excluir professor(a) ${name}? Isso removerá o nome das grades de horário.`)) return;
    
    const newProfs = { ...state.professores };
    delete newProfs[name];
    
    const newMeta = { ...state.professoresMetaData };
    delete newMeta[name];

    const newHorarios = { ...state.horarios };
    Object.keys(newHorarios).forEach(t => {
       Object.keys(newHorarios[t]).forEach(d => {
           newHorarios[t][d] = newHorarios[t][d].map(slot => {
               if(slot && slot.p === name) return { ...slot, p: "" }; 
               return slot;
           });
       });
    });

    updateState({ 
        professores: newProfs,
        professoresMetaData: newMeta,
        horarios: newHorarios
    });
  };

  const openEditProfessor = (name: string) => {
    setEditModal({
      isOpen: true,
      type: 'professor',
      originalName: name,
      newName: name
    });
  };

  const updateProfMeta = (name: string, field: 'color'|'pca'|'ape', val: any) => {
    updateState({
      professoresMetaData: {
        ...state.professoresMetaData,
        [name]: { ...state.professoresMetaData[name], [field]: val }
      }
    });
  };

  // --- ACTIVITY SCHEDULE LOGIC ---

  const openActivitySchedule = (profName: string, type: 'pca' | 'ape') => {
    const meta = state.professoresMetaData[profName];
    // Load existing or default empty
    const existing = type === 'pca' ? meta.horarioPCA : meta.horarioAPE;
    
    setActModal({
      isOpen: true,
      profName,
      type,
      schedule: existing ? { ...existing } : JSON.parse(JSON.stringify(EMPTY_ACTIVITY_SCHEDULE))
    });
  };

  const toggleActivitySlot = (day: string, index: number) => {
    const newSchedule = { ...actModal.schedule };
    newSchedule[day] = [...newSchedule[day]];
    newSchedule[day][index] = !newSchedule[day][index];
    setActModal({ ...actModal, schedule: newSchedule });
  };

  const saveActivitySchedule = () => {
    const { profName, type, schedule } = actModal;
    const field = type === 'pca' ? 'horarioPCA' : 'horarioAPE';
    
    updateState({
      professoresMetaData: {
        ...state.professoresMetaData,
        [profName]: { ...state.professoresMetaData[profName], [field]: schedule }
      }
    });
    setActModal({ ...actModal, isOpen: false });
  };


  // --- SUBJECTS LOGIC ---

  const addSubject = () => {
    const trimmed = newSubject.trim();
    if (!trimmed || state.disciplinas.includes(trimmed)) return;
    updateState({ disciplinas: [...state.disciplinas, trimmed].sort() });
    setNewSubject("");
  };
  
  const deleteSubject = (name: string) => {
    if (!confirm(`Excluir disciplina ${name}?`)) return;
    
    const newD = state.disciplinas.filter(d => d !== name);
    
    const newHorarios = { ...state.horarios };
    Object.keys(newHorarios).forEach(t => {
       Object.keys(newHorarios[t]).forEach(d => {
           newHorarios[t][d] = newHorarios[t][d].map(slot => {
               if(slot && slot.d === name) return null;
               return slot;
           });
       });
    });

    updateState({ disciplinas: newD, horarios: newHorarios });
  };

  const openEditSubject = (name: string) => {
    setEditModal({
      isOpen: true,
      type: 'disciplina',
      originalName: name,
      newName: name
    });
  };

  // --- CLASSES LOGIC ---

  const addClass = () => {
    const trimmed = newClassName.trim();
    if (!trimmed || state.horarios[trimmed]) return;
    const emptyWeek = {
      "Segunda-feira": Array(9).fill(null),
      "Terça-feira": Array(9).fill(null),
      "Quarta-feira": Array(9).fill(null),
      "Quinta-feira": Array(9).fill(null),
      "Sexta-feira": Array(9).fill(null)
    };
    updateState({
      horarios: { ...state.horarios, [trimmed]: emptyWeek },
      turmasMetaData: { ...state.turmasMetaData, [trimmed]: { turno: newClassTurno } }
    });
    setNewClassName("");
  };

  const deleteClass = (name: string) => {
    if (!confirm(`Excluir turma ${name} e toda sua grade de horários?`)) return;
    const newH = { ...state.horarios };
    delete newH[name];
    
    const newMeta = { ...state.turmasMetaData };
    delete newMeta[name];
    
    updateState({ horarios: newH, turmasMetaData: newMeta });
  };

  const openEditClass = (name: string) => {
    const currentTurno = state.turmasMetaData[name]?.turno || 'Manhã';
    setEditModal({
      isOpen: true,
      type: 'turma',
      originalName: name,
      newName: name,
      extraField: currentTurno
    });
  };

  // --- SAVE EDIT LOGIC ---

  const handleSaveEdit = () => {
    const { type, originalName, newName, extraField } = editModal;
    const trimmedNew = newName.trim();

    if (!trimmedNew) return;

    if (type === 'professor') {
        if (trimmedNew !== originalName && state.professores[trimmedNew]) {
            alert("Já existe um professor com este nome.");
            return;
        }
        const newProfs = { ...state.professores };
        newProfs[trimmedNew] = newProfs[originalName];
        if (trimmedNew !== originalName) delete newProfs[originalName];

        const newMeta = { ...state.professoresMetaData };
        newMeta[trimmedNew] = newMeta[originalName];
        if (trimmedNew !== originalName) delete newMeta[originalName];

        let newHorarios = state.horarios;
        if (trimmedNew !== originalName) {
            newHorarios = updateScheduleReferences('p', originalName, trimmedNew, state.horarios);
        }

        updateState({ 
            professores: newProfs, 
            professoresMetaData: newMeta, 
            horarios: newHorarios 
        });

    } else if (type === 'disciplina') {
        if (trimmedNew !== originalName && state.disciplinas.includes(trimmedNew)) {
            alert("Já existe uma disciplina com este nome.");
            return;
        }
        const newDiscs = state.disciplinas.map(d => d === originalName ? trimmedNew : d).sort();
        let newHorarios = state.horarios;
        if (trimmedNew !== originalName) {
            newHorarios = updateScheduleReferences('d', originalName, trimmedNew, state.horarios);
        }
        updateState({ disciplinas: newDiscs, horarios: newHorarios });

    } else if (type === 'turma') {
        if (trimmedNew !== originalName && state.horarios[trimmedNew]) {
             alert("Já existe uma turma com este nome.");
             return;
        }
        const newHorarios = { ...state.horarios };
        const newMeta = { ...state.turmasMetaData };

        if (trimmedNew !== originalName) {
            newHorarios[trimmedNew] = newHorarios[originalName];
            delete newHorarios[originalName];
        }
        if (trimmedNew !== originalName) delete newMeta[originalName];
        newMeta[trimmedNew] = { turno: extraField as any };

        updateState({ horarios: newHorarios, turmasMetaData: newMeta });
    }

    setEditModal({ isOpen: false, type: null, originalName: "", newName: "" });
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Column 1: Professors & Subjects */}
      <div className="space-y-6">
        
        {/* PROFESSORES */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="font-bold text-lg mb-4 text-gray-800">Professores</h3>
          <div className="flex gap-2 mb-4">
            <input 
              className="border p-2 rounded flex-grow text-sm" 
              placeholder="Nome do Professor"
              value={newProfName}
              onChange={e => setNewProfName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addProfessor()}
            />
            <button onClick={addProfessor} className="bg-green-600 hover:bg-green-700 text-white px-4 rounded text-sm font-bold">Add</button>
          </div>
          <ul className="divide-y max-h-80 overflow-y-auto">
            {Object.keys(state.professores).sort().map(p => (
              <li key={p} className="py-2 flex justify-between items-center text-sm group hover:bg-gray-50 px-1 rounded">
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={state.professoresMetaData[p]?.color || '#ffffff'}
                    onChange={e => updateProfMeta(p, 'color', e.target.value)}
                    className="w-6 h-6 p-0 border-0 rounded-full overflow-hidden cursor-pointer"
                    title="Cor na grade"
                  />
                  <span className="font-medium text-gray-700">{p}</span>
                </div>
                <div className="flex items-center gap-2">
                   {/* PCA Toggle & Config */}
                   <div className="flex items-center border rounded bg-white overflow-hidden">
                      <button 
                        onClick={() => updateProfMeta(p, 'pca', !state.professoresMetaData[p]?.pca)}
                        className={`px-2 py-0.5 text-[10px] font-bold transition ${state.professoresMetaData[p]?.pca ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
                      >PCA</button>
                      {state.professoresMetaData[p]?.pca && (
                        <button 
                           onClick={() => openActivitySchedule(p, 'pca')}
                           className="px-1 py-0.5 border-l hover:bg-blue-50 text-blue-500 text-[10px]" 
                           title="Configurar Horário PCA"
                        >🕒</button>
                      )}
                   </div>

                   {/* APE Toggle & Config */}
                   <div className="flex items-center border rounded bg-white overflow-hidden">
                      <button 
                        onClick={() => updateProfMeta(p, 'ape', !state.professoresMetaData[p]?.ape)}
                        className={`px-2 py-0.5 text-[10px] font-bold transition ${state.professoresMetaData[p]?.ape ? 'bg-purple-100 text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}
                      >APE</button>
                      {state.professoresMetaData[p]?.ape && (
                        <button 
                           onClick={() => openActivitySchedule(p, 'ape')}
                           className="px-1 py-0.5 border-l hover:bg-purple-50 text-purple-500 text-[10px]" 
                           title="Configurar Horário APE"
                        >🕒</button>
                      )}
                   </div>
                   
                   <div className="flex gap-1 ml-2 border-l pl-2">
                      <button onClick={() => openEditProfessor(p)} className="text-blue-500 hover:text-blue-700 p-1" title="Editar">✎</button>
                      <button onClick={() => deleteProfessor(p)} className="text-red-500 hover:text-red-700 p-1" title="Excluir">✕</button>
                   </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* DISCIPLINAS */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="font-bold text-lg mb-4 text-gray-800">Disciplinas</h3>
          <div className="flex gap-2 mb-4">
            <input 
              className="border p-2 rounded flex-grow text-sm" 
              placeholder="Nova Disciplina"
              value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSubject()}
            />
            <button onClick={addSubject} className="bg-green-600 hover:bg-green-700 text-white px-4 rounded text-sm font-bold">Add</button>
          </div>
          <ul className="divide-y max-h-40 overflow-y-auto">
            {state.disciplinas.map((d, i) => (
              <li key={i} className="py-2 flex justify-between text-sm group hover:bg-gray-50 px-1 rounded">
                <span className="text-gray-700">{d}</span>
                <div className="flex gap-1">
                    <button onClick={() => openEditSubject(d)} className="text-blue-500 hover:text-blue-700 p-1" title="Editar">✎</button>
                    <button onClick={() => deleteSubject(d)} className="text-red-500 hover:text-red-700 p-1" title="Excluir">✕</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Column 2: Classes */}
      <div className="bg-white p-6 rounded-lg shadow-sm border h-fit">
        <h3 className="font-bold text-lg mb-4 text-gray-800">Turmas</h3>
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input 
            className="border p-2 rounded flex-grow text-sm min-w-[150px]" 
            placeholder="Nome da Turma"
            value={newClassName}
            onChange={e => setNewClassName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addClass()}
          />
          <select 
            value={newClassTurno} 
            onChange={e => setNewClassTurno(e.target.value as any)}
            className="border p-2 rounded text-sm bg-white"
          >
            <option value="Manhã">Manhã</option>
            <option value="Tarde">Tarde</option>
            <option value="Noite">Noite</option>
            <option value="Integral">Integral</option>
          </select>
          <button onClick={addClass} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-bold">Criar</button>
        </div>
        <ul className="divide-y max-h-[500px] overflow-y-auto">
          {Object.keys(state.horarios).sort().map(t => (
             <li key={t} className="py-3 flex justify-between items-center text-sm group hover:bg-gray-50 px-2 rounded">
               <div>
                 <span className="font-bold block text-gray-800">{t}</span>
                 <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                   {state.turmasMetaData[t]?.turno}
                 </span>
               </div>
               <div className="flex gap-2">
                  <button onClick={() => openEditClass(t)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded" title="Editar">✎</button>
                  <button onClick={() => deleteClass(t)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded" title="Excluir">✕</button>
               </div>
             </li>
          ))}
        </ul>
      </div>

      {/* EDIT MODAL */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                <div className="bg-gray-100 px-4 py-3 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 capitalize">Editar {editModal.type}</h3>
                    <button onClick={() => setEditModal({...editModal, isOpen: false})} className="text-gray-500 hover:text-gray-800 text-xl">&times;</button>
                </div>
                
                <div className="p-6">
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Nome</label>
                        <input 
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-200 outline-none"
                            value={editModal.newName}
                            onChange={(e) => setEditModal({ ...editModal, newName: e.target.value })}
                            autoFocus
                        />
                    </div>

                    {editModal.type === 'turma' && (
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Turno</label>
                            <select 
                                className="w-full border p-2 rounded bg-white"
                                value={editModal.extraField}
                                onChange={(e) => setEditModal({ ...editModal, extraField: e.target.value })}
                            >
                                <option value="Manhã">Manhã</option>
                                <option value="Tarde">Tarde</option>
                                <option value="Noite">Noite</option>
                                <option value="Integral">Integral</option>
                            </select>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 mt-6">
                        <button 
                            onClick={() => setEditModal({...editModal, isOpen: false})} 
                            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSaveEdit} 
                            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700"
                        >
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* ACTIVITY SCHEDULE MODAL */}
      {actModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
             <div className="bg-gray-100 px-6 py-4 border-b flex justify-between items-center">
                 <div>
                    <h3 className="font-bold text-lg text-gray-800">Horário {actModal.type.toUpperCase()}</h3>
                    <p className="text-xs text-gray-500 font-medium">Professor: {actModal.profName}</p>
                 </div>
                 <button onClick={() => setActModal({...actModal, isOpen: false})} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
             </div>
             
             <div className="p-6 overflow-y-auto">
                <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-2 rounded border border-blue-100">
                   Selecione os tempos da semana dedicados a esta atividade.
                </p>

                <div className="grid grid-cols-6 gap-2 text-center text-xs font-bold text-gray-600 uppercase mb-2">
                   <div className="py-2">#</div>
                   <div>Seg</div>
                   <div>Ter</div>
                   <div>Qua</div>
                   <div>Qui</div>
                   <div>Sex</div>
                </div>

                {Array.from({ length: 9 }).map((_, index) => (
                   <div key={index} className="grid grid-cols-6 gap-2 items-center mb-1">
                      <div className="text-xs font-bold text-gray-400 text-center">{index + 1}º</div>
                      {DAYS_OF_WEEK.map(day => (
                         <button 
                           key={day}
                           onClick={() => toggleActivitySlot(day, index)}
                           className={`h-8 rounded border transition ${
                             actModal.schedule[day][index] 
                               ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' 
                               : 'bg-white border-gray-200 hover:bg-gray-50'
                           }`}
                         >
                           {actModal.schedule[day][index] && '✓'}
                         </button>
                      ))}
                   </div>
                ))}
             </div>

             <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                 <button onClick={() => setActModal({...actModal, isOpen: false})} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded">Cancelar</button>
                 <button onClick={saveActivitySchedule} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 shadow-sm">Salvar Horário</button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};