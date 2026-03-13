import { getAssetClassification } from '@/lib/utils/assetClassification';
import { getAssetLocation } from '@/lib/utils/assetLocation';

export interface AssetSearchIndex {
  codigo: string;
  serial?: string;
  classificationCode?: string;
  classificationName: string;
  locationName: string;
  tokens: string[];
}

export function normalizeAssetSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function buildAssetSearchIndex(input: {
  codigo: string;
  descripcion?: string;
  serial?: string;
  marca?: string;
  modelo?: string;
  categoria?: string;
  ubicacion?: string;
}): AssetSearchIndex {
  const classification = getAssetClassification(input.codigo, input.categoria);
  const location = getAssetLocation(input.ubicacion);
  const tokenSet = new Set<string>();
  const parts = [
    input.codigo,
    input.descripcion,
    input.serial,
    input.marca,
    input.modelo,
    classification.classificationName,
    location.locationName,
  ];

  for (const part of parts) {
    if (!part) {
      continue;
    }

    const normalized = normalizeAssetSearchText(part).replace(/[^a-z0-9]+/g, ' ');
    for (const token of normalized.split(/\s+/)) {
      if (token.length >= 2) {
        tokenSet.add(token);
      }
    }
  }

  return {
    codigo: normalizeAssetSearchText(input.codigo),
    ...(input.serial ? { serial: normalizeAssetSearchText(input.serial) } : {}),
    ...(classification.classificationCode
      ? { classificationCode: classification.classificationCode }
      : {}),
    classificationName: classification.classificationName,
    locationName: location.locationName,
    tokens: Array.from(tokenSet).slice(0, 40),
  };
}
