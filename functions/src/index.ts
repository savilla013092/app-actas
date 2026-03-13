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
  createInitialAssignmentDraft,
  registerInitialAssignmentCustodianSignature,
  registerInitialAssignmentEvidence,
  registerInitialAssignmentReviewerSignature,
} from './assignmentCallables';
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
  onAsignacionFirmadaCompleta,
  onDocumentoModificado,
  onRevisionFirmadaCompleta,
  onUsuarioWriteSyncClaims,
} from './triggers';
