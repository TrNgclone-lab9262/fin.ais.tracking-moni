"use client";

import React, { useId } from "react";

export interface TextInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number" | "search" | "tel" | "url";
  name?: string;
  id?: string;
  error?: string | null;
  helperText?: string;
  leadingIcon?: React.ReactNode;
  trailingElement?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  minLength?: number;
  maxLength?: number;
  className?: string;
  inputClassName?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  "data-testid"?: string;
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  name,
  id,
  error,
  helperText,
  leadingIcon,
  trailingElement,
  disabled = false,
  required = false,
  readOnly = false,
  autoFocus = false,
  autoComplete,
  inputMode,
  minLength,
  maxLength,
  className = "",
  inputClassName = "",
  onKeyDown,
  "data-testid": dataTestId,
}: TextInputProps) {
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
        {leadingIcon && (
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center"
          >
            {leadingIcon}
          </span>
        )}

        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          readOnly={readOnly}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          inputMode={inputMode}
          minLength={minLength}
          maxLength={maxLength}
          data-testid={dataTestId}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError || helperText ? feedbackId : undefined}
          className={`w-full min-h-[40px] sm:min-h-[42px] bg-slate-50 dark:bg-slate-800 border rounded-lg py-2 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
            leadingIcon ? "pl-9" : "pl-3.5"
          } ${trailingElement ? "pr-9" : "pr-3.5"} ${
            hasError
              ? "border-rose-500 dark:border-rose-500 focus:border-rose-600"
              : "border-[#DCE4EE] dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500"
          } ${inputClassName}`}
        />

        {trailingElement && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
            {trailingElement}
          </span>
        )}
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
