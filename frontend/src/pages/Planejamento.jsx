import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api, brl, monthLabel, monthLabelShort, PRIORITY, today } from "@/lib/finance";
import { useData } from "@/context/DataContext";
import { PageHeader, EmptyState, Money, Card } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WarningCircle, ClipboardText, Target, Trophy, ShoppingBag, Plus, Trash, CheckCircle, CaretDown } from "@phosphor-icons/react";
import { toast } from "sonner";

const TABS = [
  { id: "previsao", label: "Previsão" },
  { id: "necessidades", label: "Necessidades" },
  { id: "metas", label: "Metas" },
  { id: "desafios", label: "Desafios" },
  { id: "posso-comprar", label: "Posso comprar?" },
];

function Previsao() {
  const { tick } = useData();
  const [data, setData] = useState([]);
  const [expanded, setExpanded] = useState(null);
  useEffect(() => { api.get("/planning?months=12").then(setData); }, [tick]);
  return (
    <div data-testid="previsao-tab" className="space-y-2">
      {data.map((m) => (
        <div key={m.month} className={`bg-card rounded-2xl border p-4 ${m.alert ? "border-destructive/40" : "border-border"}`} data-testid={`month-${m.month}`}>
          <button onClick={() => setExpanded(expanded === m.month ? null : m.month)} className="w-full flex items-center justify-between">
            <div className="text-left">
              <p className="font-head font-bold text-sm">{monthLabel(m.month)}</p>
              <p className="text-xs text-muted-foreground">Saldo projetado</p>
            </div>
            <div className="flex items-center gap-2">
              {m.alert && <WarningCircle size={20} weight="fill" className="text-destructive" />}
              <Money value={m.projected_balance} negative={m.projected_balance < 0} positive={m.projected_balance >= 0} className="text-base" />
              <CaretDown size={16} className={`transition-transform ${expanded === m.month ? "rotate-180" : ""}`} />
            </div>
          </button>
          {expanded === m.month && (
            <div className="mt-3 pt-3 border-t space-y-1.5 text-sm rise">
              <div className="flex justify-between"><span className="text-muted-foreground">Entradas previstas</span><Money value={m.income_expected} positive /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Compromissos</span><span className="tabular">− {brl(m.commitments)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Necessidades planejadas</span><span className="tabular">− {brl(m.needs)}</span></div>
              <div className="flex justify-between font-semibold pt-1 border-t"><span>Resultado do mês</span><Money value={m.net} negative={m.net < 0} /></div>
              {m.alert && <p className="text-xs text-destructive mt-2 flex items-center gap-1"><WarningCircle size={14} weight="fill" /> Mês apertado — atenção aos gastos.</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Necessidades() {
  const { categories, refresh, tick } = useData();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "", estimated_value: "", priority: "planejado", deadline: "", group: "" });
  const load = () => api.get("/needs").then(setItems);
  useEffect(() => { load(); }, [tick]);

  const add = async () => {
    const v = parseFloat(String(form.estimated_value).replace(",", ".")) || 0;
    if (!form.title) return toast.error("Informe um título");
    await api.post("/needs", { ...form, estimated_value: v });
    toast.success("Necessidade cadastrada"); setOpen(false);
    setForm({ title: "", description: "", category: "", estimated_value: "", priority: "planejado", deadline: "", group: "" }); load(); refresh();
  };
  const realize = async (n) => { await api.post(`/needs/${n.id}/realize`, {}); toast.success("Convertida em gasto!"); load(); refresh(); };
  const remove = async (id) => { await api.del(`/needs/${id}`); load(); refresh(); };

  const pending = items.filter((n) => n.status === "pendente");
  const total = pending.reduce((s, n) => s + (n.estimated_value || 0), 0);
  const order = { urgente: 0, importante: 1, planejado: 2, desejo: 3 };
  const sorted = [...pending].sort((a, b) => order[a.priority] - order[b.priority]);

  return (
    <div data-testid="necessidades-tab">
      <Card className="mb-4 bg-[hsl(var(--committed))] text-white border-0"><p className="text-xs uppercase tracking-[0.2em] opacity-80 font-semibold">Total planejado</p><p className="tabular font-head font-extrabold text-3xl mt-1">{brl(total)}</p></Card>
      <Button onClick={() => setOpen(true)} className="w-full h-11 rounded-2xl mb-4 gap-2" data-testid="add-need-btn"><Plus size={18} weight="bold" /> Nova necessidade</Button>
      {sorted.length === 0 ? <EmptyState icon={ClipboardText} title="Nada planejado" hint="Registre coisas que você sabe que vai precisar comprar (pneus, móvel, viagem...)." /> : (
        <div className="space-y-2">
          {sorted.map((n) => {
            const p = PRIORITY[n.priority] || PRIORITY.planejado;
            return (
              <div key={n.id} className="bg-card rounded-2xl border border-border p-4" data-testid={`need-${n.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="font-semibold text-sm truncate">{p.dot} {n.title}</p>{n.description && <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>}<p className="text-xs mt-1" style={{ color: p.color }}>{p.label}{n.category ? ` · ${n.category}` : ""}</p></div>
                  <Money value={n.estimated_value} className="text-sm shrink-0" />
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="rounded-full h-8 gap-1 flex-1" onClick={() => realize(n)} data-testid={`realize-btn-${n.id}`}><CheckCircle size={15} /> Realizei / virou gasto</Button>
                  <Button size="sm" variant="ghost" className="rounded-full h-8 w-8 p-0" onClick={() => remove(n.id)}><Trash size={15} /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl max-w-sm"><DialogHeader><DialogTitle className="font-head">Nova necessidade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Trocar pneus" data-testid="need-title-input" /></div>
            <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="need-desc-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Valor estimado</Label><Input inputMode="decimal" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} data-testid="need-value-input" /></div>
              <div className="space-y-1.5"><Label>Prazo</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} data-testid="need-deadline-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger data-testid="need-priority-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY).map(([k, v]) => <SelectItem key={k} value={k}>{v.dot} {v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, group: v === "Carro" ? "carro" : "" })}>
                  <SelectTrigger data-testid="need-cat-select"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>{categories.filter((c) => c.type === "expense").map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={add} className="w-full h-11 rounded-2xl" data-testid="save-need-btn">Cadastrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metas() {
  const { refresh, tick } = useData();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [contribOpen, setContribOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [amount, setAmount] = useState("");
  const [form, setForm] = useState({ name: "", target: "", current: "", deadline: "", monthly_contribution: "" });
  const load = () => api.get("/goals").then(setItems);
  useEffect(() => { load(); }, [tick]);

  const add = async () => {
    const t = parseFloat(String(form.target).replace(",", ".")) || 0;
    if (!form.name || !t) return toast.error("Informe nome e valor objetivo");
    await api.post("/goals", { name: form.name, target: t, current: parseFloat(String(form.current).replace(",", ".")) || 0, deadline: form.deadline || null, monthly_contribution: parseFloat(String(form.monthly_contribution).replace(",", ".")) || null });
    toast.success("Meta criada"); setOpen(false); setForm({ name: "", target: "", current: "", deadline: "", monthly_contribution: "" }); load(); refresh();
  };
  const contribute = async () => { const v = parseFloat(String(amount).replace(",", ".")); if (!v) return; await api.post(`/goals/${sel.id}/contribute`, { amount: v }); toast.success("Guardado!"); setContribOpen(false); setAmount(""); load(); refresh(); };
  const remove = async (id) => { await api.del(`/goals/${id}`); load(); refresh(); };

  const monthsLeft = (deadline) => { if (!deadline) return null; const d = new Date(deadline); const n = new Date(); return Math.max(1, (d.getFullYear() - n.getFullYear()) * 12 + (d.getMonth() - n.getMonth())); };

  return (
    <div data-testid="metas-tab">
      <Button onClick={() => setOpen(true)} className="w-full h-11 rounded-2xl mb-4 gap-2" data-testid="add-goal-btn"><Plus size={18} weight="bold" /> Nova meta</Button>
      {items.length === 0 ? <EmptyState icon={Target} title="Nenhuma meta" hint="Reserva de emergência, viagem, carro novo... defina objetivos." /> : (
        <div className="space-y-3">
          {items.map((g) => {
            const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
            const ml = monthsLeft(g.deadline);
            const need = ml ? Math.max(0, (g.target - g.current) / ml) : null;
            return (
              <Card key={g.id} data-testid={`goal-${g.id}`}>
                <div className="flex items-center justify-between"><p className="font-head font-bold text-sm">{g.name}</p><button onClick={() => remove(g.id)} className="text-muted-foreground hover:text-destructive"><Trash size={16} /></button></div>
                <div className="flex items-baseline justify-between mt-2 mb-1"><Money value={g.current} className="text-lg" positive /><span className="text-sm text-muted-foreground">de {brl(g.target)}</span></div>
                <Progress value={pct} className="h-2.5" />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{pct.toFixed(0)}% concluído{need ? ` · guarde ${brl(need)}/mês` : ""}</span>
                  <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => { setSel(g); setContribOpen(true); }} data-testid={`contribute-btn-${g.id}`}>+ Guardar</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl max-w-sm"><DialogHeader><DialogTitle className="font-head">Nova meta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Reserva de emergência" data-testid="goal-name-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Objetivo (R$)</Label><Input inputMode="decimal" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} data-testid="goal-target-input" /></div>
              <div className="space-y-1.5"><Label>Já tenho (R$)</Label><Input inputMode="decimal" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} data-testid="goal-current-input" /></div>
            </div>
            <div className="space-y-1.5"><Label>Prazo</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} data-testid="goal-deadline-input" /></div>
            <Button onClick={add} className="w-full h-11 rounded-2xl" data-testid="save-goal-btn">Criar meta</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={contribOpen} onOpenChange={setContribOpen}>
        <DialogContent className="rounded-3xl max-w-sm"><DialogHeader><DialogTitle className="font-head">Guardar para {sel?.name}</DialogTitle></DialogHeader>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" data-testid="contribute-amount-input" />
          <Button onClick={contribute} className="rounded-2xl h-11" data-testid="confirm-contribute-btn">Guardar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Desafios() {
  const { tick, refresh } = useData();
  const [ch, setCh] = useState(null);
  const load = () => api.get("/challenges").then((r) => setCh(r[0] || null));
  useEffect(() => { load(); }, [tick]);
  if (!ch) return <EmptyState icon={Trophy} title="Carregando desafio..." />;

  const done = new Set(ch.done_days || []);
  const val = (day) => ch.mode === "crescente" ? day : (366 - day);
  const totalAll = 66795;
  const accumulated = [...done].reduce((s, d) => s + val(d), 0);
  const remaining = totalAll - accumulated;
  const pct = (done.size / 365) * 100;

  const toggle = async (day) => { const r = await api.post(`/challenges/${ch.id}/toggle`, { day }); setCh(r); refresh(); };
  const switchMode = async () => { await api.put(`/challenges/${ch.id}`, { mode: ch.mode === "crescente" ? "decrescente" : "crescente" }); load(); };

  return (
    <div data-testid="desafios-tab">
      <Card className="mb-4 bg-primary text-primary-foreground border-0">
        <div className="flex items-center gap-2 mb-1"><Trophy size={20} weight="fill" /><p className="font-head font-bold">{ch.name}</p></div>
        <p className="text-xs opacity-70">Modo: {ch.mode === "crescente" ? "R$1 → R$365" : "R$365 → R$1"}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div><p className="text-[11px] opacity-60">Acumulado</p><p className="tabular font-head font-extrabold text-lg">{brl(accumulated)}</p></div>
          <div><p className="text-[11px] opacity-60">Restante</p><p className="tabular font-head font-extrabold text-lg">{brl(remaining)}</p></div>
          <div><p className="text-[11px] opacity-60">Concluído</p><p className="tabular font-head font-extrabold text-lg">{pct.toFixed(0)}%</p></div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
        <button onClick={switchMode} className="mt-3 text-xs underline opacity-80" data-testid="switch-mode-btn">Inverter desafio</button>
      </Card>
      <p className="text-xs text-muted-foreground mb-2">Toque em cada dia ao guardar o valor ({done.size}/365 concluídos):</p>
      <div className="grid grid-cols-7 gap-1.5" data-testid="challenge-grid">
        {Array.from({ length: 365 }, (_, i) => i + 1).map((day) => {
          const isDone = done.has(day);
          return (
            <button key={day} onClick={() => toggle(day)} data-testid={`day-${day}`}
              className={`aspect-square rounded-lg text-[9px] font-semibold flex flex-col items-center justify-center transition-colors ${isDone ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-accent"}`}>
              <span className="opacity-60 leading-none">{day}</span>
              <span className="leading-none mt-0.5">{val(day)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PossoComprar() {
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const analyze = async () => {
    const v = parseFloat(String(amount).replace(",", ".")); if (!v) return toast.error("Informe o valor");
    setLoading(true);
    try { setResult(await api.post("/posso-comprar", { amount: v, installments: Number(installments) })); }
    finally { setLoading(false); }
  };
  const COLORS = { verde: { bg: "bg-[hsl(var(--positive))]", dot: "🟢" }, amarelo: { bg: "bg-[hsl(var(--committed))]", dot: "🟡" }, vermelho: { bg: "bg-destructive", dot: "🔴" } };
  return (
    <div data-testid="posso-comprar-tab">
      <Card className="mb-4">
        <p className="font-head font-bold text-sm mb-1">Vou poder comprar?</p>
        <p className="text-xs text-muted-foreground mb-4">Analisamos seu saldo, compromissos e projeção. Não é aconselhamento financeiro profissional.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Valor (R$)</Label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 3000" data-testid="pc-amount-input" /></div>
          <div className="space-y-1.5"><Label>Parcelas</Label><Input type="number" min="1" value={installments} onChange={(e) => setInstallments(e.target.value)} data-testid="pc-installments-input" /></div>
        </div>
        <Button onClick={analyze} disabled={loading} className="w-full h-11 rounded-2xl mt-4" data-testid="analyze-btn">{loading ? "Analisando..." : "Analisar compra"}</Button>
      </Card>
      {result && (
        <div className="rise" data-testid="pc-result">
          <div className={`${COLORS[result.verdict].bg} text-white rounded-3xl p-6`}>
            <p className="text-3xl">{COLORS[result.verdict].dot}</p>
            <p className="font-head font-extrabold text-xl mt-2">{result.title}</p>
          </div>
          <Card className="mt-3">
            <p className="font-semibold text-sm mb-2">Por quê?</p>
            <ul className="space-y-2">{result.reasons.map((r, i) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-primary">•</span>{r}</li>)}</ul>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t">
              <div><p className="text-xs text-muted-foreground">Disponível real</p><Money value={result.available} className="text-base" positive /></div>
              <div><p className="text-xs text-muted-foreground">Saldo projetado após</p><Money value={result.projected_after} negative={result.projected_after < 0} className="text-base" /></div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function Planejamento() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "previsao";
  const setTab = (t) => setParams({ tab: t });
  return (
    <div className="rise">
      <PageHeader title="Planejamento" subtitle="Futuro, metas e desafios" />
      <div className="sticky top-[68px] z-10 glass border-b border-border">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} data-testid={`ptab-${t.id}`}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="p-5">
        {tab === "previsao" && <Previsao />}
        {tab === "necessidades" && <Necessidades />}
        {tab === "metas" && <Metas />}
        {tab === "desafios" && <Desafios />}
        {tab === "posso-comprar" && <PossoComprar />}
      </div>
    </div>
  );
}
