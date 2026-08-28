from fastapi import FastAPI, APIRouter, HTTPException
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from datetime import date, datetime
from typing import Optional

from db import db, client
import models as M
import engine as E

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def stamp(data: dict) -> dict:
    data = {k: v for k, v in data.items() if v is not None}
    data["id"] = M.new_id()
    data["created_at"] = M.now_iso()
    return data


def due_date_from_day(base_iso: str, day: int, delta: int) -> str:
    d = datetime.fromisoformat(base_iso).date() if base_iso else date.today()
    idx = (d.year * 12 + (d.month - 1)) + delta
    ny, nm = idx // 12, (idx % 12) + 1
    day = max(1, min(day, 28))
    return date(ny, nm, day).isoformat()


# ---------------- Generic CRUD ----------------
def register_crud(name: str, coll: str, create_model):
    @api.get(f"/{name}", name=f"list_{name}")
    async def _list():
        return await E.fetch_all(coll)

    @api.post(f"/{name}", name=f"create_{name}")
    async def _create(body: create_model):  # type: ignore
        doc = stamp(body.model_dump())
        await db[coll].insert_one(dict(doc))
        return {k: v for k, v in doc.items() if k != "_id"}

    @api.put(f"/{name}/{{item_id}}", name=f"update_{name}")
    async def _update(item_id: str, body: dict):
        body = {k: v for k, v in body.items() if v is not None and k not in ("id", "_id")}
        await db[coll].update_one({"id": item_id}, {"$set": body})
        return await db[coll].find_one({"id": item_id}, {"_id": 0})

    @api.delete(f"/{name}/{{item_id}}", name=f"delete_{name}")
    async def _delete(item_id: str):
        await db[coll].delete_one({"id": item_id})
        return {"ok": True}


register_crud("accounts", "accounts", M.AccountCreate)
register_crud("cards", "cards", M.CardCreate)
register_crud("categories", "categories", M.CategoryCreate)
register_crud("people", "people", M.PersonCreate)
register_crud("goals", "goals", M.GoalCreate)
register_crud("investments", "investments", M.InvestmentCreate)


# ---------------- Transactions ----------------
@api.get("/transactions")
async def list_transactions(type: Optional[str] = None, month: Optional[str] = None):
    q = {}
    if type:
        q["type"] = type
    txs = await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(100000)
    if month:
        txs = [t for t in txs if (t.get("date") or "")[:7] == month]
    return txs


@api.post("/transactions")
async def create_transaction(body: M.TransactionCreate):
    data = body.model_dump()
    if not data.get("date"):
        data["date"] = M.today_iso()

    if data.get("installments", 1) and data["installments"] > 1 and data.get("type") == "expense":
        n = data["installments"]
        per = round(data["amount"] / n, 2)
        due_day = 10
        if data.get("card_id"):
            card = await db.cards.find_one({"id": data["card_id"]}, {"_id": 0})
            if card:
                due_day = card.get("due_day", 10)
        purchase = stamp({
            "description": data.get("description", ""),
            "total": data["amount"],
            "installments": n,
            "card_id": data.get("card_id"),
            "category": data.get("category"),
        })
        await db.installment_purchases.insert_one(dict(purchase))
        base = data["date"]
        for i in range(n):
            c = stamp({
                "description": f"{data.get('description','Compra')} ({i+1}/{n})",
                "amount": per,
                "due_date": due_date_from_day(base, due_day, i + 1),
                "category": data.get("category"),
                "origin": "installment",
                "origin_id": purchase["id"],
                "status": "a_vencer",
                "card_id": data.get("card_id"),
                "installment_index": i + 1,
                "installment_total": n,
            })
            await db.commitments.insert_one(dict(c))
        return {"ok": True, "type": "installment", "purchase_id": purchase["id"], "installments": n}

    if data.get("is_split") and data.get("split_total") and data.get("my_share") is not None:
        my = data["my_share"]
        other = round(data["split_total"] - my, 2)
        data["amount"] = my
        if data.get("person_id") and other > 0:
            rec = stamp({
                "person_id": data["person_id"],
                "description": f"{data.get('description','Despesa dividida')} (parte de terceiro)",
                "total": other,
                "received": 0.0,
                "due_date": data.get("date"),
                "status": "pendente",
                "origin": "split",
            })
            await db.receivables.insert_one(dict(rec))

    doc = stamp(data)
    for f in ("installments", "is_split", "split_total", "my_share"):
        doc.pop(f, None)
    await db.transactions.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@api.put("/transactions/{item_id}")
async def update_transaction(item_id: str, body: M.TransactionUpdate):
    b = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.transactions.update_one({"id": item_id}, {"$set": b})
    return await db.transactions.find_one({"id": item_id}, {"_id": 0})


@api.delete("/transactions/{item_id}")
async def delete_transaction(item_id: str):
    await db.transactions.delete_one({"id": item_id})
    return {"ok": True}


# ---------------- Recurring (fixed) ----------------
@api.get("/recurring")
async def list_recurring():
    return await E.fetch_all("recurring")


@api.post("/recurring")
async def create_recurring(body: M.RecurringCreate):
    data = body.model_dump()
    if not data.get("start_date"):
        data["start_date"] = M.today_iso()
    doc = stamp(data)
    await db.recurring.insert_one(dict(doc))
    if data.get("type") == "expense":
        n = data.get("months_ahead", 12)
        for i in range(n):
            dd = due_date_from_day(data["start_date"], data.get("due_day", 5), i)
            if data.get("end_date") and dd > data["end_date"]:
                break
            c = stamp({
                "description": data["name"],
                "amount": data["amount"],
                "due_date": dd,
                "category": data.get("category"),
                "origin": "recurring",
                "origin_id": doc["id"],
                "status": "a_vencer",
                "account_id": data.get("account_id"),
                "card_id": data.get("card_id"),
            })
            await db.commitments.insert_one(dict(c))
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/recurring/{item_id}")
async def delete_recurring(item_id: str):
    await db.recurring.delete_one({"id": item_id})
    await db.commitments.delete_many({"origin_id": item_id, "status": {"$in": ["a_vencer", "atrasado"]}})
    return {"ok": True}


# ---------------- Commitments ----------------
@api.get("/commitments")
async def list_commitments(status: Optional[str] = None):
    await E.refresh_overdue()
    q = {}
    if status:
        q["status"] = status
    return await db.commitments.find(q, {"_id": 0}).sort("due_date", 1).to_list(100000)


@api.post("/commitments")
async def create_commitment(body: M.CommitmentCreate):
    doc = stamp(body.model_dump())
    await db.commitments.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@api.put("/commitments/{item_id}")
async def update_commitment(item_id: str, body: M.CommitmentUpdate):
    b = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.commitments.update_one({"id": item_id}, {"$set": b})
    return await db.commitments.find_one({"id": item_id}, {"_id": 0})


@api.delete("/commitments/{item_id}")
async def delete_commitment(item_id: str):
    await db.commitments.delete_one({"id": item_id})
    return {"ok": True}


@api.post("/commitments/{item_id}/pay")
async def pay_commitment(item_id: str, account_id: Optional[str] = None):
    c = await db.commitments.find_one({"id": item_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Compromisso não encontrado")
    if c.get("status") == "pago":
        return c
    await db.commitments.update_one(
        {"id": item_id}, {"$set": {"status": "pago", "paid_date": M.today_iso()}}
    )
    tx = stamp({
        "type": "expense",
        "amount": c.get("amount", 0),
        "description": c.get("description", "Compromisso pago"),
        "category": c.get("category"),
        "date": M.today_iso(),
        "payment_method": "boleto",
        "account_id": account_id or c.get("account_id"),
        "card_id": c.get("card_id"),
        "origin": "commitment",
        "origin_id": item_id,
    })
    await db.transactions.insert_one(dict(tx))
    if c.get("origin") == "loan" and c.get("origin_id"):
        await db.loans.update_one({"id": c["origin_id"]}, {"$inc": {"installments_paid": 1}})
    return await db.commitments.find_one({"id": item_id}, {"_id": 0})


# ---------------- Installment purchase ----------------
@api.post("/installment-purchases")
async def create_installment(body: M.InstallmentPurchaseCreate):
    data = body.model_dump()
    n = max(1, data["installments"])
    per = round(data["total"] / n, 2)
    due_day = 10
    if data.get("card_id"):
        card = await db.cards.find_one({"id": data["card_id"]}, {"_id": 0})
        if card:
            due_day = card.get("due_day", 10)
    base = data.get("first_due_date") or M.today_iso()
    purchase = stamp(data)
    await db.installment_purchases.insert_one(dict(purchase))
    for i in range(n):
        c = stamp({
            "description": f"{data['description']} ({i+1}/{n})",
            "amount": per,
            "due_date": due_date_from_day(base, due_day, i),
            "category": data.get("category"),
            "origin": "installment",
            "origin_id": purchase["id"],
            "status": "a_vencer",
            "card_id": data.get("card_id"),
            "installment_index": i + 1,
            "installment_total": n,
        })
        await db.commitments.insert_one(dict(c))
    return {"ok": True, "purchase_id": purchase["id"]}


@api.get("/installment-purchases")
async def list_installments():
    return await E.fetch_all("installment_purchases")


# ---------------- Receivables ----------------
@api.get("/receivables")
async def list_receivables():
    return await E.fetch_all("receivables")


@api.post("/receivables")
async def create_receivable(body: M.ReceivableCreate):
    doc = stamp(body.model_dump())
    await db.receivables.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/receivables/{item_id}")
async def delete_receivable(item_id: str):
    await db.receivables.delete_one({"id": item_id})
    return {"ok": True}


@api.post("/receivables/{item_id}/receive")
async def receive_receivable(item_id: str, body: M.ReceiveCreate):
    r = await db.receivables.find_one({"id": item_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Registro não encontrado")
    received = round((r.get("received", 0) or 0) + body.amount, 2)
    total = r.get("total", 0) or 0
    status = "recebido" if received >= total else "parcial"
    await db.receivables.update_one(
        {"id": item_id}, {"$set": {"received": received, "status": status}}
    )
    tx = stamp({
        "type": "income",
        "amount": body.amount,
        "description": f"Recebimento: {r.get('description','')}",
        "income_category": "reembolso",
        "category": "Recebimento",
        "date": M.today_iso(),
        "account_id": body.account_id,
        "person_id": r.get("person_id"),
        "origin": "receivable",
        "origin_id": item_id,
    })
    await db.transactions.insert_one(dict(tx))
    return await db.receivables.find_one({"id": item_id}, {"_id": 0})


# ---------------- Loans ----------------
@api.get("/loans")
async def list_loans():
    return await E.fetch_all("loans")


@api.post("/loans")
async def create_loan(body: M.LoanCreate):
    data = body.model_dump()
    doc = stamp(data)
    await db.loans.insert_one(dict(doc))
    n = data["installments_total"]
    paid = data.get("installments_paid", 0)
    base = data.get("first_due_date") or M.today_iso()
    due_day = data.get("due_day") or (datetime.fromisoformat(base).day if base else 10)
    if data["kind"] == "borrowed":
        for i in range(paid, n):
            c = stamp({
                "description": f"{data.get('institution','Empréstimo')} ({i+1}/{n})",
                "amount": data.get("installment_value", 0),
                "due_date": due_date_from_day(base, due_day, i),
                "category": "Contas",
                "origin": "loan",
                "origin_id": doc["id"],
                "status": "a_vencer",
            })
            await db.commitments.insert_one(dict(c))
    else:
        for i in range(paid, n):
            rec = stamp({
                "person_id": data.get("person_id"),
                "description": f"Empréstimo ({i+1}/{n})",
                "total": data.get("installment_value", 0),
                "received": 0.0,
                "due_date": due_date_from_day(base, due_day, i),
                "status": "pendente",
                "origin": "loan",
                "origin_id": doc["id"],
            })
            await db.receivables.insert_one(dict(rec))
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/loans/{item_id}")
async def delete_loan(item_id: str):
    await db.loans.delete_one({"id": item_id})
    await db.commitments.delete_many({"origin_id": item_id, "status": {"$in": ["a_vencer", "atrasado"]}})
    await db.receivables.delete_many({"origin_id": item_id, "status": "pendente"})
    return {"ok": True}


# ---------------- Needs ----------------
@api.get("/needs")
async def list_needs():
    return await E.fetch_all("needs")


@api.post("/needs")
async def create_need(body: M.NeedCreate):
    doc = stamp(body.model_dump())
    await db.needs.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@api.put("/needs/{item_id}")
async def update_need(item_id: str, body: M.NeedUpdate):
    b = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.needs.update_one({"id": item_id}, {"$set": b})
    return await db.needs.find_one({"id": item_id}, {"_id": 0})


@api.delete("/needs/{item_id}")
async def delete_need(item_id: str):
    await db.needs.delete_one({"id": item_id})
    return {"ok": True}


@api.post("/needs/{item_id}/realize")
async def realize_need(item_id: str, body: dict = None):
    body = body or {}
    n = await db.needs.find_one({"id": item_id}, {"_id": 0})
    if not n:
        raise HTTPException(404, "Necessidade não encontrada")
    amount = body.get("amount") or n.get("estimated_value", 0)
    tx = stamp({
        "type": "expense",
        "amount": amount,
        "description": n.get("title", "Necessidade"),
        "category": n.get("category") or "Outros",
        "group": n.get("group"),
        "date": M.today_iso(),
        "payment_method": body.get("payment_method", "dinheiro"),
        "account_id": body.get("account_id"),
        "origin": "need",
        "origin_id": item_id,
    })
    await db.transactions.insert_one(dict(tx))
    await db.needs.update_one({"id": item_id}, {"$set": {"status": "realizada"}})
    return {"ok": True}


# ---------------- Goals contribute ----------------
@api.post("/goals/{item_id}/contribute")
async def contribute_goal(item_id: str, body: M.GoalContribute):
    g = await db.goals.find_one({"id": item_id}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Meta não encontrada")
    current = round((g.get("current", 0) or 0) + body.amount, 2)
    await db.goals.update_one({"id": item_id}, {"$set": {"current": current}})
    return await db.goals.find_one({"id": item_id}, {"_id": 0})


# ---------------- Challenge 365 ----------------
@api.get("/challenges")
async def list_challenges():
    return await E.fetch_all("challenges")


@api.post("/challenges")
async def create_challenge(body: M.ChallengeCreate):
    data = body.model_dump()
    if not data.get("start_date"):
        data["start_date"] = M.today_iso()
    doc = stamp(data)
    doc["done_days"] = []
    await db.challenges.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@api.post("/challenges/{item_id}/toggle")
async def toggle_challenge(item_id: str, body: M.ChallengeToggle):
    ch = await db.challenges.find_one({"id": item_id}, {"_id": 0})
    if not ch:
        raise HTTPException(404, "Desafio não encontrado")
    done = set(ch.get("done_days", []))
    if body.day in done:
        done.discard(body.day)
    else:
        done.add(body.day)
    await db.challenges.update_one({"id": item_id}, {"$set": {"done_days": sorted(done)}})
    return await db.challenges.find_one({"id": item_id}, {"_id": 0})


@api.delete("/challenges/{item_id}")
async def delete_challenge(item_id: str):
    await db.challenges.delete_one({"id": item_id})
    return {"ok": True}


# ---------------- Computed ----------------
@api.get("/dashboard")
async def dashboard():
    return await E.compute_dashboard()


@api.get("/planning")
async def planning(months: int = 12):
    return await E.compute_planning(months)


@api.get("/reports")
async def reports():
    return await E.compute_reports()


@api.post("/posso-comprar")
async def posso_comprar(body: M.PossoComprarCreate):
    return await E.compute_posso_comprar(body.amount, body.installments)


# ---------------- Backup ----------------
BACKUP_COLLS = [
    "accounts", "cards", "categories", "people", "transactions", "recurring",
    "commitments", "installment_purchases", "receivables", "loans", "needs",
    "goals", "investments", "challenges",
]


@api.get("/backup/export")
async def export_backup():
    data = {}
    for c in BACKUP_COLLS:
        data[c] = await E.fetch_all(c)
    data["exported_at"] = M.now_iso()
    return data


@api.post("/backup/import")
async def import_backup(body: dict):
    for c in BACKUP_COLLS:
        if c in body and isinstance(body[c], list):
            await db[c].delete_many({})
            if body[c]:
                await db[c].insert_many([dict(x) for x in body[c]])
    return {"ok": True}


@api.delete("/backup/reset")
async def reset_all():
    for c in BACKUP_COLLS:
        await db[c].delete_many({})
    await seed_defaults()
    return {"ok": True}


# ---------------- Seed ----------------
DEFAULT_CATEGORIES = [
    ("Alimentação", "ForkKnife", "#F77F00", None),
    ("Mercado", "ShoppingCart", "#2D6A4F", None),
    ("Casa", "House", "#1A3626", None),
    ("Transporte", "Bus", "#0077B6", None),
    ("Carro", "Car", "#D62828", "carro"),
    ("Saúde", "Heartbeat", "#E63946", None),
    ("Educação", "GraduationCap", "#457B9D", None),
    ("Lazer", "GameController", "#F4A261", None),
    ("Compras", "ShoppingBag", "#9D4EDD", None),
    ("Assinaturas", "Repeat", "#3A86FF", None),
    ("Contas", "Receipt", "#8D99AE", None),
    ("Impostos", "Bank", "#6D6875", None),
    ("Viagens", "Airplane", "#06D6A0", None),
    ("Família", "Users", "#FFB703", None),
    ("Outros", "DotsThree", "#adb5bd", None),
]
DEFAULT_INCOME_CATS = ["Salário", "Renda extra", "Reembolso", "Venda", "Recebimento", "Outros"]


async def seed_defaults():
    if await db.categories.count_documents({}) == 0:
        for name, icon, color, group in DEFAULT_CATEGORIES:
            await db.categories.insert_one(dict(stamp({
                "name": name, "icon": icon, "color": color, "type": "expense", "group": group,
            })))
        for name in DEFAULT_INCOME_CATS:
            await db.categories.insert_one(dict(stamp({
                "name": name, "type": "income",
            })))
    if await db.accounts.count_documents({}) == 0:
        await db.accounts.insert_one(dict(stamp({
            "name": "Carteira", "type": "dinheiro", "initial_balance": 0.0,
        })))
    if await db.challenges.count_documents({}) == 0:
        ch = stamp({"name": "Desafio dos 365 dias", "mode": "crescente", "start_date": M.today_iso()})
        ch["done_days"] = []
        await db.challenges.insert_one(dict(ch))


@app.on_event("startup")
async def on_startup():
    await seed_defaults()


@api.get("/")
async def root():
    return {"message": "Finance API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
