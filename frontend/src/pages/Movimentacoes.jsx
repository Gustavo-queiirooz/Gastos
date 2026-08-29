import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api, brl, fmtDateShort } from "@/lib/finance";
import { useData } from "@/context/DataContext";
import { PageHeader, EmptyState, Money, StatusBadge, Card } from "@/components/common";
import { CategoryIcon } from "@/lib/icons";
import CrudManager from "@/components/CrudManager";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash, TrendUp, TrendDown, Wallet, CreditCard, Tag, Users, HandCoins, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";

const TABS = [
  { id: "gastos", label: "Gastos" },
  { id: "entradas", label: "Entradas" },
  { id: "divididos", label: "Divididos" },
  { id: "contas", label: "Contas" },
  { id: "cartoes", label: "Cartões" },
  { id: "categorias", label: "Categorias" },
  { id: "pessoas", label: "Pessoas" },
];

function TxList({ type }) {
  const { refresh, tick } = useData();
  const [items, setItems] = useState([]);

useEffect(() => {
  api.get(`/transactions?type=${type}`).then(setItems);
}, [type, tick]);

  const remove = async (id) => { await api.del(`/transactions/${id}`); load(); refresh(); toast.success("Removido"); };

  if (items.length === 0)
    return <EmptyState icon={type === "income" ? TrendUp : TrendDown} title={type === "income" ? "Nenhuma entrada" : "Nenhum gasto"} hint="Use o botão + para lançar." />;

  return (
    <div className="space-y-2" data-testid={`txlist-${type}`}>
      {items.map((t) => (
        <div key={t.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3" data-testid={`tx-${t.id}`}>
          <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
            <CategoryIcon name={null} size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{t.description || t.category || "—"}</p>
            <p className="text-xs text-muted-foreground">{fmtDateShort(t.date)} · {t.category || t.income_category}</p>
          </div>
          <Money value={t.amount} positive={type === "income"} negative={type === "expense"} className="text-sm" />
          <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive p-1" data-testid={`tx-delete-${t.id}`}><Trash size={16} /></button>
        </div>
      ))}
    </div>
  );
}

function Divididos() {
  const { people, refresh, tick } = useData();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [amount, setAmount] = useState("");
  const load = () => api.get("/receivables").then(setItems);
  useEffect(() => { load(); }, [tick]);

  const personName = (id) => people.find((p) => p.id === id)?.name || "Alguém";
  const receive = async () => {
    const v = parseFloat(String(amount).replace(",", "."));
    if (!v) return;
    await api.post(`/receivables/${sel.id}/receive`, { amount: v });
    toast.success("Recebimento registrado!");
    setOpen(false); setAmount(""); load(); refresh();
  };

  const pending = items.filter((i) => i.status !== "recebido");
  const done = items.filter((i) => i.status === "recebido");
  const totalPending = pending.reduce((s, i) => s + (i.total - i.received), 0);

  return (
    <div data-testid="divididos-tab">
      <Card className="mb-4 bg-primary text-primary-foreground border-0">
        <p className="text-xs uppercase tracking-[0.2em] opacity-70 font-semibold">Total a receber</p>
        <p className="tabular font-head font-extrabold text-3xl mt-1">{brl(totalPending)}</p>
      </Card>
      {items.length === 0 ? <EmptyState icon={HandCoins} title="Nada dividido ainda" hint="Ao lançar um gasto, ative 'Dividir despesa' para registrar a parte de outra pessoa." /> : (
        <div className="space-y-2">
          {[...pending, ...done].map((r) => (
            <div key={r.id} className="bg-card rounded-2xl border border-border p-4" data-testid={`receivable-${r.id}`}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{personName(r.person_id)}</p>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm">{personName(r.person_id)} deve <Money value={r.total - r.received} negative /></span>
                {r.status !== "recebido" && (
                  <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => { setSel(r); setOpen(true); }} data-testid={`receive-btn-${r.id}`}>Receber</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader><DialogTitle className="font-head">Registrar recebimento</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Falta receber: {sel && brl(sel.total - sel.received)}</p>
          <Label>Valor recebido</Label>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" data-testid="receive-amount-input" />
          <Button onClick={receive} className="rounded-2xl h-11" data-testid="confirm-receive-btn">Confirmar recebimento</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Movimentacoes() {
  const [params, setParams] = useSearchParams();
  const { loadStatic, refresh } = useData();
  const tab = params.get("tab") || "gastos";
  const setTab = (t) => setParams({ tab: t });
  const onCfg = () => { loadStatic(); refresh(); };

  return (
    <div className="rise">
      <PageHeader title="Movimentações" subtitle="Gastos, entradas e gerenciamento" />
      <div className="sticky top-[68px] z-10 glass border-b border-border">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {tab === "gastos" && <TxList type="expense" />}
        {tab === "entradas" && <TxList type="income" />}
        {tab === "divididos" && <Divididos />}
        {tab === "contas" && (
          <CrudManager endpoint="/accounts" testid="accounts" addLabel="Nova conta" emptyIcon={Wallet}
            fields={[
              { name: "name", label: "Nome", type: "text", required: true, placeholder: "Ex: Nubank" },
              { name: "type", label: "Tipo", type: "select", default: "conta", options: [
                { value: "conta", label: "Conta corrente" }, { value: "poupanca", label: "Poupança" },
                { value: "dinheiro", label: "Dinheiro/Carteira" }, { value: "investimento", label: "Investimento" }] },
              { name: "initial_balance", label: "Saldo inicial (R$)", type: "number", default: 0 },
            ]}
            onChanged={onCfg}
            renderItem={(a) => (<div className="flex items-center gap-3"><Wallet size={22} weight="duotone" className="text-primary" /><div><p className="font-semibold text-sm">{a.name}</p><p className="text-xs text-muted-foreground">Saldo inicial: {brl(a.initial_balance)}</p></div></div>)} />
        )}
        {tab === "cartoes" && (
          <CrudManager endpoint="/cards" testid="cards" addLabel="Novo cartão" emptyIcon={CreditCard}
            fields={[
              { name: "name", label: "Nome", type: "text", required: true, placeholder: "Ex: Cartão Itaú" },
              { name: "limit", label: "Limite (R$)", type: "number", default: 0 },
              { name: "closing_day", label: "Dia de fechamento", type: "number", default: 1 },
              { name: "due_day", label: "Dia de vencimento", type: "number", default: 10 },
            ]}
            onChanged={onCfg}
            renderItem={(c) => (<div className="flex items-center gap-3"><CreditCard size={22} weight="duotone" className="text-primary" /><div><p className="font-semibold text-sm">{c.name}</p><p className="text-xs text-muted-foreground">Limite {brl(c.limit)} · fecha dia {c.closing_day} · vence dia {c.due_day}</p></div></div>)} />
        )}
        {tab === "categorias" && (
          <CrudManager endpoint="/categories" testid="categories" addLabel="Nova categoria" emptyIcon={Tag}
            fields={[
              { name: "name", label: "Nome", type: "text", required: true },
              { name: "type", label: "Tipo", type: "select", default: "expense", options: [{ value: "expense", label: "Despesa" }, { value: "income", label: "Entrada" }] },
            ]}
            onChanged={onCfg}
            renderItem={(c) => (<div className="flex items-center gap-3"><CategoryIcon name={c.icon} size={22} color={c.color} /><div><p className="font-semibold text-sm">{c.name}</p><p className="text-xs text-muted-foreground">{c.type === "income" ? "Entrada" : "Despesa"}</p></div></div>)} />
        )}
        {tab === "pessoas" && (
          <CrudManager endpoint="/people" testid="people" addLabel="Nova pessoa" emptyIcon={Users}
            fields={[{ name: "name", label: "Nome", type: "text", required: true }, { name: "note", label: "Observação", type: "text" }]}
            onChanged={onCfg}
            renderItem={(p) => (<div className="flex items-center gap-3"><Users size={22} weight="duotone" className="text-primary" /><div><p className="font-semibold text-sm">{p.name}</p>{p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}</div></div>)} />
        )}
      </div>
    </div>
  );
}
