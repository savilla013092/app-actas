export interface AssetSearchIndex {
  codigo: string;
  serial?: string;
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
}): AssetSearchIndex {
  const tokenSet = new Set<string>();
  const parts = [input.codigo, input.descripcion, input.serial, input.marca, input.modelo];

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
    serial: input.serial ? normalizeAssetSearchText(input.serial) : undefined,
    tokens: Array.from(tokenSet).slice(0, 30),
  };
}
