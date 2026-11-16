export type Rule = { required?: boolean; email?: boolean; url?: boolean; min?: number; max?: number; label: string };
export type Rules = Record<string, Rule>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validate(values: Record<string, string>, rules: Rules): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [name, rule] of Object.entries(rules)) {
    const v = (values[name] ?? "").trim();
    if (!v) {
      if (rule.required) errors[name] = `${rule.label}: campo obbligatorio.`;
      continue;
    }
    if (rule.email && !EMAIL.test(v)) errors[name] = `${rule.label}: inserisci un indirizzo email valido.`;
    if (rule.url) {
      try {
        const u = new URL(v);
        if (!/^https?:$/.test(u.protocol)) throw new Error();
      } catch {
        errors[name] = `${rule.label}: inserisci un link completo (https://…).`;
      }
    }
    if (rule.min != null || rule.max != null) {
      const n = Number(v);
      if (!Number.isFinite(n)) errors[name] = `${rule.label}: inserisci un numero.`;
      else if (rule.min != null && n < rule.min) errors[name] = `${rule.label}: minimo ${rule.min}.`;
      else if (rule.max != null && n > rule.max) errors[name] = `${rule.label}: massimo ${rule.max}.`;
    }
  }
  return errors;
}

export function demoId(prefix: string) {
  const n = Math.floor(Math.random() * 36 ** 5).toString(36).toUpperCase().padStart(5, "0");
  return `${prefix}-${n}`;
}
