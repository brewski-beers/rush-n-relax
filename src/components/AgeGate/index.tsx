import { useState, useRef } from 'react';
import './AgeGate.css';

export function AgeGate() {
  const [isVerified, setIsVerified] = useState<boolean | null>(() => {
    const verified = localStorage.getItem('ageVerified');
    return verified === 'true' ? true : verified === 'false' ? false : null;
  });
  const [userMonth, setUserMonth] = useState('');
  const [userDay, setUserDay] = useState('');
  const [userYear, setUserYear] = useState('');
  const [error, setError] = useState('');
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const handleVerify = () => {
    setError('');

    if (!userMonth || !userDay || !userYear) {
      setError('Please enter your complete birth date');
      return;
    }

    const month = parseInt(userMonth, 10);
    const day = parseInt(userDay, 10);
    const year = parseInt(userYear, 10);

    // Validate date ranges
    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      year < 1900 ||
      year > new Date().getFullYear()
    ) {
      setError('Please enter a valid birth date');
      return;
    }

    const birthDate = new Date(year, month - 1, day);
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
      setError('You must be 21 or older to enter');
      return;
    }

    localStorage.setItem('ageVerified', 'true');
    setIsVerified(true);
    // Dispatch custom event for RootLayout to listen
    window.dispatchEvent(new CustomEvent('ageVerified'));
  };

  const handleMonthChange = (value: string) => {
    // Cap to 2 digits max
    const capped = value.slice(0, 2);
    setUserMonth(capped);
    // Auto-focus to day when field is full (2 digits) for UX
    if (capped.length === 2) {
      setTimeout(() => dayRef.current?.focus(), 50);
    }
  };

  const handleDayChange = (value: string) => {
    // Cap to 2 digits max
    const capped = value.slice(0, 2);
    setUserDay(capped);
    // Auto-focus to year when field is full (2 digits) for UX
    if (capped.length === 2) {
      setTimeout(() => yearRef.current?.focus(), 50);
    }
  };

  const handleYearChange = (value: string) => {
    // Only allow 4 digits max
    const capped = value.slice(0, 4);
    setUserYear(capped);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  if (isVerified === true) {
    return null; // Age verified, render nothing
  }

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
            handleVerify();
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
                onKeyPress={handleKeyPress}
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
                onKeyPress={handleKeyPress}
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
                onKeyPress={handleKeyPress}
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
