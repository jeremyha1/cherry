'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CreateListingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    city: '',
    state: '',
    available_date: '',
    start_time: '',
    end_time: '',
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError('You must be logged in.');
      return;
    }

    const { error: insertError } = await supabase.from('listings').insert([
      {
        user_id: session.user.id,
        title: form.title,
        description: form.description,
        location: form.location,
        city: form.city,
        state: form.state,
        available_date: form.available_date,
        start_time: form.start_time,
        end_time: form.end_time,
        is_booked: false,
      },
    ]);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push('/dashboard/listings');
  };

  return (
    <main className="max-w-xl mx-auto mt-10 px-4">
      <h1 className="text-2xl font-bold mb-4">Create a New Listing</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="title"
          placeholder="Title"
          value={form.title}
          onChange={handleChange}
          required
          className="w-full border rounded p-2"
        />
        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
          required
          className="w-full border rounded p-2"
        />
        <input
          name="location"
          placeholder="Specific place (e.g. Yankee Stadium)"
          value={form.location}
          onChange={handleChange}
          required
          className="w-full border rounded p-2"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            name="city"
            placeholder="City"
            value={form.city}
            onChange={handleChange}
            required
            className="w-full border rounded p-2"
          />
          <input
            name="state"
            placeholder="State (e.g. NY)"
            value={form.state}
            onChange={handleChange}
            required
            className="w-full border rounded p-2"
          />
        </div>
        <input
          type="date"
          name="available_date"
          value={form.available_date}
          onChange={handleChange}
          required
          className="w-full border rounded p-2"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="time"
            name="start_time"
            value={form.start_time}
            onChange={handleChange}
            required
            className="w-full border rounded p-2"
          />
          <input
            type="time"
            name="end_time"
            value={form.end_time}
            onChange={handleChange}
            required
            className="w-full border rounded p-2"
          />
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Create Listing
        </button>
      </form>
    </main>
  );
}
