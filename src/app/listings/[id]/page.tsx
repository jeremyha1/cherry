'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Listing = {
  id: string;
  user_id: string;            // host id
  title: string;
  description: string;
  location: string;
  available_date: string | null; // YYYY-MM-DD
  start_time: string | null;     // HH:MM[:SS]
  end_time: string | null;       // HH:MM[:SS]
  is_booked: boolean;
};

type Profile = { id: string; full_name: string | null };

type MyRequest = { id: string; status: string };

function fmtDate(d?: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtTime(t?: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}


function statusBadgeClasses(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'accepted') return 'bg-green-100 text-green-700';
  if (s === 'pending')  return 'bg-orange-100 text-orange-700';
  if (s === 'declined') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
}

export default function ListingDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [uid, setUid] = useState<string | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [hostProfile, setHostProfile] = useState<Profile | null>(null);

  const [myReq, setMyReq] = useState<MyRequest | null>(null); // your own request on this listing (if any)
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // inline request form
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');

  const isHost = useMemo(() => {
    return !!(uid && listing && uid === listing.user_id);
  }, [uid, listing]);

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
        .select('*')
        .eq('id', id)
        .single();

      if (lErr || !l) { setErr(lErr?.message || 'Listing not found'); setLoading(false); return; }
      setListing(l as Listing);

      // 2) Fetch host profile
      const { data: p, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', (l as Listing).user_id)
        .single();

      if (pErr) { setErr(pErr.message); setLoading(false); return; }
      setHostProfile(p as Profile);

      // 3) Check if current user already requested this listing
      // RLS: this only returns rows where *you* are the guest
      const { data: rData, error: rErr } = await supabase
        .from('requests')
        .select('id, status')
        .eq('listing_id', id)
        .limit(1);

      if (rErr) { setErr(rErr.message); setLoading(false); return; }
      setMyReq((rData && rData.length > 0 ? rData[0] : null) as MyRequest | null);

      setLoading(false);
    })();
  }, [id, router]);

  const canRequest =
    !!uid &&
    !!listing &&
    !isHost &&
    !listing.is_booked &&
    !myReq; // not already requested

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !listing) return;

    // 1) Create the request (no message stored on requests)
    const { data: req, error: reqErr } = await supabase
      .from('requests')
      .insert({
        listing_id: listing.id,
        guest_id: uid,
        status: 'pending',
        // requested_date: null // optional: include if you still use it
      })
      .select('id')
      .single();

    if (reqErr || !req) {
      setErr(reqErr?.message || 'Failed to create request');
      return;
    }

    // 2) Save the initial text as a chat message
    const initial = (message || '').trim();
    if (initial.length > 0) {
      const { error: msgErr } = await supabase
        .from('messages')
        .insert({
          request_id: req.id,
          sender_id: uid,
          body: initial,
        });

      if (msgErr) {
        // Non-fatal: the request is created; log the error
        console.error('Failed to save initial message:', msgErr.message);
      }
    }

    // 3) Redirect to My Bookings; host will see unread badge
    router.push('/dashboard/bookings');
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!listing) return <div className="p-6">Not found.</div>;

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{listing.title}</h1>
        <div className="text-xs text-gray-600">
                    {fmtDate(listing.available_date)} • {fmtTime(listing.start_time)}–{fmtTime(listing.end_time)}
        </div>
      </div>

      {/* Host + location */}
      <div className="text-sm text-gray-700">
        Host:{' '}
        {hostProfile ? (
          <Link href={`/users/${hostProfile.id}`} className="underline text-blue-600">
            {hostProfile.full_name || 'Cherry host'}
          </Link>
        ) : (
          'Cherry host'
        )}
        <span className="ml-2 text-gray-500">• {listing.location}</span>
      </div>

      <p>{listing.description}</p>

      {/* Badges: host sees "My listing"; guest sees their status if requested; show booked state */}
      <div className="flex flex-wrap gap-2">
        {isHost && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
            My listing
          </span>
        )}

        {listing.is_booked && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            Booked
          </span>
        )}

        {!isHost && myReq?.status && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadgeClasses(myReq.status)}`}>
            {myReq.status}
          </span>
        )}
      </div>

      {/* Request CTA / Inline Form */}
      {canRequest && (
        <div className="mt-2">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              Request to Hang Out
            </button>
          ) : (
            <form onSubmit={handleSubmitRequest} className="space-y-3">
              <label className="block text-sm font-medium">Message to host</label>
              <textarea
                className="w-full border rounded p-2"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Say hello and say a few things about yourself!"
                required
              />


              <div className="flex items-center gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
                  Send Request
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-200 rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Guidance when you can't request */}
      {!canRequest && !isHost && !listing.is_booked && myReq && (
        <div className="text-sm text-gray-600">
          You’ve already requested this listing. Check{' '}
          <Link href="/dashboard/bookings" className="underline">
            My Bookings
          </Link>{' '}
          for updates.
        </div>
      )}

      {!canRequest && listing.is_booked && (
        <div className="text-sm text-gray-600">This listing has been booked.</div>
      )}
    </main>
  );
}
