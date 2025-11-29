
import React, { useState, useMemo } from 'react';
import { AppState, Bimestre } from '../types';
import { MONTH_NAMES } from '../constants';

interface CalendarTabProps {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

// --- HOLIDAY LOGIC ---
const getNationalHolidays = (year: number) => {
    const holidays: Record<string, string> = {
      [`${year}-01-01`]: 'Confraternização Universal',
      [`${year}-04-21`]: 'Tiradentes',
      [`${year}-05-01`]: 'Dia do Trabalho',
      [`${year}-09-07`]: 'Independência',
      [`${year}-10-12`]: 'N. Sra. Aparecida',
      [`${year}-11-02`]: 'Finados',
      [`${year}-11-15`]: 'Proclamação da República',
      [`${year}-11-20`]: 'Consciência Negra',
      [`${year}-12-25`]: 'Natal',
    };

    const f = Math.floor, G = year % 19;
    const C = f(year / 100), H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
    const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
    const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
    const L = I - J, Month = 3 + f((L + 40) / 44), Day = L + 28 - 31 * f(Month / 4);
    
    const easter = new Date(year, Month - 1, Day);
    
    const toStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    const addDays = (d: Date, days: number) => {
        const res = new Date(d);
        res.setDate(res.getDate() + days);
        return res;
    }

    const carnaval = addDays(easter, -47); 
    const sextaFeiraSanta = addDays(easter, -2);
    const corpusChristi = addDays(easter, 60);

    holidays[toStr(carnaval)] = 'Carnaval';
    holidays[toStr(sextaFeiraSanta)] = 'Paixão de Cristo';
    holidays[toStr(corpusChristi)] = 'Corpus Christi';

    return holidays;
};

export const CalendarTab: React.FC<CalendarTabProps> = ({ state, updateState }) => {
  const [viewDate, setViewDate] = useState(new Date()); 
  
  const [isModalOpen, setModalOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [sabadoType, setSabadoType] = useState<'letivo' | 'jornada'>('letivo');
  const [sabadoRef, setSabadoRef] = useState('Segunda-feira');

  const holidays = useMemo(() => getNationalHolidays(viewDate.getFullYear()), [viewDate.getFullYear()]);

  const changeMonth = (delta: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setViewDate(newDate);
  };

  const handleDayClick = (dateStr: string, dayOfWeek: number) => {
    if (holidays[dateStr]) {
        alert(`Não é possível marcar dia letivo em feriado nacional: ${holidays[dateStr]}`);
        return;
    }

    const isSelected = state.calendario.includes(dateStr);
    
    if (dayOfWeek === 6) {
        if (isSelected) {
            const newCal = state.calendario.filter(d => d !== dateStr);
            const newSab = { ...state.sabados };
            delete newSab[dateStr];
            updateState({ calendario: newCal, sabados: newSab });
        } else {
            setPendingDate(dateStr);
            setSabadoType('letivo');
            setSabadoRef('Segunda-feira');
            setModalOpen(true);
        }
        return;
    }

    if (isSelected) {
      const newCal = state.calendario.filter(d => d !== dateStr);
      updateState({ calendario: newCal });
    } else {
      updateState({ calendario: [...state.calendario, dateStr] });
    }
  };

  const toggleMonthWeekdays = (select: boolean) => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let newCal = [...state.calendario];
    let newSab = { ...state.sabados };

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dayOfWeek = date.getDay(); 
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        if (holidays[dateStr]) continue;

        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            if (select) {
                if (!newCal.includes(dateStr)) {
                    newCal.push(dateStr);
                }
            } else {
                newCal = newCal.filter(x => x !== dateStr);
                if (newSab[dateStr]) delete newSab[dateStr];
            }
        }
    }
    updateState({ calendario: newCal, sabados: newSab });
  };

  const confirmSabado = () => {
      if (!pendingDate) return;
      const newCal = [...state.calendario, pendingDate];
      const newSab = { ...state.sabados };
      if (sabadoType === 'jornada') newSab[pendingDate] = 'JORNADA';
      else newSab[pendingDate] = sabadoRef;
      updateState({ calendario: newCal, sabados: newSab });
      setModalOpen(false);
      setPendingDate(null);
  };

  const handlePeriodTypeChange = (newType: string) => {
      const type = newType as AppState['tipoPeriodo'];
      if (type === state.tipoPeriodo) return;

      let count = 4;
      let label = "BIMESTRE";
      switch (type) {
          case 'trimestre': count = 3; label = "TRIMESTRE"; break;
          case 'semestre': count = 2; label = "SEMESTRE"; break;
          case 'anual': count = 1; label = "ANO LETIVO"; break;
          default: count = 4; label = "BIMESTRE"; break;
      }

      const hasData = state.bimestres && state.bimestres.some(b => b.inicio || b.fim);
      if (hasData) {
          const confirmMsg = `Mudar para ${label} redefinirá as datas configuradas. Continuar?`;
          if (!window.confirm(confirmMsg)) return; 
      }

      const newPeriods = Array.from({ length: count }, (_, i) => ({
          nome: count === 1 ? label : `${i + 1}º ${label}`,
          inicio: "",
          fim: ""
      }));
      updateState({ tipoPeriodo: type, bimestres: newPeriods });
  };

  const updateBimestre = (index: number, field: keyof Bimestre, value: string) => {
    const newBimestres = [...state.bimestres];
    newBimestres[index] = { ...newBimestres[index], [field]: value };
    updateState({ bimestres: newBimestres });
  };

  const countDaysInPeriod = (start: string, end: string) => {
      if (!start || !end) return 0;
      return state.calendario.filter(dateStr => {
          if (dateStr < start || dateStr > end) return false;
          if (state.sabados[dateStr] === 'JORNADA') return false;
          return true;
      }).length;
  };

  const getGridClass = (count: number) => {
      if (count === 1) return "grid-cols-1";
      if (count === 2) return "grid-cols-1 md:grid-cols-2";
      if (count === 3) return "grid-cols-1 md:grid-cols-3";
      return "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
  };

  const annualStats = useMemo(() => {
    const counts: { [key: string]: number } = { "Segunda-feira": 0, "Terça-feira": 0, "Quarta-feira": 0, "Quinta-feira": 0, "Sexta-feira": 0 };
    let totalLetivos = 0;
    state.calendario.forEach(dateStr => {
        let dayName = state.sabados[dateStr];
        if (dayName === 'JORNADA') return;
        if (!dayName) {
            const [y, m, d] = dateStr.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            const map = ['', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', ''];
            dayName = map[date.getDay()];
        }
        if (dayName && counts[dayName] !== undefined) {
            counts[dayName]++;
            totalLetivos++;
        }
    });
    return { counts, totalLetivos };
  }, [state.calendario, state.sabados]);

  const monthlyCount = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    let count = 0;
    state.calendario.forEach(dateStr => {
        const [y, m] = dateStr.split('-').map(Number);
        if (y === year && m === (month + 1)) {
            if (state.sabados[dateStr] !== 'JORNADA') count++;
        }
    });
    return count;
  }, [state.calendario, state.sabados, viewDate]);

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 bg-gray-50/50 border border-gray-100" />);
    }

    const today = new Date();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSelected = state.calendario.includes(dateStr);
      const sabadoValue = state.sabados[dateStr];
      const isSabadoLetivo = isSelected && sabadoValue && sabadoValue !== 'JORNADA';
      const isJornada = isSelected && sabadoValue === 'JORNADA';
      const weekDay = new Date(year, month, d).getDay();
      const holidayName = holidays[dateStr];
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

      let classes = "relative h-20 p-2 border transition cursor-pointer flex flex-col items-start justify-between ";
      
      if (isSelected) {
        if (isJornada) classes += "bg-purple-100 border-purple-300 text-purple-900 hover:bg-purple-200 ";
        else if (isSabadoLetivo) classes += "bg-yellow-100 border-yellow-300 text-yellow-900 hover:bg-yellow-200 ";
        else classes += "bg-indigo-100 border-indigo-300 text-indigo-900 hover:bg-indigo-200 ";
      } else {
        if (holidayName) classes += "bg-red-50 border-red-100 cursor-not-allowed ";
        else {
            classes += "bg-white hover:bg-gray-50 text-gray-700 border-gray-100 ";
            if (weekDay === 0 || weekDay === 6) classes += "bg-gray-50 text-gray-400 ";
        }
      }

      days.push(
        <div key={dateStr} onClick={() => handleDayClick(dateStr, weekDay)} className={classes} title={holidayName ? `Feriado: ${holidayName}` : ''}>
          <div className="flex justify-between w-full">
            <span className={`font-bold text-sm ${isToday ? 'bg-indigo-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : ''} ${holidayName ? 'text-red-500' : ''}`}>
                {d}
            </span>
            {holidayName && <span className="text-[10px] font-bold text-red-500 uppercase leading-none text-right max-w-[80px]">{holidayName}</span>}
          </div>
          <div className="self-end text-xs font-medium text-right leading-tight w-full">
             {isSabadoLetivo && <span className="block text-yellow-800 opacity-90">Ref: {sabadoValue.split('-')[0]}</span>}
             {isJornada && <span className="block text-purple-800 opacity-90">Jornada Ped.</span>}
          </div>
        </div>
      );
    }
    return days;
  };

  const bimestres = state.bimestres || [];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-9 flex flex-col gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-center p-4 bg-gray-50 border-b gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded shadow-sm text-gray-600">◀</button>
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-gray-800 capitalize leading-none">{MONTH_NAMES[viewDate.getMonth()]} <span className="text-gray-500">{viewDate.getFullYear()}</span></h2>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-1 inline-block">{monthlyCount} dias letivos neste mês</span>
                        </div>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded shadow-sm text-gray-600">▶</button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => toggleMonthWeekdays(true)} className="text-xs bg-white border border-gray-300 text-gray-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300 px-3 py-1.5 rounded font-medium transition">Marcar Tudo (Seg-Sex)</button>
                        <button onClick={() => toggleMonthWeekdays(false)} className="text-xs bg-white border border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300 px-3 py-1.5 rounded font-medium transition">Desmarcar Tudo</button>
                    </div>
                </div>
                <div className="grid grid-cols-7 text-center bg-gray-100 border-b">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="py-2 text-xs font-bold text-gray-500 uppercase tracking-wide">{d}</div>)}</div>
                <div className="grid grid-cols-7 bg-gray-200 gap-px border-b border-gray-200">{renderCalendar()}</div>
                <div className="p-3 bg-gray-50 flex flex-wrap gap-4 text-xs font-medium text-gray-500 justify-center border-t">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-100 border border-indigo-300 rounded"></div> Dia Letivo</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div> Sábado Letivo</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></div> Jornada Ped.</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-50 border border-red-200 rounded"></div> Feriado</div>
                </div>
            </div>
        </div>
        <div className="lg:col-span-3 flex flex-col h-full">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full">
                <h3 className="font-bold text-gray-800 mb-6 text-lg border-b pb-2 flex justify-between items-center"><span>📊 Resumo</span></h3>
                <div className="space-y-3 mb-6">
                    {Object.entries(annualStats.counts).map(([day, count]) => (
                        <div key={day} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0"><span className="text-gray-600 font-medium">{day.split('-')[0]}</span><span className="font-bold text-indigo-700">{count}</span></div>
                    ))}
                </div>
                <div className="bg-indigo-600 p-4 rounded-lg flex flex-col items-center text-white shadow-md mt-auto">
                    <span className="text-xs font-bold opacity-90 uppercase mb-1">Dias Letivos</span>
                    <p className="text-4xl font-bold leading-none">{annualStats.totalLetivos}</p>
                </div>
            </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">📅 Períodos Letivos</h3>
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Modelo:</span>
                <select value={state.tipoPeriodo || 'bimestre'} onChange={(e) => handlePeriodTypeChange(e.target.value)} className="text-xs border border-gray-300 rounded p-1.5 bg-gray-50 focus:ring-2 focus:ring-indigo-200 outline-none font-bold text-gray-700 cursor-pointer">
                    <option value="bimestre">Bimestres (4)</option>
                    <option value="trimestre">Trimestres (3)</option>
                    <option value="semestre">Semestres (2)</option>
                    <option value="anual">Anual (1)</option>
                </select>
            </div>
          </div>
          <div className={`grid gap-4 ${getGridClass(bimestres.length)}`}>
            {bimestres.map((b, i) => {
              const daysCount = countDaysInPeriod(b.inicio, b.fim);
              return (
                <div key={`${b.nome}-${i}`} className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-indigo-300 transition shadow-sm">
                    <div className="mb-3 pb-2 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-indigo-700 text-sm uppercase tracking-wide">{b.nome}</span>
                            <span className={`text-xs font-bold ${daysCount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {daysCount > 0 ? `(${daysCount} dias)` : '(0 dias)'}
                            </span>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Data Início</label>
                            <input type="date" value={b.inicio} onChange={e => updateBimestre(i, 'inicio', e.target.value)} className="border p-2 rounded w-full text-gray-700 text-sm bg-white focus:ring-2 focus:ring-indigo-200 outline-none h-10 cursor-pointer"/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Data Fim</label>
                            <input type="date" value={b.fim} onChange={e => updateBimestre(i, 'fim', e.target.value)} className="border p-2 rounded w-full text-gray-700 text-sm bg-white focus:ring-2 focus:ring-indigo-200 outline-none h-10 cursor-pointer"/>
                        </div>
                    </div>
                </div>
              );
            })}
          </div>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="bg-gray-100 px-6 py-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">Configurar Sábado</h3>
                    <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-600 mb-4">O que este sábado ({pendingDate ? new Date(pendingDate.split('-').map(Number).join('/')).toLocaleDateString('pt-BR') : ''}) representa?</p>
                    <div className="space-y-4">
                        <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${sabadoType === 'letivo' ? 'bg-yellow-50 border-yellow-400 shadow-sm' : 'hover:bg-gray-50'}`}>
                            <input type="radio" name="sabType" checked={sabadoType === 'letivo'} onChange={() => setSabadoType('letivo')} className="mt-1 accent-yellow-600"/>
                            <div><span className="block font-bold text-gray-800">Sábado Letivo</span><span className="text-xs text-gray-500">Conta como dia letivo e segue o horário de um dia da semana específico.</span></div>
                        </label>
                        {sabadoType === 'letivo' && (
                            <div className="ml-8 p-3 bg-gray-50 rounded border animate-fade-in">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Horário referente a:</label>
                                <select className="w-full border p-2 rounded text-sm bg-white focus:ring-2 focus:ring-yellow-200 outline-none" value={sabadoRef} onChange={e => setSabadoRef(e.target.value)}>
                                    <option value="Segunda-feira">Segunda-feira</option><option value="Terça-feira">Terça-feira</option><option value="Quarta-feira">Quarta-feira</option><option value="Quinta-feira">Quinta-feira</option><option value="Sexta-feira">Sexta-feira</option>
                                </select>
                            </div>
                        )}
                        <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${sabadoType === 'jornada' ? 'bg-purple-50 border-purple-400 shadow-sm' : 'hover:bg-gray-50'}`}>
                            <input type="radio" name="sabType" checked={sabadoType === 'jornada'} onChange={() => setSabadoType('jornada')} className="mt-1 accent-purple-600"/>
                            <div><span className="block font-bold text-gray-800">Jornada Pedagógica</span><span className="text-xs text-gray-500">Evento escolar que <strong className="text-red-500">não</strong> conta para a soma de dias letivos.</span></div>
                        </label>
                    </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
                    <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded">Cancelar</button>
                    <button onClick={confirmSabado} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 shadow-sm">Salvar Configuração</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
