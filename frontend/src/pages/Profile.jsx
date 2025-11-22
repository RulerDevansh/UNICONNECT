import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    preferences: {
      categories: [],
      tags: [],
    },
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get('/users/me');
        setProfile(data);
        setFormData({
          name: data.name,
          preferences: data.preferences || { categories: [], tags: [] },
        });
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put('/users/me', formData);
      setProfile(data);
      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update profile');
    }
  };

  if (loading) {
    return <p className="p-8 text-center text-slate-400">Loading profile...</p>;
  }

  if (!profile) {
    return <p className="p-8 text-center text-slate-400">Profile not found</p>;
  }

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-slate-100">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl shadow-black/40">
        {/* Profile Header */}
        <div className="flex items-center gap-6">
          {/* Avatar with First Letter */}
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-5xl font-bold text-white shadow-lg shadow-brand-primary/30">
            {getInitials(profile.name)}
          </div>

          <div className="flex-1">
            <h1 className="text-4xl font-bold text-white">{profile.name}</h1>
            <p className="mt-2 text-lg text-slate-400">{profile.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">
                {profile.collegeDomain}
              </span>
              <span className="rounded-full bg-brand-primary/20 px-3 py-1 text-sm font-semibold text-brand-primary">
                {profile.role}
              </span>
              {profile.verified && (
                <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm font-semibold text-green-300">
                  Verified
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="rounded-full border border-slate-600 px-6 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
          >
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {/* Profile Information */}
        {!isEditing ? (
          <div className="mt-8 space-y-6">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Account Details</h3>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <span className="text-slate-400">Name</span>
                  <span className="font-medium text-white">{profile.name}</span>
                </div>
                <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <span className="text-slate-400">Email</span>
                  <span className="font-medium text-white">{profile.email}</span>
                </div>
                <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <span className="text-slate-400">College Domain</span>
                  <span className="font-medium text-white">{profile.collegeDomain}</span>
                </div>
                <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <span className="text-slate-400">Role</span>
                  <span className="font-medium capitalize text-white">{profile.role}</span>
                </div>
                <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <span className="text-slate-400">Member Since</span>
                  <span className="font-medium text-white">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {profile.preferences && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Preferences</h3>
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  {profile.preferences.categories?.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-2 text-sm text-slate-400">Favorite Categories</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.preferences.categories.map((cat) => (
                          <span
                            key={cat}
                            className="rounded-full bg-brand-primary/20 px-3 py-1 text-sm text-brand-primary"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.preferences.tags?.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm text-slate-400">Favorite Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.preferences.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(!profile.preferences.categories?.length && !profile.preferences.tags?.length) && (
                    <p className="text-sm text-slate-500">No preferences set</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="mt-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-slate-100"
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 rounded-full bg-brand-primary px-6 py-2 text-sm font-semibold text-white shadow shadow-brand-primary/40 transition hover:bg-brand-secondary"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 rounded-full border border-slate-600 px-6 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
};

export default Profile;
