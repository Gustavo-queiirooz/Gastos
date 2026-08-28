import React, { useState, useEffect } from "react";
import { api } from "@/lib/finance";
import { prepareCreationOptions, serializeCredential, webauthnAvailable } from "@/lib/webauthn";
import { Card } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LockKey, FingerprintSimple, ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function SecuritySettings() {
  const [status, setStatus] = useState(null);
  const [pin, setPin] = useState("");
  const [curPin, setCurPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const load = () => api.get("/lock/status").then(setStatus);
  useEffect(() => { load(); }, []);

  const setup = async () => {
    if (!/^\d{4,6}$/.test(pin)) return toast.error("PIN deve ter 4 a 6 dígitos");
    try { await api.post("/lock/setup", { pin }); toast.success("PIN ativado!"); setPin(""); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erro"); }
  };
  const change = async () => {
    if (!/^\d{4,6}$/.test(newPin)) return toast.error("Novo PIN deve ter 4 a 6 dígitos");
    try { await api.post("/lock/change", { current_pin: curPin, new_pin: newPin }); toast.success("PIN alterado!"); setCurPin(""); setNewPin(""); }
    catch (e) { toast.error(e?.response?.data?.detail || "PIN atual incorreto"); }
  };
  const remove = async () => {
    if (!/^\d{4,6}$/.test(pin)) return toast.error("Digite o PIN atual");
    try { await api.post("/lock/remove", { pin }); toast.success("Bloqueio removido"); setPin(""); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "PIN incorreto"); }
  };
  const enrollBiometric = async () => {
    if (!webauthnAvailable()) return toast.error("Biometria indisponível neste dispositivo/navegador");
    try {
      const opts = await api.post("/lock/webauthn/register/options", {});
      const cred = await navigator.credentials.create({ publicKey: prepareCreationOptions(opts) });
      await api.post("/lock/webauthn/register/verify", { credential: serializeCredential(cred) });
      toast.success("Biometria cadastrada!"); load();
    } catch (e) { toast.error("Não foi possível cadastrar a biometria"); }
  };

  if (!status) return null;

  return (
    <div className="space-y-3" data-testid="security-settings">
      <Card>
        <div className="flex items-center gap-2 mb-1"><ShieldCheck size={20} weight="duotone" className="text-primary" /><p className="font-head font-bold text-sm">Bloqueio do app</p></div>
        <p className="text-xs text-muted-foreground mb-4">Proteja seus dados com um PIN. O bloqueio é solicitado ao abrir o app.</p>

        {!status.configured ? (
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Criar PIN (4 a 6 dígitos)</Label><Input inputMode="numeric" maxLength={6} type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" data-testid="setup-pin-input" /></div>
            <Button onClick={setup} className="w-full h-11 rounded-2xl gap-2" data-testid="setup-pin-btn"><LockKey size={18} /> Ativar bloqueio</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--positive))] font-semibold"><ShieldCheck size={18} weight="fill" /> Bloqueio ativo</div>

            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alterar PIN</p>
              <Input inputMode="numeric" maxLength={6} type="password" value={curPin} onChange={(e) => setCurPin(e.target.value.replace(/\D/g, ""))} placeholder="PIN atual" data-testid="cur-pin-input" />
              <Input inputMode="numeric" maxLength={6} type="password" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder="Novo PIN" data-testid="new-pin-input" />
              <Button onClick={change} variant="outline" className="w-full h-10 rounded-2xl" data-testid="change-pin-btn">Alterar PIN</Button>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Biometria</p>
              {status.biometric ? (
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--positive))] font-semibold"><FingerprintSimple size={18} weight="fill" /> Biometria cadastrada</div>
              ) : (
                <Button onClick={enrollBiometric} variant="outline" className="w-full h-10 rounded-2xl gap-2" data-testid="enroll-biometric-btn"><FingerprintSimple size={18} /> Cadastrar impressão digital / Face ID</Button>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Remover bloqueio</p>
              <Input inputMode="numeric" maxLength={6} type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="Confirme o PIN" data-testid="remove-pin-input" />
              <Button onClick={remove} variant="destructive" className="w-full h-10 rounded-2xl" data-testid="remove-pin-btn">Remover bloqueio</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
