import React, { useCallback } from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label }) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // space and enter both activate a switch per ARIA authoring guide
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onChange();
      }
    },
    [onChange]
  );

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle-switch"
      onClick={onChange}
      onKeyDown={handleKeyDown}
    >
      <span className={`toggle-track${checked ? ' toggle-track--on' : ''}`} aria-hidden="true" />
      <span className={`toggle-knob${checked ? ' toggle-knob--on' : ''}`} aria-hidden="true" />
    </button>
  );
};
