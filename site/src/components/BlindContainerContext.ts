import { createContext } from 'react';

/** The area directly beneath the top bar that blinds unroll within. */
export const BlindContainerContext = createContext<HTMLElement | null>(null);
