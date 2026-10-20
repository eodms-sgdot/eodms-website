import { useEffect, useState } from 'react';
import { SEARCH_LOADERS, type SearchLoader } from './searchLoaderList';

/** Plays each search loader in turn, moving to the next once the current one completes a cycle. */
export default function LoaderCycle({ loaders = SEARCH_LOADERS, start = 0, onIndexChange }: {
  loaders?: SearchLoader[];
  start?: number;
  onIndexChange?: (index: number) => void;
}) {
  const [step, setStep] = useState(start);
  const index = step % loaders.length;
  const { Loader } = loaders[index];

  useEffect(() => { onIndexChange?.(index); }, [index, onIndexChange]);

  return <Loader key={step} onComplete={() => setStep(previous => previous + 1)} />;
}
