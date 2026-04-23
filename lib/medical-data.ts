export type PortalConnection = {
  id: string;
  name: string;
  status: "connected" | "pending";
  lastSync: string;
};

export type LabRecord = {
  id: string;
  testName: string;
  value: number;
  unit: string;
  date: string;
  low: number | null;
  high: number | null;
  source: string;
};

export type UploadedRecord = {
  id: string;
  name: string;
  category: string;
  uploadedAt: string;
  sizeLabel: string;
  extractedText: string;
  extractionStatus: string;
  storagePath?: string | null;
  aiSummary?: string;
  aiSummaryStatus?: "idle" | "ready" | "error";
  aiSummaryUpdatedAt?: string | null;
};

export type AppointmentNote = {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  provider: string;
  specialty: string;
  visitType: string;
  location: string;
  durationMinutes: string;
  notes: string;
  followUp: string;
  transcript: string;
  aiSummary?: string;
  aiSummaryStatus?: "idle" | "ready" | "error";
  aiSummaryUpdatedAt?: string | null;
};

export type CareChange = {
  id: string;
  date: string;
  category: string;
  change: string;
  effect: string;
};

export type SymptomEntry = {
  id: string;
  symptom: string;
  severity: string;
  frequency: string;
  startedOn: string;
  notes: string;
};

export type BloodPressureEntry = {
  id: string;
  date: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  notes: string;
};

export type FamilyHistoryEntry = {
  id: string;
  relation: string;
  condition: string;
  ageOfOnset: string;
  notes: string;
};

export type WeightEntry = {
  id: string;
  date: string;
  weight: number;
  unit: string;
  notes: string;
};

export type WaterIntakeEntry = {
  id: string;
  date: string;
  amount: number;
  unit: string;
  notes: string;
};

export type SleepEntry = {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  hoursSlept: number;
  quality: "Poor" | "Fair" | "Good" | "Great";
  notes: string;
};

export type ExerciseEntry = {
  id: string;
  date: string;
  activityType: string;
  durationMinutes: number;
  intensity: "Light" | "Moderate" | "Vigorous";
  notes: string;
};

export type MoodEntry = {
  id: string;
  date: string;
  mood: "Low" | "Okay" | "Good" | "Great";
  stressLevel: "Low" | "Medium" | "High";
  anxietyNotes: string;
  whatHelped: string;
  notes: string;
};

export type GlucoseEntry = {
  id: string;
  date: string;
  time: string;
  value: number;
  unit: string;
  context: "Fasting" | "Before meal" | "After meal" | "Bedtime" | "Other";
  notes: string;
};

export type DietEntry = {
  id: string;
  date: string;
  mealType: string;
  summary: string;
  notes: string;
};

export type MedicationEntry = {
  id: string;
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  purpose: string;
  prescriber: string;
  status: "active" | "paused" | "stopped";
  reminderEnabled: boolean;
  reminderTime: string;
  refillDate: string;
  lastTakenOn: string;
  responseStatus: "helpful" | "neutral" | "hard-to-tolerate";
  sideEffects: string;
  responseNotes: string;
  lastReviewedOn: string;
  notes: string;
};

export type DoctorQuestionEntry = {
  id: string;
  date: string;
  question: string;
  context: string;
  priority: "routine" | "important";
  answered: boolean;
};

export type DoctorMessageAttachment = {
  id: string;
  name: string;
  sizeLabel: string;
  storagePath: string;
};

export type DoctorMessage = {
  id: string;
  threadId: string;
  date: string;
  subject: string;
  message: string;
  status: "draft" | "sent" | "received";
  mailbox: "drafts" | "sent" | "inbox";
  from: string;
  to: string;
  isRead: boolean;
  priority: "routine" | "high";
  attachments: DoctorMessageAttachment[];
};

export type PatientProfile = {
  fullName: string;
  birthDate: string;
  careGoals: string;
};

export type DailyPlanState = {
  date: string;
  completedTaskIds: string[];
  dismissedTaskIds: string[];
};

export type RoutineEntry = {
  id: string;
  title: string;
  scheduleLabel: string;
  timeOfDay: string;
  notes: string;
  lastCompletedOn: string;
};

export type WeeklyGoal = {
  id: string;
  title: string;
  targetCount: number;
  progressCount: number;
  notes: string;
};

export type VisitPrepChecklistState = {
  date: string;
  completedItemIds: string[];
};

export type PersonalizationSectionId =
  | "visitSummary"
  | "healthHistory"
  | "trendExplorer"
  | "importRecords"
  | "labIntake"
  | "appointmentNotes"
  | "doctorQuestions"
  | "careChanges"
  | "symptoms"
  | "plainLanguageSummary"
  | "visitPrepSummary"
    | "connectionsView"
    | "bloodPressure"
    | "familyHistory"
    | "weightTracker"
    | "sleepTracker"
    | "exerciseTracker"
    | "moodTracker"
    | "glucoseTracker"
    | "waterIntake"
  | "medications"
  | "dietTracker"
  | "doctorMessaging"
  | "savedRecords"
  | "timeline"
  | "packetSnapshot"
  | "packetMeasures"
  | "packetSymptoms"
  | "packetMedications"
  | "packetLabs"
  | "packetQuestions"
  | "packetPrep";

export type SectionPreference = {
  showInApp: boolean;
  includeInPacket: boolean;
};

export type SectionPreferences = Record<PersonalizationSectionId, SectionPreference>;

export type AppState = {
  patient: PatientProfile;
  labs: LabRecord[];
  uploadedRecords: UploadedRecord[];
  portals: PortalConnection[];
  appointments: AppointmentNote[];
  careChanges: CareChange[];
  symptoms: SymptomEntry[];
    bloodPressureLogs: BloodPressureEntry[];
    familyHistory: FamilyHistoryEntry[];
    medications: MedicationEntry[];
    weightLogs: WeightEntry[];
    sleepLogs: SleepEntry[];
    exerciseLogs: ExerciseEntry[];
    moodLogs: MoodEntry[];
    glucoseLogs: GlucoseEntry[];
    waterIntakeLogs: WaterIntakeEntry[];
  hydrationGoal: {
    amount: number;
    unit: string;
  };
  dietLogs: DietEntry[];
  doctorQuestions: DoctorQuestionEntry[];
  doctorMessages: DoctorMessage[];
  dailyPlan: DailyPlanState;
  visitPrepChecklist: VisitPrepChecklistState;
  routines: RoutineEntry[];
  weeklyGoals: WeeklyGoal[];
  weeklyGoalsWeekOf: string;
  sectionPreferences: SectionPreferences;
};

export type SummaryCard = {
  title: string;
  label: string;
  body: string;
};

export type TrendSeries = {
  name: string;
  unit: string;
  referenceRange: string;
  changeLabel: string;
  latestValue: number;
  points: Array<{ date: string; value: number }>;
};

export const STORAGE_KEY = "medical-record-insights-state";

export const defaultSectionPreferences: SectionPreferences = {
  visitSummary: { showInApp: true, includeInPacket: false },
  healthHistory: { showInApp: true, includeInPacket: false },
  trendExplorer: { showInApp: true, includeInPacket: false },
  importRecords: { showInApp: true, includeInPacket: false },
  labIntake: { showInApp: true, includeInPacket: false },
  appointmentNotes: { showInApp: true, includeInPacket: false },
  doctorQuestions: { showInApp: true, includeInPacket: false },
  careChanges: { showInApp: true, includeInPacket: false },
  symptoms: { showInApp: true, includeInPacket: false },
  plainLanguageSummary: { showInApp: true, includeInPacket: false },
  visitPrepSummary: { showInApp: true, includeInPacket: false },
  connectionsView: { showInApp: true, includeInPacket: false },
  bloodPressure: { showInApp: true, includeInPacket: false },
    familyHistory: { showInApp: true, includeInPacket: false },
    weightTracker: { showInApp: true, includeInPacket: false },
    sleepTracker: { showInApp: true, includeInPacket: false },
    exerciseTracker: { showInApp: true, includeInPacket: false },
    moodTracker: { showInApp: true, includeInPacket: false },
    glucoseTracker: { showInApp: true, includeInPacket: false },
    waterIntake: { showInApp: true, includeInPacket: false },
  medications: { showInApp: true, includeInPacket: false },
  dietTracker: { showInApp: true, includeInPacket: false },
  doctorMessaging: { showInApp: true, includeInPacket: false },
  savedRecords: { showInApp: true, includeInPacket: false },
  timeline: { showInApp: true, includeInPacket: false },
  packetSnapshot: { showInApp: false, includeInPacket: true },
  packetMeasures: { showInApp: false, includeInPacket: true },
  packetSymptoms: { showInApp: false, includeInPacket: true },
  packetMedications: { showInApp: false, includeInPacket: true },
  packetLabs: { showInApp: false, includeInPacket: true },
  packetQuestions: { showInApp: false, includeInPacket: true },
  packetPrep: { showInApp: false, includeInPacket: true }
};

export const starterState: AppState = {
  patient: {
    fullName: "Jordan Lee",
    birthDate: "1987-09-14",
    careGoals: "Track cholesterol, A1C, and thyroid changes across clinics."
  },
  labs: [
    { id: "lab-1", testName: "Hemoglobin A1C", value: 5.8, unit: "%", date: "2025-05-14", low: 4, high: 5.6, source: "Downtown Primary Care" },
    { id: "lab-2", testName: "Hemoglobin A1C", value: 6.1, unit: "%", date: "2025-08-14", low: 4, high: 5.6, source: "Endocrinology Center" },
    { id: "lab-3", testName: "Hemoglobin A1C", value: 6.4, unit: "%", date: "2025-12-02", low: 4, high: 5.6, source: "Endocrinology Center" },
    { id: "lab-4", testName: "Hemoglobin A1C", value: 6.7, unit: "%", date: "2026-03-18", low: 4, high: 5.6, source: "Downtown Primary Care" },
    { id: "lab-5", testName: "LDL Cholesterol", value: 142, unit: "mg/dL", date: "2025-05-14", low: null, high: 100, source: "Downtown Primary Care" },
    { id: "lab-6", testName: "LDL Cholesterol", value: 129, unit: "mg/dL", date: "2025-08-14", low: null, high: 100, source: "Cardiology Associates" },
    { id: "lab-7", testName: "LDL Cholesterol", value: 117, unit: "mg/dL", date: "2025-12-02", low: null, high: 100, source: "Cardiology Associates" },
    { id: "lab-8", testName: "LDL Cholesterol", value: 106, unit: "mg/dL", date: "2026-03-18", low: null, high: 100, source: "Downtown Primary Care" },
    { id: "lab-9", testName: "Vitamin D", value: 18, unit: "ng/mL", date: "2025-05-14", low: 30, high: 100, source: "Downtown Primary Care" },
    { id: "lab-10", testName: "Vitamin D", value: 24, unit: "ng/mL", date: "2025-08-14", low: 30, high: 100, source: "Downtown Primary Care" },
    { id: "lab-11", testName: "Vitamin D", value: 28, unit: "ng/mL", date: "2025-12-02", low: 30, high: 100, source: "Downtown Primary Care" },
    { id: "lab-12", testName: "Vitamin D", value: 31, unit: "ng/mL", date: "2026-03-18", low: 30, high: 100, source: "Downtown Primary Care" }
  ],
  uploadedRecords: [
    {
      id: "record-1",
      name: "Annual wellness labs.pdf",
      category: "Lab report",
      uploadedAt: "2026-03-18",
      sizeLabel: "1.4 MB",
      extractedText: "Hemoglobin A1C 6.7 percent. LDL cholesterol 106 milligrams per deciliter. Vitamin D 31 nanograms per milliliter.",
      extractionStatus: "Sample extracted text available",
      aiSummary: "This lab report shows A1C above the usual reference range, LDL cholesterol still above goal but improving, and vitamin D now back into range.",
      aiSummaryStatus: "ready",
      aiSummaryUpdatedAt: "2026-04-02"
    },
    {
      id: "record-2",
      name: "Cardiology follow-up note.pdf",
      category: "Visit summary",
      uploadedAt: "2025-12-02",
      sizeLabel: "860 KB",
      extractedText: "Follow-up note describes improved blood pressure control and recommends continuing the current plan.",
      extractionStatus: "Sample extracted text available",
      aiSummary: "This follow-up note says blood pressure is improving and the current treatment plan should continue.",
      aiSummaryStatus: "ready",
      aiSummaryUpdatedAt: "2026-04-02"
    }
  ],
  portals: [{ id: "portal-1", name: "MyChart", status: "connected", lastSync: "2026-03-27" }],
  appointments: [
    {
      id: "appt-1",
      appointmentDate: "2026-03-20",
      appointmentTime: "09:30",
      provider: "Dr. Patel",
      specialty: "Primary care",
      visitType: "Office visit",
      location: "Desert Family Clinic",
      durationMinutes: "30",
      notes: "Reviewed recent labs, discussed blood sugar trend, and recommended more regular walking after dinner.",
      followUp: "Repeat A1C in three months and keep a home blood pressure log.",
      transcript: "We reviewed the latest A1C trend, talked about evening walks, and agreed to repeat labs in three months.",
      aiSummary: "The visit focused on rising A1C. The plan was to increase walking after dinner, keep tracking blood pressure, and repeat A1C in three months.",
      aiSummaryStatus: "ready",
      aiSummaryUpdatedAt: "2026-04-02"
    }
  ],
  careChanges: [
    {
      id: "change-1",
      date: "2026-03-21",
      category: "Medication",
      change: "Started taking vitamin D daily after breakfast.",
      effect: "Too early to tell, but the new routine has been easy to follow."
    }
  ],
  symptoms: [
    {
      id: "symptom-1",
      symptom: "Fatigue in the afternoon",
      severity: "Moderate",
      frequency: "Most days",
      startedOn: "2026-02-15",
      notes: "Usually worse after lunch and on days with poor sleep."
    }
  ],
  bloodPressureLogs: [
    {
      id: "bp-1",
      date: "2026-03-16",
      systolic: 138,
      diastolic: 88,
      pulse: 76,
      notes: "Morning reading before breakfast."
    },
    {
      id: "bp-2",
      date: "2026-03-20",
      systolic: 134,
      diastolic: 84,
      pulse: 74,
      notes: "Taken after a short walk."
    },
    {
      id: "bp-3",
      date: "2026-03-28",
      systolic: 129,
      diastolic: 81,
      pulse: 72,
      notes: "Evening reading, felt more relaxed."
    }
  ],
  familyHistory: [
    {
      id: "family-1",
      relation: "Mother",
      condition: "Type 2 diabetes",
      ageOfOnset: "52",
      notes: "Managed with medication and diet changes."
    }
  ],
  medications: [
    {
      id: "med-1",
      name: "Vitamin D3",
      dose: "2000 IU",
      schedule: "Once daily with breakfast",
      startDate: "2026-03-21",
      purpose: "Support low vitamin D level",
        prescriber: "Dr. Patel",
        status: "active",
        reminderEnabled: true,
        reminderTime: "8:00 AM",
        refillDate: "2026-04-15",
        lastTakenOn: "2026-04-02",
        responseStatus: "helpful",
        sideEffects: "Mild stomach upset the first few days, now better.",
        responseNotes: "Energy has felt steadier and the routine is easy to keep.",
        lastReviewedOn: "2026-04-02",
        notes: "Repeat vitamin D level with next blood draw."
      }
    ],
    weightLogs: [
      {
        id: "weight-1",
      date: "2026-03-01",
      weight: 176,
      unit: "lb",
      notes: "Morning weigh-in."
    },
    {
      id: "weight-2",
      date: "2026-03-15",
      weight: 173.5,
      unit: "lb",
      notes: "After two weeks of more regular walking."
    },
    {
      id: "weight-3",
      date: "2026-03-29",
      weight: 171.8,
      unit: "lb",
      notes: "Felt consistent with meals and hydration."
      }
    ],
    sleepLogs: [
      {
        id: "sleep-1",
        date: "2026-03-30",
        bedtime: "10:45 PM",
        wakeTime: "6:20 AM",
        hoursSlept: 7.6,
        quality: "Good",
        notes: "Woke once around 3 AM but fell back asleep quickly."
      },
      {
        id: "sleep-2",
        date: "2026-03-31",
        bedtime: "11:20 PM",
        wakeTime: "6:10 AM",
        hoursSlept: 6.8,
        quality: "Fair",
        notes: "Had trouble falling asleep after a late snack."
      },
      {
        id: "sleep-3",
        date: "2026-04-01",
        bedtime: "10:30 PM",
        wakeTime: "6:30 AM",
        hoursSlept: 8,
        quality: "Great",
        notes: "Felt more rested in the morning."
      }
    ],
    exerciseLogs: [
      {
        id: "exercise-1",
        date: "2026-03-29",
        activityType: "After-dinner walk",
        durationMinutes: 20,
        intensity: "Light",
        notes: "Easy pace and felt steady afterward."
      },
      {
        id: "exercise-2",
        date: "2026-03-31",
        activityType: "Stationary bike",
        durationMinutes: 30,
        intensity: "Moderate",
        notes: "Good energy and no dizziness."
      },
      {
        id: "exercise-3",
        date: "2026-04-02",
        activityType: "Strength routine",
        durationMinutes: 25,
        intensity: "Moderate",
        notes: "Light upper-body work and stretching."
      }
    ],
    moodLogs: [
      {
        id: "mood-1",
        date: "2026-03-31",
        mood: "Okay",
        stressLevel: "Medium",
        anxietyNotes: "Felt mentally scattered in the afternoon.",
        whatHelped: "A short walk and a quieter evening routine.",
        notes: "Energy improved after dinner."
      },
      {
        id: "mood-2",
        date: "2026-04-01",
        mood: "Good",
        stressLevel: "Low",
        anxietyNotes: "",
        whatHelped: "Better sleep and more water through the day.",
        notes: "Felt steadier overall."
      }
    ],
    glucoseLogs: [
      {
        id: "glucose-1",
        date: "2026-04-01",
        time: "7:15 AM",
        value: 104,
        unit: "mg/dL",
        context: "Fasting",
        notes: "Before breakfast."
      },
      {
        id: "glucose-2",
        date: "2026-04-03",
        time: "8:05 AM",
        value: 110,
        unit: "mg/dL",
        context: "Fasting",
        notes: "Shorter sleep the night before."
      },
      {
        id: "glucose-3",
        date: "2026-04-04",
        time: "8:20 PM",
        value: 138,
        unit: "mg/dL",
        context: "After meal",
        notes: "About 90 minutes after dinner."
      }
    ],
    waterIntakeLogs: [
    {
      id: "water-1",
      date: "2026-03-30",
      amount: 54,
      unit: "oz",
      notes: "A little low on a busy day."
    },
    {
      id: "water-2",
      date: "2026-03-31",
      amount: 68,
      unit: "oz",
      notes: "More consistent through the afternoon."
    },
    {
      id: "water-3",
      date: "2026-04-01",
      amount: 72,
      unit: "oz",
      notes: "Hit the daily goal."
    }
  ],
  hydrationGoal: {
    amount: 64,
    unit: "oz"
  },
  dietLogs: [
    {
      id: "diet-1",
      date: "2026-03-29",
      mealType: "Lunch",
      summary: "Grilled chicken salad with olive oil dressing",
      notes: "Kept carbohydrates lower and felt steady through the afternoon."
    }
  ],
  doctorQuestions: [
    {
      id: "question-1",
      date: "2026-04-01",
      question: "Should I keep the same vitamin D dose until the next lab check?",
      context: "Vitamin D improved but has only recently reached range.",
      priority: "important",
      answered: false
    },
    {
      id: "question-2",
      date: "2026-04-02",
      question: "Do my home blood pressure readings suggest the current plan is working well enough?",
      context: "Recent readings are lower than last month but still not ideal every day.",
      priority: "routine",
      answered: false
    }
  ],
  doctorMessages: [
    {
      id: "message-1",
      date: "2026-03-30",
      subject: "Question about vitamin D dose",
      message: "I started the daily vitamin D. Do you want me to stay with this dose until the next lab check?",
      threadId: "thread-vitamin-d-dose",
      status: "draft",
      mailbox: "drafts",
      from: "Jordan Lee",
      to: "Dr. Patel",
      isRead: true,
      priority: "routine",
      attachments: []
    },
    {
      id: "message-2",
      threadId: "thread-vitamin-d-dose",
      date: "2026-03-31",
      subject: "Lab follow-up recommendation",
      message: "Please continue the vitamin D for now and repeat the level with your next blood draw in June.",
      status: "received",
      mailbox: "inbox",
      from: "Dr. Patel",
      to: "Jordan Lee",
      isRead: false,
      priority: "routine",
      attachments: []
    },
    {
      id: "message-3",
      threadId: "thread-bp-update",
      date: "2026-03-29",
      subject: "Blood pressure log update",
      message: "I uploaded my latest home blood pressure readings and wanted to check whether they look improved enough to stay on the current plan.",
      status: "sent",
      mailbox: "sent",
      from: "Jordan Lee",
      to: "Dr. Patel",
      isRead: true,
      priority: "routine",
      attachments: []
    }
  ],
  dailyPlan: {
    date: "",
    completedTaskIds: [],
    dismissedTaskIds: []
  },
  visitPrepChecklist: {
    date: "",
    completedItemIds: []
  },
  routines: [
    {
      id: "routine-1",
      title: "Take a 20-minute walk",
      scheduleLabel: "Daily",
      timeOfDay: "After dinner",
      notes: "Keep it easy and consistent after evening meals.",
      lastCompletedOn: "2026-04-01"
    }
  ],
  weeklyGoals: [
    {
      id: "goal-1",
      title: "Log blood pressure readings",
      targetCount: 4,
      progressCount: 2,
      notes: "Aim for morning readings before breakfast."
    }
  ],
  weeklyGoalsWeekOf: "2026-03-30",
  sectionPreferences: defaultSectionPreferences
};

export const emptyLabForm = {
  testName: "",
  value: "",
  unit: "",
  date: "",
  low: "",
  high: "",
  source: ""
};

export const emptyAppointmentForm = {
  appointmentDate: "",
  appointmentTime: "",
  provider: "",
  specialty: "",
  visitType: "",
  location: "",
  durationMinutes: "",
  notes: "",
  followUp: "",
  transcript: ""
};

export const emptyCareChangeForm = {
  date: "",
  category: "",
  change: "",
  effect: ""
};

export const emptySymptomForm = {
  symptom: "",
  severity: "",
  frequency: "",
  startedOn: "",
  notes: ""
};

export const emptyBloodPressureForm = {
  date: "",
  systolic: "",
  diastolic: "",
  pulse: "",
  notes: ""
};

export const emptyFamilyHistoryForm = {
  relation: "",
  condition: "",
  ageOfOnset: "",
  notes: ""
};

export const emptyWeightForm = {
  date: "",
  weight: "",
  unit: "lb",
  notes: ""
};

export const emptyWaterIntakeForm = {
  date: "",
  amount: "",
  unit: "oz",
  notes: ""
};

export const emptySleepForm = {
  date: "",
  bedtime: "",
  wakeTime: "",
  hoursSlept: "",
  quality: "Good" as "Poor" | "Fair" | "Good" | "Great",
  notes: ""
};

export const emptyExerciseForm = {
  date: "",
  activityType: "",
  durationMinutes: "",
  intensity: "Moderate" as "Light" | "Moderate" | "Vigorous",
  notes: ""
};

export const emptyMoodForm = {
  date: "",
  mood: "Okay" as "Low" | "Okay" | "Good" | "Great",
  stressLevel: "Medium" as "Low" | "Medium" | "High",
  anxietyNotes: "",
  whatHelped: "",
  notes: ""
};

export const emptyGlucoseForm = {
  date: "",
  time: "",
  value: "",
  unit: "mg/dL",
  context: "Fasting" as "Fasting" | "Before meal" | "After meal" | "Bedtime" | "Other",
  notes: ""
};

export const emptyMedicationForm = {
  name: "",
  dose: "",
  schedule: "",
  startDate: "",
  purpose: "",
  prescriber: "",
  status: "active" as "active" | "paused" | "stopped",
  reminderEnabled: false,
  reminderTime: "",
  refillDate: "",
  lastTakenOn: "",
  responseStatus: "neutral" as "helpful" | "neutral" | "hard-to-tolerate",
  sideEffects: "",
  responseNotes: "",
  lastReviewedOn: "",
  notes: ""
};

export const emptyDietForm = {
  date: "",
  mealType: "",
  summary: "",
  notes: ""
};

export const emptyDoctorQuestionForm = {
  date: "",
  question: "",
  context: "",
  priority: "routine" as "routine" | "important",
  answered: false
};

export const emptyDoctorMessageForm = {
  date: "",
  to: "",
  subject: "",
  message: "",
  status: "draft" as "draft" | "sent" | "received",
  priority: "routine" as "routine" | "high",
  attachments: [] as DoctorMessageAttachment[]
};

export const emptyRoutineForm = {
  title: "",
  scheduleLabel: "Daily",
  timeOfDay: "",
  notes: ""
};

export const emptyWeeklyGoalForm = {
  title: "",
  targetCount: "1",
  notes: ""
};

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatDateLabel(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatTimeLabel(time: string) {
  if (!time) {
    return "";
  }

  const parsed = new Date(`2000-01-01 ${time}`);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }

  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

export function normalizeAppState(partial?: Partial<AppState>): AppState {
  const source = partial ?? {};
  const migratedMedications = (source.medications ?? starterState.medications).map((entry) => ({
    ...entry,
    reminderEnabled: entry.reminderEnabled ?? false,
    reminderTime: entry.reminderTime ?? "",
    refillDate: entry.refillDate ?? "",
    lastTakenOn: entry.lastTakenOn ?? "",
    responseStatus: entry.responseStatus ?? "neutral",
    sideEffects: entry.sideEffects ?? "",
    responseNotes: entry.responseNotes ?? "",
    lastReviewedOn: entry.lastReviewedOn ?? ""
  }));
  const migratedMessages = (source.doctorMessages ?? starterState.doctorMessages).map((entry) => {
    const message = entry as Partial<DoctorMessage> &
      Pick<DoctorMessage, "date" | "subject" | "message" | "status" | "id">;
    const derivedThreadId =
      message.threadId ??
      `thread-${(message.subject ?? message.id)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || message.id}`;

    return {
      ...message,
      threadId: derivedThreadId,
      from: message.from ?? "Jordan Lee",
      to: message.to ?? "Dr. Patel",
      isRead: message.isRead ?? message.status !== "received",
      priority: message.priority ?? "routine",
      attachments: message.attachments ?? [],
      mailbox:
        message.mailbox ?? (message.status === "received" ? "inbox" : message.status === "sent" ? "sent" : "drafts")
    } satisfies DoctorMessage;
  });

  return {
    patient: {
      ...starterState.patient,
      ...source.patient
    },
    labs: source.labs ?? starterState.labs,
    uploadedRecords: (source.uploadedRecords ?? starterState.uploadedRecords).map((record) => ({
      ...record,
      storagePath: record.storagePath ?? null,
      aiSummary: record.aiSummary ?? "",
      aiSummaryStatus: record.aiSummaryStatus ?? (record.aiSummary ? "ready" : "idle"),
      aiSummaryUpdatedAt: record.aiSummaryUpdatedAt ?? null
    })),
    portals: source.portals ?? starterState.portals,
    appointments: (source.appointments ?? starterState.appointments).map((appointment) => ({
      ...appointment,
      appointmentTime: appointment.appointmentTime ?? "",
      visitType: appointment.visitType ?? "",
      location: appointment.location ?? "",
      durationMinutes: appointment.durationMinutes ?? "",
      aiSummary: appointment.aiSummary ?? "",
      aiSummaryStatus: appointment.aiSummaryStatus ?? (appointment.aiSummary ? "ready" : "idle"),
      aiSummaryUpdatedAt: appointment.aiSummaryUpdatedAt ?? null
    })),
    careChanges: source.careChanges ?? starterState.careChanges,
    symptoms: source.symptoms ?? starterState.symptoms,
    bloodPressureLogs: source.bloodPressureLogs ?? starterState.bloodPressureLogs,
    familyHistory: source.familyHistory ?? starterState.familyHistory,
    medications: migratedMedications,
    weightLogs: source.weightLogs ?? starterState.weightLogs,
    sleepLogs: source.sleepLogs ?? starterState.sleepLogs,
    exerciseLogs: source.exerciseLogs ?? starterState.exerciseLogs,
    moodLogs: source.moodLogs ?? starterState.moodLogs,
    glucoseLogs: source.glucoseLogs ?? starterState.glucoseLogs,
    waterIntakeLogs: source.waterIntakeLogs ?? starterState.waterIntakeLogs,
    hydrationGoal: {
      amount: source.hydrationGoal?.amount ?? starterState.hydrationGoal.amount,
      unit: source.hydrationGoal?.unit ?? starterState.hydrationGoal.unit
    },
    dietLogs: source.dietLogs ?? starterState.dietLogs,
    doctorQuestions: (source.doctorQuestions ?? starterState.doctorQuestions).map((entry) => ({
      ...entry,
      date: entry.date ?? "",
      context: entry.context ?? "",
      priority: entry.priority ?? "routine",
      answered: entry.answered ?? false
    })),
    doctorMessages: migratedMessages,
    dailyPlan: {
      date: source.dailyPlan?.date ?? "",
      completedTaskIds: source.dailyPlan?.completedTaskIds ?? [],
      dismissedTaskIds: source.dailyPlan?.dismissedTaskIds ?? []
    },
    visitPrepChecklist: {
      date: source.visitPrepChecklist?.date ?? "",
      completedItemIds: source.visitPrepChecklist?.completedItemIds ?? []
    },
    routines: (source.routines ?? starterState.routines).map((routine) => ({
      ...routine,
      scheduleLabel: routine.scheduleLabel ?? "Daily",
      timeOfDay: routine.timeOfDay ?? "",
      notes: routine.notes ?? "",
      lastCompletedOn: routine.lastCompletedOn ?? ""
    })),
    weeklyGoals: (source.weeklyGoals ?? starterState.weeklyGoals).map((goal) => ({
      ...goal,
      targetCount: goal.targetCount ?? 1,
      progressCount: goal.progressCount ?? 0,
      notes: goal.notes ?? ""
    })),
    weeklyGoalsWeekOf: source.weeklyGoalsWeekOf ?? starterState.weeklyGoalsWeekOf,
    sectionPreferences: {
      ...defaultSectionPreferences,
      ...(source.sectionPreferences ?? {})
    }
  };
}
