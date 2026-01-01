interface CheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ id, checked, onChange, label, disabled, className = '' }: CheckboxProps) {
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={`w-4 h-4 rounded border-border-default bg-surface-raised text-accent focus:ring-accent focus:ring-offset-0 transition-none ${
          disabled
            ? 'cursor-not-allowed disabled:hover:border-border-default disabled:hover:bg-surface-raised'
            : 'cursor-pointer hover:border-accent/50'
        }`}
        style={disabled ? { pointerEvents: 'none' } : undefined}
      />
      {label && <span className="text-text-secondary text-sm">{label}</span>}
    </label>
  );
}
