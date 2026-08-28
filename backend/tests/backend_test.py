"""
Backend regression tests for personal finance planning app.
Focus: correctness of financial calculations (dashboard, committed, available),
no duplicate transactions, and lifecycle of commitments/receivables/needs/goals.

Base URL from REACT_APP_BACKEND_URL. All routes prefixed with /api.
"""
import os
from datetime import date, timedelta

import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback for internal invocation - dotenv frontend
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def ctx():
    """Shared state between tests (used because pytest module attrs don't persist across xdist workers)."""
    return {}


@pytest.fixture(scope="session", autouse=True)
def reset_state(s):
    """Reset before entire suite. Reseeds default categories & carteira account."""
    r = s.delete(f"{API}/backup/reset", timeout=30)
    assert r.status_code == 200, r.text
    yield


def _dash(s):
    r = s.get(f"{API}/dashboard", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------- Basic & Seed ----------------------
class TestSeed:
    def test_root(self, s, ctx):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_default_categories_seeded(self, s, ctx):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        expense_cats = [c for c in cats if c.get("type") == "expense"]
        income_cats = [c for c in cats if c.get("type") == "income"]
        assert len(expense_cats) >= 15, f"expected >=15 expense cats, got {len(expense_cats)}"
        assert len(income_cats) >= 1, "expected income categories seeded"

    def test_dashboard_initial_shape(self, s, ctx):
        d = _dash(s)
        for k in ["current_balance", "income_month", "expense_month", "committed",
                  "available", "to_receive", "debts", "needs_total", "goals_saved",
                  "upcoming", "overdue_total", "overdue_count"]:
            assert k in d, f"missing key {k}"
        # available = balance - committed
        assert abs(d["available"] - (d["current_balance"] - d["committed"])) < 0.01


# ---------------------- Accounts ----------------------
class TestAccountsAndBalance:
    def test_create_account_updates_balance(self, s, ctx):
        d0 = _dash(s)
        r = s.post(f"{API}/accounts", json={
            "name": "TEST_Nubank", "type": "conta", "initial_balance": 1000.0
        })
        assert r.status_code == 200, r.text
        acc = r.json()
        assert acc["initial_balance"] == 1000.0
        ctx["acc_id"] = acc["id"]

        d1 = _dash(s)
        assert round(d1["current_balance"] - d0["current_balance"], 2) == 1000.0


# ---------------------- Income / Expense txs ----------------------
class TestTransactions:
    def test_income_transaction(self, s, ctx):
        d0 = _dash(s)
        r = s.post(f"{API}/transactions", json={
            "type": "income", "amount": 500.0, "description": "TEST_salary",
            "income_category": "Salário", "date": date.today().isoformat(),
            "account_id": ctx["acc_id"],
        })
        assert r.status_code == 200, r.text
        d1 = _dash(s)
        assert round(d1["current_balance"] - d0["current_balance"], 2) == 500.0
        assert round(d1["income_month"] - d0["income_month"], 2) == 500.0

    def test_expense_transaction(self, s, ctx):
        d0 = _dash(s)
        r = s.post(f"{API}/transactions", json={
            "type": "expense", "amount": 200.0, "description": "TEST_expense",
            "category": "Mercado", "date": date.today().isoformat(),
            "account_id": ctx["acc_id"], "payment_method": "pix",
        })
        assert r.status_code == 200, r.text
        d1 = _dash(s)
        assert round(d0["current_balance"] - d1["current_balance"], 2) == 200.0
        assert round(d1["expense_month"] - d0["expense_month"], 2) == 200.0


# ---------------------- Recurring / Commitments ----------------------
class TestRecurring:
    def test_recurring_generates_12_commitments(self, s, ctx):
        d0 = _dash(s)
        r = s.post(f"{API}/recurring", json={
            "name": "TEST_aluguel", "amount": 100.0, "type": "expense",
            "due_day": 5, "months_ahead": 12,
            "start_date": date.today().isoformat(),
            "category": "Casa",
        })
        assert r.status_code == 200, r.text
        rec = r.json()
        ctx["rec_id"] = rec["id"]

        # commitments
        cs = s.get(f"{API}/commitments").json()
        my = [c for c in cs if c.get("origin_id") == ctx["rec_id"]]
        assert len(my) == 12, f"expected 12 commitments, got {len(my)}"

        d1 = _dash(s)
        # committed grew by 12*100 = 1200 (some months may still be a_vencer/atrasado)
        assert round(d1["committed"] - d0["committed"], 2) == 1200.00

    def test_delete_recurring_removes_unpaid_commitments(self, s, ctx):
        rec_id = ctx["rec_id"]
        r = s.delete(f"{API}/recurring/{rec_id}")
        assert r.status_code == 200
        cs = s.get(f"{API}/commitments").json()
        remaining = [c for c in cs if c.get("origin_id") == ctx["rec_id"]
                     and c.get("status") in ("a_vencer", "atrasado")]
        assert remaining == []


# ---------------------- Installment ----------------------
class TestInstallments:
    def test_installment_endpoint_creates_6_commitments_and_no_immediate_tx(self, s, ctx):
        d0 = _dash(s)
        txs_before = len(s.get(f"{API}/transactions").json())
        r = s.post(f"{API}/installment-purchases", json={
            "description": "TEST_TV", "total": 1200.0, "installments": 6,
            "first_due_date": date.today().isoformat(),
        })
        assert r.status_code == 200, r.text
        purchase_id = r.json()["purchase_id"]
        cs = s.get(f"{API}/commitments").json()
        mine = [c for c in cs if c.get("origin_id") == purchase_id]
        assert len(mine) == 6
        for c in mine:
            assert c["amount"] == 200.0

        # no immediate expense tx
        txs_after = len(s.get(f"{API}/transactions").json())
        assert txs_after == txs_before, "installment should NOT create immediate expense tx"

        d1 = _dash(s)
        # committed should grow by 1200 total, not 1200/month
        assert round(d1["committed"] - d0["committed"], 2) == 1200.0
        # balance unchanged
        assert round(d1["current_balance"], 2) == round(d0["current_balance"], 2)

    def test_transaction_credit_installments_creates_commitments_no_immediate_tx(self, s, ctx):
        d0 = _dash(s)
        txs_before = len(s.get(f"{API}/transactions").json())
        r = s.post(f"{API}/transactions", json={
            "type": "expense", "amount": 600.0, "description": "TEST_geladeira",
            "payment_method": "credito", "installments": 3,
            "category": "Casa",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("type") == "installment"

        # no direct expense tx created
        txs_after = len(s.get(f"{API}/transactions").json())
        assert txs_after == txs_before

        d1 = _dash(s)
        assert round(d1["committed"] - d0["committed"], 2) == 600.0
        assert round(d1["current_balance"], 2) == round(d0["current_balance"], 2)


# ---------------------- Overdue ----------------------
class TestOverdue:
    def test_manual_past_commitment_becomes_overdue(self, s, ctx):
        past = (date.today() - timedelta(days=10)).isoformat()
        r = s.post(f"{API}/commitments", json={
            "description": "TEST_atrasada", "amount": 77.0, "due_date": past,
            "status": "a_vencer",
        })
        assert r.status_code == 200
        cid = r.json()["id"]
        # trigger refresh
        cs = s.get(f"{API}/commitments").json()
        target = next((c for c in cs if c["id"] == cid), None)
        assert target is not None
        assert target["status"] == "atrasado"
        d = _dash(s)
        assert d["overdue_count"] >= 1
        assert d["overdue_total"] >= 77.0
        ctx["overdue_cid"] = cid


# ---------------------- Pay commitment ----------------------
class TestPayCommitment:
    def test_pay_commitment_creates_expense_no_duplicate(self, s, ctx):
        d0 = _dash(s)
        cid = ctx["overdue_cid"]
        c_before = next(c for c in s.get(f"{API}/commitments").json() if c["id"] == cid)
        amount = c_before["amount"]

        r = s.post(f"{API}/commitments/{cid}/pay")
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "pago"

        # idempotency: paying again should not create another tx
        txs_after_first = [t for t in s.get(f"{API}/transactions").json()
                           if t.get("origin") == "commitment" and t.get("origin_id") == cid]
        assert len(txs_after_first) == 1

        r2 = s.post(f"{API}/commitments/{cid}/pay")
        assert r2.status_code == 200
        txs_after_second = [t for t in s.get(f"{API}/transactions").json()
                            if t.get("origin") == "commitment" and t.get("origin_id") == cid]
        assert len(txs_after_second) == 1, "paying twice created duplicate expense"

        d1 = _dash(s)
        # committed decreases by amount, expense_month increases by amount, balance decreases by amount
        assert round(d0["committed"] - d1["committed"], 2) == amount
        assert round(d1["expense_month"] - d0["expense_month"], 2) == amount
        assert round(d0["current_balance"] - d1["current_balance"], 2) == amount


# ---------------------- People + Split ----------------------
class TestSplit:
    def test_person_create(self, s, ctx):
        r = s.post(f"{API}/people", json={"name": "TEST_Ana"})
        assert r.status_code == 200
        ctx["person_id"] = r.json()["id"]

    def test_split_expense_creates_receivable_and_only_my_share_expense(self, s, ctx):
        d0 = _dash(s)
        r = s.post(f"{API}/transactions", json={
            "type": "expense", "amount": 100.0, "description": "TEST_pizza",
            "category": "Alimentação", "date": date.today().isoformat(),
            "is_split": True, "split_total": 100.0, "my_share": 40.0,
            "person_id": ctx["person_id"],
            "account_id": ctx["acc_id"], "payment_method": "pix",
        })
        assert r.status_code == 200, r.text
        d1 = _dash(s)
        # my_share = 40 -> balance drops 40 not 100
        assert round(d0["current_balance"] - d1["current_balance"], 2) == 40.0
        # to_receive grew by 60
        assert round(d1["to_receive"] - d0["to_receive"], 2) == 60.0
        # find receivable
        recs = s.get(f"{API}/receivables").json()
        mine = [r for r in recs if r.get("person_id") == ctx["person_id"]
                and r.get("origin") == "split" and r.get("total") == 60.0]
        assert mine, "expected receivable of 60 created"
        ctx["split_receivable_id"] = mine[0]["id"]


class TestReceive:
    def test_receive_creates_income_and_updates_status(self, s, ctx):
        d0 = _dash(s)
        rid = ctx["split_receivable_id"]
        # partial
        r = s.post(f"{API}/receivables/{rid}/receive", json={
            "amount": 20.0, "account_id": ctx["acc_id"]
        })
        assert r.status_code == 200
        assert r.json()["status"] == "parcial"

        d1 = _dash(s)
        assert round(d1["current_balance"] - d0["current_balance"], 2) == 20.0

        # rest
        r2 = s.post(f"{API}/receivables/{rid}/receive", json={
            "amount": 40.0, "account_id": ctx["acc_id"]
        })
        assert r2.status_code == 200
        assert r2.json()["status"] == "recebido"

        # no duplicate: exactly 2 income txs for this receivable
        txs = [t for t in s.get(f"{API}/transactions").json()
               if t.get("origin") == "receivable" and t.get("origin_id") == rid]
        assert len(txs) == 2


# ---------------------- Loans ----------------------
class TestLoans:
    def test_loan_borrowed_creates_commitments_and_debt(self, s, ctx):
        d0 = _dash(s)
        r = s.post(f"{API}/loans", json={
            "kind": "borrowed", "institution": "TEST_Bank",
            "installment_value": 100.0, "installments_total": 5,
            "installments_paid": 0,
            "first_due_date": date.today().isoformat(),
            "due_day": date.today().day,
        })
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        cs = s.get(f"{API}/commitments").json()
        mine = [c for c in cs if c.get("origin_id") == lid]
        assert len(mine) == 5
        d1 = _dash(s)
        assert round(d1["debts"] - d0["debts"], 2) == 500.0

    def test_loan_lent_creates_receivables(self, s, ctx):
        d0 = _dash(s)
        r = s.post(f"{API}/loans", json={
            "kind": "lent", "person_id": ctx["person_id"],
            "installment_value": 50.0, "installments_total": 4,
            "first_due_date": date.today().isoformat(),
        })
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        recs = s.get(f"{API}/receivables").json()
        mine = [r for r in recs if r.get("origin_id") == lid]
        assert len(mine) == 4
        d1 = _dash(s)
        assert round(d1["to_receive"] - d0["to_receive"], 2) == 200.0


# ---------------------- Needs ----------------------
class TestNeeds:
    def test_need_and_realize(self, s, ctx):
        d0 = _dash(s)
        r = s.post(f"{API}/needs", json={
            "title": "TEST_pneu", "estimated_value": 300.0, "priority": "importante",
            "category": "Carro",
        })
        assert r.status_code == 200
        nid = r.json()["id"]
        d1 = _dash(s)
        assert round(d1["needs_total"] - d0["needs_total"], 2) == 300.0

        r2 = s.post(f"{API}/needs/{nid}/realize", json={
            "amount": 300.0, "account_id": ctx["acc_id"], "payment_method": "pix",
        })
        assert r2.status_code == 200
        d2 = _dash(s)
        assert round(d2["needs_total"] - d1["needs_total"], 2) == -300.0
        assert round(d1["current_balance"] - d2["current_balance"], 2) == 300.0


# ---------------------- Goals ----------------------
class TestGoals:
    def test_goal_and_contribute(self, s, ctx):
        r = s.post(f"{API}/goals", json={
            "name": "TEST_viagem", "target": 5000.0, "current": 0.0,
        })
        assert r.status_code == 200
        gid = r.json()["id"]
        r2 = s.post(f"{API}/goals/{gid}/contribute", json={"amount": 250.0})
        assert r2.status_code == 200
        assert r2.json()["current"] == 250.0


# ---------------------- Challenges ----------------------
class TestChallenges:
    def test_seed_challenge_and_toggle(self, s, ctx):
        chs = s.get(f"{API}/challenges").json()
        assert len(chs) >= 1
        cid = chs[0]["id"]
        r = s.post(f"{API}/challenges/{cid}/toggle", json={"day": 5})
        assert r.status_code == 200
        assert 5 in r.json()["done_days"]
        r2 = s.post(f"{API}/challenges/{cid}/toggle", json={"day": 5})
        assert 5 not in r2.json()["done_days"]


# ---------------------- Planning ----------------------
class TestPlanning:
    def test_planning_returns_12_months(self, s, ctx):
        r = s.get(f"{API}/planning?months=12")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 12
        for m in data:
            for k in ("month", "income_expected", "commitments", "needs",
                      "net", "projected_balance", "alert"):
                assert k in m


# ---------------------- Posso Comprar ----------------------
class TestPossoComprar:
    def test_posso_comprar(self, s, ctx):
        d = _dash(s)
        r = s.post(f"{API}/posso-comprar", json={"amount": 50.0, "installments": 1})
        assert r.status_code == 200
        body = r.json()
        assert body["verdict"] in ("verde", "amarelo", "vermelho")
        for k in ("title", "reasons", "available", "projected_after"):
            assert k in body
        assert body["available"] == d["available"]

    def test_posso_comprar_expensive_red(self, s, ctx):
        r = s.post(f"{API}/posso-comprar", json={"amount": 999999.0, "installments": 1})
        assert r.status_code == 200
        assert r.json()["verdict"] == "vermelho"


# ---------------------- Reports ----------------------
class TestReports:
    def test_reports_shape(self, s, ctx):
        r = s.get(f"{API}/reports")
        assert r.status_code == 200
        d = r.json()
        for k in ("by_category", "by_month", "by_method", "insights",
                  "car_month", "car_year"):
            assert k in d


# ---------------------- Backup ----------------------
class TestBackup:
    def test_export_has_all_collections(self, s, ctx):
        r = s.get(f"{API}/backup/export")
        assert r.status_code == 200
        d = r.json()
        for c in ("accounts", "cards", "categories", "people", "transactions",
                  "recurring", "commitments", "installment_purchases",
                  "receivables", "loans", "needs", "goals", "investments",
                  "challenges"):
            assert c in d
        assert "exported_at" in d
        ctx["backup"] = d

    def test_import_restores(self, s, ctx):
        r = s.post(f"{API}/backup/import", json=ctx["backup"])
        assert r.status_code == 200

    def test_reset_reseeds(self, s, ctx):
        r = s.delete(f"{API}/backup/reset")
        assert r.status_code == 200
        cats = s.get(f"{API}/categories").json()
        assert len([c for c in cats if c.get("type") == "expense"]) >= 15
