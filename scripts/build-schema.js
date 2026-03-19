// @ts-check
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import unitPreference from 'cldr-core/supplemental/unitPreferenceData.json' with { type: 'json' };
import unitTranslations from 'cldr-units-full/main/en/units.json' with { type: 'json' };

// this file auto-generates the files in schemas/generated/* based on npm dependencies

const dimension = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://cdn.jsdelivr.net/npm/@ideditor/schema-builder/schemas/generated/dimension.json',

  enum: [
    ...new Set([
      ...Object.keys(unitPreference.supplemental.unitPreferenceData),
      // not all dimensions are defined in unitPreferenceData (such as  frequency
      // in Hertz). Therefore, we need to check the full list too.
      ...Object.keys(unitTranslations.main.en.units.long)
        .filter((item) => item.includes('-') && !item.startsWith('10p')) // exclude metric prefixes
        .map((item) => item.split('-')[0]),
    ]),
  ],
};

const usage = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://cdn.jsdelivr.net/npm/@ideditor/schema-builder/schemas/generated/usage.json',

  allOf: dimension.enum.map((key) => {
    const value = unitPreference.supplemental.unitPreferenceData[key] || {
      default: {},
    };
    return {
      if: { properties: { dimension: { const: key } } },
      then: { properties: { usage: { enum: Object.keys(value) } } },
    };
  }),
};

const units = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://cdn.jsdelivr.net/npm/@ideditor/schema-builder/schemas/generated/units.json',

  allOf: dimension.enum.map((dimension) => {
    const defaults =
      unitPreference.supplemental.unitPreferenceData[dimension] || {};

    /** @type {import('json-schema').JSONSchema4['properties']} */
    const properties = {};

    for (const key in unitTranslations.main.en.units.long) {
      if (key.startsWith(`${dimension}-`)) {
        const unit = key.split('-').slice(1).join('-');
        properties[unit] = {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
        };
      }
    }

    // units.json does not include 'Mixed Units', so we need to add some of
    // the 'Mixed Units' (only the ones which are used).
    const mixedUnits = new Set(
      Object.values(defaults)
        .flatMap(Object.values)
        .flat()
        .map((item) => item.unit),
    );

    for (const unit of mixedUnits) {
      properties[unit] ||= {
        type: 'array',
        items: { type: 'null' },
        minItems: 1,
        maxItems: 1,
      };
    }

    return {
      if: { properties: { dimension: { const: dimension } } },
      then: {
        properties: {
          units: {
            additionalProperties: false,
            properties,
          },
        },
      },
    };
  }),
};

const files = { dimension, usage, units };

const generatedFolder = join(import.meta.dirname, '../schemas/generated');
await fs.mkdir(generatedFolder, { recursive: true });

for (const [fileName, fileContent] of Object.entries(files)) {
  // eslint-disable-next-line no-await-in-loop
  await fs.writeFile(
    join(generatedFolder, `${fileName}.json`),
    JSON.stringify(fileContent, null, 4),
  );
}
