import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API });

export const api = {
  get: (p) => http.get(p).then((r) => r.data),
  post: (p, b) => http.post(p, b).then((r) => r.data),
  put: (p, b) => http.put(p, b).then((r) => r.data),
  del: (p) => http.delete(p).then((r) => r.data),
};

export const brl = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export const brlShort = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1000) return "R$ " + (n / 1000).toFixed(1).replace(".", ",") + "k";
  return brl(n);
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const fmtDate = (iso) => {
  if (!iso) return "";
  const d = iso.slice(0, 10).split("-");
  return `${d[2]}/${d[1]}/${d[0]}`;
};

export const fmtDateShort = (iso) => {
  if (!iso) return "";
  const d = iso.slice(0, 10).split("-");
  return `${d[2]} ${MESES[parseInt(d[1]) - 1]}`;
};

export const monthLabel = (mk) => {
  if (!mk) return "";
  const [y, m] = mk.split("-");
  return `${MESES_FULL[parseInt(m) - 1]} ${y}`;
};

export const monthLabelShort = (mk) => {
  if (!mk) return "";
  const [y, m] = mk.split("-");
  return `${MESES[parseInt(m) - 1]}/${y.slice(2)}`;
};

export const today = () => new Date().toISOString().slice(0, 10);

export const daysUntil = (iso) => {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
};

export const STATUS_LABEL = {
  a_vencer: "A vencer",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
  pendente: "Pendente",
  parcial: "Parcial",
  recebido: "Recebido",
};

export const PRIORITY = {
  urgente: { label: "Urgente", color: "#D62828", dot: "🔴" },
  importante: { label: "Importante", color: "#F77F00", dot: "🟠" },
  planejado: { label: "Planejado", color: "#E9C46A", dot: "🟡" },
  desejo: { label: "Desejo", color: "#2D6A4F", dot: "🟢" },
};
