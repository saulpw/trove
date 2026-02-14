// Auth: per-user password stored in localStorage

export interface Credentials {
  username: string;
  password: string;
}

const CREDS_KEY = 'trove_credentials';

export function getCredentials(): Credentials | null {
  const stored = localStorage.getItem(CREDS_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

export function saveCredentials(username: string, password: string): void {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ username, password }));
}

export function clearCredentials(): void {
  localStorage.removeItem(CREDS_KEY);
}

export function isSignedIn(): boolean {
  return getCredentials() !== null;
}

export function togglePasswordVisibility(): void {
  const input = document.getElementById('auth-password') as HTMLInputElement;
  const svg = input.nextElementSibling!.querySelector('svg')!;
  const shut = svg.querySelector('.eye-shut') as HTMLElement;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  shut.style.display = isHidden ? '' : 'none';
}

export function showSignIn(show: boolean): void {
  const overlay = document.getElementById('signin-overlay')!;
  overlay.style.display = show ? 'flex' : 'none';
  if (show) (document.getElementById('auth-username') as HTMLInputElement).focus();
}

export async function handleSignIn(onSuccess: (username: string) => void): Promise<void> {
  const username = (document.getElementById('auth-username') as HTMLInputElement).value.trim();
  const password = (document.getElementById('auth-password') as HTMLInputElement).value;
  const status = document.getElementById('auth-status')!;

  if (!username || !password) {
    status.textContent = 'Enter username and password';
    status.className = 'status-error';
    return;
  }

  status.textContent = 'Signing in...';
  status.className = '';

  try {
    const response = await fetch('/.netlify/functions/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      saveCredentials(username, password);
      status.textContent = '';
      showSignIn(false);
      onSuccess(username);
    } else {
      const result = await response.json();
      status.textContent = result.error || 'Sign in failed';
      status.className = 'status-error';
    }
  } catch (e) {
    status.textContent = 'Network error';
    status.className = 'status-error';
  }
}

export function initSignInForm(onSignIn: () => void): void {
  const overlay = document.getElementById('signin-overlay');
  if (overlay) {
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onSignIn(); }
      else if (e.key === 'Escape') { showSignIn(false); }
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) showSignIn(false);
    });
  }
}
