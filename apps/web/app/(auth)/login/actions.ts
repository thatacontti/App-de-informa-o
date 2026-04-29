'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/auth';

export type LoginErrorCode =
  | 'invalid_credentials'
  | 'account_inactive'
  | 'too_many_attempts'
  | 'unknown';

export interface LoginState {
  error?: LoginErrorCode;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email');
  const password = formData.get('password');
  const callbackUrl =
    typeof formData.get('callbackUrl') === 'string'
      ? (formData.get('callbackUrl') as string)
      : '/';

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: callbackUrl || '/',
    });
    return {};
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as { code?: string }).code as LoginErrorCode | undefined;
      return { error: code ?? 'unknown' };
    }
    throw e; // Next.js redirect throws — let it propagate
  }
}
