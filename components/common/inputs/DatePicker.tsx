"use client";

import React, { useId } from "react";
import { Calendar } from "lucide-react";

export interface DatePickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  name?: string;
  id?: string;
  error?: string | null;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  "data-testid"?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
  name,
  id,
  error,
  helperText,
  disabled = false,
  required = false,
  className = "",
  inputClassName = "",
  "data-testid": dataTestId,
}: DatePickerProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const feedbackId = `${inputId}-feedback`;
  const hasError = Boolean(error);

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-slate-600 dark:text-slate-300"
        >
          {label}
          {required && (
            <span className="text-rose-600 dark:text-rose-400 ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative flex items-center">
        <span
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 pointer-events-none flex items-center"
        >
          <Calendar className="w-3.5 h-3.5" />
        </span>

        <input
          id={inputId}
          name={name}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          disabled={disabled}
          required={required}
          data-testid={dataTestId}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError || helperText ? feedbackId : undefined}
          className={`w-full min-h-[40px] sm:min-h-[42px] bg-slate-50 dark:bg-slate-800 border rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100 dark:[color-scheme:dark] outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
            hasError
              ? "border-rose-500 dark:border-rose-500 focus:border-rose-600"
              : "border-[#DCE4EE] dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500"
          } ${inputClassName}`}
        />
      </div>

      {(error || helperText) && (
        <p
          id={feedbackId}
          className={`text-[11px] font-medium ${
            hasError
              ? "text-rose-600 dark:text-rose-400"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
}
