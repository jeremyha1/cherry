'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type RequestRow = {
  id: string;
  listing_id: string;
  guest_id: string;
  message: string | null;
  requested_date: string | null;
  status: 'pending' | 'accepted' | 'declined' | string;
  created_at: string;
};

type Listing = {
  id: string;
  title: string;
  user_id: string; // host id
  location: string | null;
  city: string | null;
  state: string | null;
  available_date: string | null;
  start_time: string | null;
  end_time: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
};

type Message = {
  id: string;
  request_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function statusBadgeClasses(status: string) {
  const s = status.toLowerCase();
  if (s === 'accepted') return 'bg-green-100 text-green-700';
  if (s === 'pending') return 'bg-orange-100 text-orange-700';
  if (s === 'declined') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
}

function startDateTime(listing: Listing): Date | null {
  if (!listing.available_date || !listing.start_time) return null;
  return new Date(`${listing.available_date}T${listing.start_time}`);
}
function endDateTime(listing: Listing): Date | null {
  if (!listing.available_date || !listing.end_time) return null;
  return new Date(`${listing.available_date}T${listing.end_time}`);
}
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

const FILTERS = ['all', 'upcoming', 'pending', 'past'] as const;
type Filter = typeof FILTERS[number];

export default function MyBookingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>('pending');
  const [unreadByRequest, setUnreadByRequest] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);

      // Require login
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.push('/login');
        return;
      }
      const uid = session.user.id;
      setUserId(uid);

      // 1) Fetch requests
      const { data: reqData, error: reqErr } = await supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (reqErr) {
        setErr(reqErr.message);
        setLoading(false);
        return;
      }
      const reqs = (reqData || []) as RequestRow[];
      setRows(reqs);

      if (reqs.length === 0) {
        setListings([]);
        setProfiles([]);
        setMessages([]);
        setLoading(false);
        return;
      }

      // 2) Fetch listings
      const listingIds = Array.from(new Set(reqs.map(r => r.listing_id)));
      const { data: listingData, error: listingErr } = await supabase
        .from('listings')
        .select('id, title, user_id, location, city, state, available_date, start_time, end_time')
        .in('id', listingIds);
      if (listingErr) {
        setErr(listingErr.message);
        setLoading(false);
        return;
      }
      setListings((listingData || []) as Listing[]);

      // 3) Fetch profiles
      const hostIds = (listingData || []).map(l => l.user_id);
      const guestIds = reqs.map(r => r.guest_id);
      const allProfileIds = Array.from(new Set([...hostIds, ...guestIds]));
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allProfileIds);
      if (profErr) {
        setErr(profErr.message);
        setLoading(false);
        return;
      }
      setProfiles((profData || []) as Profile[]);

      // 4) Fetch messages
      const { data: msgData, error: msgErr } = await supabase
        .from('messages')
        .select('id, request_id, sender_id, body, created_at')
        .in('request_id', reqs.map(r => r.id));
      if (msgErr) {
        setErr(msgErr.message);
        setLoading(false);
        return;
      }
      setMessages((msgData || []) as Message[]);

      setLoading(false);
    })();
  }, [router]);

  const listingsById = useMemo(() => {
    const m = new Map<string, Listing>();
    for (const l of listings) m.set(l.id, l);
    return m;
  }, [listings]);

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name || 'Cherry user');
    return m;
  }, [profiles]);

  useEffect(() => {
    if (!userId) return;

    const lastMine = new Map<string, string>();
    for (const m of messages) {
      if (m.sender_id === userId) {
        const prev = lastMine.get(m.request_id);
        if (!prev || new Date(m.created_at) > new Date(prev)) {
          lastMine.set(m.request_id, m.created_at);
        }
      }
    }

    const now = new Date();
    const counts = new Map<string, number>();

    for (const m of messages) {
      if (m.sender_id === userId) continue;
      const req = rows.find(r => r.id === m.request_id);
      const listing = req && listingsById.get(req.listing_id);

      if (req?.status?.toLowerCase() === 'declined') continue;
      if (listing) {
        const end = endDateTime(listing);
        if (end && end.getTime() < now.getTime()) continue;
      }

      const lastMineAt = lastMine.get(m.request_id);
      const isUnread = !lastMineAt || new Date(m.created_at) > new Date(lastMineAt);
      if (isUnread) counts.set(m.request_id, (counts.get(m.request_id) || 0) + 1);
    }

    setUnreadByRequest(counts);
  }, [messages, userId, rows, listingsById]);

  const filtered = useMemo(() => {
    const now = new Date();
    return rows.filter(r => {
      const listing = listingsById.get(r.listing_id);
      if (!listing) return false;

      const end = endDateTime(listing);
      if (filter === 'all') return true;
      if (filter === 'pending') return r.status.toLowerCase() === 'pending';
      if (filter === 'upcoming') {
        return r.status.toLowerCase() === 'accepted' && end && end.getTime() >= now.getTime();
      }
      if (filter === 'past') {
        return (
          (r.status.toLowerCase() === 'accepted' || r.status.toLowerCase() === 'declined') &&
          end &&
          end.getTime() < now.getTime()
        );
      }
      return true;
    });
  }, [rows, listingsById, filter]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Bookings</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                'px-3 py-1 rounded border text-sm',
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300',
              ].join(' ')}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-600">No bookings match this filter.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map(r => {
            const listing = listingsById.get(r.listing_id);
            const hostId = listing?.user_id;
            const isGuest = userId === r.guest_id;
            const counterpartyId = isGuest ? hostId : r.guest_id;
            const counterpartyName =
              (counterpartyId && nameByUserId.get(counterpartyId)) || 'Cherry user';
            const unreadCount = unreadByRequest.get(r.id) || 0;

            const locParts = [];
            if (listing?.location) locParts.push(listing.location);
            if (listing?.city) locParts.push(listing.city);
            if (listing?.state) locParts.push(listing.state);
            const locStr = locParts.join(' • ');

            return (
              <li key={r.id} className="border rounded p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">
                    {isGuest ? 'You requested' : 'Request for your listing'}
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-sm font-medium ${statusBadgeClasses(r.status)}`}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="text-sm text-gray-700">
                  Listing:{' '}
                  {listing ? (
                    <>
                      <span className="font-medium">{listing.title}</span>{' '}
                      <Link
                        href={`/dashboard/bookings/${r.id}`}
                        className="underline text-blue-600"
                      >
                        View booking
                      </Link>
                      {unreadCount > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs w-5 h-5">
                          {unreadCount}
                        </span>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </div>

                {/* NEW: show date + location */}
                {listing && (
                  <div className="text-sm text-gray-600">
                    {fmtDate(listing.available_date)} • {fmtTime(listing.start_time)}–{fmtTime(listing.end_time)}{' '}
                    {locStr && <span>• {locStr}</span>}
                  </div>
                )}

                <div className="text-sm text-gray-700">
                  {isGuest ? 'Host' : 'Guest'}:{' '}
                  {counterpartyId ? (
                    <Link
                      href={`/users/${counterpartyId}`}
                      className="underline text-blue-600"
                    >
                      {counterpartyName}
                    </Link>
                  ) : (
                    counterpartyName
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
