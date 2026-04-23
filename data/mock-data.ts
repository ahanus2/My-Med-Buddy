export const mockSummary = [
  {
    title: "Blood sugar trend",
    label: "Needs attention",
    body:
      "Your recent A1C results have gradually increased over the last three tests. That usually means average blood sugar has been running higher over time, even if daily readings sometimes look normal."
  },
  {
    title: "Cholesterol progress",
    label: "Improving",
    body:
      "Your LDL cholesterol is lower than it was last year. That suggests your current plan may be helping, although it still makes sense to compare the result with your doctor's target range for you personally."
  },
  {
    title: "Kidney function",
    label: "Stable",
    body:
      "Creatinine and estimated kidney filtration have not changed much across recent lab reports. That usually points to stable kidney function, but medications and hydration can still affect individual results."
  }
];

export const trendSeries = [
  {
    name: "Hemoglobin A1C (%)",
    referenceRange: "4.0 - 5.6",
    points: [
      { date: "May", value: 5.8 },
      { date: "Aug", value: 6.1 },
      { date: "Dec", value: 6.4 },
      { date: "Mar", value: 6.7 }
    ]
  },
  {
    name: "LDL Cholesterol (mg/dL)",
    referenceRange: "Under 100",
    points: [
      { date: "May", value: 142 },
      { date: "Aug", value: 129 },
      { date: "Dec", value: 117 },
      { date: "Mar", value: 106 }
    ]
  },
  {
    name: "Vitamin D (ng/mL)",
    referenceRange: "30 - 100",
    points: [
      { date: "May", value: 18 },
      { date: "Aug", value: 24 },
      { date: "Dec", value: 28 },
      { date: "Mar", value: 31 }
    ]
  }
];

export const timelineEvents = [
  {
    date: "March 18, 2026",
    title: "Annual wellness labs added",
    description:
      "CBC, metabolic panel, lipid panel, A1C, thyroid testing, and vitamin D were uploaded from primary care."
  },
  {
    date: "December 2, 2025",
    title: "Cardiology follow-up imported",
    description:
      "Visit note mentioned improved blood pressure control and no medication change after home log review."
  },
  {
    date: "August 14, 2025",
    title: "Endocrinology lab bundle connected",
    description:
      "Portal sync brought in thyroid studies, A1C trend, and medication list with dose adjustments."
  },
  {
    date: "May 9, 2025",
    title: "Hospital discharge summary uploaded",
    description:
      "Discharge instructions, imaging impression, and follow-up recommendations were added to the record timeline."
  }
];
