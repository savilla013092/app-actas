import { deleteObject, ref, uploadBytes } from 'firebase/storage';
import imageCompression from 'browser-image-compression';

import { storage } from '@/lib/firebase/config';
import { callCallable } from '@/services/callableService';
import {
  ensureOperationalSession,
  getOperationalSessionErrorDescription,
  OperationalSessionError,
} from '@/services/sessionService';
import { Evidencia } from '@/types/acta';
import { RolUsuario } from '@/types/usuario';

const IMAGE_UPLOAD_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

const STORAGE_CODE_UNAUTHORIZED = 'storage/unauthorized';
const STORAGE_CODE_UNAUTHENTICATED = 'storage/unauthenticated';
const STORAGE_CODE_CANCELED = 'storage/canceled';
const STORAGE_CODE_RETRY_LIMIT = 'storage/retry-limit-exceeded';
const CALLABLE_CODE_PERMISSION_DENIED = 'functions/permission-denied';
const CALLABLE_CODE_UNAUTHENTICATED = 'functions/unauthenticated';
const CALLABLE_CODE_PERMISSION_DENIED_LEGACY = 'permission-denied';
const CALLABLE_CODE_UNAUTHENTICATED_LEGACY = 'unauthenticated';
const DEFAULT_ALLOWED_ROLES: RolUsuario[] = ['admin', 'logistica'];

const SUPPORTED_UPLOAD_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const HEIC_IMAGE_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const SUPPORTED_EXTENSIONS = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['heic', 'image/heic'],
  ['heif', 'image/heif'],
]);

export const EVIDENCE_FILE_ACCEPT =
  '.jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif';

type EvidenceUploadErrorCode =
  | 'unsupported_image_type'
  | 'conversion_failed'
  | 'compression_failed'
  | 'upload_unauthorized'
  | 'upload_canceled'
  | 'upload_retry_limit_exceeded'
  | 'upload_failed'
  | 'registration_unauthorized'
  | 'registration_failed';

type SupportedImageType = 'image/jpeg' | 'image/png';
type SupportedInputImageType = SupportedImageType | 'image/heic' | 'image/heif';

interface NormalizedEvidenceFile {
  file: File;
  contentType: SupportedImageType;
}

export interface UploadedEvidenceFile {
  id: string;
  storagePath: string;
  url?: string;
  nombre: string;
  descripcion?: string;
  contentType: SupportedImageType;
}

interface UploadFilesToStorageOptions {
  documentId: string;
  storagePrefix: string;
  files: File[];
  buildNombre: (index: number, file: File) => string;
  buildDescripcion?: (index: number, file: File) => string | undefined;
  allowedRoles?: RolUsuario[];
}

interface UploadEvidenceBatchOptions extends UploadFilesToStorageOptions {
  documentIdField: string;
  registerCallable: string;
}

export class EvidenceUploadError extends Error {
  code: EvidenceUploadErrorCode;

  constructor(code: EvidenceUploadErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : undefined;
}

function getErrorCause(error: unknown): unknown {
  return typeof error === 'object' &&
    error !== null &&
    'cause' in error
    ? (error as { cause?: unknown }).cause
    : undefined;
}

function getFileExtension(fileName: string): string | undefined {
  const extension = fileName.split('.').pop()?.trim().toLowerCase();
  return extension || undefined;
}

function replaceFileExtension(fileName: string, nextExtension: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '');
  return `${baseName || 'evidencia'}.${nextExtension}`;
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

function resolveInputContentType(file: File): SupportedInputImageType {
  if (SUPPORTED_UPLOAD_IMAGE_TYPES.has(file.type)) {
    return file.type as SupportedImageType;
  }

  if (HEIC_IMAGE_TYPES.has(file.type)) {
    return file.type.includes('heif') ? 'image/heif' : 'image/heic';
  }

  const extension = getFileExtension(file.name);
  if (extension && SUPPORTED_EXTENSIONS.has(extension)) {
    return SUPPORTED_EXTENSIONS.get(extension) as SupportedInputImageType;
  }

  throw new EvidenceUploadError(
    'unsupported_image_type',
    'Solo se permiten imagenes JPG, PNG, HEIC o HEIF.'
  );
}

async function convertHeicImage(file: File): Promise<NormalizedEvidenceFile> {
  try {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    const convertedBlob = Array.isArray(converted) ? converted[0] : converted;

    if (!(convertedBlob instanceof Blob)) {
      throw new Error('INVALID_HEIC_RESULT');
    }

    return {
      file: new File([convertedBlob], replaceFileExtension(file.name, 'jpg'), {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      }),
      contentType: 'image/jpeg',
    };
  } catch (error) {
    throw new EvidenceUploadError(
      'conversion_failed',
      'No fue posible convertir una de las fotos del dispositivo a JPG.',
      { cause: error }
    );
  }
}

async function normalizeImageFile(file: File): Promise<NormalizedEvidenceFile> {
  const inputType = resolveInputContentType(file);

  if (inputType === 'image/jpeg' || inputType === 'image/png') {
    return {
      file,
      contentType: inputType,
    };
  }

  return convertHeicImage(file);
}

function classifyStorageError(error: unknown, fallbackMessage: string): EvidenceUploadError {
  if (error instanceof OperationalSessionError) {
    return new EvidenceUploadError(
      'upload_unauthorized',
      getOperationalSessionErrorDescription(error) ??
        'Tu sesion no esta habilitada para registrar evidencias. Cierra sesion e ingresa otra vez.',
      { cause: error }
    );
  }

  const errorCode = getErrorCode(error);

  switch (errorCode) {
    case STORAGE_CODE_UNAUTHORIZED:
    case STORAGE_CODE_UNAUTHENTICATED:
      return new EvidenceUploadError(
        'upload_unauthorized',
        'Tu sesion no esta habilitada para registrar evidencias. Cierra sesion e ingresa otra vez.',
        { cause: error }
      );
    case STORAGE_CODE_CANCELED:
      return new EvidenceUploadError(
        'upload_canceled',
        'La carga de una de las evidencias fue cancelada antes de completarse.',
        { cause: error }
      );
    case STORAGE_CODE_RETRY_LIMIT:
      return new EvidenceUploadError(
        'upload_retry_limit_exceeded',
        'La carga de una de las evidencias agoto sus reintentos. Revise la conexion e intente otra vez.',
        { cause: error }
      );
    default:
      return new EvidenceUploadError('upload_failed', fallbackMessage, { cause: error });
  }
}

function classifyRegistrationError(error: unknown): EvidenceUploadError {
  if (error instanceof OperationalSessionError) {
    return new EvidenceUploadError(
      'registration_unauthorized',
      getOperationalSessionErrorDescription(error) ??
        'Tu sesion no esta habilitada para registrar evidencias. Cierra sesion e ingresa otra vez.',
      { cause: error }
    );
  }

  const errorCode = getErrorCode(error);
  if (
    errorCode === CALLABLE_CODE_PERMISSION_DENIED ||
    errorCode === CALLABLE_CODE_UNAUTHENTICATED ||
    errorCode === CALLABLE_CODE_PERMISSION_DENIED_LEGACY ||
    errorCode === CALLABLE_CODE_UNAUTHENTICATED_LEGACY
  ) {
    return new EvidenceUploadError(
      'registration_unauthorized',
      'Tu sesion no esta habilitada para registrar evidencias. Cierra sesion e ingresa otra vez.',
      { cause: error }
    );
  }

  return new EvidenceUploadError(
    'registration_failed',
    'Las evidencias se subieron, pero no se pudieron registrar en la base de datos.',
    { cause: error }
  );
}

function isRetryableUploadError(error: EvidenceUploadError): boolean {
  return error.code === 'upload_unauthorized' && !(getErrorCause(error) instanceof OperationalSessionError);
}

function isRetryableRegistrationError(error: EvidenceUploadError): boolean {
  return error.code === 'registration_unauthorized' && !(getErrorCause(error) instanceof OperationalSessionError);
}

export async function cleanupUploadedFiles(storagePaths: string[]) {
  if (storagePaths.length === 0) {
    return;
  }

  await Promise.allSettled(storagePaths.map((storagePath) => deleteObject(ref(storage, storagePath))));
}

async function compressEvidenceFile({
  file,
  contentType,
}: NormalizedEvidenceFile): Promise<File> {
  try {
    return await imageCompression(file, {
      ...IMAGE_UPLOAD_OPTIONS,
      fileType: contentType,
    });
  } catch (error) {
    throw new EvidenceUploadError(
      'compression_failed',
      'No fue posible procesar una de las imagenes antes de subirla.',
      { cause: error }
    );
  }
}

async function uploadFilesToStorageOnce({
  documentId,
  storagePrefix,
  files,
  buildNombre,
  buildDescripcion,
}: UploadFilesToStorageOptions): Promise<UploadedEvidenceFile[]> {
  const uploadedStoragePaths: string[] = [];
  const uploadedFiles: UploadedEvidenceFile[] = [];

  try {
    for (let index = 0; index < files.length; index += 1) {
      const normalizedFile = await normalizeImageFile(files[index]);
      const compressedFile = await compressEvidenceFile(normalizedFile);
      const fileName = `${Date.now()}-${index + 1}-${sanitizeFileName(
        normalizedFile.file.name,
        normalizedFile.contentType
      )}`;
      const storagePath = `${storagePrefix}/${documentId}/${fileName}`;
      const storageRef = ref(storage, storagePath);

      try {
        await uploadBytes(storageRef, compressedFile, {
          contentType: normalizedFile.contentType,
        });
      } catch (error) {
        throw classifyStorageError(
          error,
          'No fue posible cargar una de las evidencias al almacenamiento.'
        );
      }

      uploadedStoragePaths.push(storagePath);

      uploadedFiles.push({
        id: fileName,
        storagePath,
        nombre: buildNombre(index, normalizedFile.file),
        descripcion: buildDescripcion?.(index, normalizedFile.file),
        contentType: normalizedFile.contentType,
      });
    }

    return uploadedFiles;
  } catch (error) {
    await cleanupUploadedFiles(uploadedStoragePaths);
    throw error;
  }
}

export async function uploadFilesToStorage(options: UploadFilesToStorageOptions): Promise<UploadedEvidenceFile[]> {
  const allowedRoles = options.allowedRoles ?? DEFAULT_ALLOWED_ROLES;
  let lastError: EvidenceUploadError | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await ensureOperationalSession(allowedRoles);
      return await uploadFilesToStorageOnce(options);
    } catch (error) {
      const classifiedError = classifyStorageError(
        error,
        'No fue posible cargar una de las evidencias al almacenamiento.'
      );
      lastError = classifiedError;

      if (attempt === 0 && isRetryableUploadError(classifiedError)) {
        continue;
      }

      throw classifiedError;
    }
  }

  throw lastError ?? new EvidenceUploadError('upload_failed', 'No fue posible almacenar una de las evidencias.');
}

export async function uploadEvidenceBatch({
  documentId,
  documentIdField,
  storagePrefix,
  registerCallable,
  files,
  buildNombre,
  buildDescripcion,
  allowedRoles = DEFAULT_ALLOWED_ROLES,
}: UploadEvidenceBatchOptions): Promise<Evidencia[]> {
  let lastError: EvidenceUploadError | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const uploadedFiles = await uploadFilesToStorage({
      documentId,
      storagePrefix,
      files,
      buildNombre,
      buildDescripcion,
      allowedRoles,
    });

    try {
      await ensureOperationalSession(allowedRoles);
      await callCallable<Record<string, unknown>, { count: number }>(registerCallable, {
        [documentIdField]: documentId,
        evidences: uploadedFiles.map((file) => ({
          id: file.id,
          storagePath: file.storagePath,
          nombre: file.nombre,
          descripcion: file.descripcion,
        })),
      });

      return uploadedFiles.map((file) => ({
        id: file.id,
        nombre: file.nombre,
        descripcion: file.descripcion,
        storagePath: file.storagePath,
        subidaEn: new Date(),
      }));
    } catch (error) {
      await cleanupUploadedFiles(uploadedFiles.map((file) => file.storagePath));
      const classifiedError = classifyRegistrationError(error);
      lastError = classifiedError;

      if (attempt === 0 && isRetryableRegistrationError(classifiedError)) {
        continue;
      }

      throw classifiedError;
    }
  }

  throw lastError ?? new EvidenceUploadError(
    'registration_failed',
    'Las evidencias se subieron, pero no se pudieron registrar en la base de datos.'
  );
}

export function getEvidenceUploadErrorDescription(error: unknown): string {
  if (error instanceof EvidenceUploadError) {
    switch (error.code) {
      case 'unsupported_image_type':
        return 'Solo se permiten imagenes JPG, PNG, HEIC o HEIF.';
      case 'conversion_failed':
        return 'No fue posible convertir una de las fotos del dispositivo. Intente de nuevo o use una imagen JPG o PNG.';
      case 'compression_failed':
        return 'No fue posible procesar una de las imagenes seleccionadas antes de subirla.';
      case 'upload_unauthorized':
        return 'Tu sesion no esta habilitada para registrar evidencias. Cierra sesion e ingresa otra vez.';
      case 'upload_canceled':
        return 'La carga de una de las evidencias fue cancelada antes de completarse.';
      case 'upload_retry_limit_exceeded':
        return 'La carga de una de las evidencias agoto sus reintentos. Revise la conexion e intente nuevamente.';
      case 'upload_failed':
        return 'No fue posible almacenar una de las evidencias.';
      case 'registration_unauthorized':
        return 'Tu sesion no esta habilitada para registrar evidencias. Cierra sesion e ingresa otra vez.';
      case 'registration_failed':
        return 'Las evidencias se subieron, pero no pudieron registrarse y fueron limpiadas automaticamente.';
      default:
        return error.message;
    }
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return classifyStorageError(error, 'No fue posible almacenar una de las evidencias.').message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'No fue posible registrar el material fotografico.';
}
