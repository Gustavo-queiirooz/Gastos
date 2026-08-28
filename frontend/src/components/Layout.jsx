import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { House, ArrowsLeftRight, CalendarCheck, Target, ChartBar, Plus } from "@phosphor-icons/react";
import QuickExpenseModal from "@/components/QuickExpenseModal";

const NAV = [
  { to: "/", label: "Início", Icon: House, end: true },
  { to: "/movimentacoes", label: "Movimentações", Icon: ArrowsLeftRight },
  { to: "/compromissos", label: "Compromissos", Icon: CalendarCheck },
  { to: "/planejamento", label: "Planejamento", Icon: Target },
  { to: "/relatorios", label: "Relatórios", Icon: ChartBar },
];

export default function Layout({ children }) {
  const [modalOpen, setModalOpen] = useState(false);
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-head font-extrabold">M</div>
          <span className="font-head font-extrabold text-lg tracking-tight">Meu Bolso</span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={`nav-${n.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`
              }
            >
              <n.Icon size={22} weight="duotone" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button
          data-testid="fab-desktop"
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground h-12 rounded-2xl font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={20} weight="bold" /> Lançar
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-28 md:pb-8 max-w-3xl mx-auto w-full">
        {children}
      </main>

      {/* Mobile FAB */}
      <button
        data-testid="fab-mobile"
        onClick={() => setModalOpen(true)}
        className="md:hidden fixed bottom-24 right-5 z-40 w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus size={30} weight="bold" />
      </button>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass border-t border-border">
        <div className="flex items-stretch justify-around h-[70px] px-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={`bottomnav-${n.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`
              }
            >
              <n.Icon size={24} weight={loc.pathname === n.to ? "fill" : "duotone"} />
              <span className="text-[10px] font-medium leading-none">{n.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <QuickExpenseModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
