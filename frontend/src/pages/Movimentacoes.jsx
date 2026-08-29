import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/finance";
import { useData } from "@/context/DataContext";
import { toast } from "sonner";
import { EmptyState } from "@/components/common";
import {
  TrendUp,
  TrendDown,
  Trash,
  UserPlus,
  Users,
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

/* =========================================================
   PESSOAS
   ========================================================= */

function Pessoas() {
  const { refresh, tick } = useData();

  const [people, setPeople] = useState([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get("/people");
      setPeople(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar pessoas");
      setPeople([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  const addPerson = async (e) => {
    e.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      toast.error("Digite o nome da pessoa");
      return;
    }

    try {
      setSaving(true);

      await api.post("/people", {
        name: cleanName,
        note: note.trim() || null,
      });

      setName("");
      setNote("");

      await load();
      refresh();

      toast.success("Pessoa cadastrada");
    } catch {
      toast.error("Erro ao cadastrar pessoa");
    } finally {
      setSaving(false);
    }
  };

  const removePerson = async (id) => {
    const confirmDelete = window.confirm(
      "Tem certeza que deseja excluir esta pessoa?"
    );

    if (!confirmDelete) return;

    try {
      await api.del(`/people/${id}`);

      await load();
      refresh();

      toast.success("Pessoa excluída");
    } catch {
      toast.error("Erro ao excluir pessoa");
    }
  };

  return (
    <div className="space-y-4">
      {/* Cadastro */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserPlus
              size={21}
              weight="duotone"
              className="text-primary"
            />
          </div>

          <div>
            <h2 className="font-head font-bold text-base">
              Nova pessoa
            </h2>

            <p className="text-xs text-muted-foreground">
              Cadastre alguém para usar nos valores divididos.
            </p>
          </div>
        </div>

        <form onSubmit={addPerson} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Nome
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: João"
              className="w-full h-11 px-3 rounded-xl border border-border bg-background outline-none focus:border-primary transition-colors"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Observação
              <span className="text-muted-foreground font-normal">
                {" "}
                (opcional)
              </span>
            </label>

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: amigo, irmão, colega..."
              className="w-full h-11 px-3 rounded-xl border border-border bg-background outline-none focus:border-primary transition-colors"
              disabled={saving}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Cadastrando..." : "Cadastrar pessoa"}
          </button>
        </form>
      </div>

      {/* Lista */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users
            size={18}
            weight="duotone"
            className="text-muted-foreground"
          />

          <h2 className="font-head font-bold text-sm uppercase tracking-[0.12em] text-muted-foreground">
            Pessoas cadastradas
          </h2>
        </div>

        {people.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-6 text-center">
            <Users
              size={30}
              weight="duotone"
              className="mx-auto mb-2 text-muted-foreground"
            />

            <p className="font-medium text-sm">
              Nenhuma pessoa cadastrada
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              Cadastre a primeira pessoa acima.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {people.map((person) => (
              <div
                key={person.id}
                className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <span className="font-bold text-primary">
                    {person.name?.charAt(0)?.toUpperCase() || "P"}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {person.name}
                  </p>

                  {person.note && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {person.note}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removePerson(person.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-2"
                  title="Excluir pessoa"
                  aria-label={`Excluir ${person.name}`}
                >
                  <Trash size={19} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   MOVIMENTAÇÕES
   ========================================================= */

function Movimentacoes() {
  const [tab, setTab] = useState("gastos");

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

        {tab === "pessoas" && <Pessoas />}
      </div>
    </div>
  );
}

export default Movimentacoes;
