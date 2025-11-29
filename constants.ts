
import { AppState } from './types';

export const DEFAULT_STATE: AppState = {
  professores: {},
  professoresMetaData: {},
  horarios: {},
  calendario: [],
  bimestres: [
    { nome: "1º BIMESTRE", inicio: "", fim: "" },
    { nome: "2º BIMESTRE", inicio: "", fim: "" },
    { nome: "3º BIMESTRE", inicio: "", fim: "" },
    { nome: "4º BIMESTRE", inicio: "", fim: "" }
  ],
  tipoPeriodo: 'bimestre',
  sabados: {},
  disciplinas: [],
  turmasMetaData: {},
  instituicao: {
    nome: "ESCOLA EXEMPLO",
    endereco: "",
    telefone: "",
    email: "",
    diretor: "",
    matDiretor: "",
    coord: "",
    matCoord: "",
    logo: ""
  }
};

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
