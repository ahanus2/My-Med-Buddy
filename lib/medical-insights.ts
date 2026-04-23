import type {
  AppointmentNote,
  DietEntry,
  DoctorMessage,
  ExerciseEntry,
  FamilyHistoryEntry,
  CareChange,
  GlucoseEntry,
  LabRecord,
  MedicationEntry,
  MoodEntry,
  PortalConnection,
  SleepEntry,
  SummaryCard,
  SymptomEntry,
  TrendSeries,
  UploadedRecord,
  WaterIntakeEntry,
  WeightEntry
} from "@/lib/medical-data";
import { createId, formatDateLabel } from "@/lib/medical-data";

function formatReferenceRange(low: number | null, high: number | null, unit: string) {
  if (low !== null && high !== null) {
    return `${low} - ${high} ${unit}`.trim();
  }
  if (low !== null) {
    return `Above ${low} ${unit}`.trim();
  }
  if (high !== null) {
    return `Below ${high} ${unit}`.trim();
  }
  return "Not provided";
}

function compareLatest(values: LabRecord[]) {
  if (values.length < 2) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1]!.value - sorted[sorted.length - 2]!.value;
}

function toSentenceCaseChange(diff: number, unit: string) {
  if (diff === 0) {
    return "No change from previous result";
  }
  const direction = diff > 0 ? "up" : "down";
  return `${Math.abs(diff).toFixed(1)} ${unit} ${direction} from previous result`.trim();
}

export function buildSummaryCards(labs: LabRecord[]): SummaryCard[] {
  if (!labs.length) {
    return [{
      title: "Ready for your first upload",
      label: "No lab data yet",
      body: "Import a CSV file or add a lab result manually. Once data is available, the app will summarize meaningful changes in plain language."
    }];
  }

  const grouped = new Map<string, LabRecord[]>();
  labs.forEach((lab) => {
    const bucket = grouped.get(lab.testName) ?? [];
    bucket.push(lab);
    grouped.set(lab.testName, bucket);
  });

  const cards: SummaryCard[] = [];
  grouped.forEach((records, testName) => {
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1]!;
    const first = sorted[0]!;
    const diffFromStart = latest.value - first.value;
    const outsideRange =
      (latest.low !== null && latest.value < latest.low) ||
      (latest.high !== null && latest.value > latest.high);

    let label = "Stable";
    let body = `${testName} most recently measured ${latest.value} ${latest.unit} on ${formatDateLabel(latest.date)}.`;

    if (outsideRange) {
      label = "Needs review";
      body += " That result is outside the reference range stored with the record.";
    } else if (Math.abs(diffFromStart) > 0.01) {
      label = diffFromStart > 0 ? "Trending up" : "Improving";
      body += ` Compared with the oldest stored result, it is ${diffFromStart > 0 ? "higher" : "lower"} by ${Math.abs(diffFromStart).toFixed(1)} ${latest.unit}.`;
    } else {
      body += " So far, the stored values look steady over time.";
    }

    if (sorted.length > 1) {
      body += ` The previous result was ${sorted[sorted.length - 2]!.value} ${latest.unit}.`;
    }

    cards.push({ title: testName, label, body });
  });

  return cards.sort((a, b) => a.title.localeCompare(b.title)).slice(0, 4);
}

export function buildAppointmentSummary(appointments: AppointmentNote[]) {
  if (!appointments) {
    return "No appointments have been recorded yet. Add a visit note to keep track of what was discussed and what needs follow-up.";
  }
  if (!appointments.length) {
    return "No appointments have been recorded yet. Add a visit note to keep track of what was discussed and what needs follow-up.";
  }

  const latest = [...appointments].sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate))[0]!;
  return `Most recent visit: ${latest.specialty} with ${latest.provider} on ${formatDateLabel(
    latest.appointmentDate
  )}. Main notes: ${latest.notes} Next steps: ${latest.followUp || "No follow-up plan recorded yet."}`;
}

export function buildCareChangeSummary(changes: CareChange[]) {
  if (!changes) {
    return "No after-visit changes have been saved yet. Use this section to track medication updates, routines, or care plan adjustments after an appointment.";
  }
  if (!changes.length) {
    return "No after-visit changes have been saved yet. Use this section to track medication updates, routines, or care plan adjustments after an appointment.";
  }

  const latest = [...changes].sort((a, b) => b.date.localeCompare(a.date))[0]!;
  return `Latest change: ${latest.category} updated on ${formatDateLabel(latest.date)}. ${latest.change} ${
    latest.effect ? `Current effect: ${latest.effect}` : ""
  }`.trim();
}

export function buildSymptomSummary(symptoms: SymptomEntry[]) {
  if (!symptoms) {
    return "No symptoms are listed right now. Add symptoms before a visit so the doctor conversation can start with what is bothering you most.";
  }
  if (!symptoms.length) {
    return "No symptoms are listed right now. Add symptoms before a visit so the doctor conversation can start with what is bothering you most.";
  }

  const highestPriority = [...symptoms].sort((a, b) => b.startedOn.localeCompare(a.startedOn))[0]!;
  return `Current symptom focus: ${highestPriority.symptom} (${highestPriority.severity}, ${highestPriority.frequency}). Started ${
    highestPriority.startedOn ? formatDateLabel(highestPriority.startedOn) : "on an unknown date"
  }. ${highestPriority.notes || "No extra symptom notes recorded yet."}`;
}

export function buildFamilyHistorySummary(entries: FamilyHistoryEntry[]) {
  if (!entries?.length) {
    return "No family history has been saved yet. Add relatives and conditions to help patients keep track of inherited risk factors.";
  }

  const latest = entries[0]!;
  return `Family history highlight: ${latest.relation} with ${latest.condition}${
    latest.ageOfOnset ? ` starting around age ${latest.ageOfOnset}` : ""
  }. ${latest.notes || "No extra family history notes recorded yet."}`.trim();
}

export function buildDietSummary(entries: DietEntry[]) {
  if (!entries?.length) {
    return "No diet entries have been logged yet. Add meals or patterns to see what has been working between visits.";
  }

  const latest = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0]!;
  return `Latest food log: ${latest.mealType} on ${formatDateLabel(latest.date)} was ${latest.summary}. ${
    latest.notes || "No extra notes recorded."
  }`;
}

export function buildMedicationSummary(entries: MedicationEntry[]) {
  if (!entries?.length) {
    return "No medications have been logged yet. Add active, paused, or stopped medications so the care plan stays easier to review.";
  }

  const activeCount = entries.filter((entry) => entry.status === "active").length;
  const pausedCount = entries.filter((entry) => entry.status === "paused").length;
  const stoppedCount = entries.filter((entry) => entry.status === "stopped").length;
  const reminderCount = entries.filter((entry) => entry.reminderEnabled).length;
  const refillCount = entries.filter((entry) => entry.refillDate).length;
  const takenTodayCount = entries.filter((entry) => entry.lastTakenOn === new Date().toISOString().slice(0, 10)).length;
  const sideEffectCount = entries.filter((entry) => entry.sideEffects.trim()).length;
  const hardToTolerateCount = entries.filter((entry) => entry.responseStatus === "hard-to-tolerate").length;
  const latest = [...entries].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]!;
  return `Medication tracker: ${activeCount} active, ${pausedCount} paused, and ${stoppedCount} stopped. ${reminderCount} reminder${
    reminderCount === 1 ? "" : "s"
  } set, ${refillCount} refill date${refillCount === 1 ? "" : "s"} tracked, ${takenTodayCount} marked taken today, ${sideEffectCount} side effect note${
    sideEffectCount === 1 ? "" : "s"
  }, and ${hardToTolerateCount} medication${hardToTolerateCount === 1 ? "" : "s"} marked hard to tolerate. Latest update: ${latest.name} ${latest.dose} (${latest.status}) for ${
    latest.purpose || "no purpose recorded"
  }.`;
}

export function buildDoctorMessageSummary(messages: DoctorMessage[]) {
  if (!messages?.length) {
    return "No doctor messages are saved yet. Draft questions here so they are ready before sending through a real portal later.";
  }

  const inboxCount = messages.filter((message) => message.mailbox === "inbox").length;
  const sentCount = messages.filter((message) => message.mailbox === "sent").length;
  const draftCount = messages.filter((message) => message.mailbox === "drafts").length;
  const unreadCount = messages.filter((message) => message.mailbox === "inbox" && !message.isRead).length;
  const threadCount = new Set(messages.map((message) => message.threadId)).size;
  const latest = [...messages].sort((a, b) => b.date.localeCompare(a.date))[0]!;
  return `Messages center: ${threadCount} conversation threads, ${inboxCount} in inbox, ${sentCount} sent, ${draftCount} drafts, and ${unreadCount} unread. Latest item: "${
    latest.subject
  }" from ${formatDateLabel(latest.date)}.`;
}

export function buildTrendSeries(labs: LabRecord[]): TrendSeries[] {
  const grouped = new Map<string, LabRecord[]>();
  labs.forEach((lab) => {
    const bucket = grouped.get(lab.testName) ?? [];
    bucket.push(lab);
    grouped.set(lab.testName, bucket);
  });

  return Array.from(grouped.entries()).map(([name, values]) => {
    const sorted = [...values].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1]!;
    return {
      name,
      unit: latest.unit,
      referenceRange: formatReferenceRange(latest.low, latest.high, latest.unit),
      changeLabel: toSentenceCaseChange(compareLatest(sorted), latest.unit),
      latestValue: latest.value,
      points: sorted.map((point) => ({
        date: new Date(point.date).toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        value: point.value
      }))
    };
  }).sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
}

export function buildWeightTrendSeries(entries: WeightEntry[]) {
  const safeEntries = [...(entries ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!safeEntries.length) {
    return [];
  }

  const latest = safeEntries[safeEntries.length - 1]!;
  return [
    {
      name: "Weight",
      unit: latest.unit,
      referenceRange: "Personal tracking",
      changeLabel:
        safeEntries.length > 1
          ? `${Math.abs(latest.weight - safeEntries[safeEntries.length - 2]!.weight).toFixed(1)} ${latest.unit} ${
              latest.weight >= safeEntries[safeEntries.length - 2]!.weight ? "up" : "down"
            } from previous entry`
          : "First saved entry",
      latestValue: latest.weight,
      points: safeEntries.map((entry) => ({
        date: new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: entry.weight
      }))
    }
  ];
}

export function buildWaterIntakeTrendSeries(entries: WaterIntakeEntry[]) {
  const safeEntries = [...(entries ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!safeEntries.length) {
    return [];
  }

  const latest = safeEntries[safeEntries.length - 1]!;
  return [
    {
      name: "Water intake",
      unit: latest.unit,
      referenceRange: "Daily hydration",
      changeLabel:
        safeEntries.length > 1
          ? `${Math.abs(latest.amount - safeEntries[safeEntries.length - 2]!.amount).toFixed(1)} ${latest.unit} ${
              latest.amount >= safeEntries[safeEntries.length - 2]!.amount ? "up" : "down"
            } from previous entry`
          : "First saved entry",
      latestValue: latest.amount,
      points: safeEntries.map((entry) => ({
        date: new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: entry.amount
      }))
    }
  ];
}

export function buildSleepTrendSeries(entries: SleepEntry[]) {
  const safeEntries = [...(entries ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!safeEntries.length) {
    return [];
  }

  const latest = safeEntries[safeEntries.length - 1]!;
  return [
    {
      name: "Sleep",
      unit: "hours",
      referenceRange: "Personal tracking",
      changeLabel:
        safeEntries.length > 1
          ? `${Math.abs(latest.hoursSlept - safeEntries[safeEntries.length - 2]!.hoursSlept).toFixed(1)} hours ${
              latest.hoursSlept >= safeEntries[safeEntries.length - 2]!.hoursSlept ? "up" : "down"
            } from previous entry`
          : "First saved entry",
      latestValue: latest.hoursSlept,
      points: safeEntries.map((entry) => ({
        date: new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: entry.hoursSlept
      }))
    }
  ];
}

export function buildExerciseTrendSeries(entries: ExerciseEntry[]) {
  const safeEntries = [...(entries ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!safeEntries.length) {
    return [];
  }

  const latest = safeEntries[safeEntries.length - 1]!;
  return [
    {
      name: "Exercise",
      unit: "min",
      referenceRange: "Personal tracking",
      changeLabel:
        safeEntries.length > 1
          ? `${Math.abs(latest.durationMinutes - safeEntries[safeEntries.length - 2]!.durationMinutes).toFixed(0)} min ${
              latest.durationMinutes >= safeEntries[safeEntries.length - 2]!.durationMinutes ? "up" : "down"
            } from previous entry`
          : "First saved entry",
      latestValue: latest.durationMinutes,
      points: safeEntries.map((entry) => ({
        date: new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: entry.durationMinutes
      }))
    }
  ];
}

function moodScore(mood: MoodEntry["mood"]) {
  switch (mood) {
    case "Low":
      return 1;
    case "Okay":
      return 2;
    case "Good":
      return 3;
    case "Great":
      return 4;
    default:
      return 2;
  }
}

export function buildMoodTrendSeries(entries: MoodEntry[]) {
  const safeEntries = [...(entries ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!safeEntries.length) {
    return [];
  }

  const latest = safeEntries[safeEntries.length - 1]!;
  const latestValue = moodScore(latest.mood);
  return [
    {
      name: "Mood",
      unit: "score",
      referenceRange: "Personal tracking",
      changeLabel:
        safeEntries.length > 1
          ? `${Math.abs(latestValue - moodScore(safeEntries[safeEntries.length - 2]!.mood)).toFixed(0)} point ${
              latestValue >= moodScore(safeEntries[safeEntries.length - 2]!.mood) ? "up" : "down"
            } from previous entry`
          : "First saved entry",
      latestValue,
      points: safeEntries.map((entry) => ({
        date: new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: moodScore(entry.mood)
      }))
    }
  ];
}

export function buildGlucoseTrendSeries(entries: GlucoseEntry[]) {
  const safeEntries = [...(entries ?? [])].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
  );
  if (!safeEntries.length) {
    return [];
  }

  const grouped = new Map<string, GlucoseEntry[]>();
  safeEntries.forEach((entry) => {
    const key = entry.context || "Other";
    const bucket = grouped.get(key) ?? [];
    bucket.push(entry);
    grouped.set(key, bucket);
  });

  return Array.from(grouped.entries()).map(([name, values]) => {
    const latest = values[values.length - 1]!;
    const previous = values.length > 1 ? values[values.length - 2]! : null;
    return {
      name: `Glucose (${name})`,
      unit: latest.unit,
      referenceRange: "Personal tracking",
      changeLabel: previous
        ? `${Math.abs(latest.value - previous.value).toFixed(0)} ${latest.unit} ${
            latest.value > previous.value ? "up" : latest.value < previous.value ? "down" : "unchanged"
          } from previous entry`
        : "First saved entry",
      latestValue: latest.value,
      points: values.map((entry) => ({
        date: new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: entry.value
      }))
    };
  });
}

function symptomSeverityScore(severity: string) {
  const normalized = severity.trim().toLowerCase();

  if (normalized.includes("severe")) {
    return 4;
  }
  if (normalized.includes("moderate")) {
    return 3;
  }
  if (normalized.includes("mild")) {
    return 2;
  }
  if (normalized.includes("low") || normalized.includes("slight")) {
    return 1;
  }

  return 2;
}

export function buildSymptomTrendSeries(entries: SymptomEntry[]) {
  const grouped = new Map<string, SymptomEntry[]>();
  entries.forEach((entry) => {
    const key = entry.symptom.trim() || "Symptom";
    const bucket = grouped.get(key) ?? [];
    bucket.push(entry);
    grouped.set(key, bucket);
  });

  return Array.from(grouped.entries())
    .map(([name, values]) => {
      const sorted = values
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => {
          const dateCompare = (a.entry.startedOn || "").localeCompare(b.entry.startedOn || "");
          if (dateCompare !== 0) {
            return dateCompare;
          }

          // New entries are prepended to state, so for matching dates we reverse
          // the original index to keep the series oldest -> newest.
          return b.index - a.index;
        })
        .map(({ entry }) => entry);
      const latest = sorted[sorted.length - 1]!;
      const latestValue = symptomSeverityScore(latest.severity);
      const previousValue = sorted.length > 1 ? symptomSeverityScore(sorted[sorted.length - 2]!.severity) : latestValue;

      return {
        name,
        unit: "severity",
        referenceRange: "1 low - 4 severe",
        changeLabel:
          sorted.length > 1
            ? latestValue === previousValue
              ? "No change from previous entry"
              : `${Math.abs(latestValue - previousValue).toFixed(0)} point ${
                  latestValue > previousValue ? "up" : "down"
                } from previous entry`
            : "First saved entry",
        latestValue,
        points: sorted.map((entry) => ({
          date: new Date(entry.startedOn || "2000-01-01").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
          }),
          value: symptomSeverityScore(entry.severity)
        }))
      };
    })
    .sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
}

export function buildTimeline(
  records: UploadedRecord[],
  portals: PortalConnection[],
  labs: LabRecord[],
  appointments: AppointmentNote[],
  changes: CareChange[],
  symptoms: SymptomEntry[],
  familyHistory: FamilyHistoryEntry[],
  medications: MedicationEntry[],
  weightLogs: WeightEntry[],
  sleepLogs: SleepEntry[],
  exerciseLogs: ExerciseEntry[],
  moodLogs: MoodEntry[],
  glucoseLogs: GlucoseEntry[],
  waterIntakeLogs: WaterIntakeEntry[],
  dietLogs: DietEntry[],
  doctorMessages: DoctorMessage[]
) {
  const safeRecords = records ?? [];
  const safePortals = portals ?? [];
  const safeLabs = labs ?? [];
  const safeAppointments = appointments ?? [];
  const safeChanges = changes ?? [];
  const safeSymptoms = symptoms ?? [];
  const safeFamilyHistory = familyHistory ?? [];
  const safeMedications = medications ?? [];
  const safeWeightLogs = weightLogs ?? [];
  const safeSleepLogs = sleepLogs ?? [];
  const safeExerciseLogs = exerciseLogs ?? [];
  const safeMoodLogs = moodLogs ?? [];
  const safeGlucoseLogs = glucoseLogs ?? [];
  const safeWaterIntakeLogs = waterIntakeLogs ?? [];
  const safeDietLogs = dietLogs ?? [];
  const safeDoctorMessages = doctorMessages ?? [];
  const labEvents = safeLabs.map((lab) => ({
    id: lab.id,
    date: lab.date,
    title: `${lab.testName} result added`,
    description: `${lab.value} ${lab.unit} from ${lab.source}`
  }));
  const recordEvents = safeRecords.map((record) => ({
    id: record.id,
    date: record.uploadedAt,
    title: `${record.category} uploaded`,
    description: `${record.name} saved to the record library`
  }));
  const portalEvents = safePortals.map((portal) => ({
    id: portal.id,
    date: portal.lastSync,
    title: `${portal.name} portal ${portal.status}`,
    description: portal.status === "connected"
      ? `Data last synced on ${formatDateLabel(portal.lastSync)}`
      : "Portal link is saved but still waiting for successful authentication"
  }));
  const appointmentEvents = safeAppointments.map((appointment) => ({
    id: appointment.id,
    date: appointment.appointmentDate,
    title: `Appointment with ${appointment.provider}`,
    description: `${appointment.specialty}: ${appointment.followUp || appointment.notes}`
  }));
  const changeEvents = safeChanges.map((change) => ({
    id: change.id,
    date: change.date,
    title: `${change.category} change logged`,
    description: change.change
  }));
  const symptomEvents = safeSymptoms.map((symptom) => ({
    id: symptom.id,
    date: symptom.startedOn || "0000-00-00",
    title: `Symptom tracked: ${symptom.symptom}`,
    description: `${symptom.severity} and ${symptom.frequency}`
  }));
  const familyEvents = safeFamilyHistory.map((entry) => ({
    id: entry.id,
    date: "0000-00-00",
    title: `Family history added for ${entry.relation}`,
    description: `${entry.condition}${entry.ageOfOnset ? ` around age ${entry.ageOfOnset}` : ""}`
  }));
    const weightEvents = safeWeightLogs.map((entry) => ({
      id: entry.id,
      date: entry.date,
      title: "Weight entry logged",
      description: `${entry.weight} ${entry.unit}`
    }));
    const sleepEvents = safeSleepLogs.map((entry) => ({
      id: entry.id,
      date: entry.date,
      title: "Sleep entry logged",
      description: `${entry.hoursSlept} hours, ${entry.quality.toLowerCase()} sleep`
    }));
    const exerciseEvents = safeExerciseLogs.map((entry) => ({
      id: entry.id,
      date: entry.date,
      title: "Exercise logged",
      description: `${entry.activityType} for ${entry.durationMinutes} minutes (${entry.intensity.toLowerCase()})`
    }));
    const moodEvents = safeMoodLogs.map((entry) => ({
      id: entry.id,
      date: entry.date,
      title: "Mood check-in saved",
      description: `${entry.mood} mood with ${entry.stressLevel.toLowerCase()} stress`
    }));
    const glucoseEvents = safeGlucoseLogs.map((entry) => ({
      id: entry.id,
      date: entry.date,
      title: "Glucose reading logged",
      description: `${entry.value} ${entry.unit}${entry.context ? ` (${entry.context.toLowerCase()})` : ""}`
    }));
    const waterEvents = safeWaterIntakeLogs.map((entry) => ({
    id: entry.id,
    date: entry.date,
    title: "Water intake logged",
    description: `${entry.amount} ${entry.unit}`
  }));
    const medicationEvents = safeMedications.map((entry) => ({
      id: entry.id,
      date: entry.lastTakenOn || entry.startDate || "0000-00-00",
      title: `Medication ${entry.status}: ${entry.name}`,
      description: `${entry.dose} | ${entry.schedule}${entry.lastTakenOn ? ` | taken ${formatDateLabel(entry.lastTakenOn)}` : ""}${entry.refillDate ? ` | refill by ${formatDateLabel(entry.refillDate)}` : ""}`
    }));
  const dietEvents = safeDietLogs.map((entry) => ({
    id: entry.id,
    date: entry.date,
    title: `${entry.mealType} diet log saved`,
    description: entry.summary
  }));
  const messageEvents = safeDoctorMessages.map((entry) => ({
    id: entry.id,
    date: entry.date,
    title: `Doctor message ${entry.mailbox}`,
    description: `${entry.subject} (${entry.status})`
  }));

  return [
    ...labEvents,
    ...recordEvents,
    ...portalEvents,
    ...appointmentEvents,
    ...changeEvents,
    ...symptomEvents,
      ...familyEvents,
      ...medicationEvents,
      ...weightEvents,
      ...sleepEvents,
      ...exerciseEvents,
      ...moodEvents,
      ...glucoseEvents,
      ...waterEvents,
    ...dietEvents,
    ...messageEvents
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
}

export function parseCsvText(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV needs a header row and at least one data row.");
  }

  const [header, ...rows] = lines;
  const columns = header.split(",").map((column) => column.trim().toLowerCase());
  const required = ["date", "testname", "value", "unit", "source"];

  required.forEach((column) => {
    if (!columns.includes(column)) {
      throw new Error(`CSV is missing required column: ${column}`);
    }
  });

  return rows.map((row, index) => {
    const cells = row.split(",").map((cell) => cell.trim());
    const rowData = Object.fromEntries(columns.map((column, columnIndex) => [column, cells[columnIndex] ?? ""]));
    const numericValue = Number(rowData.value);

    if (!rowData.date || !rowData.testname || Number.isNaN(numericValue)) {
      throw new Error(`Row ${index + 2} has an invalid date, test name, or value.`);
    }

    return {
      id: createId("lab"),
      testName: rowData.testname,
      value: numericValue,
      unit: rowData.unit,
      date: rowData.date,
      low: rowData.low ? Number(rowData.low) : null,
      high: rowData.high ? Number(rowData.high) : null,
      source: rowData.source
    } satisfies LabRecord;
  });
}
