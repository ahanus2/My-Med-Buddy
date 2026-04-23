import { FormEvent, useMemo, useState } from "react";
import { formatTimeLabel, type AppointmentNote } from "@/lib/medical-data";

function getVisitTypePalette(visitType: string) {
  const normalized = visitType.trim().toLowerCase();

  if (normalized.includes("tele")) {
    return "bg-sky-600";
  }

  if (normalized.includes("office")) {
    return "bg-emerald-600";
  }

  if (normalized.includes("lab")) {
    return "bg-violet-600";
  }

  if (normalized.includes("imaging") || normalized.includes("scan")) {
    return "bg-amber-600";
  }

  if (normalized.includes("urgent")) {
    return "bg-pink-700";
  }

  return "bg-accent";
}

function CalendarAppointmentChip({ appointment }: { appointment: AppointmentNote }) {
  return (
    <div className={`rounded-[0.85rem] px-2 py-2 text-[11px] font-semibold text-white ${getVisitTypePalette(appointment.visitType)}`}>
      <p className="truncate">{appointment.provider}</p>
      <p className="truncate text-[10px] font-medium text-white/85">
        {appointment.appointmentTime ? formatTimeLabel(appointment.appointmentTime) : "Time not added"}
        {appointment.visitType ? ` | ${appointment.visitType}` : ""}
      </p>
      {appointment.location ? (
        <p className="truncate text-[10px] font-medium text-white/75">{appointment.location}</p>
      ) : null}
    </div>
  );
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function sameDay(date: Date, isoDate: string) {
  const target = new Date(isoDate);
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
}

export function AppointmentCalendar({
  appointments,
  onAddAppointment
}: {
  appointments: AppointmentNote[];
  onAddAppointment: (appointment: {
    appointmentDate: string;
    appointmentTime: string;
    provider: string;
    specialty: string;
    visitType: string;
    location: string;
    durationMinutes: string;
    notes: string;
  }) => void;
}) {
  const focusDate = useMemo(
    () =>
      appointments.length
        ? new Date(
            [...appointments]
              .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate))
              .slice(-1)[0]!.appointmentDate
          )
        : new Date(),
    [appointments]
  );
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedTime, setSelectedTime] = useState("");
  const [provider, setProvider] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [visitType, setVisitType] = useState("");
  const [location, setLocation] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");

  const monthStart = startOfMonth(focusDate);
  const monthEnd = endOfMonth(focusDate);
  const leadingDays = (monthStart.getDay() + 6) % 7;
  const daysInMonth = monthEnd.getDate();
  const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const days = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - leadingDays + 1;
    return new Date(focusDate.getFullYear(), focusDate.getMonth(), dayNumber);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDate || !provider.trim()) {
      return;
    }

    onAddAppointment({
      appointmentDate: selectedDate,
      appointmentTime: selectedTime,
      provider: provider.trim(),
      specialty: specialty.trim(),
      visitType: visitType.trim(),
      location: location.trim(),
      durationMinutes: durationMinutes.trim(),
      notes: notes.trim()
    });
    setSelectedTime("");
    setProvider("");
    setSpecialty("");
    setVisitType("");
    setLocation("");
    setDurationMinutes("");
    setNotes("");
  }

  return (
    <div className="rounded-[1.5rem] bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate">Appointment calendar</p>
          <h3 className="mt-2 text-xl font-semibold">
            {focusDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h3>
        </div>
        <div className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
          {appointments.length} scheduled
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2">
        {days.map((day) => {
          const inMonth = day.getMonth() === focusDate.getMonth();
          const items = appointments.filter((appointment) => sameDay(day, appointment.appointmentDate));
          return (
            <div
              key={day.toISOString()}
              onClick={() => setSelectedDate(day.toISOString().slice(0, 10))}
              className={`min-h-24 rounded-[1rem] border p-2 text-left ${
                inMonth ? "border-ink/10 bg-canvas cursor-pointer" : "border-transparent bg-white/30 text-slate/50"
              }`}
            >
              <p className="text-sm font-semibold">{day.getDate()}</p>
              <div className="mt-2 space-y-1">
                {items.slice(0, 2).map((appointment) => (
                  <CalendarAppointmentChip key={appointment.id} appointment={appointment} />
                ))}
                {items.length > 2 ? <div className="text-[11px] text-slate">+{items.length - 2} more</div> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-[1rem] bg-canvas p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate">Visit type colors</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-white">Office visit</span>
          <span className="rounded-full bg-sky-600 px-3 py-1 text-white">Telehealth</span>
          <span className="rounded-full bg-violet-600 px-3 py-1 text-white">Lab visit</span>
          <span className="rounded-full bg-amber-600 px-3 py-1 text-white">Imaging</span>
          <span className="rounded-full bg-pink-700 px-3 py-1 text-white">Urgent care</span>
          <span className="rounded-full bg-accent px-3 py-1 text-white">Other</span>
        </div>
      </div>

      <form className="mt-5 grid gap-3 rounded-[1rem] bg-canvas p-4" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm uppercase tracking-[0.14em] text-slate">Add from calendar</p>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">{selectedDate}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            type="date"
            className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
          />
          <input
            value={selectedTime ?? ""}
            onChange={(event) => setSelectedTime(event.target.value)}
            type="text"
            placeholder="Time, like 9:30 AM"
            className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
          />
          <input
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            placeholder="Provider name"
            className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
          />
          <input
            value={specialty}
            onChange={(event) => setSpecialty(event.target.value)}
            placeholder="Specialty"
            className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
          />
          <input
            value={visitType}
            onChange={(event) => setVisitType(event.target.value)}
            placeholder="Visit type, like Office or Telehealth"
            className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
          />
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Location"
            className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
          />
          <input
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
            placeholder="Duration in minutes"
            inputMode="numeric"
            className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
          />
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Quick note"
            className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent sm:col-span-2"
          />
        </div>
        <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
          Add appointment to calendar
        </button>
      </form>
    </div>
  );
}
