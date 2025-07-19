import type { StatusSegment } from "./utils";
import { createDonutPath } from "./utils";

interface DonutChartProps {
  segments: StatusSegment[];
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export function DonutChart({
  segments,
  size = 200,
  innerRadius = 60,
  outerRadius = 90,
}: DonutChartProps) {
  const viewBoxSize = size;

  // Adjust radii based on size
  const adjustedInnerRadius = (innerRadius / 200) * viewBoxSize;
  const adjustedOuterRadius = (outerRadius / 200) * viewBoxSize;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
    >
      {segments.map((segment, index) => (
        <path
          key={index}
          d={createDonutPath(
            segment.startAngle,
            segment.endAngle,
            adjustedInnerRadius,
            adjustedOuterRadius
          )}
          fill={segment.color}
          className="transition-opacity hover:opacity-80 cursor-pointer"
          //   title={`${segment.label}: ${segment.percentage}`}
        />
      ))}
    </svg>
  );
}
