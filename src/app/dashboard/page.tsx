'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData.session;
      setSession(session);

      if (sessionError || !session) {
        router.push('/login');
        return;
      }

      const userId = session.user.id;
      setEmail(session.user.email ?? null);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profileError) {
        setError(profileError.message);
        return;
      }

      setRole(profile.role);
      setLoading(false);
    };

    loadUser();
  }, [router]);

  useEffect(() => {
    const loadUnread = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) return;
      const uid = session.user.id;

      // 1) Fetch all requests
      const { data: reqs, error: reqErr } = await supabase
        .from('requests')
        .select('id, listing_id, guest_id, created_at, status');
      if (reqErr || !reqs) return;

      if (reqs.length === 0) {
        setUnreadTotal(0);
        return;
      }

      const requestIds = reqs.map(r => r.id);

      // 2) Fetch listings to check for "past"
      const { data: listings } = await supabase
        .from('listings')
        .select('id, available_date, start_time, end_time');

      const listingsById = new Map(
        (listings || []).map(l => [l.id, l])
      );

      function endDateTime(listing: any): Date | null {
        if (!listing?.available_date) return null;
        if (listing.end_time) return new Date(`${listing.available_date}T${listing.end_time}`);
        if (listing.start_time) return new Date(`${listing.available_date}T${listing.start_time}`);
        return null;
      }

      // 3) My last message per request
      const { data: myMsgs } = await supabase
        .from('messages')
        .select('request_id, created_at, sender_id')
        .in('request_id', requestIds)
        .eq('sender_id', uid)
        .order('created_at', { ascending: false });

      const lastMine = new Map<string, string>();
      (myMsgs || []).forEach(m => {
        if (!lastMine.has(m.request_id)) lastMine.set(m.request_id, m.created_at);
      });

      // 4) All other-party messages
      const { data: otherMsgs } = await supabase
        .from('messages')
        .select('request_id, created_at, sender_id')
        .in('request_id', requestIds)
        .neq('sender_id', uid);

      let total = 0;
      const now = new Date();

      (otherMsgs || []).forEach(m => {
        const req = reqs.find(r => r.id === m.request_id);
        if (!req) return;

        // Skip declined requests
        if (req.status?.toLowerCase() === 'declined') return;

        // Skip past listings
        const listing = listingsById.get(req.listing_id);
        if (listing) {
          const end = endDateTime(listing);
          if (end && end.getTime() < now.getTime()) return;
        }

        const lastMineAt = lastMine.get(m.request_id);
        if (!lastMineAt || new Date(m.created_at) > new Date(lastMineAt)) {
          total += 1;
        }
      });

      setUnreadTotal(total);
    };

    loadUnread();
  }, []); // run on mount; could poll or use realtime later

  if (loading) {
    return <p className="text-center mt-20">Loading dashboard...</p>;
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen space-y-4 px-4">
      <h1 className="text-3xl font-bold">Welcome to Cherry 🍒</h1>
      <p className="text-lg text-gray-600">Logged in as: <span className="font-mono">{email}</span></p>
      <p className="text-md text-gray-800">
        Role: <span className="font-semibold">{role}</span>
      </p>

      {role === 'host' && (
        <div className="space-y-4 text-center">
          <button
            onClick={() => router.push('/dashboard/listings/new')}
            className="bg-green-600 text-white px-4 py-2 rounded shadow"
          >
            Create Listing
          </button>

          <button
            onClick={() => router.push('/dashboard/listings')}
            className="bg-gray-600 text-white px-4 py-2 rounded shadow"
          >
            My Listings
          </button>
        </div>
      )}

      {role === 'guest' && (
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-500 italic">
            You're signed in as a guest. You can browse listings, but not create them.
          </p>
          <button
            className="mt-2 px-4 py-2 bg-purple-600 text-white rounded"
            onClick={async () => {
              const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
              const session = sessionData.session;

              if (sessionError || !session) {
                setError("Session error. Please try again.");
                return;
              }

              const userId = session.user.id;
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ role: 'host' })
                .eq('id', userId);

              if (updateError) {
                setError(updateError.message);
              } else {
                setRole('host');
              }
            }}
          >
            Become a Host
          </button>
        </div>
      )}

      <button
        onClick={() => router.push('/dashboard/profile')}
        className="bg-gray-700 text-white px-4 py-2 rounded"
      >
        Edit Profile
      </button>

      <button
        onClick={() => router.push('/listings')}
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
      >
        Browse Available Listings
      </button>

      <div className="relative">
        <button
          onClick={() => router.push('/dashboard/bookings')}
          className="bg-indigo-600 text-white px-4 py-2 rounded"
        >
          My Bookings
        </button>
        {unreadTotal > 0 && (
          <span
            title={`${unreadTotal} new message${unreadTotal === 1 ? '' : 's'}`}
            className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-2 py-0.5"
          >
            {unreadTotal}
          </span>
        )}
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await supabase.auth.signOut();
          router.push('/login');
        }}
        className="mt-6"
      >
        <button type="submit" className="text-red-500 underline">
          Log Out
        </button>
      </form>

      {error && <p className="text-red-500">{error}</p>}
    </main>
  );
}
