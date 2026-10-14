"use client";
import { useFormStatus } from "react-dom";
import { ArrowUpRight, LoaderCircle } from "lucide-react";

export function ServiceSubmit({ label, disabled = false }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="button button-primary full service-submit" disabled={disabled || pending} aria-busy={pending}>
    {pending ? <><LoaderCircle size={18} className="service-spinner" aria-hidden="true" /> Invio in corso…</> : <>{label}<ArrowUpRight size={18} aria-hidden="true" /></>}
  </button>;
}
