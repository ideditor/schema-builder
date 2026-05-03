/** @param {string} string */
export function isReference(string) {
  return string.startsWith('{') && string.endsWith('}');
}

/**
 * Resolve "{presets/<id>}" to a concrete icon id (following chains). Only
 * `presets/` is valid for icons; `{fields/…}` and bare `{id}` throw.
 *
 * @param {Record<string, { icon?: string }>} presets
 * @param {string} ref
 * @param {string} contextMessage
 * @param {Set<string>} [visitedPresetIds]
 * @returns {string}
 */
function resolveIconRefToId(presets, ref, contextMessage, visitedPresetIds = new Set()) {
  if (!isReference(ref)) return ref;

  const inner = ref.slice(1, -1);
  const slashIdx = inner.indexOf('/');
  if (slashIdx === -1) {
    throw new Error(
      `Invalid icon reference “${ref}” in ${contextMessage}: use “{presets/<preset-id>}” (with a “presets/” prefix).`,
    );
  }

  const type = inner.slice(0, slashIdx);
  const id = inner.slice(slashIdx + 1);

  if (type === 'fields') {
    throw new Error(
      `Invalid icon reference “${ref}” in ${contextMessage}: icon references must use “{presets/<preset-id>}”, not “{fields/…}”.`,
    );
  }
  if (type !== 'presets') {
    throw new Error(
      `Invalid icon reference “${ref}” in ${contextMessage}: only “{presets/<preset-id>}” is allowed (unexpected prefix “${type}/”).`,
    );
  }
  if (!id) {
    throw new Error(
      `Invalid icon reference “${ref}” in ${contextMessage}: missing preset id after “presets/”.`,
    );
  }

  if (visitedPresetIds.has(id)) {
    throw new Error(
      `Cycle detected while resolving icon reference “${ref}” in ${contextMessage}: preset “${id}” appears more than once in the chain.`,
    );
  }
  visitedPresetIds.add(id);

  const referenced = presets[id];
  if (!referenced) {
    throw new Error(
      `Cannot resolve icon reference “${ref}” in ${contextMessage}: there is no preset “${id}”.`,
    );
  }

  const next = referenced.icon;
  if (next === undefined || next === null || next === '') {
    throw new Error(
      `Cannot resolve icon reference “${ref}” in ${contextMessage}: preset “${id}” has no “icon” property.`,
    );
  }

  if (isReference(next)) {
    return resolveIconRefToId(presets, next, contextMessage, visitedPresetIds);
  }
  return next;
}

/**
 * @param {Record<string, { icon?: string }>} presets
 * @param {Record<string, { icons?: Record<string, string> }>} fields
 */
function dereferencePresetIconStrings(presets, fields) {
  for (const presetID in presets) {
    const preset = presets[presetID];
    if (typeof preset.icon === 'string' && isReference(preset.icon)) {
      preset.icon = resolveIconRefToId(
        presets,
        preset.icon,
        `preset “${presetID}” icon`,
      );
    }
  }

  for (const fieldID in fields) {
    const field = fields[fieldID];
    if (!field.icons || typeof field.icons !== 'object') continue;
    for (const key of Object.keys(field.icons)) {
      const v = field.icons[key];
      if (typeof v === 'string' && isReference(v)) {
        field.icons[key] = resolveIconRefToId(
          presets,
          v,
          `field “${fieldID}” icons.${key}`,
        );
      }
    }
  }
}

/**
 * This is only used to expand references to _untranslated content_.
 * For example, `fields` can reference the list of field IDs from another
 * preset.
 *
 * @param {Record<string, object>} presets
 * @param {Record<string, object>} fields
 */
export function dereferenceUntranslatedContent(presets, fields) {
  for (const presetID in presets) {
    const preset = presets[presetID];

    // 1. fields and moreFields can reference other presets
    for (const prop of ['fields', 'moreFields']) {
      if (!preset[prop]) continue;
      for (let i = 0; i < preset[prop].length || 0; i++) {
        const otherPresetID = preset[prop][i];
        if (isReference(otherPresetID)) {
          const referencedPreset = presets[otherPresetID.slice(1, -1)];

          if (!referencedPreset) {
            throw new Error(
              `Preset “${presetID}” references “${otherPresetID}” in ${prop}.${i}, but there is no such preset.`,
            );
          }

          // preset (A) references the fields of preset (B), but (B) has no
          // fields. For now, we silently skip this to match the existing logic,
          // but in the future we could emit an error here. (TODO:)
          if (!referencedPreset[prop]) {
            preset[prop].splice(i--, 1);
            continue;
          }

          // replace the reference with every field. decrement i to reprocess this array index.
          preset[prop].splice(i--, 1, ...referencedPreset[prop]);
        }
      }
    }

    // 9. presets can reference the locationSet from other fields or presets
    if (preset.locationSetCrossReference) {
      const [type, ...foreignId] = preset.locationSetCrossReference
        .slice(1, -1)
        .split('/');

      const referenced = (
        type === 'presets' ? presets : type === 'fields' ? fields : {}
      )[foreignId.join('/')];

      if (!referenced) {
        throw new Error(
          `Preset “${presetID}” references “${foreignId}” in locationSetCrossReference, but there is no such ${type}.`,
        );
      }

      preset.locationSet = referenced.locationSet;
      delete preset.locationSetCrossReference;
    }
  }

  for (const fieldID in fields) {
    const field = fields[fieldID];

    // 2. fields can reference icons from other presets
    if (field.iconsCrossReference) {
      const referencedField = fields[field.iconsCrossReference.slice(1, -1)];

      if (!referencedField) {
        throw new Error(
          `Field “${fieldID}” references “${field.iconsCrossReference}” in iconsCrossReference, but there is no such field.`,
        );
      }

      field.icons = referencedField.icons;
      delete field.iconsCrossReference;
    }

    // 10. fields can reference the locationSet from other fields or presets
    if (field.locationSetCrossReference) {
      const [type, ...foreignId] = field.locationSetCrossReference
        .slice(1, -1)
        .split('/');

      const referenced = (
        type === 'presets' ? presets : type === 'fields' ? fields : {}
      )[foreignId.join('/')];

      if (!referenced) {
        throw new Error(
          `Field “${fieldID}” references “${foreignId}” in locationSetCrossReference, but there is no such ${type}.`,
        );
      }

      field.locationSet = referenced.locationSet;
      delete field.locationSetCrossReference;
    }
  }

  // 11. preset `icon` and field `icons` values may use "{presets/<id>}" for another preset's icon id
  dereferencePresetIconStrings(presets, fields);
}

/**
 * Copies translated strings to the presets that reference these strings.
 */
export function dereferencedTranslatableContent(tstrings, references, strict) {
  for (const presetID in references.presets) {
    // skip missing field, this language must have incomplete translations
    if (!tstrings.presets?.[presetID]) continue;

    const p = references.presets[presetID];
    // 4. presets can reference the name + terms + aliases from other presets
    if (p.nameTermsAliases) {
      const referencedPreset =
        tstrings.presets[p.nameTermsAliases.slice(1, -1)];

      if (referencedPreset) {
        tstrings.presets[presetID].name = referencedPreset.name;
        tstrings.presets[presetID].aliases = referencedPreset.aliases;
        tstrings.presets[presetID].terms = referencedPreset.terms;
      } else if (strict) {
        throw new Error(
          `Preset “${presetID}” references “${p.nameTermsAliases}” in the name, but there is no such preset.`,
        );
      }
    }
  }

  for (const fieldID in references.fields) {
    // skip missing field, this language must have incomplete translations
    if (!tstrings.fields?.[fieldID]) continue;

    const f = references.fields[fieldID];
    // 5. fields can reference the label + terms from other fields
    if (f.labelAndTerms) {
      const referencedField = tstrings.fields[f.labelAndTerms.slice(1, -1)];

      if (referencedField) {
        tstrings.fields[fieldID].label = referencedField.label;
        tstrings.fields[fieldID].terms = referencedField.terms;
      } else if (strict) {
        throw new Error(
          `Field “${fieldID}” references “${f.labelAndTerms}” in the label, but there is no such field.`,
        );
      }
    }

    // 6. fields can reference the placeholder from other fields
    if (f.placeholder) {
      const referencedField = tstrings.fields[f.placeholder.slice(1, -1)];

      if (referencedField) {
        tstrings.fields[fieldID].placeholder = referencedField.placeholder;
      } else if (strict) {
        throw new Error(
          `Field “${fieldID}” references “${f.placeholder}” in the placeholder, but there is no such field.`,
        );
      }
    }

    // 7. fields can reference the entire strings.options object from other fields
    if (f.stringsCrossReference) {
      const referencedField =
        tstrings.fields[f.stringsCrossReference.slice(1, -1)];

      if (referencedField) {
        for (const prop in referencedField) {
          if (typeof referencedField[prop] === 'object') {
            tstrings.fields[fieldID][prop] = referencedField[prop];
          }
        }
      } else if (strict) {
        throw new Error(
          `Field “${fieldID}” references “${f.stringsCrossReference}” in stringsCrossReference, but there is no such field.`,
        );
      }
    }

    // 8. specific field options can reference the label from other fields *and from other presets*
    if (f.options) {
      for (const prop in f.options) {
        for (const key in f.options[prop]) {
          const [type, ...foreignId] = f.options[prop][key]
            .slice(1, -1)
            .split('/');
          const referenced =
            type === 'presets'
              ? tstrings.presets[foreignId.join('/')].name
              : type === 'fields'
                ? tstrings.fields[foreignId.join('/')].label
                : undefined;

          if (referenced) {
            tstrings.fields[fieldID][prop] ||= {};
            tstrings.fields[fieldID][prop][key] = referenced;
          } else if (strict) {
            throw new Error(
              `Field “${fieldID}” references “${foreignId}” in options.${prop}.${key}, but there is no such ${type}.`,
            );
          }
        }
      }
    }
  }
}
