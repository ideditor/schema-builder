:warning: = Breaking change

<!--
# A.B.C
##### YYYY-MMM-DD

[#x]: https://github.com/ideditor/schema-builder/issues/x
-->

# 5.1.1
##### 2022-Sep-29

* Fix a bug which caused a crash when fetching translations

# 5.1.0
##### 2022-Sep-29

* :warning: make `placeholder` property of fields referenceable like labels/terms/etc.

# 5.0.0
##### 2022-Sep-29

* :warning: add new `colour` field type ([#26])
* :warning: add functionality to reference labels/strings from other fields/presets by using the referenced preset/field name in brackets, similar to how the fields/moreFields can be referenced between presets ([#42])
* drop undocumented and unused `icon` property for fields ([#30])
* refactor js code to be an ESM module ([#42])
* improve documentation about usage of aliases and terms ([#57])

[#26]: https://github.com/ideditor/schema-builder/issues/26
[#30]: https://github.com/ideditor/schema-builder/issues/30
[#42]: https://github.com/ideditor/schema-builder/issues/42
[#57]: https://github.com/ideditor/schema-builder/pull/57


# 4.0.8
##### 2022-Jun-17

* Taginfo metadata output: Include short description about deprecated tags

# 4.0.7
##### 2022-Jan-28

* Fix fetching of translations after upgrading `js-yaml` library to v4

# 4.0.6
##### 2022-Jan-18

* Replace the broken `color` dependency with `chalk`
* Use pipe separators instead of newlines for name translation comments
* Filter out preset name from aliases and preset aliases from terms

# 4.0.4
##### 2020-Dec-10

* Don't add incorrect option comments for fields with `keys`

# 4.0.3
##### 2020-Dec-10

* Fix issue with generating source_strings.yaml when there are string keys with whitespace

# 4.0.2
##### 2020-Dec-10

* Fix issue where only the first character of translated preset names would be saved

# 4.0.1
##### 2020-Dec-10

* Use commas instead of pluses to separate tags in the field label Transifex comments

# 4.0.0
##### 2020-Dec-10

* :warning: Separate `aliases` with newlines (\n) instead of commas
* :warning: Don't include empty `terms` properties in the English locale
* Make all `terms` lower case
* Remove whitespace between `terms`
* Collapse duplicate `terms`

# 3.1.0
##### 2020-Dec-09

* Add `aliases` preset property for listing `name` synonyms ([#3])
* Fix an issue with generating some TagInfo field value descriptions

[#3]: https://github.com/ideditor/schema-builder/issues/3

# 3.0.0
##### 2020-Dec-08

* :warning: Don't include English strings redundantly in built data files that are already in translation files
* :warning: Rename `fetchTranslations` options:
  * `credentials` -> `translCredentials`
  * `organizationId` -> `translOrgId`
  * `projectId` -> `translProjectId`
  * `resourceIds` -> `translResourceIds`
  * `reviewedOnly` -> `translReviewedOnly`
* Accept translation options in the `buildDist` function in order to run `fetchTranslations` at the same time
* Add `autoSuggestions` combo field property to control whether TagInfo dropdown options should be loaded
* Add `customValues` combo field property to specify if freeform text values are allowed
* Add optional `listReusedIcons` diagnostic option to find overused icons

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
