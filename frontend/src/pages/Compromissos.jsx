import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  api,
  brl,
  fmtDate,
  fmtDateShort,
  daysUntil,
  today,
} from "@/lib/finance";
import { useData } from "@/context/DataContext";
import {
  PageHeader,
  EmptyState,
  Money,
  StatusBadge,
  Card,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CalendarCheck,
  WarningCircle,
  Repeat,
  CreditCard,
  Bank,
  HandCoins,
  Plus,
  Trash,
  CheckCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";

const TABS = [
  { id: "vencimentos", label: "Vencimentos" },
  { id: "atrasadas", label: "Atrasadas" },
  { id: "fixos", label: "Gastos fixos" },
  { id: "cartoes", label: "Parcelamentos" },
  { id: "emprestimos", label: "Empréstimos" },
  { id: "receber", label: "A receber" },
];

const FILTERS = [
  { id: "todos", label: "Todos", days: null },
  { id: "hoje", label: "Hoje", days: 0 },
  { id: "7", label: "7 dias", days: 7 },
  { id: "30", label: "30 dias", days: 30 },
  { id: "90", label: "3 meses", days: 90 },
  { id: "180", label: "6 meses", days: 180 },
  { id: "365", label: "12 meses", days: 365 },
];

function Vencimentos({ onlyOverdue }) {
  const { categories, refresh, tick } = useData();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("todos");
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    description: "",
    amount: "",
    due_date: today(),
    category: "",
  });

  const load = () => api.get("/commitments").then(setItems);

  useEffect(() => {
    load();
  }, [tick]);

  const pay = async (id) => {
    await api.post(`/commitments/${id}/pay`);
    toast.success("Pago! Registrado como gasto.");
    load();
    refresh();
  };

  const remove = async (id) => {
    await api.del(`/commitments/${id}`);
    load();
    refresh();
  };

  const cancel = async (id) => {
    await api.put(`/commitments/${id}`, { status: "cancelado" });
    load();
    refresh();
  };

  const add = async () => {
    const v = parseFloat(String(form.amount).replace(",", "."));

    if (!v || !form.description) {
      return toast.error("Preencha descrição e valor");
    }

    await api.post("/commitments", {
      description: form.description,
      amount: v,
      due_date: form.due_date,
      category: form.category || "Contas",
      status: "a_vencer",
      origin: "manual",
    });

    toast.success("Compromisso criado");

    setOpen(false);

    setForm({
      description: "",
      amount: "",
      due_date: today(),
      category: "",
    });

    load();
    refresh();
  };

  /*
   * ============================================================
   * FILTRO DOS COMPROMISSOS
   * ============================================================
   *
   * IMPORTANTE:
   * Contas atrasadas continuam sendo compromissos pendentes.
   *
   * Portanto:
   * - Não desaparecem quando muda o mês.
   * - Continuam aparecendo em "Vencimentos".
   * - Também aparecem na aba "Atrasadas".
   * - Só deixam de aparecer quando forem pagas ou canceladas.
   */

  let filtered = items;

  if (onlyOverdue) {
    // Aba "Atrasadas"
    filtered = items.filter((c) => c.status === "atrasado");
  } else {
    const f = FILTERS.find((x) => x.id === filter);

    // Tudo que ainda está pendente.
    // Atrasados NÃO são removidos daqui.
    const pending = items.filter(
      (c) =>
        c.status !== "pago" &&
        c.status !== "cancelado"
    );

    if (f && f.days != null) {
      filtered = pending.filter((c) => {
        /*
         * Atrasados sempre permanecem visíveis,
         * independentemente do filtro escolhido.
         */
        if (c.status === "atrasado") {
          return true;
        }

        const du = daysUntil(c.due_date);

        /*
         * Compromissos futuros obedecem ao período escolhido.
         */
        return (
          du != null &&
          du >= 0 &&
          du <= f.days
        );
      });
    } else {
      /*
       * "Todos":
       * mostra todos os compromissos pendentes,
       * incluindo atrasados e compromissos futuros.
       */
      filtered = pending;
    }
  }

  const selectedFilter = FILTERS.find(
    (f) => f.id === filter
  );

  const filteredTotal = filtered.reduce(
    (sum, c) => sum + (c.amount || 0),
    0
  );

  const totalOverdue = items
    .filter((c) => c.status === "atrasado")
    .reduce((s, c) => s + c.amount, 0);

  return (
    <div
      data-testid={
        onlyOverdue
          ? "atrasadas-tab"
          : "vencimentos-tab"
      }
    >
      {onlyOverdue ? (
        <Card className="mb-4 bg-destructive text-destructive-foreground border-0">
          <p className="text-xs uppercase tracking-[0.2em] opacity-80 font-semibold">
            Total atrasado
          </p>

          <p className="tabular font-head font-extrabold text-3xl mt-1">
            {brl(totalOverdue)}
          </p>

          <p className="text-sm opacity-90 mt-1">
            {
              items.filter(
                (c) => c.status === "atrasado"
              ).length
            }{" "}
            conta(s) em atraso
          </p>
        </Card>
      ) : (
        <>
          <Button
            onClick={() => setOpen(true)}
            className="w-full h-11 rounded-2xl mb-3 gap-2"
            data-testid="add-commitment-btn"
          >
            <Plus size={18} weight="bold" />
            Novo compromisso
          </Button>

          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-1 px-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                data-testid={`filter-${f.id}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  filter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}

      {!onlyOverdue && filtered.length > 0 && (
        <Card className="mb-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-semibold">
                {selectedFilter?.days === 0
                  ? "Vencimentos de hoje"
                  : selectedFilter?.days
                  ? `Próximos ${selectedFilter.days} dias`
                  : "Total dos vencimentos"}
              </p>

              <p className="font-head font-extrabold text-2xl mt-1">
                {brl(filteredTotal)}
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                {filtered.length} compromisso
                {filtered.length !== 1 ? "s" : ""}
              </p>
            </div>

            <CalendarCheck
              size={28}
              weight="duotone"
              className="text-primary"
            />
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={
            onlyOverdue
              ? WarningCircle
              : CalendarCheck
          }
          title={
            onlyOverdue
              ? "Nenhuma conta atrasada 🎉"
              : "Nenhum vencimento"
          }
          hint={
            onlyOverdue
              ? ""
              : "Gastos fixos, parcelas e empréstimos aparecem aqui."
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const du = daysUntil(c.due_date);

            const near =
              c.status === "a_vencer" &&
              du != null &&
              du <= 3;

            return (
              <div
                key={c.id}
                className={`bg-card rounded-2xl border p-4 ${
                  c.status === "atrasado"
                    ? "border-destructive/40"
                    : near
                    ? "border-[hsl(var(--committed))]/40"
                    : "border-border"
                }`}
                data-testid={`commitment-${c.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {c.description}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {fmtDate(c.due_date)} ·{" "}
                      {c.category} · {c.origin}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <Money
                      value={c.amount}
                      className="text-sm"
                    />

                    <div className="mt-1">
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                </div>

                {c.status !== "pago" &&
                  c.status !== "cancelado" && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="rounded-full h-8 gap-1 flex-1"
                        onClick={() => pay(c.id)}
                        data-testid={`pay-btn-${c.id}`}
                      >
                        <CheckCircle size={15} />
                        Pagar
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full h-8"
                        onClick={() => cancel(c.id)}
                        data-testid={`cancel-btn-${c.id}`}
                      >
                        Cancelar
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full h-8 w-8 p-0"
                        onClick={() => remove(c.id)}
                      >
                        <Trash size={15} />
                      </Button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-head">
              Novo compromisso
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Descrição</Label>

              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
                data-testid="commit-desc-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>

              <Input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    amount: e.target.value,
                  })
                }
                data-testid="commit-amount-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Vencimento</Label>

              <Input
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    due_date: e.target.value,
                  })
                }
                data-testid="commit-date-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Categoria</Label>

              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    category: v,
                  })
                }
              >
                <SelectTrigger data-testid="commit-cat-select">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>

                <SelectContent>
                  {categories
                    .filter(
                      (c) => c.type === "expense"
                    )
                    .map((c) => (
                      <SelectItem
                        key={c.id}
                        value={c.name}
                      >
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={add}
              className="w-full h-11 rounded-2xl"
              data-testid="save-commit-btn"
            >
              Criar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fixos() {
  const {
    categories,
    accounts,
    refresh,
    tick,
  } = useData();

  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "",
    due_day: 5,
    type: "expense",
    variable: false,
    start_date: today(),
  });

  const load = () =>
    api.get("/recurring").then(setItems);

  useEffect(() => {
    load();
  }, [tick]);

  const add = async () => {
    const v = parseFloat(
      String(form.amount).replace(",", ".")
    );

    if (!form.name || !v) {
      return toast.error(
        "Preencha nome e valor"
      );
    }

    await api.post("/recurring", {
      ...form,
      amount: v,
      due_day: Number(form.due_day),
      months_ahead: 12,
    });

    toast.success(
      "Gasto fixo criado — próximos meses gerados"
    );

    setOpen(false);

    setForm({
      name: "",
      amount: "",
      category: "",
      due_day: 5,
      type: "expense",
      variable: false,
      start_date: today(),
    });

    load();
    refresh();
  };

  const remove = async (id) => {
    await api.del(`/recurring/${id}`);
    load();
    refresh();
    toast.success("Removido");
  };

  return (
    <div data-testid="fixos-tab">
      <Button
        onClick={() => setOpen(true)}
        className="w-full h-11 rounded-2xl mb-4 gap-2"
        data-testid="add-recurring-btn"
      >
        <Plus size={18} weight="bold" />
        Novo gasto fixo
      </Button>

      {items.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Nenhum gasto fixo"
          hint="Cadastre aluguel, internet, assinaturas... e o app gera os próximos meses."
        />
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div
              key={r.id}
              className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3"
              data-testid={`recurring-${r.id}`}
            >
              <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center">
                <Repeat
                  size={18}
                  weight="duotone"
                  className="text-primary"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {r.name}
                </p>

                <p className="text-xs text-muted-foreground">
                  {r.type === "income"
                    ? "Entrada"
                    : r.category}{" "}
                  · vence dia {r.due_day}
                  {r.variable
                    ? " · variável"
                    : ""}
                </p>
              </div>

              <Money
                value={r.amount}
                positive={r.type === "income"}
                className="text-sm"
              />

              <button
                onClick={() => remove(r.id)}
                className="text-muted-foreground hover:text-destructive p-1"
                data-testid={`recurring-delete-${r.id}`}
              >
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-head">
              Novo gasto fixo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>

              <Input
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                placeholder="Ex: Aluguel"
                data-testid="rec-name-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>

                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amount: e.target.value,
                    })
                  }
                  data-testid="rec-amount-input"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Dia venc.</Label>

                <Input
                  type="number"
                  value={form.due_day}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      due_day: e.target.value,
                    })
                  }
                  data-testid="rec-day-input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>

              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    type: v,
                  })
                }
              >
                <SelectTrigger data-testid="rec-type-select">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="expense">
                    Despesa
                  </SelectItem>

                  <SelectItem value="income">
                    Entrada recorrente
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.type === "expense" && (
              <div className="space-y-1.5">
                <Label>Categoria</Label>

                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      category: v,
                    })
                  }
                >
                  <SelectTrigger data-testid="rec-cat-select">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>

                  <SelectContent>
                    {categories
                      .filter(
                        (c) =>
                          c.type === "expense"
                      )
                      .map((c) => (
                        <SelectItem
                          key={c.id}
                          value={c.name}
                        >
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between rounded-2xl border p-3">
              <span className="text-sm font-medium">
                Valor variável
              </span>

              <Switch
                checked={form.variable}
                onCheckedChange={(v) =>
                  setForm({
                    ...form,
                    variable: v,
                  })
                }
                data-testid="rec-variable-switch"
              />
            </div>

            <Button
              onClick={add}
              className="w-full h-11 rounded-2xl"
              data-testid="save-recurring-btn"
            >
              Criar e gerar meses
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Parcelamentos() {
  const {
    cards,
    categories,
    refresh,
    tick,
  } = useData();

  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    description: "",
    total: "",
    installments: 6,
    card_id: "",
    category: "Compras",
    first_due_date: today(),
  });

  const load = () =>
    api
      .get("/installment-purchases")
      .then(setItems);

  useEffect(() => {
    load();
  }, [tick]);

  const add = async () => {
    const v = parseFloat(
      String(form.total).replace(",", ".")
    );

    if (!form.description || !v) {
      return toast.error(
        "Preencha descrição e valor"
      );
    }

    await api.post(
      "/installment-purchases",
      {
        ...form,
        total: v,
        installments: Number(
          form.installments
        ),
      }
    );

    toast.success(
      "Parcelamento criado — parcelas geradas por mês"
    );

    setOpen(false);

    setForm({
      description: "",
      total: "",
      installments: 6,
      card_id: "",
      category: "Compras",
      first_due_date: today(),
    });

    load();
    refresh();
  };

  return (
    <div data-testid="parcelamentos-tab">
      <Button
        onClick={() => setOpen(true)}
        className="w-full h-11 rounded-2xl mb-4 gap-2"
        data-testid="add-installment-btn"
      >
        <Plus size={18} weight="bold" />
        Nova compra parcelada
      </Button>

      {items.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum parcelamento"
          hint="Compra em 6x vira 6 parcelas, uma por mês, como compromisso."
        />
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div
              key={p.id}
              className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3"
              data-testid={`installment-${p.id}`}
            >
              <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center">
                <CreditCard
                  size={18}
                  weight="duotone"
                  className="text-primary"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {p.description}
                </p>

                <p className="text-xs text-muted-foreground">
                  {p.installments}x de{" "}
                  {brl(
                    p.total /
                      p.installments
                  )}{" "}
                  ·{" "}
                  {cards.find(
                    (c) => c.id === p.card_id
                  )?.name || "cartão"}
                </p>
              </div>

              <Money
                value={p.total}
                className="text-sm"
              />
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-head">
              Compra parcelada
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Descrição</Label>

              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description:
                      e.target.value,
                  })
                }
                data-testid="inst-desc-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Valor total (R$)
                </Label>

                <Input
                  inputMode="decimal"
                  value={form.total}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      total: e.target.value,
                    })
                  }
                  data-testid="inst-total-input"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Parcelas</Label>

                <Input
                  type="number"
                  value={
                    form.installments
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      installments:
                        e.target.value,
                    })
                  }
                  data-testid="inst-count-input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cartão</Label>

              <Select
                value={form.card_id}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    card_id: v,
                  })
                }
              >
                <SelectTrigger data-testid="inst-card-select">
                  <SelectValue placeholder="Cartão" />
                </SelectTrigger>

                <SelectContent>
                  {cards.map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                    >
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>1ª parcela em</Label>

              <Input
                type="date"
                value={
                  form.first_due_date
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    first_due_date:
                      e.target.value,
                  })
                }
                data-testid="inst-date-input"
              />
            </div>

            {form.total &&
              form.installments > 0 && (
                <p className="text-sm text-muted-foreground">
                  ={" "}
                  {form.installments}x de{" "}
                  {brl(
                    (parseFloat(
                      String(
                        form.total
                      ).replace(
                        ",",
                        "."
                      )
                    ) || 0) /
                      form.installments
                  )}
                </p>
              )}

            <Button
              onClick={add}
              className="w-full h-11 rounded-2xl"
              data-testid="save-installment-btn"
            >
              Gerar parcelas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Emprestimos() {
  const {
    people,
    refresh,
    tick,
  } = useData();

  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    kind: "borrowed",
    institution: "",
    person_id: "",
    principal: "",
    installment_value: "",
    installments_total: 1,
    installments_paid: 0,
    first_due_date: today(),
  });

  const load = () =>
    api.get("/loans").then(setItems);

  useEffect(() => {
    load();
  }, [tick]);

  const add = async () => {
    const body = {
      ...form,
      principal:
        parseFloat(
          String(form.principal).replace(
            ",",
            "."
          )
        ) || 0,
      installment_value:
        parseFloat(
          String(
            form.installment_value
          ).replace(",", ".")
        ) || 0,
      installments_total: Number(
        form.installments_total
      ),
      installments_paid: Number(
        form.installments_paid
      ),
    };

    if (
      !body.installment_value ||
      !body.installments_total
    ) {
      return toast.error(
        "Preencha valor da parcela e quantidade"
      );
    }

    await api.post("/loans", body);

    toast.success(
      form.kind === "borrowed"
        ? "Dívida cadastrada"
        : "Empréstimo cadastrado"
    );

    setOpen(false);

    setForm({
      kind: "borrowed",
      institution: "",
      person_id: "",
      principal: "",
      installment_value: "",
      installments_total: 1,
      installments_paid: 0,
      first_due_date: today(),
    });

    load();
    refresh();
  };

  const remove = async (id) => {
    await api.del(`/loans/${id}`);
    load();
    refresh();
    toast.success("Removido");
  };

  return (
    <div data-testid="emprestimos-tab">
      <Button
        onClick={() => setOpen(true)}
        className="w-full h-11 rounded-2xl mb-4 gap-2"
        data-testid="add-loan-btn"
      >
        <Plus size={18} weight="bold" />
        Novo empréstimo/dívida
      </Button>

      {items.length === 0 ? (
        <EmptyState
          icon={Bank}
          title="Nada cadastrado"
          hint="Registre dívidas que você tem ou dinheiro que emprestou."
        />
      ) : (
        <div className="space-y-2">
          {items.map((l) => {
            const restante =
              (l.installments_total -
                l.installments_paid) *
              l.installment_value;

            return (
              <div
                key={l.id}
                className="bg-card rounded-2xl border border-border p-4"
                data-testid={`loan-${l.id}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">
                    {l.kind === "borrowed"
                      ? l.institution ||
                        "Empréstimo"
                      : people.find(
                          (p) =>
                            p.id ===
                            l.person_id
                        )?.name ||
                        "Empréstimo a alguém"}
                  </p>

                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      l.kind === "borrowed"
                        ? "bg-destructive/12 text-destructive"
                        : "bg-[hsl(var(--receivable))]/12 text-[hsl(var(--receivable))]"
                    }`}
                  >
                    {l.kind === "borrowed"
                      ? "Devo"
                      : "A receber"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mt-1">
                  {l.installments_paid}/
                  {l.installments_total}{" "}
                  parcelas ·{" "}
                  {brl(
                    l.installment_value
                  )}{" "}
                  cada
                </p>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm">
                    Restante:{" "}
                    <Money
                      value={restante}
                      negative={
                        l.kind ===
                        "borrowed"
                      }
                    />
                  </span>

                  <button
                    onClick={() =>
                      remove(l.id)
                    }
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-head">
              Empréstimo / Dívida
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex bg-secondary rounded-full p-1">
              <button
                onClick={() =>
                  setForm({
                    ...form,
                    kind: "borrowed",
                  })
                }
                className={`flex-1 py-2 rounded-full text-sm font-semibold ${
                  form.kind === "borrowed"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
                data-testid="loan-borrowed-btn"
              >
                Eu peguei
              </button>

              <button
                onClick={() =>
                  setForm({
                    ...form,
                    kind: "lent",
                  })
                }
                className={`flex-1 py-2 rounded-full text-sm font-semibold ${
                  form.kind === "lent"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
                data-testid="loan-lent-btn"
              >
                Eu emprestei
              </button>
            </div>

            {form.kind ===
            "borrowed" ? (
              <div className="space-y-1.5">
                <Label>
                  Instituição
                </Label>

                <Input
                  value={
                    form.institution
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      institution:
                        e.target.value,
                    })
                  }
                  placeholder="Ex: Banco X"
                  data-testid="loan-institution-input"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Pessoa</Label>

                <Select
                  value={
                    form.person_id
                  }
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      person_id: v,
                    })
                  }
                >
                  <SelectTrigger data-testid="loan-person-select">
                    <SelectValue placeholder="Pessoa" />
                  </SelectTrigger>

                  <SelectContent>
                    {people.map((p) => (
                      <SelectItem
                        key={p.id}
                        value={p.id}
                      >
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Valor parcela
                </Label>

                <Input
                  inputMode="decimal"
                  value={
                    form.installment_value
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      installment_value:
                        e.target.value,
                    })
                  }
                  data-testid="loan-value-input"
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Nº parcelas
                </Label>

                <Input
                  type="number"
                  value={
                    form.installments_total
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      installments_total:
                        e.target.value,
                    })
                  }
                  data-testid="loan-count-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Já pagas</Label>

                <Input
                  type="number"
                  value={
                    form.installments_paid
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      installments_paid:
                        e.target.value,
                    })
                  }
                  data-testid="loan-paid-input"
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Próx. venc.
                </Label>

                <Input
                  type="date"
                  value={
                    form.first_due_date
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      first_due_date:
                        e.target.value,
                    })
                  }
                  data-testid="loan-date-input"
                />
              </div>
            </div>

            <Button
              onClick={add}
              className="w-full h-11 rounded-2xl"
              data-testid="save-loan-btn"
            >
              Cadastrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Receber() {
  const {
    people,
    refresh,
    tick,
  } = useData();

  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [amount, setAmount] = useState("");

  const load = () =>
    api.get("/receivables").then(setItems);

  useEffect(() => {
    load();
  }, [tick]);

  const personName = (id) =>
    people.find((p) => p.id === id)
      ?.name || "Alguém";

  const receive = async () => {
    const v = parseFloat(
      String(amount).replace(",", ".")
    );

    if (!v) return;

    await api.post(
      `/receivables/${sel.id}/receive`,
      { amount: v }
    );

    toast.success("Recebido!");
    setOpen(false);
    setAmount("");
    load();
    refresh();
  };

  const pending = items.filter(
    (i) => i.status !== "recebido"
  );

  const total = pending.reduce(
    (s, i) => s + (i.total - i.received),
    0
  );

  return (
    <div data-testid="receber-tab">
      <Card className="mb-4 bg-[hsl(var(--receivable))] text-white border-0">
        <p className="text-xs uppercase tracking-[0.2em] opacity-80 font-semibold">
          Total a receber
        </p>

        <p className="tabular font-head font-extrabold text-3xl mt-1">
          {brl(total)}
        </p>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Nada a receber"
          hint="Divida uma despesa ou empreste dinheiro para registrar aqui."
        />
      ) : (
        <div className="space-y-2">
          {[
            ...pending,
            ...items.filter(
              (i) => i.status === "recebido"
            ),
          ].map((r) => (
            <div
              key={r.id}
              className="bg-card rounded-2xl border border-border p-4"
              data-testid={`rec-${r.id}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">
                  {personName(r.person_id)}
                </p>

                <StatusBadge
                  status={r.status}
                />
              </div>

              <p className="text-xs text-muted-foreground mt-0.5">
                {r.description}
              </p>

              <div className="flex items-center justify-between mt-2">
                <span className="text-sm">
                  Falta{" "}
                  <Money
                    value={
                      r.total -
                      r.received
                    }
                    negative
                  />
                </span>

                {r.status !==
                  "recebido" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full h-8"
                    onClick={() => {
                      setSel(r);
                      setOpen(true);
                    }}
                    data-testid={`rec-receive-${r.id}`}
                  >
                    Receber
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-head">
              Receber
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Falta:{" "}
            {sel &&
              brl(
                sel.total -
                  sel.received
              )}
          </p>

          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) =>
              setAmount(
                e.target.value
              )
            }
            placeholder="0,00"
            data-testid="rec-amount-input"
          />

          <Button
            onClick={receive}
            className="rounded-2xl h-11"
            data-testid="confirm-rec-btn"
          >
            Confirmar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Compromissos() {
  const [params, setParams] =
    useSearchParams();

  const tab =
    params.get("tab") ||
    "vencimentos";

  const setTab = (t) =>
    setParams({ tab: t });

  return (
    <div className="rise">
      <PageHeader
        title="Compromissos"
        subtitle="Vencimentos, dívidas e recebimentos"
      />

      <div className="sticky top-[68px] z-10 glass border-b border-border">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() =>
                setTab(t.id)
              }
              data-testid={`ctab-${t.id}`}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {tab === "vencimentos" && (
          <Vencimentos />
        )}

        {tab === "atrasadas" && (
          <Vencimentos onlyOverdue />
        )}

        {tab === "fixos" && <Fixos />}

        {tab === "cartoes" && (
          <Parcelamentos />
        )}

        {tab === "emprestimos" && (
          <Emprestimos />
        )}

        {tab === "receber" && <Receber />}
      </div>
    </div>
  );
}
