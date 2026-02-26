type SaveErrorToastProps = {
  open: boolean;
  message: string;
};

export function SaveErrorToast({ open, message }: SaveErrorToastProps) {
  if (!open) return null;

  return (
    <div className="planner-save-error-toast" role="status" aria-live="polite">
      <span className="planner-save-error-toast__icon">⚠</span>
      <span>{message}</span>
    </div>
  );
}
