"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeClassificationCode = normalizeClassificationCode;
exports.resolveClassificationName = resolveClassificationName;
exports.resolveLocationName = resolveLocationName;
const ASSET_CLASSIFICATION_MAP = {
    '0038': 'EQUIPOS DE OFICINA',
    '1102': 'URBANOS',
    '1109': 'TERRENO SERVIDUMBRE',
    '1302': 'URBANO',
    '1611': 'TANQUES',
    '1702': 'REDES DE DISTRIBUCION(ACUEDUCTO)',
    '1703': 'REDES DE RECOLECCION DE AGUAS(ALCANTARILLADO)',
    '1815': 'CAMIONETA O UTILITARIO',
    '1820': 'VOLQUETA',
    '1830': 'RECOLECTOR',
    '1835': 'MOTOCICLETA',
    '1840': 'CUATRIMOTO',
    '1845': 'VEHICULOS MAQUINAS',
    '1899': 'OTRA CLASE DE VEHICULOS',
    '1970': 'INTANGIBLES - LICENCIAS',
    '1980': 'INTANGIBLES - SOFTWARE',
    '1990': 'INTANGIBLES - SERVIDUMBRE',
    '2010': 'HERRAMIENTAS Y ACCESORIOS(ACTIVOS)',
    '2015': 'MAQUINARIA ELECTRICA Y ELECTRONICA',
    '2016': 'EQUIPO DE LA BORATORIO(VILLA SANTANA)',
    '2060': 'EQUIPO PARA ESTACION DE BOMBEO',
    '2070': 'EQUIPO DE MEDICION Y CONTROL',
    '2080': 'OTROS MAQUINARIA Y EQUIPO',
    '2420': 'FIJO O ESCRITORIO',
    '2424': 'PORTATIL',
    '2428': 'SERVIDOR',
    '2436': 'DISPOSITIVO PERIFERICO Y ACTIVO',
    '2440': 'ACCESORIOS',
    '2812': 'RADIO TELEFONO',
    '2816': 'MOVILES',
    '2820': 'TELEFONO FIJO',
    '2832': 'PLANTA',
    '2840': 'ACCESORIOS',
    '3210': 'HERRAMIENTAS',
    '3211': 'HERRAMIENTAS MENORES(CONTROL)',
    '3552': 'MUEBLES Y ENSERES',
    '3599': 'OTROS MUEBLES Y ENSERES DE OFICINA',
    '3800': 'ACCESORIOS',
    '6010': 'RECIBIDO EN COMODATO',
    '6020': 'ENTREGADO EN COMODATO',
};
const LOCATION_CATALOG = {
    '0': 'Redes',
    '1': 'Sede Administrativa',
    '2': 'Sede Operativa',
    '3': 'Sede Tecnica',
    '4': 'Parque Automotor',
    '5': 'Sede Cambulos',
    '6': 'Sede Bosques',
    '7': 'Giralda',
    '8': 'Romelia',
    '9': 'Libertadores',
    '10': 'Terreno Los Guamos',
    '11': 'Rodeo',
    '12': 'Lote B2 Colinas del Bosque',
    '13': 'Lote B Colinas',
    '14': 'Lote 3 Colinas',
    '15': 'Urbanizacion Rio Otun',
    '16': 'Sede Bosques',
    '17': 'San Diego',
    '18': 'Lote Barrio El Japon',
    '19': 'Calle 54 22 25 San Diego',
    '20': 'Calle 55 22 62 San Diego',
    '21': 'Valher',
    '22': 'Villa Alexandra',
    '23': 'Andaluxia',
    '24': 'Los Pinos',
    '25': 'Villa Fanny',
    '26': 'Planta Tratamiento',
    '27': 'Comodato',
    '28': 'Recibido en Comodato',
    '29': 'Las Violetas II',
    '30': 'Finca Motevideo Vereda El Rodeo',
    '31': 'Oriente',
    '32': 'Azules',
    '33': 'Tanque Molivento',
    '34': 'Lote 1 C La Popa',
};
const UNKNOWN_LOCATION = 'Sin asignar';
const normalizeCatalogText = (value) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const locationNames = new Map();
for (const [code, name] of Object.entries(LOCATION_CATALOG)) {
    if (!locationNames.has(normalizeCatalogText(name))) {
        locationNames.set(normalizeCatalogText(name), code);
    }
}
function normalizeClassificationCode(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    const digits = String(value).replace(/\D/g, '');
    if (!digits) {
        return undefined;
    }
    return digits.length >= 4 ? digits.slice(0, 4) : digits.padStart(4, '0');
}
function resolveClassificationName(code, fallbackCategory) {
    const normalizedCode = normalizeClassificationCode(code);
    if (normalizedCode && ASSET_CLASSIFICATION_MAP[normalizedCode]) {
        return ASSET_CLASSIFICATION_MAP[normalizedCode];
    }
    if (fallbackCategory && String(fallbackCategory).trim()) {
        return String(fallbackCategory).trim();
    }
    return 'Sin clasificacion';
}
function resolveLocationName(value) {
    if (value === undefined || value === null) {
        return UNKNOWN_LOCATION;
    }
    const raw = String(value).trim();
    if (!raw) {
        return UNKNOWN_LOCATION;
    }
    if (/^\d+$/.test(raw)) {
        return LOCATION_CATALOG[String(Number(raw))] || UNKNOWN_LOCATION;
    }
    const normalized = normalizeCatalogText(raw);
    if (normalized === 'ubicacion sin asignar' || normalized === normalizeCatalogText(UNKNOWN_LOCATION)) {
        return UNKNOWN_LOCATION;
    }
    const legacyMatch = normalized.match(/^ubicacion\s+(\d+)$/);
    if (legacyMatch) {
        return LOCATION_CATALOG[String(Number(legacyMatch[1]))] || UNKNOWN_LOCATION;
    }
    const locationCode = locationNames.get(normalized);
    if (locationCode) {
        return LOCATION_CATALOG[locationCode];
    }
    return raw;
}
//# sourceMappingURL=assetCatalogs.js.map