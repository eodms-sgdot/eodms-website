import { useState, useCallback } from 'react';

export function useTour() {
  const [isActive, setIsActive] = useState(false);
  const [startStep, setStartStep] = useState(0);

  const startTour = useCallback((fromStep = 0) => {
    setStartStep(fromStep);
    setIsActive(true);
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
  }, []);

  const toggleTour = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  return {
    isActive,
    startTour,
    endTour,
    toggleTour,
    startStep,
  };
}
