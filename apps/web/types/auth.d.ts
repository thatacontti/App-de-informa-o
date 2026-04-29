import type { DefaultSession } from 'next-auth';
import type { Role } from '@painel/shared';

declare module 'next-auth' {
  interface User {
    id: string;
    role: Role;
    name: string;
    email: string;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      name: string;
      email: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: Role;
  }
}
