import type { Session } from 'next-auth';
import { auth } from '@/auth';
import type { TrpcContext } from './server';

export async function createContext(): Promise<TrpcContext> {
  const session = (await auth()) as Session | null;
  return { session };
}
