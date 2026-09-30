import { getLoanStatusColor } from "@/config/status";

export interface StatusSegment {
  label: string;
  value: number;
  raw: number;
  percentage: string;
  color: string;
  startAngle: number;
  endAngle: number;
}

export const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

export const createDonutPath = (
  startAngle: number,
  endAngle: number,
  innerRadius: number,
  outerRadius: number
) => {
  const start = polarToCartesian(100, 100, outerRadius, endAngle);
  const end = polarToCartesian(100, 100, outerRadius, startAngle);
  const innerStart = polarToCartesian(100, 100, innerRadius, endAngle);
  const innerEnd = polarToCartesian(100, 100, innerRadius, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    outerRadius,
    outerRadius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    "L",
    innerEnd.x,
    innerEnd.y,
    "A",
    innerRadius,
    innerRadius,
    0,
    largeArcFlag,
    1,
    innerStart.x,
    innerStart.y,
    "Z",
  ].join(" ");
};

export const processStatusData = (statusCounts: Record<string, number>) => {
  const total = Object.values(statusCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  if (total === 0) {
    return { data: [], total: 0, segments: [] };
  }

  const data = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
      value: (count / total) * 100,
      raw: count,
      percentage: `${((count / total) * 100).toFixed(1)}%`,
      color: getLoanStatusColor(status as LoanStatus),
    }));

  let currentAngle = 0;
  const segments = data.map((item) => {
    const angle = (item.value / 100) * 360;
    const segment = {
      ...item,
      startAngle: currentAngle,
      endAngle: currentAngle + angle,
    };
    currentAngle += angle;
    return segment;
  });

  return { data, total, segments };
};
