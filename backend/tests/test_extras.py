"""
Backend tests for new features (iteration 2):
- Alerts, Monthly summary, Investment radar (BCB), Simulate, AI Analyze,
- App Lock (PIN, rate limit, change, remove) + WebAuthn options.
"""
import os
import time
from datetime import date

import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module", autouse=True)
def _cleanup_pin(s):
    """Guarantee no PIN is left configured before or after this module."""
    # try to remove any existing PIN prior to tests
    for p in ("1234", "4321", "9876", "5678", "0000"):
        try:
            s.post(f"{API}/lock/remove", json={"pin": p}, timeout=10)
        except Exception:
            pass
    yield
    # final cleanup - unlock (if locked) then remove
    try:
        st = s.get(f"{API}/lock/status", timeout=10).json()
        if st.get("configured"):
            # try known test pins
            for p in ("4321", "1234", "9876", "5678"):
                r = s.post(f"{API}/lock/remove", json={"pin": p}, timeout=10)
                if r.status_code == 200:
                    break
    except Exception:
        pass


# =============================== ALERTS ==================================
class TestAlerts:
    def test_alerts_shape(self, s):
        r = s.get(f"{API}/alerts", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # each alert has required fields
        for a in data:
            for k in ("type", "severity", "icon", "title", "message"):
                assert k in a, f"alert missing {k}: {a}"
            assert a["severity"] in ("high", "medium", "low")
        # sorted by severity (high -> medium -> low)
        order = {"high": 0, "medium": 1, "low": 2}
        sev_seq = [order[a["severity"]] for a in data]
        assert sev_seq == sorted(sev_seq), "alerts not sorted by severity"


# =============================== SUMMARY =================================
class TestSummary:
    def test_current_month(self, s):
        r = s.get(f"{API}/summary/month", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("month", "income", "expense", "result", "savings_rate",
                  "top_category", "top_category_value", "expense_diff_pct", "tx_count"):
            assert k in d, f"missing key {k}"
        assert d["month"] == date.today().strftime("%Y-%m")
        assert round(d["income"] - d["expense"], 2) == round(d["result"], 2)
        assert isinstance(d["tx_count"], int)

    def test_specific_month(self, s):
        r = s.get(f"{API}/summary/month?month=2025-01", timeout=30)
        assert r.status_code == 200
        assert r.json()["month"] == "2025-01"


# =============================== INVESTMENT RATES ========================
class TestRates:
    def test_rates_from_bcb(self, s):
        r = s.get(f"{API}/investments/rates", timeout=30)
        if r.status_code == 502:
            pytest.skip("BCB SGS API temporarily unavailable")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("selic", "cdi", "ipca_12m", "updated", "source", "options"):
            assert k in d
        assert d["selic"] > 0
        assert d["cdi"] > 0
        assert d["ipca_12m"] > 0
        assert len(d["options"]) == 5
        names = [o["nome"] for o in d["options"]]
        assert any("Poupança" in n for n in names)
        assert any("Tesouro Selic" in n for n in names)
        assert any("CDB" in n for n in names)
        assert any("LCI" in n or "LCA" in n for n in names)
        assert any("IPCA" in n for n in names)
        for o in d["options"]:
            for k in ("nome", "rentab_anual", "liquidez", "risco", "imposto", "garantia"):
                assert k in o, f"option missing {k}: {o}"


# =============================== SIMULATE ================================
class TestSimulate:
    def test_simulate_basic_compound(self, s):
        r = s.post(f"{API}/investments/simulate",
                   json={"amount": 1000, "monthly": 100, "months": 12, "rate_annual": 12},
                   timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("future_value", "contributed", "gross_gain", "monthly_rate", "series"):
            assert k in d
        assert d["contributed"] == 1000 + 100 * 12  # 2200
        assert d["future_value"] > d["contributed"]  # positive growth
        assert round(d["gross_gain"], 2) == round(d["future_value"] - d["contributed"], 2)
        assert isinstance(d["series"], list) and len(d["series"]) >= 1
        # monthly rate ~= (1.12)^(1/12)-1 = ~0.949%
        assert 0.9 < d["monthly_rate"] < 1.0

    def test_simulate_zero_rate(self, s):
        r = s.post(f"{API}/investments/simulate",
                   json={"amount": 500, "monthly": 0, "months": 6, "rate_annual": 0},
                   timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["future_value"] == 500
        assert d["gross_gain"] == 0


# =============================== ANALYZE (AI) ============================
class TestAnalyze:
    def test_analyze_returns_text(self, s):
        r = s.post(f"{API}/investments/analyze",
                   json={"amount": 5000, "horizon_months": 12, "goal": "reserva de emergência"},
                   timeout=90)
        if r.status_code == 502:
            body = r.text.lower()
            if "banco central" in body:
                pytest.skip("BCB API down; analyze depends on rates")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "analysis" in d
        assert isinstance(d["analysis"], str) and len(d["analysis"].strip()) > 50


# =============================== APP LOCK ================================
class TestLock:
    def test_status_no_pin(self, s):
        r = s.get(f"{API}/lock/status", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["configured"] is False
        assert d["biometric"] is False

    def test_setup_pin(self, s):
        r = s.post(f"{API}/lock/setup", json={"pin": "1234"}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
        # second setup -> 409
        r2 = s.post(f"{API}/lock/setup", json={"pin": "1234"}, timeout=10)
        assert r2.status_code == 409

    def test_status_after_setup(self, s):
        r = s.get(f"{API}/lock/status", timeout=10)
        assert r.status_code == 200
        assert r.json()["configured"] is True

    def test_unlock_wrong_then_correct(self, s):
        r = s.post(f"{API}/lock/unlock", json={"pin": "9999"}, timeout=10)
        assert r.status_code == 401
        r2 = s.post(f"{API}/lock/unlock", json={"pin": "1234"}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["ok"] is True

    def test_rate_limit_after_5_wrong(self, s):
        got_429 = False
        for i in range(8):
            r = s.post(f"{API}/lock/unlock", json={"pin": "0000"}, timeout=10)
            if r.status_code == 429:
                got_429 = True
                break
            assert r.status_code == 401, f"iter {i}: {r.status_code} {r.text}"
        assert got_429, "expected 429 after multiple failures"
        # locked_until surfaced via status
        st = s.get(f"{API}/lock/status", timeout=10).json()
        assert st.get("locked_until") is not None

    def test_change_pin(self, s):
        # while locked_until still may be active, change endpoint doesn't check locked_until
        r_bad = s.post(f"{API}/lock/change",
                       json={"current_pin": "0000", "new_pin": "4321"}, timeout=10)
        assert r_bad.status_code == 401
        r = s.post(f"{API}/lock/change",
                   json={"current_pin": "1234", "new_pin": "4321"}, timeout=10)
        assert r.status_code == 200, r.text

    def test_webauthn_register_options(self, s):
        r = s.post(f"{API}/lock/webauthn/register/options", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "challenge" in d
        assert isinstance(d["challenge"], str) and len(d["challenge"]) > 10

    def test_remove_pin(self, s):
        # wrong pin -> 401
        r_bad = s.post(f"{API}/lock/remove", json={"pin": "0000"}, timeout=10)
        assert r_bad.status_code == 401
        r = s.post(f"{API}/lock/remove", json={"pin": "4321"}, timeout=10)
        assert r.status_code == 200
        # status back to unconfigured
        st = s.get(f"{API}/lock/status", timeout=10).json()
        assert st["configured"] is False
