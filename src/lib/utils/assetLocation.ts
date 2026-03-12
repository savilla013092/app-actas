import locationCatalog from "@/lib/constants/locationCatalog.json";

const LOCATION_CATALOG = locationCatalog as Record<string, string>;
const UNKNOWN_LOCATION = "Sin asignar";

const normalizeLocationText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const locationEntries = Object.entries(LOCATION_CATALOG)
  .sort((a, b) => Number(a[0]) - Number(b[0]));

const normalizedNameToLocation = new Map<string, { code: string; name: string }>();
for (const [code, name] of locationEntries) {
  const normalizedName = normalizeLocationText(name);
  if (!normalizedNameToLocation.has(normalizedName)) {
    normalizedNameToLocation.set(normalizedName, { code, name });
  }
}

export interface AssetLocation {
  locationCode?: string;
  locationName: string;
  isMapped: boolean;
}

export interface LocationOption {
  value: string;
  label: string;
  code?: string;
}

export const normalizeLocationCode = (
  value?: string | number | null
): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const raw = String(value).trim();
  if (!raw) {
    return undefined;
  }

  if (/^\d+$/.test(raw)) {
    return String(Number(raw));
  }

  const normalizedText = normalizeLocationText(raw);
  const legacyMatch = normalizedText.match(/^ubicacion\s+(\d+)$/);
  if (legacyMatch) {
    return String(Number(legacyMatch[1]));
  }

  return undefined;
};

export const LOCATION_OPTIONS: LocationOption[] = (() => {
  const options: LocationOption[] = [{ value: UNKNOWN_LOCATION, label: UNKNOWN_LOCATION }];
  const seenNames = new Set<string>([UNKNOWN_LOCATION]);

  for (const [code, name] of locationEntries) {
    if (seenNames.has(name)) {
      continue;
    }

    options.push({ value: name, label: name, code });
    seenNames.add(name);
  }

  return options;
})();

export function getAssetLocation(
  rawValue?: string | number | null
): AssetLocation {
  if (rawValue === undefined || rawValue === null) {
    return { locationName: UNKNOWN_LOCATION, isMapped: true };
  }

  const rawText = String(rawValue).trim();
  if (!rawText) {
    return { locationName: UNKNOWN_LOCATION, isMapped: true };
  }

  const normalizedText = normalizeLocationText(rawText);
  if (normalizedText === normalizeLocationText(UNKNOWN_LOCATION) || normalizedText === "ubicacion sin asignar") {
    return { locationName: UNKNOWN_LOCATION, isMapped: true };
  }

  const locationCode = normalizeLocationCode(rawText);
  if (locationCode) {
    if (LOCATION_CATALOG[locationCode]) {
      return {
        locationCode,
        locationName: LOCATION_CATALOG[locationCode],
        isMapped: true,
      };
    }

    return {
      locationCode,
      locationName: UNKNOWN_LOCATION,
      isMapped: false,
    };
  }

  const knownLocation = normalizedNameToLocation.get(normalizedText);
  if (knownLocation) {
    return {
      locationCode: knownLocation.code,
      locationName: knownLocation.name,
      isMapped: true,
    };
  }

  return {
    locationName: rawText,
    isMapped: false,
  };
}