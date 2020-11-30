:warning: = Breaking change

<!--
# A.B.C
##### YYYY-MMM-DD

[#x]: https://github.com/ideditor/schema-builder/issues/x
-->

# 2.1.0
##### 2020-Nov-30

* Build both minified and non-minified translation files ([#2])
* Discard `terms` preset and field properties with no values

[#2]: https://github.com/ideditor/schema-builder/issues/2

# 2.0.0
##### 2020-Nov-25

* :warning: Rename `build` endpoint to `buildDist`
* :warning: Replace `countryCodes` and `notCountryCodes` preset and field properties with `locationSet`
* :warning: Rename `maxspeed` field type to `roadspeed`
* Add `roadheight` field type
* Rename and relocate translations source file from `dist/translations/en.yaml` to `interim/source_strings.yaml`
* Add `buildDev` endpoint for compiling development-only files (e.g. `interim/source_strings.yaml`)
* Add `validate` endpoint for checking data errors without compiling any files
* Add `fetchTranslations` endpoint for downloading translation files from Transifex
* Add `sourceLocale` option for using a data language other than English
* Include unminifed JSON files in the `dist` directory
* Minify the source locale file (e.g. `dist/translations/en.json`) for consistency and space savings
* Make `lib/index.js` the main module file
* Enable code tests, es-lint, Travis CI, and Dependabot
