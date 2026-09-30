"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface RepaymentRateIndicatorProps {
  rate: number;
  size?: number;
  className?: string;
}

export default function RepaymentRateIndicator({ rate, size = 35, className }: RepaymentRateIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getColor = (rate: number) => {
    if (rate >= 80) return { bg: "bg-green-100", border: "border-green-500", text: "text-green-600" };
    if (rate >= 50) return { bg: "bg-orange-100", border: "border-orange-500", text: "text-orange-600" };
    return { bg: "bg-red-100", border: "border-red-500", text: "text-red-600" };
  };

  const colors = getColor(rate);
  const circumference = 2 * Math.PI * (size / 2 - 3); // Account for border width
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (rate / 100) * circumference;

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn("relative rounded-full flex items-center justify-center", colors.bg, className)}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="absolute inset-0 -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 3}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-gray-200"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 3}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className={colors.text}
            style={{
              transition: "stroke-dashoffset 0.3s ease-in-out",
            }}
          />
        </svg>

        <span className={cn("text-[10px] font-medium", colors.text)}>{rate}</span>
      </div>

      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-10">
          <div className="text-center">
            <div className="font-medium">Repayment Rate</div>
            <div className="text-gray-300">{rate}% on-time payments</div>
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}
