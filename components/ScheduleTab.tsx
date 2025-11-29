import React, { useState } from 'react';
import { AppState, DAYS_OF_WEEK } from '../types';

interface ScheduleTabProps {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ state, updateState }) => {
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [editingSlot, setEditingSlot] = useState<{ day: string; index: number } | null>(null);

  const currentSchedule = selectedClass ? state.horarios[selectedClass] : null;

  const handleUpdateSlot = (prof: string, disc: string) => {
    if (!selectedClass || !editingSlot || !currentSchedule) return;
    
    const { day, index } = editingSlot;
    const newSchedule = { ...state.horarios };
    const daySchedule = [...newSchedule[selectedClass][day]];
    
    if (prof === "") {
        daySchedule[index] = null;
    } else {
        daySchedule[index] = { p: prof, d: disc };
    }
    
    newSchedule[selectedClass] = {
        ...newSchedule[selectedClass],
        [day]: daySchedule
    };

    updateState({ horarios: newSchedule });
    setEditingSlot(null);
  };

  const addTimeSlot = () => {
      if(!selectedClass) return;
      const newSchedule = { ...state.horarios };
      DAYS_OF_WEEK.forEach(d => {
          newSchedule[selectedClass][d].push(null);
      });
      updateState({ horarios: newSchedule });
  };

  const removeTimeSlot = () => {
      if(!selectedClass) return;
      const newSchedule = { ...state.horarios };
      DAYS_OF_WEEK.forEach(d => {
          if(newSchedule[selectedClass][d].length > 0)
            newSchedule[selectedClass][d].pop();
      });
      updateState({ horarios: newSchedule });
  };

  return (
    <div>
      <div className="flex gap-4 mb-6 items-center flex-wrap">
        <select 
          className="border p-2 rounded text-lg bg-white shadow-sm"
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
        >
          <option value="">Selecione uma Turma para editar</option>
          {Object.keys(state.horarios).sort().map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        
        {selectedClass && (
            <div className="flex gap-2">
                <button onClick={addTimeSlot} className="bg-indigo-100 text-indigo-700 px-3 py-2 rounded text-sm font-bold hover:bg-indigo-200">+ Tempo</button>
                <button onClick={removeTimeSlot} className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm font-bold hover:bg-red-200">- Tempo</button>
            </div>
        )}
      </div>

      {currentSchedule && (
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
          <table className="w-full text-center table-fixed min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="w-16 p-3 text-gray-500 text-xs font-bold uppercase tracking-wider">#</th>
                {DAYS_OF_WEEK.map(d => (
                  <th key={d} className="p-3 text-gray-600 text-xs font-bold uppercase tracking-wider border-l">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentSchedule[DAYS_OF_WEEK[0]].map((_, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="font-bold text-gray-400 text-sm border-r">{idx + 1}º</td>
                  {DAYS_OF_WEEK.map(day => {
                    const slot = currentSchedule[day][idx];
                    const profMeta = slot ? state.professoresMetaData[slot.p] : null;
                    const bgColor = profMeta?.color || 'transparent';
                    
                    return (
                      <td 
                        key={`${day}-${idx}`} 
                        className="border-l p-1 h-20 cursor-pointer transition hover:brightness-95 relative group"
                        style={{ backgroundColor: slot ? bgColor : '' }}
                        onClick={() => setEditingSlot({ day, index: idx })}
                      >
                        {slot ? (
                          <div className="flex flex-col justify-center h-full text-xs">
                            <span className="font-bold text-gray-800 leading-tight">{slot.d}</span>
                            <span className="text-gray-600 truncate">{slot.p}</span>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-300 group-hover:text-gray-400">
                            +
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for editing slot */}
      {editingSlot && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">Editar {editingSlot.day} - {editingSlot.index + 1}º Tempo</h3>
            
            <form onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                handleUpdateSlot(form.prof.value, form.disc.value);
            }}>
                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Disciplina</label>
                    <select name="disc" className="w-full border p-2 rounded" defaultValue={currentSchedule![editingSlot.day][editingSlot.index]?.d || ""}>
                        <option value="">-- Vazio --</option>
                        {state.disciplinas.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Professor</label>
                    <select name="prof" className="w-full border p-2 rounded" defaultValue={currentSchedule![editingSlot.day][editingSlot.index]?.p || ""}>
                         <option value="">-- Vazio --</option>
                         {Object.keys(state.professores).sort().map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingSlot(null)} className="px-4 py-2 text-gray-600 font-medium">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700">Salvar</button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
