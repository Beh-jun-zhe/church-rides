"use client";

interface ConfirmSubmitButtonProps {
  label: string;
  confirmText: string;
  className?: string;
  submitName?: string;
  submitValue?: string;
  disabled?: boolean;
}

export function ConfirmSubmitButton({
  label,
  confirmText,
  className,
  submitName,
  submitValue,
  disabled = false,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      name={submitName}
      value={submitValue}
      disabled={disabled}
      className={className}
      onClick={(event) => {
        const confirmed = window.confirm(confirmText);
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      {label}
    </button>
  );
}
