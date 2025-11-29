
import React, { useRef, useState } from 'react';
import { AppState, DAYS_OF_WEEK, ScheduleSlot } from '../types';
import * as XLSX from 'xlsx';

interface Props {
  state: AppState;
  onImport: (data: AppState) => void;
  onClose: () => void;
}

export const DataManagementModal: React.FC<Props> = ({ state, onImport, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // --- JSON HANDLERS ---
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const fileName = `backup_${state.instituicao.nome.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportJsonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChangeJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileObj = e.target.files && e.target.files[0];
    if (!fileObj) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target?.result as string);
            
            if (!json.professores || !json.horarios || !json.calendario) {
                throw new Error("Arquivo inválido ou incompatível com PROFponto.");
            }

            if (window.confirm("ATENÇÃO: Importar um backup substituirá TODOS os dados atuais desta configuração. Deseja continuar?")) {
                onImport(json);
                onClose();
            }
        } catch (err) {
            console.error(err);
            setError("Erro ao ler o arquivo JSON.");
        }
    };
    reader.readAsText(fileObj);
    if(e.target) e.target.value = ''; 
  };

  // --- EXCEL HANDLERS ---

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. INSTITUIÇÃO
    const instData = Object.entries(state.instituicao).map(([k, v]) => [k, k === 'logo' ? '(Imagem Base64 Oculta)' : v]);
    const wsInst = XLSX.utils.aoa_to_sheet([['Campo', 'Valor'], ...instData]);
    XLSX.utils.book_append_sheet(wb, wsInst, "Instituição");

    // 2. PROFESSORES
    const profData = Object.keys(state.professores).map(p => {
        const meta = state.professoresMetaData[p] || { pca: false, ape: false, color: '' };
        return {
            Nome: p,
            PCA: meta.pca ? 'Sim' : 'Não',
            APE: meta.ape ? 'Sim' : 'Não',
            Cor: meta.color || ''
        };
    });
    const wsProf = XLSX.utils.json_to_sheet(profData);
    XLSX.utils.book_append_sheet(wb, wsProf, "Professores");

    // 3. TURMAS
    const turmaData = Object.keys(state.horarios).map(t => ({
        Turma: t,
        Turno: state.turmasMetaData[t]?.turno || 'Manhã'
    }));
    const wsTurma = XLSX.utils.json_to_sheet(turmaData);
    XLSX.utils.book_append_sheet(wb, wsTurma, "Turmas");

    // 4. DISCIPLINAS
    const discData = state.disciplinas.map(d => ({ Disciplina: d }));
    const wsDisc = XLSX.utils.json_to_sheet(discData);
    XLSX.utils.book_append_sheet(wb, wsDisc, "Disciplinas");

    // 5. CALENDÁRIO
    const calData = state.calendario.map(d => ({
        Data: d,
        Tipo: state.sabados[d] === 'JORNADA' ? 'Jornada' : (state.sabados[d] ? `Sábado (${state.sabados[d]})` : 'Dia Letivo')
    }));
    const wsCal = XLSX.utils.json_to_sheet(calData);
    XLSX.utils.book_append_sheet(wb, wsCal, "Calendário");

    // 6. GRADE HORÁRIA
    const flatSchedule: any[] = [];
    Object.entries(state.horarios).forEach(([turma, week]) => {
        DAYS_OF_WEEK.forEach(dia => {
            week[dia].forEach((slot: ScheduleSlot | null, idx: number) => {
                if (slot) {
                    flatSchedule.push({
                        Turma: turma,
                        Dia: dia,
                        Tempo: idx + 1,
                        Disciplina: slot.d,
                        Professor: slot.p
                    });
                }
            });
        });
    });
    const wsSched = XLSX.utils.json_to_sheet(flatSchedule);
    XLSX.utils.book_append_sheet(wb, wsSched, "Horários");

    XLSX.writeFile(wb, `dados_profponto_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportExcelClick = () => {
    excelInputRef.current?.click();
  };

  const handleFileChangeExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileObj = e.target.files && e.target.files[0];
    if (!fileObj) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const wb = XLSX.read(data, { type: 'array' });

            const newState: any = {
                professores: {},
                professoresMetaData: {},
                horarios: {},
                calendario: [],
                sabados: {},
                disciplinas: [],
                turmasMetaData: {},
                instituicao: { ...state.instituicao },
                bimestres: state.bimestres,
                tipoPeriodo: state.tipoPeriodo
            };

            if (wb.Sheets["Instituição"]) {
                const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets["Instituição"], { header: 1 });
                rows.forEach(row => {
                    if (row[0] && row[1] && row[0] !== 'Campo' && row[1] !== '(Imagem Base64 Oculta)') {
                        newState.instituicao[row[0] as keyof AppState['instituicao']] = row[1];
                    }
                });
            }

            if (wb.Sheets["Professores"]) {
                const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets["Professores"]);
                rows.forEach(row => {
                    if (row.Nome) {
                        newState.professores[row.Nome] = [];
                        newState.professoresMetaData[row.Nome] = {
                            color: row.Cor || '#e0e7ff',
                            pca: row.PCA === 'Sim',
                            ape: row.APE === 'Sim'
                        };
                    }
                });
            }

            if (wb.Sheets["Disciplinas"]) {
                const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets["Disciplinas"]);
                newState.disciplinas = rows.map(r => r.Disciplina).filter(Boolean).sort();
            }

            if (wb.Sheets["Turmas"]) {
                const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets["Turmas"]);
                rows.forEach(row => {
                    if (row.Turma) {
                        newState.turmasMetaData[row.Turma] = { turno: row.Turno || 'Manhã' };
                        newState.horarios[row.Turma] = {
                            "Segunda-feira": Array(9).fill(null),
                            "Terça-feira": Array(9).fill(null),
                            "Quarta-feira": Array(9).fill(null),
                            "Quinta-feira": Array(9).fill(null),
                            "Sexta-feira": Array(9).fill(null)
                        };
                    }
                });
            }

            if (wb.Sheets["Calendário"]) {
                const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets["Calendário"]);
                rows.forEach(row => {
                    if (row.Data) {
                        newState.calendario.push(row.Data);
                        if (row.Tipo === 'Jornada') {
                            newState.sabados[row.Data] = 'JORNADA';
                        } else if (row.Tipo && row.Tipo.startsWith('Sábado')) {
                            const match = /\((.*?)\)/.exec(row.Tipo);
                            if (match) newState.sabados[row.Data] = match[1];
                        }
                    }
                });
            }

            if (wb.Sheets["Horários"]) {
                const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets["Horários"]);
                rows.forEach(row => {
                    const { Turma, Dia, Tempo, Disciplina, Professor } = row;
                    if (Turma && Dia && Tempo) {
                        // Auto-create class if it wasn't in Turmas sheet
                        if (!newState.horarios[Turma]) {
                            newState.horarios[Turma] = {
                                "Segunda-feira": Array(9).fill(null),
                                "Terça-feira": Array(9).fill(null),
                                "Quarta-feira": Array(9).fill(null),
                                "Quinta-feira": Array(9).fill(null),
                                "Sexta-feira": Array(9).fill(null)
                            };
                            newState.turmasMetaData[Turma] = { turno: 'Manhã' };
                        }

                        const idx = parseInt(Tempo) - 1;
                        if (idx >= 0 && idx < 9) {
                            newState.horarios[Turma][Dia][idx] = { d: Disciplina, p: Professor };
                        }
                    }
                });
            }

            if (window.confirm("Deseja importar estes dados da planilha? Os dados atuais serão substituídos.")) {
                onImport(newState);
                onClose();
            }

        } catch (err) {
            console.error(err);
            setError("Erro ao processar arquivo Excel. Verifique o formato.");
        }
    };
    reader.readAsArrayBuffer(fileObj);
    if(e.target) e.target.value = ''; 
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
        <div className="bg-gray-100 px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            💾 Gerenciamento de Dados
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        </div>
        
        <div className="p-6 space-y-8">
          
          <div>
            <h3 className="font-bold text-green-700 mb-2 flex items-center gap-2">
               📊 Planilhas Excel (Recomendado)
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={handleExportExcel}
                    className="flex flex-col items-center justify-center p-4 border border-green-200 bg-green-50 hover:bg-green-100 rounded-lg transition text-green-800 font-medium"
                >
                    <span className="text-2xl mb-2">⬇️</span>
                    Exportar Excel
                </button>
                <button 
                    onClick={handleImportExcelClick}
                    className="flex flex-col items-center justify-center p-4 border border-green-200 bg-green-50 hover:bg-green-100 rounded-lg transition text-green-800 font-medium"
                >
                    <span className="text-2xl mb-2">⬆️</span>
                    Importar Excel
                </button>
                <input 
                    type="file" 
                    ref={excelInputRef}
                    onChange={handleFileChangeExcel}
                    accept=".xlsx, .xls"
                    className="hidden"
                />
            </div>
            <p className="text-xs text-gray-500 mt-2">
                Gera um arquivo .xlsx com abas separadas. 
                <br/><strong>Dica:</strong> Se você adicionar turmas na aba Horários, elas serão criadas automaticamente na importação.
            </p>
          </div>

          <hr className="border-gray-200" />

          <div>
            <h3 className="font-bold text-blue-700 mb-2 flex items-center gap-2">
               ⚙️ Arquivo de Sistema (JSON)
            </h3>
            <div className="flex gap-4">
                <button 
                    onClick={handleExportJson}
                    className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 px-4 rounded text-sm font-medium flex-1"
                >
                    Backup Completo
                </button>
                <button 
                    onClick={handleImportJsonClick}
                    className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 px-4 rounded text-sm font-medium flex-1"
                >
                    Restaurar Backup
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChangeJson}
                    accept=".json"
                    className="hidden"
                />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm font-bold bg-red-50 p-2 rounded border border-red-100">{error}</p>}

        </div>

        <div className="p-4 bg-gray-50 border-t text-center">
            <button onClick={onClose} className="text-gray-500 font-medium hover:text-gray-700 text-sm">Fechar</button>
        </div>
      </div>
    </div>
  );
};
