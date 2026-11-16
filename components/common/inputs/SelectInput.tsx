"use client";

import React, { useId } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  children?: React.ReactNode;
  placeholder?: string;
  name?: string;
  id?: string;
  error?: string | null;
  helperText?: string;
  leadingIcon?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  selectClassName?: string;
  "data-testid"?: string;
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  children,
  placeholder,
  name,
  id,
  error,
  helperText,
  leadingIcon,
  disabled = false,
  required = false,
  className = "",
  selectClassName = "",
  "data-testid": dataTestId,
}: SelectInputProps) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const feedbackId = `${selectId}-feedback`;
  const hasError = Boolean(error);

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
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
        {leadingIcon && (
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 pointer-events-none flex items-center"
          >
            {leadingIcon}
          </span>
        )}

        <select
          id={selectId}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          data-testid={dataTestId}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError || helperText ? feedbackId : undefined}
          className={`w-full min-h-[40px] sm:min-h-[42px] appearance-none bg-slate-50 dark:bg-slate-800 border rounded-lg py-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
            leadingIcon ? "pl-9" : "pl-3.5"
          } pr-9 ${
            hasError
              ? "border-rose-500 dark:border-rose-500 focus:border-rose-600"
              : "border-[#DCE4EE] dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500"
          } ${selectClassName}`}
        >
          {placeholder && (
            <option value="" disabled={required}>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        <span
          aria-hidden="true"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center"
        >
          <ChevronDown className="w-4 h-4" />
        </span>
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
