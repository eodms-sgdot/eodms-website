import type { TranslationKey } from './i18n';

export interface ExplorerExperience {
  id: 'eodms' | 'napl';
  titleKey: TranslationKey;
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