export interface SpecialActivitySchedule {
  "Segunda-feira": boolean[]; // true = selected
  "Terça-feira": boolean[];
  "Quarta-feira": boolean[];
  "Quinta-feira": boolean[];
  "Sexta-feira": boolean[];
  [key: string]: boolean[];
}

export interface TeacherMetadata {
  color: string;
  pca: boolean;
  ape: boolean;
  horarioPCA?: SpecialActivitySchedule;
  horarioAPE?: SpecialActivitySchedule;
}

export interface TeacherData {
  [name: string]: any[]; // Legacy placeholder
}

export interface TeacherMetaCollection {
  [name: string]: TeacherMetadata;
}

// Represents a single slot in the schedule
export interface ScheduleSlot {
  d: string; // Discipline name
  p: string; // Professor name
}

// 0-8 index for 9 possible class slots
export type DailySchedule = (ScheduleSlot | null)[];

export interface WeeklySchedule {
  "Segunda-feira": DailySchedule;
  "Terça-feira": DailySchedule;
  "Quarta-feira": DailySchedule;
  "Quinta-feira": DailySchedule;
  "Sexta-feira": DailySchedule;
  [key: string]: DailySchedule; // Index signature
}

export interface SchedulesData {
  [className: string]: WeeklySchedule;
}

export interface ClassMetadata {
  turno: 'Manhã' | 'Tarde' | 'Noite' | 'Integral';
}

export interface ClassMetaCollection {
  [className: string]: ClassMetadata;
}

export interface InstitutionData {
  nome: string;
  endereco: string;
  telefone: string;
  email: string;
  diretor: string;
  matDiretor: string;
  coord: string;
  matCoord: string;
  logo: string; // Base64
}

export interface Bimestre {
  nome: string;
  inicio: string; // YYYY-MM-DD
  fim: string; // YYYY-MM-DD
}

export interface AppState {
  professores: TeacherData;
  professoresMetaData: TeacherMetaCollection;
  horarios: SchedulesData;
  calendario: string[]; // Array of YYYY-MM-DD strings
  bimestres: Bimestre[];
  tipoPeriodo: 'bimestre' | 'trimestre' | 'semestre' | 'anual';
  sabados: { [date: string]: string }; // Date -> DayOfWeek mapping
  disciplinas: string[];
  turmasMetaData: ClassMetaCollection;
  instituicao: InstitutionData;
}

export const DAYS_OF_WEEK = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
export const SHORT_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];