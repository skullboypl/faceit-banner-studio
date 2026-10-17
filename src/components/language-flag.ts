/** Country flag (ISO 3166 code for flagcdn.com) shown next to a language; the country that speaks it most. */
const FLAG: Record<string, string> = { en: 'gb', uk: 'ua', cs: 'cz', pt: 'br' };

export const languageFlag = (id: string) => FLAG[id] ?? id;
export const languageFlagUrl = (id: string) => `https://flagcdn.com/${languageFlag(id)}.svg`;
