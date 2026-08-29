import React, { useState, useEffect } from "react";
import { api } from "@/lib/finance";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common";

/**
 * fields: [{ name, label, type: text|number|date|select|textarea, options?, default?, required? }]
 * renderItem: (item) => JSX for list row content
 */
export default function CrudManager({
  endpoint, title, fields, renderItem, onChanged, testid, emptyIcon, emptyHint, addLabel = "Adicionar",
}) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setItems(await api.get(endpoint)); } finally { setLoading(false); }
  };
  useEffect(() => {
  load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [endpoint]);
  const openNew = () => {
    const init = {};
    fields.forEach((f) => (init[f.name] = f.default ?? ""));
    setForm(init); setEditing(null); setOpen(true);
  };
  const openEdit = (item) => {
    const init = {};
    fields.forEach((f) => (init[f.name] = item[f.name] ?? f.default ?? ""));
    setForm(init); setEditing(item); setOpen(true);
  };

  const save = async () => {
    for (const f of fields) {
      if (f.required && (form[f.name] === "" || form[f.name] == null)) return toast.error(`Preencha: ${f.label}`);
    }
    const body = {};
    fields.forEach((f) => {
      let v = form[f.name];
      if (f.type === "number") v = v === "" ? 0 : parseFloat(String(v).replace(",", "."));
      body[f.name] = v;
    });
    try {
      if (editing) await api.put(`${endpoint}/${editing.id}`, body);
      else await api.post(endpoint, body);
      toast.success("Salvo!");
      setOpen(false); load(); onChanged && onChanged();
    } catch { toast.error("Erro ao salvar"); }
  };

  const remove = async (item) => {
    try { await api.del(`${endpoint}/${item.id}`); load(); onChanged && onChanged(); toast.success("Excluído"); }
    catch { toast.error("Erro ao excluir"); }
  };

  return (
    <div data-testid={testid}>
      <Button onClick={openNew} data-testid={`${testid}-add-btn`} className="w-full h-11 rounded-2xl mb-4 gap-2">
        <Plus size={18} weight="bold" /> {addLabel}
      </Button>

      {loading ? <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p> :
        items.length === 0 ? <EmptyState icon={emptyIcon} title={`Nenhum item`} hint={emptyHint} /> : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3" data-testid={`${testid}-item-${item.id}`}>
                <div className="flex-1 min-w-0">{renderItem(item)}</div>
                <button onClick={() => openEdit(item)} className="text-muted-foreground hover:text-primary transition-colors p-1" data-testid={`${testid}-edit-${item.id}`}><PencilSimple size={18} /></button>
                <button onClick={() => remove(item)} className="text-muted-foreground hover:text-destructive transition-colors p-1" data-testid={`${testid}-delete-${item.id}`}><Trash size={18} /></button>
              </div>
            ))}
          </div>
        )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl max-w-md" data-testid={`${testid}-dialog`}>
          <DialogHeader><DialogTitle className="font-head">{editing ? "Editar" : addLabel}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label>{f.label}</Label>
                {f.type === "select" ? (
                  <Select value={String(form[f.name] ?? "")} onValueChange={(v) => setForm({ ...form, [f.name]: v })}>
                    <SelectTrigger data-testid={`field-${f.name}`}><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : f.type === "textarea" ? (
                  <Textarea data-testid={`field-${f.name}`} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
                ) : (
                  <Input data-testid={`field-${f.name}`} type={f.type === "number" ? "text" : f.type} inputMode={f.type === "number" ? "decimal" : undefined}
                    value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} placeholder={f.placeholder} />
                )}
              </div>
            ))}
            <Button onClick={save} data-testid={`${testid}-save-btn`} className="w-full h-11 rounded-2xl mt-2">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
