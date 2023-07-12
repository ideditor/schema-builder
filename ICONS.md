# Icons

For presets and some fields, icons can be specified. They provide an additional hint to the user about what the respective OSM tags are about. Additionaly, icons can help to make presets more universally understood, as icons are even present when presets are not translated into all languages.

# Where do the icons come from?

Icons from the below listed sources can be used. When specifying an icon, use the prefixed version of the name, for example `"icon": "maki-park"`.

* [Maki](https://labs.mapbox.com/maki-icons/) (`maki-`), map-specific icons from Mapbox
* [Temaki](https://rapideditor.github.io/temaki/docs/) (`temaki-`), an expansion pack for Maki
* [Röntgen](https://github.com/enzet/map-machine#r%C3%B6ntgen-icon-set) ([avaiable icons](https://github.com/openstreetmap/iD/tree/develop/svg/roentgen)) (`roentgen-`), part of the Map Machine project
* [Font Awesome](https://fontawesome.com/icons?d=gallery&m=free), thousands of general-purpose icons
    * There is a free and pro tier. You can use any icon from the free tier in the following styles:
        * [Solid](https://fontawesome.com/search?o=r&m=free&s=solid) (`fas-`)
        * [Regular](https://fontawesome.com/search?o=r&m=free&s=regular) (`far-`)
        * [Brands](https://fontawesome.com/search?o=r&f=brands) (`fab-`)
* [iD's presets-icons](https://github.com/openstreetmap/iD/tree/develop/svg/iD-sprite/presets), [iD's fields-icons](https://github.com/openstreetmap/iD/tree/develop/svg/iD-sprite/fields) (`iD-`)

## How can I add new icons?

A good place to submit a PR for a new icon is the [Temaki](https://github.com/rapideditor/temaki#readme) project. This is because Temaki was specifically created for icons for tagging presets and has therefore relatively low acceptance criteria and short release cycles. But in principle, you could propose icons to be added to any of the listed sources above, if you prefer to do so.

## Guidelines

In addition to the [design](https://github.com/rapideditor/temaki#design-guidelines) [guidelines](https://labs.mapbox.com/maki-icons/guidelines/), the following points should be considered when selecting or designing icons:

* icons should be as specific as possible for a given preset and not reused too much between presets
* icons should be universal and generic (i.e. not specific to a single region)
* icons are not images, i.e. don't need to be an exact depiction of the preset's features

## `imageURL`

For presets, it is possible to define an icon via the `imageURL` property in addition to an `icon`. The referenced image _might_ be displayed by an editor instead of the `icon`. For example, iD displays icons from `imageURL` only when users have not disabled to _show third party icons_.

`imageURL` is extensively used to specify the logos of brand presets by the [name-suggestion-index](https://github.com/osmlab/name-suggestion-index) project.
