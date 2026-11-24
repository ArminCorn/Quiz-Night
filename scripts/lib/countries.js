// Ländernamen (deutsch), ISO-Codes und Kontinent-Vorschlag.
import { createRequire } from 'node:module';
import isoCountries from 'i18n-iso-countries';
import { countries as countryList } from 'countries-list';

const require = createRequire(import.meta.url);
isoCountries.registerLocale(require('i18n-iso-countries/langs/de.json'));
isoCountries.registerLocale(require('i18n-iso-countries/langs/en.json'));

export const CONTINENTS = ['Europa', 'Asien', 'Afrika', 'Nordamerika', 'Südamerika', 'Ozeanien'];
const CONTINENT_DE = { EU: 'Europa', AS: 'Asien', AF: 'Afrika', NA: 'Nordamerika', SA: 'Südamerika', OC: 'Ozeanien' };

export function lookupCountry(isoInput) {
  const iso = String(isoInput ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso) || !isoCountries.isValid(iso)) return null;
  const info = countryList[iso];
  const all = (info?.continents ?? [info?.continent]).filter(Boolean);
  return {
    iso,
    name: isoCountries.getName(iso, 'de', { select: 'official' }) ?? isoCountries.getName(iso, 'de'),
    shortName: isoCountries.getName(iso, 'de', { select: 'alias' }) ?? null,
    numeric: isoCountries.alpha2ToNumeric(iso),
    kontinent: CONTINENT_DE[info?.continent] ?? null,
    weitereKontinente: all.map((c) => CONTINENT_DE[c]).filter((c) => c && c !== CONTINENT_DE[info?.continent]),
  };
}

/** Kontinent für die Weltkarte (nach ISO-Nummerncode). */
export function mapContinent(numeric) {
  const iso = numeric ? isoCountries.numericToAlpha2(numeric) : null;
  if (!iso) return null;
  // Für die Karte komplett zu Asien, sonst leuchtet „Europa“ bis Sibirien
  if (['RU', 'TR', 'KZ'].includes(iso)) return 'Asien';
  return CONTINENT_DE[countryList[iso]?.continent] ?? null;
}
