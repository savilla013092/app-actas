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
exports.onUsuarioWriteSyncClaims = exports.onRevisionFirmadaCompleta = exports.onDocumentoModificado = exports.onActivoWriteSyncSearch = exports.startAssetImport = exports.searchActiveAssets = exports.markExpressLoanReturned = exports.createExpressLoan = exports.registerRevisionEvidence = exports.registerReviewerSignature = exports.registerCustodianSignature = exports.createRevisionDraft = exports.refreshSessionClaims = exports.adminUpdateUser = exports.adminSetUserActive = exports.adminResetPassword = exports.adminCreateUser = void 0;
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
var userCallables_1 = require("./userCallables");
Object.defineProperty(exports, "adminCreateUser", { enumerable: true, get: function () { return userCallables_1.adminCreateUser; } });
Object.defineProperty(exports, "adminResetPassword", { enumerable: true, get: function () { return userCallables_1.adminResetPassword; } });
Object.defineProperty(exports, "adminSetUserActive", { enumerable: true, get: function () { return userCallables_1.adminSetUserActive; } });
Object.defineProperty(exports, "adminUpdateUser", { enumerable: true, get: function () { return userCallables_1.adminUpdateUser; } });
Object.defineProperty(exports, "refreshSessionClaims", { enumerable: true, get: function () { return userCallables_1.refreshSessionClaims; } });
var revisionCallables_1 = require("./revisionCallables");
Object.defineProperty(exports, "createRevisionDraft", { enumerable: true, get: function () { return revisionCallables_1.createRevisionDraft; } });
Object.defineProperty(exports, "registerCustodianSignature", { enumerable: true, get: function () { return revisionCallables_1.registerCustodianSignature; } });
Object.defineProperty(exports, "registerReviewerSignature", { enumerable: true, get: function () { return revisionCallables_1.registerReviewerSignature; } });
Object.defineProperty(exports, "registerRevisionEvidence", { enumerable: true, get: function () { return revisionCallables_1.registerRevisionEvidence; } });
var assetCallables_1 = require("./assetCallables");
Object.defineProperty(exports, "createExpressLoan", { enumerable: true, get: function () { return assetCallables_1.createExpressLoan; } });
Object.defineProperty(exports, "markExpressLoanReturned", { enumerable: true, get: function () { return assetCallables_1.markExpressLoanReturned; } });
Object.defineProperty(exports, "searchActiveAssets", { enumerable: true, get: function () { return assetCallables_1.searchActiveAssets; } });
Object.defineProperty(exports, "startAssetImport", { enumerable: true, get: function () { return assetCallables_1.startAssetImport; } });
var triggers_1 = require("./triggers");
Object.defineProperty(exports, "onActivoWriteSyncSearch", { enumerable: true, get: function () { return triggers_1.onActivoWriteSyncSearch; } });
Object.defineProperty(exports, "onDocumentoModificado", { enumerable: true, get: function () { return triggers_1.onDocumentoModificado; } });
Object.defineProperty(exports, "onRevisionFirmadaCompleta", { enumerable: true, get: function () { return triggers_1.onRevisionFirmadaCompleta; } });
Object.defineProperty(exports, "onUsuarioWriteSyncClaims", { enumerable: true, get: function () { return triggers_1.onUsuarioWriteSyncClaims; } });
//# sourceMappingURL=index.js.map