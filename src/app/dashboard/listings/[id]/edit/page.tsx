'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type FormState = {
  title: string;
  description: string;
  location: string;
  available_date: string; // YYYY-MM-DD
  start_time: string;     // HH:MM
  end_time: string;       // HH:MM
};

export default function EditListingPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    location: '',
    available_date: '',
    start_time: '',
    end_time: '',
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      setMsg(null);
      setLoading(true);

      // Ensure auth
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      // Fetch the listing (include the new fields)
      const { data, error } = await supabase
        .from('listings')
        .select('title, description, location, available_date, start_time, end_time')
        .eq('id', id)
        .single();

      if (error || !data) {
        setErr(error?.message || 'Listing not found');
        setLoading(false);
        return;
      }

      setForm({
        title: data.title ?? '',
        description: data.description ?? '',
        location: data.location ?? '',
        available_date: data.available_date ?? '',
        start_time: (data.start_time ?? '').slice(0, 5), // HH:MM
        end_time: (data.end_time ?? '').slice(0, 5),     // HH:MM
      });

      setLoading(false);
    })();
  }, [id, router]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!form.available_date || !form.start_time || !form.end_time) {
      setErr('Please provide a date, start time, and end time.');
      return;
    }
    if (form.end_time <= form.start_time) {
      setErr('End time must be after start time.');
      return;
    }

    const { error } = await supabase
      .from('listings')
      .update({
        title: form.title,
        description: form.description,
        location: form.location,
        available_date: form.available_date, // YYYY-MM-DD
        start_time: form.start_time,         // HH:MM
        end_time: form.end_time,             // HH:MM
      })
      .eq('id', id);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg('Listing updated!');
    router.push('/dashboard/listings');
  };

  if (loading) return <p className="p-6">Loading listing…</p>;
  if (err) return <p className="p-6 text-red-600">Error: {err}</p>;

  return (
    <main className="max-w-xl mx-auto mt-10 px-4">
      <h1 className="text-2xl font-bold mb-4">Edit Listing</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            name="title"
            value={form.title}
            onChange={onChange}
            required
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={onChange}
            required
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Location</label>
          <input
            name="location"
            value={form.location}
            onChange={onChange}
            required
            className="w-full border rounded p-2"
          />
        </div>

        {/* Single Date */}
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            name="available_date"
            value={form.available_date}
            onChange={onChange}
            required
            className="w-full border rounded p-2"
          />
        </div>

        {/* Time window */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="time"
              name="start_time"
              value={form.start_time}
              onChange={onChange}
              required
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <input
              type="time"
              name="end_time"
              value={form.end_time}
              onChange={onChange}
              required
              className="w-full border rounded p-2"
            />
          </div>
        </div>

        {msg && <p className="text-green-600">{msg}</p>}
        {err && <p className="text-red-600">{err}</p>}

        <div className="flex gap-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            Save Changes
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/listings')}
            className="px-4 py-2 border rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
