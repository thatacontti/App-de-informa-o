'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction, type LoginErrorCode, type LoginState } from './actions';

const ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  account_inactive: 'Conta desativada. Procure um administrador.',
  too_many_attempts:
    'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
  unknown: 'Não foi possível fazer login. Tente novamente.',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Validando…' : 'Entrar'}
    </Button>
  );
}

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction] = useFormState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? '/'} />

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="seu.email@catarina.local"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{ERROR_MESSAGES[state.error]}</AlertDescription>
        </Alert>
      )}

      <SubmitButton />
    </form>
  );
}
