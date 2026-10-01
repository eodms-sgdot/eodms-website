import type { Language } from '../i18n';

export const TERMS_OF_USE_REVIEW_INTERVAL_DAYS = 30;

export const TERMS_OF_USE_TEXT: Record<Language, string[]> = {
  en: [
    'Registration is required to download EODMS data. RCM imagery is normally available within 72 hours; support is available weekdays, 07:00–15:00 ET.',
    'Use downloaded data according to its EULA. Other Government of Canada terms you have signed take precedence over these terms and any product EULA.',
    'Collected information may be used by Natural Resources Canada or other government institutions to contact or assist you and to meet reporting obligations under various Canadian laws. It is handled in accordance with the Privacy Act.',
    'Site content is protected by copyright; reproduction may require written permission.',
  ],
  fr: [
    'L’inscription est requise pour télécharger des données du SGDOT.  Les images MCR sont généralement disponibles dans les 72 heures; le soutien est offert en semaine, de 7 h à 15 h (HE).',
    'Utilisez les données téléchargées conformément à leur licence d’utilisation. Les autres conditions du gouvernement du Canada que vous avez signées prévalent sur les présentes conditions et toute licence du produit.',
    'Les renseignements recueillis peuvent être utilisés par Ressources naturelles Canada ou d’autres institutions gouvernementales pour communiquer avec vous, vous aider et satisfaire aux obligations de déclaration prévues par diverses lois canadiennes. Ils sont traités conformément à la Loi sur la protection des renseignements personnels.',
    'Le contenu du site est protégé par le droit d’auteur; sa reproduction peut nécessiter une autorisation écrite.',
  ],
};