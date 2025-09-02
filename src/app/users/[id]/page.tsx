'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  full_name: string | null;
  bio: string | null;
  age: string | null;
  interests: string | null;
  role: string | null;
  linkedin_url: string | null;
  avatar_url: string | null;
};

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, bio, age, interests, role, linkedin_url, avatar_url')
        .eq('id', id)
        .single();

      if (error) {
        setErr(error.message);
      } else {
        setProfile(data as Profile);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-6">Loading profile…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!profile) return <div className="p-6">Profile not found.</div>;

  return (
    <main className="max-w-lg mx-auto p-6 space-y-6">
      {/* Avatar */}
      <div className="flex flex-col items-center">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name || 'Cherry user'}
            className="w-32 h-32 rounded-full object-cover"
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
            No photo
          </div>
        )}
        <h1 className="text-2xl font-bold mt-4">
          {profile.full_name || 'Cherry user'}
        </h1>
        {profile.role && (
          <span className="text-sm text-gray-500 mt-1 capitalize">
            {profile.role}
          </span>
        )}
      </div>

      {/* Details */}
      <div className="space-y-3">
        {profile.bio && (
          <p>
            <span className="font-semibold">Bio:</span> {profile.bio}
          </p>
        )}
        {profile.age && (
          <p>
            <span className="font-semibold">Age:</span> {profile.age}
          </p>
        )}
        {profile.interests && (
          <p>
            <span className="font-semibold">Interests:</span> {profile.interests}
          </p>
        )}
        {profile.linkedin_url && (
          <p>
            <span className="font-semibold">LinkedIn:</span>{' '}
            <a
              href={profile.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              View profile
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
