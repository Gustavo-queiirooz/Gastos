import React from "react";
import { brl, STATUS_LABEL } from "@/lib/finance";

export const PageHeader = ({ title, subtitle, right }) => (
  <div className="glass sticky top-0 z-20 px-5 py-4 border-b border-border flex items-center justify-between">
    <div>
      <h1 className="font-head font-extrabold text-xl tracking-tight">{title}</h1>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {right}
  </div>
);

export const Money = ({ value, className = "", positive, negative }) => {
  const n = Number(value) || 0;
  let color = "";
  if (positive) color = "text-[hsl(var(--positive))]";
  if (negative || n < 0) color = "text-destructive";
  return <span className={`tabular font-semibold ${color} ${className}`}>{brl(n)}</span>;
};

const STATUS_STYLE = {
  a_vencer: "bg-secondary text-secondary-foreground",
  pago: "bg-[hsl(var(--positive))]/12 text-[hsl(var(--positive))]",
  atrasado: "bg-destructive/12 text-destructive",
  cancelado: "bg-muted text-muted-foreground line-through",
  pendente: "bg-[hsl(var(--committed))]/15 text-[hsl(var(--committed))]",
  parcial: "bg-[hsl(var(--receivable))]/12 text-[hsl(var(--receivable))]",
  recebido: "bg-[hsl(var(--positive))]/12 text-[hsl(var(--positive))]",
};

export const StatusBadge = ({ status }) => (
  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[status] || "bg-secondary"}`}>
    {STATUS_LABEL[status] || status}
  </span>
);

export const EmptyState = ({ icon: Icon, title, hint }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6">
    {Icon && <div className="w-16 h-16 rounded-3xl bg-secondary flex items-center justify-center mb-4"><Icon size={30} weight="duotone" className="text-muted-foreground" /></div>}
    <p className="font-head font-bold text-base">{title}</p>
    {hint && <p className="text-sm text-muted-foreground mt-1 max-w-xs">{hint}</p>}
  </div>
);

export const Card = ({ children, className = "", ...p }) => (
  <div className={`bg-card rounded-3xl border border-border p-5 ${className}`} {...p}>{children}</div>
);

export const SectionTitle = ({ children, action }) => (
  <div className="flex items-center justify-between mb-3 mt-6 first:mt-0">
    <h2 className="font-head font-bold text-sm uppercase tracking-[0.15em] text-muted-foreground">{children}</h2>
    {action}
  </div>
);
