interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function Select({ id, value, onChange, options, placeholder, className = '' }: SelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-bg-secondary border border-border-default rounded-lg px-4 py-2 text-text-primary focus:border-accent focus:outline-none ${className}`}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
