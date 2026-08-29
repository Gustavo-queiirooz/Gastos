from datetime import date, datetime
from db import db


def month_key(d: str) -> str:
    """From YYYY-MM-DD -> YYYY-MM"""
    if not d:
        return ""
    return d[:7]


def current_month_key() -> str:
    return date.today().strftime("%Y-%m")


def add_months(y: int, m: int, delta: int):
    idx = (y * 12 + (m - 1)) + delta
    return idx // 12, (idx % 12) + 1


async def fetch_all(coll: str, query=None):
    return await db[coll].find(
        query or {},
        {"_id": 0}
    ).to_list(100000)


async def refresh_overdue():
    """
    Marca compromissos a_vencer cujo vencimento já passou
    como atrasado.
    """
    today = date.today().isoformat()

    await db.commitments.update_many(
        {
            "status": "a_vencer",
            "due_date": {"$lt": today}
        },
        {
            "$set": {
                "status": "atrasado"
            }
        },
    )


async def compute_current_balance():
    """
    Calcula o saldo real atual das contas.

    Importante:
    - Entradas aumentam o saldo.
    - Despesas já registradas diminuem o saldo.
    - Compromissos futuros NÃO alteram o saldo aqui.
    """
    accounts = await fetch_all("accounts")

    balance = sum(
        a.get("initial_balance", 0) or 0
        for a in accounts
    )

    txs = await fetch_all("transactions")

    for t in txs:
        amount = t.get("amount", 0) or 0

        if t.get("type") == "income":
            balance += amount
        else:
            balance -= amount

    return round(balance, 2)


async def compute_committed():
    """
    Calcula o valor comprometido que deve ser considerado
    no DISPONÍVEL REAL do mês atual.

    Considera:
    - compromissos atrasados;
    - compromissos com vencimento no mês atual.

    NÃO considera:
    - compromissos de meses futuros;
    - parcelas de 2027 etc.
    """
    await refresh_overdue()

    mk = current_month_key()

    commits = await fetch_all(
        "commitments",
        {
            "status": {
                "$in": [
                    "a_vencer",
                    "atrasado"
                ]
            }
        }
    )

    committed = 0.0

    for c in commits:
        due_date = c.get("due_date", "")
        status = c.get("status")

        # Compromisso atrasado:
        # continua sendo considerado no disponível real.
        if status == "atrasado":
            committed += c.get("amount", 0) or 0
            continue

        # Compromisso a vencer:
        # somente se for do mês atual.
        if status == "a_vencer" and month_key(due_date) == mk:
            committed += c.get("amount", 0) or 0

    return round(committed, 2)


async def compute_dashboard():
    await refresh_overdue()

    mk = current_month_key()

    # Saldo bancário/carteira REAL neste momento.
    balance = await compute_current_balance()

    # Agora considera somente atrasados + mês atual.
    committed = await compute_committed()

    txs = await fetch_all("transactions")

    # Entradas realizadas no mês atual.
    income_month = sum(
        t.get("amount", 0) or 0
        for t in txs
        if (
            t.get("type") == "income"
            and month_key(t.get("date", "")) == mk
        )
    )

    # Despesas realizadas no mês atual.
    expense_month = sum(
        t.get("amount", 0) or 0
        for t in txs
        if (
            t.get("type") == "expense"
            and month_key(t.get("date", "")) == mk
        )
    )

    # ---------------------------------------------------------
    # RECEBÍVEIS
    # ---------------------------------------------------------

    receivables = await fetch_all(
        "receivables",
        {
            "status": {
                "$in": [
                    "pendente",
                    "parcial"
                ]
            }
        }
    )

    to_receive = sum(
        (r.get("total", 0) or 0)
        - (r.get("received", 0) or 0)
        for r in receivables
    )

    # ---------------------------------------------------------
    # DÍVIDAS / EMPRÉSTIMOS
    # ---------------------------------------------------------

    loans = await fetch_all(
        "loans",
        {
            "kind": "borrowed"
        }
    )

    debts = 0.0

    for l in loans:
        total_installments = l.get(
            "installments_total",
            0
        ) or 0

        paid_installments = l.get(
            "installments_paid",
            0
        ) or 0

        installment_value = l.get(
            "installment_value",
            0
        ) or 0

        remaining = (
            total_installments
            - paid_installments
        ) * installment_value

        debts += max(
            remaining,
            0
        )

    # ---------------------------------------------------------
    # NECESSIDADES
    # ---------------------------------------------------------

    needs = await fetch_all(
        "needs",
        {
            "status": "pendente"
        }
    )

    needs_total = sum(
        n.get("estimated_value", 0) or 0
        for n in needs
    )

    # ---------------------------------------------------------
    # METAS
    # ---------------------------------------------------------

    goals = await fetch_all("goals")

    goals_saved = sum(
        g.get("current", 0) or 0
        for g in goals
    )

    goals_target = sum(
        g.get("target", 0) or 0
        for g in goals
    )

    # ---------------------------------------------------------
    # INVESTIMENTOS
    # ---------------------------------------------------------

    investments = await fetch_all(
        "investments"
    )

    invested_total = sum(
        i.get("invested", 0) or 0
        for i in investments
    )

    invest_current = sum(
        i.get("current_balance", 0) or 0
        for i in investments
    )

    # ---------------------------------------------------------
    # PRÓXIMOS COMPROMISSOS
    # ---------------------------------------------------------

    upcoming = await db.commitments.find(
        {
            "status": {
                "$in": [
                    "a_vencer",
                    "atrasado"
                ]
            }
        },
        {
            "_id": 0
        }
    ).sort(
        "due_date",
        1
    ).to_list(20)

    overdue = [
        c
        for c in upcoming
        if c.get("status") == "atrasado"
    ]

    overdue_total = sum(
        c.get("amount", 0) or 0
        for c in overdue
    )

    # ---------------------------------------------------------
    # DISPONÍVEL REAL
    # ---------------------------------------------------------

    available = round(
        balance - committed,
        2
    )

    return {
        "current_balance": round(
            balance,
            2
        ),

        "income_month": round(
            income_month,
            2
        ),

        "expense_month": round(
            expense_month,
            2
        ),

        # Somente atrasados + compromissos do mês atual.
        "committed": round(
            committed,
            2
        ),

        # Saldo atual menos o que ainda precisa ser pago
        # neste mês e o que está atrasado.
        "available": available,

        "to_receive": round(
            to_receive,
            2
        ),

        "debts": round(
            debts,
            2
        ),

        "needs_total": round(
            needs_total,
            2
        ),

        "needs_count": len(
            needs
        ),

        "goals_saved": round(
            goals_saved,
            2
        ),

        "goals_target": round(
            goals_target,
            2
        ),

        "invested_total": round(
            invested_total,
            2
        ),

        "invest_current": round(
            invest_current,
            2
        ),

        "upcoming": upcoming[:8],

        "overdue_total": round(
            overdue_total,
            2
        ),

        "overdue_count": len(
            overdue
        ),

        "month": mk,
    }


# ============================================================
# PLANEJAMENTO
# ============================================================

async def compute_planning(months: int = 12):
    await refresh_overdue()

    commits = await fetch_all(
        "commitments"
    )

    recurring = await fetch_all(
        "recurring"
    )

    needs = await fetch_all(
        "needs",
        {
            "status": "pendente"
        }
    )

    txs = await fetch_all(
        "transactions"
    )

    today = date.today()

    y = today.year
    m = today.month

    # Começa do saldo atual.
    running = await compute_current_balance()

    result = []

    for i in range(months):
        yy, mm = add_months(
            y,
            m,
            i
        )

        mk = f"{yy:04d}-{mm:02d}"

        # -----------------------------------------------------
        # ENTRADAS RECORRENTES
        # -----------------------------------------------------

        inc = 0.0

        for r in recurring:

            if r.get("type") != "income":
                continue

            sd = r.get(
                "start_date"
            ) or ""

            ed = r.get(
                "end_date"
            )

            if sd and month_key(sd) > mk:
                continue

            if ed and month_key(ed) < mk:
                continue

            inc += r.get(
                "amount",
                0
            ) or 0

        # -----------------------------------------------------
        # ENTRADAS JÁ REALIZADAS
        # -----------------------------------------------------

        realized_inc = sum(
            t.get("amount", 0) or 0
            for t in txs
            if (
                t.get("type") == "income"
                and month_key(
                    t.get("date", "")
                ) == mk
            )
        )

        # Mês atual:
        # se já houver entrada registrada,
        # usa o valor realizado.
        #
        # Meses futuros:
        # usa a projeção recorrente.
        income_total = (
            realized_inc
            if realized_inc > 0
            else inc
        ) if i == 0 else inc

        # -----------------------------------------------------
        # COMPROMISSOS DO MÊS
        # -----------------------------------------------------

        month_commits = [
            c
            for c in commits
            if month_key(
                c.get("due_date", "")
            ) == mk
        ]

        commits_total = sum(
            c.get("amount", 0) or 0
            for c in month_commits
            if c.get("status") != "cancelado"
        )

        # -----------------------------------------------------
        # NECESSIDADES DO MÊS
        # -----------------------------------------------------

        need_items = [
            n
            for n in needs
            if month_key(
                n.get("deadline", "")
            ) == mk
        ]

        needs_total = sum(
            n.get(
                "estimated_value",
                0
            ) or 0
            for n in need_items
        )

        # -----------------------------------------------------
        # RESULTADO DO MÊS
        # -----------------------------------------------------

        net = (
            income_total
            - commits_total
            - needs_total
        )

        running = round(
            running + net,
            2
        )

        result.append({
            "month": mk,

            "income_expected": round(
                income_total,
                2
            ),

            "commitments": round(
                commits_total,
                2
            ),

            "needs": round(
                needs_total,
                2
            ),

            "net": round(
                net,
                2
            ),

            "projected_balance": running,

            "alert": (
                running < 0
                or net < 0
            ),

            "commit_items": month_commits,
        })

    return result


# ============================================================
# POSSO COMPRAR
# ============================================================

async def compute_posso_comprar(
    amount: float,
    installments: int = 1
):
    dash = await compute_dashboard()

    available = dash["available"]
    balance = dash["current_balance"]
    committed = dash["committed"]

    plan = await compute_planning(6)

    per_installment = (
        amount / max(
            installments,
            1
        )
    )

    # Saldo projetado mais baixo dos próximos meses.
    worst_projected = min(
        (
            p["projected_balance"]
            for p in plan
        ),
        default=balance
    )

    projected_after = (
        worst_projected - amount
    )

    reasons = []

    if installments > 1:
        reasons.append(
            f"A compra de R$ {amount:,.2f} "
            f"seria dividida em {installments}x "
            f"de R$ {per_installment:,.2f}."
        )

    reasons.append(
        f"Seu saldo atual é R$ {balance:,.2f}, "
        f"com R$ {committed:,.2f} comprometidos "
        f"neste mês, restando R$ {available:,.2f} "
        f"disponíveis de verdade."
    )

    if (
        amount <= available * 0.5
        and worst_projected
        - (
            amount
            if installments == 1
            else per_installment
        ) > 0
    ):
        verdict = "verde"
        title = "Compra confortável"

        reasons.append(
            "O valor cabe com folga no seu "
            "disponível real e não compromete "
            "os próximos meses."
        )

    elif (
        amount <= available
        or (
            installments > 1
            and per_installment <= available
        )
    ):
        verdict = "amarelo"
        title = "Compra possível, mas exige atenção"

        reasons.append(
            "O valor cabe no disponível, porém "
            "reduz sua margem de segurança. "
            "Fique atento aos próximos vencimentos."
        )

    else:
        verdict = "vermelho"
        title = "Compra não recomendada neste momento"

        reasons.append(
            "O valor ultrapassa o seu disponível "
            "real. Comprometeria seu saldo e "
            "pode gerar aperto financeiro."
        )

    tight_months = [
        p["month"]
        for p in plan
        if p["alert"]
    ]

    if tight_months:
        reasons.append(
            f"Atenção: os meses "
            f"{', '.join(tight_months)} "
            f"já apresentam saldo projetado apertado."
        )

    needs = dash["needs_total"]

    if needs > 0:
        reasons.append(
            f"Você ainda tem R$ {needs:,.2f} "
            f"em necessidades planejadas "
            f"não realizadas."
        )

    return {
        "verdict": verdict,

        "title": title,

        "reasons": reasons,

        "available": available,

        "balance": balance,

        "committed": committed,

        "projected_after": round(
            projected_after,
            2
        ),

        "per_installment": round(
            per_installment,
            2
        ),
    }


# ============================================================
# RELATÓRIOS
# ============================================================

async def compute_reports():
    mk = current_month_key()

    txs = await fetch_all(
        "transactions"
    )

    # ---------------------------------------------------------
    # POR CATEGORIA / MÉTODO / MÊS
    # ---------------------------------------------------------

    by_cat = {}
    by_method = {}
    by_month = {}

    for t in txs:

        amount = (
            t.get("amount", 0)
            or 0
        )

        if t.get("type") == "expense":

            cat = (
                t.get("category")
                or "Outros"
            )

            by_cat[cat] = (
                by_cat.get(cat, 0)
                + amount
            )

            pm = (
                t.get("payment_method")
                or "Outros"
            )

            by_method[pm] = (
                by_method.get(pm, 0)
                + amount
            )

        mkey = month_key(
            t.get("date", "")
        )

        if mkey:

            if mkey not in by_month:
                by_month[mkey] = {
                    "income": 0,
                    "expense": 0
                }

            by_month[mkey][
                t.get(
                    "type",
                    "expense"
                )
            ] += amount

    # ---------------------------------------------------------
    # MÊS ANTERIOR
    # ---------------------------------------------------------

    y = int(mk[:4])
    m = int(mk[5:7])

    py, pm_ = add_months(
        y,
        m,
        -1
    )

    prev_mk = (
        f"{py:04d}-{pm_:02d}"
    )

    cur_exp = (
        by_month
        .get(mk, {})
        .get("expense", 0)
    )

    prev_exp = (
        by_month
        .get(prev_mk, {})
        .get("expense", 0)
    )

    insights = []

    if prev_exp > 0:

        diff = (
            (cur_exp - prev_exp)
            / prev_exp
            * 100
        )

        if diff < 0:

            insights.append(
                f"Você gastou "
                f"{abs(diff):.0f}% menos "
                f"que no mês passado."
            )

        elif diff > 0:

            insights.append(
                f"Você gastou "
                f"{diff:.0f}% mais "
                f"que no mês passado."
            )

    # ---------------------------------------------------------
    # CATEGORIAS DO MÊS
    # ---------------------------------------------------------

    cur_cats = {}

    for t in txs:

        if (
            t.get("type") == "expense"
            and month_key(
                t.get("date", "")
            ) == mk
        ):

            c = (
                t.get("category")
                or "Outros"
            )

            cur_cats[c] = (
                cur_cats.get(c, 0)
                + (
                    t.get(
                        "amount",
                        0
                    )
                    or 0
                )
            )

    if cur_cats:

        top = max(
            cur_cats.items(),
            key=lambda x: x[1]
        )

        insights.append(
            f"{top[0]} foi sua maior "
            f"categoria neste mês."
        )

    # ---------------------------------------------------------
    # CUSTOS FIXOS
    # ---------------------------------------------------------

    recurring = await fetch_all(
        "recurring"
    )

    fixed = sum(
        r.get("amount", 0) or 0
        for r in recurring
        if r.get("type") == "expense"
    )

    inc_month = (
        by_month
        .get(mk, {})
        .get("income", 0)
    )

    rec_inc = sum(
        r.get("amount", 0) or 0
        for r in recurring
        if r.get("type") == "income"
    )

    base_inc = (
        inc_month
        or rec_inc
    )

    if base_inc > 0 and fixed > 0:

        pct = (
            fixed
            / base_inc
            * 100
        )

        insights.append(
            f"Seu custo fixo representa "
            f"{pct:.0f}% das suas entradas."
        )

    # ---------------------------------------------------------
    # CARRO
    # ---------------------------------------------------------

    car_cats = [
        "Carro",
        "Combustível",
        "Transporte"
    ]

    car_month = sum(
        t.get("amount", 0) or 0
        for t in txs
        if (
            t.get("type") == "expense"
            and (
                t.get("category")
                in car_cats
                or t.get("group")
                == "carro"
            )
            and month_key(
                t.get("date", "")
            ) == mk
        )
    )

    car_year = sum(
        t.get("amount", 0) or 0
        for t in txs
        if (
            t.get("type") == "expense"
            and (
                t.get("category")
                in car_cats
                or t.get("group")
                == "carro"
            )
            and t.get(
                "date",
                ""
            )[:4] == mk[:4]
        )
    )

    return {
        "by_category": [
            {
                "name": k,
                "value": round(v, 2)
            }
            for k, v in sorted(
                by_cat.items(),
                key=lambda x: -x[1]
            )
        ],

        "by_method": [
            {
                "name": k,
                "value": round(v, 2)
            }
            for k, v in sorted(
                by_method.items(),
                key=lambda x: -x[1]
            )
        ],

        "by_month": [
            {
                "month": k,
                "income": round(
                    v["income"],
                    2
                ),
                "expense": round(
                    v["expense"],
                    2
                )
            }
            for k, v in sorted(
                by_month.items()
            )
        ],

        "insights": insights,

        "car_month": round(
            car_month,
            2
        ),

        "car_year": round(
            car_year,
            2
        ),
    }
