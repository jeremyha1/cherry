'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  location: string | null;
  city: string | null;
  state: string | null;
  available_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_booked: boolean;
};

type Profile = { id: string; full_name: string | null };
type MyReq = { listing_id: string; status: string };

function statusBadgeClasses(status: string) {
  const s = status.toLowerCase();
  if (s === 'accepted') return 'bg-green-100 text-green-700';
  if (s === 'pending') return 'bg-orange-100 text-orange-700';
  if (s === 'declined') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
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

export default function ListingsPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myReqByListingId, setMyReqByListingId] = useState<Map<string, string>>(new Map());
  const [locationFilter, setLocationFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { setErr('Please log in to view listings.'); setLoading(false); return; }
      setUid(session.user.id);

      let query = supabase
        .from('listings')
        .select('*')
        .eq('is_booked', false)
        .order('available_date', { ascending: true });

      if (locationFilter.trim()) {
        query = query.or(
          `location.ilike.%${locationFilter.trim()}%,city.ilike.%${locationFilter.trim()}%,state.ilike.%${locationFilter.trim()}%`
        );
      }

      const { data: listingData, error: listingErr } = await query;
      if (listingErr) { setErr(listingErr.message); setLoading(false); return; }

      const safeListings = (listingData || []) as Listing[];
      setListings(safeListings);

      // fetch profiles
      const userIds = Array.from(new Set(safeListings.map(l => l.user_id)));
      if (userIds.length) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        setProfiles((profData || []) as Profile[]);
      }

      // fetch my requests for these listings
      const listingIds = safeListings.map(l => l.id);
      if (listingIds.length) {
        const { data: reqData } = await supabase
          .from('requests')
          .select('listing_id, status')
          .in('listing_id', listingIds);
        const m = new Map<string, string>();
        (reqData || []).forEach((r: MyReq) => m.set(r.listing_id, r.status));
        setMyReqByListingId(m);
      }

      setLoading(false);
    })();
  }, [locationFilter]);

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name || 'Cherry host');
    return m;
  }, [profiles]);

  if (loading) return <div className="p-6">Loading listings…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Available Listings</h1>

      {/* Location filter input */}
      <input
        type="text"
        placeholder="Filter by city, state, or location"
        value={locationFilter}
        onChange={(e) => setLocationFilter(e.target.value)}
        className="w-full border rounded p-2 mb-6"
      />

      {listings.length === 0 ? (
        <p>No listings found.</p>
      ) : (
        <ul className="space-y-4">
          {listings.map((listing) => {
            const hostName = nameByUserId.get(listing.user_id) ?? 'Cherry host';
            const isHost = uid === listing.user_id;
            const myStatus = myReqByListingId.get(listing.id);

            // Build nice location string
            const locParts = [];
            if (listing.location) locParts.push(listing.location);
            if (listing.city) locParts.push(listing.city);
            if (listing.state) locParts.push(listing.state);
            const locStr = locParts.join(' • ');

            return (
              <li key={listing.id} className="p-4 border rounded-md shadow-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    {listing.title}
                    {isHost ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                        My listing
                      </span>
                    ) : (
                      myStatus && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadgeClasses(myStatus)}`}>
                          {myStatus}
                        </span>
                      )
                    )}
                  </h2>
                  <span className="text-xs text-gray-500">
                    {fmtDate(listing.available_date)} • {fmtTime(listing.start_time)}–{fmtTime(listing.end_time)}
                  </span>
                </div>

                <p className="mt-1">{listing.description}</p>

                {/* NEW: structured location line */}
                <div className="mt-2 text-sm text-gray-600">{locStr}</div>

                <div className="mt-3 text-sm">
                  Host:{' '}
                  <Link href={`/users/${listing.user_id}`} className="underline text-blue-600">
                    {hostName}
                  </Link>
                </div>

                <div className="mt-3 flex gap-3">
                  <Link href={`/listings/${listing.id}`} className="inline-block px-3 py-1 bg-gray-200 rounded">
                    View listing
                  </Link>

                  {!isHost && !myStatus && (
                    <Link
                      href={`/listings/${listing.id}`}
                      className="inline-block px-3 py-1 bg-green-600 text-white rounded"
                    >
                      Request to Hang Out
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
