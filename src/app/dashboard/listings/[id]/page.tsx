'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ListingDetailPage() {
  const { id } = useParams(); // listing id
  const router = useRouter();
  const [listing, setListing] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasRequested, setHasRequested] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const uid = session.user.id;
      setUserId(uid);

      // Fetch listing
      const { data: listingData, error: listingErr } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();

      if (listingErr) {
        console.error(listingErr);
        setLoading(false);
        return;
      }

      setListing(listingData);

      // Check if this user has already requested it
      const { data: reqs } = await supabase
        .from('requests')
        .select('id')
        .eq('listing_id', id)
        .eq('guest_id', uid);

      if (reqs && reqs.length > 0) {
        setHasRequested(true);
      }

      setLoading(false);
    })();
  }, [id, router]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!listing) return <div className="p-6">Listing not found</div>;

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{listing.title}</h1>
        {hasRequested && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            Requested
          </span>
        )}
      </div>

      <p>{listing.description}</p>

      <p className="text-sm text-gray-600">
        Available from {listing.available_from} to {listing.available_to}
      </p>

      {/* Show request button only if not already requested */}
      {!hasRequested && userId !== listing.user_id && (
        <button
          onClick={async () => {
            await supabase.from('requests').insert([
              { listing_id: listing.id, guest_id: userId, status: 'pending' },
            ]);
            setHasRequested(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Request to hang out
        </button>
      )}
    </main>
  );
}
