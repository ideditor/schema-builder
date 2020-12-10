/* eslint-disable no-console */
/* Downloads the latest translations from Transifex */
const fs = require('fs');
const fetch = require('node-fetch');
const btoa = require('btoa');
const YAML = require('js-yaml');


function fetchTranslations(options) {

  let defaultCredentials = {
    user: 'api',
    password: ''
  };
  if (fs.existsSync(`${process.cwd()}/transifex.auth`)) {
    // Credentials can be stored in transifex.auth as a json object. You should probably gitignore this file.
    // You can use an API key instead of your password: https://docs.transifex.com/api/introduction#authentication
    // {
    //   "user": "username",
    //   "password": "password"
    // }
    defaultCredentials = JSON.parse(fs.readFileSync(`${process.cwd()}/transifex.auth`, 'utf8'));
  }

  if (!options) options = {};
  options = Object.assign({
    translCredentials: defaultCredentials,
    translOrgId: '',
    translProjectId: '',
    translResourceIds: ['presets'],
    translReviewedOnly: false,
    outDirectory: 'dist',
    sourceLocale: 'en'
  }, options);

  const outDir = `./${options.outDirectory}/translations`;

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }

  const fetchOpts = {
    headers: {
      'Authorization': 'Basic ' + btoa(options.translCredentials.user + ':' + options.translCredentials.password),
    }
  };

  const apiroot = 'https://www.transifex.com/api/2';
  const projectURL = `${apiroot}/project/${options.translProjectId}`;

  const translResourceIds = options.translResourceIds;
  return new Promise(function(resolve) {
      asyncMap(translResourceIds, getResourceInfo, function(err, results) {
        gotResourceInfo(err, results);
        asyncMap(translResourceIds, getResource, function(err, results) {
            gotResource(err, results);
            resolve();
        });
      });
  });


  function getResourceInfo(resourceId, callback) {
    let url = `https://api.transifex.com/organizations/${options.translOrgId}/projects/${options.translProjectId}/resources/${resourceId}`;
    fetch(url, fetchOpts)
      .then(res => {
        console.log(`${res.status}: ${url}`);
        return res.json();
      })
      .then(json => {
        callback(null, json);
      })
      .catch(err => callback(err));
  }

  function gotResourceInfo(err, results) {
    if (err) return console.log(err);

    let coverageByLocaleCode = {};
    results.forEach(function(info) {
      for (let code in info.stats) {
        let type = 'translated';
        if (options.translReviewedOnly &&
          (!Array.isArray(options.translReviewedOnly) || options.translReviewedOnly.indexOf(code) !== -1)) {
          // reviewed_1 = reviewed, reviewed_2 = proofread
          type = 'reviewed_1';
        }
        let coveragePart = info.stats[code][type].percentage / results.length;

        code = code.replace(/_/g, '-');
        if (coverageByLocaleCode[code] === undefined) coverageByLocaleCode[code] = 0;
        coverageByLocaleCode[code] += coveragePart;
      }
    });
    let dataLocales = {};
    // explicitly list the source locale as having 100% coverage
    dataLocales[options.sourceLocale] = { pct: 1 };

    for (let code in coverageByLocaleCode) {
      let coverage = coverageByLocaleCode[code];
      // we don't need high precision here, but we need to know if it's exactly 100% or not
      coverage = Math.floor(coverage * 100) / 100;
      dataLocales[code] = {
        pct: coverage
      };
    }

    const keys = Object.keys(dataLocales).sort();
    let sortedLocales = {};
    keys.forEach(k => sortedLocales[k] = dataLocales[k]);
    fs.writeFileSync(`${outDir}/index.json`, JSON.stringify(sortedLocales));
    fs.writeFileSync(`${outDir}/index.min.json`, JSON.stringify(sortedLocales, null, 4));
  }

  function getResource(resourceId, callback) {
    let resourceURL = `${projectURL}/resource/${resourceId}`;
    getLanguages(resourceURL, (err, codes) => {
      if (err) return callback(err);

      asyncMap(codes, getLanguage(resourceURL), (err, results) => {
        if (err) return callback(err);

        let locale = {};
        results.forEach((result, i) => {
          let presets = (result.presets && result.presets.presets) || {};
          for (const key of Object.keys(presets)) {
            let preset = presets[key];

            if (preset.name) {
                let names = preset.name.split('\n').map(s => s.trim()).filter(Boolean);
                preset.name = names[0];
                if (names.length > 1) {
                    preset.aliases = names.slice(1).join('\n');
                }
            }

            if (!preset.terms) continue;

            // remove duplicates
            preset.terms = Array.from(new Set(
                // remove translation message if it was included somehow
                preset.terms.replace(/<.*>/, '')
                  // convert to an array
                  .split(',')
                  // make everything lowercase and remove whitespace
                  .map(s => s.toLowerCase().trim())
                  // remove empty strings
                  .filter(Boolean)
              ))
              // convert back to a concatenated string
              .join(',');

            if (!preset.terms) {
              // no need to include empty terms
              delete preset.terms;
              if (!Object.keys(preset).length) {
                delete presets[key];
              }
            }
          }

          let fields = (result.presets && result.presets.fields) || {};
          for (const key of Object.keys(fields)) {
            let field = fields[key];
            if (!field.terms) continue;

            // remove duplicates
            field.terms = Array.from(new Set(
              // remove translation message if it was included somehow
              field.terms.replace(/\[.*\]/, '')
              // convert to an array
              .split(',')
              // make everything lowercase and remove whitespace
              .map(s => s.toLowerCase().trim())
              // remove empty strings
              .filter(Boolean)
            ))
            // convert back to a concatenated string
            .join(',');

            if (!field.terms) {
              delete field.terms;
              if (!Object.keys(field).length) {
                delete fields[key];
              }
            }
          }

          locale[codes[i]] = result;
        });

        callback(null, locale);
      });
    });
  }


  function gotResource(err, results) {
    if (err) return console.log(err);

    // merge in strings fetched from transifex
    let allStrings = {};
    results.forEach(resourceStrings => {
      Object.keys(resourceStrings).forEach(code => {
        if (!allStrings[code]) allStrings[code] = {};
        let source = resourceStrings[code];
        let target = allStrings[code];
        Object.keys(source).forEach(k => target[k] = source[k]);
      });
    });

    for (let code in allStrings) {
      let obj = {};
      obj[code] = allStrings[code] || {};
      fs.writeFileSync(`${outDir}/${code}.json`, JSON.stringify(obj, null, 4));
      fs.writeFileSync(`${outDir}/${code}.min.json`, JSON.stringify(obj));
    }
  }


  function getLanguage(resourceURL) {
    return (code, callback) => {
      code = code.replace(/-/g, '_');
      let url = `${resourceURL}/translation/${code}`;
      if (options.translReviewedOnly &&
        (!Array.isArray(options.translReviewedOnly) || options.translReviewedOnly.indexOf(code) !== -1)) {

        url += '?mode=reviewed';
      }
      fetch(url, fetchOpts)
        .then(res => {
          console.log(`${res.status}: ${url}`);
          return res.json();
        })
        .then(json => {
          callback(null, YAML.safeLoad(json.content)[code]);
        })
        .catch(err => callback(err));
    };
  }


  function getLanguages(resourceURL, callback) {
    let url = `${resourceURL}?details`;
    fetch(url, fetchOpts)
      .then(res => {
        console.log(`${res.status}: ${url}`);
        return res.json();
      })
      .then(json => {
        callback(null, json.available_languages
          .map(d => d.code.replace(/_/g, '-'))
          // we already have the source locale so don't download it
          .filter(d => d !== options.sourceLocale)
        );
      })
      .catch(err => callback(err));
  }
}


function asyncMap(inputs, func, callback) {
  let index = 0;
  let remaining = inputs.length;
  let results = [];
  let error;

  next();

  function next() {
    callFunc(index++);
    if (index < inputs.length) {
      setTimeout(next, 200);
    }
  }

  function callFunc(i) {
    let d = inputs[i];
    func(d, (err, data) => {
      if (err) error = err;
      results[i] = data;
      remaining--;
      if (!remaining && callback) callback(error, results);
    });
  }
}

module.exports.fetchTranslations = fetchTranslations;
