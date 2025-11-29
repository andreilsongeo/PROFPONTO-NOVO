
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppState, DailySchedule, SpecialActivitySchedule, DAYS_OF_WEEK } from '../types';

interface PointData {
  prof: string;
  turma: string;
  disciplina: string;
  aulasSemanais: number;
  totalAulasAnuais: number;
  aulasAlocadas: number;
  deficit: number;
  aulasPorBimestre: { [bimestreIndex: number]: { data: string; dia: string; isDeficit?: boolean }[] };
}

// --- HELPER: Robust Date Parsing ---
const getDayOfWeekName = (dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const map = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return map[date.getDay()];
};

const formatDateBr = (dateStr: string): string => {
    if (!dateStr) return "---";
    const [y, m, d] = dateStr.split('-').map(String);
    return `${d}/${m}/${y}`;
};

// --- CALCULATIONS ---

const calculatePointData = (state: AppState, prof: string, turma: string, disciplina: string): PointData => {
  let weekly = 0;
  const schedule = state.horarios[turma];
  
  if (!schedule) {
      return { 
          prof, turma, disciplina, 
          aulasSemanais: 0, totalAulasAnuais: 0, aulasAlocadas: 0, deficit: 0, aulasPorBimestre: {} 
      };
  }

  // 1. Calcular Carga Horária Semanal
  Object.values(schedule).forEach((slots) => {
    (slots as DailySchedule).forEach(slot => {
        if (slot && slot.p === prof && slot.d === disciplina) {
            weekly++;
        }
    });
  });

  // 2. Calcular Meta Anual (Lógica Matemática: 1 semanal = 40 anual)
  const annualTarget = weekly * 40;

  // 3. Distribuir as aulas cronologicamente
  const distribution: { [key: number]: { data: string; dia: string; isDeficit?: boolean }[] } = {};
  state.bimestres.forEach((_, i) => distribution[i] = []);

  let lessonsAllocated = 0;
  const sortedDates = [...state.calendario].sort();

  for (const dateStr of sortedDates) {
      if (lessonsAllocated >= annualTarget) break;
      if (state.sabados[dateStr] === 'JORNADA') continue;

      let dayName = state.sabados[dateStr];
      if (!dayName) {
          dayName = getDayOfWeekName(dateStr);
      }

      if ((dayName === 'Sábado' || dayName === 'Domingo') && !state.sabados[dateStr]) continue;

      if (dayName && schedule[dayName]) {
          let dailyCount = 0;
          schedule[dayName].forEach(slot => {
              if (slot && slot.p === prof && slot.d === disciplina) {
                  dailyCount++;
              }
          });

          if (dailyCount > 0) {
              const bimIndex = state.bimestres.findIndex(b => dateStr >= b.inicio && dateStr <= b.fim);
              if (bimIndex >= 0) {
                  for(let k=0; k < dailyCount; k++) {
                      if (lessonsAllocated < annualTarget) {
                          distribution[bimIndex].push({ data: dateStr, dia: dayName! });
                          lessonsAllocated++;
                      }
                  }
              }
          }
      }
  }

  const deficit = annualTarget - lessonsAllocated;
  if (deficit > 0 && state.bimestres.length > 0) {
      const lastBimestreIndex = state.bimestres.length - 1;
      for (let i = 0; i < deficit; i++) {
          if (!distribution[lastBimestreIndex]) distribution[lastBimestreIndex] = [];
          distribution[lastBimestreIndex].push({ 
              data: '', 
              dia: '-', 
              isDeficit: true 
          });
      }
  }

  return { 
      prof, turma, disciplina, 
      aulasSemanais: weekly, 
      totalAulasAnuais: annualTarget, 
      aulasAlocadas: lessonsAllocated,
      deficit: deficit,
      aulasPorBimestre: distribution 
  };
};

const calculateActivityDates = (state: AppState, prof: string, type: 'pca' | 'ape') => {
    const meta = state.professoresMetaData[prof];
    const schedule = type === 'pca' ? meta?.horarioPCA : meta?.horarioAPE;
    
    if (!schedule) return {};

    const distribution: { [key: number]: { data: string; dia: string }[] } = {};
    state.bimestres.forEach((_, i) => distribution[i] = []);

    const sortedDates = [...state.calendario].sort();

    for (const dateStr of sortedDates) {
        if (state.sabados[dateStr] === 'JORNADA') continue;

        let dayName = state.sabados[dateStr];
        if (!dayName) {
            dayName = getDayOfWeekName(dateStr);
        }

        if (dayName && schedule[dayName]) {
            const hasActivity = schedule[dayName].some(isActive => isActive);
            if (hasActivity) {
                const bimIndex = state.bimestres.findIndex(b => dateStr >= b.inicio && dateStr <= b.fim);
                if (bimIndex >= 0) {
                    distribution[bimIndex].push({ data: dateStr, dia: dayName });
                }
            }
        }
    }
    return distribution;
};

const formatScheduleString = (schedule?: SpecialActivitySchedule): string => {
    if (!schedule) return "Horário não definido.";
    const parts: string[] = [];
    const shortDays: {[key:string]: string} = { "Segunda-feira": "Seg", "Terça-feira": "Ter", "Quarta-feira": "Qua", "Quinta-feira": "Qui", "Sexta-feira": "Sex" };
    Object.keys(schedule).forEach(day => {
        const slots = schedule[day];
        const activeIndices = slots.map((isActive, idx) => isActive ? `${idx + 1}º` : null).filter(Boolean);
        if (activeIndices.length > 0) {
            parts.push(`${shortDays[day] || day}: ${activeIndices.join(', ')}`);
        }
    });
    return parts.length > 0 ? parts.join(' | ') : "Nenhum horário selecionado.";
};

// --- STYLES ---
const THEME = {
    headFill: [230, 230, 230] as [number, number, number],
    headText: 20 as number,
    gridLine: 200 as number,
    satFill: [245, 245, 245] as [number, number, number],
    colors: [
        [219, 234, 254], // Blue 100
        [220, 252, 231], // Green 100
        [255, 237, 213], // Orange 100
        [252, 231, 243]  // Pink 100
    ] as [number, number, number][]
};

// --- COMMON PDF SECTIONS ---

const drawLogo = (doc: any, state: AppState, x: number = 14, y: number = 10, size: number = 20) => {
    if (state.instituicao.logo) {
        try {
            const imgProps = doc.getImageProperties(state.instituicao.logo);
            const height = (imgProps.height * size) / imgProps.width;
            doc.addImage(state.instituicao.logo, 'PNG', x, y, size, height);
        } catch (e) {}
    }
};

const addCommonHeader = (doc: any, state: AppState, title: string, subtitle?: string) => {
    const w = doc.internal.pageSize.getWidth();
    drawLogo(doc, state);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(state.instituicao.nome.toUpperCase(), w/2, 18, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(title, w/2, 25, { align: 'center' });
    
    if (subtitle) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(subtitle, w/2, 30, { align: 'center' });
    }

    doc.setLineWidth(0.5);
    doc.line(14, 35, w-14, 35);
    return 40;
};

const addCover = (doc: any, state: AppState, title: string, subtitle: string, info: string) => {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    
    if (state.instituicao.logo) {
        try {
            const imgProps = doc.getImageProperties(state.instituicao.logo);
            const width = 40;
            const height = (imgProps.height * width) / imgProps.width;
            doc.addImage(state.instituicao.logo, 'PNG', (w/2) - (width/2), 40, width, height);
        } catch (e) {}
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(state.instituicao.nome.toUpperCase(), w/2, 100, { align: 'center' });

    doc.setFontSize(24);
    doc.text(title, w/2, 130, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    const currentYear = new Date().getFullYear();
    doc.text(`Ano Letivo: ${currentYear}`, w/2, 150, { align: 'center' });

    doc.setFontSize(16);
    doc.text(subtitle, w/2, 170, { align: 'center' });
    
    if(info) {
        doc.setFontSize(12);
        doc.text(info, w/2, 180, { align: 'center' });
    }
    
    doc.setFontSize(8);
    doc.text("Gerado pelo PROFponto", w/2, h - 10, { align: 'center' });
};

const addOpeningTerm = (doc: any, state: AppState) => {
    doc.addPage();
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Termo de Abertura", w/2, 40, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const text = `Nesta data, faço a abertura do presente Livro de Ponto Docente da ${state.instituicao.nome}, referente ao ano letivo de ${new Date().getFullYear()}, contendo os registros de frequência e atividades dos docentes.`;
    const splitText = doc.splitTextToSize(text, 160);
    doc.text(splitText, 25, 70);
    doc.line(60, 180, 150, 180);
    doc.setFontSize(11);
    doc.text("Direção Escolar", w/2, 185, { align: 'center' });
};

const addClosingTerm = (doc: any, state: AppState, totalPages: number) => {
    doc.addPage();
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Termo de Encerramento", w/2, 40, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const text = `Nesta data, encerro o presente Livro de Ponto Docente da ${state.instituicao.nome}, referente ao ano letivo de ${new Date().getFullYear()}, contendo ${totalPages} páginas numeradas.`;
    const splitText = doc.splitTextToSize(text, 160);
    doc.text(splitText, 25, 70);
    doc.line(60, 180, 150, 180);
    doc.setFontSize(11);
    doc.text("Direção Escolar", w/2, 185, { align: 'center' });
};

const addTimesheetHeader = (doc: any, state: AppState, data: PointData, isActivityPage: boolean = false) => {
    const pageCenter = doc.internal.pageSize.getWidth() / 2;
    let yPos = 10;

    drawLogo(doc, state, 14, 8, 18);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(state.instituicao.nome || "NOME DA INSTITUIÇÃO", pageCenter, yPos + 5, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    if (isActivityPage) return 25; 

    const infoLine1 = `Professor: ${data.prof} | Disciplina: ${data.disciplina} | Turma: ${data.turma}`;
    doc.text(infoLine1, pageCenter, yPos + 12, { align: 'center' });

    // AUDIT BOX
    const w = doc.internal.pageSize.getWidth();
    const auditX = w - 70;
    const auditY = 8;
    const auditW = 55;
    const auditH = 18;

    doc.setDrawColor(data.deficit > 0 ? 200 : 100);
    doc.setFillColor(255, 255, 255);
    doc.rect(auditX, auditY, auditW, auditH);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("AUDITORIA DE CARGA HORÁRIA", auditX + 2, auditY + 5);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Semanal: ${data.aulasSemanais} aulas`, auditX + 2, auditY + 10);
    doc.text(`Meta Anual: ${data.totalAulasAnuais}`, auditX + 2, auditY + 15);
    doc.text(`Realizadas: ${data.aulasAlocadas}`, auditX + 30, auditY + 10);
    
    if (data.deficit > 0) {
        doc.setTextColor(200, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(`Déficit: ${data.deficit}`, auditX + 30, auditY + 15);
        doc.setTextColor(0);
    } else {
        doc.setTextColor(0, 128, 0);
        doc.text("OK", auditX + 30, auditY + 15);
        doc.setTextColor(0);
    }
    return 30;
};

const addTeacherTimesheetToDoc = (doc: any, state: AppState, prof: string, turma: string, disciplina: string) => {
    const pointData = calculatePointData(state, prof, turma, disciplina);
    let aulaCounter = 1;

    state.bimestres.forEach((bimestre, index) => {
        const aulas = pointData.aulasPorBimestre[index] || [];
        const validDays = aulas.filter(a => !a.isDeficit);
        const uniqueDays = new Set(validDays.map(a => a.data)).size;

        doc.addPage();
        const startY = addTimesheetHeader(doc, state, pointData);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`${bimestre.nome} (${uniqueDays} dias letivos neste período)`, 14, startY + 5);

        const body = aulas.map((aula) => {
            if (aula.isDeficit) {
                return [String(aulaCounter++).padStart(2, '0'), '---', '---', '', 'DÉFICIT DE CALENDÁRIO'];
            }
            return [String(aulaCounter++).padStart(2, '0'), formatDateBr(aula.data), aula.dia, '', ''];
        });

        if (body.length === 0) body.push(['-', '-', 'Sem aulas registradas', '', '']);

        const sabadoRowStyles: { [key: number]: any } = {};
        const deficitRowStyles: { [key: number]: any } = {};

        aulas.forEach((aula, idx) => {
            if (aula.isDeficit) {
                deficitRowStyles[idx] = { textColor: [200, 0, 0], fontStyle: 'bold' };
            } else if (state.sabados[aula.data]) {
                sabadoRowStyles[idx] = { fillColor: THEME.satFill, fontStyle: 'bold' };
            }
        });

        autoTable(doc, {
            startY: startY + 8,
            head: [['AULA Nº', 'DATA', 'DIA DA SEMANA', 'ASSINATURA', 'OBSERVAÇÃO']],
            body: body,
            theme: 'grid',
            headStyles: { fillColor: THEME.headFill, textColor: THEME.headText, lineColor: THEME.gridLine, lineWidth: 0.1 },
            styles: { fontSize: 9, cellPadding: 2, lineColor: THEME.gridLine, lineWidth: 0.1, textColor: 0 },
            columnStyles: { 
                0: { cellWidth: 15, halign: 'center' }, 
                1: { cellWidth: 25 }, 
                2: { cellWidth: 35 },
                3: { cellWidth: 50 },
                4: { cellWidth: 'auto' }
            },
            margin: { left: 14, right: 14 },
            willDrawCell: (data: any) => {
              if (data.section === 'body') {
                  if (sabadoRowStyles[data.row.index]) {
                      doc.setFillColor(THEME.satFill[0], THEME.satFill[1], THEME.satFill[2]);
                      doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                      doc.setFont(undefined, 'bold');
                  }
                  if (deficitRowStyles[data.row.index]) {
                      doc.setTextColor(200, 0, 0);
                  }
              }
            }
        });
    });
};

const addSaturdayAttendanceToDoc = (doc: any, state: AppState) => {
    const actualSaturdays = state.calendario.filter(d => {
        const [y, m, day] = d.split('-').map(Number);
        const date = new Date(y, m - 1, day);
        return date.getDay() === 6;
    }).sort();

    if (actualSaturdays.length === 0) return;
    const professors = Object.keys(state.professores).sort();

    actualSaturdays.forEach(dateStr => {
        doc.addPage();
        const type = state.sabados[dateStr];
        const label = type === 'JORNADA' ? 'Jornada Pedagógica' : `Sábado Letivo (Ref: ${type})`;
        const formattedDate = formatDateBr(dateStr);
        const startY = addCommonHeader(doc, state, label, formattedDate);

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Lista de Presença - Corpo Docente", 14, startY + 5);

        const body = professors.map((p, i) => [String(i + 1).padStart(2, '0'), p, '']);

        autoTable(doc, {
            startY: startY + 10,
            head: [['Nº', 'Nome do Professor', 'Assinatura']],
            body: body,
            theme: 'grid',
            headStyles: { fillColor: THEME.headFill, textColor: THEME.headText, lineColor: THEME.gridLine, lineWidth: 0.1 },
            styles: { fontSize: 10, cellPadding: 3, minCellHeight: 10, lineColor: THEME.gridLine, lineWidth: 0.1, textColor: 0 },
            columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 80 }, 2: { cellWidth: 'auto' } },
            margin: { left: 14, right: 14 }
        });
    });
};

const addCalendarGridToDoc = (doc: any, state: AppState) => {
    const startY = addCommonHeader(doc, state, "Calendário Letivo Anual");
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    let x = 10;
    let y = startY + 10;
    const colWidth = 60;
    const rowHeight = 55; 
    const gap = 5;

    months.forEach((m, i) => {
        doc.setDrawColor(220);
        doc.rect(x, y, colWidth, rowHeight);
        doc.setFillColor(245, 245, 245);
        doc.rect(x, y, colWidth, 8, 'F');
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(50);
        doc.text(m, x + colWidth/2, y + 6, { align: 'center' });
        doc.setTextColor(0);
        
        let dx = x + 4;
        let dy = y + 14;
        const xSpacing = 8;
        const ySpacing = 8;

        for(let d=1; d<=31; d++) {
            const dt = new Date(2025, i, d); 
            if (dt.getMonth() !== i) break;
            
            const dateStr = `2025-${String(i+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isLetivo = state.calendario.includes(dateStr);
            const isSabado = state.sabados[dateStr];
            const isJornada = isSabado === 'JORNADA';

            if(isLetivo) {
                let fillColor = [230, 230, 230];
                const periodIndex = state.bimestres.findIndex(b => dateStr >= b.inicio && dateStr <= b.fim);
                
                if (isJornada) {
                    fillColor = [200, 200, 200];
                } else if (periodIndex >= 0) {
                    fillColor = THEME.colors[periodIndex % THEME.colors.length];
                }

                doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
                doc.circle(dx + 2, dy - 2, 3, 'F');
                doc.setFont("helvetica", "bold");
            } else {
                doc.setFont("helvetica", "normal");
                doc.setTextColor(180);
            }
            
            doc.setFontSize(7);
            doc.text(String(d), dx + 2, dy, { align: 'center' });
            doc.setTextColor(0);

            dx += xSpacing;
            if(dx > x + colWidth - 5) {
                dx = x + 4;
                dy += ySpacing;
            }
        }

        x += colWidth + gap;
        if (x > 190) { x = 10; y += rowHeight + gap; }
        if (y > 270) { doc.addPage(); x = 10; y = 20; }
    });

    const legY = 275;
    let legX = 10;
    doc.setFontSize(7);
    state.bimestres.forEach((b, i) => {
        const color = THEME.colors[i % THEME.colors.length];
        doc.setFillColor(color[0], color[1], color[2]);
        doc.circle(legX, legY, 2, 'F');
        doc.text(b.nome, legX + 4, legY + 1);
        legX += 30;
    });
};

const addIntroPagesToBook = (doc: any, state: AppState) => {
    // 1. Resumo de Turmas
    doc.addPage();
    const startY = addCommonHeader(doc, state, "Quantitativo de Turmas");
    const classBody = Object.keys(state.horarios).sort().map(t => [t, state.turmasMetaData[t]?.turno || 'Manhã']);
    autoTable(doc, {
        startY: startY + 10,
        head: [['Turma', 'Turno']],
        body: classBody,
        theme: 'grid',
        headStyles: { fillColor: THEME.headFill, textColor: THEME.headText },
        columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 50 } }
    });

    // 2. Corpo Docente
    doc.addPage();
    const startYDoc = addCommonHeader(doc, state, "Corpo Docente");
    const docBody = Object.keys(state.professores).sort().map(p => {
        const meta = state.professoresMetaData[p];
        const roles = [];
        if(meta?.pca) roles.push('PCA');
        if(meta?.ape) roles.push('APE');
        return [p, roles.join(', ') || '-'];
    });
    autoTable(doc, {
        startY: startYDoc + 10,
        head: [['Nome do Professor', 'Funções Especiais']],
        body: docBody,
        theme: 'grid',
        headStyles: { fillColor: THEME.headFill, textColor: THEME.headText }
    });

    // 3. Horários das Turmas
    const classes = Object.keys(state.horarios).sort();
    classes.forEach(className => {
        doc.addPage();
        const y = addCommonHeader(doc, state, `Horário Escolar: ${className}`, state.turmasMetaData[className]?.turno);
        const schedule = state.horarios[className];
        const body: string[][] = [];
        for (let i = 0; i < 9; i++) {
            const row = [`${i + 1}º Tempo`];
            DAYS_OF_WEEK.forEach(day => {
                const slot = schedule[day][i];
                row.push(slot ? `${slot.d}\n(${slot.p})` : '-');
            });
            body.push(row);
        }
        autoTable(doc, { startY: y + 10, head: [['Horário', ...DAYS_OF_WEEK]], body, theme: 'grid', headStyles: { fillColor: THEME.headFill, textColor: THEME.headText } });
    });
};

export const generateCompleteBookPDF = (state: AppState): string => {
    const doc: any = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    addCover(doc, state, "LIVRO DE PONTO GERAL", "CORPO DOCENTE COMPLETO", "");
    addOpeningTerm(doc, state);
    doc.addPage();
    addCalendarGridToDoc(doc, state);
    
    // Novas páginas introdutórias
    addIntroPagesToBook(doc, state);

    // Folhas de Ponto Individuais
    const professors = Object.keys(state.professores).sort();
    professors.forEach(prof => {
        const assignmentsSet = new Set<string>();
        Object.entries(state.horarios).forEach(([className, schedule]) => {
             Object.values(schedule).forEach((daySlots: any) => {
                 daySlots.forEach((slot: any) => {
                     if(slot && slot.p === prof) assignmentsSet.add(`${className}|${slot.d}`);
                 });
             });
        });
        Array.from(assignmentsSet).sort().forEach(s => {
            const [turma, disciplina] = s.split('|');
            addTeacherTimesheetToDoc(doc, state, prof, turma, disciplina);
        });
        
        // Folhas de Atividades ao final de cada professor
        if (state.professoresMetaData[prof]?.pca) {
             const datesByBimestre = calculateActivityDates(state, prof, 'pca');
             const meta = state.professoresMetaData[prof];
             const scheduleStr = formatScheduleString(meta.horarioPCA);
             let counter = 1;
             state.bimestres.forEach((bimestre, index) => {
                const dates = datesByBimestre[index] || [];
                if (dates.length === 0) return;
                doc.addPage();
                const startY = addTimesheetHeader(doc, state, {prof, turma:'-',disciplina:'-',aulasSemanais:0,totalAulasAnuais:0,aulasAlocadas:0,deficit:0,aulasPorBimestre:{}}, true);
                doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("Registro de Atividades: PCA", 14, startY);
                doc.setFontSize(10); doc.setFont("helvetica", "normal");
                doc.text(`Professor(a): ${prof}`, 14, startY + 5); doc.text(`Atividade: Planejamento e Coordenação (PCA)`, 14, startY + 10);
                doc.text(`Horário Definido: ${scheduleStr}`, 14, startY + 15);
                doc.setFont("helvetica", "bold"); doc.text(bimestre.nome, 14, startY + 22);
                const body = dates.map(d => [String(counter++).padStart(2, '0'), formatDateBr(d.data), d.dia, '']);
                autoTable(doc, { startY: startY + 25, head: [['Nº', 'Data', 'Dia da Semana', 'Assinatura']], body, theme: 'grid', headStyles: { fillColor: THEME.headFill, textColor: THEME.headText }, styles: { fontSize: 9, minCellHeight: 10 } });
             });
        }
        if (state.professoresMetaData[prof]?.ape) {
             const datesByBimestre = calculateActivityDates(state, prof, 'ape');
             const meta = state.professoresMetaData[prof];
             const scheduleStr = formatScheduleString(meta.horarioAPE);
             let counter = 1;
             state.bimestres.forEach((bimestre, index) => {
                const dates = datesByBimestre[index] || [];
                if (dates.length === 0) return;
                doc.addPage();
                const startY = addTimesheetHeader(doc, state, {prof, turma:'-',disciplina:'-',aulasSemanais:0,totalAulasAnuais:0,aulasAlocadas:0,deficit:0,aulasPorBimestre:{}}, true);
                doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("Registro de Atividades: APE", 14, startY);
                doc.setFontSize(10); doc.setFont("helvetica", "normal");
                doc.text(`Professor(a): ${prof}`, 14, startY + 5); doc.text(`Atividade: Atividade Pedagógica (APE)`, 14, startY + 10);
                doc.text(`Horário Definido: ${scheduleStr}`, 14, startY + 15);
                doc.setFont("helvetica", "bold"); doc.text(bimestre.nome, 14, startY + 22);
                const body = dates.map(d => [String(counter++).padStart(2, '0'), formatDateBr(d.data), d.dia, '']);
                autoTable(doc, { startY: startY + 25, head: [['Nº', 'Data', 'Dia da Semana', 'Assinatura']], body, theme: 'grid', headStyles: { fillColor: THEME.headFill, textColor: THEME.headText }, styles: { fontSize: 9, minCellHeight: 10 } });
             });
        }
    });

    addSaturdayAttendanceToDoc(doc, state);
    addClosingTerm(doc, state, doc.getNumberOfPages() + 1);
    return doc.output('bloburl');
};

// --- NEW GENERATOR FUNCTIONS ---

export const generateTimesheetPDF = (state: AppState, prof: string, turma: string, disciplina: string): string => {
    const doc: any = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    addTeacherTimesheetToDoc(doc, state, prof, turma, disciplina);
    if (doc.getNumberOfPages() > 1) doc.deletePage(1);
    return doc.output('bloburl');
};

export const generateActivityPDF = (state: AppState, prof: string, type: 'pca' | 'ape'): string => {
    const doc: any = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const datesByBimestre = calculateActivityDates(state, prof, type);
    const meta = state.professoresMetaData[prof] || { pca: false, ape: false, color: '' };
    const scheduleStr = formatScheduleString(type === 'pca' ? meta.horarioPCA : meta.horarioAPE);
    
    let counter = 1;
    let pagesAdded = false;

    state.bimestres.forEach((bimestre, index) => {
        const dates = datesByBimestre[index] || [];
        if (dates.length === 0) return;
        
        doc.addPage();
        pagesAdded = true;

        const startY = addTimesheetHeader(doc, state, {prof, turma:'-',disciplina:'-',aulasSemanais:0,totalAulasAnuais:0,aulasAlocadas:0,deficit:0,aulasPorBimestre:{}}, true);
        
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); 
        doc.text(`Registro de Atividades: ${type.toUpperCase()}`, 14, startY);
        
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text(`Professor(a): ${prof}`, 14, startY + 5); 
        doc.text(`Atividade: ${type === 'pca' ? 'Planejamento e Coordenação' : 'Atividade Pedagógica'}`, 14, startY + 10);
        doc.text(`Horário Definido: ${scheduleStr}`, 14, startY + 15);
        
        doc.setFont("helvetica", "bold"); 
        doc.text(bimestre.nome, 14, startY + 22);
        
        const body = dates.map(d => [String(counter++).padStart(2, '0'), formatDateBr(d.data), d.dia, '']);
        
        autoTable(doc, { 
            startY: startY + 25, 
            head: [['Nº', 'Data', 'Dia da Semana', 'Assinatura']], 
            body, 
            theme: 'grid', 
            headStyles: { fillColor: THEME.headFill, textColor: THEME.headText }, 
            styles: { fontSize: 9, minCellHeight: 10 } 
        });
    });

    if (pagesAdded && doc.getNumberOfPages() > 1) doc.deletePage(1);
    else if (!pagesAdded) {
        doc.text("Sem atividades registradas.", 10, 10);
    }

    return doc.output('bloburl');
};

export const generateClassSchedulePDF = (state: AppState, className: string): string => {
    const doc: any = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
    const meta = state.turmasMetaData[className];
    const startY = addCommonHeader(doc, state, `Horário Escolar: ${className}`, meta?.turno || '');

    const schedule = state.horarios[className];
    const body: string[][] = [];
    for (let i = 0; i < 9; i++) {
        const row = [`${i + 1}º Tempo`];
        DAYS_OF_WEEK.forEach(day => {
            const slot = schedule[day][i];
            row.push(slot ? `${slot.d}\n(${slot.p})` : '-');
        });
        body.push(row);
    }
    autoTable(doc, { 
        startY: startY + 10, 
        head: [['Horário', ...DAYS_OF_WEEK]], 
        body, 
        theme: 'grid', 
        headStyles: { fillColor: THEME.headFill, textColor: THEME.headText },
        styles: { halign: 'center', valign: 'middle' }
    });
    return doc.output('bloburl');
};

export const generateTeacherSchedulePDF = (state: AppState, prof: string): string => {
    const doc: any = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
    const startY = addCommonHeader(doc, state, `Horário Individual: ${prof}`);
    const body: string[][] = [];
    for (let i = 0; i < 9; i++) {
        const row = [`${i + 1}º Tempo`];
        DAYS_OF_WEEK.forEach(day => {
            let found = '-';
            // Search classes
            for (const [t, sch] of Object.entries(state.horarios)) {
                if(sch[day][i]?.p === prof) {
                    found = `${t}\n${sch[day][i]!.d}`;
                    break;
                }
            }
            // Check activities
            if(found === '-') {
                 const meta = state.professoresMetaData[prof];
                 if (meta?.horarioPCA?.[day]?.[i]) found = 'PCA';
                 else if (meta?.horarioAPE?.[day]?.[i]) found = 'APE';
            }
            row.push(found);
        });
        body.push(row);
    }
    autoTable(doc, { 
        startY: startY + 10, 
        head: [['Horário', ...DAYS_OF_WEEK]], 
        body, 
        theme: 'grid', 
        headStyles: { fillColor: THEME.headFill, textColor: THEME.headText },
        styles: { halign: 'center', valign: 'middle' }
    });
    return doc.output('bloburl');
};

export const generateSaturdaysPDF = (state: AppState): string => {
    const doc: any = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    addSaturdayAttendanceToDoc(doc, state);
    if(doc.getNumberOfPages() > 1) doc.deletePage(1);
    else if(doc.getNumberOfPages() === 1 && !state.calendario.some(d => new Date(d.split('-').map(Number).join('/')).getDay() === 6)) {
         doc.text("Nenhum sábado letivo registrado.", 14, 20);
    }
    return doc.output('bloburl');
};

export const generateCalendarExtractPDF = (state: AppState): string => {
    const doc: any = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const startY = addCommonHeader(doc, state, "Extrato do Calendário Letivo");
    const rows = state.calendario.sort().map((d, i) => {
        const sab = state.sabados[d];
        const tipo = sab === 'JORNADA' ? 'Jornada Pedagógica' : (sab ? `Sábado (${sab})` : 'Dia Letivo');
        return [String(i+1), formatDateBr(d), getDayOfWeekName(d), tipo];
    });
    autoTable(doc, {
        startY: startY + 10,
        head: [['#', 'Data', 'Dia', 'Tipo']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: THEME.headFill, textColor: THEME.headText }
    });
    return doc.output('bloburl');
};

export const generateAnnualCalendarPDF = (state: AppState): string => {
    const doc: any = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    addCalendarGridToDoc(doc, state);
    return doc.output('bloburl');
};

export const generateDashboardPDF = (state: AppState): string => {
    const doc: any = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const startY = addCommonHeader(doc, state, "Relatório Gerencial (Dashboard)");
    let y = startY + 10;
    
    doc.setFontSize(12);
    doc.text(`Professores: ${Object.keys(state.professores).length}`, 14, y); y+=6;
    doc.text(`Turmas: ${Object.keys(state.horarios).length}`, 14, y); y+=6;
    doc.text(`Disciplinas: ${state.disciplinas.length}`, 14, y); y+=6;
    
    const validDays = state.calendario.filter(d => state.sabados[d] !== 'JORNADA').length;
    doc.text(`Dias Letivos: ${validDays}`, 14, y); y+=10;

    const data = Object.keys(state.professores).sort().map(p => {
        let count = 0;
        Object.values(state.horarios).forEach(h => {
            Object.values(h).forEach(d => {
                d.forEach(s => { if(s && s.p === p) count++; });
            });
        });
        return [p, count, count * 40];
    });

    autoTable(doc, {
        startY: y,
        head: [['Professor', 'Aulas/Semana', 'Aulas/Ano (Est.)']],
        body: data,
        theme: 'grid',
        headStyles: { fillColor: THEME.headFill, textColor: THEME.headText }
    });
    return doc.output('bloburl');
};

export const generateClassDisciplineExtractPDF = (state: AppState, className: string, discipline: string): string => {
    const doc: any = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    // Identify professor
    let prof = "";
    const sch = state.horarios[className];
    if(sch) {
        for(const d of DAYS_OF_WEEK) {
            const slot = sch[d].find(s => s && s.d === discipline);
            if(slot) { prof = slot.p; break; }
        }
    }
    const data = calculatePointData(state, prof, className, discipline);
    const startY = addTimesheetHeader(doc, state, data);
    
    doc.setFontSize(12); doc.text("Extrato de Aulas", 14, startY + 5);

    const body: string[][] = [];
    state.bimestres.forEach((b, i) => {
        (data.aulasPorBimestre[i] || []).forEach(a => {
            if(!a.isDeficit) body.push([formatDateBr(a.data), a.dia, b.nome]);
        });
    });

    autoTable(doc, {
        startY: startY + 10,
        head: [['Data', 'Dia', 'Bimestre']],
        body,
        theme: 'grid',
        headStyles: { fillColor: THEME.headFill, textColor: THEME.headText }
    });
    return doc.output('bloburl');
};
