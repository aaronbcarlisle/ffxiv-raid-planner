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
        className={`w-4 h-4 rounded border-border-default bg-surface-raised text-accent focus:ring-accent focus:ring-offset-0 ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-accent/50'
        }`}
      />
      {label && <span className="text-text-secondary text-sm">{label}</span>}
    </label>
  );
}
