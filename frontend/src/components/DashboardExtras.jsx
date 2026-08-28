import React, { useState, useEffect } from "react";
import { api, brl, monthLabel } from "@/lib/finance";
import { useData } from "@/context/DataContext";
import { Card } from "@/components/common";
import {
  WarningCircle, Clock, TrendDown, ClipboardText, Fire, Target, HandCoins,
  Bell, CaretDown, TrendUp, PiggyBank,
} from "@phosphor-icons/react";

const ICONS = { WarningCircle, Clock, TrendDown, ClipboardText, Fire, Target, HandCoins };
const SEV = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-[hsl(var(--committed))]/12 text-[hsl(var(--committed))] border-[hsl(var(--committed))]/20",
  low: "bg-secondary text-secondary-foreground border-border",
};

export function Alerts() {
  const { tick } = useData();
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(true);
  useEffect(() => { api.get("/alerts").then(setAlerts).catch(() => {}); }, [tick]);
  if (alerts.length === 0) return null;
  return (
    <div className="px-5 mt-5" data-testid="alerts-section">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-2">
        <span className="flex items-center gap-2 font-head font-bold text-sm uppercase tracking-[0.15em] text-muted-foreground">
          <Bell size={16} weight="fill" /> Alertas ({alerts.length})
        </span>
        <CaretDown size={16} className={`transition-transform ${open ? "rotate-180" : ""} text-muted-foreground`} />
      </button>
      {open && (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const Icon = ICONS[a.icon] || WarningCircle;
            return (
              <div key={i} className={`flex items-start gap-3 rounded-2xl p-3.5 border ${SEV[a.severity]}`} data-testid={`alert-${a.type}`}>
                <Icon size={20} weight="fill" className="shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{a.title}</p>
                  <p className="text-xs opacity-80 mt-0.5">{a.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MonthSummary() {
  const { tick } = useData();
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/summary/month").then(setS).catch(() => {}); }, [tick]);
  if (!s) return null;
  const positive = s.result >= 0;
  return (
    <div className="px-5 mt-6" data-testid="month-summary">
      <h2 className="font-head font-bold text-sm uppercase tracking-[0.15em] text-muted-foreground mb-3">Resumo de {monthLabel(s.month)}</h2>
      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-[hsl(var(--positive))] mb-1"><TrendUp size={16} weight="bold" /><span className="text-[11px] font-semibold uppercase">Entrou</span></div>
            <p className="tabular font-head font-extrabold text-base">{brl(s.income)}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-destructive mb-1"><TrendDown size={16} weight="bold" /><span className="text-[11px] font-semibold uppercase">Saiu</span></div>
            <p className="tabular font-head font-extrabold text-base">{brl(s.expense)}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 mb-1" style={{ color: positive ? "hsl(var(--positive))" : "hsl(var(--destructive))" }}><PiggyBank size={16} weight="bold" /><span className="text-[11px] font-semibold uppercase">Sobrou</span></div>
            <p className="tabular font-head font-extrabold text-base" style={{ color: positive ? "hsl(var(--positive))" : "hsl(var(--destructive))" }}>{brl(s.result)}</p>
          </div>
        </div>
        {(s.expense_diff_pct !== null || s.top_category) && (
          <div className="mt-4 pt-3 border-t space-y-1.5 text-sm">
            {s.income > 0 && <p className="text-muted-foreground">Você guardou <span className="font-semibold text-foreground">{s.savings_rate}%</span> do que entrou.</p>}
            {s.top_category && <p className="text-muted-foreground">Maior categoria: <span className="font-semibold text-foreground">{s.top_category}</span> ({brl(s.top_category_value)}).</p>}
            {s.expense_diff_pct !== null && (
              <p className="text-muted-foreground">Gastos {s.expense_diff_pct <= 0 ? "caíram" : "subiram"} <span className={`font-semibold ${s.expense_diff_pct <= 0 ? "text-[hsl(var(--positive))]" : "text-destructive"}`}>{Math.abs(s.expense_diff_pct)}%</span> vs. mês anterior.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
