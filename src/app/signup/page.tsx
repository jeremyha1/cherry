'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Step 1: Sign up the user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // Step 2: Wait for session to become available
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (sessionError || !session) {
      setError('Session not available after signup.');
      return;
    }

    const userId = session.user.id;

    // Step 3: Insert profile for the user (RLS policy requires: auth.uid() = id)
    const { error: profileError } = await supabase.from('profiles').insert([
      {
        id: userId,
        full_name: '',     // Optional: add a full name field to the form later
        role: 'guest',     // Default role
      },
    ]);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    // Step 4: Redirect to dashboard
    router.push('/dashboard');
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <form
        onSubmit={handleSignUp}
        className="space-y-4 w-full max-w-md p-6 bg-white rounded shadow"
      >
        <h1 className="text-2xl font-bold text-center">Sign Up</h1>
        {error && <p className="text-red-500">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded"
        >
          Sign Up
        </button>
      </form>
    </main>
  );
}


