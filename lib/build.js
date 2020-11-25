/* eslint-disable no-console */
const colors = require('colors/safe');
const fs = require('fs');
const glob = require('glob');
const jsonschema = require('jsonschema');
const path = require('path');
const shell = require('shelljs');
const YAML = require('js-yaml');

const fieldSchema = require('../schemas/field.json');
const presetSchema = require('../schemas/preset.json');
const categorySchema = require('../schemas/preset_category.json');

let _currBuild = null;

function validateData(options) {
  const START = '🔬  ' + colors.yellow('Validating schema...');
  const END = '👍  ' + colors.green('schema okay');

  console.log('');
  console.log(START);
  console.time(END);

  processData(options, 'validate');

  console.timeEnd(END);
  console.log('');
}

function buildDev(options) {

  if (_currBuild) return _currBuild;

  const START = '🏗   ' + colors.yellow('Validating and building interim files...');
  const END = '👍  ' + colors.green('interim files built');

  console.log('');
  console.log(START);
  console.time(END);

  processData(options, 'build-interim');

  console.timeEnd(END);
  console.log('');
}

function buildDist(options) {

  if (_currBuild) return _currBuild;

  const START = '🏗   ' + colors.yellow('Validating and building dist files...');
  const END = '👍  ' + colors.green('dist files built');

  console.log('');
  console.log(START);
  console.time(END);

  return _currBuild = processData(options, 'build-dist')
    .then(() => {
      console.timeEnd(END);
      console.log('');
      _currBuild = null;
    })
    .catch((err) => {
      console.error(err);
      console.log('');
      _currBuild = null;
      process.exit(1);
    });
}

function processData(options, type) {
  if (!options) options = {};

  const dataDir = process.cwd() + '/' + (options.inDirectory || 'data');

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
    validateSchema(dataDir + '/deprecated.json', deprecated, require('../schemas/deprecated.json'));
  }

  const discarded = read(dataDir + '/discarded.json');
  if (discarded) {
    validateSchema(dataDir + '/discarded.json', discarded, require('../schemas/discarded.json'));
  }

  let categories = generateCategories(dataDir, tstrings);
  if (options.processCategories) options.processCategories(categories);

  let fields = generateFields(dataDir, tstrings, searchableFieldIDs);
  if (options.processFields) options.processFields(fields);

  let presets = generatePresets(dataDir, tstrings, searchableFieldIDs);
  if (options.processPresets) options.processPresets(presets);

  // Additional consistency checks
  validateCategoryPresets(categories, presets);
  validatePresetFields(presets, fields);

  const defaults = read(dataDir + '/preset_defaults.json');
  if (defaults) {
    validateSchema(dataDir + '/preset_defaults.json', defaults, require('../schemas/preset_defaults.json'));
    validateDefaults(defaults, categories, presets);
  }

  if (type.indexOf('build') !== 0) return;

  const sourceLocale = options.sourceLocale || 'en';

  const interimDir = process.cwd() + '/' + (options.interimDirectory || 'interim');
  if (!fs.existsSync(interimDir)) fs.mkdirSync(interimDir);
  shell.rm('-rf', [interimDir + '/*']); // clean directory

  let translations = generateTranslations(fields, presets, tstrings, searchableFieldIDs);

  let translationsForYaml = {};
  translationsForYaml[sourceLocale] = { presets: translations };
  fs.writeFileSync(interimDir + '/source_strings.yaml', translationsToYAML(translationsForYaml));

  if (type !== 'build-dist') return;

  const distDir = process.cwd() + '/' + (options.outDirectory || 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
  shell.rm('-rf', [distDir + '/*']); // clean directory

  fs.writeFileSync(distDir + '/preset_categories.min.json', JSON.stringify(categories));
  fs.writeFileSync(distDir + '/fields.min.json', JSON.stringify(fields));
  fs.writeFileSync(distDir + '/presets.min.json', JSON.stringify(presets));

  let taginfo = generateTaginfo(presets, fields, deprecated, options.taginfoProjectInfo || {});
  if (taginfo) {
    fs.writeFileSync(distDir + '/taginfo.min.json', JSON.stringify(taginfo));
  }

  let translationsForJson = {};
  translationsForJson[sourceLocale] = { presets: tstrings };

  if (!fs.existsSync(distDir + '/translations')) fs.mkdirSync(distDir + '/translations');
  fs.writeFileSync(distDir + '/translations/' + sourceLocale + '.json', JSON.stringify(translationsForJson, null, 4));

  const tasks = [
    // Minify files
    minifyJSON(dataDir + '/preset_defaults.json', distDir + '/preset_defaults.min.json'),
    minifyJSON(dataDir + '/deprecated.json', distDir + '/deprecated.min.json'),
    minifyJSON(dataDir + '/discarded.json', distDir + '/discarded.min.json'),
  ];

  return Promise.all(tasks);
}


function read(f) {
  return fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8'));
}


function validateSchema(file, instance, schema) {
  let validationErrors = jsonschema.validate(instance, schema).errors;

  if (validationErrors.length) {
    console.error(`${file}: `);
    validationErrors.forEach(error => {
      if (error.property) {
        console.error(error.property + ' ' + error.message);
      } else {
        console.error(error);
      }
    });
    console.log('');
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

    let t = tstrings.fields[id] = {
      label: field.label,
      terms: (field.terms || []).join(',')
    };

    if (field.universal) {
      searchableFieldIDs[id] = true;
    }

    if (field.placeholder) {
      t.placeholder = field.placeholder;
    }

    if (field.strings) {
      for (let i in field.strings) {
        t[i] = field.strings[i];
      }
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


function generatePresets(dataDir, tstrings, searchableFieldIDs) {
  let presets = {};

  glob.sync(dataDir + '/presets/**/*.json').forEach(file => {
    let preset = read(file);
    let id = stripLeadingUnderscores(file.match(/presets\/([^.]*)\.json/)[1]);

    validateSchema(file, preset, presetSchema);

    tstrings.presets[id] = {
      name: preset.name,
      terms: (preset.terms || []).join(',')
    };

    if (preset.moreFields) {
      preset.moreFields.forEach(fieldID => { searchableFieldIDs[fieldID] = true; });
    }

    presets[id] = preset;
  });
  return presets;
}


function generateTranslations(fields, presets, tstrings, searchableFieldIDs) {
  let translations = JSON.parse(JSON.stringify(tstrings));  // deep clone

  Object.keys(translations.fields).forEach(id => {
    let field = translations.fields[id];
    let f = fields[id];
    let options = field.options || {};
    let optkeys = Object.keys(options);

    if (f.keys) {
      field['label#'] = f.keys.map(k => `${k}=*`).join(', ');
      optkeys.forEach(k => {
        if (id === 'access') {
          options[k]['title#'] = options[k]['description#'] = `access=${k}`;
        } else {
          options[k + '#'] = `${k}=yes`;
        }
      });
    } else if (f.key) {
      field['label#'] = `${f.key}=*`;
      optkeys.forEach(k => {
        options[k + '#'] = `${f.key}=${k}`;
      });
    }

    if (f.placeholder) {
      field['placeholder#'] = `${id} field placeholder`;
    }

    if (searchableFieldIDs[id]) {
      if (f.terms && f.terms.length) {
        field['terms#'] = 'terms: ' + f.terms.join();
      }
      field.terms = '[translate with synonyms or related terms for \'' + field.label + '\', separated by commas]';
    } else {
      delete tstrings.fields[id].terms;
      delete f.terms;
      delete field.terms;
    }
  });

  Object.keys(translations.presets).forEach(id => {
    let preset = translations.presets[id];
    let p = presets[id];
    let tags = p.tags || {};
    let keys = Object.keys(tags);

    if (keys.length) {
      preset['name#'] = keys.map(k => `${k}=${tags[k]}`).join(', ');
    }

    if (p.searchable !== false) {
      if (p.terms && p.terms.length) {
        preset['terms#'] = 'terms: ' + p.terms.join();
      }
      preset.terms = `<translate with synonyms or related terms for '${preset.name}', separated by commas>`;
    } else {
      delete tstrings.presets[id].terms;
      delete p.terms;
      delete preset.terms;
    }
  });

  return translations;
}


function generateTaginfo(presets, fields, deprecated, projectInfo) {

  const packageInfo = require(process.cwd() + '/package.json');

  if (!projectInfo.name) projectInfo.name = packageInfo.name;
  if (!projectInfo.description) projectInfo.description = packageInfo.description;

  const requiredProps = ['name', 'description', 'project_url', 'contact_name', 'contact_email'];
  for (let i in requiredProps) {
    if (!(requiredProps[i] in projectInfo)) {
      console.log(colors.yellow('Cannot compile taginfo.json: missing required project property `' + requiredProps[i] + '`'));
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
    if (preset.name) {
      let legacy = (preset.searchable === false) ? ' (unsearchable)' : '';
      tag.description = [ `🄿 ${preset.name}${legacy}` ];
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
    const keys = field.keys || [ field.key ] || [];
    const isRadio = (field.type === 'radio' || field.type === 'structureRadio');

    keys.forEach(key => {
      if (field.strings && field.strings.options && !isRadio && field.type !== 'manyCombo') {
        let values = Object.keys(field.strings.options);
        values.forEach(value => {
          if (value === 'undefined' || value === '*' || value === '') return;
          let tag;
          if (field.type === 'multiCombo') {
            tag = { key: key + value };
          } else {
            tag = { key: key, value: value };
          }
          if (field.label) {
            tag.description = [ `🄵 ${field.label}` ];
          }
          coalesceTags(taginfo, tag);
        });
      } else {
        let tag = { key: key };
        if (field.label) {
          tag.description = [ `🄵 ${field.label}` ];
        }
        coalesceTags(taginfo, tag);
      }
    });
  });

  if (deprecated) deprecated = [];
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
      let description = '🄳';
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
        console.error('Unknown preset: ' + preset + ' in category ' + category.name);
        console.log('');
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
        console.error('Unknown preset "' + preset.replacement + '" referenced as replacement of preset "' + presetID + '" (' + preset.name + ')');
        console.log('');
        process.exit(1);
      } else if (p1geometry !== p2geometry) {
        console.error('The preset "' + presetID + '" has different geometry than its replacement preset, "' + preset.replacement + '". They must match for tag upgrades to work.');
        console.log('');
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
              console.error('The preset "' + presetID + '" (' + preset.name + ') will never display the field "' + fieldID + '" since they don\'t share geometry types.');
              console.log('');
              process.exit(1);
            }
          }

        } else {
          // no field found with this ID...

          let regexResult = betweenBracketsRegex.exec(fieldID);
          if (regexResult) {
            let foreignPresetID = regexResult[0];
            if (presets[foreignPresetID] === undefined) {
              console.error('Unknown preset "' + foreignPresetID + '" referenced in "' + fieldsKey + '" array of preset "' + presetID + '" (' + preset.name + ')');
              console.log('');
              process.exit(1);
            }
          } else {
            console.error('Unknown preset field "' + fieldID + '" in "' + fieldsKey + '" array of preset "' + presetID + '" (' + preset.name + ')');
            console.log('');
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
        console.error(fieldCount + ' values in "fields" of "' + preset.name + '" (' + presetID + '). Limit: ' + maxFieldsBeforeError + '. Please move lower-priority fields to "moreFields".');
        console.log('');
        process.exit(1);
      }
    }
  }

  for (let fieldID in fields) {
    if (!usedFieldIDs.has(fieldID) &&
        fields[fieldID].universal !== true &&
        (fields[fieldID].usage || 'preset') === 'preset') {
      console.log('Field "' + fields[fieldID].label + '" (' + fieldID + ') isn\'t used by any presets.');
    }
  }

}

function validateDefaults(defaults, categories, presets) {
  Object.keys(defaults).forEach(name => {
    const members = defaults[name];
    members.forEach(id => {
      if (!presets[id] && !categories[id]) {
        console.error(`Unknown category or preset: ${id} in default ${name}`);
        console.log('');
        process.exit(1);
      }
    });
  });
}

function translationsToYAML(translations) {
  // comment keys end with '#' and should sort immediately before their related key.
  function commentFirst(a, b) {
    return (a === b + '#') ? -1
      : (b === a + '#') ? 1
      : (a > b ? 1 : a < b ? -1 : 0);
  }

  return YAML.safeDump(translations, { sortKeys: commentFirst, lineWidth: -1 })
    .replace(/[^\s]+#'?:/g, '#');
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

module.exports.buildDev = buildDev;
module.exports.buildDist = buildDist;
module.exports.validate = validateData;
