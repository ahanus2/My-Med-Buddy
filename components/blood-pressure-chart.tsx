export function BloodPressureChart({
  points
}: {
  points: Array<{ date: string; systolic: number; diastolic: number }>;
}) {
  if (!points.length) {
    return null;
  }

  const width = 360;
  const height = 180;
  const padding = 20;
  const allValues = points.flatMap((point) => [point.systolic, point.diastolic]);
  const minValue = Math.min(...allValues) - 5;
  const maxValue = Math.max(...allValues) + 5;
  const range = maxValue - minValue || 1;
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const toPath = (key: "systolic" | "diastolic") =>
    points
      .map((point, index) => {
        const x = padding + index * xStep;
        const y = height - padding - ((point[key] - minValue) / range) * (height - padding * 2);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  const systolicPath = toPath("systolic");
  const diastolicPath = toPath("diastolic");
  const systolicColor = "#2f5d9f";
  const diastolicColor = "#d28a3c";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full">
      {[0, 1, 2, 3].map((line) => (
        <line
          key={line}
          x1={padding}
          x2={width - padding}
          y1={padding + ((height - padding * 2) / 3) * line}
          y2={padding + ((height - padding * 2) / 3) * line}
          stroke="rgba(31,42,46,0.12)"
          strokeDasharray="4 4"
        />
      ))}
      <path d={systolicPath} fill="none" stroke={systolicColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d={diastolicPath} fill="none" stroke={diastolicColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => {
        const x = padding + index * xStep;
        const systolicY = height - padding - ((point.systolic - minValue) / range) * (height - padding * 2);
        const diastolicY = height - padding - ((point.diastolic - minValue) / range) * (height - padding * 2);
        return (
          <g key={point.date}>
            <circle cx={x} cy={systolicY} r="4" fill={systolicColor} stroke="#ffffff" strokeWidth="2" />
            <circle cx={x} cy={diastolicY} r="4" fill={diastolicColor} stroke="#ffffff" strokeWidth="2" />
            <text x={x} y={height - 4} textAnchor="middle" fontSize="10" fill="#5d6c70">
              {new Date(point.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
