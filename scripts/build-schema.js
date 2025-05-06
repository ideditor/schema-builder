// @ts-check
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import unitPreference from 'cldr-core/supplemental/unitPreferenceData.json' with { type: 'json' };
import unitTranslations from 'cldr-units-full/main/en/units.json' with { type: 'json' };

// this file auto-generates the files in schemas/generated/* based on npm dependencies

const dimension = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://cdn.jsdelivr.net/npm/@ideditor/schema-builder/schemas/generated/dimension.json',

  enum: Object.keys(unitPreference.supplemental.unitPreferenceData),
};

const usage = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://cdn.jsdelivr.net/npm/@ideditor/schema-builder/schemas/generated/usage.json',

  allOf: Object.entries(unitPreference.supplemental.unitPreferenceData).map(
    ([key, value]) => ({
      if: { properties: { dimension: { const: key } } },
      then: { properties: { usage: { enum: Object.keys(value) } } },
    }),
  ),
};

const units = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://cdn.jsdelivr.net/npm/@ideditor/schema-builder/schemas/generated/units.json',

  allOf: dimension.enum.map((dimension) => {
    const values = Object.keys(unitTranslations.main.en.units.long)
      .filter((key) => key.startsWith(`${dimension}-`))
      .map((key) => key.split('-').slice(1).join('-'));

    return {
      if: { properties: { dimension: { const: dimension } } },
      then: {
        properties: {
          units: {
            additionalProperties: false,
            properties: Object.fromEntries(
              values.map((value) => [
                value,
                { type: 'array', items: { type: 'string' }, minItems: 1 },
              ]),
            ),
          },
        },
      },
    };
  }),
};

const files = { dimension, usage, units };

const generatedFolder = join(import.meta.dirname, '../schemas/generated');
await fs.mkdir(generatedFolder, { recursive: true });

for (const key in files) {
  // eslint-disable-next-line no-await-in-loop
  await fs.writeFile(
    join(generatedFolder, `${key}.json`),
    JSON.stringify(files[key], null, 4),
  );
}
