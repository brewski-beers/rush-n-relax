import { useState, useEffect } from 'react';
import './AgeGate.css';

export function AgeGate() {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [userMonth, setUserMonth] = useState('');
  const [userDay, setUserDay] = useState('');
  const [userYear, setUserYear] = useState('');
  const [error, setError] = useState('');

  // Check localStorage on mount
  useEffect(() => {
    const verified = localStorage.getItem('ageVerified');
    if (verified === 'true') {
      setIsVerified(true);
    } else {
      setIsVerified(false);
    }
  }, []);

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
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > new Date().getFullYear()) {
      setError('Please enter a valid birth date');
      return;
    }

    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  if (isVerified === null) {
    return null; // Loading state
  }

  if (isVerified) {
    return null; // Age verified, render nothing
  }

  return (
    <div className="age-gate-overlay">
      <div className="age-gate-content">
        <div className="age-gate-header">
          <h1>Age Verification</h1>
          <p>You must be 21 or older to enter</p>
        </div>

        <form className="age-gate-form" onSubmit={(e) => { e.preventDefault(); handleVerify(); }}>
          <div className="date-inputs">
            <div className="date-input-group">
              <label htmlFor="month">Month</label>
              <input
                id="month"
                type="number"
                min="1"
                max="12"
                placeholder="MM"
                value={userMonth}
                onChange={(e) => setUserMonth(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="day">Day</label>
              <input
                id="day"
                type="number"
                min="1"
                max="31"
                placeholder="DD"
                value={userDay}
                onChange={(e) => setUserDay(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="year">Year</label>
              <input
                id="year"
                type="number"
                min="1900"
                max={new Date().getFullYear()}
                placeholder="YYYY"
                value={userYear}
                onChange={(e) => setUserYear(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
          </div>

          {error && <p className="age-gate-error">{error}</p>}

          <button type="submit" className="btn btn-primary age-gate-button">
            Enter
          </button>
        </form>

        <p className="age-gate-disclaimer">
          By entering, you certify that you are of legal age to purchase cannabis in your jurisdiction.
        </p>
      </div>
    </div>
  );
}
