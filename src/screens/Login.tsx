import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch, faEnvelopeOpenText, faRightToBracket, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { authErrorText, login, register } from '../lib/cloud';
import { Button, Card, Input, Label } from '../ui';

export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register') {
      if (password.length < 6) { setError('Пароль має містити щонайменше 6 символів'); return; }
      if (password !== password2) { setError('Паролі не збігаються'); return; }
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, name, password);
      // onAuthStateChanged в App.tsx перемкне екран
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary/50 p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground">
            <FontAwesomeIcon icon={faEnvelopeOpenText} />
          </div>
          <h1 className="text-xl font-semibold">Сімейний бюджет</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'register' ? 'Перший вхід — створіть акаунт' : 'Увійдіть, щоб продовжити'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vy@example.com" autoFocus required />
          </div>

          {mode === 'register' && (
            <div>
              <Label>Ім’я</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Як вас звати" />
            </div>
          )}

          <div>
            <Label>{mode === 'register' ? 'Новий пароль' : 'Пароль'}</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {mode === 'register' && (
            <div>
              <Label>Повторіть пароль</Label>
              <Input type="password" value={password2} onChange={e => setPassword2(e.target.value)} required />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            <FontAwesomeIcon icon={busy ? faCircleNotch : mode === 'register' ? faUserPlus : faRightToBracket} spin={busy} />
            {mode === 'login' ? 'Увійти' : 'Створити акаунт'}
          </Button>
        </form>

        <button
          className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => { setMode(m => (m === 'login' ? 'register' : 'login')); setError(''); }}
        >
          {mode === 'login' ? 'Уперше тут? Створити акаунт' : 'Вже є акаунт? Увійти'}
        </button>
      </Card>
    </div>
  );
}
