import React, { useId } from 'react';

const IMPACT_LEVELS = ['All', 'Critical', 'Serious', 'Moderate', 'Minor', 'Best Practice'] as const;
type ImpactLevel = (typeof IMPACT_LEVELS)[number];

interface FilterBarProps {
  impact: string;
  search: string;
  total: number;
  filtered: number;
  onImpactChange: (impact: string) => void;
  onSearchChange: (search: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  impact,
  search,
  total,
  filtered,
  onImpactChange,
  onSearchChange,
}) => {
  const searchId = useId();

  return (
    <div className="filter-bar" aria-label="Filter violations">
      <div className="filter-bar__impacts" role="group" aria-label="Filter by impact severity">
        {IMPACT_LEVELS.map((level: ImpactLevel) => (
          <button
            key={level}
            className={`filter-bar__impact-btn${impact === level ? ' filter-bar__impact-btn--active' : ''}`}
            onClick={() => onImpactChange(level)}
            aria-pressed={impact === level}
            type="button"
          >
            {level}
          </button>
        ))}
      </div>

      <label htmlFor={searchId} className="sr-only">
        Search violations
      </label>
      <input
        id={searchId}
        className="filter-bar__search"
        type="search"
        placeholder="Search by id or description…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search violations by id or description"
        autoComplete="off"
        spellCheck={false}
      />

      <p className="filter-bar__count" aria-live="polite" aria-atomic="true">
        Showing <strong>{filtered}</strong> of {total} violations
      </p>
    </div>
  );
};
