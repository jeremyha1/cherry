'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type RequestRow = {
  id: string;
  listing_id: string;
  guest_id: string;
  message: string | null; // legacy field (will be migrated into messages)
  requested_date: string | null;
  status: 'pending' | 'accepted' | 'declined' | string;
  created_at: string;
};

type Listing = {
  id: string;
  title: string;
  user_id: string; // host id
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
  sender_id: string;
  body: string;
  created_at: string;
};

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

export default function BookingDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [uid, setUid] = useState<string | null>(null);
  const [reqRow, setReqRow] = useState<RequestRow | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const hostId = listing?.user_id ?? null;
  const isGuest = useMemo(() => (uid && reqRow ? uid === reqRow.guest_id : false), [uid, reqRow]);
  const isHost  = useMemo(() => (uid && hostId ? uid === hostId : false), [uid, hostId]);

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);

      // Auth
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { router.push('/login'); return; }
      setUid(session.user.id);

      // Request
      const { data: r, error: rErr } = await supabase
        .from('requests')
        .select('*')
        .eq('id', id)
        .single();

      if (rErr) { setErr(rErr.message); setLoading(false); return; }
      setReqRow(r as RequestRow);

      // Listing
      const { data: l, error: lErr } = await supabase
        .from('listings')
        .select('id, title, user_id, available_date, start_time, end_time')
        .eq('id', r.listing_id)
        .single();

      if (lErr) { setErr(lErr.message); setLoading(false); return; }
      setListing(l as Listing);

      // Profiles (host + guest)
      const profIds = Array.from(new Set([(l as Listing).user_id, (r as RequestRow).guest_id]));
      const { data: p, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', profIds);

      if (pErr) { setErr(pErr.message); setLoading(false); return; }
      setProfiles((p || []) as Profile[]);

      // Messages
      const { data: m, error: mErr } = await supabase
        .from('messages')
        .select('id, sender_id, body, created_at')
        .eq('request_id', id)
        .order('created_at', { ascending: true });

      if (mErr) { setErr(mErr.message); setLoading(false); return; }

      let msgs = (m || []) as Message[];

      // --- LEGACY BACKFILL ---
      // If the original request text lives in requests.message AND the current user is the GUEST,
      // copy it into messages (once) so it becomes a regular chat message.
      if ((r as RequestRow).message && isGuest && msgs.length === 0) {
        const initial = (r as RequestRow).message!;
        // Insert as the guest's message (created_at can mirror request.created_at)
        const { data: ins, error: insErr } = await supabase
          .from('messages')
          .insert({
            request_id: id,
            sender_id: session.user.id,
            body: initial,
            created_at: (r as RequestRow).created_at, // works unless you have a DB constraint disallowing it
          })
          .select('id, sender_id, body, created_at')
          .single();

        if (!insErr && ins) {
          msgs = [...msgs, ins as Message];
          // Optional: clear legacy field to avoid double backfill later
          await supabase
            .from('requests')
            .update({ message: null })
            .eq('id', id);
        }
      }

      setMessages(msgs);
      setLoading(false);
    })();
  }, [id, router, isGuest]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.id, p.full_name || 'Cherry user');
    return map;
  }, [profiles]);

  const updateStatus = async (status: 'accepted' | 'declined') => {
    if (!reqRow || !listing) return;
    const { error: reqErr } = await supabase.from('requests').update({ status }).eq('id', reqRow.id);
    if (reqErr) { setErr(reqErr.message); return; }

    // If you set listings.is_booked on accept elsewhere, keep it here too:
    if (status === 'accepted') {
      const { error: listErr } = await supabase
        .from('listings')
        .update({ /* is_booked: true */ })
        .eq('id', listing.id);
      if (listErr) { setErr(listErr.message); return; }
    }

    setReqRow({ ...reqRow, status });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !body.trim()) return;

    const { data, error } = await supabase
      .from('messages')
      .insert([{ request_id: id, sender_id: uid, body }])
      .select('id, sender_id, body, created_at')
      .single();

    if (error) { setErr(error.message); return; }
    setMessages(prev => [...prev, data as Message]);
    setBody('');
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!reqRow || !listing) return <div className="p-6">Not found.</div>;

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <button onClick={() => router.back()} className="text-sm underline text-blue-600">← Back</button>

      <h1 className="text-2xl font-bold">Booking</h1>

      <div className="p-4 border rounded space-y-1">
        <div><span className="font-semibold">Listing:</span> {listing.title}</div>
        <div>
          <span className="font-semibold">When:</span>{' '}
          {fmtDate(listing.available_date)} • {fmtTime(listing.start_time)}–{fmtTime(listing.end_time)}
        </div>
        <div><span className="font-semibold">Status:</span> {reqRow.status}</div>
        {/* Removed legacy "Guest note" block */}
        <div><span className="font-semibold">Host:</span> {nameById.get(listing.user_id)}</div>
        <div><span className="font-semibold">Guest:</span> {nameById.get(reqRow.guest_id)}</div>
      </div>

      {/* Host-only controls */}
      {isHost && reqRow.status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={() => updateStatus('accepted')}
            className="px-3 py-1 bg-green-600 text-white rounded"
          >
            Accept
          </button>
          <button
            onClick={() => updateStatus('declined')}
            className="px-3 py-1 bg-red-600 text-white rounded"
          >
            Decline
          </button>
        </div>
      )}

      {/* Messages */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Messages</h2>
        <ul className="space-y-2">
          {messages.map((m) => {
            const mine = m.sender_id === uid;
            return (
              <li key={m.id} className={`p-3 border rounded ${mine ? 'bg-gray-50' : 'bg-white'}`}>
                <div className="text-xs text-gray-500">
                  {nameById.get(m.sender_id)} • {new Date(m.created_at).toLocaleString()}
                </div>
                <div>{m.body}</div>
              </li>
            );
          })}
        </ul>

        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            className="flex-1 border rounded p-2"
            placeholder="Write a message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button className="px-3 py-2 bg-blue-600 text-white rounded">Send</button>
        </form>
      </section>
    </main>
  );
}
