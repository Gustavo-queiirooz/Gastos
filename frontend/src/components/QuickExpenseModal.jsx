import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { api, today, brl } from "@/lib/finance";
import { useData } from "@/context/DataContext";
import { toast } from "sonner";

import {
  X,
  ForkKnife,
  GasPump,
  ShoppingCart,
  Coffee,
  Car,
} from "@phosphor-icons/react";

const SHORTCUTS = [
  {
    label: "Alimentação",
    cat: "Alimentação",
    Icon: ForkKnife,
  },
  {
    label: "Combustível",
    cat: "Carro",
    Icon: GasPump,
  },
  {
    label: "Mercado",
    cat: "Mercado",
    Icon: ShoppingCart,
  },
  {
    label: "Café",
    cat: "Alimentação",
    Icon: Coffee,
  },
  {
    label: "Carro",
    cat: "Carro",
    Icon: Car,
  },
];

const PAYMENTS = [
  { v: "dinheiro", l: "Dinheiro" },
  { v: "pix", l: "Pix" },
  { v: "debito", l: "Débito" },
  { v: "credito", l: "Crédito" },
  { v: "boleto", l: "Boleto" },
];

export default function QuickExpenseModal({
  open,
  onOpenChange,
  defaultType = "expense",
}) {
  const {
    categories,
    accounts,
    cards,
    people: contextPeople,
    refresh,
  } = useData();

  const [type, setType] = useState(defaultType);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(today());
  const [payment, setPayment] = useState("pix");

  const [accountId, setAccountId] = useState("");
  const [cardId, setCardId] = useState("");

  const [note, setNote] = useState("");
  const [more, setMore] = useState(false);

  const [installments, setInstallments] = useState(1);

  const [isSplit, setIsSplit] = useState(false);
  const [myShare, setMyShare] = useState("");
  const [personId, setPersonId] = useState("");

  const [incomeCat, setIncomeCat] = useState("Salário");

  const [saving, setSaving] = useState(false);

  // Pessoas carregadas diretamente da API
  const [people, setPeople] = useState([]);

  /*
   * Carrega as pessoas diretamente quando o modal abre.
   *
   * Isso evita depender exclusivamente do DataContext
   * e também permite lidar com diferentes formatos de resposta.
   */
  useEffect(() => {
    if (!open) return;

    const loadPeople = async () => {
      try {
        const response = await api.get("/people");

        let list = [];

        if (Array.isArray(response)) {
          list = response;
        } else if (Array.isArray(response?.people)) {
          list = response.people;
        } else if (Array.isArray(response?.data)) {
          list = response.data;
        }

        // Se a API não retornar nada, tenta usar o contexto
        if (list.length === 0 && Array.isArray(contextPeople)) {
          list = contextPeople;
        }

        setPeople(list);
      } catch (error) {
        console.error("Erro ao carregar pessoas:", error);

        // Usa o contexto como fallback
        setPeople(Array.isArray(contextPeople) ? contextPeople : []);
      }
    };

    loadPeople();
  }, [open, contextPeople]);

  /*
   * Inicialização do formulário
   */
  useEffect(() => {
    if (!open) return;

    setType(defaultType);

    setAmount("");
    setDescription("");
    setCategory("");
    setDate(today());

    setPayment("pix");

    setNote("");
    setMore(false);

    setInstallments(1);

    setIsSplit(false);
    setMyShare("");
    setPersonId("");

    setIncomeCat("Salário");

    setAccountId(accounts[0]?.id || "");
    setCardId("");
  }, [open, defaultType, accounts]);

  const expenseCats = categories.filter(
    (c) => c.type === "expense"
  );

  const incomeCats = categories.filter(
    (c) => c.type === "income"
  );

  const save = async () => {
    const val = parseFloat(
      String(amount).replace(",", ".")
    );

    if (!val || val <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    /*
     * Se estiver dividindo, exige pessoa e valor da sua parte.
     */
    if (type === "expense" && isSplit) {
      const share = parseFloat(
        String(myShare).replace(",", ".")
      );

      if (!share || share <= 0) {
        toast.error("Informe sua parte da despesa");
        return;
      }

      if (!personId) {
        toast.error("Selecione quem participou da despesa");
        return;
      }

      if (share > val) {
        toast.error(
          "Sua parte não pode ser maior que o valor total"
        );
        return;
      }
    }

    setSaving(true);

    try {
      if (type === "expense") {
        const body = {
          type: "expense",
          amount: val,
          description,
          category: category || "Outros",
          date,
          payment_method: payment,
          account_id: accountId || null,

          card_id:
            payment === "credito"
              ? cardId || null
              : null,

          note,

          installments:
            payment === "credito"
              ? Number(installments) || 1
              : 1,
        };

        /*
         * Despesa dividida
         */
        if (isSplit && myShare && personId) {
          body.is_split = true;
          body.split_total = val;

          body.my_share = parseFloat(
            String(myShare).replace(",", ".")
          );

          body.person_id = personId;
        }

        await api.post("/transactions", body);
      } else {
        /*
         * Entrada
         */
        await api.post("/transactions", {
          type: "income",
          amount: val,
          description,
          income_category: incomeCat,
          category: incomeCat,
          date,
          account_id: accountId || null,
        });
      }

      toast.success(
        type === "expense"
          ? "Gasto lançado!"
          : "Entrada lançada!"
      );

      refresh();

      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar movimentação:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        className="max-w-md p-0 gap-0 rounded-3xl overflow-hidden border-0"
        data-testid="quick-entry-modal"
      >
        {/* CABEÇALHO */}
        <div className="bg-primary text-primary-foreground p-5 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-head font-bold tracking-tight">
              Lançar movimentação
            </h2>

            <button
              onClick={() => onOpenChange(false)}
              data-testid="close-modal-btn"
              className="opacity-70 hover:opacity-100 transition-opacity"
              type="button"
            >
              <X size={22} />
            </button>
          </div>

          {/* TIPO */}
          <div className="flex bg-white/10 rounded-full p-1 mb-4">
            <button
              data-testid="type-expense-btn"
              onClick={() => setType("expense")}
              type="button"
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition-colors ${
                type === "expense"
                  ? "bg-white text-primary"
                  : "text-white/80"
              }`}
            >
              Gasto
            </button>

            <button
              data-testid="type-income-btn"
              onClick={() => setType("income")}
              type="button"
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition-colors ${
                type === "income"
                  ? "bg-white text-primary"
                  : "text-white/80"
              }`}
            >
              Entrada
            </button>
          </div>

          {/* VALOR */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold opacity-70">
              R$
            </span>

            <input
              data-testid="amount-input"
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value)
              }
              placeholder="0,00"
              className="bg-transparent text-4xl font-head font-extrabold w-full outline-none placeholder:text-white/40 tabular"
            />
          </div>
        </div>

        {/* FORMULÁRIO */}
        <div className="p-5 space-y-4 max-h-[52vh] overflow-y-auto no-scrollbar">
          {/* ATALHOS */}
          {type === "expense" && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
              {SHORTCUTS.map((s) => (
                <button
                  key={s.label}
                  data-testid={`shortcut-${s.cat.toLowerCase()}`}
                  type="button"
                  onClick={() => {
                    setCategory(s.cat);
                    setDescription(s.label);
                  }}
                  className={`flex flex-col items-center gap-1 min-w-[68px] py-2 rounded-2xl border transition-colors ${
                    category === s.cat
                      ? "border-primary bg-secondary"
                      : "border-border"
                  }`}
                >
                  <s.Icon
                    size={22}
                    weight="duotone"
                  />

                  <span className="text-[11px] font-medium">
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* DESCRIÇÃO */}
          <div className="space-y-1.5">
            <Label>Descrição</Label>

            <Input
              data-testid="description-input"
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              placeholder="Ex: Almoço"
            />
          </div>

          {/* CATEGORIA + PAGAMENTO */}
          {type === "expense" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>

                <Select
                  value={category}
                  onValueChange={setCategory}
                >
                  <SelectTrigger data-testid="category-select">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>

                  <SelectContent>
                    {expenseCats.map((c) => (
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

              <div className="space-y-1.5">
                <Label>Pagamento</Label>

                <Select
                  value={payment}
                  onValueChange={setPayment}
                >
                  <SelectTrigger data-testid="payment-select">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {PAYMENTS.map((p) => (
                      <SelectItem
                        key={p.v}
                        value={p.v}
                      >
                        {p.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Categoria da entrada</Label>

              <Select
                value={incomeCat}
                onValueChange={setIncomeCat}
              >
                <SelectTrigger data-testid="income-category-select">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {incomeCats.map((c) => (
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

          {/* DATA + CONTA */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>

              <Input
                data-testid="date-input"
                type="date"
                value={date}
                onChange={(e) =>
                  setDate(e.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Conta</Label>

              <Select
                value={accountId}
                onValueChange={setAccountId}
              >
                <SelectTrigger data-testid="account-select">
                  <SelectValue placeholder="Conta" />
                </SelectTrigger>

                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem
                      key={a.id}
                      value={a.id}
                    >
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* CARTÃO */}
          {type === "expense" &&
            payment === "credito" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cartão</Label>

                  <Select
                    value={cardId}
                    onValueChange={setCardId}
                  >
                    <SelectTrigger data-testid="card-select">
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
                  <Label>Parcelas</Label>

                  <Input
                    data-testid="installments-input"
                    type="number"
                    min="1"
                    value={installments}
                    onChange={(e) =>
                      setInstallments(e.target.value)
                    }
                  />
                </div>
              </div>
            )}

          {/* MAIS OPÇÕES */}
          {type === "expense" && (
            <button
              onClick={() => setMore(!more)}
              type="button"
              className="text-sm text-primary font-semibold"
              data-testid="toggle-more-btn"
            >
              {more
                ? "− Menos opções"
                : "+ Mais opções (dividir, observação)"}
            </button>
          )}

          {/* DIVIDIR */}
          {more && type === "expense" && (
            <div className="space-y-4 rise">
              <div className="flex items-center justify-between rounded-2xl border p-3">
                <div>
                  <p className="font-semibold text-sm">
                    Dividir despesa
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Registra só a sua parte
                  </p>
                </div>

                <Switch
                  data-testid="split-switch"
                  checked={isSplit}
                  onCheckedChange={setIsSplit}
                />
              </div>

              {isSplit && (
                <div className="space-y-4 rise">
                  {/* SUA PARTE */}
                  <div className="space-y-1.5">
                    <Label>Sua parte (R$)</Label>

                    <Input
                      data-testid="my-share-input"
                      inputMode="decimal"
                      value={myShare}
                      onChange={(e) =>
                        setMyShare(e.target.value)
                      }
                      placeholder="0,00"
                    />
                  </div>

                  {/* PESSOA */}
                  <div className="space-y-1.5">
                    <Label>Pessoa</Label>

                    <Select
                      value={personId}
                      onValueChange={setPersonId}
                    >
                      <SelectTrigger
                        data-testid="split-person-select"
                        className="w-full"
                      >
                        <SelectValue placeholder="Quem?" />
                      </SelectTrigger>

                      <SelectContent
                        position="popper"
                        className="z-[9999]"
                      >
                        {people.length > 0 ? (
                          people.map((person) => (
                            <SelectItem
                              key={person.id}
                              value={String(person.id)}
                            >
                              {person.name ||
                                person.nome ||
                                "Pessoa"}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem
                            value="__none__"
                            disabled
                          >
                            Nenhuma pessoa cadastrada
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    {/* Informação útil */}
                    {people.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Cadastre uma pessoa para poder
                        dividir esta despesa.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* OBSERVAÇÃO */}
              <div className="space-y-1.5">
                <Label>Observação</Label>

                <Textarea
                  data-testid="note-input"
                  value={note}
                  onChange={(e) =>
                    setNote(e.target.value)
                  }
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        {/* SALVAR */}
        <div className="p-4 border-t">
          <Button
            data-testid="save-entry-btn"
            onClick={save}
            disabled={saving}
            className="w-full h-12 rounded-2xl text-base font-semibold"
          >
            {saving
              ? "Salvando..."
              : `Salvar ${
                  amount
                    ? brl(
                        parseFloat(
                          String(amount).replace(
                            ",",
                            "."
                          )
                        ) || 0
                      )
                    : ""
                }`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
