import React, { useCallback } from 'react';
import type { ColourBlindMode } from '../../shared/messages';

interface ColourBlindPickerProps {
  value: ColourBlindMode;
  onChange: (mode: ColourBlindMode) => void;
}

interface ModeOption {
  value: ColourBlindMode;
  label: string;
}

const OPTIONS: ModeOption[] = [
  { value: 'none', label: 'None' },
  { value: 'deuteranopia', label: 'Deuteranopia (red-green)' },
  { value: 'protanopia', label: 'Protanopia (red-blind)' },
  { value: 'tritanopia', label: 'Tritanopia (blue-blind)' },
  { value: 'achromatopsia', label: 'Achromatopsia (no colour)' },
];

const PILL_LABELS: Record<Exclude<ColourBlindMode, 'none'>, string> = {
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Achromatopsia',
};

export const ColourBlindPicker: React.FC<ColourBlindPickerProps> = ({ value, onChange }) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value as ColourBlindMode);
    },
    [onChange]
  );

  return (
    <div className="colour-blind-picker">
      <div className="colour-blind-header">
        <span className="colour-blind-label-text">Colour Blindness Mode</span>
        {value !== 'none' && (
          <span
            className="colour-blind-pill"
            role="status"
            aria-label={`Active mode: ${PILL_LABELS[value]}`}
          >
            {PILL_LABELS[value]}
          </span>
        )}
      </div>
      <select
        className="colour-blind-select"
        value={value}
        onChange={handleChange}
        aria-label="Select colour blindness simulation mode"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
