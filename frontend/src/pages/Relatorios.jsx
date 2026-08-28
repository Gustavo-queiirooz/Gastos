import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { api, brl, monthLabelShort } from "@/lib/finance";
import { useData } from "@/context/DataContext";
import { PageHeader, EmptyState, Money, Card } from "@/components/common";
import CrudManager from "@/components/CrudManager";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from "recharts";
import { ChartBar, Car, TrendUp, Lightning, DownloadSimple, UploadSimple, ArrowClockwise, Bank, Sparkle, ArrowsClockwise, ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";
import SecuritySettings from "@/components/SecuritySettings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TABS = [
  { id: "geral", label: "Geral" },
  { id: "carro", label: "Carro" },
  { id: "investimentos", label: "Investimentos" },
  { id: "radar", label: "Radar" },
  { id: "backup", label: "Backup" },
  { id: "seguranca", label: "Segurança" },
];

const PALETTE = ["#2D6A4F", "#F77F00", "#0077B6", "#9D4EDD", "#D62828", "#E9C46A", "#457B9D", "#06D6A0", "#FFB703", "#6D6875"];

function Geral() {
  const { tick } = useData();
  const [r, setR] = useState(null);
  useEffect(() => { api.get("/reports").then(setR); }, [tick]);
  if (!r) return <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>;

  const hasData = r.by_category.length > 0 || r.by_month.length > 0;
  if (!hasData) return <EmptyState icon={ChartBar} title="Sem dados ainda" hint="Lance gastos e entradas para ver relatórios." />;

  return (
    <div className="space-y-6" data-testid="reports-geral">
      {r.insights.length > 0 && (
        <div className="space-y-2">
          {r.insights.map((i, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-secondary rounded-2xl p-4" data-testid={`insight-${idx}`}>
              <Lightning size={20} weight="fill" className="text-[hsl(var(--committed))] shrink-0" />
              <p className="text-sm font-medium">{i}</p>
            </div>
          ))}
        </div>
      )}

      {r.by_category.length > 0 && (
        <Card>
          <p className="font-head font-bold text-sm mb-4">Gastos por categoria</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={r.by_category} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {r.by_category.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => brl(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {r.by_category.slice(0, 6).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{c.name}</span>
                <Money value={c.value} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {r.by_month.length > 0 && (
        <Card>
          <p className="font-head font-bold text-sm mb-4">Entradas vs Gastos por mês</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.by_month.map((m) => ({ ...m, label: monthLabelShort(m.month) }))}>
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v) => brl(v)} />
                <Legend />
                <Bar dataKey="income" name="Entradas" fill="#2D6A4F" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Gastos" fill="#D62828" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {r.by_method.length > 0 && (
        <Card>
          <p className="font-head font-bold text-sm mb-3">Gastos por forma de pagamento</p>
          <div className="space-y-2">
            {r.by_method.map((m, i) => (
              <div key={m.name} className="flex items-center justify-between text-sm"><span className="capitalize">{m.name}</span><Money value={m.value} /></div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Carro() {
  const { tick } = useData();
  const [r, setR] = useState(null);
  useEffect(() => { api.get("/reports").then(setR); }, [tick]);
  if (!r) return null;
  return (
    <div data-testid="reports-carro">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="bg-primary text-primary-foreground border-0"><div className="flex items-center gap-2 mb-2"><Car size={20} weight="duotone" /><span className="text-xs opacity-70">Custo no mês</span></div><p className="tabular font-head font-extrabold text-2xl">{brl(r.car_month)}</p></Card>
        <Card className="bg-primary text-primary-foreground border-0"><div className="flex items-center gap-2 mb-2"><Car size={20} weight="duotone" /><span className="text-xs opacity-70">Custo no ano</span></div><p className="tabular font-head font-extrabold text-2xl">{brl(r.car_year)}</p></Card>
      </div>
      <p className="text-sm text-muted-foreground">Gastos nas categorias Carro, Combustível e Transporte entram nesse cálculo. Registre também necessidades do carro em Planejamento → Necessidades (categoria Carro).</p>
    </div>
  );
}

function Investimentos() {
  const { refresh, tick } = useData();
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/investments").then(setItems); }, [tick]);
  const total = items.reduce((s, i) => s + (i.invested || 0), 0);
  const current = items.reduce((s, i) => s + (i.current_balance || 0), 0);
  const gain = current - total;
  return (
    <div data-testid="reports-investimentos">
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Card className="p-4"><p className="text-[11px] text-muted-foreground">Investido</p><p className="tabular font-head font-extrabold text-base mt-1">{brl(total)}</p></Card>
        <Card className="p-4"><p className="text-[11px] text-muted-foreground">Saldo atual</p><p className="tabular font-head font-extrabold text-base mt-1">{brl(current)}</p></Card>
        <Card className="p-4"><p className="text-[11px] text-muted-foreground">Rendimento</p><p className={`tabular font-head font-extrabold text-base mt-1 ${gain >= 0 ? "text-[hsl(var(--positive))]" : "text-destructive"}`}>{brl(gain)}</p></Card>
      </div>
      <CrudManager endpoint="/investments" testid="investments" addLabel="Novo investimento" emptyIcon={TrendUp} onChanged={refresh}
        emptyHint="Registre manualmente seus investimentos (Tesouro, CDB, ações...)."
        fields={[
          { name: "institution", label: "Instituição", type: "text", required: true, placeholder: "Ex: Nubank" },
          { name: "name", label: "Investimento", type: "text", required: true, placeholder: "Ex: Tesouro Selic" },
          { name: "invested", label: "Valor investido (R$)", type: "number", default: 0 },
          { name: "current_balance", label: "Saldo atual (R$)", type: "number", default: 0 },
          { name: "rate", label: "Rentabilidade (% a.a.)", type: "number", default: 0 },
        ]}
        renderItem={(i) => (<div className="flex items-center gap-3"><Bank size={22} weight="duotone" className="text-primary" /><div><p className="font-semibold text-sm">{i.name}</p><p className="text-xs text-muted-foreground">{i.institution} · investido {brl(i.invested)} · saldo {brl(i.current_balance)}</p></div></div>)} />
    </div>
  );
}

function Backup() {
  const { refresh } = useData();
  const fileRef = useRef();
  const doExport = async () => {
    const data = await api.get("/backup/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `meu-bolso-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup exportado!");
  };
  const doImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const text = await file.text(); await api.post("/backup/import", JSON.parse(text)); toast.success("Backup importado!"); refresh(); }
    catch { toast.error("Arquivo inválido"); }
    e.target.value = "";
  };
  const doReset = async () => {
    if (!window.confirm("Isso apagará TODOS os dados. Continuar?")) return;
    await api.del("/backup/reset"); toast.success("Dados zerados"); refresh();
  };
  return (
    <div className="space-y-3" data-testid="reports-backup">
      <Card>
        <p className="font-head font-bold text-sm mb-1">Seus dados</p>
        <p className="text-xs text-muted-foreground mb-4">Exporte um backup completo em JSON ou importe para restaurar. Seus dados ficam salvos no servidor.</p>
        <div className="space-y-2">
          <Button onClick={doExport} className="w-full h-11 rounded-2xl gap-2" data-testid="export-btn"><DownloadSimple size={18} /> Exportar backup</Button>
          <Button onClick={() => fileRef.current.click()} variant="outline" className="w-full h-11 rounded-2xl gap-2" data-testid="import-btn"><UploadSimple size={18} /> Importar backup</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={doImport} data-testid="import-file-input" />
        </div>
      </Card>
      <Card className="border-destructive/30">
        <p className="font-head font-bold text-sm mb-1 text-destructive">Zona de perigo</p>
        <p className="text-xs text-muted-foreground mb-3">Apaga todos os lançamentos e recomeça do zero.</p>
        <Button onClick={doReset} variant="destructive" className="w-full h-11 rounded-2xl gap-2" data-testid="reset-btn"><ArrowClockwise size={18} /> Zerar todos os dados</Button>
      </Card>
    </div>
  );
}

function Radar() {
  const [rates, setRates] = useState(null);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [sim, setSim] = useState({ amount: "5000", monthly: "200", months: "24", rate: "" });
  const [simResult, setSimResult] = useState(null);
  const [aiForm, setAiForm] = useState({ amount: "5000", horizon: "24", goal: "" });

  const load = () => { setLoading(true); setErr(false); api.get("/investments/rates").then((r) => { setRates(r); setSim((s) => ({ ...s, rate: String(r.selic) })); }).catch(() => setErr(true)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const runSim = async () => {
    const body = { amount: parseFloat(sim.amount) || 0, monthly: parseFloat(sim.monthly) || 0, months: parseInt(sim.months) || 12, rate_annual: parseFloat(sim.rate) || 0 };
    setSimResult(await api.post("/investments/simulate", body));
  };
  const runAI = async () => {
    setAnalyzing(true);
    try { const r = await api.post("/investments/analyze", { amount: parseFloat(aiForm.amount) || 0, horizon_months: parseInt(aiForm.horizon) || 12, goal: aiForm.goal }); setAnalysis(r.analysis); }
    catch { toast.error("Falha ao gerar análise por IA"); }
    finally { setAnalyzing(false); }
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-6">Buscando taxas atuais...</p>;
  if (err) return <div className="text-center py-8"><p className="text-sm text-muted-foreground mb-3">Não foi possível obter os dados do Banco Central agora.</p><Button onClick={load} variant="outline" className="rounded-2xl gap-2"><ArrowsClockwise size={16} /> Tentar novamente</Button></div>;
  if (!rates) return null;

  return (
    <div className="space-y-5" data-testid="radar-tab">
      <Card className="bg-primary text-primary-foreground border-0">
        <p className="text-xs uppercase tracking-[0.2em] opacity-70 font-semibold">Taxas oficiais · {rates.source}</p>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div><p className="text-[11px] opacity-60">Selic</p><p className="tabular font-head font-extrabold text-xl">{rates.selic}%</p></div>
          <div><p className="text-[11px] opacity-60">CDI (est.)</p><p className="tabular font-head font-extrabold text-xl">{rates.cdi}%</p></div>
          <div><p className="text-[11px] opacity-60">IPCA 12m</p><p className="tabular font-head font-extrabold text-xl">{rates.ipca_12m}%</p></div>
        </div>
        <p className="text-[11px] opacity-60 mt-2">Atualizado em {rates.updated}</p>
      </Card>

      <div>
        <p className="font-head font-bold text-sm mb-3">Comparar opções</p>
        <div className="space-y-2">
          {rates.options.map((o) => (
            <Card key={o.nome} className="p-4" data-testid={`radar-option-${o.nome}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm">{o.nome}</p>
                <span className="tabular font-head font-extrabold text-base text-[hsl(var(--positive))]">{o.rentab_anual}% a.a.</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>💧 Liquidez: {o.liquidez}</span>
                <span>⚖️ Risco: {o.risco}</span>
                <span>🧾 {o.imposto}</span>
                <span>🛡️ {o.garantia}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">{o.obs}</p>
            </Card>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Comparação informativa — não é recomendação de investimento.</p>
      </div>

      <Card>
        <p className="font-head font-bold text-sm mb-3">Simulador: quanto vou ter?</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Valor inicial (R$)</Label><Input inputMode="decimal" value={sim.amount} onChange={(e) => setSim({ ...sim, amount: e.target.value })} data-testid="sim-amount" /></div>
          <div className="space-y-1.5"><Label>Aporte mensal (R$)</Label><Input inputMode="decimal" value={sim.monthly} onChange={(e) => setSim({ ...sim, monthly: e.target.value })} data-testid="sim-monthly" /></div>
          <div className="space-y-1.5"><Label>Meses</Label><Input inputMode="numeric" value={sim.months} onChange={(e) => setSim({ ...sim, months: e.target.value })} data-testid="sim-months" /></div>
          <div className="space-y-1.5"><Label>Taxa % a.a.</Label><Input inputMode="decimal" value={sim.rate} onChange={(e) => setSim({ ...sim, rate: e.target.value })} data-testid="sim-rate" /></div>
        </div>
        <Button onClick={runSim} className="w-full h-11 rounded-2xl mt-3" data-testid="sim-run-btn">Simular</Button>
        {simResult && (
          <div className="mt-4 rise">
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div><p className="text-[11px] text-muted-foreground">Você terá</p><Money value={simResult.future_value} className="text-base" positive /></div>
              <div><p className="text-[11px] text-muted-foreground">Aportado</p><p className="tabular font-head font-bold text-base">{brl(simResult.contributed)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">Rendimento</p><Money value={simResult.gross_gain} className="text-base" positive /></div>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simResult.series}>
                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => brl(v)} labelFormatter={(l) => `Mês ${l}`} />
                  <Line type="monotone" dataKey="value" name="Total" stroke="#2D6A4F" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="contributed" name="Aportado" stroke="#F77F00" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-1"><Sparkle size={18} weight="fill" className="text-[hsl(var(--committed))]" /><p className="font-head font-bold text-sm">Análise por IA</p></div>
        <p className="text-xs text-muted-foreground mb-3">A IA compara as opções usando as taxas atuais e sua situação.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Valor (R$)</Label><Input inputMode="decimal" value={aiForm.amount} onChange={(e) => setAiForm({ ...aiForm, amount: e.target.value })} data-testid="ai-amount" /></div>
          <div className="space-y-1.5"><Label>Horizonte (meses)</Label><Input inputMode="numeric" value={aiForm.horizon} onChange={(e) => setAiForm({ ...aiForm, horizon: e.target.value })} data-testid="ai-horizon" /></div>
        </div>
        <div className="space-y-1.5 mt-3"><Label>Objetivo (opcional)</Label><Input value={aiForm.goal} onChange={(e) => setAiForm({ ...aiForm, goal: e.target.value })} placeholder="Ex: reserva, viagem..." data-testid="ai-goal" /></div>
        <Button onClick={runAI} disabled={analyzing} className="w-full h-11 rounded-2xl mt-3 gap-2" data-testid="ai-analyze-btn"><Sparkle size={16} weight="fill" /> {analyzing ? "Analisando..." : "Gerar análise"}</Button>
        {analysis && <div className="mt-4 pt-4 border-t text-sm whitespace-pre-wrap leading-relaxed rise" data-testid="ai-result">{analysis}</div>}
      </Card>
    </div>
  );
}

export default function Relatorios() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "geral";
  const setTab = (t) => setParams({ tab: t });
  return (
    <div className="rise">
      <PageHeader title="Relatórios" subtitle="Análises e backup" />
      <div className="sticky top-[68px] z-10 glass border-b border-border">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} data-testid={`rtab-${t.id}`}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="p-5">
        {tab === "geral" && <Geral />}
        {tab === "carro" && <Carro />}
        {tab === "investimentos" && <Investimentos />}
        {tab === "radar" && <Radar />}
        {tab === "backup" && <Backup />}
        {tab === "seguranca" && <SecuritySettings />}
      </div>
    </div>
  );
}
