export function Sparkline({
  points,
  color
}: {
  points: Array<{ date: string; value: number }>;
  color: string;
}) {
  if (!points.length) {
    return null;
  }

  const width = 320;
  const height = 120;
  const padding = 16;
  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const valueRange = maxValue - minValue || 1;
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const coordinates = points.map((point, index) => {
    const x = padding + index * xStep;
    const y = height - padding - ((point.value - minValue) / valueRange) * (height - padding * 2);
    return { ...point, x, y };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1]!.x} ${height - padding} L ${coordinates[0]!.x} ${height - padding} Z`;
  const gradientId = `spark-${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {coordinates.map((point) => (
        <circle key={`${point.date}-${point.value}`} cx={point.x} cy={point.y} r="4.5" fill={color} stroke="#ffffff" strokeWidth="2" />
      ))}
    </svg>
  );
}
