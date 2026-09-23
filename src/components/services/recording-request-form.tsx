"use client";

import { useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { createBooking } from "@/app/services/actions";

export function RecordingRequestForm() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("1");
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  async function loadAvailability(nextDate: string, nextDuration = duration) {
    setDate(nextDate);
    setLoading(true); setTime(""); setAvailabilityError("");
    try {
      const params = new URLSearchParams({ date: nextDate, duration: nextDuration });
      const response = await fetch(`/api/availability?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Availability could not be loaded.");
      setSlots(body.slots ?? []);
    } catch (error) {
      setSlots([]); setAvailabilityError(error instanceof Error ? error.message : "Availability could not be loaded.");
    } finally { setLoading(false); }
  }

  return <form action={createBooking} className="premium-form form-grid booking-form">
    <div className="booking-step full"><span>01</span><div><strong>Choose duration and day</strong><small>Only times that fit the complete session are shown.</small></div></div>
    <label>Duration<select name="duration" value={duration} onChange={(event) => { const next = event.target.value; setDuration(next); if (date) void loadAvailability(date, next); }}><option value="1">1 hour</option><option value="2">2 hours</option><option value="3">3 hours</option><option value="4">4 hours</option></select></label>
    <label className="date-field"><CalendarDays size={18}/><span>Date</span><input name="date" type="date" required value={date} min={new Date().toISOString().slice(0, 10)} onChange={(event) => void loadAvailability(event.target.value)}/></label>
    <fieldset className="full slot-fieldset"><legend><Clock3 size={17}/> Available start time</legend>
      {!date && <p className="muted">Choose a date to see available slots.</p>}
      {loading && <p className="muted">Checking the studio calendar…</p>}
      {availabilityError && <p className="notice error">{availabilityError}</p>}
      {!loading && date && !availabilityError && !slots.length && <p className="notice">No slots are available on this day.</p>}
      <div className="slot-grid">{slots.map((slot) => <label key={slot} className={time === slot ? "slot-option selected" : "slot-option"}><input type="radio" name="time" value={slot} required checked={time === slot} onChange={() => setTime(slot)}/><span>{slot}</span></label>)}</div>
    </fieldset>
    <div className="booking-step full"><span>02</span><div><strong>Session details</strong><small>Add an optional reference for the session.</small></div></div>
    <label className="full">Reference link<input name="referenceUrl" type="url" placeholder="https://"/></label>
    <div className="booking-step full"><span>03</span><div><strong>Your details</strong><small>The request stays pending until GENKS approves it.</small></div></div>
    <label>Name<input name="name" required autoComplete="name"/></label><label>Artist name <small>optional</small><input name="artistName"/></label>
    <label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Phone / WhatsApp<input name="phone" type="tel" required autoComplete="tel"/></label>
    <label className="full">Notes<textarea name="notes" rows={5} placeholder="Session goals, number of artists, useful context…"/></label>
    <button className="button button-primary full" disabled={!date || !time}>SEND REQUEST</button>
  </form>;
}
