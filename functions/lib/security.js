"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_ROLES = exports.UNKNOWN_LOCATION = exports.REGION = exports.serverTimestamp = exports.storage = exports.db = void 0;
exports.normalizeText = normalizeText;
exports.tokenizeSearchParts = tokenizeSearchParts;
exports.buildAssetSearchPayload = buildAssetSearchPayload;
exports.stripUndefinedDeep = stripUndefinedDeep;
exports.getContextRole = getContextRole;
exports.ensureAuthenticated = ensureAuthenticated;
exports.ensureRole = ensureRole;
exports.getUserProfile = getUserProfile;
exports.syncUserClaims = syncUserClaims;
exports.writeAuditLog = writeAuditLog;
exports.ensureStoragePath = ensureStoragePath;
exports.resolveStoredFilePath = resolveStoredFilePath;
exports.getClientMetadata = getClientMetadata;
exports.buildDocumentHash = buildDocumentHash;
exports.toIsoDateString = toIsoDateString;
exports.mapUploadedEvidence = mapUploadedEvidence;
exports.parseExcelDate = parseExcelDate;
exports.normalizeLocation = normalizeLocation;
const crypto_1 = require("crypto");
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const assetCatalogs_1 = require("./assetCatalogs");
exports.db = admin.firestore();
exports.storage = admin.storage();
exports.serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
exports.REGION = 'us-central1';
exports.UNKNOWN_LOCATION = 'Sin asignar';
exports.VALID_ROLES = new Set(['admin', 'logistica', 'custodio']);
function normalizeText(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
function tokenizeSearchParts(parts) {
    const tokenSet = new Set();
    for (const part of parts) {
        if (!part) {
            continue;
        }
        const normalized = normalizeText(part).replace(/[^a-z0-9]+/g, ' ');
        for (const token of normalized.split(/\s+/)) {
            if (token.length >= 2) {
                tokenSet.add(token);
            }
        }
    }
    return Array.from(tokenSet).slice(0, 40);
}
function buildAssetSearchPayload(asset) {
    const codigo = typeof asset.codigo === 'string' ? asset.codigo : '';
    const serial = typeof asset.serial === 'string' ? asset.serial : '';
    const classificationCode = (0, assetCatalogs_1.normalizeClassificationCode)(codigo);
    const classificationName = (0, assetCatalogs_1.resolveClassificationName)(codigo, typeof asset.categoria === 'string' ? asset.categoria : undefined);
    const locationName = (0, assetCatalogs_1.resolveLocationName)(typeof asset.ubicacion === 'string' || typeof asset.ubicacion === 'number'
        ? asset.ubicacion
        : undefined);
    return {
        codigo: normalizeText(codigo),
        ...(serial ? { serial: normalizeText(serial) } : {}),
        ...(classificationCode ? { classificationCode } : {}),
        classificationName,
        locationName,
        tokens: tokenizeSearchParts([
            codigo,
            typeof asset.descripcion === 'string' ? asset.descripcion : undefined,
            serial,
            typeof asset.marca === 'string' ? asset.marca : undefined,
            typeof asset.modelo === 'string' ? asset.modelo : undefined,
            classificationName,
            locationName,
        ]),
    };
}
function stripUndefinedDeep(value) {
    if (Array.isArray(value)) {
        return value.map((item) => stripUndefinedDeep(item));
    }
    if (value && typeof value === 'object' && !(value instanceof Date)) {
        return Object.fromEntries(Object.entries(value)
            .filter(([, entryValue]) => entryValue !== undefined)
            .map(([key, entryValue]) => [key, stripUndefinedDeep(entryValue)]));
    }
    return value;
}
function getContextRole(context) {
    var _a;
    const role = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.role;
    return role === 'admin' || role === 'logistica' || role === 'custodio' ? role : undefined;
}
function ensureAuthenticated(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Debe iniciar sesiÃ³n para continuar.');
    }
    return context.auth;
}
function ensureRole(context, allowedRoles) {
    var _a;
    const authData = ensureAuthenticated(context);
    const role = getContextRole(context);
    if (!role || !allowedRoles.includes(role) || ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.active) !== true) {
        throw new functions.https.HttpsError('permission-denied', 'No tiene permisos para esta operaciÃ³n.');
    }
    return authData;
}
async function getUserProfile(uid) {
    const snapshot = await exports.db.collection('usuarios').doc(uid).get();
    if (!snapshot.exists) {
        return null;
    }
    return snapshot.data();
}
async function syncUserClaims(uid, profile) {
    if (!profile || profile.activo !== true || !exports.VALID_ROLES.has(profile.rol)) {
        await admin.auth().setCustomUserClaims(uid, null);
        return;
    }
    await admin.auth().setCustomUserClaims(uid, {
        role: profile.rol,
        active: true,
    });
}
async function writeAuditLog(payload) {
    await exports.db.collection('auditoria').add({
        ...payload,
        timestamp: (0, exports.serverTimestamp)(),
    });
}
function ensureStoragePath(storagePath, expectedPrefix) {
    if (!storagePath.startsWith(expectedPrefix)) {
        throw new functions.https.HttpsError('invalid-argument', 'La ruta del archivo no es vÃ¡lida.');
    }
}
function resolveStoredFilePath(file, bucketName) {
    if (file === null || file === void 0 ? void 0 : file.storagePath) {
        return file.storagePath;
    }
    const url = file === null || file === void 0 ? void 0 : file.url;
    if (!url) {
        throw new Error('STORAGE_PATH_REQUIRED');
    }
    if (url.includes('firebasestorage.googleapis.com')) {
        const match = url.match(/\/o\/([^?]+)/);
        if (match) {
            return decodeURIComponent(match[1]);
        }
    }
    if (url.includes('storage.googleapis.com')) {
        const withoutBucket = url.replace(`https://storage.googleapis.com/${bucketName}/`, '');
        return decodeURIComponent(withoutBucket.split('?')[0]);
    }
    return decodeURIComponent(url.split('?')[0]);
}
function getClientMetadata(context) {
    var _a;
    const request = context.rawRequest;
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipCliente = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : typeof forwardedFor === 'string'
            ? (_a = forwardedFor.split(',')[0]) === null || _a === void 0 ? void 0 : _a.trim()
            : request.ip || 'IP no disponible';
    return {
        ipCliente,
        userAgent: request.get('user-agent') || 'User-Agent no disponible',
    };
}
function buildDocumentHash(data) {
    return (0, crypto_1.createHash)('sha256').update(JSON.stringify(data)).digest('hex');
}
function toIsoDateString(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
        throw new functions.https.HttpsError('invalid-argument', 'La fecha suministrada no es vÃ¡lida.');
    }
    return date.toISOString();
}
function mapUploadedEvidence(files) {
    return files.map((file) => ({
        id: file.id,
        ...(file.url ? { url: file.url } : {}),
        nombre: file.nombre,
        descripcion: file.descripcion,
        storagePath: file.storagePath,
        subidaEn: new Date().toISOString(),
    }));
}
function parseExcelDate(value) {
    if (!value || value === '30/12/1899') {
        return null;
    }
    if (typeof value === 'number') {
        return new Date((value - 25569) * 86400 * 1000);
    }
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function normalizeLocation(value) {
    return (0, assetCatalogs_1.resolveLocationName)(value === undefined || value === null ? undefined : value);
}
//# sourceMappingURL=security.js.map