import { getDownloadURL, ref } from 'firebase/storage';

import { storage } from '@/lib/firebase/config';

export async function resolveStorageDownloadUrl(
  storagePath?: string,
  existingUrl?: string
): Promise<string | undefined> {
  if (existingUrl) {
    return existingUrl;
  }

  if (!storagePath) {
    return undefined;
  }

  try {
    return await getDownloadURL(ref(storage, storagePath));
  } catch (error) {
    console.warn('No fue posible resolver la URL de un archivo en Storage.', {
      storagePath,
      error,
    });
    return undefined;
  }
}
