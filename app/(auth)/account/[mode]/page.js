'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from '../account.module.css';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

const copy = {
  login: { title: 'Welcome back', intro: 'Today is a new day. Sign in to manage your connected workspaces.', submit: 'Sign in' },
  signup: { title: 'Create your account', intro: 'Start with your work email. We will send a verification link before your first sign-in.', submit: 'Create account' },
  forgot: { title: 'Reset your password', intro: 'Enter your email and we will send a secure reset link if an account exists.', submit: 'Send reset link' },
  reset: { title: 'Choose a new password', intro: 'Use a strong password with at least 12 characters.', submit: 'Reset password' },
};

async function request(path, payload) {
  const response = await fetch(`${API_BASE_URL}/api/auth/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Please try again.');
  return data;
}

function VisualPanel() {
  return <aside className={styles.visualPanel} aria-hidden="true" />;
}

function AccountShell({ children }) {
  return <main className={styles.main}><section className={styles.shell}><div className={styles.formPanel}>{children}</div><VisualPanel /></section></main>;
}

export default function AccountPage() {
  const { mode } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const config = copy[mode];
  const token = searchParams.get('token');

  useEffect(() => {
    if (mode !== 'verify' || !token) return;
    request('verify-email', { token })
      .then(() => setMessage('Your email is verified. You can sign in now.'))
      .catch((err) => setError(err.message));
  }, [mode, token]);

  useEffect(() => {
    if (mode && mode !== 'verify' && !config) router.replace('/account/login');
  }, [config, mode, router]);

  if (mode === 'verify') {
    return <AccountShell><Link className={styles.brand} href="/">Task<span>Pilot</span></Link><h1>Verify your email</h1>{!token && <p className={styles.error}>This verification link is incomplete.</p>}{message && <p className={styles.success}>{message}</p>}{error && <p className={styles.error}>{error}</p>}<p className={styles.links}><Link href="/account/login">Go to sign in</Link></p></AccountShell>;
  }
  if (!config) return null;

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if ((mode === 'signup' || mode === 'reset') && form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        await request('signup', form);
        setMessage('Account created. Check your email and open the verification link.');
      }
      if (mode === 'login') {
        await request('login', form);
        router.push('/dashboard');
      }
      if (mode === 'forgot') {
        await request('forgot-password', form);
        setMessage('If that email has an account, a reset link is on its way.');
      }
      if (mode === 'reset') {
        if (!token) throw new Error('This reset link is incomplete.');
        await request('reset-password', { token, password: form.password });
        setMessage('Password changed. You can sign in now.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return <AccountShell>
    <Link className={styles.brand} href="/">Task<span>Pilot</span></Link>
    <h1>{config.title}</h1>
    <p className={styles.intro}>{config.intro}</p>
    <form className={styles.form} onSubmit={submit}>
      {mode === 'signup' && <label className={styles.field}><span className={styles.fieldLabel}>Your name</span><input required autoComplete="name" placeholder="Your full name" value={form.name} onChange={update('name')} /></label>}
      {mode !== 'reset' && <label className={styles.field}><span className={styles.fieldLabel}>Email address</span><input required type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={update('email')} /></label>}
      {mode !== 'forgot' && <label className={styles.field}><span className={styles.fieldTop}><span className={styles.fieldLabel}>Password</span>{mode === 'login' && <Link className={styles.forgot} href="/account/forgot">Forgot password?</Link>}</span><input required type="password" minLength="12" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Enter your password" value={form.password} onChange={update('password')} /></label>}
      {(mode === 'signup' || mode === 'reset') && <label className={styles.field}><span className={styles.fieldLabel}>Confirm password</span><input required type="password" minLength="12" autoComplete="new-password" placeholder="Confirm your password" value={form.confirmPassword} onChange={update('confirmPassword')} /></label>}
      <button className={styles.submit} disabled={loading}>{loading ? 'Please wait...' : config.submit}</button>
    </form>
    {error && <p className={styles.error}>{error}</p>}
    {message && <p className={styles.success}>{message}</p>}
    <p className={styles.links}>{mode === 'login' ? <>New here? <Link href="/account/signup">Create an account</Link></> : <Link href="/account/login">Back to sign in</Link>}</p>
  </AccountShell>;
}
