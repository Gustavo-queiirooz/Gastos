from pydantic import BaseModel, Field
from typing import Optional, List
import uuid
from datetime import datetime, timezone, date


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_iso() -> str:
    return date.today().isoformat()


# ---------- Accounts ----------
class AccountCreate(BaseModel):
    name: str
    type: str = "conta"  # conta corrente, poupanca, dinheiro, carteira
    initial_balance: float = 0.0
    color: Optional[str] = None
    icon: Optional[str] = None


# ---------- Cards ----------
class CardCreate(BaseModel):
    name: str
    limit: float = 0.0
    closing_day: int = 1
    due_day: int = 10
    color: Optional[str] = None


# ---------- Categories ----------
class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    type: str = "expense"  # expense | income
    group: Optional[str] = None  # ex: "carro"


# ---------- People ----------
class PersonCreate(BaseModel):
    name: str
    note: Optional[str] = None


# ---------- Transactions (realized income/expense) ----------
class TransactionCreate(BaseModel):
    type: str = "expense"  # expense | income
    amount: float
    description: str = ""
    category: Optional[str] = None
    date: Optional[str] = None
    payment_method: Optional[str] = None  # dinheiro, pix, debito, credito, boleto
    account_id: Optional[str] = None
    card_id: Optional[str] = None
    person_id: Optional[str] = None
    note: Optional[str] = None
    income_category: Optional[str] = None  # salario, renda extra, etc
    # split
    is_split: bool = False
    split_total: Optional[float] = None  # total value when split
    my_share: Optional[float] = None
    # installment (card)
    installments: int = 1
    origin: Optional[str] = None
    origin_id: Optional[str] = None


class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    category: Optional[str] = None
    date: Optional[str] = None
    payment_method: Optional[str] = None
    account_id: Optional[str] = None
    card_id: Optional[str] = None
    note: Optional[str] = None


# ---------- Recurring (fixed) ----------
class RecurringCreate(BaseModel):
    name: str
    amount: float
    variable: bool = False
    category: Optional[str] = None
    due_day: int = 5
    periodicity: str = "mensal"
    account_id: Optional[str] = None
    card_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    type: str = "expense"  # expense | income
    months_ahead: int = 12


# ---------- Commitments (future dues) ----------
class CommitmentCreate(BaseModel):
    description: str
    amount: float
    due_date: str
    category: Optional[str] = None
    origin: str = "manual"  # manual | recurring | installment | loan
    origin_id: Optional[str] = None
    status: str = "a_vencer"  # a_vencer | pago | atrasado | cancelado
    account_id: Optional[str] = None
    card_id: Optional[str] = None
    person_id: Optional[str] = None
    installment_index: Optional[int] = None
    installment_total: Optional[int] = None


class CommitmentUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None


# ---------- Installment purchase ----------
class InstallmentPurchaseCreate(BaseModel):
    description: str
    total: float
    installments: int
    card_id: Optional[str] = None
    category: Optional[str] = None
    first_due_date: Optional[str] = None


# ---------- Receivables (money owed to user) ----------
class ReceivableCreate(BaseModel):
    person_id: str
    description: str
    total: float
    received: float = 0.0
    due_date: Optional[str] = None
    status: str = "pendente"  # pendente | parcial | recebido
    origin: str = "manual"
    origin_id: Optional[str] = None


class ReceiveCreate(BaseModel):
    amount: float
    account_id: Optional[str] = None


# ---------- Loans / Debts ----------
class LoanCreate(BaseModel):
    kind: str = "borrowed"  # borrowed (peguei) | lent (emprestei)
    institution: Optional[str] = None
    person_id: Optional[str] = None
    principal: float = 0.0
    installment_value: float = 0.0
    installments_total: int = 1
    installments_paid: int = 0
    rate: Optional[float] = None
    first_due_date: Optional[str] = None
    due_day: Optional[int] = None
    note: Optional[str] = None


# ---------- Needs ----------
class NeedCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    estimated_value: float = 0.0
    priority: str = "planejado"  # urgente | importante | planejado | desejo
    deadline: Optional[str] = None
    note: Optional[str] = None
    status: str = "pendente"  # pendente | realizada
    group: Optional[str] = None  # ex carro


class NeedUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    estimated_value: Optional[float] = None
    priority: Optional[str] = None
    deadline: Optional[str] = None
    note: Optional[str] = None
    status: Optional[str] = None


# ---------- Goals ----------
class GoalCreate(BaseModel):
    name: str
    target: float
    current: float = 0.0
    deadline: Optional[str] = None
    monthly_contribution: Optional[float] = None
    category: Optional[str] = None
    color: Optional[str] = None


class GoalContribute(BaseModel):
    amount: float


# ---------- Investments ----------
class InvestmentCreate(BaseModel):
    institution: str
    name: str
    invested: float = 0.0
    date: Optional[str] = None
    rate: Optional[float] = None
    current_balance: float = 0.0
    type: Optional[str] = None


# ---------- Challenge ----------
class ChallengeCreate(BaseModel):
    name: str = "Desafio dos 365 dias"
    mode: str = "crescente"  # crescente | decrescente
    start_date: Optional[str] = None


class ChallengeToggle(BaseModel):
    day: int


# ---------- Posso Comprar ----------
class PossoComprarCreate(BaseModel):
    amount: float
    installments: int = 1
    description: Optional[str] = None
