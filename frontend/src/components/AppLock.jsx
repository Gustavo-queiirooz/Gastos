import React, { useState, useEffect } from "react";
import { api } from "@/lib/finance";
import { b64uToBuf, prepareRequestOptions, serializeCredential, webauthnAvailable } from "@/lib/webauthn";
import { Backspace, FingerprintSimple, LockKey } from "@phosphor-icons/react";
import { toast } from "sonner";

const UNLOCK_KEY = "mb_unlocked";

export function isUnlocked() {
  return sessionStorage.getItem(UNLOCK_KEY) === "1";
}

export default function AppLock({ children }) {
  const [status, setStatus] = useState(null);
  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/lock/status").then(setStatus).catch(() => setStatus({ configured: false }));
  }, []);

  const doUnlock = async (value) => {
    setBusy(true);
    try {
      await api.post("/lock/unlock", { pin: value });
      sessionStorage.setItem(UNLOCK_KEY, "1");
      setUnlocked(true);
    } catch (e) {
      setShake(true); setTimeout(() => setShake(false), 500); setPin("");
      toast.error(e?.response?.data?.detail || "PIN incorreto");
    } finally { setBusy(false); }
  };

  const press = (d) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) doUnlock(next);
  };

  const biometric = async () => {
    if (!webauthnAvailable()) return toast.error("Biometria indisponível neste dispositivo");
    setBusy(true);
    try {
      const opts = await api.post("/lock/webauthn/auth/options", {});
      const cred = await navigator.credentials.get({ publicKey: prepareRequestOptions(opts) });
      await api.post("/lock/webauthn/auth/verify", { credential: serializeCredential(cred) });
      sessionStorage.setItem(UNLOCK_KEY, "1");
      setUnlocked(true);
    } catch (e) {
      toast.error("Falha na biometria");
    } finally { setBusy(false); }
  };

  if (status === null) return <div className="min-h-screen bg-background" />;
  if (!status.configured || unlocked) return children;

  return (
    <div className="min-h-screen bg-primary text-primary-foreground flex flex-col items-center justify-center px-6" data-testid="lock-screen">
      <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center mb-5"><LockKey size={32} weight="duotone" /></div>
      <h1 className="font-head font-extrabold text-2xl tracking-tight">Meu Bolso</h1>
      <p className="text-sm opacity-70 mt-1 mb-8">Digite seu PIN para desbloquear</p>

      <div className={`flex gap-3 mb-10 ${shake ? "animate-[shake_0.4s]" : ""}`}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full transition-colors ${i < pin.length ? "bg-white" : "bg-white/20"}`} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-[260px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} onClick={() => press(String(n))} disabled={busy} data-testid={`pin-${n}`}
            className="aspect-square rounded-full bg-white/10 text-2xl font-head font-semibold hover:bg-white/20 active:scale-95 transition-transform">{n}</button>
        ))}
        {status.biometric ? (
          <button onClick={biometric} disabled={busy} data-testid="pin-biometric" className="aspect-square rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"><FingerprintSimple size={30} weight="duotone" /></button>
        ) : <div />}
        <button onClick={() => press("0")} disabled={busy} data-testid="pin-0" className="aspect-square rounded-full bg-white/10 text-2xl font-head font-semibold hover:bg-white/20 active:scale-95 transition-transform">0</button>
        <button onClick={() => setPin(pin.slice(0, -1))} data-testid="pin-backspace" className="aspect-square rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"><Backspace size={26} /></button>
      </div>

      {pin.length >= 4 && pin.length < 6 && (
        <button onClick={() => doUnlock(pin)} disabled={busy} data-testid="pin-confirm" className="mt-8 bg-white text-primary font-semibold px-8 h-11 rounded-full">Desbloquear</button>
      )}
    </div>
  );
}
