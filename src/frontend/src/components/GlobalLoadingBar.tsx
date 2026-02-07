import React, { useEffect, useState } from 'react';
import { requestTracker } from '../services/requestTracker';

/**
 * A minimal global progress indicator for any in-flight API requests.
 * Indeterminate by design (we don't have total work units for most requests).
 */
const GlobalLoadingBar: React.FC = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    return requestTracker.subscribe(setActive);
  }, []);

  if (active <= 0) return null;

  return (
    <div
      className="global-loading-bar"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="global-loading-bar__inner" />
    </div>
  );
};

export default GlobalLoadingBar;

