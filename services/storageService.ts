
import { AppState } from '../types';
import { DEFAULT_STATE } from '../constants';

export const saveState = (configName: string, state: AppState) => {
  try {
    localStorage.setItem(configName, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
    alert("Erro ao salvar dados localmente. O armazenamento pode estar cheio.");
  }
};

export const loadState = (configName: string): AppState => {
  try {
    const saved = localStorage.getItem(configName);
    if (!saved) return { ...DEFAULT_STATE };
    
    const parsed = JSON.parse(saved);
    // Merge with default to ensure new fields exist if schema changes
    return { ...DEFAULT_STATE, ...parsed };
  } catch (e) {
    console.error("Failed to load state", e);
    return { ...DEFAULT_STATE };
  }
};

export const listConfigs = (): string[] => {
  return Object.keys(localStorage).filter(k => k.startsWith('ano_letivo_'));
};

export const createConfig = (name: string, sourceState?: AppState): string => {
  const key = `ano_letivo_${name.trim()}`;
  
  // Only create if it doesn't exist to prevent overwriting
  if (!localStorage.getItem(key)) {
    let initialState = DEFAULT_STATE;

    // If a source state is provided, we inherit reusable data
    // Note: Import/Export feature now handles full transfer, but this remains for quick year rollover
    if (sourceState) {
        initialState = {
            ...DEFAULT_STATE,
            // Inherit Institution Data (Logo, Name, Directors)
            instituicao: { ...sourceState.instituicao },
            
            // Inherit Resources (Teachers & Subjects)
            professores: { ...sourceState.professores },
            professoresMetaData: { ...sourceState.professoresMetaData },
            disciplinas: [...sourceState.disciplinas],
            
            // Reset Time-sensitive data
            calendario: [],
            horarios: {}, // Classes and schedules are reset
            sabados: {},
            turmasMetaData: {}, // Class metadata (shifts) reset as classes are reset
            
            // Reset periods to default empty (generic)
            bimestres: DEFAULT_STATE.bimestres
        };
    }

    saveState(key, initialState);
  }
  return key;
};
