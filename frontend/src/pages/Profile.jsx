import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get('/users/me');
        setProfile(data);
        setFormData({
          name: data.name,
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

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match!');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      alert('Password must be at least 6 characters long!');
      return;
    }
    try {
      await api.put('/users/me/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      alert('Password changed successfully!');
      setShowPasswordChange(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to change password');
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
                  <span className="text-slate-400">Member Since</span>
                  <span className="font-medium text-white">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <form onSubmit={handleUpdate} className="space-y-6">
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

            {/* Password Change Section */}
            <div className="border-t border-slate-800 pt-6">
              <button
                type="button"
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
                Change Password
              </button>

              {showPasswordChange && (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Current Password</label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-slate-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">New Password</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-slate-100"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-slate-100"
                      required
                      minLength={6}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-full bg-green-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    Update Password
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default Profile;
