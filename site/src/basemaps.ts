import type { Language } from "./i18n";

// Customize BaseMap layers available in this section

/**
 * If adding a new BaseMapType, add logic to StacMap.tsx's MapContainer to display the new type.
 */
export type BaseMapType = "tile" | "vectortile";

/**
 * Add to these constants to support new Base Maps. BaseMapId matches the name of a baseMap entry in baseMaps array.
 */
export type BaseMapId = "osm" | "cbmt";

const baseMaps:BaseMap[] = [
    {
        name: "osm",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        type: "tile",
        title: [
            {language: "en", value: "OpenStreetMap"},
            {language: "fr", value: "OpenStreetMap"}
        ],
        attribution: [
            {language: "en", value: "&copy; OpenStreetMap contributors"},
            {language: "fr", value: "&copy; Contributeurs d'OpenStreetMap"}
        ]
    },
    {
        name: "cbmt",
        url: "https://tiles.arcgis.com/tiles/HsjBaDykC1mjhXz9/arcgis/rest/services/CBMT_CBCT_3857_V_OSM/VectorTileServer",
        type: "vectortile",
        title: [
            {language: "en", value: "Canada Basemap - Transportation"},
            {language: "fr", value: "Carte de base du Canada - Transport"}
        ],
        attribution: [
            {language: "en", value: "&copy; Natural Resources Canada"},
            {language: "fr", value: "&copy; Ressources naturelles Canada"}
        ]
    }
];

// End of BaseMap layer customization section

export interface BaseMap {
    name: BaseMapId,
    url: string,
    type: BaseMapType,
    title: LanguageValue[]
    attribution: LanguageValue[]
}

export interface LanguageValue {
    language: Language,
    value: string
}

/**
 * Get defined baseMaps from the const baseMaps 
 * 
 * @returns array of defined baseMaps
 */
export function getBaseMaps() : BaseMap[] {
    return baseMaps;
}

/**
 * Get a baseMap by the name/id of the baseMap
 * @param name the baseMap name or undefined if not requesting any specific map
 * @returns the baseMap or undefined if not found
 */
export function getBaseMap(name:BaseMapId|undefined) : BaseMap | undefined {

    if(name) {
        return baseMaps.find(selectedBaseMap => selectedBaseMap.name === name);
    }

    return undefined;
}

/**
 * Get the title of a baseMap in a specific language. Falls back on en locale.
 * 
 * @param map the baseMap or undefined
 * @param language the language requested
 * @returns the title or undefined if not found
 */
export function getBaseMapTitle(map:BaseMap|undefined, language:Language) : string | undefined {

    if(map) {
        const title = map.title.find(langTitle => langTitle.language === language);

        if(title) {
            return title.value;
        }

        const fallback = map.title.find(langTitle => langTitle.language === "en");
        return fallback?.value;

    }

    return undefined;
}

/**
 * Get the attribution of a baseMap in a specific language. Falls back on en locale.
 * 
 * @param map the baseMap or undefined
 * @param language the language requested
 * @returns the attribution or undefined if not found
 */
export function getBaseMapAttribution(map:BaseMap|undefined, language:Language) : string | undefined {

    if(map) {
        const attribution = map.attribution.find(langAttribtuion => langAttribtuion.language === language);
        if(attribution) {
            return attribution.value;
        }

        const fallback = map.attribution.find(langAttribtuion => langAttribtuion.language === "en");
        return fallback?.value;
    }

    return undefined;
}