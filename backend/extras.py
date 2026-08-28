import os
import time
import base64
import secrets
from datetime import date, datetime, timezone, timedelta

import bcrypt
import requests
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from db import db
import engine as E

extra = APIRouter(prefix="/api")

RP_ID = os.environ.get("WEBAUTHN_RP_ID", "localhost")
ORIGIN = os.environ.get("WEBAUTHN_ORIGIN", "http://localhost:3000")

# =============================================================
# ALERTS
# =============================================================
@extra.get("/alerts")
async def get_alerts():
    await E.refresh_overdue()
    alerts = []
    dash = await E.compute_dashboard()
    today = date.today().isoformat()

    # overdue
    if dash["overdue_count"] > 0:
        alerts.append({"type": "overdue", "severity": "high", "icon": "WarningCircle",
                       "title": f"{dash['overdue_count']} conta(s) atrasada(s)",
                       "message": f"Total em atraso: R$ {dash['overdue_total']:,.2f}. Regularize o quanto antes."})

    # due soon (7 days)
    commits = await db.commitments.find({"status": "a_vencer"}, {"_id": 0}).to_list(100000)
    soon = [c for c in commits if E_days(c.get("due_date")) is not None and 0 <= E_days(c["due_date"]) <= 7]
    if soon:
        total = sum(c.get("amount", 0) or 0 for c in soon)
        alerts.append({"type": "due_soon", "severity": "medium", "icon": "Clock",
                       "title": f"{len(soon)} vencimento(s) nos próximos 7 dias",
                       "message": f"Total: R$ {total:,.2f}. Fique atento para não atrasar."})

    # negative projected months
    plan = await E.compute_planning(12)
    tight = [p for p in plan if p["projected_balance"] < 0]
    if tight:
        m = tight[0]
        alerts.append({"type": "projection", "severity": "high", "icon": "TrendDown",
                       "title": f"Mês no vermelho: {E_month_label(m['month'])}",
                       "message": f"Saldo projetado de R$ {m['projected_balance']:,.2f}. Reduza gastos ou antecipe entradas."})
    else:
        low = [p for p in plan if p["net"] < 0]
        if low:
            m = low[0]
            alerts.append({"type": "projection_net", "severity": "medium", "icon": "TrendDown",
                           "title": f"Mês apertado: {E_month_label(m['month'])}",
                           "message": f"Nesse mês sairá mais do que entra (resultado R$ {m['net']:,.2f})."})

    # needs planned beyond commitments (per month)
    for p in plan[:3]:
        if p["needs"] > 0:
            alerts.append({"type": "needs", "severity": "low", "icon": "ClipboardText",
                           "title": f"{E_month_label(p['month'])} tem necessidades planejadas",
                           "message": f"R$ {p['needs']:,.2f} em necessidades além dos compromissos normais."})
            break

    # urgent needs
    urgent = await db.needs.find({"status": "pendente", "priority": "urgente"}, {"_id": 0}).to_list(1000)
    if urgent:
        alerts.append({"type": "urgent_need", "severity": "high", "icon": "Fire",
                       "title": f"{len(urgent)} necessidade(s) urgente(s)",
                       "message": ", ".join(n["title"] for n in urgent[:3])})

    # goals behind schedule
    goals = await db.goals.find({}, {"_id": 0}).to_list(1000)
    for g in goals:
        if g.get("deadline") and g.get("target", 0) > 0:
            months_left = _months_between(today, g["deadline"])
            if months_left is not None and months_left <= 0 and g.get("current", 0) < g.get("target", 0):
                alerts.append({"type": "goal", "severity": "medium", "icon": "Target",
                               "title": f"Meta atrasada: {g['name']}",
                               "message": f"Prazo passou e faltam R$ {g['target'] - g.get('current',0):,.2f}."})

    # receivables
    if dash["to_receive"] > 0:
        alerts.append({"type": "receivable", "severity": "low", "icon": "HandCoins",
                       "title": "Você tem valores a receber",
                       "message": f"Total pendente: R$ {dash['to_receive']:,.2f}."})

    order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: order.get(a["severity"], 3))
    return alerts


def E_days(iso):
    if not iso:
        return None
    d = datetime.fromisoformat(iso[:10]).date()
    return (d - date.today()).days


def _months_between(a, b):
    try:
        da = datetime.fromisoformat(a[:10]).date()
        db_ = datetime.fromisoformat(b[:10]).date()
        return (db_.year - da.year) * 12 + (db_.month - da.month)
    except Exception:
        return None


MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]


def E_month_label(mk):
    y, m = mk.split("-")
    return f"{MESES[int(m)-1]} {y}"


# =============================================================
# MONTHLY SUMMARY
# =============================================================
@extra.get("/summary/month")
async def summary_month(month: str = None):
    mk = month or date.today().strftime("%Y-%m")
    txs = await db.transactions.find({}, {"_id": 0}).to_list(100000)
    cur = [t for t in txs if (t.get("date") or "")[:7] == mk]
    income = sum(t.get("amount", 0) or 0 for t in cur if t.get("type") == "income")
    expense = sum(t.get("amount", 0) or 0 for t in cur if t.get("type") == "expense")

    # previous month
    y, m = int(mk[:4]), int(mk[5:7])
    idx = y * 12 + (m - 1) - 1
    pmk = f"{idx//12:04d}-{(idx%12)+1:02d}"
    prev = [t for t in txs if (t.get("date") or "")[:7] == pmk]
    prev_exp = sum(t.get("amount", 0) or 0 for t in prev if t.get("type") == "expense")

    # top category
    cats = {}
    for t in cur:
        if t.get("type") == "expense":
            c = t.get("category") or "Outros"
            cats[c] = cats.get(c, 0) + (t.get("amount", 0) or 0)
    top = max(cats.items(), key=lambda x: x[1]) if cats else None

    result = income - expense
    savings_rate = (result / income * 100) if income > 0 else 0
    diff_pct = ((expense - prev_exp) / prev_exp * 100) if prev_exp > 0 else None

    return {
        "month": mk,
        "income": round(income, 2),
        "expense": round(expense, 2),
        "result": round(result, 2),
        "savings_rate": round(savings_rate, 1),
        "top_category": top[0] if top else None,
        "top_category_value": round(top[1], 2) if top else 0,
        "expense_diff_pct": round(diff_pct, 1) if diff_pct is not None else None,
        "tx_count": len(cur),
    }


# =============================================================
# INVESTMENT RADAR (Banco Central + AI)
# =============================================================
_rate_cache = {"ts": 0, "data": None}


def _sgs(code, last=1):
    url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados/ultimos/{last}?formato=json"
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    return r.json()


@extra.get("/investments/rates")
async def investment_rates():
    now = time.time()
    if _rate_cache["data"] and now - _rate_cache["ts"] < 3600:
        return _rate_cache["data"]
    try:
        selic = float(_sgs(432, 1)[-1]["valor"])  # meta Selic % a.a.
        ipca_list = _sgs(433, 12)  # IPCA mensal %
        ipca_12m = 1.0
        for it in ipca_list:
            ipca_12m *= (1 + float(it["valor"]) / 100)
        ipca_12m = round((ipca_12m - 1) * 100, 2)
        updated = ipca_list[-1]["data"]
    except Exception as e:
        raise HTTPException(502, f"Não foi possível obter dados do Banco Central: {e}")

    cdi = round(selic - 0.10, 2)
    poupanca = round(0.5 * 12 + 0.15, 2) if selic > 8.5 else round(selic * 0.70, 2)

    options = [
        {"nome": "Poupança", "rentab_anual": poupanca, "indexador": "TR + regra", "liquidez": "Imediata",
         "risco": "Baixo", "imposto": "Isento de IR", "garantia": "FGC", "valor_minimo": "R$ 0",
         "obs": "Rende menos que a Selic quando os juros estão altos."},
        {"nome": "Tesouro Selic", "rentab_anual": selic, "indexador": "100% Selic", "liquidez": "D+1",
         "risco": "Muito baixo", "imposto": "IR regressivo (22,5% a 15%)", "garantia": "Tesouro Nacional",
         "valor_minimo": "~R$ 150", "obs": "Reserva de emergência clássica."},
        {"nome": "CDB 100% CDI", "rentab_anual": cdi, "indexador": "100% CDI", "liquidez": "Varia (diária a no venc.)",
         "risco": "Baixo", "imposto": "IR regressivo", "garantia": "FGC até R$ 250 mil",
         "valor_minimo": "R$ 1 a R$ 1.000", "obs": "Bancos menores costumam pagar mais."},
        {"nome": "LCI / LCA 90% CDI", "rentab_anual": round(cdi * 0.90, 2), "indexador": "~90% CDI", "liquidez": "Carência (90+ dias)",
         "risco": "Baixo", "imposto": "Isento de IR", "garantia": "FGC até R$ 250 mil",
         "valor_minimo": "R$ 1.000+", "obs": "Isenção de IR compensa o percentual menor do CDI."},
        {"nome": "Tesouro IPCA+", "rentab_anual": round(ipca_12m + 6.0, 2), "indexador": f"IPCA + ~6% a.a.", "liquidez": "D+1 (com marcação a mercado)",
         "risco": "Médio (se vender antes)", "imposto": "IR regressivo", "garantia": "Tesouro Nacional",
         "valor_minimo": "~R$ 50", "obs": "Protege do longo prazo contra a inflação."},
    ]

    data = {
        "selic": selic, "cdi": cdi, "ipca_12m": ipca_12m,
        "updated": updated, "source": "Banco Central do Brasil (SGS)", "options": options,
    }
    _rate_cache["ts"] = now
    _rate_cache["data"] = data
    return data


class SimBody(BaseModel):
    amount: float = 0
    monthly: float = 0
    months: int = 12
    rate_annual: float


@extra.post("/investments/simulate")
async def simulate(body: SimBody):
    mr = (1 + body.rate_annual / 100) ** (1 / 12) - 1
    fv = body.amount
    contributed = body.amount
    series = []
    for i in range(1, body.months + 1):
        fv = fv * (1 + mr) + body.monthly
        contributed += body.monthly
        if i % max(1, body.months // 12) == 0 or i == body.months:
            series.append({"month": i, "value": round(fv, 2), "contributed": round(contributed, 2)})
    return {
        "future_value": round(fv, 2),
        "contributed": round(contributed, 2),
        "gross_gain": round(fv - contributed, 2),
        "monthly_rate": round(mr * 100, 3),
        "series": series,
    }


class AnalyzeBody(BaseModel):
    amount: float = 0
    horizon_months: int = 12
    goal: str = ""


@extra.post("/investments/analyze")
async def analyze(body: AnalyzeBody):
    rates = await investment_rates()
    dash = await E.compute_dashboard()

    opts_txt = "\n".join(
        f"- {o['nome']}: {o['rentab_anual']}% a.a., liquidez {o['liquidez']}, risco {o['risco']}, {o['imposto']}, garantia {o['garantia']}"
        for o in rates["options"]
    )
    prompt = f"""Você é um assistente educativo de finanças no Brasil. Com base nas TAXAS OFICIAIS ATUAIS do Banco Central abaixo, faça uma COMPARAÇÃO INFORMATIVA (não é recomendação financeira personalizada) entre as opções de investimento.

Taxas atuais (fonte: Banco Central, atualizado em {rates['updated']}):
- Selic meta: {rates['selic']}% a.a.
- CDI (estimado): {rates['cdi']}% a.a.
- IPCA 12 meses: {rates['ipca_12m']}%

Opções disponíveis:
{opts_txt}

Situação do usuário:
- Disponível real hoje: R$ {dash['available']:,.2f}
- Valor a investir considerado: R$ {body.amount:,.2f}
- Horizonte: {body.horizon_months} meses
- Objetivo: {body.goal or 'não informado'}

Escreva em português do Brasil, de forma curta e clara (máx 5 parágrafos curtos ou bullets), comparando rentabilidade, liquidez, risco, impostos e proteção (FGC). Ao final, inclua UMA frase deixando claro que isto é apenas uma comparação informativa e não constitui recomendação financeira personalizada. Não invente taxas diferentes das fornecidas."""

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"invest-{secrets.token_hex(6)}",
            system_message="Você é um assistente educativo de finanças pessoais no Brasil. Nunca faça recomendações personalizadas; apenas comparações informativas.",
        ).with_model("anthropic", "claude-sonnet-4-6")
        text = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        raise HTTPException(502, f"Falha ao gerar análise: {e}")
    return {"analysis": text, "rates": rates}


# =============================================================
# APP LOCK (PIN + WebAuthn biometrics)
# =============================================================
LOCK_ID = "app_lock"


class PinBody(BaseModel):
    pin: str = Field(pattern=r"^\d{4,6}$")


class ChangePinBody(BaseModel):
    current_pin: str
    new_pin: str = Field(pattern=r"^\d{4,6}$")


def _now():
    return datetime.now(timezone.utc)


async def _lock_doc():
    return await db.settings.find_one({"_id": LOCK_ID})


@extra.get("/lock/status")
async def lock_status():
    doc = await _lock_doc()
    if not doc:
        return {"configured": False, "biometric": False}
    locked_until = doc.get("locked_until")
    lu = None
    if locked_until:
        lu_dt = datetime.fromisoformat(locked_until)
        if lu_dt > _now():
            lu = locked_until
    return {"configured": True, "biometric": bool(doc.get("webauthn")), "locked_until": lu}


@extra.post("/lock/setup")
async def lock_setup(body: PinBody):
    if await _lock_doc():
        raise HTTPException(409, "PIN já configurado")
    hashed = bcrypt.hashpw(body.pin.encode(), bcrypt.gensalt(rounds=12)).decode()
    await db.settings.insert_one({"_id": LOCK_ID, "pin_hash": hashed, "failed_attempts": 0, "locked_until": None})
    return {"ok": True}


@extra.post("/lock/unlock")
async def lock_unlock(body: PinBody):
    doc = await _lock_doc()
    if not doc:
        raise HTTPException(404, "PIN não configurado")
    lu = doc.get("locked_until")
    if lu and datetime.fromisoformat(lu) > _now():
        raise HTTPException(429, "Muitas tentativas. Tente novamente em instantes.")
    if not bcrypt.checkpw(body.pin.encode(), doc["pin_hash"].encode()):
        fails = doc.get("failed_attempts", 0) + 1
        delay = min(900, 30 * (2 ** max(0, fails - 5))) if fails >= 5 else 0
        upd = {"failed_attempts": fails}
        upd["locked_until"] = (_now() + timedelta(seconds=delay)).isoformat() if delay else None
        await db.settings.update_one({"_id": LOCK_ID}, {"$set": upd})
        raise HTTPException(401, "PIN incorreto")
    await db.settings.update_one({"_id": LOCK_ID}, {"$set": {"failed_attempts": 0, "locked_until": None}})
    return {"ok": True}


@extra.post("/lock/change")
async def lock_change(body: ChangePinBody):
    doc = await _lock_doc()
    if not doc:
        raise HTTPException(404, "PIN não configurado")
    if not bcrypt.checkpw(body.current_pin.encode(), doc["pin_hash"].encode()):
        raise HTTPException(401, "PIN atual incorreto")
    hashed = bcrypt.hashpw(body.new_pin.encode(), bcrypt.gensalt(rounds=12)).decode()
    await db.settings.update_one({"_id": LOCK_ID}, {"$set": {"pin_hash": hashed}})
    return {"ok": True}


@extra.post("/lock/remove")
async def lock_remove(body: PinBody):
    doc = await _lock_doc()
    if not doc:
        return {"ok": True}
    if not bcrypt.checkpw(body.pin.encode(), doc["pin_hash"].encode()):
        raise HTTPException(401, "PIN incorreto")
    await db.settings.delete_one({"_id": LOCK_ID})
    return {"ok": True}


# ---- WebAuthn biometrics ----
def _b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64u(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


@extra.post("/lock/webauthn/register/options")
async def wa_register_options():
    from webauthn import generate_registration_options, options_to_json
    from webauthn.helpers.structs import AuthenticatorSelectionCriteria, ResidentKeyRequirement, UserVerificationRequirement
    opts = generate_registration_options(
        rp_id=RP_ID, rp_name="Meu Bolso", user_id=b"local-user", user_name="local",
        user_display_name="Meu Bolso",
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )
    await db.settings.update_one({"_id": LOCK_ID}, {"$set": {"reg_challenge": _b64u(opts.challenge)}}, upsert=True)
    import json
    return json.loads(options_to_json(opts))


class CredBody(BaseModel):
    credential: dict


@extra.post("/lock/webauthn/register/verify")
async def wa_register_verify(body: CredBody):
    from webauthn import verify_registration_response
    doc = await _lock_doc()
    ch = doc.get("reg_challenge") if doc else None
    if not ch:
        raise HTTPException(400, "Nenhuma cerimônia de registro")
    try:
        import json
        res = verify_registration_response(
            credential=json.dumps(body.credential),
            expected_challenge=_unb64u(ch), expected_rp_id=RP_ID, expected_origin=ORIGIN,
            require_user_verification=False,
        )
    except Exception as e:
        raise HTTPException(400, f"Falha no registro biométrico: {e}")
    await db.settings.update_one({"_id": LOCK_ID}, {"$set": {"webauthn": {
        "credential_id": _b64u(res.credential_id),
        "public_key": _b64u(res.credential_public_key),
        "sign_count": res.sign_count,
    }}, "$unset": {"reg_challenge": ""}})
    return {"ok": True}


@extra.post("/lock/webauthn/auth/options")
async def wa_auth_options():
    from webauthn import generate_authentication_options, options_to_json
    from webauthn.helpers.structs import PublicKeyCredentialDescriptor, UserVerificationRequirement
    doc = await _lock_doc()
    if not doc or not doc.get("webauthn"):
        raise HTTPException(404, "Biometria não configurada")
    cred_id = _unb64u(doc["webauthn"]["credential_id"])
    opts = generate_authentication_options(
        rp_id=RP_ID, allow_credentials=[PublicKeyCredentialDescriptor(id=cred_id)],
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    await db.settings.update_one({"_id": LOCK_ID}, {"$set": {"auth_challenge": _b64u(opts.challenge)}})
    import json
    return json.loads(options_to_json(opts))


@extra.post("/lock/webauthn/auth/verify")
async def wa_auth_verify(body: CredBody):
    from webauthn import verify_authentication_response
    doc = await _lock_doc()
    ch = doc.get("auth_challenge") if doc else None
    w = doc.get("webauthn") if doc else None
    if not ch or not w:
        raise HTTPException(400, "Nenhuma cerimônia de autenticação")
    try:
        import json
        res = verify_authentication_response(
            credential=json.dumps(body.credential),
            expected_challenge=_unb64u(ch), expected_rp_id=RP_ID, expected_origin=ORIGIN,
            credential_public_key=_unb64u(w["public_key"]),
            credential_current_sign_count=w.get("sign_count", 0),
            require_user_verification=False,
        )
    except Exception as e:
        raise HTTPException(401, f"Falha na verificação biométrica: {e}")
    await db.settings.update_one({"_id": LOCK_ID}, {"$set": {"webauthn.sign_count": res.new_sign_count, "failed_attempts": 0, "locked_until": None}, "$unset": {"auth_challenge": ""}})
    return {"ok": True}
