"use client";

import { useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { createBooking } from "@/app/services/actions";

export function RecordingRequestForm() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  async function chooseDate(nextDate: string) {
    setDate(nextDate);
    setLoading(true); setTime(""); setAvailabilityError("");
    try {
      const response = await fetch(`/api/availability?date=${encodeURIComponent(nextDate)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Availability could not be loaded.");
      setSlots(body.slots ?? []);
    } catch (error) {
      setSlots([]); setAvailabilityError(error instanceof Error ? error.message : "Availability could not be loaded.");
    } finally { setLoading(false); }
  }

  return <form action={createBooking} className="premium-form form-grid booking-form">
    <div className="booking-step full"><span>01</span><div><strong>Choose a day</strong><small>Available times update automatically.</small></div></div>
    <label className="full date-field"><CalendarDays size={18}/><span>Date</span><input name="date" type="date" required value={date} onChange={(event) => void chooseDate(event.target.value)}/></label>
    <fieldset className="full slot-fieldset"><legend><Clock3 size={17}/> Available start time</legend>
      {!date && <p className="muted">Choose a date to see available slots.</p>}
      {loading && <p className="muted">Checking the studio calendar…</p>}
      {availabilityError && <p className="notice error">{availabilityError}</p>}
      {!loading && date && !availabilityError && !slots.length && <p className="notice">No slots are available on this day.</p>}
      <div className="slot-grid">{slots.map((slot) => <label key={slot} className={time === slot ? "slot-option selected" : "slot-option"}><input type="radio" name="time" value={slot} required checked={time === slot} onChange={() => setTime(slot)}/><span>{slot}</span></label>)}</div>
    </fieldset>
    <div className="booking-step full"><span>02</span><div><strong>Session details</strong><small>Tell us how long you need the room.</small></div></div>
    <label>Duration<select name="duration" defaultValue="1"><option value="1">1 hour</option><option value="2">2 hours</option><option value="3">3 hours</option><option value="4">4 hours</option></select></label>
    <label>Reference link<input name="referenceUrl" type="url" placeholder="https://"/></label>
    <div className="booking-step full"><span>03</span><div><strong>Your details</strong><small>The request stays pending until GENKS approves it.</small></div></div>
    <label>Name<input name="name" required autoComplete="name"/></label><label>Artist name <small>optional</small><input name="artistName"/></label>
    <label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Phone / WhatsApp<input name="phone" type="tel" required autoComplete="tel"/></label>
    <label className="full">Notes<textarea name="notes" rows={5} placeholder="Session goals, number of artists, useful context…"/></label>
    <button className="button button-primary full" disabled={!date || !time}>SEND REQUEST</button>
  </form>;
}
