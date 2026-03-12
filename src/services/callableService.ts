import { httpsCallable } from 'firebase/functions';

import { functions } from '@/lib/firebase/config';

export async function callCallable<TRequest, TResponse>(
  name: string,
  payload: TRequest
): Promise<TResponse> {
  const callable = httpsCallable<TRequest, TResponse>(functions, name);
  const result = await callable(payload);
  return result.data;
}
