'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const [uid, setUid] = useState<string | null>(null);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [age, setAge] = useState('');
  const [interests, setInterests] = useState('');
  const [role, setRole] = useState('guest'); // host | guest
  const [linkedin, setLinkedin] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) return;
      const userId = session.user.id;
      setUid(userId);

      const { data, error } = await supabase
        .from('profiles')
        .select(
          'full_name, bio, age, interests, role, linkedin_url, avatar_url'
        )
        .eq('id', userId)
        .single();

      if (error) {
        setErr(error.message);
      } else if (data) {
        setFullName(data.full_name || '');
        setBio(data.bio || '');
        setAge(data.age || '');
        setInterests(data.interests || '');
        setRole(data.role || 'guest');
        setLinkedin(data.linkedin_url || '');
        setAvatarUrl(data.avatar_url || null);
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;

    let newAvatarUrl = avatarUrl;

    // Upload avatar if a file was chosen
    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${uid}-${Date.now()}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, { upsert: true });

      if (uploadErr) {
        setErr(uploadErr.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      newAvatarUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        bio,
        age,
        interests,
        role,
        linkedin_url: linkedin,
        avatar_url: newAvatarUrl,
      })
      .eq('id', uid);

    if (error) {
      setErr(error.message);
    } else {
      setErr(null);
      setSuccess(true);
      setAvatarUrl(newAvatarUrl);
      setAvatarFile(null);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <main className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Edit Profile</h1>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Full Name</label>
          <input
            className="w-full border rounded p-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Bio</label>
          <textarea
            className="w-full border rounded p-2"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Age</label>
            <input
              type="number"
              className="w-full border rounded p-2"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Interests</label>
          <input
            className="w-full border rounded p-2"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">LinkedIn URL</label>
          <input
            className="w-full border rounded p-2"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="https://www.linkedin.com/in/username"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Profile Picture</label>
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-24 h-24 rounded-full mb-2 object-cover"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
          />
        </div>

        {err && <p className="text-red-600">{err}</p>}
        {success && <p className="text-green-600">Profile updated!</p>}

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Save Changes
        </button>
      </form>
    </main>
  );
}
