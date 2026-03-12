import { callCallable } from '@/services/callableService';

export interface RefreshSessionClaimsResponse {
  role?: 'admin' | 'logistica' | 'custodio';
  active: boolean;
  status: 'ready' | 'no_profile' | 'inactive';
}

export async function refreshSessionClaims(): Promise<RefreshSessionClaimsResponse> {
  return callCallable<Record<string, never>, RefreshSessionClaimsResponse>(
    'refreshSessionClaims',
    {}
  );
}
