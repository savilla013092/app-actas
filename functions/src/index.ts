import * as admin from 'firebase-admin';

admin.initializeApp();

export {
  adminCreateUser,
  adminResetPassword,
  adminSetUserActive,
  adminUpdateUser,
  refreshSessionClaims,
} from './userCallables';
export {
  createRevisionDraft,
  registerCustodianSignature,
  registerReviewerSignature,
  registerRevisionEvidence,
} from './revisionCallables';
export {
  createExpressLoan,
  markExpressLoanReturned,
  searchActiveAssets,
  startAssetImport,
} from './assetCallables';
export {
  onActivoWriteSyncSearch,
  onDocumentoModificado,
  onRevisionFirmadaCompleta,
  onUsuarioWriteSyncClaims,
} from './triggers';
