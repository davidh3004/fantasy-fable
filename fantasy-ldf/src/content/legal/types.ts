/**
 * Legal documents live here rather than in the message catalogues: they are
 * prose, not interface strings, and a paragraph of a privacy policy has
 * nothing in common with a button label. Keeping them apart also means a
 * change to the policy is a change to one reviewable file.
 */

export type LegalSection = {
  heading: string;
  /** Rendered in order; a section may be all prose, all bullets, or both. */
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDoc = {
  title: string;
  /** Shown under the title so a reader can tell how current this is. */
  updated: string;
  intro: string[];
  sections: LegalSection[];
};

export type LocalizedDoc = { es: LegalDoc; en: LegalDoc };

/** Everything a reader needs to reach a human about their data. */
export const LEGAL_CONTACT_EMAIL = "henriquezdavid3004@gmail.com";
export const LEGAL_CONTROLLER = "David Henríquez";
export const LEGAL_MINIMUM_AGE = 13;
