"use client";

import { useId, useMemo, useState } from "react";
import { CheckIcon, EyeIcon, EyeOffIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function InputPassword({
  className,
  value,
  onChange,
  showStrength = true,
  ...props
}: React.ComponentProps<"input"> & { showStrength?: boolean }) {
  const id = useId();
  const [isVisible, setIsVisible] = useState(false);

  // Use the value from props, not internal state!
  const password = String(value ?? "");

  const checkStrength = (pass: string) => {
    const requirements = [
      { regex: /.{8,}/, text: "8+ chars" },
      { regex: /[0-9]/, text: "Number" },
      { regex: /[a-z]/, text: "Lowercase" },
      { regex: /[A-Z]/, text: "Uppercase" },
      { regex: /[@$!%*?&]/, text: "Special" },
    ];

    return requirements.map((req) => ({
      met: req.regex.test(pass),
      text: req.text,
    }));
  };

  const strength = checkStrength(password);

  const strengthScore = useMemo(() => {
    return strength.filter((req) => req.met).length;
  }, [strength]);

  const getStrengthColor = (score: number) => {
    if (score === 0) return "bg-border";
    if (score <= 1) return "bg-red-500";
    if (score <= 2) return "bg-orange-500";
    if (score === 3) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getStrengthText = (score: number) => {
    if (score === 0) return "Enter a password";
    if (score <= 2) return "Weak password";
    if (score === 3) return "Medium password";
    return "Strong password";
  };

  return (
    <div className="space-y-2">
      <div className="*:not-first:mt-2">
        <div className="relative">
          <Input
            id={id}
            className={cn("pe-9", className)}
            {...props}
            placeholder="Enter password"
            type={isVisible ? "text" : "password"}
            value={password}
            onChange={onChange}
            aria-describedby={showStrength ? `${id}-description` : undefined}
          />
          <button
            type="button"
            onClick={() => setIsVisible((v) => !v)}
            aria-label={isVisible ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10"
          >
            {isVisible ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {showStrength && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="grid flex-1 grid-cols-5 gap-1"
              role="progressbar"
              aria-label="Password strength"
              aria-valuemin={0}
              aria-valuemax={strength.length}
              aria-valuenow={strengthScore}
            >
              {strength.map((req, index) => (
                <div
                  key={req.text}
                  className={cn(
                    "h-1 rounded-full transition-colors",
                    index < strengthScore
                      ? getStrengthColor(strengthScore)
                      : "bg-border"
                  )}
                />
              ))}
            </div>
            <p
              id={`${id}-description`}
              className="shrink-0 text-[11px] font-medium text-muted-foreground"
            >
              {getStrengthText(strengthScore)}
            </p>
          </div>

          <ul
            className="flex flex-wrap gap-x-3 gap-y-1"
            aria-label="Password requirements"
          >
            {strength.map((req) => (
              <li
                key={req.text}
                className={cn(
                  "flex items-center gap-1 text-[11px] leading-none transition-colors",
                  req.met
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-3 w-3 shrink-0 items-center justify-center rounded-full border",
                    req.met
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-muted-foreground/30"
                  )}
                >
                  {req.met && (
                    <CheckIcon className="h-2.5 w-2.5" aria-hidden="true" />
                  )}
                </span>
                <span className="truncate">
                  {req.text}
                  <span className="sr-only text-xs">
                    {req.met ? " - Requirement met" : " - Requirement not met"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
