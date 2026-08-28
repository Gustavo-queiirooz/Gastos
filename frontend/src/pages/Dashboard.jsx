import React from "react";
import { useData } from "@/context/DataContext";
import { brl, monthLabel, fmtDateShort, daysUntil } from "@/lib/finance";
import { Card, StatusBadge, Money } from "@/components/common";
import { CategoryIcon } from "@/lib/icons";
import {
  TrendUp, TrendDown, Lock, Wallet, HandCoins, CreditCard, Target,
  ClipboardText, WarningCircle, Bank, ArrowRight,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const StatMini = ({ label, value, Icon, color, testid }) => (
  <div className="bg-card rounded-2xl border border-border p-4" data-testid={testid}>
    <div className="flex items-center gap-2 mb-2">
      <Icon size={18} weight="duotone" style={{ color }} />
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
    <p className="tabular font-head font-extrabold text-lg" style={{ color }}>{brl(value)}</p>
  </div>
);

export default function Dashboard() {
  const { dashboard: d } = useData();

  if (!d) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  const availPct = d.current_balance > 0 ? Math.max(0, Math.min(100, (d.available / d.current_balance) * 100)) : 0;

  return (
    <div className="rise">
      <div className="px-5 pt-6 pb-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">{monthLabel(d.month)}</p>
        <h1 className="font-head font-extrabold text-2xl tracking-tight mt-1">Olá 👋</h1>
      </div>

      {/* Hero: disponível real projetado */}
      <div className="px-5">
        <div className="bg-primary text-primary-foreground rounded-3xl p-6 relative overflow-hidden" data-testid="hero-available-card">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -right-2 top-16 w-28 h-28 rounded-full bg-white/5" />
          <p className="text-xs uppercase tracking-[0.2em] opacity-70 font-semibold">Disponível real</p>
          <p className="tabular font-head font-extrabold text-4xl mt-2" data-testid="available-value">{brl(d.available)}</p>
          <p className="text-sm opacity-80 mt-1">Isso é o que você pode gastar sem comprometer contas.</p>
          <div className="mt-5 h-2 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${availPct}%` }} />
          </div>
          <div className="flex justify-between mt-3 text-sm">
            <div>
              <p className="opacity-60 text-xs">Saldo atual</p>
              <p className="tabular font-semibold">{brl(d.current_balance)}</p>
            </div>
            <div className="text-right">
              <p className="opacity-60 text-xs">Comprometido</p>
              <p className="tabular font-semibold text-[#FFB98A]">− {brl(d.committed)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(d.overdue_count > 0) && (
        <div className="px-5 mt-4">
          <Link to="/compromissos" className="flex items-center gap-3 bg-destructive/10 text-destructive rounded-2xl p-4 border border-destructive/20" data-testid="overdue-alert">
            <WarningCircle size={24} weight="fill" />
            <div className="flex-1">
              <p className="font-semibold text-sm">{d.overdue_count} conta(s) atrasada(s)</p>
              <p className="text-xs opacity-80">Total: {brl(d.overdue_total)}</p>
            </div>
            <ArrowRight size={18} />
          </Link>
        </div>
      )}

      {/* Month stats */}
      <div className="px-5 mt-5 grid grid-cols-2 gap-3">
        <StatMini testid="stat-income" label="Entradas do mês" value={d.income_month} Icon={TrendUp} color="hsl(var(--positive))" />
        <StatMini testid="stat-expense" label="Gastos do mês" value={d.expense_month} Icon={TrendDown} color="hsl(var(--destructive))" />
        <StatMini testid="stat-committed" label="Comprometido" value={d.committed} Icon={Lock} color="hsl(var(--committed))" />
        <StatMini testid="stat-balance" label="Saldo atual" value={d.current_balance} Icon={Wallet} color="hsl(var(--primary))" />
      </div>

      {/* Próximos vencimentos */}
      <div className="px-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-head font-bold text-sm uppercase tracking-[0.15em] text-muted-foreground">Próximos vencimentos</h2>
          <Link to="/compromissos" className="text-xs text-primary font-semibold flex items-center gap-1">Ver todos <ArrowRight size={14} /></Link>
        </div>
        {d.upcoming.length === 0 ? (
          <Card className="text-center text-sm text-muted-foreground py-6">Nenhum vencimento próximo 🎉</Card>
        ) : (
          <div className="space-y-2">
            {d.upcoming.map((c) => {
              const du = daysUntil(c.due_date);
              return (
                <Card key={c.id} className="flex items-center gap-3 p-4" data-testid={`upcoming-${c.id}`}>
                  <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                    <CategoryIcon name={null} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.description}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateShort(c.due_date)} · {du >= 0 ? `em ${du}d` : `${Math.abs(du)}d atrás`}</p>
                  </div>
                  <div className="text-right">
                    <Money value={c.amount} className="text-sm" />
                    <div className="mt-1"><StatusBadge status={c.status} /></div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick grid of areas */}
      <div className="px-5 mt-6 grid grid-cols-2 gap-3">
        <AreaCard to="/compromissos?tab=receber" Icon={HandCoins} color="hsl(var(--receivable))" title="A receber" value={d.to_receive} />
        <AreaCard to="/compromissos?tab=emprestimos" Icon={Bank} color="hsl(var(--destructive))" title="Dívidas" value={d.debts} />
        <AreaCard to="/planejamento?tab=necessidades" Icon={ClipboardText} color="hsl(var(--committed))" title={`Necessidades (${d.needs_count})`} value={d.needs_total} />
        <AreaCard to="/planejamento?tab=metas" Icon={Target} color="hsl(var(--positive))" title="Metas" value={d.goals_saved} sub={d.goals_target > 0 ? `de ${brl(d.goals_target)}` : "Nenhuma meta"} />
        <AreaCard to="/relatorios?tab=investimentos" Icon={CreditCard} color="hsl(var(--primary))" title="Investimentos" value={d.invest_current} sub={d.invested_total > 0 ? `aplicado ${brl(d.invested_total)}` : "Nenhum"} />
        <AreaCard to="/planejamento?tab=posso-comprar" Icon={Wallet} color="hsl(var(--positive))" title="Posso comprar?" isAction />
      </div>
    </div>
  );
}

const AreaCard = ({ to, Icon, color, title, value, sub, isAction }) => (
  <Link to={to} className="bg-card rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors" data-testid={`area-${title.split(" ")[0].toLowerCase()}`}>
    <div className="flex items-center gap-2 mb-2">
      <Icon size={18} weight="duotone" style={{ color }} />
      <span className="text-xs text-muted-foreground font-medium truncate">{title}</span>
    </div>
    {isAction ? (
      <p className="tabular font-head font-bold text-sm" style={{ color }}>Analisar compra →</p>
    ) : (
      <>
        <p className="tabular font-head font-extrabold text-lg" style={{ color }}>{brl(value)}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </>
    )}
  </Link>
);
