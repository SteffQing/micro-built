import type { StatusSegment } from "./utils";

interface ChartLegendProps {
  segments: StatusSegment[];
  showRawCounts?: boolean;
}

export function ChartLegend({
  segments,
  showRawCounts = false,
}: ChartLegendProps) {
  return (
    <div className="space-y-3 w-full">
      {segments.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-muted-foreground">{item.label}</span>
            {showRawCounts && (
              <span className="text-xs text-muted-foreground">
                ({item.raw})
              </span>
            )}
          </div>
          <span className="text-sm font-medium">{item.percentage}</span>
        </div>
      ))}
    </div>
  );
}
