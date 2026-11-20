import { ArrowLeft, Check, Disc3, Mic, Minus, MonitorPlay, Plus, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { parseBrief } from "../lib/brief.ts";
import { BOOKING_HORIZON_DAYS, HOUR_STEP, MAX_HOURS, MIN_HOURS, appointmentLabel, availableTimes, dayHasRoom, durationLabel, fetchCalendar, fromRomeWallTime, isNightOf, shiftDay, slotAvailable, slotState, todayInRome, weekdayOf, type StudioDay } from "../lib/real-availability.ts";
import { AUDIO_PRICES, BASE_TRACKS, audioPrice, formatEuro } from "../lib/catalog.ts";
import { enterStore, goService, goStudio, SERVICE_STOP, type ServiceKind } from "../lib/nav.ts";
import { setSubShot } from "../lib/shots.ts";
import { useStudio } from "../store.tsx";
import cal from "../styles/calendar.module.css";
import s from "../styles/vs.module.css";
import type { MixService } from "../types.ts";
import { Sequencer } from "./CustomBeat.tsx";
import { DemoNotice, Field, fieldProps } from "./ui.tsx";
import { UploadZone } from "./UploadZone.tsx";
import { CountUp, KineticWords, Wizard, type WizardStep } from "./Wizard.tsx";

const euro = (v: number) => formatEuro(Math.round(v));
const contactRules = { name: { required: true, label: "Nome" }, email: { required: true, email: true, label: "Email" } };
const st = (k: number) => ({ ["--c" as string]: k }) as CSSProperties;

function ContactFields({ errors, artist = true }: { errors: Record<string, string>; artist?: boolean }) {
  return (
    <div className={s.grid2}>
      <div className={s.rise} style={st(0)}><Field label="Nome *" name="name" error={errors.name}><input {...fieldProps("name", errors)} autoComplete="name" /></Field></div>
      {artist && <div className={s.rise} style={st(1)}><Field label="Nome artista" name="artist" error={errors.artist}><input {...fieldProps("artist", errors)} /></Field></div>}
      <div className={s.rise} style={st(2)}><Field label="Email *" name="email" error={errors.email}><input {...fieldProps("email", errors)} type="email" autoComplete="email" /></Field></div>
      <div className={s.rise} style={st(3)}><Field label="Telefono (facoltativo)" name="phone" error={errors.phone}><input {...fieldProps("phone", errors)} type="tel" autoComplete="tel" /></Field></div>
    </div>
  );
}

/** After a request: go on with another service or back to the studio. */
function AfterDone({ current }: { current: ServiceKind }) {
  return (
    <div className={s.afterDone}>
      <p>Ti serve altro?</p>
      <SwitchChips current={current} />
      <button type="button" className={s.btnGhost} onClick={() => void goStudio(SERVICE_STOP[current])}>Torna allo studio</button>
    </div>
  );
}

const SERVICES: { id: ServiceKind | "store"; label: string; Icon: typeof Mic }[] = [
  { id: "recording", label: "Registrazione", Icon: Mic },
  { id: "custom", label: "Beat su misura", Icon: MonitorPlay },
  { id: "mix", label: "Mix & Master", Icon: SlidersHorizontal },
  { id: "store", label: "Beat Store", Icon: Disc3 },
];

/** Change of mind: every other service is one tap away, with its own camera move. */
function SwitchChips({ current }: { current: ServiceKind }) {
  return (
    <nav className={s.switchChips} aria-label="Cambia servizio">
      {SERVICES.filter(x => x.id !== current).map((x, k) => (
        <button key={x.id} type="button" style={st(k)} onClick={() => (x.id === "store" ? void enterStore() : void goService(x.id))}>
          <x.Icon size={15} aria-hidden="true" /> {x.label}
        </button>
      ))}
    </nav>
  );
}

/* ---------------- Recording ---------------- */
const dayFmt = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const wdFmt = new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" });
const numFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });
const noon = (d: string) => new Date(`${d}T12:00:00Z`);
const SLOT_NOTE = { busy: "occupato", short: "non basta", past: "troppo vicino", free: "" } as const;

/** Duration: from 1 hour, then in steps of 30 minutes (as the old site); the 5-hour block goes up to 5. */
function DurationControl({ hours, max, onChange, compact = false }: { hours: number; max: number; onChange: (h: number) => void; compact?: boolean }) {
  const quick = [1, 2, 3, 4, 5].filter(h => h <= max);
  return (
    <div className={cal.durControl} data-compact={compact || undefined}>
      <div className={cal.durStepper}>
        <button type="button" className={s.iconBtn} aria-label="Mezz’ora in meno" disabled={hours <= MIN_HOURS} onClick={() => onChange(Math.max(MIN_HOURS, hours - HOUR_STEP))}><Minus size={16} /></button>
        <output aria-live="polite"><strong>{durationLabel(hours)}</strong></output>
        <button type="button" className={s.iconBtn} aria-label="Mezz’ora in più" disabled={hours >= max} onClick={() => onChange(Math.min(max, hours + HOUR_STEP))}><Plus size={16} /></button>
      </div>
      {!compact && (
        <div className={cal.durQuick} role="group" aria-label="Durate rapide">
          {quick.map(h => <button key={h} type="button" aria-pressed={hours === h} onClick={() => onChange(h)}>{durationLabel(h)}</button>)}
        </div>
      )}
    </div>
  );
}

function RecordingSteps() {
  const { content } = useStudio();
  const today = todayInRome();
  const [mode, setMode] = useState<"hourly" | "block">("hourly");
  const [hours, setHours] = useState(2);
  const [page, setPage] = useState(today);
  const [days, setDays] = useState<StudioDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const selRef = useRef({ day: "", slot: "", hours: 2 });
  const maxHours = mode === "block" ? 5 : MAX_HOURS;
  const hourly = content.recording.find(p => p.hours === 1)?.price ?? 1999;
  const block = content.recording.find(p => p.hours === 5);
  const pkgId = mode === "block" ? block?.id : content.recording.find(p => p.hours === hours && p.hours < 5)?.id;
  const pkgName = mode === "block" ? `${block?.name ?? "Blocco 5 ore"} (primo appuntamento)` : `Sessione ${durationLabel(hours)}`;
  const price = mode === "block" ? block?.price ?? null : Math.round(hours * hourly);

  // The real calendar: reloaded when the page of days, the duration or a retry changes.
  useEffect(() => {
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true); setError("");
      fetchCalendar(page, abort.signal)
        .then(d => {
          if (abort.signal.aborted) return;
          const at = Date.now(), sel = selRef.current;
          setDays(d); setNow(at);
          // a selection that fresh data no longer allows is cleared, never kept silently
          if (sel.slot && !slotAvailable(d.find(x => x.date === sel.day), sel.slot, sel.hours, at)) {
            setSlot(""); setNotice(`Alle ${sel.slot} non ci sono più ${durationLabel(sel.hours)} libere: scegli un altro orario.`);
          }
        })
        .catch((e: Error) => { if (!abort.signal.aborted && e.name !== "AbortError") { setDays([]); setError(e.message); } })
        .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    }, 250);
    return () => { abort.abort(); window.clearTimeout(timer); };
  }, [page, hours, retry]);

  const dayObj = days.find(d => d.date === day);
  useEffect(() => { selRef.current = { day, slot, hours }; }, [day, slot, hours]);
  // the minimum notice moves with the clock
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(id); }, []);

  const changeHours = (h: number) => {
    setHours(h);
    // a start that has no room for the new duration is cleared at once (the calendar then reloads)
    if (slot && !slotAvailable(dayObj, slot, h, now)) { setSlot(""); setNotice(`Alle ${slot} non ci sono ${durationLabel(h)} libere: scegli un altro orario.`); }
    else setNotice("");
  };
  const pickMode = (m: "hourly" | "block", h: number) => { setMode(m); changeHours(Math.min(h, m === "block" ? 5 : MAX_HOURS)); };
  const pickPage = (next: string) => { setPage(next); setDay(""); setSlot(""); setNotice(""); };
  const pickDay = (d: string) => { setDay(d); setSlot(""); setNotice(""); setSubShot("rec:cal"); };
  const times = availableTimes(dayObj, hours, now);
  const nextRoom = dayObj && !times.length ? days.find(d => d.date > dayObj.date && dayHasRoom(d, hours, now)) : undefined;
  const nightNext = dayObj && [5, 6].includes(weekdayOf(dayObj.date)) ? days.find(d => d.date === shiftDay(dayObj.date, 1)) : undefined;
  const nightNextFree = nightNext ? availableTimes(nightNext, hours, now).filter(t => isNightOf(nightNext.date, t)) : [];
  const anyRoom = days.some(d => dayHasRoom(d, hours, now));
  const groups = dayObj ? [
    { id: "night", label: `Notte tra ${wdFmt.format(noon(shiftDay(dayObj.date, -1)))} e ${wdFmt.format(noon(dayObj.date))} · dopo mezzanotte`, times: dayObj.allSlots.filter(t => isNightOf(dayObj.date, t)) },
    { id: "day", label: "Giorno", times: dayObj.allSlots.filter(t => !isNightOf(dayObj.date, t) && t < "19:00") },
    { id: "eve", label: "Sera", times: dayObj.allSlots.filter(t => !isNightOf(dayObj.date, t) && t >= "19:00") },
  ].filter(g => g.times.length) : [];
  const valid = !loading && !error && slotAvailable(dayObj, slot, hours, now);
  const crossesMidnight = valid && (isNightOf(day, slot) || fromRomeWallTime(day, slot).getTime() + hours * 3600000 > fromRomeWallTime(shiftDay(day, 1), "00:00").getTime());

  const steps: WizardStep[] = [
    {
      id: "pkg", label: "Ore", shot: "rec:pkg", title: "Quante ore ti servono?",
      lead: "Il fonico è sempre in sala. 19,99 €/ora; venerdì e sabato dopo mezzanotte 29,99 €/ora.",
      check: () => (hours >= MIN_HOURS ? null : "Scegli la durata."),
      render: () => (
        <>
          <fieldset className={s.optionGrid}>
            <legend className={s.srOnly}>Pacchetto</legend>
            {content.recording.map((p, k) => (
              <label key={p.id} className={`${s.optionCard} ${s.rise}`} style={st(k)} data-checked={pkgId === p.id || undefined}>
                <input type="radio" name="packageCard" value={p.name} checked={pkgId === p.id} onChange={() => { pickMode(p.hours === 5 ? "block" : "hourly", p.hours); setSubShot(k % 2 ? "rec" : "rec:pkg"); }} />
                <span className={s.optHours}><CountUp value={p.hours} delay={200 + k * 140} /><small>{p.hours === 1 ? "ora" : "ore"}</small></span>
                <span className={s.optionTitle}>{p.name}</span>
                <span className={s.optionPrice}>{p.price != null ? <CountUp value={p.price} format={euro} delay={300 + k * 140} /> : "Su richiesta"}</span>
                <span className={s.muted}>{p.description}</span>
                <ul>{p.includes.map((x, j) => <li key={x} className={s.riseSm} style={st(k * 2 + j)}><Check size={14} aria-hidden="true" />{x}</li>)}</ul>
              </label>
            ))}
          </fieldset>
          <div className={s.rise} style={st(4)}>
            <p className={s.formLegend}>{mode === "block" ? "Quante delle 5 ore usi nel primo appuntamento?" : "Durata della sessione"}</p>
            <DurationControl hours={hours} max={maxHours} onChange={changeHours} />
            <p className={s.muted}>{mode === "block" ? "Il blocco costa 79,99 €; le ore restanti si usano entro 90 giorni, al massimo in 2 appuntamenti." : `${durationLabel(hours)}: ${price != null ? formatEuro(price) : "—"}. Si prenota da 1 ora, poi a mezz’ore.`}</p>
          </div>
        </>
      ),
    },
    {
      id: "when", label: "Quando", shot: "rec:cal", title: "Scegli giorno e orario",
      lead: "Disponibilità reali del calendario dello studio, in ora italiana.",
      check: () => (loading ? "Attendi: sto aggiornando il calendario." : error ? "Il calendario non è disponibile: riprova prima di continuare." : !day ? "Scegli un giorno." : !slot ? "Scegli un orario." : !valid ? "L’orario scelto non è più libero: scegline un altro." : null),
      render: () => (
        <div className={cal.realCal} aria-busy={loading || undefined}>
          <input type="hidden" name="date" value={valid ? day : ""} />
          <input type="hidden" name="time" value={valid ? slot : ""} />
          <input type="hidden" name="hours" value={String(hours)} />
          <div className={cal.calHead}>
            <DurationControl hours={hours} max={maxHours} onChange={changeHours} compact />
            <div className={cal.calNav}>
              <button type="button" className={s.iconBtn} aria-label="Due settimane prima" disabled={loading || page <= today} onClick={() => pickPage(shiftDay(page, -14) < today ? today : shiftDay(page, -14))}>←</button>
              <strong>{monthFmt.format(noon(page))}</strong>
              <button type="button" className={s.iconBtn} aria-label="Due settimane dopo" disabled={loading || shiftDay(page, 14) > shiftDay(today, BOOKING_HORIZON_DAYS)} onClick={() => pickPage(shiftDay(page, 14))}>→</button>
            </div>
          </div>
          {loading && <p className={cal.calStatus} role="status"><span className={cal.calSpin} aria-hidden="true" />Verifico gli orari liberi…</p>}
          {error && (
            <div className={cal.calError} role="alert">
              <p>{error}</p>
              <button type="button" className={s.btnSmall} onClick={() => setRetry(n => n + 1)}>Riprova</button>
            </div>
          )}
          {!error && days.length > 0 && (
            <div className={s.dayGrid} role="radiogroup" aria-label="Giorno">
              {days.map((d, k) => {
                const room = dayHasRoom(d, hours, now);
                return (
                  <button key={d.date} type="button" role="radio" aria-checked={day === d.date} disabled={!room || loading} className={`${s.day} ${s.pop}`} style={st(k)} onClick={() => pickDay(d.date)}>
                    <span>{wdFmt.format(noon(d.date))}</span><strong>{numFmt.format(noon(d.date))}</strong><small>{room ? "libero" : d.allSlots.length ? "pieno" : "chiuso"}</small>
                  </button>
                );
              })}
            </div>
          )}
          {!loading && !error && !anyRoom && (
            <div className={cal.calEmpty} role="status">
              <p>Nessun giorno con {durationLabel(hours)} consecutive libere in queste due settimane.</p>
              {shiftDay(page, 14) <= shiftDay(today, BOOKING_HORIZON_DAYS) && <button type="button" className={s.btnSmall} onClick={() => pickPage(shiftDay(page, 14))}>Guarda le due settimane dopo →</button>}
            </div>
          )}
          {!error && dayObj && (
            <div key={`${day}-${hours}`} className={s.slotBlock}>
              <p className={`${s.formLegend} ${s.rise}`} style={st(0)}>Inizio · {dayFmt.format(noon(day))} · {durationLabel(hours)}</p>
              {times.length === 0 && (
                <div className={cal.calEmpty} role="status">
                  <p>Non ci sono {durationLabel(hours)} consecutive libere in questa data. Il venerdì e il sabato si può proseguire oltre mezzanotte quando lo studio è libero.</p>
                  {nextRoom && <button type="button" className={s.btnSmall} onClick={() => pickDay(nextRoom.date)}>Primo giorno con {durationLabel(hours)} libere: {dayFmt.format(noon(nextRoom.date))} →</button>}
                </div>
              )}
              {groups.map(g => (
                <div key={g.id} className={cal.slotGroup}>
                  <p>{g.label}</p>
                  <div className={s.slots} role="radiogroup" aria-label={`Orario di inizio · ${g.label}`}>
                    {g.times.map((t, k) => {
                      const state = slotState(dayObj, t, hours, now);
                      return (
                        <button key={t} type="button" role="radio" aria-checked={slot === t} disabled={state !== "free" || loading} data-state={state} className={`${s.slot} ${s.pop}`} style={st(Math.min(k, 12) + 1)} onClick={() => { setSlot(t); setNotice(""); setSubShot("rec:contact"); window.setTimeout(() => setSubShot("rec:cal"), 1600); }}>
                          {t}{state !== "free" && <small> {SLOT_NOTE[state]}</small>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {nightNext && nightNextFree.length > 0 && <button type="button" className={s.btnGhost} onClick={() => pickDay(nightNext.date)}>Continua dopo mezzanotte: notte tra {wdFmt.format(noon(dayObj.date))} e {wdFmt.format(noon(nightNext.date))} →</button>}
            </div>
          )}
          {notice && <p className={s.fieldError} role="alert">{notice}</p>}
          {valid && <p className={cal.calPicked} role="status"><Check size={16} aria-hidden="true" /> {appointmentLabel(day, slot, hours)}</p>}
        </div>
      ),
    },
    {
      id: "you", label: "Chi sei", shot: "rec:contact", title: "Come ti contattiamo?",
      rules: contactRules,
      render: errors => <ContactFields errors={errors} />,
    },
    {
      id: "send", label: "Invio", shot: "rec:done", title: "Ultimo controllo",
      rules: { reference: { url: true, label: "Riferimento" } },
      render: errors => (
        <>
          <ul className={s.recap}>
            {[["Pacchetto", pkgName], ["Durata", durationLabel(hours)], ["Appuntamento", valid ? appointmentLabel(day, slot, hours) : "—"], ["Prezzo", price != null ? formatEuro(price) : "su richiesta"]].map(([k, v], j) => (
              <li key={k} className={s.rise} style={st(j)}><span>{k}</span><strong>{v}</strong></li>
            ))}
          </ul>
          {crossesMidnight && <p className={s.muted}>La sessione va oltre mezzanotte: per quelle ore si aggiungono 10,00 € l’ora, calcolati nella conferma.</p>}
          <p className={s.muted}>Al momento dell’invio ricontrolliamo che l’orario sia ancora libero.</p>
          <div className={s.rise} style={st(5)}><Field label="Riferimento (link a un tuo brano o provino)" name="reference" error={errors.reference}><input {...fieldProps("reference", errors)} type="url" placeholder="https://" /></Field></div>
          <div className={s.rise} style={st(6)}><Field label="Note per il fonico" name="notes" error={errors.notes}><textarea {...fieldProps("notes", errors)} rows={3} /></Field></div>
        </>
      ),
    },
  ];
  return (
    <Wizard kind="booking" steps={steps} submitLabel="Vai al riepilogo" doneShot="rec:done"
      extra={() => ({ package: pkgName, recordingMode: mode, duration: durationLabel(hours), hours: String(hours), date: day, time: slot, appointment: appointmentLabel(day, slot, hours), total: price != null ? formatEuro(price) : "" })}
      summary={() => `${pkgName} · ${appointmentLabel(day, slot, hours)}`}
      onAfterDone={<AfterDone current="recording" />} />
  );
}

/* ---------------- Custom beat ---------------- */
const GENRES = ["Trap", "Drill", "R&B", "Boom bap", "Afro", "Lo-fi", "Pop", "Altro"];
const MOODS = ["Notturno", "Energico", "Malinconico", "Solare", "Cupo", "Morbido"];
const BUDGETS = ["Da definire", "Fino a 250 €", "250–500 €", "Oltre 500 €"];

function BriefPrompt({ onBpm }: { onBpm: (n: number) => void }) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<ReturnType<typeof parseBrief> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const apply = () => {
    const form = ref.current?.closest("form");
    if (!form || !text.trim()) return;
    const r = parseBrief(text, MOODS);
    setFound(r);
    if (r.genre) { const g = form.querySelector<HTMLInputElement>(`input[name="genre"][value="${r.genre}"]`); if (g) g.checked = true; }
    if (r.bpm) onBpm(r.bpm);
    form.querySelectorAll<HTMLInputElement>('input[name="mood"]').forEach(x => { x.checked = r.moods.includes(x.value); });
    const d = form.querySelector<HTMLTextAreaElement>('textarea[name="description"]');
    if (d && !d.value.trim()) d.value = text.trim();
    // like a configurator: the answer appears, then the wizard moves on to the sound, already filled in
    const next = form.querySelector<HTMLButtonElement>("[data-wz-next]");
    window.setTimeout(() => { next?.click(); window.setTimeout(() => next?.click(), 450); }, 1100);
  };
  return (
    <div ref={ref} className={`${s.briefPrompt} ${s.rise}`} style={st(8)}>
      <label htmlFor="brief-prompt"><strong>Il tuo beat, in una frase</strong><small>Scrivilo come lo diresti a un produttore: compiliamo noi il brief.</small></label>
      <div className={s.briefRow}>
        <input id="brief-prompt" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); apply(); } }} placeholder="Es. trap cupa a 140 BPM, 808 pesanti, atmosfera notturna" autoComplete="off" />
        <button type="button" className={s.btnPrimary} onClick={apply} disabled={!text.trim()}>Prepara il brief</button>
      </div>
      {found && (
        <ul className={s.briefFound} aria-live="polite">
          <li style={st(0)}>Genere: <b>{found.genre ?? "da scegliere"}</b></li>
          <li style={st(1)}>BPM: <b>{found.bpm ?? "da scegliere"}</b></li>
          <li style={st(2)}>Mood: <b>{found.moods.length ? found.moods.join(", ") : "da scegliere"}</b></li>
        </ul>
      )}
    </div>
  );
}

function CustomSteps({ active }: { active: boolean }) {
  const { content } = useStudio();
  const cfg = content.customBeat;
  const [bpm, setBpm] = useState(120);
  const steps: WizardStep[] = [
    {
      id: "how", label: "Come funziona", shot: "custom:steps", title: "Dal brief alla consegna",
      lead: "Un percorso in cinque tappe, con un preventivo chiaro prima di iniziare.",
      render: () => (
        <>
          <ol className={s.stepsFlow}>{cfg.steps.map((x, k) => <li key={x.title} className={s.rise} style={st(k)}><span>{String(k + 1).padStart(2, "0")}</span><strong>{x.title}</strong><p>{x.text}</p></li>)}</ol>
          <dl className={s.facts}>
            <div className={s.rise} style={st(5)}><dt>Prezzo</dt><dd>{cfg.priceFrom != null ? <CountUp value={cfg.priceFrom} format={euro} delay={700} /> : "su preventivo"}</dd></div>
            <div className={s.rise} style={st(6)}><dt>Tempi</dt><dd>{cfg.turnaround}</dd></div>
            <div className={s.rise} style={st(7)}><dt>Revisioni</dt><dd>{cfg.revisions}</dd></div>
          </dl>
          <BriefPrompt onBpm={setBpm} />
        </>
      ),
    },
    {
      id: "seq", label: "Prova", shot: "custom:seq", title: "Prova a comporre",
      lead: "Accendi il sequencer e cambia i passi: lo studio suona e si muove con te.",
      render: () => <div className={s.rise} style={st(0)}><Sequencer active={active} /></div>,
    },
    {
      id: "sound", label: "Il tuo sound", shot: "custom:form", title: "Che sound cerchi?",
      rules: { genre: { required: true, label: "Genere" } },
      render: errors => (
        <>
          <fieldset className={s.pillSet} aria-invalid={errors.genre ? true : undefined}>
            <legend className={`${s.formLegend} ${s.rise}`} style={st(0)}>Genere *</legend>
            {GENRES.map((g, k) => <label key={g} className={`${s.pillOpt} ${s.pop}`} style={st(k + 1)}><input type="radio" name="genre" value={g} onChange={() => setSubShot(k % 2 ? "custom:form" : "custom:steps")} /><span>{g}</span></label>)}
            {errors.genre && <p className={s.fieldError} role="alert">{errors.genre}</p>}
          </fieldset>
          <label className={`${s.bpmPick} ${s.rise}`} style={st(9)}>
            <span>BPM</span>
            <input type="range" name="bpm" min={60} max={180} value={bpm} onChange={e => setBpm(Number(e.target.value))} style={{ ["--v" as string]: (bpm - 60) / 120 } as CSSProperties} />
            <output key={bpm} className={s.bpmOut}>{bpm}</output>
          </label>
          <fieldset className={s.pillSet}>
            <legend className={`${s.formLegend} ${s.rise}`} style={st(10)}>Mood (anche più di uno)</legend>
            {MOODS.map((m, k) => <label key={m} className={`${s.pillOpt} ${s.pop}`} style={st(k + 11)}><input type="checkbox" name="mood" value={m} /><span>{m}</span></label>)}
          </fieldset>
        </>
      ),
    },
    {
      id: "brief", label: "Brief", shot: "custom:steps", title: "Raccontaci il brano",
      rules: { description: { required: true, label: "Descrizione" }, reference: { url: true, label: "Riferimento sonoro" } },
      render: errors => (
        <>
          <div className={s.rise} style={st(0)}><Field label="Descrizione *" name="description" error={errors.description}><textarea {...fieldProps("description", errors)} rows={4} placeholder="Strumenti, atmosfera, struttura, destinazione del brano…" /></Field></div>
          <div className={s.rise} style={st(1)}><Field label="Riferimento sonoro (link)" name="reference" error={errors.reference}><input {...fieldProps("reference", errors)} type="url" placeholder="https://" /></Field></div>
          <fieldset className={s.pillSet}>
            <legend className={`${s.formLegend} ${s.rise}`} style={st(2)}>Budget indicativo</legend>
            {BUDGETS.map((b, k) => <label key={b} className={`${s.pillOpt} ${s.pop}`} style={st(k + 3)}><input type="radio" name="budget" value={b} defaultChecked={k === 0} /><span>{b}</span></label>)}
          </fieldset>
          <div className={s.rise} style={st(7)}><Field label="Deadline" name="deadline" error={errors.deadline}><input {...fieldProps("deadline", errors)} type="date" /></Field></div>
        </>
      ),
    },
    {
      id: "you", label: "Contatti", shot: "custom:form", title: "Dove ti mandiamo il preventivo?",
      rules: contactRules,
      render: errors => <ContactFields errors={errors} />,
    },
  ];
  return (
    <Wizard kind="custom-beat" steps={steps} submitLabel="Richiedi preventivo" doneShot="custom:done"
      summary={v => `${v.genre}${v.bpm ? ` · ${v.bpm} BPM` : ""} · ${v.mood || "mood libero"} · ${v.name}`}
      onAfterDone={<AfterDone current="custom" />} />
  );
}

/* ---------------- Mix & Master ---------------- */
function MixSteps({ initialTab, initialView }: { initialTab?: MixService["id"]; initialView?: "services" | "remote" }) {
  const { content } = useStudio();
  const [tab, setTab] = useState<MixService["id"]>(initialTab ?? "mixmaster");
  const [files, setFiles] = useState<string[]>([]);
  const [stems, setStems] = useState(12);
  const svc = content.mix.find(m => m.id === tab) ?? content.mix[0];
  const onFiles = useCallback((n: string[]) => { setFiles(n); if (n.length) setSubShot("mix:upload"); }, []);
  const pick = (id: MixService["id"]) => { setTab(id); setSubShot(`mix:${id}`); };

  const steps: WizardStep[] = [
    {
      id: "svc", label: "Servizio", shot: `mix:${tab}`, title: "Di cosa ha bisogno il tuo brano?",
      render: () => (
        <>
          <fieldset className={s.optionGrid}>
            <legend className={s.srOnly}>Servizio</legend>
            {content.mix.map((m, k) => (
              <label key={m.id} className={`${s.optionCard} ${s.rise}`} style={st(k)} data-checked={tab === m.id || undefined}>
                <input type="radio" name="service" value={m.name} checked={tab === m.id} onChange={() => pick(m.id)} />
                <span className={s.optionTitle}>{m.name}</span>
                <span className={s.optionPrice}>{m.price != null ? <>da <CountUp value={m.price} format={euro} delay={250 + k * 140} /></> : "Su preventivo"}</span>
                <span className={s.muted}>{m.summary}</span>
              </label>
            ))}
          </fieldset>
          <ul key={tab} className={s.checks}>{svc.includes.map((x, k) => <li key={x} className={s.rise} style={st(k + 3)}><Check size={16} aria-hidden="true" />{x}</li>)}</ul>
        </>
      ),
    },
    {
      id: "info", label: "Dettagli", shot: "mix:compare", title: `${svc.name}: cosa ricevi`,
      render: () => (
        <>
          <dl className={s.facts}>
            <div className={s.rise} style={st(0)}><dt>Tempi</dt><dd>{svc.turnaround}</dd></div>
            <div className={s.rise} style={st(1)}><dt>Revisioni</dt><dd>{svc.revisions}</dd></div>
            <div className={s.rise} style={st(2)}><dt>Cosa serve</dt><dd>{svc.needs}</dd></div>
          </dl>
          <div className={`${s.tableWrap} ${s.rise}`} style={st(3)}>
            <table className={s.compare}>
              <caption>Confronto rapido</caption>
              <thead><tr><th scope="col">Caratteristica</th>{content.mix.map(m => <th key={m.id} scope="col" data-on={m.id === tab || undefined}>{m.name}</th>)}</tr></thead>
              <tbody>
                {[
                  [`Fino a ${BASE_TRACKS} tracce`, (m: MixService) => formatEuro(AUDIO_PRICES[m.id].base)],
                  [`Oltre ${BASE_TRACKS} tracce`, (m: MixService) => formatEuro(AUDIO_PRICES[m.id].full)],
                  ["Bilanciamento tracce", (m: MixService) => (m.id === "master" ? <Minus size={16} aria-label="No" /> : <Check size={16} aria-label="Sì" />)],
                  ["Loudness per streaming", (m: MixService) => (m.id === "mix" ? <Minus size={16} aria-label="No" /> : <Check size={16} aria-label="Sì" />)],
                  ["Tempi", (m: MixService) => m.turnaround],
                ].map(([label, cell], r) => (
                  <tr key={label as string} className={s.riseRow} style={st(r + 4)}><th scope="row">{label as string}</th>{content.mix.map(m => <td key={m.id} data-on={m.id === tab || undefined}>{(cell as (m: MixService) => ReactNode)(m)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ),
    },
    {
      id: "song", label: "Brano", shot: "mix:remote", title: "Parlaci del brano",
      rules: { title: { required: true, label: "Titolo brano" }, stems: { required: true, min: 1, max: 200, label: "Numero tracce/stems" }, referenceUrl: { url: true, label: "Link reference" } },
      render: errors => (
        <>
          <div className={s.rise} style={st(0)}><Field label="Titolo brano *" name="title" error={errors.title}><input {...fieldProps("title", errors)} /></Field></div>
          <div className={`${s.stemPick} ${s.rise}`} style={st(1)}>
            <span>Tracce / stems *</span>
            <button type="button" className={s.iconBtn} onClick={() => setStems(v => Math.max(1, v - 1))} aria-label="Una traccia in meno"><Minus size={16} /></button>
            <input name="stems" type="number" min={1} max={200} inputMode="numeric" value={stems} onChange={e => setStems(Number(e.target.value) || 1)} aria-label="Numero tracce" />
            <button type="button" className={s.iconBtn} onClick={() => setStems(v => Math.min(200, v + 1))} aria-label="Una traccia in più"><Plus size={16} /></button>
            <span className={s.stemBars} aria-hidden="true">{Array.from({ length: Math.min(stems, 24) }, (_, k) => <i key={k} style={st(k)} />)}</span>
          </div>
          {errors.stems && <p className={s.fieldError} role="alert">{errors.stems}</p>}
          <p className={`${s.mixQuote} ${s.rise}`} style={st(2)} aria-live="polite">{svc.name}, {stems > BASE_TRACKS ? `multitraccia (oltre ${BASE_TRACKS} tracce)` : `fino a ${BASE_TRACKS} tracce`}, per brano: <strong>{formatEuro(audioPrice(tab, stems))}</strong>{tab !== "master" && stems <= BASE_TRACKS ? <small> Es. beat in un solo file più le voci.</small> : null}</p>
          <div className={s.grid2}>
            <div className={s.rise} style={st(2)}><Field label="Deadline" name="deadline" error={errors.deadline}><input {...fieldProps("deadline", errors)} type="date" /></Field></div>
            <div className={s.rise} style={st(3)}><Field label="Link a una reference" name="referenceUrl" error={errors.referenceUrl}><input {...fieldProps("referenceUrl", errors)} type="url" placeholder="https://" /></Field></div>
          </div>
        </>
      ),
    },
    {
      id: "files", label: "File", shot: "mix:upload", title: "Carica le tracce",
      lead: "Indica i file che ci manderai: li carichi dopo, con il link che ricevi via email.",
      render: errors => (
        <>
          <div className={s.rise} style={st(0)}><UploadZone onChange={onFiles} /></div>
          <div className={s.rise} style={st(1)}><Field label="Note per il mix" name="notes" error={errors.notes}><textarea {...fieldProps("notes", errors)} rows={3} /></Field></div>
        </>
      ),
    },
    {
      id: "you", label: "Contatti", shot: "mix:contact", title: "Come ti contattiamo?",
      rules: contactRules,
      render: errors => <ContactFields errors={errors} />,
    },
  ];
  return (
    <Wizard kind="remote-project" steps={steps} start={initialView === "remote" ? 2 : 0} submitLabel="Invia la richiesta" doneShot="mix:done"
      extra={() => ({ serviceId: tab, files: files.join(", "), total: formatEuro(audioPrice(tab, stems)) })}
      summary={v => `${v.service} · “${v.title}” · ${v.stems} tracce · ${formatEuro(audioPrice(tab, Number(v.stems)))}`}
      onAfterDone={<AfterDone current="mix" />} />
  );
}

/* ---------------- The screen ---------------- */
const META: Record<ServiceKind, { kicker: string; title: string; word: string; notice: string }> = {
  recording: { kicker: "Registrazione voce", title: "Prenota una sessione", word: "VOCE", notice: "Scegli durata e orario. Il metodo di pagamento si seleziona nel riepilogo." },
  custom: { kicker: "Beat su misura", title: "Un beat sul tuo brano", word: "BEAT", notice: "Prima versione entro 10 giorni lavorativi dall’avvio, una revisione inclusa. Diritti e licenza nell’accordo scritto." },
  mix: { kicker: "Banco mixer", title: "Mix, Master, Mix & Master", word: "MIX", notice: "Dopo la richiesta ricevi via email il riepilogo, il link per caricare le tracce e il pagamento." },
};

/**
 * A service opens as a new full screen over the studio: the camera flies to the object,
 * the title builds itself, then the steps play one scene at a time.
 */
export function ServiceScreen() {
  const { panel, lastPanel, close } = useStudio();
  const live = panel && (panel.type === "recording" || panel.type === "custom" || panel.type === "mix") ? panel : null;
  const last = lastPanel && (lastPanel.type === "recording" || lastPanel.type === "custom" || lastPanel.type === "mix") ? lastPanel : null;
  const [shown, setShown] = useState(live);
  const [prev, setPrev] = useState(live);
  const [leaving, setLeaving] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);

  // keep the screen on stage during its exit animation
  if (live !== prev) {
    setPrev(live);
    if (live) { setShown(live); setLeaving(false); }
    else if (shown) setLeaving(true);
  }
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => { setShown(null); setLeaving(false); }, 420);
    return () => window.clearTimeout(t);
  }, [leaving]);

  useEffect(() => {
    if (!live) return;
    document.documentElement.dataset.service = live.type;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("dialog[open]")) void goStudio(SERVICE_STOP[live.type]); };
    window.addEventListener("keydown", onKey);
    return () => { delete document.documentElement.dataset.service; window.removeEventListener("keydown", onKey); };
  }, [live]);

  useEffect(() => { if (live) headRef.current?.focus({ preventScroll: true }); }, [live?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = shown ?? last;
  if (!shown || !p) return null;
  const m = META[p.type as ServiceKind];
  return (
    <div className={s.svcScreen} data-kind={p.type} data-leaving={leaving || undefined} role="region" aria-labelledby="svc-screen-title">
      <div className={s.svcScreenBg} aria-hidden="true"><span key={p.type} className={s.svcScreenWord}>{m.word}</span></div>
      <header key={`h-${p.type}`} className={s.svcHead}>
        <button type="button" className={s.btnText} data-svc-back onClick={() => { close(); void goStudio(SERVICE_STOP[p.type as ServiceKind]); }}><ArrowLeft size={16} /> Studio</button>
        <p className={s.reelKicker}><span>{m.kicker}</span></p>
        <h2 id="svc-screen-title" ref={headRef} tabIndex={-1} className={s.svcScreenTitle}><KineticWords text={m.title} /></h2>
        <SwitchChips current={p.type as ServiceKind} />
      </header>
      <div className={s.svcPanel} data-sheet-body data-own-scroll>
        <DemoNotice>{m.notice}</DemoNotice>
        {p.type === "recording" && <RecordingSteps key="rec" />}
        {p.type === "custom" && <CustomSteps key="custom" active={Boolean(live)} />}
        {p.type === "mix" && <MixSteps key={`mix-${p.tab ?? ""}-${p.view ?? ""}`} initialTab={p.tab} initialView={p.view} />}
      </div>
    </div>
  );
}

