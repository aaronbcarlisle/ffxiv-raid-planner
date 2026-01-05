/**
 * InputGroup Component
 *
 * Combines Label + Input for common form patterns.
 * Provides consistent spacing and accessibility.
 *
 * @example
 * <InputGroup
 *   label="Player Name"
 *   value={name}
 *   onChange={setName}
 *   required
 * />
 *
 * <InputGroup
 *   label="Email"
 *   value={email}
 *   onChange={setEmail}
 *   error="Invalid email format"
 *   type="email"
 * />
 */

import { useId } from 'react';
import { Label } from './Label';
import { Input, type InputProps } from './Input';

export interface InputGroupProps extends Omit<InputProps, 'id'> {
  /** Label text */
  label: string;
  /** Show required asterisk on label */
  required?: boolean;
  /** Description text below label */
  description?: string;
  /** Optional custom ID (auto-generated if not provided) */
  id?: string;
}

export function InputGroup({
  label,
  required = false,
  description,
  id: customId,
  disabled,
  ...inputProps
}: InputGroupProps) {
  const autoId = useId();
  const id = customId || autoId;

  return (
    <div>
      <Label
        htmlFor={id}
        required={required}
        description={description}
        disabled={disabled}
      >
        {label}
      </Label>
      <Input
        id={id}
        disabled={disabled}
        fullWidth
        {...inputProps}
      />
    </div>
  );
}

export default InputGroup;
