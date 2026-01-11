// @ts-check
import { createRequire } from 'node:module';
import { generateFields, getDefaultOptions } from './build.js';

const require = createRequire(import.meta.url);

let cachedFields;

/**
 * @param {string} locale
 * @param {Partial<import('./translations.js').TranslationOptions>} options
 */
export function getExternalTranslations(locale, options) {
  options = getDefaultOptions(options);
  const language = locale.split('-')[0];

  cachedFields ||= generateFields(options.inDirectory, { fields: {} }, {});

  let localeData;
  let languageData;
  try {
    localeData = require(`cldr-units-full/main/${locale}/units.json`);
  } catch {
    // ignore
  }
  try {
    languageData = require(`cldr-units-full/main/${language}/units.json`);
  } catch {
    // ignore
  }

  if (!localeData && !languageData) {
    // eslint-disable-next-line no-console
    console.warn(`No CLDR data for ${language}`);
  }

  const output = {};

  for (const field of Object.values(cachedFields)) {
    if (!field.measurement) continue;

    const { dimension, units } = field.measurement;

    for (const unit in units) {
      for (const type of ['long', 'narrow']) {
        const translation =
          localeData?.main[locale].units[type][`${dimension}-${unit}`]
            .displayName ||
          languageData?.main[language].units[type][`${dimension}-${unit}`]
            .displayName;

        output[dimension] ||= {};
        output[dimension][unit] ||= {};
        output[dimension][unit][type] = translation;
      }
    }
  }

  return { units: output };
}
