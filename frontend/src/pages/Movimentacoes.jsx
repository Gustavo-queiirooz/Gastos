import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/finance";
import { useData } from "@/context/DataContext";
import { toast } from "sonner";
import { EmptyState } from "@/components/common";
import {
  TrendUp,
  TrendDown,
  Trash,
} from "@phosphor-icons/react";

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

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/transactions?type=${type}`);
      setItems(data);
    } catch {
      toast.error("Erro ao carregar movimentações");
      setItems([]);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load, tick]);

  const remove = async (id) => {
    try {
      await api.del(`/transactions/${id}`);
      await load();
      refresh();
      toast.success("Removido");
    } catch {
      toast.error("Erro ao remover");
    }
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={type === "income" ? TrendUp : TrendDown}
        title={type === "income" ? "Nenhuma entrada" : "Nenhum gasto"}
        hint="Nenhuma movimentação encontrada."
      />
    );
  }

  return (
    <div className="space-y-2" data-testid={`txlist-${type}`}>
      {items.map((item) => (
        <div
          key={item.id}
          className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3"
          data-testid={`tx-item-${item.id}`}
        >
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">
              {item.description || item.title || "Movimentação"}
            </div>

            <div className="text-sm text-muted-foreground">
              {item.category_name ||
                item.category ||
                item.date ||
                ""}
            </div>
          </div>

          <div className="text-right">
            <div className="font-semibold">
              R$ {Number(item.amount || 0).toFixed(2).replace(".", ",")}
            </div>
          </div>

          <button
            onClick={() => remove(item.id)}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
            data-testid={`tx-delete-${item.id}`}
            type="button"
          >
            <Trash size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}

function Divididos() {
  const { refresh, tick } = useData();
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    try {
      const data = await api.get("/divididos");
      setItems(data);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  const personName = (item) =>
    item.person_name ||
    item.person ||
    item.nome ||
    "Pessoa";

  const receive = async (id) => {
    try {
      await api.put(`/divididos/${id}`, { recebido: true });
      await load();
      refresh();
      toast.success("Recebimento atualizado");
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhum valor dividido"
        hint="Nenhum valor dividido encontrado."
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">
              {personName(item)}
            </div>

            <div className="text-sm text-muted-foreground">
              {item.description || item.title || "Valor dividido"}
            </div>
          </div>

          <div className="text-right">
            <div className="font-semibold">
              R$ {Number(item.amount || 0).toFixed(2).replace(".", ",")}
            </div>

            {item.recebido && (
              <div className="text-xs text-muted-foreground">
                Recebido
              </div>
            )}
          </div>

          {!item.recebido && (
            <button
              onClick={() => receive(item.id)}
              className="text-primary hover:opacity-80 transition-colors p-1"
              type="button"
            >
              Receber
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Movimentacoes() {
  const [tab, setTab] = useState("gastos");
  const [cfg, setCfg] = useState({});

  const onCfg = (data) => {
    setCfg(data || {});
  };

  const setTabSafe = (id) => {
    setTab(id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-head text-2xl font-bold">
          Movimentações
        </h1>

        <p className="text-muted-foreground">
          Gerencie seus gastos, entradas e demais informações financeiras.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTabSafe(item.id)}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${
              tab === item.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "gastos" && <TxList type="expense" />}

        {tab === "entradas" && <TxList type="income" />}

        {tab === "divididos" && <Divididos />}

        {tab === "contas" && (
          <EmptyState
            title="Contas"
            hint="Gerencie suas contas cadastradas."
          />
        )}

        {tab === "cartoes" && (
          <EmptyState
            title="Cartões"
            hint="Gerencie seus cartões cadastrados."
          />
        )}

        {tab === "categorias" && (
          <EmptyState
            title="Categorias"
            hint="Gerencie suas categorias."
          />
        )}

        {tab === "pessoas" && (
          <EmptyState
            title="Pessoas"
            hint="Gerencie as pessoas cadastradas."
          />
        )}
      </div>
    </div>
  );
}

export default Movimentacoes;
