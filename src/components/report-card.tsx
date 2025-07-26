import { cn } from "@/lib/utils";
import { JSX, useEffect, useState } from "react";

interface Props {
  title: string;
  icon: JSX.Element;
  value: string;
  className?: string;
  loading?: boolean;
}

export default function ReportCard({ title, icon, value, className, loading = false }: Props) {
  return (
    <div
      className={cn(
        "bg-white border border-[#F0F0F0] rounded-[12px] p-4 lg:p-5 flex flex-col gap-2 w-full relative",
        className
      )}
    >
      <span className="mb-4 lg:mb-5">{icon}</span>
      <LoadReportValue loading={loading} value={value} />
      <p className="text-[#999999] text-sm font-normal">{title}</p>
    </div>
  );
}

function LoadReportValue({ loading, value, className = "" }: Omit<Props, "title" | "icon">) {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 300);

    return () => clearInterval(interval);
  }, [loading]);

  return (
    <h3 className={`text-black text-2xl font-semibold ${className}`}>
      {loading ? (
        <span className="inline-block min-w-[4ch]">
          {"•".repeat(dotCount)}
          <span className="opacity-30">{"•".repeat(3 - dotCount)}</span>
        </span>
      ) : (
        value
      )}
    </h3>
  );
}
