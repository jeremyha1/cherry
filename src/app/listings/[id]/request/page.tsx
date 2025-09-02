'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  location: string;
  available_date: string | null; // YYYY-MM-DD
  start_time: string | null;     // HH:MM[:SS]
  end_time: string | null;       // HH:MM[:SS]
  is_booked: boolean;
};

type Profile = { id: string; full_name: string | null };

function fmtDateLocal(dateStr?: string | null) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  // Construct a LOCAL date (no timezone shift)
  const local = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
  return local.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtTimeLocal(timeStr?: string | null) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function RequestPage() {
  const router = useRouter();
  const { id: listingId } = useParams<{ id: string }>();

  const [uid, setUid] = useState<string | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [host, setHost] = useState<Profile | null>(null);

  const [message, setMessage] = useState('');
  const [requestedDate, setRequestedDate] = useState(''); // optional user-preferred date
  const [alreadyRequested, setAlreadyRequested] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const isHostViewing = useMemo(() => uid && listing ? uid === listing.user_id : false, [uid, listing]);

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);

      // Require login
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { router.push('/login'); return; }
      const currentUserId = session.user.id;
      setUid(currentUserId);

      // 1) Fetch listing
      const { data: l, error: lErr } = await supabase
        .from('listings')
        .select('id, user_id, title, description, location, available_date, start_time, end_time, is_booked')
        .eq('id', listingId)
        .single();

      if (lErr || !l) { setErr(lErr?.message || 'Listing not found'); setLoading(false); return; }
      const listingRow = l as Listing;
      setListing(listingRow);

      // 2) Fetch host profile
      const { data: p, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', listingRow.user_id)
        .single();

      if (pErr) { setErr(pErr.message); setLoading(false); return; }
      setHost(p as Profile);

      // 3) Check if I already requested this listing (RLS limits to my rows)
      const { data: reqs, error: rErr } = await supabase
        .from('requests')
        .select('id')
        .eq('listing_id', listingId)
        .limit(1);

      if (!rErr && (reqs || []).length > 0) setAlreadyRequested(true);

      setLoading(false);
    })();
  }, [listingId, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!uid || !listing) {
      setErr('Not authenticated or listing not found.');
      return;
    }

    if (isHostViewing) {
      setErr('You cannot request your own listing.');
      return;
    }

    if (listing.is_booked) {
      setErr('This listing is already booked.');
      return;
    }

    // Insert request (pending by default)
    const { error } = await supabase.from('requests').insert([{
      listing_id: listing.id,
      guest_id: uid,
      message,
      requested_date: requestedDate || null,
      status: 'pending',
    }]);

    if (error) {
      setErr(error.message);
    } else {
      router.push('/dashboard/bookings');
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!listing) return <div className="p-6">Listing not found.</div>;

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-5">
      <button onClick={() => router.back()} className="text-sm underline text-blue-600">
        ← Back
      </button>

      {/* Listing summary */}
      <section className="border rounded p-4 space-y-2 bg-white">
        <h1 className="text-2xl font-bold">{listing.title}</h1>
        <div className="text-sm text-gray-600">
            {fmtDateLocal(listing.available_date)} • {fmtTimeLocal(listing.start_time)}–{fmtTimeLocal(listing.end_time)}
        </div>
        <div className="text-sm text-gray-700">{listing.location}</div>
        {host && (
          <div className="text-sm">
            Host:{' '}
            <Link href={`/users/${host.id}`} className="underline text-blue-600">
              {host.full_name || 'Cherry host'}
            </Link>
          </div>
        )}
        <p className="mt-2">{listing.description}</p>
      </section>

      {/* Guardrails */}
   
      {alreadyRequested && (
        <div className="p-3 border rounded bg-blue-50 text-sm">
          You’ve already requested this listing. Check{' '}
          <Link href="/dashboard/bookings" className="underline">
            My Bookings
          </Link>
          .
        </div>
      )}

      {/* Request form */}
      {!isHostViewing && !listing.is_booked && !alreadyRequested && (
        <form onSubmit={submit} className="space-y-4">

          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              className="w-full border p-2 rounded"
              placeholder="Say hello and share what you’d like to do!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          <button className="bg-green-600 text-white px-4 py-2 rounded">
            Send Request
          </button>
        </form>
      )}
    </main>
  );
}
