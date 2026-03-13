import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import imageCompression from 'browser-image-compression';

import { storage } from '@/lib/firebase/config';
import { callCallable } from '@/services/callableService';
import { Evidencia } from '@/types/acta';

const IMAGE_UPLOAD_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const HEIC_IMAGE_TYPES = new Set(['image/heic', 'image/heif']);
const SUPPORTED_EXTENSIONS = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
]);

export const EVIDENCE_FILE_ACCEPT = '.jpg,.jpeg,.png,image/jpeg,image/png';

type EvidenceUploadErrorCode =
  | 'unsupported_ios_image'
  | 'unsupported_image_type'
  | 'compression_failed'
  | 'upload_failed'
  | 'registration_failed';

type SupportedImageType = 'image/jpeg' | 'image/png';

interface ValidatedEvidenceFile {
  file: File;
  contentType: SupportedImageType;
}

interface RegisteredEvidencePayload {
  id: string;
  storagePath: string;
  url: string;
  nombre: string;
  descripcion?: string;
}

interface UploadEvidenceBatchOptions {
  documentId: string;
  documentIdField: string;
  storagePrefix: string;
  registerCallable: string;
  files: File[];
  buildNombre: (index: number) => string;
  buildDescripcion?: (index: number) => string | undefined;
}

export class EvidenceUploadError extends Error {
  code: EvidenceUploadErrorCode;

  constructor(code: EvidenceUploadErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}

function getFileExtension(fileName: string): string | undefined {
  const extension = fileName.split('.').pop()?.trim().toLowerCase();
  return extension || undefined;
}

function sanitizeFileName(fileName: string, fallbackType: SupportedImageType): string {
  const cleanedBaseName = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const extension = fallbackType === 'image/png' ? 'png' : 'jpg';

  return `${cleanedBaseName || 'evidencia'}.${extension}`;
}

function resolveSupportedContentType(file: File): SupportedImageType {
  if (HEIC_IMAGE_TYPES.has(file.type)) {
    throw new EvidenceUploadError(
      'unsupported_ios_image',
      'Las imágenes HEIC/HEIF no son compatibles en esta carga.'
    );
  }

  if (SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return file.type as SupportedImageType;
  }

  const extension = getFileExtension(file.name);
  if (extension && SUPPORTED_EXTENSIONS.has(extension)) {
    return SUPPORTED_EXTENSIONS.get(extension) as SupportedImageType;
  }

  if (extension === 'heic' || extension === 'heif') {
    throw new EvidenceUploadError(
      'unsupported_ios_image',
      'Las imágenes HEIC/HEIF no son compatibles en esta carga.'
    );
  }

  throw new EvidenceUploadError(
    'unsupported_image_type',
    'Solo se permiten imágenes JPG o PNG.'
  );
}

function validateEvidenceFiles(files: File[]): ValidatedEvidenceFile[] {
  return files.map((file) => ({
    file,
    contentType: resolveSupportedContentType(file),
  }));
}

async function cleanupUploadedFiles(storagePaths: string[]) {
  if (storagePaths.length === 0) {
    return;
  }

  await Promise.allSettled(storagePaths.map((storagePath) => deleteObject(ref(storage, storagePath))));
}

async function compressEvidenceFile({
  file,
  contentType,
}: ValidatedEvidenceFile): Promise<File> {
  try {
    return await imageCompression(file, {
      ...IMAGE_UPLOAD_OPTIONS,
      fileType: contentType,
    });
  } catch (error) {
    throw new EvidenceUploadError(
      'compression_failed',
      'No fue posible procesar una de las imágenes antes de subirla.',
      { cause: error }
    );
  }
}

export async function uploadEvidenceBatch({
  documentId,
  documentIdField,
  storagePrefix,
  registerCallable,
  files,
  buildNombre,
  buildDescripcion,
}: UploadEvidenceBatchOptions): Promise<Evidencia[]> {
  const validatedFiles = validateEvidenceFiles(files);
  const uploadedStoragePaths: string[] = [];
  const registeredFiles: RegisteredEvidencePayload[] = [];

  try {
    for (let index = 0; index < validatedFiles.length; index += 1) {
      const currentFile = validatedFiles[index];
      const compressedFile = await compressEvidenceFile(currentFile);
      const fileName = `${Date.now()}-${index + 1}-${sanitizeFileName(currentFile.file.name, currentFile.contentType)}`;
      const storagePath = `${storagePrefix}/${documentId}/${fileName}`;
      const storageRef = ref(storage, storagePath);

      try {
        await uploadBytes(storageRef, compressedFile, {
          contentType: currentFile.contentType,
        });
      } catch (error) {
        throw new EvidenceUploadError(
          'upload_failed',
          'No fue posible subir una de las evidencias al almacenamiento.',
          { cause: error }
        );
      }

      uploadedStoragePaths.push(storagePath);

      let url: string;
      try {
        url = await getDownloadURL(storageRef);
      } catch (error) {
        throw new EvidenceUploadError(
          'upload_failed',
          'La evidencia se cargó, pero no fue posible obtener su URL de descarga.',
          { cause: error }
        );
      }

      registeredFiles.push({
        id: fileName,
        storagePath,
        url,
        nombre: buildNombre(index),
        descripcion: buildDescripcion?.(index),
      });
    }

    try {
      await callCallable<Record<string, unknown>, { count: number }>(registerCallable, {
        [documentIdField]: documentId,
        evidences: registeredFiles,
      });
    } catch (error) {
      await cleanupUploadedFiles(uploadedStoragePaths);
      throw new EvidenceUploadError(
        'registration_failed',
        'Las evidencias se cargaron, pero no se pudieron registrar en la base de datos.',
        { cause: error }
      );
    }

    return registeredFiles.map((file) => ({
      id: file.id,
      url: file.url,
      nombre: file.nombre,
      descripcion: file.descripcion,
      storagePath: file.storagePath,
      subidaEn: new Date(),
    }));
  } catch (error) {
    if (error instanceof EvidenceUploadError && error.code !== 'registration_failed') {
      await cleanupUploadedFiles(uploadedStoragePaths);
    }

    throw error;
  }
}

export function getEvidenceUploadErrorDescription(error: unknown): string {
  if (error instanceof EvidenceUploadError) {
    switch (error.code) {
      case 'unsupported_ios_image':
        return 'Las fotos HEIC o HEIF no están soportadas. Exporte o capture la evidencia en JPG o PNG.';
      case 'unsupported_image_type':
        return 'Solo se permiten imágenes JPG o PNG para las evidencias.';
      case 'compression_failed':
        return 'No fue posible procesar una de las imágenes seleccionadas.';
      case 'upload_failed':
        return 'No fue posible cargar una de las evidencias al almacenamiento.';
      case 'registration_failed':
        return 'Las evidencias se subieron, pero no pudieron registrarse y fueron limpiadas automáticamente.';
      default:
        return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'No fue posible registrar el material fotográfico.';
}
