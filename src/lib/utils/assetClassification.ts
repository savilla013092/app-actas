const ASSET_CLASSIFICATION_MAP: Record<string, string> = {
  "2420": "Equipo de Computo",
  "2430": "Mobiliario",
  "2440": "Vehiculos",
  "2450": "Maquinaria",
};

const extractClassificationCode = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  const numericPrefix = value.replace(/\D/g, "").slice(0, 4);
  return numericPrefix.length === 4 ? numericPrefix : undefined;
};

export interface AssetClassification {
  classificationCode?: string;
  classificationName: string;
}

export function getAssetClassification(
  sourceCode?: string | null,
  fallbackCategory?: string | null
): AssetClassification {
  const classificationCode = extractClassificationCode(sourceCode);
  const mappedCategory = classificationCode
    ? ASSET_CLASSIFICATION_MAP[classificationCode]
    : undefined;

  if (mappedCategory) {
    return {
      classificationCode,
      classificationName: mappedCategory,
    };
  }

  if (fallbackCategory?.trim()) {
    return {
      classificationCode,
      classificationName: fallbackCategory.trim(),
    };
  }

  return {
    classificationCode,
    classificationName: "Sin clasificacion",
  };
}