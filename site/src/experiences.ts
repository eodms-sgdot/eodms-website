import type { TranslationKey } from './i18n';

export interface ExplorerExperience {
  id: 'eodms' | 'napl';
  titleKey: TranslationKey;
  /** Part of the title (e.g. the Earth-observation letters) shown in the pulsing time-of-day colour */
  titleAccentKey?: TranslationKey;
  fixedCollectionId?: string;
}

export const eodmsExperience: ExplorerExperience = {
  id: 'eodms',
  titleKey: 'appTitle',
};

export const naplExperience: ExplorerExperience = {
  id: 'napl',
  titleKey: 'naplTitle',
  fixedCollectionId: 'NAPL',
};