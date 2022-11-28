import chalk from 'chalk';
import fs from 'fs';
import glob from 'glob';
import jsonschema from 'jsonschema';
import path from 'path';
import shell from 'shelljs';
import YAML from 'js-yaml';
import marky from 'marky';
import { createRequire } from 'module';

import fetchTranslations from './translations.js';

const require = createRequire(import.meta.url);

const fieldSchema = require('../schemas/field.json');
const presetSchema = require('../schemas/preset.json');
const categorySchema = require('../schemas/preset_category.json');
const defaultsSchema = require('../schemas/preset_defaults.json');
const deprecatedSchema = require('../schemas/deprecated.json');
const discardedSchema = require('../schemas/discarded.json');

let _currBuild = null;

function validateData(options) {
  const START = '🔬  ' + chalk.yellow('Validating schema...');
  const END = '👍  ' + chalk.green('schema okay');

  process.stdout.write('\n');
  process.stdout.write(START + '\n');
  marky.mark(END);

  processData(options, 'validate');

  marky.stop(END);
  process.stdout.write('\n');
}

function buildDev(options) {

  if (_currBuild) return _currBuild;

  const START = '🏗   ' + chalk.yellow('Validating and building for development...');
  const END = '👍  ' + chalk.green('built for development');

  process.stdout.write('\n');
  process.stdout.write(START + '\n');
  marky.mark(END);

  processData(options, 'build-interim');

  marky.stop(END);
  process.stdout.write('\n');
}

function buildDist(options) {

  if (_currBuild) return _currBuild;

  const START = '🏗   ' + chalk.yellow('Validating and building dist files...');
  const END = '👍  ' + chalk.green('dist files built');

  process.stdout.write('\n');
  process.stdout.write(START + '\n');
  marky.mark(END);

  return _currBuild = processData(options, 'build-dist')
    .then(() => {
      marky.stop(END);
      process.stdout.write('\n');
      _currBuild = null;
    })
    .catch((err) => {
      process.stderr.write(err);
      process.stdout.write('\n');
      _currBuild = null;
      process.exit(1);
    });
}

function processData(options, type) {
  if (!options) options = {};
  options = Object.assign({
    inDirectory: 'data',
    interimDirectory: 'interim',
    outDirectory: 'dist',
    sourceLocale: 'en',
    taginfoProjectInfo: {},
    processCategories: null,
    processFields: null,
    processPresets: null,
    listReusedIcons: false
  }, options);

  const dataDir = './' + options.inDirectory;

  // Translation strings
  let tstrings = {
    categories: {},
    fields: {},
    presets: {}
  };

  // all fields searchable under "add field"
  let searchableFieldIDs = {};

  const deprecated = read(dataDir + '/deprecated.json');
  if (deprecated) {
    validateSchema(dataDir + '/deprecated.json', deprecated, deprecatedSchema);
  }

  const discarded = read(dataDir + '/discarded.json');
  if (discarded) {
    validateSchema(dataDir + '/discarded.json', discarded, discardedSchema);
  }

  let categories = generateCategories(dataDir, tstrings);
  if (options.processCategories) options.processCategories(categories);

  let fields = generateFields(dataDir, tstrings, searchableFieldIDs);
  if (options.processFields) options.processFields(fields);

  let presets = generatePresets(dataDir, tstrings, searchableFieldIDs, options.listReusedIcons);
  if (options.processPresets) options.processPresets(presets);

  // Additional consistency checks
  validateCategoryPresets(categories, presets);
  validatePresetFields(presets, fields);

  const defaults = read(dataDir + '/preset_defaults.json');
  if (defaults) {
    validateSchema(dataDir + '/preset_defaults.json', defaults, defaultsSchema);
    validateDefaults(defaults, categories, presets);
  }

  if (type.indexOf('build') !== 0) return;

  const sourceLocale = options.sourceLocale;

  const interimDir = './' + options.interimDirectory;
  if (!fs.existsSync(interimDir)) fs.mkdirSync(interimDir);
  shell.rm('-f', [interimDir + '/*']); // clean directory

  let translations = generateTranslations(fields, presets, tstrings, searchableFieldIDs);

  let translationsForYaml = {};
  translationsForYaml[sourceLocale] = { presets: translations };
  fs.writeFileSync(interimDir + '/source_strings.yaml', translationsToYAML(translationsForYaml));

  if (type !== 'build-dist') return;

  const doFetchTranslations = options.translOrgId && options.translProjectId;

  const distDir = './' + options.outDirectory;
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
  // clean directory
  shell.rm('-f', [distDir + '/*.*']);
  if (doFetchTranslations) {
    shell.rm('-rf', [distDir + '/translations']);
  }

  fs.writeFileSync(distDir + '/preset_categories.json', JSON.stringify(categories, null, 4));
  fs.writeFileSync(distDir + '/fields.json', JSON.stringify(fields, null, 4));
  fs.writeFileSync(distDir + '/presets.json', JSON.stringify(presets, null, 4));

  let taginfo = generateTaginfo(presets, fields, deprecated, tstrings, options.taginfoProjectInfo);
  if (taginfo) fs.writeFileSync(distDir + '/taginfo.json', JSON.stringify(taginfo, null, 4));

  if (defaults) fs.writeFileSync(distDir + '/preset_defaults.json', JSON.stringify(defaults, null, 4));
  if (deprecated) fs.writeFileSync(distDir + '/deprecated.json', JSON.stringify(deprecated, null, 4));
  if (discarded) fs.writeFileSync(distDir + '/discarded.json', JSON.stringify(discarded, null, 4));

  let translationsForJson = {};
  translationsForJson[sourceLocale] = { presets: tstrings };

  if (!fs.existsSync(distDir + '/translations')) fs.mkdirSync(distDir + '/translations');
  fs.writeFileSync(distDir + '/translations/' + sourceLocale + '.json', JSON.stringify(translationsForJson, null, 4));

  const tasks = [
    // Minify files
    minifyJSON(distDir + '/preset_categories.json', distDir + '/preset_categories.min.json'),
    minifyJSON(distDir + '/fields.json', distDir + '/fields.min.json'),
    minifyJSON(distDir + '/presets.json', distDir + '/presets.min.json'),
    minifyJSON(distDir + '/taginfo.json', distDir + '/taginfo.min.json'),
    minifyJSON(distDir + '/preset_defaults.json', distDir + '/preset_defaults.min.json'),
    minifyJSON(distDir + '/deprecated.json', distDir + '/deprecated.min.json'),
    minifyJSON(distDir + '/discarded.json', distDir + '/discarded.min.json'),
    minifyJSON(distDir + '/translations/' + sourceLocale + '.json', distDir + '/translations/' + sourceLocale + '.min.json')
  ];

  if (doFetchTranslations) {
    tasks.push(fetchTranslations(options));
  }
  return Promise.all(tasks);
}


function read(f) {
  return fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8'));
}


function validateSchema(file, instance, schema) {
  let validationErrors = jsonschema.validate(instance, schema).errors;

  if (validationErrors.length) {
    process.stderr.write(`${file}: \n`);
    validationErrors.forEach(error => {
      if (error.property) {
        process.stderr.write(error.property + ' ' + error.message);
      } else {
        process.stderr.write(error + '\n');
      }
    });
    process.stdout.write('\n');
    process.exit(1);
  }
}


function generateCategories(dataDir, tstrings) {
  let categories = {};

  glob.sync(dataDir + '/preset_categories/*.json').forEach(file => {
    let category = read(file);
    validateSchema(file, category, categorySchema);

    let id = 'category-' + path.basename(file, '.json');
    tstrings.categories[id] = { name: category.name };
    delete category.name;

    categories[id] = category;
  });

  return categories;
}


function generateFields(dataDir, tstrings, searchableFieldIDs) {
  let fields = {};

  glob.sync(dataDir + '/fields/**/*.json').forEach(file => {
    let field = read(file);
    let id = stripLeadingUnderscores(file.match(/fields\/([^.]*)\.json/)[1]);

    validateSchema(file, field, fieldSchema);

    let t = tstrings.fields[id] = {};

    const label = field.label;

    if (!label.startsWith('{')) {
      t.label = label;
      delete field.label;
    }

    tstrings.fields[id].terms = Array.from(new Set(
      (field.terms || [])
        .map(t => t.toLowerCase().trim())
        .filter(Boolean)
    )).join(',');
    delete field.terms;

    if (field.universal) {
      searchableFieldIDs[id] = true;
    }

    if (field.placeholder && !field.placeholder.startsWith('{')) {
      t.placeholder = field.placeholder;
      delete field.placeholder;
    }

    if (field.strings) {
      for (let key in field.strings) {
        t[key] = field.strings[key];
      }
      if (!field.options && field.strings.options) {
        field.options = Object.keys(field.strings.options);
      }
      delete field.strings;
    }

    fields[id] = field;
  });

  return fields;
}


function stripLeadingUnderscores(str) {
  return str.split('/')
    .map(s => s.replace(/^_/,''))
    .join('/');
}


function generatePresets(dataDir, tstrings, searchableFieldIDs, listReusedIcons) {
  let presets = {};

  let icons = {};

  glob.sync(dataDir + '/presets/**/*.json').forEach(file => {
    let preset = read(file);
    let id = stripLeadingUnderscores(file.match(/presets\/([^.]*)\.json/)[1]);

    validateSchema(file, preset, presetSchema);

    let names = new Set([]);
    tstrings.presets[id] = {};

    if (!preset.name.startsWith('{')) {
      tstrings.presets[id].name = preset.name;
      names.add(preset.name.toLowerCase());
      // don't include localized strings in the presets dist file since they're already in the locale file
      delete preset.name;
    }

    preset.aliases = Array.from(new Set(
      (preset.aliases || [])
      .map(t => t.trim())
      .filter(Boolean)
      .filter(t => !names.has(t.toLowerCase()))
    ));
    preset.aliases.forEach(a => names.add(a.toLowerCase()));

    preset.terms = Array.from(new Set(
      (preset.terms || [])
        .map(t => t.toLowerCase().trim())
        .filter(Boolean)
        .filter(t => !names.has(t))
    ));

    if (preset.aliases.length) tstrings.presets[id].aliases = preset.aliases.join('\n');
    if (preset.terms.length) tstrings.presets[id].terms = preset.terms.join(',');

    // don't include localized strings in the presets dist file since they're already in the locale file
    delete preset.aliases;
    delete preset.terms;

    if (preset.moreFields) {
      preset.moreFields.forEach(fieldID => { searchableFieldIDs[fieldID] = true; });
    }

    presets[id] = preset;

    if (preset.searchable !== false) {
      let icon = preset.icon || '(none)';
      if (!icons[icon]) icons[icon] = [];
      icons[icon].push(id);
    }
  });

  if (listReusedIcons) {
    const reuseLimit = typeof listReusedIcons === 'number' && listReusedIcons > 0 ? listReusedIcons : 1;

    let reusedIconPresetCount = 0;
    const reusedIcons = Object.keys(icons).filter(function(iconID) {
      const presetIDs = icons[iconID];
      if (presetIDs.length > reuseLimit) {
        reusedIconPresetCount += presetIDs.length;
        return true;
      }
      return false;
    });

    if (reusedIcons.length > 0) {
      process.stdout.write(reusedIcons.length + ' icon(s), including (none), are each used more than ' + reuseLimit + ' time(s), affecting ' + reusedIconPresetCount + ' presets\n');

      reusedIcons.sort(function(iconID1, iconID2) {
        return icons[iconID2].length - icons[iconID1].length;

      }).forEach(function(iconID) {
        const presetIDs = icons[iconID];
        process.stdout.write(iconID + ', ' + presetIDs.length + '\n');
        for (let i in presetIDs) {
          process.stdout.write('-' + presetIDs[i] + '\n');
        }
        process.stdout.write('\n');
      });
    } else {
      process.stdout.write(chalk.green('No icon is used more than ' + reuseLimit + ' time(s) across all searchable presets\n'));
    }
  }

  return presets;
}


function generateTranslations(fields, presets, tstrings, searchableFieldIDs) {
  let yamlStrings = JSON.parse(JSON.stringify(tstrings));  // deep clone

  for (let fieldId in yamlStrings.fields) {
    let yamlField = yamlStrings.fields[fieldId];
    let field = fields[fieldId];
    let options = yamlField.options || {};
    let optkeys = Object.keys(options);

    if (field.keys) {
      yamlField['#label'] = field.keys.map(k => `${k}=*`).join(', ');
    } else if (field.key) {
      yamlField['#label'] = `${field.key}=*`;
      optkeys.forEach(k => {
        options['#' + k] = `${field.key}=${k}`;
      });
    }

    if (yamlField.placeholder) {
      yamlField['#placeholder'] = `${fieldId} field placeholder`;
    }

    if (searchableFieldIDs[fieldId]) {
      if (yamlField.terms) {
        yamlField['#terms'] = 'terms: ' + yamlField.terms;
      } else {
        delete tstrings.fields[fieldId].terms;
      }
      if (yamlField.label) {
        yamlField.terms = `[translate with synonyms or related terms for '${yamlField.label}', separated by commas]`;
      } else {
        delete yamlField.terms;
      }
    } else {
      delete tstrings.fields[fieldId].terms;
      delete yamlField.terms;
    }
  }

  for (let presetId in yamlStrings.presets) {
    let yamlPreset = yamlStrings.presets[presetId];
    let preset = presets[presetId];
    let tags = preset.tags || {};
    let keys = Object.keys(tags);

    if (keys.length) {
      yamlPreset['#name'] = keys.map(k => `${k}=${tags[k]}`).join(' + ');
      if (yamlPreset.aliases) {
        yamlPreset['#name'] += ' | ' + yamlPreset.aliases.split('\n').join(', ');
      }
      yamlPreset['#name'] += ' | Translate the primary name. Optionally, add equivalent synonyms on newlines in order of preference (press the Return key).';
    }

    if (preset.searchable !== false) {
      if (yamlPreset.terms) {
        yamlPreset['#terms'] = 'terms: ' + yamlPreset.terms;
      } else {
        delete yamlPreset.terms;
      }
      if (yamlPreset.name) {
        yamlPreset.terms = `<translate with synonyms or related terms for '${yamlPreset.name}', separated by commas>`;
      }
    } else {
      delete tstrings.presets[presetId].terms;
      delete yamlPreset.terms;
    }
    delete yamlPreset.aliases;
  }

  return yamlStrings;
}


function generateTaginfo(presets, fields, deprecated, tstrings, projectInfo) {

  const packageInfo = JSON.parse(fs.readFileSync('./package.json'));

  if (!projectInfo.name) projectInfo.name = packageInfo.name;
  if (!projectInfo.description) projectInfo.description = packageInfo.description;

  const requiredProps = ['name', 'description', 'project_url', 'contact_name', 'contact_email'];
  for (let i in requiredProps) {
    if (!(requiredProps[i] in projectInfo)) {
      process.stdout.write(chalk.yellow('Cannot compile taginfo.json: missing required project property `' + requiredProps[i] + '`') + '\n');
      return null;
    }
  }

  let taginfo = {
    data_format: 1,
    project: projectInfo,
    tags: []
  };

  Object.keys(presets).forEach(id => {
    let preset = presets[id];
    if (preset.suggestion) return;

    let keys = Object.keys(preset.tags);
    let last = keys[keys.length - 1];
    let tag = { key: last };

    if (!last) return;

    if (preset.tags[last] !== '*') {
      tag.value = preset.tags[last];
    }
    if (tstrings.presets[id].name) {
      let legacy = (preset.searchable === false) ? ' (unsearchable)' : '';
      tag.description = [ `🄿 ${tstrings.presets[id].name}${legacy}` ];
    }
    if (preset.geometry) {
      setObjectType(tag, preset);
    }

    // add icon
    if (/^maki-/.test(preset.icon)) {
      tag.icon_url = 'https://cdn.jsdelivr.net/gh/mapbox/maki/icons/' +
        preset.icon.replace(/^maki-/, '') + '-15.svg';
    } else if (/^temaki-/.test(preset.icon)) {
      tag.icon_url = 'https://cdn.jsdelivr.net/gh/ideditor/temaki/icons/' +
        preset.icon.replace(/^temaki-/, '') + '.svg';
    } else if (/^fa[srb]-/.test(preset.icon)) {
      tag.icon_url = 'https://cdn.jsdelivr.net/gh/openstreetmap/iD@develop/svg/fontawesome/' +
        preset.icon + '.svg';
    } else if (/^iD-/.test(preset.icon)) {
      tag.icon_url = 'https://cdn.jsdelivr.net/gh/openstreetmap/iD@develop/svg/iD-sprite/presets/' +
        preset.icon.replace(/^iD-/, '') + '.svg';
    }

    coalesceTags(taginfo, tag);
  });

  Object.keys(fields).forEach(id => {
    const field = fields[id];
    const keys = field.keys || (field.key && [field.key]) || [];
    const isRadio = (field.type === 'radio' || field.type === 'structureRadio');

    keys.forEach(key => {
      let tag = { key: key };
      if (tstrings.fields[id].label) {
        tag.description = [ `🄵 ${tstrings.fields[id].label}` ];
      }
      coalesceTags(taginfo, tag);

      if (field.options && !isRadio && field.type !== 'manyCombo') {
        field.options.forEach(value => {
          if (value === 'undefined' || value === '*' || value === '') return;
          let tag;
          if (field.type === 'multiCombo') {
            tag = { key: key + value };
          } else {
            tag = { key: key, value: value };
          }
          if (tstrings.fields[id].label) {
            let valueLabel = tstrings.fields[id].options && tstrings.fields[id].options[value];
            if (valueLabel && typeof valueLabel === 'string') {
              tag.description = [ `🄵🅅 ${tstrings.fields[id].label}: ${valueLabel}` ];
            } else {
              tag.description = [ `🄵🅅 ${tstrings.fields[id].label}: \`${value}\`` ];
            }
          }
          coalesceTags(taginfo, tag);
        });
      }
    });
  });

  if (!deprecated) deprecated = [];
  deprecated.forEach(elem => {
    let old = elem.old;
    let oldKeys = Object.keys(old);
    if (oldKeys.length === 1) {
      let oldKey = oldKeys[0];
      let tag = { key: oldKey };

      let oldValue = old[oldKey];
      if (oldValue !== '*') tag.value = oldValue;
      let replacementStrings = [];
      for (let replaceKey in elem.replace) {
        let replaceValue = elem.replace[replaceKey];
        if (replaceValue === '$1') replaceValue = '*';
        replacementStrings.push(`${replaceKey}=${replaceValue}`);
      }
      let description = '🄳 (deprecated tag)';
      if (replacementStrings.length > 0) {
        description += ' ➜ ' + replacementStrings.join(' + ');
      }
      tag.description = [description];
      coalesceTags(taginfo, tag);
    }
  });

  taginfo.tags.forEach(elem => {
    if (elem.description) {
      elem.description = elem.description.join(', ');
    }
  });


  function coalesceTags(taginfo, tag) {
    if (!tag.key) return;

    let currentTaginfoEntries = taginfo.tags
      .filter(t => (t.key === tag.key && t.value === tag.value));

    if (currentTaginfoEntries.length === 0) {
      taginfo.tags.push(tag);
      return;
    }

    if (!tag.description) return;

    if (!currentTaginfoEntries[0].description) {
      currentTaginfoEntries[0].description = tag.description;
      return;
    }

    let isNewDescription = currentTaginfoEntries[0].description
      .indexOf(tag.description[0]) === -1;

    if (isNewDescription) {
      currentTaginfoEntries[0].description.push(tag.description[0]);
    }
  }


  function setObjectType(tag, input) {
    tag.object_types = [];
    const mapping = {
      'point'    : 'node',
      'vertex'   : 'node',
      'line'     : 'way',
      'relation' : 'relation',
      'area'     : 'area'
    };

    input.geometry.forEach(geom => {
      if (tag.object_types.indexOf(mapping[geom]) === -1) {
        tag.object_types.push(mapping[geom]);
      }
    });
  }

  return taginfo;
}


function validateCategoryPresets(categories, presets) {
  Object.keys(categories).forEach(id => {
    const category = categories[id];
    if (!category.members) return;
    category.members.forEach(preset => {
      if (presets[preset] === undefined) {
        process.stderr.write('Unknown preset: ' + preset + ' in category ' + category.name + '\n');
        process.stdout.write('\n');
        process.exit(1);
      }
    });
  });
}

function validatePresetFields(presets, fields) {
  const betweenBracketsRegex = /([^{]*?)(?=\})/;
  const maxFieldsBeforeError = 10;

  let usedFieldIDs = new Set();

  for (let presetID in presets) {
    let preset = presets[presetID];

    if (preset.replacement) {
      let replacementPreset = presets[preset.replacement];
      let p1geometry = preset.geometry.slice().sort.toString();
      let p2geometry = replacementPreset.geometry.slice().sort.toString();
      if (replacementPreset === undefined) {
        process.stderr.write('Unknown preset "' + preset.replacement + '" referenced as replacement of preset "' + presetID + '" (' + preset.name + ')\n');
        process.stdout.write('\n');
        process.exit(1);
      } else if (p1geometry !== p2geometry) {
        process.stderr.write('The preset "' + presetID + '" has different geometry than its replacement preset, "' + preset.replacement + '". They must match for tag upgrades to work.\n');
        process.stdout.write('\n');
        process.exit(1);
      }
    }

    // the keys for properties that contain arrays of field ids
    let fieldKeys = ['fields', 'moreFields'];
    for (let fieldsKeyIndex in fieldKeys) {
      let fieldsKey = fieldKeys[fieldsKeyIndex];
      if (!preset[fieldsKey]) continue; // no fields are referenced, okay

      for (let fieldIndex in preset[fieldsKey]) {
        let fieldID = preset[fieldsKey][fieldIndex];
        usedFieldIDs.add(fieldID);
        let field = fields[fieldID];
        if (field) {
          if (field.geometry) {
            let sharedGeometry = field.geometry.filter(value => preset.geometry.includes(value));
            if (!sharedGeometry.length) {
              process.stderr.write('The preset "' + presetID + '" (' + preset.name + ') will never display the field "' + fieldID + '" since they don\'t share geometry types.\n');
              process.stdout.write('\n');
              process.exit(1);
            }
          }

        } else {
          // no field found with this ID...

          let regexResult = betweenBracketsRegex.exec(fieldID);
          if (regexResult) {
            let foreignPresetID = regexResult[0];
            if (presets[foreignPresetID] === undefined) {
              process.stderr.write('Unknown preset "' + foreignPresetID + '" referenced in "' + fieldsKey + '" array of preset "' + presetID + '" (' + preset.name + ')\n');
              process.stdout.write('\n');
              process.exit(1);
            }
          } else {
            process.stderr.write('Unknown preset field "' + fieldID + '" in "' + fieldsKey + '" array of preset "' + presetID + '" (' + preset.name + ')\n');
            process.stdout.write('\n');
            process.exit(1);
          }
        }


      }
    }

    if (preset.fields) {
      // since `moreFields` is available, check that `fields` doesn't get too cluttered
      let fieldCount = preset.fields.length;

      if (fieldCount > maxFieldsBeforeError) {
        // Fields with `prerequisiteTag` or `geometry` may not always be shown,
        // so don't count them against the limits.
        const alwaysShownFields = preset.fields.filter(fieldID => {
          if (fields[fieldID] && fields[fieldID].prerequisiteTag || fields[fieldID].geometry) return false;
          return true;
        });
        fieldCount = alwaysShownFields.length;
      }
      if (fieldCount > maxFieldsBeforeError) {
        process.stderr.write(fieldCount + ' values in "fields" of "' + preset.name + '" (' + presetID + '). Limit: ' + maxFieldsBeforeError + '. Please move lower-priority fields to "moreFields".\n');
        process.stdout.write('\n');
        process.exit(1);
      }
    }
  }

  for (let fieldID in fields) {
    if (!usedFieldIDs.has(fieldID) &&
        fields[fieldID].universal !== true &&
        (fields[fieldID].usage || 'preset') === 'preset') {
      process.stdout.write('Field "' + fields[fieldID].label + '" (' + fieldID + ') isn\'t used by any presets.\n');
    }
  }

}

function validateDefaults(defaults, categories, presets) {
  Object.keys(defaults).forEach(name => {
    const members = defaults[name];
    members.forEach(id => {
      if (!presets[id] && !categories[id]) {
        process.stderr.write(`Unknown category or preset: ${id} in default ${name}\n`);
        process.stdout.write('\n');
        process.exit(1);
      }
    });
  });
}

function translationsToYAML(translations) {
  // comment keys start with '#' and should sort immediately before their related key.
  function commentFirst(a, b) {
    if (a === '#' + b) return -1;
    if (b === '#' + a) return 1;
    if (a[0] !== b[0]) {
      if (a[0] === '#') a = a.substr(1);
      if (b[0] === '#') b = b.substr(1);
    }
    return (a > b ? 1 : a < b ? -1 : 0);
  }

  return YAML.dump(translations, { sortKeys: commentFirst, lineWidth: -1 })
    .replace(/'?#.*?'?:/g, '#');
}


function minifyJSON(inPath, outPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inPath)) {
      resolve();
      return;
    }
    fs.readFile(inPath, 'utf8', (err, data) => {
      if (err) return reject(err);

      const minified = JSON.stringify(JSON.parse(data));
      fs.writeFile(outPath, minified, (err) => {
        if (err) return reject(err);
        resolve();
      });

    });
  });
}

export {
  buildDev,
  buildDist,
  validateData as validate
};
