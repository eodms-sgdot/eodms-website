import { useEffect, useState } from 'react';
import { SEARCH_LOADERS } from './searchLoaderList';

/** Plays each search loader in turn, moving to the next once the current one completes a cycle. */
export default function LoaderCycle({ start = 0, onIndexChange }: { start?: number; onIndexChange?: (index: number) => void }) {
  const [step, setStep] = useState(start);
  const index = step % SEARCH_LOADERS.length;
  const { Loader } = SEARCH_LOADERS[index];

  useEffect(() => { onIndexChange?.(index); }, [index, onIndexChange]);

  return <Loader key={step} onComplete={() => setStep(previous => previous + 1)} />;
}
