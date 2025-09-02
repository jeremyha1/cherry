'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type RequestRow = {
  id: string;
  listing_id: string;
  message: string | null;
  requested_date: string | null;
  status: string;
  created_at: string;
};

export default function MyRequestsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setErr(null);
      setLoading(true);

      // Robust session retrieval (avoid false "not logged in")
      const getActiveSession = async () => {
        const { data } = await supabase.auth.getSession();
        if (data.session) return data.session;
        return new Promise<unknown>((resolve) => {
          const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
            if (sess) {
              sub.subscription.unsubscribe();
              resolve(sess);
            }
          });
          setTimeout(() => {
            sub.subscription.unsubscribe();
            resolve(null);
          }, 1200);
        });
      };

      const session = (await getActiveSession()) as { user?: { id: string } } | null;
      if (!session?.user?.id) {
        router.push('/login');
        return;
      }
      const guestId = session.user.id;

      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false });

      if (error) setErr(error.message);
      else setRows((data || []) as RequestRow[]);
      setLoading(false);
    };

    load();
  }, [router]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Requests</h1>
      {rows.length === 0 ? (
        <p>No requests yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="border rounded p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Status: {r.status}</div>
                {/* FIXED: correct link to the listing detail page */}
                <Link
                  href={`/listings/${r.listing_id}`}
                  className="text-sm text-blue-600 underline"
                >
                  View listing
                </Link>
              </div>
              {r.requested_date && (
                <div className="text-sm text-gray-600">Requested: {r.requested_date}</div>
              )}
              {r.message && <p className="mt-2">{r.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
