# v7 Migration Guide

v7 of [id-tagging-schema](https://github.com/openstreetmap/id-tagging-schema) and [schema-builder](https://github.com/ideditor/schema-builder) contains 5 breaking changes, where data consumers will need to take action.

This document is a brief migration guide.
The full list of changes is in [CHANGELOG.md](./CHANGELOG.md).

## 1. Allow multiple values in `prerequisiteTag` property ([#87](https://github.com/ideditor/schema-builder/pull/87))

_Fields_ already had a property called `prerequisiteTag`, which previously supported 3 different formats:

```jsonc
{
  "prerequisiteTag": { "key": "electrified" }, // electrified=*
  "prerequisiteTag": { "key": "electrified", "value": "no" }, // electrified=no
  "prerequisiteTag": { "key": "electrified", "valueNot": "no" }, // electrified≠no
}
```

v7 introduces 2 new possible formats: `values` and `valuesNot`:

<!-- prettier-ignore -->
```jsonc
{
  "prerequisiteTag": { "key": "electrified" }, // electrified=*
  "prerequisiteTag": { "key": "electrified", "value": "no" }, // electrified=no
  "prerequisiteTag": { "key": "electrified", "valueNot": "no" }, // electrified≠no

  // NEW:
  "prerequisiteTag": { "key": "electrified", "values": ["contact_line", "rail"] }, // electrified=contact_line OR electrified=rail
  "prerequisiteTag": { "key": "electrified", "valuesNot": ["contact_line", "rail"] }, // electrified≠contact_line AND electrified≠rail
}
```

> [!IMPORTANT]
> Action Required: If you already support `prerequisiteTag*`, implement support for the new subproperties: `values` and `valuesNot`.

## 2. Add `schedule` field type ([#101](https://github.com/ideditor/schema-builder/pull/101))

The list of possible field types now includes a new value: `schedule`.
This value is designed for fields that support the [`opening_hours` syntax](https://osm.wiki/Key:opening_hours).

> [!IMPORTANT]
> Action Required: If you don't have a UI for [`opening_hours`](https://osm.wiki/Key:opening_hours), treat `type=schedule` the same as `type=text`.
> Otherwise, activate the [`opening_hours`](https://osm.wiki/Key:opening_hours) UI for fields with `type=schedule`

## 3. Add `integer` field type ([#217](https://github.com/ideditor/schema-builder/pull/217))

The list of possible field types now includes a new value: `integer`.
This value is designed for numeric inputs which only support integers, not fractional values.
For examples, `lanes=1.5` is impossible.

> [!IMPORTANT]
> Action Required: Either treat `type=integer` the same as `type=number`.
> Or, create a new input field which only accepts integers.

## 4. Store `terms` and `aliases` as an array in the translation files ([#227](https://github.com/ideditor/schema-builder/pull/227))

A breaking change was made to the format of files under the `dist/translations/*` folder.
Previously, the `terms` and `aliases` properties were a string, which did not match the JSON schema.
Now, these properties are arrays of strings.

```diff
--- dist/translations/de.json
  {
    "de": {
      "presets": {
        "fields": {
          "access": {
-           "terms": "zugang erlaubt,freier zugang",
+           "terms": ["zugang erlaubt", "freier zugang"],
          },
        },
        "presets": {
          "access": {
-           "terms": "werbeschild,schild,poster,neon,fahne,flagge,spam,werbebildschirm",
+           "terms": ["werbeschild", "schild", "poster", "neon", "fahne", "flagge", "spam", "werbebildschirm"],
-           "aliases": "Werbeträger\nWerbemittel\nReklame\nReklamefläche",
+           "aliases": ["Werbeträger", "Werbemittel", "Reklame", "Reklamefläche"],
          },
        },
      },
    },
  }
```

## 5. Support discarding tags, not just keys ([#231](https://github.com/ideditor/schema-builder/pull/231))

The format of `discarded[.min].json` has changed.
Previously it was an object, where the value was always `true`.
Now the value can either be `true` or a sub-object.

```jsonc
// discarded[.min].json
{
  // OLD: the value must be `true`
  "created_by": true,
  "odbl": true,

  // NEW: the value can still be true, or it can be an object which lists the tag values
  "odbl:note": true,
  "attribution": {
    "yes": true,
  },
}
```

In the example above, the following tags should be considered discardable:

- `created_by=*`
- `attribution=yes`

Any other values of the `attribution` tag are NOT be discarded.

> [!IMPORTANT]
> Action Required: If you use this file, ensure that your code handles the new format.

## 6. No more references ([#281](https://github.com/ideditor/schema-builder/pull/281))

If you currently parse the fields `stringsCrossReference` or `iconsCrossReference`, or if you handle the reference syntax (such as `"{natural/beach}"`), all this logic can be now be deleted.

References are now expanded at build-time, so fields like `stringsCrossReference` and `iconsCrossReference` will never be exposed to downstream consumers. Likewise for references such as `"{natural/beach}"`.

While this marginally increases the file size, it significantly simplifies the logic for consumers.

> [!IMPORTANT]
> Action Required: None. Optionally, you could delete this logic from your code.

## 7. Other changes

See the [CHANGELOG.md](./CHANGELOG.md) file for the 3 other non-breaking changes to the schema.
