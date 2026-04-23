"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppointmentCalendar } from "@/components/appointment-calendar";
import { BloodPressureChart } from "@/components/blood-pressure-chart";
import { Sparkline } from "@/components/sparkline";
import type { AuthSession } from "@/lib/backend-auth";
import { createSignedRecordUrl, uploadPrivateMessageAttachment, uploadPrivateRecordFile } from "@/lib/cloud-files";
import {
  type AppState,
  type AppointmentNote,
  type BloodPressureEntry,
  type CareChange,
  type DietEntry,
  type DoctorQuestionEntry,
  type DoctorMessage,
  type DoctorMessageAttachment,
  type ExerciseEntry,
  type FamilyHistoryEntry,
  type GlucoseEntry,
  type LabRecord,
  type MedicationEntry,
  type MoodEntry,
  type PersonalizationSectionId,
  type RoutineEntry,
  type SleepEntry,
  type SymptomEntry,
  type WaterIntakeEntry,
  type WeeklyGoal,
  type WeightEntry,
  createId,
  emptyAppointmentForm,
  emptyBloodPressureForm,
  emptyCareChangeForm,
  emptyDietForm,
  emptyDoctorMessageForm,
  emptyDoctorQuestionForm,
  emptyExerciseForm,
  emptyFamilyHistoryForm,
  emptyGlucoseForm,
  emptyLabForm,
  emptyMedicationForm,
  emptyMoodForm,
  emptyRoutineForm,
  emptySleepForm,
  emptySymptomForm,
  emptyWaterIntakeForm,
  emptyWeeklyGoalForm,
  emptyWeightForm,
  formatDateLabel,
  formatTimeLabel,
  normalizeAppState,
  starterState
} from "@/lib/medical-data";
import {
  buildAppointmentSummary,
  buildCareChangeSummary,
  buildDietSummary,
  buildDoctorMessageSummary,
  buildExerciseTrendSeries,
  buildFamilyHistorySummary,
  buildGlucoseTrendSeries,
  buildMedicationSummary,
  buildMoodTrendSeries,
  buildSymptomTrendSeries,
  buildSummaryCards,
  buildSymptomSummary,
  buildTimeline,
  buildSleepTrendSeries,
  buildTrendSeries,
  buildWaterIntakeTrendSeries,
  buildWeightTrendSeries,
  parseCsvText
} from "@/lib/medical-insights";
import { parseRecordFile } from "@/lib/pdf-parser";

const portalOptions = ["MyChart", "FollowMyHealth", "Patient Fusion"];

const appSectionOptions: Array<{
  id: PersonalizationSectionId;
  label: string;
  description: string;
}> = [
  { id: "visitSummary", label: "Printable patient summary", description: "The doctor-ready packet and highlights." },
  { id: "healthHistory", label: "Health history", description: "Appointments, calendar, questions, changes, and symptoms." },
  { id: "trendExplorer", label: "Trend explorer", description: "Lab trends and saved historical ranges." },
  { id: "importRecords", label: "Import records", description: "Uploads, OCR, and portal placeholders." },
  { id: "labIntake", label: "Lab intake", description: "CSV imports and manual lab entry." },
  { id: "appointmentNotes", label: "Appointment notes", description: "Visit notes, transcript capture, and follow-up." },
  { id: "doctorQuestions", label: "Doctor questions", description: "Saved and suggested appointment questions." },
  { id: "careChanges", label: "After-visit changes", description: "Track what changed after appointments." },
  { id: "symptoms", label: "Symptom tracker", description: "Focused symptom logging before visits." },
  { id: "plainLanguageSummary", label: "Plain-language summary", description: "High-level explanations from saved data." },
  { id: "visitPrepSummary", label: "Visit prep summary", description: "Plain-language prep and follow-through." },
  { id: "connectionsView", label: "Connections view", description: "Patterns across symptoms, sleep, mood, meds, and habits." },
  { id: "bloodPressure", label: "Blood pressure tracker", description: "Logs and graph for blood pressure." },
    { id: "familyHistory", label: "Family history", description: "Inherited conditions and family context." },
    { id: "weightTracker", label: "Weight tracker", description: "Weight logging and trend history." },
    { id: "sleepTracker", label: "Sleep tracker", description: "Sleep timing, quality, and trend history." },
    { id: "exerciseTracker", label: "Exercise tracker", description: "Activity, duration, intensity, and notes." },
    { id: "moodTracker", label: "Mood check-in", description: "Mood, stress, and what helped on harder days." },
    { id: "glucoseTracker", label: "Glucose tracker", description: "Blood sugar readings, timing, and trends." },
    { id: "waterIntake", label: "Water intake", description: "Hydration entries, goal, and graph." },
  { id: "medications", label: "Medication tracker", description: "Medication list, reminders, and refill watch." },
  { id: "dietTracker", label: "Diet tracker", description: "Meals, patterns, and symptom notes." },
  { id: "doctorMessaging", label: "Doctor messaging", description: "Inbox, drafts, and thread history." },
  { id: "savedRecords", label: "Saved records", description: "Organized document browser and parsing details." },
  { id: "timeline", label: "Unified timeline", description: "Everything added to the record set in date order." }
];

const packetSectionOptions: Array<{
  id: PersonalizationSectionId;
  label: string;
  description: string;
}> = [
  { id: "packetSnapshot", label: "Visit snapshot", description: "Patient basics, appointment details, and care goals." },
  { id: "packetMeasures", label: "Recent measures", description: "Blood pressure, weight, and hydration highlights." },
  { id: "packetSymptoms", label: "Top symptoms", description: "The main symptoms to bring into the visit." },
  { id: "packetMedications", label: "Current medications", description: "A short active medication list." },
  { id: "packetLabs", label: "Flagged labs", description: "Out-of-range labs worth discussing." },
  { id: "packetQuestions", label: "Questions to ask", description: "Saved and suggested doctor questions." },
  { id: "packetPrep", label: "Before the visit", description: "The open prep checklist items." }
];

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechCtor = new () => BrowserSpeechRecognition;

function getTrendColor(points: Array<{ value: number }>) {
  if (points.length < 2) {
    return "#5d6c70";
  }

  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;

  if (last > first) {
    return "#a6413f";
  }

  if (last < first) {
    return "#1f7a5f";
  }

  return "#5d6c70";
}

function getWeekStartIso(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy.toISOString().slice(0, 10);
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

export function HomePage({
  currentUser,
  onSignOut,
  initialState,
  onPersistState
}: {
  currentUser: AuthSession;
  onSignOut: () => void;
  initialState: AppState;
  onPersistState: (state: AppState) => Promise<void>;
}) {
  const [printPacketMode, setPrintPacketMode] = useState<"doctor" | "patient">("doctor");
  const [state, setState] = useState<AppState>(normalizeAppState(initialState));
  const [isLoaded, setIsLoaded] = useState(true);
  const [csvStatus, setCsvStatus] = useState("Upload a CSV to add multiple lab results at once.");
  const [recordStatus, setRecordStatus] = useState("Add PDF or image files to sync them into secure cloud storage. Scanned records still use OCR when needed.");
  const [syncStatus, setSyncStatus] = useState("Cloud workspace connected.");
  const [portalName, setPortalName] = useState("");
  const [labForm, setLabForm] = useState(emptyLabForm);
  const [appointmentForm, setAppointmentForm] = useState(emptyAppointmentForm);
  const [bloodPressureForm, setBloodPressureForm] = useState(emptyBloodPressureForm);
  const [careChangeForm, setCareChangeForm] = useState(emptyCareChangeForm);
  const [familyHistoryForm, setFamilyHistoryForm] = useState(emptyFamilyHistoryForm);
  const [medicationForm, setMedicationForm] = useState(emptyMedicationForm);
  const [routineForm, setRoutineForm] = useState(emptyRoutineForm);
  const [sleepForm, setSleepForm] = useState(emptySleepForm);
  const [exerciseForm, setExerciseForm] = useState(emptyExerciseForm);
  const [moodForm, setMoodForm] = useState(emptyMoodForm);
  const [glucoseForm, setGlucoseForm] = useState(emptyGlucoseForm);
  const [waterIntakeForm, setWaterIntakeForm] = useState(emptyWaterIntakeForm);
  const [weightForm, setWeightForm] = useState(emptyWeightForm);
  const [weeklyGoalForm, setWeeklyGoalForm] = useState(emptyWeeklyGoalForm);
  const [dietForm, setDietForm] = useState(emptyDietForm);
  const [doctorQuestionForm, setDoctorQuestionForm] = useState(emptyDoctorQuestionForm);
  const [hydrationGoalForm, setHydrationGoalForm] = useState({
    amount: String(initialState.hydrationGoal?.amount ?? 64),
    unit: initialState.hydrationGoal?.unit ?? "oz"
  });
  const [doctorMessageForm, setDoctorMessageForm] = useState(emptyDoctorMessageForm);
  const [symptomForm, setSymptomForm] = useState(emptySymptomForm);
  const [recordCategoryFilter, setRecordCategoryFilter] = useState<string>("All");
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [editingBloodPressureId, setEditingBloodPressureId] = useState<string | null>(null);
  const [editingCareChangeId, setEditingCareChangeId] = useState<string | null>(null);
  const [editingSymptomId, setEditingSymptomId] = useState<string | null>(null);
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null);
  const [editingDoctorQuestionId, setEditingDoctorQuestionId] = useState<string | null>(null);
  const [editingFamilyHistoryId, setEditingFamilyHistoryId] = useState<string | null>(null);
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [editingSleepId, setEditingSleepId] = useState<string | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingMoodId, setEditingMoodId] = useState<string | null>(null);
  const [editingGlucoseId, setEditingGlucoseId] = useState<string | null>(null);
  const [editingWaterIntakeId, setEditingWaterIntakeId] = useState<string | null>(null);
  const [editingDietId, setEditingDietId] = useState<string | null>(null);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [editingWeeklyGoalId, setEditingWeeklyGoalId] = useState<string | null>(null);
  const [selectedMailbox, setSelectedMailbox] = useState<"inbox" | "sent" | "drafts">("inbox");
  const [selectedReadFilter, setSelectedReadFilter] = useState<"all" | "unread" | "read">("all");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [isRecordingAppointment, setIsRecordingAppointment] = useState(false);
  const [openingRecordId, setOpeningRecordId] = useState<string | null>(null);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [summarizingRecordId, setSummarizingRecordId] = useState<string | null>(null);
  const [summarizingAppointmentId, setSummarizingAppointmentId] = useState<string | null>(null);
  const [messageAttachmentStatus, setMessageAttachmentStatus] = useState("Add attachments to messages when you need to share supporting documents.");
  const [aiStatus, setAiStatus] = useState("Add OpenAI to generate patient-friendly AI summaries for records and appointments.");
  const [recordingStatus, setRecordingStatus] = useState(
    "Use the transcript recorder in Chrome or Edge to capture spoken appointment notes."
  );
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const loadedUserIdRef = useRef(currentUser.userId);

  function isSectionVisible(sectionId: PersonalizationSectionId) {
    return state.sectionPreferences[sectionId]?.showInApp ?? true;
  }

  function isPacketSectionIncluded(sectionId: PersonalizationSectionId) {
    return state.sectionPreferences[sectionId]?.includeInPacket ?? true;
  }

  function updateSectionPreference(
    sectionId: PersonalizationSectionId,
    field: "showInApp" | "includeInPacket",
    value: boolean
  ) {
    setState((current) => ({
      ...current,
      sectionPreferences: {
        ...current.sectionPreferences,
        [sectionId]: {
          ...current.sectionPreferences[sectionId],
          [field]: value
        }
      }
      }));
    }

  function getSyncStatusMeta() {
    if (syncStatus.includes("Saving")) {
      return {
        label: "Saving to cloud",
        className: "bg-amber-100 text-amber-800"
      };
    }

    if (syncStatus.includes("failed") || syncStatus.includes("Failed")) {
      return {
        label: "Cloud save issue",
        className: "bg-rose-100 text-rose-700"
      };
    }

    return {
      label: "Saved to cloud",
      className: "bg-emerald-100 text-emerald-700"
    };
  }

  const syncStatusMeta = getSyncStatusMeta();

  useEffect(() => {
    if (loadedUserIdRef.current === currentUser.userId) {
      return;
    }

    loadedUserIdRef.current = currentUser.userId;
    setState(normalizeAppState(initialState));
    setHydrationGoalForm({
      amount: String(initialState.hydrationGoal?.amount ?? 64),
      unit: initialState.hydrationGoal?.unit ?? "oz"
    });
    setSyncStatus("Cloud workspace connected.");
  }, [currentUser.userId, initialState]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSyncStatus("Saving to secure cloud storage...");
    saveTimerRef.current = window.setTimeout(() => {
      void onPersistState(state)
        .then(() => {
          setSyncStatus("All changes saved securely.");
        })
        .catch((error) => {
          setSyncStatus(error instanceof Error ? error.message : "Cloud sync failed. Your latest changes may not be saved yet.");
        });
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [isLoaded, onPersistState, state]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const stats = useMemo(() => {
    const uniqueSources = new Set(state.labs.map((lab) => lab.source));
    const flagged = state.labs.filter(
      (lab) => (lab.low !== null && lab.value < lab.low) || (lab.high !== null && lab.value > lab.high)
    ).length;

    return [
      {
        label: "Records added",
        value: String(state.uploadedRecords.length),
        detail: "Documents and extracted text synced to your private workspace"
      },
      {
        label: "Sources tracked",
        value: String(uniqueSources.size || state.portals.length),
        detail: "Clinics, labs, or connected portals contributing data"
      },
      {
        label: "Flagged results",
        value: String(flagged),
        detail: "Lab values currently outside their saved reference range"
      }
    ];
  }, [state]);

  const summaryCards = useMemo(() => buildSummaryCards(state.labs), [state.labs]);
  const appointmentSummary = useMemo(() => buildAppointmentSummary(state.appointments), [state.appointments]);
  const careChangeSummary = useMemo(() => buildCareChangeSummary(state.careChanges), [state.careChanges]);
  const symptomSummary = useMemo(() => buildSymptomSummary(state.symptoms), [state.symptoms]);
  const familyHistorySummary = useMemo(() => buildFamilyHistorySummary(state.familyHistory), [state.familyHistory]);
  const medicationSummary = useMemo(() => buildMedicationSummary(state.medications), [state.medications]);
  const dietSummary = useMemo(() => buildDietSummary(state.dietLogs), [state.dietLogs]);
  const doctorMessageSummary = useMemo(() => buildDoctorMessageSummary(state.doctorMessages), [state.doctorMessages]);
  const trendSeries = useMemo(() => buildTrendSeries(state.labs), [state.labs]);
  const symptomTrendSeries = useMemo(() => buildSymptomTrendSeries(state.symptoms), [state.symptoms]);
  const weightTrendSeries = useMemo(() => buildWeightTrendSeries(state.weightLogs), [state.weightLogs]);
  const sleepTrendSeries = useMemo(() => buildSleepTrendSeries(state.sleepLogs), [state.sleepLogs]);
  const exerciseTrendSeries = useMemo(() => buildExerciseTrendSeries(state.exerciseLogs), [state.exerciseLogs]);
  const moodTrendSeries = useMemo(() => buildMoodTrendSeries(state.moodLogs), [state.moodLogs]);
  const glucoseTrendSeries = useMemo(() => buildGlucoseTrendSeries(state.glucoseLogs), [state.glucoseLogs]);
  const waterIntakeTrendSeries = useMemo(() => buildWaterIntakeTrendSeries(state.waterIntakeLogs), [state.waterIntakeLogs]);
  const timeline = useMemo(
    () =>
      buildTimeline(
        state.uploadedRecords,
        state.portals,
        state.labs,
        state.appointments,
        state.careChanges,
        state.symptoms,
          state.familyHistory,
          state.medications,
          state.weightLogs,
          state.sleepLogs,
          state.exerciseLogs,
          state.moodLogs,
          state.glucoseLogs,
          state.waterIntakeLogs,
        state.dietLogs,
        state.doctorMessages
      ),
    [
      state.appointments,
      state.careChanges,
      state.dietLogs,
      state.doctorMessages,
      state.familyHistory,
      state.labs,
      state.medications,
      state.portals,
        state.symptoms,
        state.uploadedRecords,
        state.sleepLogs,
        state.exerciseLogs,
        state.moodLogs,
        state.glucoseLogs,
        state.waterIntakeLogs,
        state.weightLogs
      ]
  );
  const sortedLabs = useMemo(
    () => [...state.labs].sort((a, b) => b.date.localeCompare(a.date) || a.testName.localeCompare(b.testName)),
    [state.labs]
  );
  const sortedBloodPressure = useMemo(
    () => [...state.bloodPressureLogs].sort((a, b) => a.date.localeCompare(b.date)),
    [state.bloodPressureLogs]
  );
  const latestBloodPressure = sortedBloodPressure[sortedBloodPressure.length - 1] ?? null;
  const sortedWeightLogs = useMemo(() => [...state.weightLogs].sort((a, b) => a.date.localeCompare(b.date)), [state.weightLogs]);
  const latestWeight = sortedWeightLogs[sortedWeightLogs.length - 1] ?? null;
  const sortedSleepLogs = useMemo(() => [...state.sleepLogs].sort((a, b) => a.date.localeCompare(b.date)), [state.sleepLogs]);
  const latestSleep = sortedSleepLogs[sortedSleepLogs.length - 1] ?? null;
  const sortedExerciseLogs = useMemo(() => [...state.exerciseLogs].sort((a, b) => a.date.localeCompare(b.date)), [state.exerciseLogs]);
  const latestExercise = sortedExerciseLogs[sortedExerciseLogs.length - 1] ?? null;
  const sortedMoodLogs = useMemo(() => [...state.moodLogs].sort((a, b) => a.date.localeCompare(b.date)), [state.moodLogs]);
  const latestMood = sortedMoodLogs[sortedMoodLogs.length - 1] ?? null;
  const sortedGlucoseLogs = useMemo(
    () => [...state.glucoseLogs].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)),
    [state.glucoseLogs]
  );
  const latestGlucose = sortedGlucoseLogs[0] ?? null;
  const packetExerciseHighlight = latestExercise
    ? `${latestExercise.activityType} for ${latestExercise.durationMinutes} minutes on ${formatDateLabel(latestExercise.date)} (${latestExercise.intensity.toLowerCase()} intensity)${
        latestExercise.notes ? `. ${latestExercise.notes}` : ""
      }`
    : "";
  const packetMoodHighlight = latestMood
    ? `${latestMood.mood} mood with ${latestMood.stressLevel.toLowerCase()} stress on ${formatDateLabel(latestMood.date)}${
        latestMood.anxietyNotes ? `. ${latestMood.anxietyNotes}` : latestMood.whatHelped ? `. What helped: ${latestMood.whatHelped}` : ""
      }`
    : "";
  const packetSleepHighlight = latestSleep
    ? `${latestSleep.hoursSlept} hours of ${latestSleep.quality.toLowerCase()} sleep on ${formatDateLabel(latestSleep.date)}${
        latestSleep.notes ? `. ${latestSleep.notes}` : ""
      }`
    : "";
  const sortedWaterIntakeLogs = useMemo(
    () => [...state.waterIntakeLogs].sort((a, b) => a.date.localeCompare(b.date)),
    [state.waterIntakeLogs]
  );
  const latestWaterIntake = sortedWaterIntakeLogs[sortedWaterIntakeLogs.length - 1] ?? null;
  const todayIso = new Date().toISOString().slice(0, 10);
  const latestWaterForToday =
      [...sortedWaterIntakeLogs].reverse().find((entry) => entry.date === todayIso) ?? latestWaterIntake;
  const hydrationGoalProgress = latestWaterForToday
      ? Math.min((latestWaterForToday.amount / Math.max(state.hydrationGoal.amount, 1)) * 100, 100)
      : 0;
  const packetHydrationHighlight = latestWaterForToday
    ? `${latestWaterForToday.amount} ${latestWaterForToday.unit} logged on ${formatDateLabel(latestWaterForToday.date)} (${Math.round(
        hydrationGoalProgress
      )}% of the current goal)`
    : "";
  const packetWellnessHighlights = [
    packetSleepHighlight ? { label: "Sleep", body: packetSleepHighlight } : null,
    packetExerciseHighlight ? { label: "Exercise", body: packetExerciseHighlight } : null,
    packetMoodHighlight ? { label: "Mood", body: packetMoodHighlight } : null,
    packetHydrationHighlight ? { label: "Hydration", body: packetHydrationHighlight } : null
  ].filter((entry): entry is { label: string; body: string } => Boolean(entry));
  const currentWeekStartIso = getWeekStartIso(new Date());
  const refillSoonDate = new Date();
  refillSoonDate.setDate(refillSoonDate.getDate() + 7);
  const refillSoonIso = refillSoonDate.toISOString().slice(0, 10);
  const latestAppointment =
      [...state.appointments].sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate))[0] ?? null;
  const packetAppointmentHighlight =
    latestAppointment?.followUp?.trim() || latestAppointment?.notes?.trim() || latestAppointment?.transcript?.trim() || "";
  const latestDoctorMessage =
      [...state.doctorMessages].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const packetDoctorMessageHighlight =
    latestDoctorMessage?.message?.trim() || latestDoctorMessage?.subject?.trim() || "";
  const sortedUploadedRecords = [...state.uploadedRecords].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const recordCategoryCounts = sortedUploadedRecords.reduce<Record<string, number>>((accumulator, record) => {
    const key = record.category || "Other";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
  const recordCategoryOptions = ["All", ...Object.keys(recordCategoryCounts).sort((a, b) => a.localeCompare(b))];
  const filteredUploadedRecords =
    recordCategoryFilter === "All"
      ? sortedUploadedRecords
      : sortedUploadedRecords.filter((record) => (record.category || "Other") === recordCategoryFilter);
  const groupedUploadedRecords = filteredUploadedRecords.reduce<
    Array<{ category: string; records: typeof filteredUploadedRecords }>
  >((groups, record) => {
    const category = record.category || "Other";
    const existing = groups.find((entry) => entry.category === category);
    if (existing) {
      existing.records.push(record);
    } else {
      groups.push({ category, records: [record] });
    }
    return groups;
  }, []);
  const upcomingAppointment =
    [...state.appointments]
      .filter((appointment) => appointment.appointmentDate >= todayIso)
      .sort(
        (a, b) =>
          a.appointmentDate.localeCompare(b.appointmentDate) ||
          (a.appointmentTime ?? "").localeCompare(b.appointmentTime ?? "")
      )[0] ?? null;
  const unreadInboxMessages = state.doctorMessages.filter((entry) => entry.mailbox === "inbox" && !entry.isRead);
  const flaggedLabs = state.labs.filter(
    (lab) => (lab.low !== null && lab.value < lab.low) || (lab.high !== null && lab.value > lab.high)
  );
  const activeSymptoms = state.symptoms.filter((entry) => entry.frequency && entry.severity);
  const pausedOrStoppedMeds = state.medications.filter((entry) => entry.status !== "active");
  const activeMedications = state.medications.filter((entry) => entry.status === "active");
  const reminderMedications = activeMedications.filter((entry) => entry.reminderEnabled);
  const takenTodayMedications = activeMedications.filter((entry) => entry.lastTakenOn === todayIso);
  const dueTodayMedications = activeMedications.filter((entry) => entry.lastTakenOn !== todayIso);
  const overdueRefills = activeMedications.filter((entry) => entry.refillDate && entry.refillDate <= todayIso);
  const upcomingRefills = activeMedications.filter(
    (entry) => entry.refillDate && entry.refillDate > todayIso && entry.refillDate <= refillSoonIso
  );
  const refillAlerts = [...overdueRefills, ...upcomingRefills];
  const planStateForToday =
    state.dailyPlan.date === todayIso
      ? state.dailyPlan
      : { date: todayIso, completedTaskIds: [], dismissedTaskIds: [] };
  const visitPrepChecklistState =
    state.visitPrepChecklist.date === todayIso
      ? state.visitPrepChecklist
      : { date: todayIso, completedItemIds: [] };
  const routinesDueToday = state.routines.filter((routine) => routine.lastCompletedOn !== todayIso);
  const completedTodayRoutines = state.routines.filter((routine) => routine.lastCompletedOn === todayIso);
  const goalsNeedingProgress = state.weeklyGoals.filter((goal) => goal.progressCount < goal.targetCount);
  const weeklyGoalsNeedReset = state.weeklyGoalsWeekOf !== currentWeekStartIso;
  const includedPacketSectionCount = packetSectionOptions.filter((section) => isPacketSectionIncluded(section.id)).length;
  const todayPlan = [
    dueTodayMedications.length
      ? {
          id: "medications-due",
          title: "Mark medications taken",
          detail: `${dueTodayMedications.length} active medication${dueTodayMedications.length === 1 ? "" : "s"} still need today&apos;s checkoff.`,
          href: "#medications",
          tone: "watch" as const
        }
      : null,
    unreadInboxMessages.length
      ? {
          id: "unread-messages",
          title: "Review unread messages",
          detail: `${unreadInboxMessages.length} doctor message${unreadInboxMessages.length === 1 ? "" : "s"} are waiting in the inbox.`,
          href: "#messages",
          tone: "alert" as const
        }
      : null,
    refillAlerts.length
      ? {
          id: "refill-alerts",
          title: "Handle refill timing",
          detail: overdueRefills.length
            ? `${overdueRefills.length} refill${overdueRefills.length === 1 ? "" : "s"} are already overdue.`
            : `${upcomingRefills.length} refill${upcomingRefills.length === 1 ? "" : "s"} come up within the next week.`,
          href: "#medications",
          tone: overdueRefills.length ? ("alert" as const) : ("watch" as const)
        }
      : null,
    upcomingAppointment
      ? {
          id: "next-visit-prep",
          title: "Prep for next visit",
          detail: `${upcomingAppointment.provider}${upcomingAppointment.location ? ` at ${upcomingAppointment.location}` : ""} is coming up on ${formatDateLabel(upcomingAppointment.appointmentDate)}.`,
          href: "#health-history",
          tone: "info" as const
        }
      : null,
    flaggedLabs.length
      ? {
          id: "flagged-labs",
          title: "Review flagged labs",
          detail: `${flaggedLabs.length} result${flaggedLabs.length === 1 ? "" : "s"} still sit outside the saved reference range.`,
          href: "#trend-explorer",
          tone: "alert" as const
        }
      : null,
    routinesDueToday.length
      ? {
          id: "routines-due",
          title: "Complete daily routines",
          detail: `${routinesDueToday.length} routine${routinesDueToday.length === 1 ? "" : "s"} are still open today.`,
          href: "#planning",
          tone: "watch" as const
        }
      : null,
    goalsNeedingProgress.length
      ? {
          id: "weekly-goals",
          title: "Move weekly goals forward",
          detail: `${goalsNeedingProgress.length} weekly goal${goalsNeedingProgress.length === 1 ? "" : "s"} still need progress.`,
          href: "#planning",
          tone: "info" as const
        }
      : null
  ].filter(Boolean) as Array<{ id: string; title: string; detail: string; href: string; tone: "info" | "alert" | "watch" }>;
  const visibleTodayPlan = todayPlan.filter(
    (item) =>
      !planStateForToday.completedTaskIds.includes(item.id) &&
      !planStateForToday.dismissedTaskIds.includes(item.id)
  );
  const priorityCards = [
    {
      title: "Today",
      value: visibleTodayPlan.length ? `${visibleTodayPlan.length} active task${visibleTodayPlan.length === 1 ? "" : "s"}` : "Clear day",
      detail: visibleTodayPlan.length ? "The home screen is highlighting the most time-sensitive items first." : "Nothing urgent is showing right now.",
      tone: visibleTodayPlan.some((item) => item.tone === "alert") ? "alert" : visibleTodayPlan.length ? "watch" : "calm"
    },
    {
      title: "Follow-up",
      value: upcomingAppointment ? formatDateLabel(upcomingAppointment.appointmentDate) : "No visit booked",
      detail: upcomingAppointment
        ? `${upcomingAppointment.provider}${upcomingAppointment.visitType ? ` | ${upcomingAppointment.visitType}` : ""}`
        : "Add an appointment when the next follow-up gets scheduled.",
      tone: upcomingAppointment ? "info" : "calm"
    },
    {
      title: "Medication pace",
      value: `${takenTodayMedications.length}/${activeMedications.length || 0} taken`,
      detail: activeMedications.length
        ? dueTodayMedications.length
          ? `${dueTodayMedications.length} medication${dueTodayMedications.length === 1 ? "" : "s"} still need today's checkoff.`
          : "All active medications are marked taken today."
        : "No active medications are being tracked yet.",
      tone: dueTodayMedications.length ? "watch" : "calm"
    },
    {
      title: "Routines",
      value: `${completedTodayRoutines.length}/${state.routines.length || 0} done`,
      detail: state.routines.length
        ? routinesDueToday.length
          ? `${routinesDueToday.length} recurring routine${routinesDueToday.length === 1 ? "" : "s"} are still open today.`
          : "All recurring routines are complete for today."
        : "No recurring routines have been added yet.",
      tone: routinesDueToday.length ? "watch" : "calm"
    },
    {
      title: "Weekly goals",
      value: `${state.weeklyGoals.filter((goal) => goal.progressCount >= goal.targetCount).length}/${state.weeklyGoals.length || 0} on track`,
      detail: state.weeklyGoals.length
        ? goalsNeedingProgress.length
          ? `${goalsNeedingProgress.length} weekly goal${goalsNeedingProgress.length === 1 ? "" : "s"} still need progress.`
          : "All weekly goals are currently on track."
        : "No weekly goals have been added yet.",
      tone: goalsNeedingProgress.length ? "info" : "calm"
    }
  ] as Array<{ title: string; value: string; detail: string; tone: "info" | "alert" | "watch" | "calm" }>;
  const attentionItems = [
    upcomingAppointment
      ? {
          title: "Upcoming appointment",
          tone: "info",
          body: `${upcomingAppointment.provider} for ${upcomingAppointment.specialty} on ${formatDateLabel(
            upcomingAppointment.appointmentDate
          )}${upcomingAppointment.appointmentTime ? ` at ${formatTimeLabel(upcomingAppointment.appointmentTime)}` : ""}${upcomingAppointment.location ? ` at ${upcomingAppointment.location}` : ""}.`
        }
      : null,
    unreadInboxMessages.length
      ? {
          title: "Unread doctor messages",
          tone: "alert",
          body: `${unreadInboxMessages.length} unread message${unreadInboxMessages.length === 1 ? "" : "s"} waiting in the inbox.`
        }
      : null,
    dueTodayMedications.length
      ? {
          title: "Medications due today",
          tone: "watch",
          body: `${dueTodayMedications.length} active medication${dueTodayMedications.length === 1 ? "" : "s"} have not been marked taken today yet.`
        }
      : null,
    flaggedLabs.length
      ? {
          title: "Lab results to review",
          tone: "alert",
          body: `${flaggedLabs.length} saved lab result${flaggedLabs.length === 1 ? "" : "s"} look outside the stored reference range.`
        }
      : null,
    overdueRefills.length
      ? {
          title: "Refills overdue",
          tone: "alert",
          body: `${overdueRefills.length} medication refill${overdueRefills.length === 1 ? "" : "s"} should already be renewed.`
        }
      : null,
    !overdueRefills.length && upcomingRefills.length
      ? {
          title: "Refills coming up soon",
          tone: "watch",
          body: `${upcomingRefills.length} medication refill${upcomingRefills.length === 1 ? "" : "s"} come due within the next week.`
        }
      : null,
    pausedOrStoppedMeds.length
      ? {
          title: "Medication changes",
          tone: "watch",
          body: `${pausedOrStoppedMeds.length} medication${pausedOrStoppedMeds.length === 1 ? "" : "s"} are paused or stopped and may need follow-up.`
        }
      : null,
    reminderMedications.length
      ? {
          title: "Medication reminders set",
          tone: "info",
          body: `${reminderMedications.length} active medication${reminderMedications.length === 1 ? "" : "s"} have reminder timing saved.`
        }
      : null,
    activeSymptoms.length
      ? {
          title: "Symptoms still active",
          tone: "watch",
          body: `${activeSymptoms.length} symptom${activeSymptoms.length === 1 ? "" : "s"} are being tracked right now.`
        }
      : null
  ].filter(Boolean) as Array<{ title: string; tone: "info" | "alert" | "watch"; body: string }>;
  const suggestedDoctorQuestions = useMemo(() => {
    const existingQuestions = new Set(
      state.doctorQuestions.map((entry) => entry.question.trim().toLowerCase()).filter(Boolean)
    );
    const suggestions: Array<{ id: string; question: string; context: string; priority: "routine" | "important" }> = [];

    flaggedLabs.slice(0, 2).forEach((lab) => {
      const question =
        lab.high !== null && lab.value > lab.high
          ? `What do you think is driving my high ${lab.testName} result?`
          : `What might be causing my low ${lab.testName} result?`;
      suggestions.push({
        id: `lab-${lab.id}`,
        question,
        context: `${lab.testName} was ${lab.value} ${lab.unit} on ${formatDateLabel(lab.date)}. Saved range: ${lab.low ?? "?"} to ${lab.high ?? "?"} ${lab.unit}.`,
        priority: "important"
      });
    });

    activeSymptoms.slice(0, 2).forEach((symptom) => {
      suggestions.push({
        id: `symptom-${symptom.id}`,
        question: `Could my ${symptom.symptom.toLowerCase()} be related to anything else we are tracking?`,
        context: `${symptom.severity} severity and ${symptom.frequency || "no frequency added"}${symptom.startedOn ? ` since ${formatDateLabel(symptom.startedOn)}` : ""}.`,
        priority: "important"
      });
    });

    overdueRefills.slice(0, 1).forEach((medication) => {
      suggestions.push({
        id: `refill-${medication.id}`,
        question: `Should I stay on ${medication.name} and renew the refill now?`,
        context: `${medication.name} is active and the refill date is ${formatDateLabel(medication.refillDate)}.`,
        priority: "important"
      });
    });

    pausedOrStoppedMeds.slice(0, 1).forEach((medication) => {
      suggestions.push({
        id: `medication-${medication.id}`,
        question: `Do we need to revisit why ${medication.name} is ${medication.status}?`,
        context: `${medication.name} is currently marked ${medication.status}${medication.notes ? ` with note: ${medication.notes}` : "."}`,
        priority: "routine"
      });
    });

    if (upcomingAppointment?.followUp) {
      suggestions.push({
        id: `follow-up-${upcomingAppointment.id}`,
        question: "Can we review the follow-up plan and what I should prioritize before the next visit?",
        context: upcomingAppointment.followUp,
        priority: "routine"
      });
    }

    return suggestions.filter((entry, index, list) => {
      const normalized = entry.question.trim().toLowerCase();
      return normalized && !existingQuestions.has(normalized) && list.findIndex((item) => item.question === entry.question) === index;
    }).slice(0, 5);
  }, [activeSymptoms, flaggedLabs, overdueRefills, pausedOrStoppedMeds, state.doctorQuestions, upcomingAppointment]);
  const connectionsInsights = useMemo(() => {
    const insights: Array<{
      title: string;
      body: string;
      detail: string;
      href: string;
      tone: "info" | "watch" | "alert" | "calm";
    }> = [];

    const sleepByDate = new Map(state.sleepLogs.map((entry) => [entry.date, entry]));
    const moodByDate = new Map(state.moodLogs.map((entry) => [entry.date, entry]));
    const hydrationByDate = new Map(state.waterIntakeLogs.map((entry) => [entry.date, entry]));
    const exerciseByDate = new Map(state.exerciseLogs.map((entry) => [entry.date, entry]));
    const bloodPressureByDate = new Map(state.bloodPressureLogs.map((entry) => [entry.date, entry]));

    const sleepMoodOverlap = [...state.moodLogs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .find((mood) => {
        const sleep = sleepByDate.get(mood.date);
        return sleep && sleep.hoursSlept < 7 && (mood.stressLevel === "High" || mood.mood === "Low" || mood.mood === "Okay");
      });
    const lowHydrationSymptomOverlap = [...activeSymptoms]
      .sort((a, b) => (b.startedOn || "").localeCompare(a.startedOn || ""))
      .find((entry) => {
        const hydration = hydrationByDate.get(entry.startedOn);
        return hydration && (hydration.amount / Math.max(state.hydrationGoal.amount, 1)) * 100 < 75;
      });
    const exerciseMoodOverlap = [...state.exerciseLogs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .find((exercise) => {
        const mood = moodByDate.get(exercise.date);
        return mood && (mood.mood === "Good" || mood.mood === "Great");
      });
    const bloodPressureStressOverlap = [...state.bloodPressureLogs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .find((entry) => {
        const mood = moodByDate.get(entry.date);
        return mood && mood.stressLevel === "High" && entry.systolic >= 130;
      });
    const medicationSymptomOverlap = [...pausedOrStoppedMeds]
      .sort((a, b) => {
        const aDate = a.lastReviewedOn || a.startDate || "";
        const bDate = b.lastReviewedOn || b.startDate || "";
        return bDate.localeCompare(aDate);
      })
      .find((medication) => {
        const medicationDate = medication.lastReviewedOn || medication.startDate;
        return medicationDate && activeSymptoms.some((entry) => entry.startedOn === medicationDate);
      });
    const headacheOrFatigueSymptom = activeSymptoms.find((entry) => {
      const label = entry.symptom.toLowerCase();
      return label.includes("headache") || label.includes("fatigue") || label.includes("dizzy");
    });
    const highestSeveritySymptom = [...activeSymptoms].sort(
      (a, b) => symptomSeverityScore(b.severity) - symptomSeverityScore(a.severity)
    )[0];

    if (sleepMoodOverlap) {
      const matchingSleep = sleepByDate.get(sleepMoodOverlap.date)!;
      insights.push({
        title: "Sleep and mood may be moving together",
        body: `${matchingSleep.hoursSlept} hours of sleep and a ${sleepMoodOverlap.mood.toLowerCase()} mood were both logged on ${formatDateLabel(sleepMoodOverlap.date)}.`,
        detail: "This can be useful to bring up if lower-sleep days also feel emotionally heavier or more stressful.",
        href: "#connections-view",
        tone: "watch"
      });
    }

    if (lowHydrationSymptomOverlap && headacheOrFatigueSymptom) {
      const matchingHydration = hydrationByDate.get(lowHydrationSymptomOverlap.startedOn)!;
      const hydrationPercent = Math.round((matchingHydration.amount / Math.max(state.hydrationGoal.amount, 1)) * 100);
      insights.push({
        title: "Hydration may be worth checking against symptoms",
        body: `${matchingHydration.amount} ${matchingHydration.unit} (${hydrationPercent}% of goal) was logged on ${formatDateLabel(lowHydrationSymptomOverlap.startedOn)} while ${lowHydrationSymptomOverlap.symptom.toLowerCase()} was active.`,
        detail: "Headaches, dizziness, and fatigue can be easier to compare when hydration stays more consistent on the same day.",
        href: "#water-intake",
        tone: "watch"
      });
    }

    if (exerciseMoodOverlap) {
      const matchingMood = moodByDate.get(exerciseMoodOverlap.date)!;
      insights.push({
        title: "Exercise may be lining up with better mood days",
        body: `${exerciseMoodOverlap.activityType} and a ${matchingMood.mood.toLowerCase()} mood were both logged on ${formatDateLabel(exerciseMoodOverlap.date)}.`,
        detail: "This does not prove cause and effect, but same-day patterns can still be helpful to keep an eye on.",
        href: "#exercise-tracker",
        tone: "info"
      });
    }

    if (medicationSymptomOverlap && highestSeveritySymptom) {
      const overlapDate = medicationSymptomOverlap.lastReviewedOn || medicationSymptomOverlap.startDate;
      const matchingSymptom = activeSymptoms.find((entry) => entry.startedOn === overlapDate) ?? highestSeveritySymptom;
      insights.push({
        title: "Medication changes may be worth comparing with symptoms",
        body: `${medicationSymptomOverlap.name} changed around ${formatDateLabel(overlapDate)} and ${matchingSymptom.symptom.toLowerCase()} is also logged for that timing.`,
        detail: "If symptoms changed around the same time as a medication pause or stop, that same-day overlap is worth mentioning at the next visit.",
        href: "#medications",
        tone: "watch"
      });
    }

    if (bloodPressureStressOverlap) {
      const matchingMood = moodByDate.get(bloodPressureStressOverlap.date)!;
      insights.push({
        title: "Blood pressure and stress may be overlapping",
        body: `Blood pressure was ${bloodPressureStressOverlap.systolic}/${bloodPressureStressOverlap.diastolic} and stress was ${matchingMood.stressLevel.toLowerCase()} on ${formatDateLabel(bloodPressureStressOverlap.date)}.`,
        detail: "Stress does not explain every reading, but same-day overlap can be useful context for the care team.",
        href: "#blood-pressure",
        tone: "alert"
      });
    }

    if (!insights.length) {
      insights.push({
        title: "Connections will appear as more data builds up",
        body: "The app is ready to connect patterns across sleep, mood, hydration, exercise, symptoms, and medications.",
        detail: "Keep logging a few days in each tracker and this section will start surfacing the strongest overlaps.",
        href: "#health-history",
        tone: "calm"
      });
    }

    return insights.slice(0, 4);
  }, [
    activeSymptoms,
    state.bloodPressureLogs,
    state.exerciseLogs,
    state.hydrationGoal.amount,
    state.moodLogs,
    state.sleepLogs,
    state.waterIntakeLogs,
    pausedOrStoppedMeds,
    todayIso
  ]);
  const visitPrepChecklist = [
    upcomingAppointment
      ? {
          id: "confirm-visit-details",
          title: "Confirm the visit details",
          detail: `${upcomingAppointment.provider}${upcomingAppointment.location ? ` at ${upcomingAppointment.location}` : ""}${upcomingAppointment.appointmentTime ? `, ${formatTimeLabel(upcomingAppointment.appointmentTime)}` : ""}.`,
          href: "#health-history"
        }
      : null,
    state.doctorQuestions.filter((entry) => !entry.answered).length || suggestedDoctorQuestions.length
      ? {
          id: "review-doctor-questions",
          title: "Review your doctor questions",
          detail: `${state.doctorQuestions.filter((entry) => !entry.answered).length} saved question${state.doctorQuestions.filter((entry) => !entry.answered).length === 1 ? "" : "s"} and ${suggestedDoctorQuestions.length} suggested prompt${suggestedDoctorQuestions.length === 1 ? "" : "s"} are available.`,
          href: "#doctor-questions"
        }
      : null,
    flaggedLabs.length
      ? {
          id: "bring-lab-context",
          title: "Bring your lab context",
          detail: `${flaggedLabs.length} flagged lab result${flaggedLabs.length === 1 ? "" : "s"} may be worth asking about.`,
          href: "#trend-explorer"
        }
      : null,
    activeSymptoms.length
      ? {
          id: "review-symptoms",
          title: "Review current symptoms",
          detail: `${activeSymptoms.length} symptom${activeSymptoms.length === 1 ? "" : "s"} are currently being tracked.`,
          href: "#health-history"
        }
      : null,
    unreadInboxMessages.length
      ? {
          id: "check-messages-before-visit",
          title: "Check recent doctor messages",
          detail: `${unreadInboxMessages.length} unread message${unreadInboxMessages.length === 1 ? "" : "s"} may have instructions to bring up during the appointment.`,
          href: "#messages"
        }
      : null,
    activeMedications.length
      ? {
          id: "review-medication-list",
          title: "Review your medication list",
          detail: `${activeMedications.length} active medication${activeMedications.length === 1 ? "" : "s"} are on file.`,
          href: "#medications"
        }
      : null
  ].filter(Boolean) as Array<{ id: string; title: string; detail: string; href: string }>;
  const openVisitPrepCount = visitPrepChecklist.filter(
    (item) => !visitPrepChecklistState.completedItemIds.includes(item.id)
  ).length;
  const packetMeasuresSummary = [
    latestBloodPressure ? `BP ${latestBloodPressure.systolic}/${latestBloodPressure.diastolic}` : null,
    latestWeight ? `Weight ${latestWeight.weight} ${latestWeight.unit}` : null,
    latestWaterForToday ? `Hydration ${latestWaterForToday.amount} ${latestWaterForToday.unit}` : null
  ]
    .filter(Boolean)
    .join(" | ");
  const packetSymptoms = [...state.symptoms]
    .sort((a, b) => (b.startedOn || "").localeCompare(a.startedOn || ""))
    .slice(0, 2);
  const packetSymptomHighlight = [...state.symptoms].find(
    (entry) =>
      entry.severity.toLowerCase() === "severe" ||
      entry.notes.trim() ||
      entry.frequency.toLowerCase().includes("daily")
  );
  const packetSymptomSummaryItems = packetSymptomHighlight
    ? [
        {
          label: "Key symptom note",
          body: `${packetSymptomHighlight.symptom}${
            packetSymptomHighlight.severity ? ` has felt ${packetSymptomHighlight.severity.toLowerCase()}` : ""
          }${
            packetSymptomHighlight.frequency
              ? ` and tends to happen ${packetSymptomHighlight.frequency.toLowerCase()}`
              : ""
          }.${packetSymptomHighlight.notes ? ` ${packetSymptomHighlight.notes}` : ""}`
        }
      ]
    : [];
  const packetMedications = activeMedications.slice(0, 2);
  const packetMedicationResponseNote = activeMedications.find(
    (entry) => entry.responseStatus === "hard-to-tolerate" || entry.sideEffects.trim() || entry.responseNotes.trim()
  );
  const packetMedicationSummaryItems = packetMedicationResponseNote
    ? [
        {
          label: "Medication response",
          body: `${packetMedicationResponseNote.name}${
            packetMedicationResponseNote.responseStatus === "hard-to-tolerate"
              ? " has been harder to tolerate lately"
              : packetMedicationResponseNote.responseStatus === "helpful"
                ? " seems to be helping"
                : " has felt about the same"
          }.${
            packetMedicationResponseNote.sideEffects
              ? ` Side effects: ${packetMedicationResponseNote.sideEffects}`
              : packetMedicationResponseNote.responseNotes
                ? ` ${packetMedicationResponseNote.responseNotes}`
                : ""
          }`
        }
      ]
    : [];
  const packetFlaggedLabs = flaggedLabs.slice(0, 2);
  const packetLabHighlight = [...flaggedLabs]
    .sort((a, b) => {
      const aDelta = a.high !== null && a.value > a.high
        ? a.value - a.high
        : a.low !== null && a.value < a.low
          ? a.low - a.value
          : 0;
      const bDelta = b.high !== null && b.value > b.high
        ? b.value - b.high
        : b.low !== null && b.value < b.low
          ? b.low - b.value
          : 0;

      return bDelta - aDelta || b.date.localeCompare(a.date);
    })[0];
  const packetLabSummaryItems = packetLabHighlight
    ? [
        {
          label: "Main lab issue",
          body: `${packetLabHighlight.testName} was ${
            packetLabHighlight.high !== null && packetLabHighlight.value > packetLabHighlight.high
              ? "above range"
              : "below range"
          } at ${packetLabHighlight.value} ${packetLabHighlight.unit} on ${formatDateLabel(packetLabHighlight.date)}.`
        }
      ]
    : [];
  const packetSuggestedQuestions = suggestedDoctorQuestions.slice(0, 1);
  const packetSavedQuestions = state.doctorQuestions
    .slice()
    .sort((a, b) => (Number(a.answered) - Number(b.answered)) || b.date.localeCompare(a.date))
    .filter((entry) => !entry.answered)
    .slice(0, 2);
  const packetPrepItems = visitPrepChecklist
    .filter((item) => !visitPrepChecklistState.completedItemIds.includes(item.id))
    .slice(0, 3);
  const packetCopy =
    printPacketMode === "doctor"
      ? {
          emptyTitle: "Packet highlights",
          snapshotTitle: "Visit snapshot",
          measuresLabel: "Latest check-ins",
          wellnessLabel: "Wellness snapshot",
          visitPlanLabel: "Plan from the last visit",
          messageLabel: "Recent doctor message",
          symptomsTitle: "Top symptoms",
          symptomsSummaryLabel: "Symptom snapshot",
          medicationsTitle: "Current medications",
          medicationsSummaryLabel: "Medication snapshot",
          labsTitle: "Flagged labs",
          labsSummaryLabel: "Lab snapshot",
          questionsTitle: "Questions to ask",
          prepTitle: "Before the visit"
        }
      : {
          emptyTitle: "Summary highlights",
          snapshotTitle: "Quick visit overview",
          measuresLabel: "Latest check-ins",
          wellnessLabel: "Daily wellness snapshot",
          visitPlanLabel: "Plan from the last visit",
          messageLabel: "Recent doctor message",
          symptomsTitle: "Symptoms to mention",
          symptomsSummaryLabel: "Main symptom note",
          medicationsTitle: "Medicines to review",
          medicationsSummaryLabel: "Medication note",
          labsTitle: "Lab results to discuss",
          labsSummaryLabel: "Main lab note",
          questionsTitle: "Questions for the visit",
          prepTitle: "Before the visit"
        };
  const finalVisibleTodayPlan =
    upcomingAppointment && openVisitPrepCount
      ? [
          {
            id: "visit-prep-checklist",
            title: "Finish the pre-visit checklist",
            detail: `${openVisitPrepCount} prep item${openVisitPrepCount === 1 ? "" : "s"} are still open before the next appointment.`,
            href: "#visit-summary",
            tone: "watch" as const
          },
          ...visibleTodayPlan
        ]
      : visibleTodayPlan;
  const dashboardAlerts = [
    {
      label: "Unread messages",
      value: String(unreadInboxMessages.length),
      tone: unreadInboxMessages.length ? "alert" : "calm",
      href: "#messages"
    },
    {
      label: "Flagged labs",
      value: String(flaggedLabs.length),
      tone: flaggedLabs.length ? "alert" : "calm",
      href: "#trend-explorer"
    },
    {
      label: "Refill alerts",
      value: String(refillAlerts.length),
      tone: refillAlerts.length ? "alert" : "calm",
      href: "#medications"
    },
    {
      label: "Med reminders",
      value: String(reminderMedications.length),
      tone: reminderMedications.length ? "info" : "calm",
      href: "#medications"
    },
    {
      label: "Taken today",
      value: `${takenTodayMedications.length}/${activeMedications.length}`,
      tone: dueTodayMedications.length ? "watch" : "calm",
      href: "#medications"
    },
    {
      label: "Tracked symptoms",
      value: String(activeSymptoms.length),
      tone: activeSymptoms.length ? "watch" : "calm",
      href: "#health-history"
    }
  ];
  const dashboardHighlights = [
      {
        label: "Next focus",
        value: upcomingAppointment ? `${upcomingAppointment.provider}` : "No upcoming visit",
        detail: upcomingAppointment
          ? `${upcomingAppointment.specialty} on ${formatDateLabel(upcomingAppointment.appointmentDate)}${upcomingAppointment.appointmentTime ? ` at ${formatTimeLabel(upcomingAppointment.appointmentTime)}` : ""}${upcomingAppointment.location ? ` | ${upcomingAppointment.location}` : ""}`
          : "Add an appointment to anchor the dashboard"
      },
    {
      label: "Latest blood pressure",
      value: latestBloodPressure ? `${latestBloodPressure.systolic}/${latestBloodPressure.diastolic}` : "No reading",
      detail: latestBloodPressure
        ? `${formatDateLabel(latestBloodPressure.date)}${latestBloodPressure.pulse !== null ? ` | pulse ${latestBloodPressure.pulse}` : ""}`
        : "Log a reading to see home trends"
    },
      {
        label: "Latest weight",
        value: latestWeight ? `${latestWeight.weight} ${latestWeight.unit}` : "No weight",
        detail: latestWeight ? formatDateLabel(latestWeight.date) : "Add a weigh-in to track progress"
      },
      {
        label: "Recent sleep",
        value: latestSleep ? `${latestSleep.hoursSlept} hours` : "No sleep log",
        detail: latestSleep
          ? `${latestSleep.quality} sleep on ${formatDateLabel(latestSleep.date)}`
          : "Add a sleep entry to spot energy and symptom patterns"
      },
      {
        label: "Recent exercise",
        value: latestExercise ? `${latestExercise.durationMinutes} min` : "No exercise log",
        detail: latestExercise
          ? `${latestExercise.activityType} on ${formatDateLabel(latestExercise.date)}`
          : "Track movement to compare with sleep, symptoms, and blood pressure"
      },
      {
        label: "Recent mood",
        value: latestMood ? latestMood.mood : "No mood log",
        detail: latestMood
          ? `${latestMood.stressLevel} stress on ${formatDateLabel(latestMood.date)}`
          : "Add a check-in to connect stress and mood with symptoms, sleep, and meds"
      },
      {
        label: "Recent glucose",
        value: latestGlucose ? `${latestGlucose.value} ${latestGlucose.unit}` : "No glucose log",
        detail: latestGlucose
          ? `${latestGlucose.context} on ${formatDateLabel(latestGlucose.date)}${latestGlucose.time ? ` at ${latestGlucose.time}` : ""}`
          : "Track blood sugar alongside meals, exercise, and lab trends"
      },
      {
        label: "Recent hydration",
        value: latestWaterForToday ? `${latestWaterForToday.amount} ${latestWaterForToday.unit}` : "No hydration log",
        detail: latestWaterForToday
          ? `${Math.round(hydrationGoalProgress)}% of the daily goal on ${formatDateLabel(latestWaterForToday.date)}`
          : "Track water intake to compare with energy, headaches, and sleep"
      },
      {
        label: "Messages center",
        value: `${state.doctorMessages.filter((entry) => entry.mailbox === "inbox").length} inbox`,
        detail: latestDoctorMessage ? latestDoctorMessage.subject : "No messages saved yet"
      }
  ];
  const filteredMessages = useMemo(
    () =>
      [...state.doctorMessages]
        .filter((entry) => entry.mailbox === selectedMailbox)
        .filter((entry) => {
          if (selectedReadFilter === "all") {
            return true;
          }

          return selectedReadFilter === "unread" ? !entry.isRead : entry.isRead;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [selectedMailbox, selectedReadFilter, state.doctorMessages]
  );
  const threadSummaries = useMemo(() => {
    const grouped = new Map<string, typeof filteredMessages>();
    filteredMessages.forEach((entry) => {
      const bucket = grouped.get(entry.threadId) ?? [];
      bucket.push(entry);
      grouped.set(entry.threadId, bucket);
    });

    return Array.from(grouped.entries())
      .map(([threadId, entries]) => {
        const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1]!;
        return {
          threadId,
          latest,
          messages: sorted,
          unreadCount: entries.filter((entry) => entry.mailbox === "inbox" && !entry.isRead).length
        };
      })
      .sort((a, b) => b.latest.date.localeCompare(a.latest.date));
  }, [filteredMessages]);
  const selectedMessage =
    filteredMessages.find((entry) => entry.id === selectedMessageId) ?? filteredMessages[0] ?? null;
  const selectedThreadId = selectedMessage?.threadId ?? threadSummaries[0]?.threadId ?? null;
  const selectedThread =
    threadSummaries.find((entry) => entry.threadId === selectedThreadId) ?? threadSummaries[0] ?? null;
  const selectedThreadMessages = selectedThread?.messages ?? [];

  useEffect(() => {
    if (!selectedThreadId || selectedMailbox !== "inbox") {
      return;
    }

    setState((current) => ({
      ...current,
      doctorMessages: current.doctorMessages.some(
        (entry) => entry.threadId === selectedThreadId && entry.mailbox === "inbox" && !entry.isRead
      )
        ? current.doctorMessages.map((entry) =>
            entry.threadId === selectedThreadId && entry.mailbox === "inbox" ? { ...entry, isRead: true } : entry
          )
        : current.doctorMessages
    }));
  }, [selectedMailbox, selectedThreadId]);

  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const records = parseCsvText(text);
      setState((current) => ({ ...current, labs: [...current.labs, ...records] }));
      setCsvStatus(`Imported ${records.length} lab results from ${file.name}.`);
    } catch (error) {
      setCsvStatus(error instanceof Error ? error.message : "Unable to read the CSV file.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleRecordUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    setRecordStatus("Processing uploaded files...");

    const newRecords = await Promise.all(
      files.map(async (file) => {
        const recordId = createId("record");
        const parsedRecord = await parseRecordFile(file);
        let storagePath: string | null = null;

        try {
          storagePath = await uploadPrivateRecordFile(currentUser.userId, recordId, file);
        } catch {
          storagePath = null;
        }

        return {
          id: recordId,
          name: file.name,
          category: parsedRecord.category,
          uploadedAt: new Date().toISOString().slice(0, 10),
          sizeLabel: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          extractedText: parsedRecord.extractedText,
          extractionStatus: storagePath
            ? parsedRecord.extractionStatus
            : `${parsedRecord.extractionStatus} | secure file upload needs attention`,
          storagePath
        };
      })
    );

    setState((current) => ({
      ...current,
      uploadedRecords: [...newRecords, ...current.uploadedRecords]
    }));
    const uploadedCount = newRecords.filter((record) => record.storagePath).length;
    setRecordStatus(
      `${uploadedCount} of ${files.length} file${files.length > 1 ? "s" : ""} uploaded to secure storage. Parsing and OCR results are ready below.`
    );
    event.target.value = "";
  }

  async function openSecureRecord(storagePath: string, recordId: string) {
    setOpeningRecordId(recordId);
    try {
      const signedUrl = await createSignedRecordUrl(storagePath);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningRecordId(null);
    }
  }

  async function openMessageAttachment(attachment: DoctorMessageAttachment) {
    setOpeningAttachmentId(attachment.id);
    try {
      const signedUrl = await createSignedRecordUrl(attachment.storagePath);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningAttachmentId(null);
    }
  }

  async function generateRecordSummary(recordId: string) {
    const record = state.uploadedRecords.find((entry) => entry.id === recordId);
    if (!record?.extractedText.trim()) {
      setAiStatus("That record does not have enough extracted text to summarize yet.");
      return;
    }

    setSummarizingRecordId(recordId);
    setAiStatus("Generating AI record summary...");

    try {
      const response = await fetch("/api/ai-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "record",
          title: record.name,
          content: record.extractedText
        })
      });

      const payload = (await response.json()) as { summary?: string; error?: string };
      if (!response.ok || !payload.summary) {
        throw new Error(payload.error ?? "The AI summary could not be generated.");
      }

      setState((current) => ({
        ...current,
        uploadedRecords: current.uploadedRecords.map((entry) =>
          entry.id === recordId
            ? {
                ...entry,
                aiSummary: payload.summary!,
                aiSummaryStatus: "ready",
                aiSummaryUpdatedAt: new Date().toISOString().slice(0, 10)
              }
            : entry
        )
      }));
      setAiStatus("AI record summary is ready.");
    } catch (error) {
      setState((current) => ({
        ...current,
        uploadedRecords: current.uploadedRecords.map((entry) =>
          entry.id === recordId
            ? {
                ...entry,
                aiSummaryStatus: "error"
              }
            : entry
        )
      }));
      setAiStatus(error instanceof Error ? error.message : "The AI summary could not be generated.");
    } finally {
      setSummarizingRecordId(null);
    }
  }

  async function generateAppointmentSummary(appointmentId: string) {
    const appointment = state.appointments.find((entry) => entry.id === appointmentId);
    if (!appointment) {
      return;
    }

    const content = [
      appointment.notes ? `Notes: ${appointment.notes}` : "",
      appointment.transcript ? `Transcript: ${appointment.transcript}` : "",
      appointment.followUp ? `Follow-up: ${appointment.followUp}` : ""
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!content.trim()) {
      setAiStatus("That appointment does not have enough detail to summarize yet.");
      return;
    }

    setSummarizingAppointmentId(appointmentId);
    setAiStatus("Generating AI appointment summary...");

    try {
      const response = await fetch("/api/ai-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "appointment",
          title: `${appointment.provider} on ${appointment.appointmentDate}`,
          content
        })
      });

      const payload = (await response.json()) as { summary?: string; error?: string };
      if (!response.ok || !payload.summary) {
        throw new Error(payload.error ?? "The AI summary could not be generated.");
      }

      setState((current) => ({
        ...current,
        appointments: current.appointments.map((entry) =>
          entry.id === appointmentId
            ? {
                ...entry,
                aiSummary: payload.summary!,
                aiSummaryStatus: "ready",
                aiSummaryUpdatedAt: new Date().toISOString().slice(0, 10)
              }
            : entry
        )
      }));
      setAiStatus("AI appointment summary is ready.");
    } catch (error) {
      setState((current) => ({
        ...current,
        appointments: current.appointments.map((entry) =>
          entry.id === appointmentId
            ? {
                ...entry,
                aiSummaryStatus: "error"
              }
            : entry
        )
      }));
      setAiStatus(error instanceof Error ? error.message : "The AI summary could not be generated.");
    } finally {
      setSummarizingAppointmentId(null);
    }
  }

  function handlePortalConnect(name: string) {
    setState((current) => {
      if (current.portals.some((portal) => portal.name.toLowerCase() === name.toLowerCase())) {
        return current;
      }

      return {
        ...current,
        portals: [
          {
            id: createId("portal"),
            name,
            status: "pending",
            lastSync: new Date().toISOString().slice(0, 10)
          },
          ...current.portals
        ]
      };
    });
    setPortalName("");
  }

  function handlePatientSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState((current) => ({
      ...current,
      patient: {
        fullName: String(form.get("fullName") ?? ""),
        birthDate: String(form.get("birthDate") ?? ""),
        careGoals: String(form.get("careGoals") ?? "")
      }
    }));
  }

  function handleLabSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!labForm.testName || !labForm.value || !labForm.unit || !labForm.date || !labForm.source) {
      return;
    }

    const record: LabRecord = {
      id: createId("lab"),
      testName: labForm.testName,
      value: Number(labForm.value),
      unit: labForm.unit,
      date: labForm.date,
      low: labForm.low ? Number(labForm.low) : null,
      high: labForm.high ? Number(labForm.high) : null,
      source: labForm.source
    };

    setState((current) => ({ ...current, labs: [...current.labs, record] }));
    setLabForm(emptyLabForm);
  }

  function handleAppointmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appointmentForm.appointmentDate || !appointmentForm.provider || !appointmentForm.notes) {
      return;
    }

      const appointment: AppointmentNote = {
        id: editingAppointmentId ?? createId("appt"),
        appointmentDate: appointmentForm.appointmentDate,
        appointmentTime: appointmentForm.appointmentTime,
        provider: appointmentForm.provider,
        specialty: appointmentForm.specialty || "General care",
        visitType: appointmentForm.visitType,
        location: appointmentForm.location,
        durationMinutes: appointmentForm.durationMinutes,
        notes: appointmentForm.notes,
        followUp: appointmentForm.followUp,
        transcript: appointmentForm.transcript
      };

    setState((current) => ({
      ...current,
      appointments: [appointment, ...current.appointments.filter((item) => item.id !== appointment.id)]
    }));
    setAppointmentForm(emptyAppointmentForm);
    setEditingAppointmentId(null);
    setRecordingStatus("Appointment saved.");
  }

  function handleCalendarAppointmentAdd(entry: {
    appointmentDate: string;
    appointmentTime: string;
    provider: string;
    specialty: string;
    visitType: string;
    location: string;
    durationMinutes: string;
    notes: string;
  }) {
    const appointment: AppointmentNote = {
      id: createId("appt"),
      appointmentDate: entry.appointmentDate,
      appointmentTime: entry.appointmentTime,
      provider: entry.provider,
      specialty: entry.specialty || "Scheduled visit",
      visitType: entry.visitType,
      location: entry.location,
      durationMinutes: entry.durationMinutes,
      notes: entry.notes || "Appointment added from calendar.",
      followUp: "",
      transcript: "",
      aiSummary: "",
      aiSummaryStatus: "idle",
      aiSummaryUpdatedAt: null
    };

    setState((current) => ({
      ...current,
      appointments: [appointment, ...current.appointments]
    }));
  }

  function handleBloodPressureSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bloodPressureForm.date || !bloodPressureForm.systolic || !bloodPressureForm.diastolic) {
      return;
    }

    const entry: BloodPressureEntry = {
      id: editingBloodPressureId ?? createId("bp"),
      date: bloodPressureForm.date,
      systolic: Number(bloodPressureForm.systolic),
      diastolic: Number(bloodPressureForm.diastolic),
      pulse: bloodPressureForm.pulse ? Number(bloodPressureForm.pulse) : null,
      notes: bloodPressureForm.notes
    };

    setState((current) => ({
      ...current,
      bloodPressureLogs: [entry, ...current.bloodPressureLogs.filter((item) => item.id !== entry.id)]
    }));
    setBloodPressureForm(emptyBloodPressureForm);
    setEditingBloodPressureId(null);
  }

  function handleCareChangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!careChangeForm.date || !careChangeForm.category || !careChangeForm.change) {
      return;
    }

    const change: CareChange = {
      id: editingCareChangeId ?? createId("change"),
      date: careChangeForm.date,
      category: careChangeForm.category,
      change: careChangeForm.change,
      effect: careChangeForm.effect
    };

    setState((current) => ({
      ...current,
      careChanges: [change, ...current.careChanges.filter((item) => item.id !== change.id)]
    }));
    setCareChangeForm(emptyCareChangeForm);
    setEditingCareChangeId(null);
  }

  function handleFamilyHistorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!familyHistoryForm.relation || !familyHistoryForm.condition) {
      return;
    }

    const entry: FamilyHistoryEntry = {
      id: editingFamilyHistoryId ?? createId("family"),
      relation: familyHistoryForm.relation,
      condition: familyHistoryForm.condition,
      ageOfOnset: familyHistoryForm.ageOfOnset,
      notes: familyHistoryForm.notes
    };

    setState((current) => ({
      ...current,
      familyHistory: [entry, ...current.familyHistory.filter((item) => item.id !== entry.id)]
    }));
    setFamilyHistoryForm(emptyFamilyHistoryForm);
    setEditingFamilyHistoryId(null);
  }

  function handleWeightSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!weightForm.date || !weightForm.weight) {
        return;
    }

    const entry: WeightEntry = {
      id: editingWeightId ?? createId("weight"),
      date: weightForm.date,
      weight: Number(weightForm.weight),
      unit: weightForm.unit,
      notes: weightForm.notes
    };

    setState((current) => ({
      ...current,
      weightLogs: [entry, ...current.weightLogs.filter((item) => item.id !== entry.id)]
    }));
      setWeightForm(emptyWeightForm);
      setEditingWeightId(null);
    }

    function handleSleepSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!sleepForm.date || !sleepForm.hoursSlept) {
        return;
      }

      const entry: SleepEntry = {
        id: editingSleepId ?? createId("sleep"),
        date: sleepForm.date,
        bedtime: sleepForm.bedtime,
        wakeTime: sleepForm.wakeTime,
        hoursSlept: Number(sleepForm.hoursSlept),
        quality: sleepForm.quality,
        notes: sleepForm.notes
      };

      setState((current) => ({
        ...current,
        sleepLogs: [entry, ...current.sleepLogs.filter((item) => item.id !== entry.id)]
      }));
      setSleepForm(emptySleepForm);
      setEditingSleepId(null);
    }

    function handleExerciseSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!exerciseForm.date || !exerciseForm.activityType || !exerciseForm.durationMinutes) {
        return;
      }

      const entry: ExerciseEntry = {
        id: editingExerciseId ?? createId("exercise"),
        date: exerciseForm.date,
        activityType: exerciseForm.activityType,
        durationMinutes: Number(exerciseForm.durationMinutes),
        intensity: exerciseForm.intensity,
        notes: exerciseForm.notes
      };

      setState((current) => ({
        ...current,
        exerciseLogs: [entry, ...current.exerciseLogs.filter((item) => item.id !== entry.id)]
      }));
      setExerciseForm(emptyExerciseForm);
      setEditingExerciseId(null);
    }

    function handleMoodSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!moodForm.date) {
        return;
      }

      const entry: MoodEntry = {
        id: editingMoodId ?? createId("mood"),
        date: moodForm.date,
        mood: moodForm.mood,
        stressLevel: moodForm.stressLevel,
        anxietyNotes: moodForm.anxietyNotes,
        whatHelped: moodForm.whatHelped,
        notes: moodForm.notes
      };

      setState((current) => ({
        ...current,
        moodLogs: [entry, ...current.moodLogs.filter((item) => item.id !== entry.id)]
      }));
      setMoodForm(emptyMoodForm);
      setEditingMoodId(null);
    }

    function handleGlucoseSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!glucoseForm.date || !glucoseForm.value) {
        return;
      }

      const entry: GlucoseEntry = {
        id: editingGlucoseId ?? createId("glucose"),
        date: glucoseForm.date,
        time: glucoseForm.time,
        value: Number(glucoseForm.value),
        unit: glucoseForm.unit,
        context: glucoseForm.context,
        notes: glucoseForm.notes
      };

      setState((current) => ({
        ...current,
        glucoseLogs: [entry, ...current.glucoseLogs.filter((item) => item.id !== entry.id)]
      }));
      setGlucoseForm(emptyGlucoseForm);
      setEditingGlucoseId(null);
    }

    function handleWaterIntakeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!waterIntakeForm.date || !waterIntakeForm.amount) {
      return;
    }

    const entry: WaterIntakeEntry = {
      id: editingWaterIntakeId ?? createId("water"),
      date: waterIntakeForm.date,
      amount: Number(waterIntakeForm.amount),
      unit: waterIntakeForm.unit,
      notes: waterIntakeForm.notes
    };

    setState((current) => ({
      ...current,
      waterIntakeLogs: [entry, ...current.waterIntakeLogs.filter((item) => item.id !== entry.id)]
    }));
    setWaterIntakeForm(emptyWaterIntakeForm);
    setEditingWaterIntakeId(null);
  }

  function handleHydrationGoalSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrationGoalForm.amount) {
      return;
    }

    setState((current) => ({
      ...current,
      hydrationGoal: {
        amount: Number(hydrationGoalForm.amount),
        unit: hydrationGoalForm.unit
      }
    }));
  }

  function handleMedicationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!medicationForm.name || !medicationForm.dose || !medicationForm.schedule) {
      return;
    }

      const entry: MedicationEntry = {
        id: editingMedicationId ?? createId("med"),
        name: medicationForm.name,
        dose: medicationForm.dose,
        schedule: medicationForm.schedule,
        startDate: medicationForm.startDate,
        purpose: medicationForm.purpose,
        prescriber: medicationForm.prescriber,
        status: medicationForm.status,
        reminderEnabled: medicationForm.reminderEnabled,
        reminderTime: medicationForm.reminderTime,
          refillDate: medicationForm.refillDate,
          lastTakenOn:
            editingMedicationId
              ? state.medications.find((item) => item.id === editingMedicationId)?.lastTakenOn ?? ""
              : "",
          responseStatus: medicationForm.responseStatus,
          sideEffects: medicationForm.sideEffects,
          responseNotes: medicationForm.responseNotes,
          lastReviewedOn: medicationForm.lastReviewedOn,
          notes: medicationForm.notes
        };

    setState((current) => ({
      ...current,
      medications: [entry, ...current.medications.filter((item) => item.id !== entry.id)]
    }));
    setMedicationForm(emptyMedicationForm);
    setEditingMedicationId(null);
  }

  function handleDietSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dietForm.date || !dietForm.mealType || !dietForm.summary) {
      return;
    }

    const entry: DietEntry = {
      id: editingDietId ?? createId("diet"),
      date: dietForm.date,
      mealType: dietForm.mealType,
      summary: dietForm.summary,
      notes: dietForm.notes
    };

    setState((current) => ({
      ...current,
      dietLogs: [entry, ...current.dietLogs.filter((item) => item.id !== entry.id)]
    }));
    setDietForm(emptyDietForm);
    setEditingDietId(null);
  }

  function handleDoctorQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!doctorQuestionForm.question) {
      return;
    }

    const entry: DoctorQuestionEntry = {
      id: editingDoctorQuestionId ?? createId("question"),
      date: doctorQuestionForm.date || todayIso,
      question: doctorQuestionForm.question,
      context: doctorQuestionForm.context,
      priority: doctorQuestionForm.priority,
      answered: doctorQuestionForm.answered
    };

    setState((current) => ({
      ...current,
      doctorQuestions: [entry, ...current.doctorQuestions.filter((item) => item.id !== entry.id)]
    }));
    setDoctorQuestionForm(emptyDoctorQuestionForm);
    setEditingDoctorQuestionId(null);
  }

  function saveSuggestedDoctorQuestion(entry: {
    question: string;
    context: string;
    priority: "routine" | "important";
  }) {
    const savedEntry: DoctorQuestionEntry = {
      id: createId("question"),
      date: todayIso,
      question: entry.question,
      context: entry.context,
      priority: entry.priority,
      answered: false
    };

    setState((current) => ({
      ...current,
      doctorQuestions: current.doctorQuestions.some(
        (item) => item.question.trim().toLowerCase() === entry.question.trim().toLowerCase()
      )
        ? current.doctorQuestions
        : [savedEntry, ...current.doctorQuestions]
    }));
  }

  function handleDoctorMessageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!doctorMessageForm.date || !doctorMessageForm.subject || !doctorMessageForm.message) {
      return;
    }

    const entry: DoctorMessage = {
      id: createId("message"),
      threadId: replyThreadId ?? createId("thread"),
      date: doctorMessageForm.date,
      to: doctorMessageForm.to,
      subject: doctorMessageForm.subject,
      message: doctorMessageForm.message,
      status: doctorMessageForm.status,
      mailbox: doctorMessageForm.status === "received" ? "inbox" : doctorMessageForm.status === "sent" ? "sent" : "drafts",
      from: doctorMessageForm.status === "received" ? "Dr. Patel" : currentUser.fullName,
      isRead: doctorMessageForm.status !== "received",
      priority: doctorMessageForm.priority,
      attachments: doctorMessageForm.attachments
    };

    setState((current) => ({
      ...current,
      doctorMessages: [entry, ...current.doctorMessages]
    }));
    setDoctorMessageForm(emptyDoctorMessageForm);
    setSelectedMailbox(entry.mailbox);
    setSelectedMessageId(entry.id);
    setReplyThreadId(null);
    setMessageAttachmentStatus("Message saved.");
  }

  function startReplyToThread() {
    if (!selectedThread) {
      return;
    }

    setReplyThreadId(selectedThread.threadId);
    setDoctorMessageForm((current) => ({
      ...current,
      to: selectedThread.latest.from === currentUser.fullName ? selectedThread.latest.to : selectedThread.latest.from,
      subject: selectedThread.latest.subject,
      status: "draft"
    }));
  }

  function cancelReplyThread() {
    setReplyThreadId(null);
    setDoctorMessageForm(emptyDoctorMessageForm);
  }

  async function handleMessageAttachmentUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    setMessageAttachmentStatus("Uploading secure message attachment...");

    try {
      const attachments = await Promise.all(
        files.map(async (file) => {
          const attachmentId = createId("attachment");
          const storagePath = await uploadPrivateMessageAttachment(currentUser.userId, attachmentId, file);
          return {
            id: attachmentId,
            name: file.name,
            sizeLabel: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
            storagePath
          } satisfies DoctorMessageAttachment;
        })
      );

      setDoctorMessageForm((current) => ({
        ...current,
        attachments: [...current.attachments, ...attachments]
      }));
      setMessageAttachmentStatus(`${attachments.length} attachment${attachments.length === 1 ? "" : "s"} ready to send.`);
    } catch (error) {
      setMessageAttachmentStatus(error instanceof Error ? error.message : "Attachment upload failed.");
    } finally {
      event.target.value = "";
    }
  }

  function removeDraftAttachment(attachmentId: string) {
    setDoctorMessageForm((current) => ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId)
    }));
  }

  function markThreadReadState(threadId: string, nextIsRead: boolean) {
    setState((current) => ({
      ...current,
      doctorMessages: current.doctorMessages.map((entry) =>
        entry.threadId === threadId && entry.mailbox === "inbox" ? { ...entry, isRead: nextIsRead } : entry
      )
    }));
  }

  function handleSymptomSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!symptomForm.symptom || !symptomForm.severity || !symptomForm.frequency) {
      return;
    }

    const symptom: SymptomEntry = {
      id: editingSymptomId ?? createId("symptom"),
      symptom: symptomForm.symptom,
      severity: symptomForm.severity,
      frequency: symptomForm.frequency,
      startedOn: symptomForm.startedOn,
      notes: symptomForm.notes
    };

    setState((current) => ({
      ...current,
      symptoms: [symptom, ...current.symptoms.filter((item) => item.id !== symptom.id)]
    }));
    setSymptomForm(emptySymptomForm);
    setEditingSymptomId(null);
  }

  function startAppointmentEdit(appointment: AppointmentNote) {
    setAppointmentForm({
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime ?? "",
      provider: appointment.provider,
      specialty: appointment.specialty,
      visitType: appointment.visitType ?? "",
      location: appointment.location ?? "",
      durationMinutes: appointment.durationMinutes ?? "",
      notes: appointment.notes,
      followUp: appointment.followUp,
      transcript: appointment.transcript
    });
    setEditingAppointmentId(appointment.id);
  }

  function startAppointmentRecording() {
    const speechWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechCtor;
      webkitSpeechRecognition?: BrowserSpeechCtor;
    };
    const SpeechCtor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechCtor) {
      setRecordingStatus("Live transcript recording is only available in supported browsers such as Chrome or Edge.");
      return;
    }

    recognitionRef.current?.stop();

    const recognition = new SpeechCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let transcriptChunk = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcriptChunk += event.results[index]?.[0]?.transcript ?? "";
      }

      setAppointmentForm((current) => ({
        ...current,
        transcript: `${current.transcript} ${transcriptChunk}`.trim()
      }));
    };
    recognition.onerror = (event) => {
      setRecordingStatus(`Transcript recorder error: ${event.error}.`);
      setIsRecordingAppointment(false);
    };
    recognition.onend = () => {
      setIsRecordingAppointment(false);
      setRecordingStatus("Transcript recorder stopped.");
    };
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecordingAppointment(true);
    setRecordingStatus("Recording transcript. Speak naturally and stop when the appointment is done.");
  }

  function stopAppointmentRecording() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecordingAppointment(false);
    setRecordingStatus("Transcript recorder stopped.");
  }

  function startCareChangeEdit(change: CareChange) {
    setCareChangeForm({
      date: change.date,
      category: change.category,
      change: change.change,
      effect: change.effect
    });
    setEditingCareChangeId(change.id);
  }

  function startBloodPressureEdit(entry: BloodPressureEntry) {
    setBloodPressureForm({
      date: entry.date,
      systolic: String(entry.systolic),
      diastolic: String(entry.diastolic),
      pulse: entry.pulse !== null ? String(entry.pulse) : "",
      notes: entry.notes
    });
    setEditingBloodPressureId(entry.id);
  }

  function startSymptomEdit(symptom: SymptomEntry) {
    setSymptomForm({
      symptom: symptom.symptom,
      severity: symptom.severity,
      frequency: symptom.frequency,
      startedOn: symptom.startedOn,
      notes: symptom.notes
    });
    setEditingSymptomId(symptom.id);
  }

  function startMedicationEdit(entry: MedicationEntry) {
      setMedicationForm({
        name: entry.name,
        dose: entry.dose,
        schedule: entry.schedule,
      startDate: entry.startDate,
      purpose: entry.purpose,
      prescriber: entry.prescriber,
      status: entry.status,
        reminderEnabled: entry.reminderEnabled ?? false,
        reminderTime: entry.reminderTime ?? "",
        refillDate: entry.refillDate ?? "",
        lastTakenOn: entry.lastTakenOn ?? "",
        responseStatus: entry.responseStatus ?? "neutral",
        sideEffects: entry.sideEffects ?? "",
        responseNotes: entry.responseNotes ?? "",
        lastReviewedOn: entry.lastReviewedOn ?? "",
        notes: entry.notes
      });
    setEditingMedicationId(entry.id);
  }

  function startFamilyHistoryEdit(entry: FamilyHistoryEntry) {
    setFamilyHistoryForm({
      relation: entry.relation,
      condition: entry.condition,
      ageOfOnset: entry.ageOfOnset,
      notes: entry.notes
    });
    setEditingFamilyHistoryId(entry.id);
  }

    function startWeightEdit(entry: WeightEntry) {
      setWeightForm({
        date: entry.date,
        weight: String(entry.weight),
        unit: entry.unit,
        notes: entry.notes
      });
      setEditingWeightId(entry.id);
    }

    function startSleepEdit(entry: SleepEntry) {
      setSleepForm({
        date: entry.date,
        bedtime: entry.bedtime,
        wakeTime: entry.wakeTime,
        hoursSlept: String(entry.hoursSlept),
        quality: entry.quality,
        notes: entry.notes
      });
      setEditingSleepId(entry.id);
    }

    function startExerciseEdit(entry: ExerciseEntry) {
      setExerciseForm({
        date: entry.date,
        activityType: entry.activityType,
        durationMinutes: String(entry.durationMinutes),
        intensity: entry.intensity,
        notes: entry.notes
      });
      setEditingExerciseId(entry.id);
    }

    function startMoodEdit(entry: MoodEntry) {
      setMoodForm({
        date: entry.date,
        mood: entry.mood,
        stressLevel: entry.stressLevel,
        anxietyNotes: entry.anxietyNotes,
        whatHelped: entry.whatHelped,
        notes: entry.notes
      });
      setEditingMoodId(entry.id);
    }

    function startGlucoseEdit(entry: GlucoseEntry) {
      setGlucoseForm({
        date: entry.date,
        time: entry.time,
        value: String(entry.value),
        unit: entry.unit,
        context: entry.context,
        notes: entry.notes
      });
      setEditingGlucoseId(entry.id);
    }

    function startWaterIntakeEdit(entry: WaterIntakeEntry) {
    setWaterIntakeForm({
      date: entry.date,
      amount: String(entry.amount),
      unit: entry.unit,
      notes: entry.notes
    });
    setEditingWaterIntakeId(entry.id);
  }

  function startDietEdit(entry: DietEntry) {
    setDietForm({
      date: entry.date,
      mealType: entry.mealType,
      summary: entry.summary,
      notes: entry.notes
    });
    setEditingDietId(entry.id);
  }

  function startDoctorQuestionEdit(entry: DoctorQuestionEntry) {
    setDoctorQuestionForm({
      date: entry.date,
      question: entry.question,
      context: entry.context,
      priority: entry.priority,
      answered: entry.answered
    });
    setEditingDoctorQuestionId(entry.id);
  }

  function markMedicationTaken(id: string) {
    setState((current) => ({
      ...current,
      medications: current.medications.map((item) =>
        item.id === id
          ? {
              ...item,
              lastTakenOn: todayIso
            }
          : item
      )
    }));
  }

  function clearMedicationTakenToday(id: string) {
    setState((current) => ({
      ...current,
      medications: current.medications.map((item) =>
        item.id === id
          ? {
              ...item,
              lastTakenOn: ""
            }
          : item
      )
    }));
  }

  function completeTodayPlanItem(id: string) {
    setState((current) => {
      const plan = current.dailyPlan.date === todayIso
        ? current.dailyPlan
        : { date: todayIso, completedTaskIds: [], dismissedTaskIds: [] };

      return {
        ...current,
        dailyPlan: {
          ...plan,
          completedTaskIds: plan.completedTaskIds.includes(id) ? plan.completedTaskIds : [...plan.completedTaskIds, id],
          dismissedTaskIds: plan.dismissedTaskIds.filter((item) => item !== id)
        }
      };
    });
  }

  function dismissTodayPlanItem(id: string) {
    setState((current) => {
      const plan = current.dailyPlan.date === todayIso
        ? current.dailyPlan
        : { date: todayIso, completedTaskIds: [], dismissedTaskIds: [] };

      return {
        ...current,
        dailyPlan: {
          ...plan,
          dismissedTaskIds: plan.dismissedTaskIds.includes(id) ? plan.dismissedTaskIds : [...plan.dismissedTaskIds, id],
          completedTaskIds: plan.completedTaskIds.filter((item) => item !== id)
        }
      };
    });
  }

  function resetTodayPlan() {
    setState((current) => ({
      ...current,
      dailyPlan: {
        date: todayIso,
        completedTaskIds: [],
        dismissedTaskIds: []
      }
    }));
  }

  function toggleVisitPrepItem(id: string) {
    setState((current) => {
      const checklist =
        current.visitPrepChecklist.date === todayIso
          ? current.visitPrepChecklist
          : { date: todayIso, completedItemIds: [] };
      const completedItemIds = checklist.completedItemIds.includes(id)
        ? checklist.completedItemIds.filter((itemId) => itemId !== id)
        : [...checklist.completedItemIds, id];

      return {
        ...current,
        visitPrepChecklist: {
          date: todayIso,
          completedItemIds
        }
      };
    });
  }

  function resetVisitPrepChecklist() {
    setState((current) => ({
      ...current,
      visitPrepChecklist: {
        date: todayIso,
        completedItemIds: []
      }
    }));
  }

  function handleRoutineSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!routineForm.title) {
      return;
    }

    const entry: RoutineEntry = {
      id: editingRoutineId ?? createId("routine"),
      title: routineForm.title,
      scheduleLabel: routineForm.scheduleLabel,
      timeOfDay: routineForm.timeOfDay,
      notes: routineForm.notes,
      lastCompletedOn:
        editingRoutineId
          ? state.routines.find((item) => item.id === editingRoutineId)?.lastCompletedOn ?? ""
          : ""
    };

    setState((current) => ({
      ...current,
      routines: [entry, ...current.routines.filter((item) => item.id !== entry.id)]
    }));
    setRoutineForm(emptyRoutineForm);
    setEditingRoutineId(null);
  }

  function startRoutineEdit(entry: RoutineEntry) {
    setRoutineForm({
      title: entry.title,
      scheduleLabel: entry.scheduleLabel,
      timeOfDay: entry.timeOfDay,
      notes: entry.notes
    });
    setEditingRoutineId(entry.id);
  }

  function markRoutineComplete(id: string) {
    setState((current) => ({
      ...current,
      routines: current.routines.map((item) =>
        item.id === id
          ? {
              ...item,
              lastCompletedOn: todayIso
            }
          : item
      )
    }));
  }

  function resetRoutineToday(id: string) {
    setState((current) => ({
      ...current,
      routines: current.routines.map((item) =>
        item.id === id
          ? {
              ...item,
              lastCompletedOn: ""
            }
          : item
      )
    }));
  }

  function deleteRoutine(id: string) {
    setState((current) => ({
      ...current,
      routines: current.routines.filter((item) => item.id !== id)
    }));
    if (editingRoutineId === id) {
      setRoutineForm(emptyRoutineForm);
      setEditingRoutineId(null);
    }
  }

  function handleWeeklyGoalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!weeklyGoalForm.title || !weeklyGoalForm.targetCount) {
      return;
    }

    const entry: WeeklyGoal = {
      id: editingWeeklyGoalId ?? createId("goal"),
      title: weeklyGoalForm.title,
      targetCount: Number(weeklyGoalForm.targetCount),
      progressCount:
        editingWeeklyGoalId
          ? state.weeklyGoals.find((item) => item.id === editingWeeklyGoalId)?.progressCount ?? 0
          : 0,
      notes: weeklyGoalForm.notes
    };

    setState((current) => ({
      ...current,
      weeklyGoals: [entry, ...current.weeklyGoals.filter((item) => item.id !== entry.id)]
    }));
    setWeeklyGoalForm(emptyWeeklyGoalForm);
    setEditingWeeklyGoalId(null);
  }

  function startWeeklyGoalEdit(entry: WeeklyGoal) {
    setWeeklyGoalForm({
      title: entry.title,
      targetCount: String(entry.targetCount),
      notes: entry.notes
    });
    setEditingWeeklyGoalId(entry.id);
  }

  function incrementWeeklyGoal(id: string) {
    setState((current) => ({
      ...current,
      weeklyGoals: current.weeklyGoals.map((item) =>
        item.id === id
          ? {
              ...item,
              progressCount: Math.min(item.progressCount + 1, item.targetCount)
            }
          : item
      )
    }));
  }

  function decrementWeeklyGoal(id: string) {
    setState((current) => ({
      ...current,
      weeklyGoals: current.weeklyGoals.map((item) =>
        item.id === id
          ? {
              ...item,
              progressCount: Math.max(item.progressCount - 1, 0)
            }
          : item
      )
    }));
  }

  function deleteWeeklyGoal(id: string) {
    setState((current) => ({
      ...current,
      weeklyGoals: current.weeklyGoals.filter((item) => item.id !== id)
    }));
    if (editingWeeklyGoalId === id) {
      setWeeklyGoalForm(emptyWeeklyGoalForm);
      setEditingWeeklyGoalId(null);
    }
  }

  function resetWeeklyGoalsForCurrentWeek() {
    setState((current) => ({
      ...current,
      weeklyGoals: current.weeklyGoals.map((item) => ({
        ...item,
        progressCount: 0
      })),
      weeklyGoalsWeekOf: currentWeekStartIso
    }));
  }

  function deleteAppointment(id: string) {
    setState((current) => ({
      ...current,
      appointments: current.appointments.filter((item) => item.id !== id)
    }));
    if (editingAppointmentId === id) {
      setAppointmentForm(emptyAppointmentForm);
      setEditingAppointmentId(null);
    }
  }

  function deleteCareChange(id: string) {
    setState((current) => ({
      ...current,
      careChanges: current.careChanges.filter((item) => item.id !== id)
    }));
    if (editingCareChangeId === id) {
      setCareChangeForm(emptyCareChangeForm);
      setEditingCareChangeId(null);
    }
  }

  function deleteBloodPressure(id: string) {
    setState((current) => ({
      ...current,
      bloodPressureLogs: current.bloodPressureLogs.filter((item) => item.id !== id)
    }));
    if (editingBloodPressureId === id) {
      setBloodPressureForm(emptyBloodPressureForm);
      setEditingBloodPressureId(null);
    }
  }

  function deleteSymptom(id: string) {
    setState((current) => ({
      ...current,
      symptoms: current.symptoms.filter((item) => item.id !== id)
    }));
    if (editingSymptomId === id) {
      setSymptomForm(emptySymptomForm);
      setEditingSymptomId(null);
    }
  }

  function deleteMedication(id: string) {
    setState((current) => ({
      ...current,
      medications: current.medications.filter((item) => item.id !== id)
    }));
    if (editingMedicationId === id) {
      setMedicationForm(emptyMedicationForm);
      setEditingMedicationId(null);
    }
  }

  function deleteFamilyHistory(id: string) {
    setState((current) => ({
      ...current,
      familyHistory: current.familyHistory.filter((item) => item.id !== id)
    }));
    if (editingFamilyHistoryId === id) {
      setFamilyHistoryForm(emptyFamilyHistoryForm);
      setEditingFamilyHistoryId(null);
    }
  }

  function deleteWeight(id: string) {
      setState((current) => ({
        ...current,
        weightLogs: current.weightLogs.filter((item) => item.id !== id)
      }));
      if (editingWeightId === id) {
        setWeightForm(emptyWeightForm);
        setEditingWeightId(null);
      }
    }

    function deleteSleep(id: string) {
      setState((current) => ({
        ...current,
        sleepLogs: current.sleepLogs.filter((item) => item.id !== id)
      }));
      if (editingSleepId === id) {
        setSleepForm(emptySleepForm);
        setEditingSleepId(null);
      }
    }

    function deleteExercise(id: string) {
      setState((current) => ({
        ...current,
        exerciseLogs: current.exerciseLogs.filter((item) => item.id !== id)
      }));
      if (editingExerciseId === id) {
        setExerciseForm(emptyExerciseForm);
        setEditingExerciseId(null);
      }
    }

    function deleteMood(id: string) {
      setState((current) => ({
        ...current,
        moodLogs: current.moodLogs.filter((item) => item.id !== id)
      }));
      if (editingMoodId === id) {
        setMoodForm(emptyMoodForm);
        setEditingMoodId(null);
      }
    }

    function deleteGlucose(id: string) {
      setState((current) => ({
        ...current,
        glucoseLogs: current.glucoseLogs.filter((item) => item.id !== id)
      }));
      if (editingGlucoseId === id) {
        setGlucoseForm(emptyGlucoseForm);
        setEditingGlucoseId(null);
      }
    }

    function deleteWaterIntake(id: string) {
    setState((current) => ({
      ...current,
      waterIntakeLogs: current.waterIntakeLogs.filter((item) => item.id !== id)
    }));
    if (editingWaterIntakeId === id) {
      setWaterIntakeForm(emptyWaterIntakeForm);
      setEditingWaterIntakeId(null);
    }
  }

  function deleteDiet(id: string) {
    setState((current) => ({
      ...current,
      dietLogs: current.dietLogs.filter((item) => item.id !== id)
    }));
    if (editingDietId === id) {
      setDietForm(emptyDietForm);
      setEditingDietId(null);
    }
  }

  function toggleDoctorQuestionAnswered(id: string) {
    setState((current) => ({
      ...current,
      doctorQuestions: current.doctorQuestions.map((item) =>
        item.id === id ? { ...item, answered: !item.answered } : item
      )
    }));
  }

  function deleteDoctorQuestion(id: string) {
    setState((current) => ({
      ...current,
      doctorQuestions: current.doctorQuestions.filter((item) => item.id !== id)
    }));
    if (editingDoctorQuestionId === id) {
      setDoctorQuestionForm(emptyDoctorQuestionForm);
      setEditingDoctorQuestionId(null);
    }
  }

  function resetDemo() {
    setState(normalizeAppState(starterState));
    setCsvStatus("Demo data restored.");
    setRecordStatus("Demo records restored and ready to sync.");
  }

  function handlePrintVisitSummary() {
    window.print();
  }

  return (
    <main className="min-h-screen px-4 py-8 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="panel overflow-hidden rounded-[2rem]">
          <div className="space-y-4 px-5 py-5 lg:px-7 lg:py-6">
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.6rem] bg-canvas p-5">
                <div className="space-y-4">
                <div className="inline-flex items-center rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
                  Signed-in patient dashboard
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-[2.5rem]">
                    Care, appointments, planning, and records in one view.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-slate">
                    Start with what matters today, then jump into messages, medications, visits, and trends without extra scrolling.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a href="#workspace" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
                    Open workspace
                  </a>
                  <a
                    href="#messages"
                    className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent"
                  >
                    Open messages
                  </a>
                  <button
                    type="button"
                    onClick={handlePrintVisitSummary}
                    className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent print-hide"
                  >
                    Print visit summary
                  </button>
                  <button
                    type="button"
                    onClick={resetDemo}
                    className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent"
                  >
                    Reset demo data
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent"
                  >
                    Sign out
                  </button>
                </div>
              </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.35rem] bg-canvas p-4">
                  <p className="text-sm text-slate">Signed in as</p>
                  <p className="mt-2 text-lg font-semibold">{currentUser.fullName}</p>
                  <p className="mt-1 text-sm text-slate">{currentUser.email}</p>
                </div>
                <div className="rounded-[1.35rem] bg-canvas p-4">
                  <p className="text-sm text-slate">Cloud sync</p>
                  <p className="mt-2 text-sm leading-6 text-slate">{syncStatus}</p>
                </div>
                <div className="rounded-[1.35rem] bg-canvas p-4">
                  <p className="text-sm text-slate">Today&apos;s focus</p>
                  <p className="mt-2 text-lg font-semibold">{finalVisibleTodayPlan.length} active task{finalVisibleTodayPlan.length === 1 ? "" : "s"}</p>
                  <p className="mt-1 text-sm text-slate">
                    {upcomingAppointment
                      ? `Next visit: ${upcomingAppointment.provider} on ${formatDateLabel(upcomingAppointment.appointmentDate)}`
                      : "No upcoming appointment scheduled yet."}
                  </p>
                </div>
                <div className="rounded-[1.35rem] bg-canvas p-4">
                  <p className="text-sm text-slate">Care goals</p>
                  <p className="mt-2 text-sm leading-6 text-slate">
                    {state.patient.careGoals || "Add care goals like medication follow-up, thyroid labs, or blood pressure tracking."}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {dashboardHighlights.map((item) => (
                <div key={item.label} className="rounded-[1.2rem] bg-canvas p-4">
                  <p className="text-sm text-slate">{item.label}</p>
                  <p className="mt-2 text-xl font-semibold">{item.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate">{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="rounded-[1.5rem] bg-canvas p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate">Pre-visit prep checklist</p>
                  <h2 className="mt-2 text-2xl font-semibold">What to review before the next appointment</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                    {visitPrepChecklistState.completedItemIds.length}/{visitPrepChecklist.length || 0} done
                  </span>
                  {visitPrepChecklist.length ? (
                    <button
                      type="button"
                      onClick={resetVisitPrepChecklist}
                      className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                {visitPrepChecklist.length ? (
                  visitPrepChecklist.map((item) => {
                    const completed = visitPrepChecklistState.completedItemIds.includes(item.id);
                    return (
                      <div key={item.id} className="rounded-[1rem] bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{item.title}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${completed ? "bg-emerald-100 text-emerald-700" : "bg-canvas text-slate"}`}>
                            {completed ? "Done" : "Prep"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate">{item.detail}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a
                            href={item.href}
                            className="rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 hover:text-orange-800"
                          >
                            Open section
                          </a>
                          <button
                            type="button"
                            onClick={() => toggleVisitPrepItem(item.id)}
                            className={`rounded-full px-3 py-2 text-xs font-semibold ${completed ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-accent text-white"}`}
                          >
                            {completed ? "Mark open" : "Mark done"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[1rem] bg-white p-4 text-sm leading-6 text-slate xl:col-span-3">
                    Prep items will show up here when there is an upcoming appointment or enough recent context to review before a visit.
                  </div>
                )}
              </div>
            </div>
              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[1.5rem] bg-canvas p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-slate">Today&apos;s plan</p>
                      <h2 className="mt-2 text-2xl font-semibold">Next best things to tackle</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                        {finalVisibleTodayPlan.length} task{finalVisibleTodayPlan.length === 1 ? "" : "s"}
                      </span>
                      {(planStateForToday.completedTaskIds.length || planStateForToday.dismissedTaskIds.length) ? (
                        <button
                          type="button"
                          onClick={resetTodayPlan}
                          className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
                        >
                          Reset today
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {finalVisibleTodayPlan.length ? (
                      finalVisibleTodayPlan.map((item) => (
                        <div key={item.id} className="rounded-[1rem] bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">{item.title}</p>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                item.tone === "alert"
                                  ? "bg-rose/10 text-rose"
                                  : item.tone === "watch"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {item.tone === "alert" ? "Priority" : item.tone === "watch" ? "Today" : "Ready"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate">{item.detail}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <a
                              href={item.href}
                              className="rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 hover:text-orange-800"
                            >
                              Open section
                            </a>
                            <button
                              type="button"
                              onClick={() => completeTodayPlanItem(item.id)}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => dismissTodayPlanItem(item.id)}
                              className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-slate"
                            >
                              Dismiss today
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1rem] bg-white p-4 text-sm leading-7 text-slate">
                        No major tasks are showing right now. The dashboard will add today&apos;s plan items as new reminders, visits, messages, and labs come in.
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                  {priorityCards.map((card) => (
                    <div key={card.title} className="rounded-[1.5rem] bg-white p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm uppercase tracking-[0.18em] text-slate">{card.title}</p>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            card.tone === "alert"
                              ? "bg-rose/10 text-rose"
                              : card.tone === "watch"
                                ? "bg-amber-100 text-amber-700"
                                : card.tone === "info"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-canvas text-slate"
                          }`}
                        >
                          {card.tone === "alert" ? "High" : card.tone === "watch" ? "Active" : card.tone === "info" ? "Planned" : "Quiet"}
                        </span>
                      </div>
                      <p className="mt-3 text-2xl font-semibold">{card.value}</p>
                      <p className="mt-2 text-sm leading-6 text-slate">{card.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div id="planning" className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[1.5rem] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-slate">Recurring routines</p>
                      <h2 className="mt-2 text-2xl font-semibold">Build habits into the care plan</h2>
                    </div>
                    <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-slate">
                      {completedTodayRoutines.length}/{state.routines.length} today
                    </span>
                  </div>
                  <form className="mt-4 grid gap-3" onSubmit={handleRoutineSubmit}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={routineForm.title}
                        onChange={(event) => setRoutineForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Routine name"
                        className="rounded-[1rem] border border-ink/10 bg-canvas px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={routineForm.scheduleLabel}
                        onChange={(event) => setRoutineForm((current) => ({ ...current, scheduleLabel: event.target.value }))}
                        placeholder="Schedule, like Daily or Weekdays"
                        className="rounded-[1rem] border border-ink/10 bg-canvas px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={routineForm.timeOfDay}
                        onChange={(event) => setRoutineForm((current) => ({ ...current, timeOfDay: event.target.value }))}
                        placeholder="Time of day, like Morning"
                        className="rounded-[1rem] border border-ink/10 bg-canvas px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={routineForm.notes}
                        onChange={(event) => setRoutineForm((current) => ({ ...current, notes: event.target.value }))}
                        placeholder="Optional note"
                        className="rounded-[1rem] border border-ink/10 bg-canvas px-4 py-3 outline-none focus:border-accent"
                      />
                    </div>
                    <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                      {editingRoutineId ? "Update routine" : "Save routine"}
                    </button>
                    {editingRoutineId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRoutineForm(emptyRoutineForm);
                          setEditingRoutineId(null);
                        }}
                        className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </form>
                  <div className="mt-4 space-y-3">
                    {state.routines.map((routine) => (
                      <div key={routine.id} className="rounded-[1rem] bg-canvas p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{routine.title}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${routine.lastCompletedOn === todayIso ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {routine.lastCompletedOn === todayIso ? "Done today" : "Still open"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate">
                          {routine.scheduleLabel}{routine.timeOfDay ? ` | ${routine.timeOfDay}` : ""}
                        </p>
                        {routine.notes ? <p className="mt-2 text-sm text-slate">{routine.notes}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {routine.lastCompletedOn === todayIso ? (
                            <button
                              type="button"
                              onClick={() => resetRoutineToday(routine.id)}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                            >
                              Undo today
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => markRoutineComplete(routine.id)}
                              className="rounded-full border border-emerald-200 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                            >
                              Complete today
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startRoutineEdit(routine)}
                            className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRoutine(routine.id)}
                            className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[1.5rem] bg-canvas p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-slate">Weekly goals</p>
                      <h2 className="mt-2 text-2xl font-semibold">Track progress across the week</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                        {state.weeklyGoals.filter((goal) => goal.progressCount >= goal.targetCount).length}/{state.weeklyGoals.length} on track
                      </span>
                      <button
                        type="button"
                        onClick={resetWeeklyGoalsForCurrentWeek}
                        className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
                      >
                        {weeklyGoalsNeedReset ? "Start new week" : "Reset week"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[1rem] bg-white p-3 text-sm text-slate">
                    <p>
                      Tracking week of {formatDateLabel(state.weeklyGoalsWeekOf || currentWeekStartIso)}.
                      {weeklyGoalsNeedReset ? " A new week has started, so you can reset goal progress when you are ready." : " Goal progress is currently tied to this week."}
                    </p>
                  </div>
                  <form className="mt-4 grid gap-3" onSubmit={handleWeeklyGoalSubmit}>
                    <input
                      value={weeklyGoalForm.title}
                      onChange={(event) => setWeeklyGoalForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Weekly goal"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={weeklyGoalForm.targetCount}
                      onChange={(event) => setWeeklyGoalForm((current) => ({ ...current, targetCount: event.target.value }))}
                      placeholder="Target count"
                      inputMode="numeric"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={weeklyGoalForm.notes}
                      onChange={(event) => setWeeklyGoalForm((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Optional note"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                      {editingWeeklyGoalId ? "Update goal" : "Save weekly goal"}
                    </button>
                    {editingWeeklyGoalId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setWeeklyGoalForm(emptyWeeklyGoalForm);
                          setEditingWeeklyGoalId(null);
                        }}
                        className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </form>
                  <div className="mt-4 space-y-3">
                    {state.weeklyGoals.map((goal) => (
                      <div key={goal.id} className="rounded-[1rem] bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{goal.title}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${goal.progressCount >= goal.targetCount ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                            {goal.progressCount}/{goal.targetCount}
                          </span>
                        </div>
                        <div className="mt-3">
                          <div className="h-2 overflow-hidden rounded-full bg-canvas">
                            <div
                              className={`h-full rounded-full transition-[width] duration-300 ${
                                goal.progressCount >= goal.targetCount ? "bg-emerald-500" : "bg-sky-500"
                              }`}
                              style={{ width: `${Math.min((goal.progressCount / Math.max(goal.targetCount, 1)) * 100, 100)}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate">
                            {goal.progressCount >= goal.targetCount
                              ? "Goal reached this week"
                              : `${Math.max(goal.targetCount - goal.progressCount, 0)} step${goal.targetCount - goal.progressCount === 1 ? "" : "s"} to go`}
                          </p>
                        </div>
                        {goal.notes ? <p className="mt-2 text-sm text-slate">{goal.notes}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => incrementWeeklyGoal(goal.id)}
                            className="rounded-full border border-sky-200 bg-sky-600 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Add progress
                          </button>
                          <button
                            type="button"
                            onClick={() => decrementWeeklyGoal(goal.id)}
                            className="rounded-full border border-ink/10 bg-canvas px-3 py-2 text-xs font-semibold text-ink"
                          >
                            Remove progress
                          </button>
                          <button
                            type="button"
                            onClick={() => startWeeklyGoalEdit(goal)}
                            className="rounded-full border border-ink/10 bg-canvas px-3 py-2 text-xs font-semibold text-ink"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteWeeklyGoal(goal.id)}
                            className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[1.5rem] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-slate">What needs attention today</p>
                      <h2 className="mt-2 text-2xl font-semibold">The highest-signal items from your record</h2>
                    </div>
                    <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-slate">
                      {attentionItems.length} item{attentionItems.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {attentionItems.length ? (
                      attentionItems.map((item) => (
                        <div key={item.title} className="rounded-[1rem] bg-canvas p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">{item.title}</p>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                item.tone === "alert"
                                  ? "bg-rose/10 text-rose"
                                  : item.tone === "watch"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {item.tone === "alert" ? "Act soon" : item.tone === "watch" ? "Watch" : "On track"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-7 text-slate">{item.body}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1rem] bg-canvas p-4 text-sm leading-7 text-slate">
                        No urgent issues are showing right now. Keep logging visits, messages, medications, and symptoms so this dashboard stays useful.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.5rem] bg-canvas p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm uppercase tracking-[0.18em] text-slate">Suggested questions</p>
                      <a
                        href="#doctor-questions"
                        className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 hover:text-orange-800"
                      >
                        Open section
                      </a>
                    </div>
                    <div className="mt-4 space-y-3">
                      {suggestedDoctorQuestions.length ? (
                        suggestedDoctorQuestions.slice(0, 2).map((entry) => (
                          <div key={entry.id} className="rounded-[1rem] bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold">{entry.question}</p>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.priority === "important" ? "bg-rose/10 text-rose" : "bg-amber-100 text-amber-700"}`}>
                                {entry.priority === "important" ? "Important" : "Routine"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate">{entry.context}</p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[1rem] bg-white p-4 text-sm leading-6 text-slate">
                          Suggested questions will appear here as labs, symptoms, follow-up notes, and medications create useful talking points.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] bg-canvas p-5">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate">Alerts snapshot</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      {dashboardAlerts.map((alert) => (
                        <a key={alert.label} href={alert.href} className="rounded-[1rem] bg-white p-4 transition hover:border-accent hover:shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">{alert.label}</p>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                alert.tone === "alert"
                                  ? "bg-rose/10 text-rose"
                                  : alert.tone === "watch"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {alert.value}
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {stats.map((card) => (
            <article key={card.label} className="panel rounded-[1.5rem] p-5">
              <p className="text-sm text-slate">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold">{card.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate">{card.detail}</p>
            </article>
          ))}
        </section>

        <section id="visit-summary" className="print-visit-summary panel rounded-[1.75rem] p-6 lg:p-8" hidden={!isSectionVisible("visitSummary")}>
          <div className="packet-screen-only">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate">Doctor-ready summary packet</p>
                <h2 className="mt-2 text-2xl font-semibold">Bring the most important context into one appointment packet</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate">
                Use this before an appointment to review the latest symptoms, medications, lab flags, questions, checklist items, and follow-up details in one place.
                </p>
              </div>
              <div className="print-hide space-y-3">
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintPacketMode("doctor")}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      printPacketMode === "doctor"
                        ? "bg-accent text-white"
                        : "border border-ink/10 bg-white text-slate hover:border-accent hover:text-accent"
                    }`}
                  >
                    Doctor handout
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintPacketMode("patient")}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      printPacketMode === "patient"
                        ? "bg-accent text-white"
                        : "border border-ink/10 bg-white text-slate hover:border-accent hover:text-accent"
                    }`}
                  >
                    Patient-friendly
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handlePrintVisitSummary}
                  className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
                >
                Print packet
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.25rem] bg-canvas p-4">
              <p className="text-sm text-slate">Upcoming visit</p>
              <p className="mt-2 text-lg font-semibold">
                {upcomingAppointment ? formatDateLabel(upcomingAppointment.appointmentDate) : "Not scheduled"}
              </p>
              <p className="mt-1 text-sm text-slate">
                {upcomingAppointment
                  ? `${upcomingAppointment.provider}${upcomingAppointment.appointmentTime ? ` at ${formatTimeLabel(upcomingAppointment.appointmentTime)}` : ""}`
                  : "Add an appointment to build a visit packet around it."}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-canvas p-4">
              <p className="text-sm text-slate">Open questions</p>
              <p className="mt-2 text-lg font-semibold">
                {state.doctorQuestions.filter((entry) => !entry.answered).length}
              </p>
              <p className="mt-1 text-sm text-slate">
                {suggestedDoctorQuestions.length} suggested prompt{suggestedDoctorQuestions.length === 1 ? "" : "s"} available
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-canvas p-4">
              <p className="text-sm text-slate">Prep progress</p>
              <p className="mt-2 text-lg font-semibold">
                {visitPrepChecklistState.completedItemIds.length}/{visitPrepChecklist.length || 0}
              </p>
              <p className="mt-1 text-sm text-slate">
                {openVisitPrepCount ? `${openVisitPrepCount} prep item${openVisitPrepCount === 1 ? "" : "s"} still open` : "Prep checklist is complete"}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-canvas p-4">
              <p className="text-sm text-slate">Flagged labs</p>
              <p className="mt-2 text-lg font-semibold">{flaggedLabs.length}</p>
              <p className="mt-1 text-sm text-slate">
                {flaggedLabs.length ? "Worth bringing into the conversation" : "No out-of-range labs are flagged right now"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.25rem] bg-canvas p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-slate">Patient snapshot</p>
              <div className="mt-3 space-y-2 text-sm leading-7 text-slate">
                <p><span className="font-semibold text-ink">Name:</span> {state.patient.fullName || "Not added yet"}</p>
                <p><span className="font-semibold text-ink">Birth date:</span> {state.patient.birthDate ? formatDateLabel(state.patient.birthDate) : "Not added yet"}</p>
                <p><span className="font-semibold text-ink">Care goals:</span> {state.patient.careGoals || "No care goals added yet."}</p>
              </div>
            </div>
            <div className="rounded-[1.25rem] bg-canvas p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-slate">Visit timing</p>
              <div className="mt-3 space-y-2 text-sm leading-7 text-slate">
                <p>
                  <span className="font-semibold text-ink">Next appointment:</span>{" "}
                  {upcomingAppointment
                    ? `${upcomingAppointment.provider} on ${formatDateLabel(upcomingAppointment.appointmentDate)}${upcomingAppointment.appointmentTime ? ` at ${formatTimeLabel(upcomingAppointment.appointmentTime)}` : ""}`
                    : "No upcoming appointment scheduled."}
                </p>
                <p>
                  <span className="font-semibold text-ink">Most recent appointment:</span>{" "}
                  {latestAppointment
                    ? `${latestAppointment.provider} on ${formatDateLabel(latestAppointment.appointmentDate)}`
                    : "No appointment notes saved yet."}
                </p>
                <p>
                  <span className="font-semibold text-ink">Latest doctor message:</span>{" "}
                  {latestDoctorMessage
                    ? `${latestDoctorMessage.subject} on ${formatDateLabel(latestDoctorMessage.date)}`
                    : "No doctor messages yet."}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[1.25rem] bg-white p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-slate">Symptoms to mention</p>
              <div className="mt-3 space-y-3">
                {state.symptoms.length ? (
                  [...state.symptoms]
                    .sort((a, b) => (b.startedOn || "").localeCompare(a.startedOn || ""))
                    .slice(0, 4)
                    .map((symptom) => (
                      <div key={symptom.id} className="rounded-[1rem] bg-canvas p-3 text-sm leading-6 text-slate">
                        <p className="font-semibold text-ink">{symptom.symptom}</p>
                        <p>{symptom.severity} severity, {symptom.frequency || "frequency not added"}</p>
                        {symptom.notes ? <p>{symptom.notes}</p> : null}
                      </div>
                    ))
                ) : (
                  <p className="text-sm leading-6 text-slate">No symptoms have been logged yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-[1.25rem] bg-white p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-slate">Current medications</p>
              <div className="mt-3 space-y-3">
                {state.medications.length ? (
                  activeMedications.slice(0, 4).map((medication) => (
                    <div key={medication.id} className="rounded-[1rem] bg-canvas p-3 text-sm leading-6 text-slate">
                      <p className="font-semibold text-ink">{medication.name}</p>
                      <p>{medication.dose || "Dose not added"}{medication.schedule ? ` | ${medication.schedule}` : ""}</p>
                      <p>{medication.purpose || "Purpose not added"}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate">No medications have been added yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-[1.25rem] bg-white p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-slate">Recent health measures</p>
              <div className="mt-3 space-y-3">
                <div className="rounded-[1rem] bg-canvas p-3 text-sm leading-6 text-slate">
                  <p className="font-semibold text-ink">Blood pressure</p>
                  <p>
                    {latestBloodPressure
                      ? `${latestBloodPressure.systolic}/${latestBloodPressure.diastolic}${latestBloodPressure.pulse !== null ? `, pulse ${latestBloodPressure.pulse}` : ""} on ${formatDateLabel(latestBloodPressure.date)}`
                      : "No blood pressure log yet."}
                  </p>
                </div>
                <div className="rounded-[1rem] bg-canvas p-3 text-sm leading-6 text-slate">
                  <p className="font-semibold text-ink">Weight</p>
                  <p>
                    {latestWeight
                      ? `${latestWeight.weight} ${latestWeight.unit} on ${formatDateLabel(latestWeight.date)}`
                      : "No weight log yet."}
                  </p>
                </div>
                <div className="rounded-[1rem] bg-canvas p-3 text-sm leading-6 text-slate">
                  <p className="font-semibold text-ink">Hydration</p>
                  <p>
                    {latestWaterForToday
                      ? `${latestWaterForToday.amount} ${latestWaterForToday.unit} logged for ${formatDateLabel(latestWaterForToday.date)}`
                      : "No water intake logged yet."}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] bg-white p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-slate">Lab results to discuss</p>
              <div className="mt-3 space-y-3">
                {flaggedLabs.length ? (
                  flaggedLabs.slice(0, 4).map((lab) => (
                    <div key={lab.id} className="rounded-[1rem] bg-canvas p-3 text-sm leading-6 text-slate">
                      <p className="font-semibold text-ink">{lab.testName}</p>
                      <p>
                        {lab.value} {lab.unit} on {formatDateLabel(lab.date)}
                      </p>
                      <p>
                        Expected range: {lab.low ?? "?"} - {lab.high ?? "?"} {lab.unit}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate">No out-of-range labs are flagged right now.</p>
                )}
              </div>
            </div>

            <div className="rounded-[1.25rem] bg-white p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-slate">Quick status notes</p>
              <div className="mt-3 space-y-2 text-sm leading-7 text-slate">
                <p><span className="font-semibold text-ink">Appointment summary:</span> {appointmentSummary}</p>
                <p><span className="font-semibold text-ink">Medication summary:</span> {medicationSummary}</p>
                <p><span className="font-semibold text-ink">Symptom summary:</span> {symptomSummary}</p>
                <p><span className="font-semibold text-ink">Hydration:</span> {latestWaterForToday ? `${latestWaterForToday.amount} ${latestWaterForToday.unit} logged for ${formatDateLabel(latestWaterForToday.date)}.` : "No water intake logged yet."}</p>
                <p><span className="font-semibold text-ink">Blood pressure:</span> {latestBloodPressure ? `${latestBloodPressure.systolic}/${latestBloodPressure.diastolic} on ${formatDateLabel(latestBloodPressure.date)}.` : "No blood pressure log yet."}</p>
                <p><span className="font-semibold text-ink">Weight:</span> {latestWeight ? `${latestWeight.weight} ${latestWeight.unit} on ${formatDateLabel(latestWeight.date)}.` : "No weight log yet."}</p>
              </div>
            </div>

            <div className="rounded-[1.25rem] bg-white p-4 xl:col-span-2">
              <p className="text-sm uppercase tracking-[0.16em] text-slate">Questions to ask the doctor</p>
              <div className="mt-3 space-y-3">
                {suggestedDoctorQuestions.length ? (
                  <div className="rounded-[1rem] bg-canvas p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Suggested for the next visit</p>
                    <div className="mt-3 space-y-3">
                      {suggestedDoctorQuestions.slice(0, 3).map((entry) => (
                        <div key={entry.id} className="rounded-[1rem] bg-white p-3 text-sm leading-6 text-slate">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-semibold text-ink">{entry.question}</p>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.priority === "important" ? "bg-rose/10 text-rose" : "bg-amber-100 text-amber-700"}`}>
                              {entry.priority === "important" ? "Important" : "Routine"}
                            </span>
                          </div>
                          <p className="mt-2">{entry.context}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {state.doctorQuestions.length ? (
                  state.doctorQuestions
                    .slice()
                    .sort((a, b) => (Number(a.answered) - Number(b.answered)) || b.date.localeCompare(a.date))
                    .slice(0, 6)
                    .map((entry) => (
                      <div key={entry.id} className="rounded-[1rem] bg-canvas p-3 text-sm leading-6 text-slate">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold text-ink">{entry.question}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.answered ? "bg-emerald-100 text-emerald-700" : entry.priority === "important" ? "bg-rose/10 text-rose" : "bg-amber-100 text-amber-700"}`}>
                            {entry.answered ? "Answered" : entry.priority === "important" ? "Important" : "Ask"}
                          </span>
                        </div>
                        {entry.context ? <p className="mt-2">{entry.context}</p> : null}
                        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate">Added {formatDateLabel(entry.date)}</p>
                      </div>
                    ))
                ) : (
                  <p className="text-sm leading-6 text-slate">No appointment questions have been added yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-[1.25rem] bg-white p-4 xl:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm uppercase tracking-[0.16em] text-slate">Pre-visit prep checklist</p>
                <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-slate">
                  {visitPrepChecklistState.completedItemIds.length}/{visitPrepChecklist.length || 0} done
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {visitPrepChecklist.length ? (
                  visitPrepChecklist.map((item) => {
                    const completed = visitPrepChecklistState.completedItemIds.includes(item.id);
                    return (
                      <div key={item.id} className="rounded-[1rem] bg-canvas p-3 text-sm leading-6 text-slate">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold text-ink">{item.title}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${completed ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate"}`}>
                            {completed ? "Done" : "Open"}
                          </span>
                        </div>
                        <p className="mt-2">{item.detail}</p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm leading-6 text-slate">A prep checklist will appear here when there is enough appointment context to build one.</p>
                )}
              </div>
            </div>

            <div className="rounded-[1.25rem] bg-white p-4 xl:col-span-2">
              <p className="text-sm uppercase tracking-[0.16em] text-slate">Recent documents to reference</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {sortedUploadedRecords.length ? (
                  sortedUploadedRecords.slice(0, 4).map((record) => (
                    <div key={record.id} className="rounded-[1rem] bg-canvas p-3 text-sm leading-6 text-slate">
                      <p className="font-semibold text-ink">{record.name}</p>
                      <p>{record.category} | {formatDateLabel(record.uploadedAt)} | {record.sizeLabel}</p>
                      <p className="mt-2">{record.extractionStatus}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate">No uploaded records are available yet.</p>
                )}
              </div>
            </div>
          </div>

          </div>

          <div className="packet-print-only" data-print-mode={printPacketMode}>
            <div className="packet-print-header">
              <div>
                  <p className="packet-print-kicker">{printPacketMode === "doctor" ? "Patient highlights" : "Visit summary"}</p>
                  <h2>{printPacketMode === "doctor" ? state.patient.fullName || "Patient packet" : `${state.patient.fullName || "Patient"} summary`}</h2>
                  <p className="packet-print-meta">
                    {upcomingAppointment
                      ? printPacketMode === "doctor"
                        ? `${upcomingAppointment.provider} on ${formatDateLabel(upcomingAppointment.appointmentDate)}${upcomingAppointment.appointmentTime ? ` at ${formatTimeLabel(upcomingAppointment.appointmentTime)}` : ""}${upcomingAppointment.location ? `, ${upcomingAppointment.location}` : ""}`
                        : `Next visit: ${upcomingAppointment.provider} on ${formatDateLabel(upcomingAppointment.appointmentDate)}${upcomingAppointment.appointmentTime ? ` at ${formatTimeLabel(upcomingAppointment.appointmentTime)}` : ""}${upcomingAppointment.location ? `, ${upcomingAppointment.location}` : ""}`
                      : printPacketMode === "doctor"
                        ? "No upcoming appointment scheduled"
                        : "No upcoming visit is scheduled yet."}
                  </p>
                </div>
                <div className="packet-print-badges">
                  <span>{flaggedLabs.length} {printPacketMode === "doctor" ? "flagged labs" : "labs to discuss"}</span>
                  <span>{state.doctorQuestions.filter((entry) => !entry.answered).length} {printPacketMode === "doctor" ? "open questions" : "questions saved"}</span>
                  <span>{openVisitPrepCount} {printPacketMode === "doctor" ? "prep items open" : "prep step(s) left"}</span>
                </div>
              </div>

              <div className="packet-print-grid packet-print-grid-compact">
                {!includedPacketSectionCount ? (
                  <section className="packet-print-card packet-print-card-wide">
                    <h3>{packetCopy.emptyTitle}</h3>
                    <p>No packet highlights are currently selected. Turn sections back on in the personalization panel to include them in the printable patient summary.</p>
                  </section>
                ) : null}
                  {isPacketSectionIncluded("packetSnapshot") ? (
                  <section className="packet-print-card packet-print-card-wide">
                    <h3>{packetCopy.snapshotTitle}</h3>
                    <p><strong>Name:</strong> {state.patient.fullName || "Patient"}</p>
                    {state.patient.birthDate ? <p><strong>Birth date:</strong> {formatDateLabel(state.patient.birthDate)}</p> : null}
                    {state.patient.careGoals ? <p><strong>Care goals:</strong> {state.patient.careGoals}</p> : null}
                    {upcomingAppointment?.visitType ? <p><strong>Visit type:</strong> {upcomingAppointment.visitType}</p> : null}
                    {isPacketSectionIncluded("packetMeasures") && packetMeasuresSummary ? (
                      <p><strong>{packetCopy.measuresLabel}:</strong> {packetMeasuresSummary}</p>
                    ) : null}
                    {packetWellnessHighlights.length ? (
                      <div>
                        <p><strong>{packetCopy.wellnessLabel}:</strong></p>
                        <ul className="mt-1 space-y-1">
                          {packetWellnessHighlights.map((entry) => (
                            <li key={entry.label}>
                              <strong>{entry.label}:</strong> {entry.body}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {packetAppointmentHighlight ? (
                      <p><strong>{packetCopy.visitPlanLabel}:</strong> {packetAppointmentHighlight}</p>
                    ) : null}
                    {packetDoctorMessageHighlight ? (
                      <p>
                        <strong>{packetCopy.messageLabel}:</strong>{" "}
                        {latestDoctorMessage?.subject ? `${latestDoctorMessage.subject}. ` : ""}
                        {packetDoctorMessageHighlight}
                      </p>
                    ) : null}
                  </section>
                  ) : null}

                {isPacketSectionIncluded("packetSymptoms") && packetSymptoms.length ? (
                  <section className="packet-print-card">
                    <h3>{packetCopy.symptomsTitle}</h3>
                    <ul className="packet-print-list">
                      {packetSymptoms.map((symptom) => (
                        <li key={symptom.id}>
                          <strong>{symptom.symptom}:</strong> {symptom.severity}, {symptom.frequency || "frequency not added"}{symptom.notes ? `, ${symptom.notes}` : ""}
                        </li>
                        ))}
                    </ul>
                    {packetSymptomSummaryItems.length ? (
                      <div className="mt-2">
                        <p><strong>{packetCopy.symptomsSummaryLabel}:</strong></p>
                        <ul className="mt-1 space-y-1">
                          {packetSymptomSummaryItems.map((entry) => (
                            <li key={entry.label}>
                              <strong>{entry.label}:</strong> {entry.body}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    </section>
                  ) : null}

                {isPacketSectionIncluded("packetMedications") && packetMedications.length ? (
                  <section className="packet-print-card">
                    <h3>{packetCopy.medicationsTitle}</h3>
                        <ul className="packet-print-list">
                          {packetMedications.map((medication) => (
                          <li key={medication.id}>
                            <strong>{medication.name}:</strong> {medication.dose || "Dose not added"}{medication.schedule ? `, ${medication.schedule}` : ""}
                          </li>
                        ))}
                      </ul>
                    {packetMedicationSummaryItems.length ? (
                      <div className="mt-2">
                        <p><strong>{packetCopy.medicationsSummaryLabel}:</strong></p>
                        <ul className="mt-1 space-y-1">
                          {packetMedicationSummaryItems.map((entry) => (
                            <li key={entry.label}>
                              <strong>{entry.label}:</strong> {entry.body}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    </section>
                  ) : null}

                {isPacketSectionIncluded("packetLabs") && packetFlaggedLabs.length ? (
                  <section className="packet-print-card">
                    <h3>{packetCopy.labsTitle}</h3>
                        <ul className="packet-print-list">
                          {packetFlaggedLabs.map((lab) => (
                          <li key={lab.id}>
                            <strong>{lab.testName}:</strong> {lab.value} {lab.unit} on {formatDateLabel(lab.date)}
                          </li>
                        ))}
                      </ul>
                    {packetLabSummaryItems.length ? (
                      <div className="mt-2">
                        <p><strong>{packetCopy.labsSummaryLabel}:</strong></p>
                        <ul className="mt-1 space-y-1">
                          {packetLabSummaryItems.map((entry) => (
                            <li key={entry.label}>
                              <strong>{entry.label}:</strong> {entry.body}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    </section>
                  ) : null}

                {isPacketSectionIncluded("packetQuestions") && (packetSuggestedQuestions.length || packetSavedQuestions.length) ? (
                <section className="packet-print-card">
                  <h3>{packetCopy.questionsTitle}</h3>
                    <ul className="packet-print-list">
                      {packetSuggestedQuestions.map((entry) => (
                        <li key={entry.id}>
                          <strong>{entry.question}</strong>{entry.context ? `: ${entry.context}` : ""}
                        </li>
                      ))}
                        {packetSavedQuestions.map((entry) => (
                          <li key={entry.id}>
                            <strong>{entry.question}</strong>{entry.context ? `: ${entry.context}` : ""}
                          </li>
                        ))}
                    </ul>
                  </section>
                ) : null}

                {isPacketSectionIncluded("packetPrep") && (packetPrepItems.length || !openVisitPrepCount) ? (
                <section className="packet-print-card">
                  <h3>{packetCopy.prepTitle}</h3>
                    <ul className="packet-print-list">
                        {packetPrepItems.map((item) => (
                          <li key={item.id}>
                            <strong>{item.title}:</strong> {item.detail}
                          </li>
                        ))}
                      {!packetPrepItems.length ? (
                        <li>Prep checklist is complete.</li>
                      ) : null}
                    </ul>
                  </section>
                ) : null}
              </div>
          </div>
        </section>

        <section id="health-history" className="panel rounded-[1.75rem] p-6 lg:p-8" hidden={!isSectionVisible("healthHistory")}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Health history</p>
              <h2 className="mt-2 text-2xl font-semibold">Appointments, questions, changes, symptoms, and the calendar at the top</h2>
            </div>
            <div className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              {state.appointments.length + state.doctorQuestions.length + state.careChanges.length + state.symptoms.length} tracked items
            </div>
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <AppointmentCalendar appointments={state.appointments} onAddAppointment={handleCalendarAppointmentAdd} />
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
              <article className="rounded-[1.5rem] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">Recent appointments</h3>
                  <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-slate">
                    {state.appointments.length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {state.appointments.slice(0, 3).map((appointment) => (
                      <div key={appointment.id} className="rounded-[1rem] bg-canvas p-3">
                        <p className="font-semibold">{appointment.provider}</p>
                        <p className="mt-1 text-sm text-slate">
                          {appointment.specialty} | {formatDateLabel(appointment.appointmentDate)}{appointment.appointmentTime ? ` at ${formatTimeLabel(appointment.appointmentTime)}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-slate">
                          {appointment.visitType || "Visit type not added"}{appointment.location ? ` | ${appointment.location}` : ""}{appointment.durationMinutes ? ` | ${appointment.durationMinutes} min` : ""}
                        </p>
                      </div>
                    ))}
                </div>
              </article>
              <article className="rounded-[1.5rem] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">Recent changes</h3>
                  <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-slate">
                    {state.careChanges.length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {state.careChanges.slice(0, 3).map((change) => (
                    <div key={change.id} className="rounded-[1rem] bg-canvas p-3">
                      <p className="font-semibold">{change.category}</p>
                      <p className="mt-1 text-sm text-slate">{formatDateLabel(change.date)}</p>
                    </div>
                  ))}
                </div>
              </article>
              <article className="rounded-[1.5rem] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">Current symptoms</h3>
                  <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-slate">
                    {state.symptoms.length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {state.symptoms.slice(0, 3).map((symptom) => (
                    <div key={symptom.id} className="rounded-[1rem] bg-canvas p-3">
                      <p className="font-semibold">{symptom.symptom}</p>
                      <p className="mt-1 text-sm text-slate">
                        {symptom.severity} | {symptom.frequency}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="workspace" className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-6">
            <article id="trend-explorer" className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("trendExplorer")}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate">Patient profile</p>
                  <h2 className="mt-2 text-2xl font-semibold">Save who this record set belongs to</h2>
                </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${syncStatusMeta.className}`}>{syncStatusMeta.label}</div>
                </div>

              <form className="mt-5 grid gap-4" onSubmit={handlePatientSave}>
                <input name="fullName" defaultValue={state.patient.fullName} placeholder="Full name" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-accent" />
                <input name="birthDate" type="date" defaultValue={state.patient.birthDate} className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-accent" />
                <textarea
                  name="careGoals"
                  defaultValue={state.patient.careGoals}
                  rows={3}
                  placeholder="What is this patient trying to track?"
                  className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-accent"
                />
                <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                  Save profile
                </button>
              </form>
            </article>

            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("importRecords")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Import records</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold">Add documents and portal links</h2>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${syncStatusMeta.className}`}>{syncStatusMeta.label}</div>
              </div>
                <div className="mt-5 grid gap-4">
                <label className="rounded-[1.25rem] border border-dashed border-ink/20 bg-white p-4 transition hover:border-accent">
                  <span className="block text-sm font-medium">Upload PDFs or images</span>
                  <span className="mt-1 block text-sm leading-6 text-slate">
                    Records are synced into your secure workspace. Text-based PDFs parse directly, and scanned PDFs or images fall back to OCR.
                  </span>
                  <input type="file" multiple className="mt-4 block w-full text-sm text-slate" onChange={handleRecordUpload} />
                </label>
                <p className="text-sm text-slate">{recordStatus}</p>

                <div className="rounded-[1.25rem] bg-ink p-4 text-white">
                  <p className="text-sm font-medium">Portal connections</p>
                  <p className="mt-1 text-sm leading-6 text-white/75">
                    This backend version still stores portal placeholders, with real portal OAuth and FHIR syncing as the next integration step.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {portalOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handlePortalConnect(option)}
                        className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/10"
                      >
                        Add {option}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input
                      value={portalName}
                      onChange={(event) => setPortalName(event.target.value)}
                      placeholder="Custom portal name"
                      className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none"
                    />
                    <button type="button" onClick={() => portalName.trim() && handlePortalConnect(portalName.trim())} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("labIntake")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Lab intake</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">Import a CSV or enter results manually</h2>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${syncStatusMeta.className}`}>{syncStatusMeta.label}</div>
                </div>
                <div className="mt-5 grid gap-5">
                <label className="rounded-[1.25rem] bg-canvas p-4">
                  <span className="block text-sm font-medium">CSV format</span>
                  <span className="mt-1 block text-sm leading-6 text-slate">
                    Required columns: <code>date,testName,value,unit,source</code>. Optional: <code>low,high</code>.
                  </span>
                  <input type="file" accept=".csv,text/csv" className="mt-4 block w-full text-sm text-slate" onChange={handleCsvUpload} />
                </label>
                <p className="text-sm text-slate">{csvStatus}</p>

                <form className="grid gap-3" onSubmit={handleLabSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={labForm.testName} onChange={(event) => setLabForm((current) => ({ ...current, testName: event.target.value }))} placeholder="Test name" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                    <input value={labForm.source} onChange={(event) => setLabForm((current) => ({ ...current, source: event.target.value }))} placeholder="Source or clinic" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                    <input value={labForm.value} onChange={(event) => setLabForm((current) => ({ ...current, value: event.target.value }))} placeholder="Value" inputMode="decimal" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                    <input value={labForm.unit} onChange={(event) => setLabForm((current) => ({ ...current, unit: event.target.value }))} placeholder="Unit" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                    <input value={labForm.date} onChange={(event) => setLabForm((current) => ({ ...current, date: event.target.value }))} type="date" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                    <input value={labForm.low} onChange={(event) => setLabForm((current) => ({ ...current, low: event.target.value }))} placeholder="Low range" inputMode="decimal" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                    <input value={labForm.high} onChange={(event) => setLabForm((current) => ({ ...current, high: event.target.value }))} placeholder="High range" inputMode="decimal" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                  </div>
                  <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                    Add lab result
                  </button>
                </form>
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("appointmentNotes")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Appointment notes</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">Record and summarize what happened at a visit</h2>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${syncStatusMeta.className}`}>{syncStatusMeta.label}</div>
                </div>
                <form className="mt-5 grid gap-3" onSubmit={handleAppointmentSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={appointmentForm.appointmentDate}
                    onChange={(event) => setAppointmentForm((current) => ({ ...current, appointmentDate: event.target.value }))}
                    type="date"
                    className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                  />
                  <input
                    value={appointmentForm.appointmentTime ?? ""}
                    onChange={(event) => setAppointmentForm((current) => ({ ...current, appointmentTime: event.target.value }))}
                    type="text"
                    placeholder="Time, like 9:30 AM"
                    className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                  />
                  <input
                    value={appointmentForm.provider}
                    onChange={(event) => setAppointmentForm((current) => ({ ...current, provider: event.target.value }))}
                    placeholder="Provider name"
                    className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                  />
                      <input
                        value={appointmentForm.specialty}
                        onChange={(event) => setAppointmentForm((current) => ({ ...current, specialty: event.target.value }))}
                        placeholder="Specialty"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={appointmentForm.visitType}
                        onChange={(event) => setAppointmentForm((current) => ({ ...current, visitType: event.target.value }))}
                        placeholder="Visit type, like Office or Telehealth"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={appointmentForm.location}
                        onChange={(event) => setAppointmentForm((current) => ({ ...current, location: event.target.value }))}
                        placeholder="Location"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={appointmentForm.durationMinutes}
                        onChange={(event) => setAppointmentForm((current) => ({ ...current, durationMinutes: event.target.value }))}
                        placeholder="Duration in minutes"
                        inputMode="numeric"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                    </div>
                <textarea
                  value={appointmentForm.notes}
                  onChange={(event) => setAppointmentForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={4}
                  placeholder="What was discussed during the appointment?"
                  className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                />
                <textarea
                  value={appointmentForm.followUp}
                  onChange={(event) => setAppointmentForm((current) => ({ ...current, followUp: event.target.value }))}
                  rows={3}
                  placeholder="Follow-up plan, instructions, or next steps"
                  className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                />
                <div className="rounded-[1rem] bg-canvas p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">Appointment transcript recorder</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={startAppointmentRecording}
                        className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white"
                      >
                        Start transcript
                      </button>
                      <button
                        type="button"
                        onClick={stopAppointmentRecording}
                        className="rounded-full border border-ink/10 bg-white px-4 py-2 text-xs font-semibold text-ink"
                      >
                        Stop
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate">
                    {isRecordingAppointment ? "Recorder is live." : recordingStatus}
                  </p>
                  <textarea
                    value={appointmentForm.transcript}
                    onChange={(event) => setAppointmentForm((current) => ({ ...current, transcript: event.target.value }))}
                    rows={5}
                    placeholder="Transcript will appear here while recording, or you can paste text manually."
                    className="mt-3 w-full rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                  />
                </div>
                <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                  {editingAppointmentId ? "Update appointment" : "Save appointment"}
                </button>
                {editingAppointmentId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAppointmentForm(emptyAppointmentForm);
                      setEditingAppointmentId(null);
                    }}
                    className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                  >
                    Cancel edit
                  </button>
                ) : null}
              </form>
            </article>

            <article id="doctor-questions" className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("doctorQuestions")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Questions to ask the doctor</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">Keep appointment questions organized before a visit</h2>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${syncStatusMeta.className}`}>{syncStatusMeta.label}</div>
                </div>
                {suggestedDoctorQuestions.length ? (
                <div className="mt-5 rounded-[1.25rem] bg-canvas p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.16em] text-slate">Suggested questions</p>
                      <p className="mt-1 text-sm text-slate">These are generated from your symptoms, flagged labs, medications, and follow-up notes.</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                      {suggestedDoctorQuestions.length}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {suggestedDoctorQuestions.map((entry) => (
                      <div key={entry.id} className="rounded-[1rem] bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold">{entry.question}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.priority === "important" ? "bg-rose/10 text-rose" : "bg-amber-100 text-amber-700"}`}>
                            {entry.priority === "important" ? "Important" : "Routine"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate">{entry.context}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setDoctorQuestionForm({
                              date: todayIso,
                              question: entry.question,
                              context: entry.context,
                              priority: entry.priority,
                              answered: false
                            })}
                            className="rounded-full border border-ink/10 bg-canvas px-3 py-2 text-xs font-semibold text-ink"
                          >
                            Use in form
                          </button>
                          <button
                            type="button"
                            onClick={() => saveSuggestedDoctorQuestion(entry)}
                            className="rounded-full bg-accent px-3 py-2 text-xs font-semibold text-white"
                          >
                            Save question
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <form className="mt-5 grid gap-3" onSubmit={handleDoctorQuestionSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={doctorQuestionForm.date}
                    onChange={(event) => setDoctorQuestionForm((current) => ({ ...current, date: event.target.value }))}
                    type="date"
                    className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                  />
                  <select
                    value={doctorQuestionForm.priority}
                    onChange={(event) => setDoctorQuestionForm((current) => ({ ...current, priority: event.target.value as "routine" | "important" }))}
                    className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                  >
                    <option value="routine">Routine question</option>
                    <option value="important">Important question</option>
                  </select>
                </div>
                <textarea
                  value={doctorQuestionForm.question}
                  onChange={(event) => setDoctorQuestionForm((current) => ({ ...current, question: event.target.value }))}
                  rows={3}
                  placeholder="What do you want to ask at the appointment?"
                  className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                />
                <textarea
                  value={doctorQuestionForm.context}
                  onChange={(event) => setDoctorQuestionForm((current) => ({ ...current, context: event.target.value }))}
                  rows={3}
                  placeholder="Optional context, like symptoms, labs, or medications related to this question"
                  className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                />
                <label className="inline-flex items-center gap-3 text-sm text-slate">
                  <input
                    type="checkbox"
                    checked={doctorQuestionForm.answered}
                    onChange={(event) => setDoctorQuestionForm((current) => ({ ...current, answered: event.target.checked }))}
                  />
                  Mark as already answered
                </label>
                <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                  {editingDoctorQuestionId ? "Update question" : "Save question"}
                </button>
                {editingDoctorQuestionId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDoctorQuestionForm(emptyDoctorQuestionForm);
                      setEditingDoctorQuestionId(null);
                    }}
                    className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                  >
                    Cancel edit
                  </button>
                ) : null}
              </form>
            </article>

            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("careChanges")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">After-visit changes</p>
              <h2 className="mt-2 text-2xl font-semibold">Track what changed after the appointment</h2>
              <form className="mt-5 grid gap-3" onSubmit={handleCareChangeSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={careChangeForm.date}
                    onChange={(event) => setCareChangeForm((current) => ({ ...current, date: event.target.value }))}
                    type="date"
                    className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                  />
                  <input
                    value={careChangeForm.category}
                    onChange={(event) => setCareChangeForm((current) => ({ ...current, category: event.target.value }))}
                    placeholder="Category, like Medication or Routine"
                    className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                  />
                </div>
                <textarea
                  value={careChangeForm.change}
                  onChange={(event) => setCareChangeForm((current) => ({ ...current, change: event.target.value }))}
                  rows={3}
                  placeholder="What did you change after the visit?"
                  className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                />
                <textarea
                  value={careChangeForm.effect}
                  onChange={(event) => setCareChangeForm((current) => ({ ...current, effect: event.target.value }))}
                  rows={3}
                  placeholder="How is it going so far?"
                  className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                />
                <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                  {editingCareChangeId ? "Update change" : "Save change"}
                </button>
                {editingCareChangeId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCareChangeForm(emptyCareChangeForm);
                      setEditingCareChangeId(null);
                    }}
                    className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                  >
                    Cancel edit
                  </button>
                ) : null}
              </form>
            </article>

            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("symptoms")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Symptom tracker</p>
              <h2 className="mt-2 text-2xl font-semibold">List symptoms before a focused doctor visit</h2>
              <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <form className="grid gap-3" onSubmit={handleSymptomSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={symptomForm.symptom}
                      onChange={(event) => setSymptomForm((current) => ({ ...current, symptom: event.target.value }))}
                      placeholder="Symptom"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={symptomForm.startedOn}
                      onChange={(event) => setSymptomForm((current) => ({ ...current, startedOn: event.target.value }))}
                      type="date"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={symptomForm.severity}
                      onChange={(event) => setSymptomForm((current) => ({ ...current, severity: event.target.value }))}
                      placeholder="Severity, like Mild or Severe"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={symptomForm.frequency}
                      onChange={(event) => setSymptomForm((current) => ({ ...current, frequency: event.target.value }))}
                      placeholder="Frequency, like Daily or Intermittent"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                  </div>
                  <textarea
                    value={symptomForm.notes}
                    onChange={(event) => setSymptomForm((current) => ({ ...current, notes: event.target.value }))}
                    rows={3}
                    placeholder="When does it happen, what makes it worse, or what should the doctor know?"
                    className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                  />
                  <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                    {editingSymptomId ? "Update symptom" : "Save symptom"}
                  </button>
                  {editingSymptomId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSymptomForm(emptySymptomForm);
                        setEditingSymptomId(null);
                      }}
                      className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </form>
                <div className="space-y-4">
                  {symptomTrendSeries.length ? (
                    symptomTrendSeries.slice(0, 3).map((series) => (
                      <div key={series.name} className="rounded-[1.5rem] bg-canvas p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold">{series.name}</p>
                            <p className="text-sm text-slate">{series.changeLabel}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate">Latest</p>
                            <p className="text-lg font-semibold">{series.latestValue}/4</p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-[1rem] bg-white p-3">
                          <Sparkline points={series.points} color={getTrendColor(series.points)} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.25rem] bg-canvas p-4 text-sm leading-6 text-slate">
                      Add symptom entries to see severity trends over time.
                    </div>
                  )}
                  <div className="space-y-3">
                    {state.symptoms.length ? (
                      state.symptoms
                        .slice()
                        .sort((a, b) => (b.startedOn || "").localeCompare(a.startedOn || ""))
                        .slice(0, 4)
                        .map((symptom) => (
                          <div key={symptom.id} className="rounded-[1rem] bg-white p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold">{symptom.symptom}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate">
                                  {symptom.startedOn ? formatDateLabel(symptom.startedOn) : "Start date not set"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => startSymptomEdit(symptom)}
                                  className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSymptom(symptom.id)}
                                  className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-slate">
                              {symptom.severity} | {symptom.frequency}
                            </p>
                            {symptom.notes ? <p className="mt-2 text-sm text-slate">{symptom.notes}</p> : null}
                          </div>
                        ))
                    ) : (
                      <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No symptoms saved yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          </div>

          <div className="space-y-6">
            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("plainLanguageSummary")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Plain-language summary</p>
              <h2 className="mt-2 text-2xl font-semibold">What changed and what it may mean</h2>
              <div className="mt-4 rounded-[1.25rem] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">AI summaries</p>
                  <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-slate">Server-side OpenAI</span>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate">{aiStatus}</p>
              </div>
              <div className="mt-5 grid gap-4">
                {summaryCards.map((item) => (
                  <div key={item.title} className="rounded-[1.25rem] bg-canvas p-4">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">{item.label}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate">{item.body}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("visitPrepSummary")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Visit prep and follow-through</p>
              <h2 className="mt-2 text-2xl font-semibold">Appointments, changes, and symptoms in plain language</h2>
              <div className="mt-5 grid gap-4">
                <div className="rounded-[1.25rem] bg-canvas p-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">Appointment summary</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                      {state.appointments.length} saved
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate">{appointmentSummary}</p>
                </div>
                <div className="rounded-[1.25rem] bg-canvas p-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">After-visit changes</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                      {state.careChanges.length} tracked
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate">{careChangeSummary}</p>
                </div>
                <div className="rounded-[1.25rem] bg-canvas p-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">Symptom focus</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                      {state.symptoms.length} logged
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate">{symptomSummary}</p>
                </div>
              </div>
            </article>

            <article id="connections-view" className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("connectionsView")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Connections view</p>
              <h2 className="mt-2 text-2xl font-semibold">See which patterns may be showing up across your health data</h2>
              <p className="mt-2 text-sm leading-7 text-slate">
                These are pattern prompts, not diagnoses. They are here to help patients notice what may be worth asking about at the next visit.
              </p>
              <div className="mt-5 grid gap-4">
                {connectionsInsights.map((item) => (
                  <div key={item.title} className="rounded-[1.25rem] bg-canvas p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.tone === "alert"
                            ? "bg-rose/10 text-rose"
                            : item.tone === "watch"
                              ? "bg-amber-100 text-amber-700"
                              : item.tone === "info"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-white text-slate"
                        }`}
                      >
                        {item.tone === "alert" ? "Watch closely" : item.tone === "watch" ? "Worth tracking" : item.tone === "info" ? "Possible pattern" : "Building"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate">{item.body}</p>
                    <p className="mt-2 text-sm leading-7 text-slate">{item.detail}</p>
                    <a
                      href={item.href}
                      className="mt-4 inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 hover:text-orange-800"
                    >
                      Open section
                    </a>
                  </div>
                ))}
              </div>
            </article>

              <article id="blood-pressure" className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("bloodPressure")}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate">Blood pressure log</p>
                  <h2 className="mt-2 text-2xl font-semibold">Track blood pressure readings and see the graph</h2>
                </div>
                <div className="rounded-full bg-rose/10 px-3 py-1 text-xs font-semibold text-rose">
                  {latestBloodPressure ? `${latestBloodPressure.systolic}/${latestBloodPressure.diastolic}` : "No readings"}
                </div>
              </div>
              <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <form className="grid gap-3" onSubmit={handleBloodPressureSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={bloodPressureForm.date}
                      onChange={(event) => setBloodPressureForm((current) => ({ ...current, date: event.target.value }))}
                      type="date"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={bloodPressureForm.pulse}
                      onChange={(event) => setBloodPressureForm((current) => ({ ...current, pulse: event.target.value }))}
                      placeholder="Pulse"
                      inputMode="numeric"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={bloodPressureForm.systolic}
                      onChange={(event) => setBloodPressureForm((current) => ({ ...current, systolic: event.target.value }))}
                      placeholder="Systolic"
                      inputMode="numeric"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={bloodPressureForm.diastolic}
                      onChange={(event) => setBloodPressureForm((current) => ({ ...current, diastolic: event.target.value }))}
                      placeholder="Diastolic"
                      inputMode="numeric"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                  </div>
                  <textarea
                    value={bloodPressureForm.notes}
                    onChange={(event) => setBloodPressureForm((current) => ({ ...current, notes: event.target.value }))}
                    rows={3}
                    placeholder="Optional note about time of day, symptoms, or medication"
                    className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                  />
                  <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                    {editingBloodPressureId ? "Update blood pressure" : "Save blood pressure"}
                  </button>
                  {editingBloodPressureId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBloodPressureForm(emptyBloodPressureForm);
                        setEditingBloodPressureId(null);
                      }}
                      className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </form>

                <div className="rounded-[1.5rem] bg-canvas p-4">
                  <BloodPressureChart
                    points={sortedBloodPressure.map((entry) => ({
                      date: entry.date,
                      systolic: entry.systolic,
                      diastolic: entry.diastolic
                    }))}
                  />
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                    <span className="rounded-full bg-white px-3 py-1 text-[#2f5d9f]">Systolic</span>
                    <span className="rounded-full bg-white px-3 py-1 text-[#d28a3c]">Diastolic</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[...sortedBloodPressure].reverse().slice(0, 4).map((entry) => (
                      <div key={entry.id} className="rounded-[1rem] bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold">
                            {entry.systolic}/{entry.diastolic}
                            {entry.pulse !== null ? ` pulse ${entry.pulse}` : ""}
                          </p>
                          <span className="text-sm text-slate">{formatDateLabel(entry.date)}</span>
                        </div>
                        {entry.notes ? <p className="mt-2 text-sm text-slate">{entry.notes}</p> : null}
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => startBloodPressureEdit(entry)}
                            className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteBloodPressure(entry.id)}
                            className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("familyHistory")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Family history</p>
              <h2 className="mt-2 text-2xl font-semibold">Track inherited conditions and context</h2>
              <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <form className="grid gap-3" onSubmit={handleFamilyHistorySubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={familyHistoryForm.relation} onChange={(event) => setFamilyHistoryForm((current) => ({ ...current, relation: event.target.value }))} placeholder="Relation" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                    <input value={familyHistoryForm.condition} onChange={(event) => setFamilyHistoryForm((current) => ({ ...current, condition: event.target.value }))} placeholder="Condition" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                    <input value={familyHistoryForm.ageOfOnset} onChange={(event) => setFamilyHistoryForm((current) => ({ ...current, ageOfOnset: event.target.value }))} placeholder="Age of onset" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent sm:col-span-2" />
                  </div>
                  <textarea value={familyHistoryForm.notes} onChange={(event) => setFamilyHistoryForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Extra notes about severity, treatment, or pattern in the family" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                  <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                    {editingFamilyHistoryId ? "Update family history" : "Save family history"}
                  </button>
                  {editingFamilyHistoryId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFamilyHistoryForm(emptyFamilyHistoryForm);
                        setEditingFamilyHistoryId(null);
                      }}
                      className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </form>
                <div className="rounded-[1.5rem] bg-canvas p-4">
                  <p className="text-sm leading-7 text-slate">{familyHistorySummary}</p>
                  <div className="mt-4 space-y-3">
                    {state.familyHistory.length ? (
                      state.familyHistory.slice(0, 4).map((entry) => (
                        <div key={entry.id} className="rounded-[1rem] bg-white p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">{entry.relation}</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => startFamilyHistoryEdit(entry)}
                                className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteFamilyHistory(entry.id)}
                                className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <p className="mt-1 text-sm text-slate">
                            {entry.condition}{entry.ageOfOnset ? ` | around age ${entry.ageOfOnset}` : ""}
                          </p>
                          {entry.notes ? <p className="mt-2 text-sm text-slate">{entry.notes}</p> : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No family history entries saved yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("weightTracker")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Weight tracker</p>
              <h2 className="mt-2 text-2xl font-semibold">Log weight and see the trend</h2>
              <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <form className="grid gap-3" onSubmit={handleWeightSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={weightForm.date} onChange={(event) => setWeightForm((current) => ({ ...current, date: event.target.value }))} type="date" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                    <input value={weightForm.weight} onChange={(event) => setWeightForm((current) => ({ ...current, weight: event.target.value }))} placeholder="Weight" inputMode="decimal" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                    <input value={weightForm.unit} onChange={(event) => setWeightForm((current) => ({ ...current, unit: event.target.value }))} placeholder="Unit" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent sm:col-span-2" />
                  </div>
                  <textarea value={weightForm.notes} onChange={(event) => setWeightForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Optional notes about timing, routine, or how you felt" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                  <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                    {editingWeightId ? "Update weight" : "Save weight"}
                  </button>
                  {editingWeightId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setWeightForm(emptyWeightForm);
                        setEditingWeightId(null);
                      }}
                      className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </form>
                <div className="space-y-4">
                  {weightTrendSeries.map((series) => (
                    <div key={series.name} className="rounded-[1.5rem] bg-canvas p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{series.name}</p>
                          <p className="text-sm text-slate">{series.changeLabel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate">Latest</p>
                          <p className="text-lg font-semibold">{series.latestValue} {series.unit}</p>
                        </div>
                      </div>
                      <div className="mt-4 rounded-[1rem] bg-white p-3">
                        <Sparkline points={series.points} color={getTrendColor(series.points)} />
                      </div>
                    </div>
                  ))}
                  <div className="space-y-3">
                    {sortedWeightLogs.length ? (
                      [...sortedWeightLogs].reverse().slice(0, 4).map((entry) => (
                        <div key={entry.id} className="rounded-[1rem] bg-white p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">{entry.weight} {entry.unit}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate">{formatDateLabel(entry.date)}</span>
                              <button
                                type="button"
                                onClick={() => startWeightEdit(entry)}
                                className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteWeight(entry.id)}
                                className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {entry.notes ? <p className="mt-2 text-sm text-slate">{entry.notes}</p> : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No weight entries saved yet.</div>
                    )}
                  </div>
                </div>
                </div>
                </article>

              <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("sleepTracker")}>
                <p className="text-sm uppercase tracking-[0.2em] text-slate">Sleep tracker</p>
                <h2 className="mt-2 text-2xl font-semibold">Track sleep timing, quality, and hours over time</h2>
                <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <form className="grid gap-3" onSubmit={handleSleepSubmit}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={sleepForm.date}
                        onChange={(event) => setSleepForm((current) => ({ ...current, date: event.target.value }))}
                        type="date"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={sleepForm.hoursSlept}
                        onChange={(event) => setSleepForm((current) => ({ ...current, hoursSlept: event.target.value }))}
                        placeholder="Hours slept"
                        inputMode="decimal"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={sleepForm.bedtime}
                        onChange={(event) => setSleepForm((current) => ({ ...current, bedtime: event.target.value }))}
                        placeholder="Bedtime, like 10:30 PM"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={sleepForm.wakeTime}
                        onChange={(event) => setSleepForm((current) => ({ ...current, wakeTime: event.target.value }))}
                        placeholder="Wake time, like 6:45 AM"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                    </div>
                    <select
                      value={sleepForm.quality}
                      onChange={(event) =>
                        setSleepForm((current) => ({
                          ...current,
                          quality: event.target.value as "Poor" | "Fair" | "Good" | "Great"
                        }))
                      }
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    >
                      <option value="Poor">Poor</option>
                      <option value="Fair">Fair</option>
                      <option value="Good">Good</option>
                      <option value="Great">Great</option>
                    </select>
                    <textarea
                      value={sleepForm.notes}
                      onChange={(event) => setSleepForm((current) => ({ ...current, notes: event.target.value }))}
                      rows={3}
                      placeholder="Optional notes like waking often, trouble falling asleep, vivid dreams, or feeling rested"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                      {editingSleepId ? "Update sleep" : "Save sleep"}
                    </button>
                    {editingSleepId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSleepForm(emptySleepForm);
                          setEditingSleepId(null);
                        }}
                        className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </form>
                  <div className="space-y-4">
                    {sleepTrendSeries.map((series) => (
                      <div key={series.name} className="rounded-[1.5rem] bg-canvas p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold">{series.name}</p>
                            <p className="text-sm text-slate">{series.changeLabel}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate">Latest</p>
                            <p className="text-lg font-semibold">{series.latestValue} {series.unit}</p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-[1rem] bg-white p-3">
                          <Sparkline points={series.points} color={getTrendColor(series.points)} />
                        </div>
                      </div>
                    ))}
                    <div className="space-y-3">
                      {sortedSleepLogs.length ? (
                        [...sortedSleepLogs].reverse().slice(0, 4).map((entry) => (
                          <div key={entry.id} className="rounded-[1rem] bg-white p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold">{entry.hoursSlept} hours</p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate">{formatDateLabel(entry.date)}</span>
                                <button
                                  type="button"
                                  onClick={() => startSleepEdit(entry)}
                                  className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSleep(entry.id)}
                                  className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-slate">
                              {entry.quality} sleep
                              {entry.bedtime ? ` | Bedtime ${entry.bedtime}` : ""}
                              {entry.wakeTime ? ` | Wake ${entry.wakeTime}` : ""}
                            </p>
                            {entry.notes ? <p className="mt-2 text-sm text-slate">{entry.notes}</p> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No sleep entries saved yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </article>

              <article id="exercise-tracker" className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("exerciseTracker")}>
                <p className="text-sm uppercase tracking-[0.2em] text-slate">Exercise tracker</p>
                <h2 className="mt-2 text-2xl font-semibold">Track movement, duration, and how each workout felt</h2>
                <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <form className="grid gap-3" onSubmit={handleExerciseSubmit}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={exerciseForm.date}
                        onChange={(event) => setExerciseForm((current) => ({ ...current, date: event.target.value }))}
                        type="date"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={exerciseForm.durationMinutes}
                        onChange={(event) =>
                          setExerciseForm((current) => ({ ...current, durationMinutes: event.target.value }))
                        }
                        placeholder="Minutes"
                        inputMode="numeric"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                    </div>
                    <input
                      value={exerciseForm.activityType}
                      onChange={(event) =>
                        setExerciseForm((current) => ({ ...current, activityType: event.target.value }))
                      }
                      placeholder="Activity, like walk, cycling, yoga, or strength routine"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <select
                      value={exerciseForm.intensity}
                      onChange={(event) =>
                        setExerciseForm((current) => ({
                          ...current,
                          intensity: event.target.value as "Light" | "Moderate" | "Vigorous"
                        }))
                      }
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    >
                      <option value="Light">Light</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Vigorous">Vigorous</option>
                    </select>
                    <textarea
                      value={exerciseForm.notes}
                      onChange={(event) => setExerciseForm((current) => ({ ...current, notes: event.target.value }))}
                      rows={3}
                      placeholder="Optional notes like energy, soreness, dizziness, shortness of breath, or what felt good"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                      {editingExerciseId ? "Update exercise" : "Save exercise"}
                    </button>
                    {editingExerciseId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setExerciseForm(emptyExerciseForm);
                          setEditingExerciseId(null);
                        }}
                        className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </form>
                  <div className="space-y-4">
                    {exerciseTrendSeries.map((series) => (
                      <div key={series.name} className="rounded-[1.5rem] bg-canvas p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold">{series.name}</p>
                            <p className="text-sm text-slate">{series.changeLabel}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate">Latest</p>
                            <p className="text-lg font-semibold">{series.latestValue} {series.unit}</p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-[1rem] bg-white p-3">
                          <Sparkline points={series.points} color={getTrendColor(series.points)} />
                        </div>
                      </div>
                    ))}
                    <div className="space-y-3">
                      {sortedExerciseLogs.length ? (
                        [...sortedExerciseLogs].reverse().slice(0, 4).map((entry) => (
                          <div key={entry.id} className="rounded-[1rem] bg-white p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold">{entry.activityType}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate">{formatDateLabel(entry.date)}</span>
                                <button
                                  type="button"
                                  onClick={() => startExerciseEdit(entry)}
                                  className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteExercise(entry.id)}
                                  className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-slate">
                              {entry.durationMinutes} minutes | {entry.intensity} intensity
                            </p>
                            {entry.notes ? <p className="mt-2 text-sm text-slate">{entry.notes}</p> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No exercise entries saved yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </article>

              <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("moodTracker")}>
                <p className="text-sm uppercase tracking-[0.2em] text-slate">Mood check-in</p>
                <h2 className="mt-2 text-2xl font-semibold">Track mood, stress, and what helped on better or harder days</h2>
                <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <form className="grid gap-3" onSubmit={handleMoodSubmit}>
                    <input
                      value={moodForm.date}
                      onChange={(event) => setMoodForm((current) => ({ ...current, date: event.target.value }))}
                      type="date"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        value={moodForm.mood}
                        onChange={(event) =>
                          setMoodForm((current) => ({
                            ...current,
                            mood: event.target.value as "Low" | "Okay" | "Good" | "Great"
                          }))
                        }
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      >
                        <option value="Low">Low</option>
                        <option value="Okay">Okay</option>
                        <option value="Good">Good</option>
                        <option value="Great">Great</option>
                      </select>
                      <select
                        value={moodForm.stressLevel}
                        onChange={(event) =>
                          setMoodForm((current) => ({
                            ...current,
                            stressLevel: event.target.value as "Low" | "Medium" | "High"
                          }))
                        }
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      >
                        <option value="Low">Low stress</option>
                        <option value="Medium">Medium stress</option>
                        <option value="High">High stress</option>
                      </select>
                    </div>
                    <textarea
                      value={moodForm.anxietyNotes}
                      onChange={(event) => setMoodForm((current) => ({ ...current, anxietyNotes: event.target.value }))}
                      rows={3}
                      placeholder="Anxiety or low-mood notes, like racing thoughts, irritability, overwhelm, or a hard day"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <textarea
                      value={moodForm.whatHelped}
                      onChange={(event) => setMoodForm((current) => ({ ...current, whatHelped: event.target.value }))}
                      rows={2}
                      placeholder="What helped, like a walk, quiet time, better sleep, support from someone, or hydration"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <textarea
                      value={moodForm.notes}
                      onChange={(event) => setMoodForm((current) => ({ ...current, notes: event.target.value }))}
                      rows={2}
                      placeholder="Anything else you want to remember about the day"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                      {editingMoodId ? "Update mood check-in" : "Save mood check-in"}
                    </button>
                    {editingMoodId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMoodForm(emptyMoodForm);
                          setEditingMoodId(null);
                        }}
                        className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </form>
                  <div className="space-y-4">
                    {moodTrendSeries.map((series) => (
                      <div key={series.name} className="rounded-[1.5rem] bg-canvas p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold">{series.name}</p>
                            <p className="text-sm text-slate">{series.changeLabel}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate">Latest</p>
                            <p className="text-lg font-semibold">{latestMood ? latestMood.mood : series.latestValue}</p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-[1rem] bg-white p-3">
                          <Sparkline points={series.points} color="#d97706" />
                        </div>
                      </div>
                    ))}
                    <div className="space-y-3">
                      {sortedMoodLogs.length ? (
                        [...sortedMoodLogs].reverse().slice(0, 4).map((entry) => (
                          <div key={entry.id} className="rounded-[1rem] bg-white p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold">{entry.mood}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate">{formatDateLabel(entry.date)}</span>
                                <button
                                  type="button"
                                  onClick={() => startMoodEdit(entry)}
                                  className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteMood(entry.id)}
                                  className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-slate">{entry.stressLevel} stress</p>
                            {entry.anxietyNotes ? <p className="mt-2 text-sm text-slate"><span className="font-semibold text-ink">Mental health notes:</span> {entry.anxietyNotes}</p> : null}
                            {entry.whatHelped ? <p className="mt-2 text-sm text-slate"><span className="font-semibold text-ink">What helped:</span> {entry.whatHelped}</p> : null}
                            {entry.notes ? <p className="mt-2 text-sm text-slate">{entry.notes}</p> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No mood check-ins saved yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </article>

              <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("glucoseTracker")}>
                <p className="text-sm uppercase tracking-[0.2em] text-slate">Glucose tracker</p>
                <h2 className="mt-2 text-2xl font-semibold">Track blood sugar readings, timing, and meal context</h2>
                <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <form className="grid gap-3" onSubmit={handleGlucoseSubmit}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={glucoseForm.date}
                        onChange={(event) => setGlucoseForm((current) => ({ ...current, date: event.target.value }))}
                        type="date"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={glucoseForm.time}
                        onChange={(event) => setGlucoseForm((current) => ({ ...current, time: event.target.value }))}
                        type="text"
                        placeholder="Time, like 7:30 AM"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={glucoseForm.value}
                        onChange={(event) => setGlucoseForm((current) => ({ ...current, value: event.target.value }))}
                        placeholder="Glucose value"
                        inputMode="decimal"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={glucoseForm.unit}
                        onChange={(event) => setGlucoseForm((current) => ({ ...current, unit: event.target.value }))}
                        placeholder="Unit"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                    </div>
                    <select
                      value={glucoseForm.context}
                      onChange={(event) =>
                        setGlucoseForm((current) => ({
                          ...current,
                          context: event.target.value as "Fasting" | "Before meal" | "After meal" | "Bedtime" | "Other"
                        }))
                      }
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    >
                      <option value="Fasting">Fasting</option>
                      <option value="Before meal">Before meal</option>
                      <option value="After meal">After meal</option>
                      <option value="Bedtime">Bedtime</option>
                      <option value="Other">Other</option>
                    </select>
                    <textarea
                      value={glucoseForm.notes}
                      onChange={(event) => setGlucoseForm((current) => ({ ...current, notes: event.target.value }))}
                      rows={3}
                      placeholder="Optional notes like meal timing, exercise, symptoms, or anything unusual"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                      {editingGlucoseId ? "Update glucose" : "Save glucose"}
                    </button>
                    {editingGlucoseId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setGlucoseForm(emptyGlucoseForm);
                          setEditingGlucoseId(null);
                        }}
                        className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </form>
                  <div className="space-y-4">
                    {glucoseTrendSeries.length ? (
                      glucoseTrendSeries.slice(0, 3).map((series) => (
                        <div key={series.name} className="rounded-[1.5rem] bg-canvas p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-semibold">{series.name}</p>
                              <p className="text-sm text-slate">{series.changeLabel}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate">Latest</p>
                              <p className="text-lg font-semibold">{series.latestValue} {series.unit}</p>
                            </div>
                          </div>
                          <div className="mt-4 rounded-[1rem] bg-white p-3">
                            <Sparkline points={series.points} color={getTrendColor(series.points)} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1.25rem] bg-canvas p-4 text-sm leading-6 text-slate">
                        Add glucose readings to see how blood sugar changes over time.
                      </div>
                    )}
                    <div className="space-y-3">
                      {sortedGlucoseLogs.length ? (
                        sortedGlucoseLogs.slice(0, 4).map((entry) => (
                          <div key={entry.id} className="rounded-[1rem] bg-white p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold">{entry.value} {entry.unit}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate">
                                  {formatDateLabel(entry.date)}{entry.time ? ` | ${entry.time}` : ""}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => startGlucoseEdit(entry)}
                                  className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteGlucose(entry.id)}
                                  className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-slate">{entry.context}</p>
                            {entry.notes ? <p className="mt-2 text-sm text-slate">{entry.notes}</p> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No glucose readings saved yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </article>

              <article id="water-intake" className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("waterIntake")}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate">Water intake</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-2xl font-semibold">Track hydration and see the graph</h2>
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${syncStatusMeta.className}`}>{syncStatusMeta.label}</div>
                    </div>
                  </div>
                  <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                    {latestWaterIntake ? `${latestWaterIntake.amount} ${latestWaterIntake.unit}` : "No entries"}
                  </div>
                </div>
                <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <form className="grid gap-3" onSubmit={handleWaterIntakeSubmit}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={waterIntakeForm.date}
                        onChange={(event) => setWaterIntakeForm((current) => ({ ...current, date: event.target.value }))}
                        type="date"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={waterIntakeForm.amount}
                        onChange={(event) => setWaterIntakeForm((current) => ({ ...current, amount: event.target.value }))}
                        placeholder="Amount"
                        inputMode="decimal"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={waterIntakeForm.unit}
                        onChange={(event) => setWaterIntakeForm((current) => ({ ...current, unit: event.target.value }))}
                        placeholder="Unit"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent sm:col-span-2"
                      />
                    </div>
                    <textarea
                      value={waterIntakeForm.notes}
                      onChange={(event) => setWaterIntakeForm((current) => ({ ...current, notes: event.target.value }))}
                      rows={3}
                      placeholder="Optional notes about goals, exercise, or how hydrated you felt"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                      {editingWaterIntakeId ? "Update water intake" : "Save water intake"}
                    </button>
                    {editingWaterIntakeId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setWaterIntakeForm(emptyWaterIntakeForm);
                          setEditingWaterIntakeId(null);
                        }}
                        className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </form>
                  <div className="space-y-4">
                    <form className="rounded-[1.5rem] bg-canvas p-4" onSubmit={handleHydrationGoalSave}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">Daily hydration goal</p>
                          <p className="text-sm text-slate">
                            {latestWaterForToday
                              ? `${latestWaterForToday.amount} ${latestWaterForToday.unit} logged for ${formatDateLabel(latestWaterForToday.date)}`
                              : "No water intake logged yet"}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700">
                          {Math.round(hydrationGoalProgress)}%
                        </span>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                          style={{ width: `${hydrationGoalProgress}%` }}
                        />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <input
                          value={hydrationGoalForm.amount}
                          onChange={(event) => setHydrationGoalForm((current) => ({ ...current, amount: event.target.value }))}
                          placeholder="Goal amount"
                          inputMode="decimal"
                          className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                        />
                        <input
                          value={hydrationGoalForm.unit}
                          onChange={(event) => setHydrationGoalForm((current) => ({ ...current, unit: event.target.value }))}
                          placeholder="Goal unit"
                          className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                        />
                      </div>
                      <button type="submit" className="mt-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink">
                        Save hydration goal
                      </button>
                    </form>
                    {waterIntakeTrendSeries.map((series) => (
                      <div key={series.name} className="rounded-[1.5rem] bg-canvas p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold">{series.name}</p>
                            <p className="text-sm text-slate">{series.changeLabel}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate">Latest</p>
                            <p className="text-lg font-semibold">{series.latestValue} {series.unit}</p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-[1rem] bg-white p-3">
                          <Sparkline points={series.points} color="#1f7a5f" />
                        </div>
                      </div>
                    ))}
                    <div className="space-y-3">
                      {sortedWaterIntakeLogs.length ? (
                        [...sortedWaterIntakeLogs].reverse().slice(0, 4).map((entry) => (
                          <div key={entry.id} className="rounded-[1rem] bg-white p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold">{entry.amount} {entry.unit}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate">{formatDateLabel(entry.date)}</span>
                                <button
                                  type="button"
                                  onClick={() => startWaterIntakeEdit(entry)}
                                  className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteWaterIntake(entry.id)}
                                  className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            {entry.notes ? <p className="mt-2 text-sm text-slate">{entry.notes}</p> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No water intake entries saved yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </article>

                <article id="medications" className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("medications")}>
                <p className="text-sm uppercase tracking-[0.2em] text-slate">Medication tracker</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl font-semibold">Keep medications, reminders, and refill timing in one place</h2>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${syncStatusMeta.className}`}>{syncStatusMeta.label}</div>
                  </div>
                  <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                  <form className="grid gap-3" onSubmit={handleMedicationSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={medicationForm.name}
                      onChange={(event) => setMedicationForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Medication name"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={medicationForm.dose}
                      onChange={(event) => setMedicationForm((current) => ({ ...current, dose: event.target.value }))}
                      placeholder="Dose"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={medicationForm.schedule}
                      onChange={(event) => setMedicationForm((current) => ({ ...current, schedule: event.target.value }))}
                      placeholder="Schedule"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={medicationForm.startDate}
                      onChange={(event) => setMedicationForm((current) => ({ ...current, startDate: event.target.value }))}
                      type="date"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={medicationForm.purpose}
                      onChange={(event) => setMedicationForm((current) => ({ ...current, purpose: event.target.value }))}
                      placeholder="Purpose"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={medicationForm.prescriber}
                      onChange={(event) => setMedicationForm((current) => ({ ...current, prescriber: event.target.value }))}
                      placeholder="Prescriber"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                  </div>
                    <select
                      value={medicationForm.status}
                      onChange={(event) =>
                        setMedicationForm((current) => ({ ...current, status: event.target.value as "active" | "paused" | "stopped" }))
                      }
                    className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                  >
                    <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="stopped">Stopped</option>
                    </select>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={medicationForm.refillDate}
                        onChange={(event) => setMedicationForm((current) => ({ ...current, refillDate: event.target.value }))}
                        type="date"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <input
                        value={medicationForm.reminderTime}
                        onChange={(event) => setMedicationForm((current) => ({ ...current, reminderTime: event.target.value }))}
                        placeholder="Reminder time, like 8:00 AM"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select
                          value={medicationForm.responseStatus}
                          onChange={(event) =>
                            setMedicationForm((current) => ({
                              ...current,
                              responseStatus: event.target.value as "helpful" | "neutral" | "hard-to-tolerate"
                            }))
                          }
                          className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                        >
                          <option value="helpful">Feels helpful</option>
                          <option value="neutral">Feels neutral</option>
                          <option value="hard-to-tolerate">Hard to tolerate</option>
                        </select>
                        <input
                          value={medicationForm.lastReviewedOn}
                          onChange={(event) => setMedicationForm((current) => ({ ...current, lastReviewedOn: event.target.value }))}
                          type="date"
                          className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                        />
                      </div>
                      <textarea
                        value={medicationForm.sideEffects}
                        onChange={(event) => setMedicationForm((current) => ({ ...current, sideEffects: event.target.value }))}
                        rows={2}
                        placeholder="Side effects or changes noticed, like nausea, dizziness, better sleep, or no issues"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <textarea
                        value={medicationForm.responseNotes}
                        onChange={(event) => setMedicationForm((current) => ({ ...current, responseNotes: event.target.value }))}
                        rows={2}
                        placeholder="How is this medication going overall? Helpful, unchanged, hard to stay on, etc."
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <label className="flex items-center gap-3 rounded-[1rem] border border-ink/10 bg-white px-4 py-3 text-sm text-ink">
                      <input
                        checked={medicationForm.reminderEnabled}
                        onChange={(event) =>
                          setMedicationForm((current) => ({ ...current, reminderEnabled: event.target.checked }))
                        }
                        type="checkbox"
                        className="h-4 w-4 accent-accent"
                      />
                      Turn on a daily reminder for this medication
                    </label>
                    <textarea
                      value={medicationForm.notes}
                      onChange={(event) => setMedicationForm((current) => ({ ...current, notes: event.target.value }))}
                    rows={3}
                    placeholder="Notes about side effects, refill timing, or follow-up checks"
                    className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                  />
                  <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                    {editingMedicationId ? "Update medication" : "Save medication"}
                  </button>
                  {editingMedicationId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMedicationForm(emptyMedicationForm);
                        setEditingMedicationId(null);
                      }}
                      className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                  </form>
                  <div className="rounded-[1.5rem] bg-canvas p-4">
                    <p className="text-sm leading-7 text-slate">{medicationSummary}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1rem] bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">Refill watch</p>
                        <p className="mt-2 text-lg font-semibold text-ink">{refillAlerts.length}</p>
                        <p className="mt-1 text-sm text-slate">
                          {overdueRefills.length
                            ? `${overdueRefills.length} overdue now`
                            : upcomingRefills.length
                              ? `${upcomingRefills.length} due in the next week`
                              : "No refill dates need attention right now"}
                        </p>
                      </div>
                      <div className="rounded-[1rem] bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">Reminder setup</p>
                        <p className="mt-2 text-lg font-semibold text-ink">{reminderMedications.length}</p>
                        <p className="mt-1 text-sm text-slate">
                          {reminderMedications.length
                            ? `${reminderMedications.length} active medication reminder${reminderMedications.length === 1 ? "" : "s"} saved`
                            : "No reminder times saved yet"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-[1rem] bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">Daily checklist</p>
                      <p className="mt-2 text-lg font-semibold text-ink">
                        {takenTodayMedications.length}/{activeMedications.length}
                      </p>
                      <p className="mt-1 text-sm text-slate">
                        {dueTodayMedications.length
                          ? `${dueTodayMedications.length} active medication${dueTodayMedications.length === 1 ? "" : "s"} still need to be marked taken today`
                          : activeMedications.length
                            ? "All active medications are marked taken today"
                            : "Add an active medication to use the checklist"}
                      </p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {state.medications.slice(0, 6).map((entry) => (
                        <div key={entry.id} className="rounded-[1rem] bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold">{entry.name}</p>
                          <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-slate">{entry.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate">
                          {entry.dose} | {entry.schedule}
                        </p>
                          <p className="mt-2 text-sm text-slate">
                            {entry.purpose || "No purpose recorded"}{entry.prescriber ? ` | Prescriber: ${entry.prescriber}` : ""}
                          </p>
                          {entry.startDate ? <p className="mt-2 text-xs text-slate">Started {formatDateLabel(entry.startDate)}</p> : null}
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {entry.lastTakenOn === todayIso ? (
                                <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">
                                  Taken today
                                </span>
                            ) : entry.status === "active" ? (
                              <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
                                Still due today
                              </span>
                            ) : null}
                            {entry.reminderEnabled ? (
                              <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent">
                                Reminder{entry.reminderTime ? ` at ${formatTimeLabel(entry.reminderTime)}` : " on"}
                              </span>
                            ) : null}
                            {entry.refillDate ? (
                              <span
                                className={`rounded-full px-3 py-1 font-semibold ${
                                  entry.refillDate <= todayIso
                                    ? "bg-rose/10 text-rose"
                                    : entry.refillDate <= refillSoonIso
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-canvas text-slate"
                                }`}
                                >
                                  Refill by {formatDateLabel(entry.refillDate)}
                                </span>
                              ) : null}
                              <span
                                className={`rounded-full px-3 py-1 font-semibold ${
                                  entry.responseStatus === "helpful"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : entry.responseStatus === "hard-to-tolerate"
                                      ? "bg-rose/10 text-rose"
                                      : "bg-sky-100 text-sky-700"
                                }`}
                              >
                                {entry.responseStatus === "helpful"
                                  ? "Feels helpful"
                                  : entry.responseStatus === "hard-to-tolerate"
                                    ? "Hard to tolerate"
                                    : "Feels neutral"}
                              </span>
                            </div>
                            {entry.lastReviewedOn ? (
                              <p className="mt-2 text-xs text-slate">Last response check {formatDateLabel(entry.lastReviewedOn)}</p>
                            ) : null}
                            {entry.sideEffects ? (
                              <p className="mt-2 text-sm text-slate">
                                <span className="font-semibold text-ink">Side effects:</span> {entry.sideEffects}
                              </p>
                            ) : null}
                            {entry.responseNotes ? (
                              <p className="mt-2 text-sm text-slate">
                                <span className="font-semibold text-ink">Response:</span> {entry.responseNotes}
                              </p>
                            ) : null}
                            {entry.notes ? <p className="mt-2 text-sm text-slate">{entry.notes}</p> : null}
                          <div className="mt-3 flex gap-2">
                            {entry.status === "active" ? (
                              entry.lastTakenOn === todayIso ? (
                                <button
                                  type="button"
                                  onClick={() => clearMedicationTakenToday(entry.id)}
                                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                                >
                                  Undo today
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => markMedicationTaken(entry.id)}
                                  className="rounded-full border border-emerald-200 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                                >
                                  Mark taken today
                                </button>
                              )
                            ) : null}
                            <button
                              type="button"
                              onClick={() => startMedicationEdit(entry)}
                            className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMedication(entry.id)}
                            className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("dietTracker")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Diet tracker</p>
              <h2 className="mt-2 text-2xl font-semibold">Save meals, patterns, and how they felt</h2>
              <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <form className="grid gap-3" onSubmit={handleDietSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={dietForm.date} onChange={(event) => setDietForm((current) => ({ ...current, date: event.target.value }))} type="date" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                    <input value={dietForm.mealType} onChange={(event) => setDietForm((current) => ({ ...current, mealType: event.target.value }))} placeholder="Meal type" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                  </div>
                  <input value={dietForm.summary} onChange={(event) => setDietForm((current) => ({ ...current, summary: event.target.value }))} placeholder="What did you eat?" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                  <textarea value={dietForm.notes} onChange={(event) => setDietForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="How did it affect energy, symptoms, or appetite?" className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent" />
                  <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                    {editingDietId ? "Update diet entry" : "Save diet entry"}
                  </button>
                  {editingDietId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDietForm(emptyDietForm);
                        setEditingDietId(null);
                      }}
                      className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </form>
                <div className="rounded-[1.5rem] bg-canvas p-4">
                  <p className="text-sm leading-7 text-slate">{dietSummary}</p>
                  <div className="mt-4 space-y-3">
                    {state.dietLogs.length ? (
                      state.dietLogs.slice(0, 4).map((entry) => (
                        <div key={entry.id} className="rounded-[1rem] bg-white p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">{entry.mealType}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate">{formatDateLabel(entry.date)}</span>
                              <button
                                type="button"
                                onClick={() => startDietEdit(entry)}
                                className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteDiet(entry.id)}
                                className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-slate">{entry.summary}</p>
                          {entry.notes ? <p className="mt-2 text-sm text-slate">{entry.notes}</p> : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No diet entries saved yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </article>

            <article id="messages" className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("doctorMessaging")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Doctor messaging</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">Inbox, outbox, and draft messages in one place</h2>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${syncStatusMeta.className}`}>{syncStatusMeta.label}</div>
                </div>
                <div className="mt-5 rounded-[1.5rem] bg-canvas p-4">
                <p className="text-sm leading-7 text-slate">{doctorMessageSummary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {([
                    ["inbox", "Inbox"],
                    ["sent", "Sent"],
                    ["drafts", "Drafts"]
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSelectedMailbox(value)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        selectedMailbox === value ? "bg-accent text-white" : "bg-white text-slate"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {([
                    ["all", "All"],
                    ["unread", "Unread"],
                    ["read", "Read"]
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSelectedReadFilter(value)}
                      className={`rounded-full px-3 py-2 text-xs font-semibold ${
                        selectedReadFilter === value ? "bg-ink text-white" : "bg-white text-slate"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[1.5rem] bg-canvas p-4">
                  <div className="space-y-3">
                    {threadSummaries.length ? (
                      threadSummaries.map((thread) => (
                        <button
                          key={thread.threadId}
                          type="button"
                          onClick={() => setSelectedMessageId(thread.latest.id)}
                          className={`w-full rounded-[1rem] p-4 text-left transition ${
                            selectedThread?.threadId === thread.threadId ? "bg-white shadow-sm" : "bg-white/65 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">{thread.latest.subject}</p>
                            <div className="flex items-center gap-2">
                              {thread.unreadCount ? (
                                <span className="rounded-full bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent">
                                  {thread.unreadCount} unread
                                </span>
                              ) : null}
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">
                                {thread.latest.status}
                              </span>
                            </div>
                          </div>
                          <p className="mt-1 text-sm text-slate">
                            {thread.latest.from} to {thread.latest.to}
                          </p>
                          <p className="mt-2 line-clamp-2 text-sm text-slate">{thread.latest.message}</p>
                          <p className="mt-2 text-xs text-slate">
                            {thread.messages.length} message{thread.messages.length === 1 ? "" : "s"} | {formatDateLabel(thread.latest.date)}
                          </p>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No conversation threads in this folder yet.</div>
                    )}
                  </div>
                </div>

                <div className="grid gap-5">
                  <div className="rounded-[1.5rem] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm uppercase tracking-[0.14em] text-slate">Selected thread</p>
                      <div className="flex gap-2">
                        {selectedThread ? (
                          <>
                            <button
                              type="button"
                              onClick={() => markThreadReadState(selectedThread.threadId, false)}
                              className="rounded-full border border-ink/10 bg-canvas px-3 py-2 text-xs font-semibold text-ink"
                            >
                              Mark unread
                            </button>
                            <button
                              type="button"
                              onClick={() => markThreadReadState(selectedThread.threadId, true)}
                              className="rounded-full border border-ink/10 bg-canvas px-3 py-2 text-xs font-semibold text-ink"
                            >
                              Mark read
                            </button>
                            <button
                              type="button"
                              onClick={startReplyToThread}
                              className="rounded-full border border-ink/10 bg-canvas px-3 py-2 text-xs font-semibold text-ink"
                            >
                              Reply in thread
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {selectedThread ? (
                      <div className="mt-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-xl font-semibold">{selectedThread.latest.subject}</h3>
                          <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-slate">
                            {selectedThread.messages.length} message{selectedThread.messages.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="mt-4 space-y-3">
                          {selectedThreadMessages.map((message) => (
                            <div key={message.id} className="rounded-[1rem] bg-canvas p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="font-semibold">
                                  {message.from} to {message.to}
                                </p>
                                <div className="flex items-center gap-2">
                                  {message.priority === "high" ? (
                                    <span className="rounded-full bg-rose/10 px-2 py-1 text-[11px] font-semibold text-rose">High priority</span>
                                  ) : null}
                                  <span className="text-xs text-slate">{formatDateLabel(message.date)}</span>
                                </div>
                              </div>
                              <p className="mt-2 text-sm leading-7 text-slate">{message.message}</p>
                              {message.attachments.length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {message.attachments.map((attachment) => (
                                    <button
                                      key={attachment.id}
                                      type="button"
                                      onClick={() => openMessageAttachment(attachment)}
                                      className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                                    >
                                      {openingAttachmentId === attachment.id ? "Opening..." : `Attachment: ${attachment.name}`}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate">Choose a conversation thread from the folder list to read it here.</p>
                    )}
                  </div>

                  <form className="rounded-[1.5rem] bg-white p-4 grid gap-3" onSubmit={handleDoctorMessageSubmit}>
                    <p className="text-sm uppercase tracking-[0.14em] text-slate">Compose message</p>
                    {replyThreadId ? (
                      <div className="flex items-center justify-between gap-3 rounded-[1rem] bg-canvas px-4 py-3 text-sm text-slate">
                        <span>Replying inside the current conversation thread</span>
                        <button type="button" onClick={cancelReplyThread} className="font-semibold text-ink">
                          Cancel reply
                        </button>
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={doctorMessageForm.date}
                        onChange={(event) => setDoctorMessageForm((current) => ({ ...current, date: event.target.value }))}
                        type="date"
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      />
                      <select
                        value={doctorMessageForm.status}
                        onChange={(event) =>
                          setDoctorMessageForm((current) => ({ ...current, status: event.target.value as "draft" | "sent" | "received" }))
                        }
                        className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="received">Received</option>
                      </select>
                    </div>
                    <select
                      value={doctorMessageForm.priority}
                      onChange={(event) =>
                        setDoctorMessageForm((current) => ({ ...current, priority: event.target.value as "routine" | "high" }))
                      }
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    >
                      <option value="routine">Routine priority</option>
                      <option value="high">High priority</option>
                    </select>
                    <input
                      value={doctorMessageForm.to}
                      onChange={(event) => setDoctorMessageForm((current) => ({ ...current, to: event.target.value }))}
                      placeholder="To"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <input
                      value={doctorMessageForm.subject}
                      onChange={(event) => setDoctorMessageForm((current) => ({ ...current, subject: event.target.value }))}
                      placeholder="Subject"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <label className="rounded-[1rem] border border-dashed border-ink/10 bg-canvas px-4 py-3 text-sm text-slate">
                      Attach secure files
                      <input type="file" multiple className="mt-2 block w-full text-sm text-slate" onChange={handleMessageAttachmentUpload} />
                    </label>
                    <p className="text-sm text-slate">{messageAttachmentStatus}</p>
                    {doctorMessageForm.attachments.length ? (
                      <div className="flex flex-wrap gap-2">
                        {doctorMessageForm.attachments.map((attachment) => (
                          <button
                            key={attachment.id}
                            type="button"
                            onClick={() => removeDraftAttachment(attachment.id)}
                            className="rounded-full border border-ink/10 bg-canvas px-3 py-2 text-xs font-semibold text-ink"
                          >
                            Remove {attachment.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <textarea
                      value={doctorMessageForm.message}
                      onChange={(event) => setDoctorMessageForm((current) => ({ ...current, message: event.target.value }))}
                      rows={5}
                      placeholder="Write the message here"
                      className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
                    />
                    <button type="submit" className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">
                      {replyThreadId ? "Save reply" : "Save message"}
                    </button>
                  </form>
                </div>
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("trendExplorer")}>
                  <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate">Trend explorer</p>
                  <h2 className="mt-2 text-2xl font-semibold">Historical lab ranges generated from saved results</h2>
                </div>
                <div className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{trendSeries.length} tracked tests</div>
              </div>

              <div className="mt-6 grid gap-4">
                {trendSeries.map((series, index) => (
                  <div key={series.name} className="rounded-[1.25rem] border border-ink/10 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{series.name}</p>
                        <p className="text-sm text-slate">Reference range: {series.referenceRange}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate">Latest</p>
                        <p className="text-lg font-semibold">{series.latestValue} {series.unit}</p>
                        <p className="text-xs text-slate">{series.changeLabel}</p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-[1rem] bg-canvas p-3">
                      <Sparkline points={series.points} color={getTrendColor(series.points)} />
                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate">
                        {series.points.map((point) => (
                          <span key={`${series.name}-${point.date}`}>{point.date}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("savedRecords")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Saved records</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">Organized documents, parsing details, and lab context</h2>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${syncStatusMeta.className}`}>{syncStatusMeta.label}</div>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-4">
                  <div className="rounded-[1.25rem] bg-canvas p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">Record browser</p>
                        <p className="mt-1 text-sm text-slate">
                          {sortedUploadedRecords.length
                            ? `${sortedUploadedRecords.length} document${sortedUploadedRecords.length === 1 ? "" : "s"} saved across ${Object.keys(recordCategoryCounts).length} categor${Object.keys(recordCategoryCounts).length === 1 ? "y" : "ies"}.`
                            : "No uploaded documents yet."}
                        </p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                        {filteredUploadedRecords.length} showing
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {recordCategoryOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setRecordCategoryFilter(option)}
                          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                            recordCategoryFilter === option
                              ? "bg-accent text-white"
                              : "border border-ink/10 bg-white text-ink hover:border-accent hover:text-accent"
                          }`}
                        >
                          {option}
                          {option === "All" ? ` (${sortedUploadedRecords.length})` : ` (${recordCategoryCounts[option] ?? 0})`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {groupedUploadedRecords.length ? (
                    groupedUploadedRecords.map((group) => (
                      <div key={group.category} className="rounded-[1.25rem] bg-canvas p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{group.category}</p>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                            {group.records.length}
                          </span>
                        </div>
                        <div className="mt-4 space-y-3">
                          {group.records.map((record) => (
                            <div key={record.id} className="rounded-[1rem] bg-white p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold">{record.name}</p>
                                  <p className="mt-1 text-sm text-slate">{formatDateLabel(record.uploadedAt)} | {record.sizeLabel}</p>
                                </div>
                                <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-slate">
                                  {record.extractionStatus}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {record.storagePath ? (
                                  <button
                                    type="button"
                                    onClick={() => openSecureRecord(record.storagePath!, record.id)}
                                    className="rounded-full border border-ink/10 bg-canvas px-3 py-2 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
                                  >
                                    {openingRecordId === record.id ? "Opening..." : "Open secure file"}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => generateRecordSummary(record.id)}
                                  className="rounded-full border border-ink/10 bg-canvas px-3 py-2 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
                                >
                                  {summarizingRecordId === record.id ? "Summarizing..." : "Generate AI summary"}
                                </button>
                              </div>
                              {record.aiSummary ? (
                                <details className="mt-3 rounded-[1rem] bg-canvas p-3">
                                  <summary className="cursor-pointer text-sm font-semibold text-ink">View AI summary</summary>
                                  <p className="mt-2 text-sm leading-6 text-slate whitespace-pre-wrap">{record.aiSummary}</p>
                                </details>
                              ) : null}
                              {record.extractedText ? (
                                <details className="mt-3 rounded-[1rem] bg-canvas p-3">
                                  <summary className="cursor-pointer text-sm font-semibold text-ink">View extracted text</summary>
                                  <p className="mt-2 text-sm leading-6 text-slate whitespace-pre-wrap">
                                    {record.extractedText.slice(0, 1200)}
                                  </p>
                                </details>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.25rem] bg-canvas p-4 text-sm text-slate">
                      {sortedUploadedRecords.length
                        ? "No documents match the current category filter."
                        : "No uploaded documents yet."}
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-[1.25rem] border border-ink/10">
                  <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_1fr] bg-ink px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
                    <span>Test</span>
                    <span>Value</span>
                    <span>Date</span>
                    <span>Source</span>
                  </div>
                  <div className="max-h-[24rem] overflow-auto bg-white">
                    {sortedLabs.map((lab) => (
                      <div key={lab.id} className="grid grid-cols-[1.2fr_0.8fr_0.8fr_1fr] gap-3 border-t border-ink/5 px-4 py-3 text-sm">
                        <span className="font-medium">{lab.testName}</span>
                        <span>{lab.value} {lab.unit}</span>
                        <span>{new Date(lab.date).toLocaleDateString()}</span>
                        <span className="text-slate">{lab.source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6" hidden={!isSectionVisible("timeline")}>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Unified timeline</p>
              <h2 className="mt-2 text-2xl font-semibold">Everything added to the record set in date order</h2>
              <div className="mt-6 space-y-4">
                {timeline.map((event) => (
                  <div key={event.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="mt-1 h-3.5 w-3.5 rounded-full bg-accent" />
                      <div className="h-full w-px bg-ink/10" />
                    </div>
                    <div className="flex-1 rounded-[1.25rem] bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold">{event.title}</p>
                        <span className="text-sm text-slate">{formatDateLabel(event.date)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="panel rounded-[1.75rem] p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Detailed history archive</p>
              <h2 className="mt-2 text-2xl font-semibold">Browse the full appointment, change, and symptom records</h2>
            </div>
            <div className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              {state.appointments.length + state.careChanges.length + state.symptoms.length} timeline items
            </div>
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-4">
            <article className="rounded-[1.25rem] bg-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Appointments</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                  {state.appointments.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {state.appointments.length ? (
                  state.appointments
                    .slice()
                    .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate))
                    .map((appointment) => (
                      <div key={appointment.id} className="rounded-[1rem] bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-semibold">{appointment.provider}</p>
                            <span className="text-sm text-slate">
                              {formatDateLabel(appointment.appointmentDate)}{appointment.appointmentTime ? ` at ${formatTimeLabel(appointment.appointmentTime)}` : ""}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate">{appointment.specialty}</p>
                          {(appointment.visitType || appointment.location || appointment.durationMinutes) ? (
                            <p className="mt-2 text-sm text-slate">
                              {appointment.visitType || "Visit type not added"}{appointment.location ? ` | ${appointment.location}` : ""}{appointment.durationMinutes ? ` | ${appointment.durationMinutes} min` : ""}
                            </p>
                          ) : null}
                          <p className="mt-3 text-sm leading-6 text-slate">{appointment.notes}</p>
                        {appointment.followUp ? (
                          <p className="mt-3 text-sm leading-6 text-slate">
                            <span className="font-semibold text-ink">Follow-up:</span> {appointment.followUp}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => generateAppointmentSummary(appointment.id)}
                          className="mt-3 rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                        >
                          {summarizingAppointmentId === appointment.id ? "Summarizing..." : "Generate AI summary"}
                        </button>
                        {appointment.aiSummary ? (
                          <details className="mt-3 rounded-[0.85rem] bg-white p-3">
                            <summary className="cursor-pointer text-sm font-semibold text-ink">View AI summary</summary>
                            <p className="mt-2 text-sm leading-6 text-slate whitespace-pre-wrap">{appointment.aiSummary}</p>
                          </details>
                        ) : null}
                        {appointment.transcript ? (
                          <details className="mt-3 rounded-[0.85rem] bg-canvas p-3">
                            <summary className="cursor-pointer text-sm font-semibold text-ink">View transcript</summary>
                            <p className="mt-2 text-sm leading-6 text-slate">{appointment.transcript}</p>
                          </details>
                        ) : null}
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => startAppointmentEdit(appointment)}
                            className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAppointment(appointment.id)}
                            className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No appointments saved yet.</div>
                )}
              </div>
            </article>

            <article className="rounded-[1.25rem] bg-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Questions</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                  {state.doctorQuestions.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {state.doctorQuestions.length ? (
                  state.doctorQuestions
                    .slice()
                    .sort((a, b) => (Number(a.answered) - Number(b.answered)) || b.date.localeCompare(a.date))
                    .map((entry) => (
                      <div key={entry.id} className="rounded-[1rem] bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold">{entry.question}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.answered ? "bg-emerald-100 text-emerald-700" : entry.priority === "important" ? "bg-rose/10 text-rose" : "bg-amber-100 text-amber-700"}`}>
                            {entry.answered ? "Answered" : entry.priority === "important" ? "Important" : "Open"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate">{formatDateLabel(entry.date)}</p>
                        {entry.context ? <p className="mt-3 text-sm leading-6 text-slate">{entry.context}</p> : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => toggleDoctorQuestionAnswered(entry.id)}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                          >
                            {entry.answered ? "Mark open" : "Mark answered"}
                          </button>
                          <button
                            type="button"
                            onClick={() => startDoctorQuestionEdit(entry)}
                            className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDoctorQuestion(entry.id)}
                            className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No doctor questions saved yet.</div>
                )}
              </div>
            </article>

            <article className="rounded-[1.25rem] bg-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">After-visit changes</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                  {state.careChanges.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {state.careChanges.length ? (
                  state.careChanges
                    .slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((change) => (
                      <div key={change.id} className="rounded-[1rem] bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold">{change.category}</p>
                          <span className="text-sm text-slate">{formatDateLabel(change.date)}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate">{change.change}</p>
                        {change.effect ? (
                          <p className="mt-3 text-sm leading-6 text-slate">
                            <span className="font-semibold text-ink">How it is going:</span> {change.effect}
                          </p>
                        ) : null}
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => startCareChangeEdit(change)}
                            className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCareChange(change.id)}
                            className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No after-visit changes saved yet.</div>
                )}
              </div>
            </article>

            <article className="rounded-[1.25rem] bg-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Symptoms</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate">
                  {state.symptoms.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {state.symptoms.length ? (
                  state.symptoms
                    .slice()
                    .sort((a, b) => b.startedOn.localeCompare(a.startedOn))
                    .map((symptom) => (
                      <div key={symptom.id} className="rounded-[1rem] bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold">{symptom.symptom}</p>
                          <span className="text-sm text-slate">
                            {symptom.startedOn ? formatDateLabel(symptom.startedOn) : "Start date not set"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate">
                          {symptom.severity} | {symptom.frequency}
                        </p>
                        {symptom.notes ? <p className="mt-3 text-sm leading-6 text-slate">{symptom.notes}</p> : null}
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => startSymptomEdit(symptom)}
                            className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSymptom(symptom.id)}
                            className="rounded-full border border-rose/20 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="rounded-[1rem] bg-white p-4 text-sm text-slate">No symptoms saved yet.</div>
                )}
              </div>
            </article>
          </div>
        </section>

        <section className="panel rounded-[1.75rem] p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate">Personalize the app</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">Choose what stays visible and what goes into the packet</h2>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${syncStatusMeta.className}`}>{syncStatusMeta.label}</div>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate">
                These settings are saved with this person&apos;s dashboard. You can change them any time without deleting any of the underlying health data.
              </p>
            </div>
            <div className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-slate">
              {appSectionOptions.filter((section) => isSectionVisible(section.id)).length}/{appSectionOptions.length} app sections visible
            </div>
          </div>
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <div className="rounded-[1.5rem] bg-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.16em] text-slate">Visible in the app</p>
                  <p className="mt-1 text-sm text-slate">Turn sections on or off for this person&apos;s dashboard.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    appSectionOptions.forEach((section) => updateSectionPreference(section.id, "showInApp", true));
                  }}
                  className="rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 hover:text-orange-800"
                >
                  Show all
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {appSectionOptions.map((section) => (
                  <div key={section.id} className="rounded-[1rem] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{section.label}</p>
                        <p className="mt-1 text-sm text-slate">{section.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateSectionPreference(section.id, "showInApp", !isSectionVisible(section.id))}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                          isSectionVisible(section.id)
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "border border-ink/10 bg-canvas text-slate hover:border-accent hover:text-accent"
                        }`}
                      >
                        {isSectionVisible(section.id) ? "Visible" : "Hidden"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.16em] text-slate">Saved in the printable packet</p>
                  <p className="mt-1 text-sm text-slate">Control which highlights appear when this person prints the patient packet.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    packetSectionOptions.forEach((section) => updateSectionPreference(section.id, "includeInPacket", true));
                  }}
                  className="rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 hover:text-orange-800"
                >
                  Include all
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {packetSectionOptions.map((section) => (
                  <div key={section.id} className="rounded-[1rem] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{section.label}</p>
                        <p className="mt-1 text-sm text-slate">{section.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateSectionPreference(section.id, "includeInPacket", !isPacketSectionIncluded(section.id))}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                          isPacketSectionIncluded(section.id)
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "border border-ink/10 bg-canvas text-slate hover:border-accent hover:text-accent"
                        }`}
                      >
                        {isPacketSectionIncluded(section.id) ? "Included" : "Excluded"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-ink/10 pt-6">
          <p className="text-sm uppercase tracking-[0.2em] text-slate">What this MVP supports today</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.25rem] bg-canvas p-4">
              <p className="font-semibold">Cloud persistence</p>
              <p className="mt-2 text-sm leading-6 text-slate">Patient profile, labs, uploaded record details, and messages now sync to a secure backend workspace.</p>
            </div>
            <div className="rounded-[1.25rem] bg-canvas p-4">
              <p className="font-semibold">CSV lab import</p>
              <p className="mt-2 text-sm leading-6 text-slate">Users can bulk-import structured lab data and keep it attached to their signed-in account.</p>
            </div>
            <div className="rounded-[1.25rem] bg-canvas p-4">
              <p className="font-semibold">Generated summaries</p>
              <p className="mt-2 text-sm leading-6 text-slate">Explanation cards and trend views now come from the saved lab records instead of mock text.</p>
            </div>
            <div className="rounded-[1.25rem] bg-canvas p-4">
              <p className="font-semibold">Ready for backend</p>
              <p className="mt-2 text-sm leading-6 text-slate">The next upgrade is deeper record extraction, real portal syncing APIs, and production deployment hardening.</p>
            </div>
          </div>
          </div>
        </section>
      </div>
    </main>
  );
}
