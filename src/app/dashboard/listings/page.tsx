'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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

export default function MyListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<any[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchListings = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (sessionError || !session) { router.push('/login'); return; }

      const userId = session.user.id;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profileError) { setError(profileError.message); return; }
      setRole(profile.role);

      if (profile.role !== 'host') { setError('You must be a host to view this page.'); return; }

      const { data, error: listingError } = await supabase
        .from('listings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (listingError) setError(listingError.message);
      else setListings(data || []);

      setLoading(false);
    };

    fetchListings();
  }, [router]);

  if (loading) return <p className="p-4">Loading your listings...</p>;
  if (error) return <p className="p-4 text-red-500">{error}</p>;

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">My Listings</h1>

      {listings.length === 0 ? (
        <p className="text-gray-500">You haven’t created any listings yet.</p>
      ) : (
        <ul className="space-y-4">
          {listings.map((listing) => (
            <li key={listing.id} className="border rounded p-4 shadow-sm space-y-2">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold">{listing.title}</h2>
                <span className="text-xs text-gray-500">
                  {fmtDateLocal(listing.available_date)} • {fmtTimeLocal(listing.start_time)}–{fmtTimeLocal(listing.end_time)}
                </span>
              </div>

              <p>{listing.description}</p>
              <p className="text-sm text-gray-500">{listing.location}</p>

              <div className="flex gap-4 mt-2">
                <button
                  onClick={() => router.push(`/dashboard/listings/${listing.id}/edit`)}
                  className="px-3 py-1 bg-blue-600 text-white rounded"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to delete this listing?')) {
                      const { error } = await supabase.from('listings').delete().eq('id', listing.id);
                      if (error) alert(`Failed to delete: ${error.message}`);
                      else setListings((prev: any[]) => prev.filter((l) => l.id !== listing.id));
                    }
                  }}
                  className="px-3 py-1 bg-red-500 text-white rounded"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}





