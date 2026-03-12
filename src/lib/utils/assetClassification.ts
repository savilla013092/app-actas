import assetClassificationMap from "@/lib/constants/assetClassificationMap.json";

const ASSET_CLASSIFICATION_MAP = assetClassificationMap as Record<string, string>;

export const normalizeClassificationCode = (
  value?: string | number | null
): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const digits = String(value).replace(/\D/g, "");
  if (!digits) {
    return undefined;
  }

  return digits.length >= 4 ? digits.slice(0, 4) : digits.padStart(4, "0");
};

export interface AssetClassification {
  classificationCode?: string;
  classificationName: string;
}

export function getAssetClassification(
  sourceCode?: string | number | null,
  fallbackCategory?: string | null
): AssetClassification {
  const classificationCode = normalizeClassificationCode(sourceCode);
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