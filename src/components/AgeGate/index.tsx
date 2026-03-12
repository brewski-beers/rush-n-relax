'use client';

import { useState, useRef } from 'react';
import './AgeGate.css';

interface Props {
  onVerified: () => void;
}

const COOKIE = 'ageVerified=true; max-age=31536000; path=/; SameSite=Strict';

/**
 * Pure age validation — returns null on pass, error string on fail.
 * Extracted so the submit button, Enter key, and auto-submit on year
 * complete all use the same logic without stale-state issues.
 */
function checkAge(month: string, day: string, year: string): string | null {
  if (!month || !day || !year) {
    return 'Please enter your complete birth date';
  }

  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  const y = parseInt(year, 10);

  if (
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31 ||
    y < 1900 ||
    y > new Date().getFullYear()
  ) {
    return 'Please enter a valid birth date';
  }

  const birthDate = new Date(y, m - 1, d);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  if (age < 21) {
    return 'You must be 21 or older to enter';
  }

  return null;
}

export function AgeGate({ onVerified }: Props) {
  const [userMonth, setUserMonth] = useState('');
  const [userDay, setUserDay] = useState('');
  const [userYear, setUserYear] = useState('');
  const [error, setError] = useState('');
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (month = userMonth, day = userDay, year = userYear) => {
    setError('');
    const err = checkAge(month, day, year);
    if (err) {
      setError(err);
      return;
    }
    document.cookie = COOKIE;
    onVerified();
  };

  const handleMonthChange = (value: string) => {
    const capped = value.slice(0, 2);
    setUserMonth(capped);
    if (capped.length === 2) {
      setTimeout(() => dayRef.current?.focus(), 50);
    }
  };

  const handleDayChange = (value: string) => {
    const capped = value.slice(0, 2);
    setUserDay(capped);
    if (capped.length === 2) {
      setTimeout(() => yearRef.current?.focus(), 50);
    }
  };

  const handleYearChange = (value: string) => {
    const capped = value.slice(0, 4);
    setUserYear(capped);
    // Auto-submit once year is complete — use local value to avoid stale state
    if (capped.length === 4) {
      handleSubmit(userMonth, userDay, capped);
    }
  };

  return (
    <div className="age-gate-overlay">
      <div className="age-gate-content">
        <div className="age-gate-header">
          <h1>Age Verification</h1>
          <p>You must be 21 or older to enter</p>
        </div>

        <form
          className="age-gate-form"
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="date-inputs">
            <div className="date-input-group">
              <label htmlFor="month">Month</label>
              <input
                ref={monthRef}
                id="month"
                type="number"
                placeholder="MM"
                inputMode="numeric"
                maxLength={2}
                value={userMonth}
                onChange={e => handleMonthChange(e.target.value)}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="day">Day</label>
              <input
                ref={dayRef}
                id="day"
                type="number"
                placeholder="DD"
                inputMode="numeric"
                maxLength={2}
                value={userDay}
                onChange={e => handleDayChange(e.target.value)}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="year">Year</label>
              <input
                ref={yearRef}
                id="year"
                type="number"
                placeholder="YYYY"
                inputMode="numeric"
                maxLength={4}
                value={userYear}
                onChange={e => handleYearChange(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="age-gate-error" role="alert" aria-live="polite">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary age-gate-button">
            Enter
          </button>
        </form>

        <p className="age-gate-disclaimer">
          By entering, you certify that you are of legal age to purchase
          cannabis in your jurisdiction.
        </p>
      </div>
    </div>
  );
}
