import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/errorUtils';

// Reusable style constants matching Dashboard.tsx patterns (2026 design)
const cardStyles = "p-6 rounded-xl shadow-[var(--shadow-md)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] transition-colors duration-300";
const inputStyles = "w-full px-3 py-2 rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
const selectStyles = "px-3 py-2 rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
const labelStyles = "block text-sm mb-2 text-[var(--color-text-secondary)]";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
}

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(getErrorMessage(err, 'Failed to load users. Please try again later.'));
    } finally {
      setLoading(false);
    }
  };

  // Filter users based on search and role
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeSince = (dateString: string | null) => {
    if (!dateString) return 'Never logged in';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  // Modal handlers
  const openCreateModal = () => {
    setFormData({ username: '', email: '', password: '', role: 'user' });
    setFormError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const openResetPasswordModal = (user: User) => {
    setSelectedUser(user);
    setFormData({ ...formData, password: '' });
    setFormError(null);
    setShowResetPasswordModal(true);
  };

  // CRUD operations
  const handleCreateUser = async () => {
    setFormError(null);
    if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim()) {
      setFormError('All fields are required');
      return;
    }

    try {
      await api.post('/users', formData);
      setSuccess('User created successfully');
      setShowCreateModal(false);
      fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to create user'));
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setFormError(null);

    if (!formData.username.trim() || !formData.email.trim()) {
      setFormError('Username and email are required');
      return;
    }

    try {
      const updateData: any = {
        username: formData.username,
        email: formData.email,
        role: formData.role
      };
      if (formData.password.trim()) {
        updateData.password = formData.password;
      }

      await api.put(`/users/${selectedUser.id}`, updateData);
      setSuccess('User updated successfully');
      setShowEditModal(false);
      fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to update user'));
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await api.delete(`/users/${selectedUser.id}`);
      setSuccess('User deleted successfully');
      setShowDeleteModal(false);
      fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete user'));
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    setFormError(null);

    if (!formData.password.trim()) {
      setFormError('Password is required');
      return;
    }

    try {
      await api.post(`/users/${selectedUser.id}/reset-password`, {
        password: formData.password
      });
      setSuccess('Password reset successfully');
      setShowResetPasswordModal(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to reset password'));
    }
  };

  const getRoleBadgeStyles = (role: string) => {
    if (role === 'admin') {
      return 'bg-red-500/10 text-red-400 border border-red-500/30';
    }
    return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
  };

  // Stats
  const adminCount = users.filter(u => u.role === 'admin').length;
  const userCount = users.filter(u => u.role === 'user').length;
  const recentLogins = users.filter(u => {
    if (!u.lastLoginAt) return false;
    const lastLogin = new Date(u.lastLoginAt);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return lastLogin > dayAgo;
  }).length;

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Settings
        </Link>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent">
                User Management
              </span>
            </h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              Manage user accounts, roles, and permissions
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-md font-medium hover:bg-[var(--color-primary-dark)] transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add User
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className={cardStyles}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{users.length}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Total Users</p>
            </div>
          </div>
        </div>

        <div className={cardStyles}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{adminCount}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Administrators</p>
            </div>
          </div>
        </div>

        <div className={cardStyles}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{recentLogins}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Active Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className={`${cardStyles} mb-6`}>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputStyles} pl-10`}
              />
            </div>
          </div>
          <div className="flex gap-2">
            {['all', 'admin', 'user'].map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-4 py-2 rounded-md font-medium transition ${
                  roleFilter === role
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]'
                }`}
              >
                {role === 'all' ? 'All Roles' : role.charAt(0).toUpperCase() + role.slice(1) + 's'}
              </button>
            ))}
            <button
              onClick={fetchUsers}
              className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-md hover:bg-[var(--color-bg-primary)] transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {success}
        </div>
      )}

      {/* Main Content */}
      <div className={cardStyles}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-primary)] mb-4"></div>
            <p className="text-[var(--color-text-secondary)]">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20">
            <svg className="mx-auto h-16 w-16 text-[var(--color-text-tertiary)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-xl font-medium text-[var(--color-text-secondary)]">No users found</h3>
            <p className="mt-2 text-[var(--color-text-tertiary)]">
              {searchQuery || roleFilter !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Get started by adding your first user'}
            </p>
            {!searchQuery && roleFilter === 'all' && (
              <button
                onClick={openCreateModal}
                className="mt-4 px-6 py-2 bg-[var(--color-primary)] text-white rounded-md hover:bg-[var(--color-primary-dark)] transition inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Your First User
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-default)]">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="py-4 first:pt-0 last:pb-0 hover:bg-[var(--color-bg-primary)] -mx-6 px-6 transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg transition-transform hover:scale-105 ${
                      user.role === 'admin'
                        ? 'bg-gradient-to-br from-red-500 to-pink-600 shadow-red-500/25'
                        : 'bg-gradient-to-br from-blue-500 to-cyan-600 shadow-blue-500/25'
                    }`}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {user.username}
                        </h3>
                        {String(currentUser?.id) === String(user.id) && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/30">
                            You
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getRoleBadgeStyles(user.role)}`}>
                          {user.role === 'admin' && (
                            <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          )}
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </div>
                      <p className="text-[var(--color-text-secondary)] text-sm flex items-center gap-1 mt-0.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* Meta & Actions */}
                  <div className="flex items-center gap-6">
                    {/* Last Login */}
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">Last Login</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">{getTimeSince(user.lastLoginAt)}</p>
                    </div>

                    {/* Created */}
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">Created</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">{formatDate(user.createdAt)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 text-[var(--color-text-tertiary)] hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all"
                        title="Edit user"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      <button
                        onClick={() => openResetPasswordModal(user)}
                        className="p-2 text-[var(--color-text-tertiary)] hover:text-yellow-400 hover:bg-yellow-500/10 rounded-xl transition-all"
                        title="Reset password"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </button>

                      {String(currentUser?.id) !== String(user.id) && (
                        <button
                          onClick={() => openDeleteModal(user)}
                          className="p-2 text-[var(--color-text-tertiary)] hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                          title="Delete user"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className={`${cardStyles} max-w-md w-full`} onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add New User
            </h2>

            <p className="text-[var(--color-text-secondary)] text-sm mb-4">
              Create a new user account with login credentials.
            </p>

            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className={labelStyles}>Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className={inputStyles}
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label className={labelStyles}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={inputStyles}
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className={labelStyles}>Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className={inputStyles}
                  placeholder="Enter password"
                />
              </div>

              <div>
                <label className={labelStyles}>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className={`${selectStyles} w-full`}
                >
                  <option value="user">User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border-default)]">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="px-5 py-2 bg-[var(--color-primary)] text-white rounded-md font-medium hover:bg-[var(--color-primary-dark)] transition"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className={`${cardStyles} max-w-md w-full`} onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit User
            </h2>

            <p className="text-[var(--color-text-secondary)] text-sm mb-4">
              Update user information. Leave password empty to keep current.
            </p>

            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className={labelStyles}>Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className={inputStyles}
                />
              </div>

              <div>
                <label className={labelStyles}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={inputStyles}
                />
              </div>

              <div>
                <label className={labelStyles}>New Password (optional)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className={inputStyles}
                  placeholder="Leave empty to keep current"
                />
              </div>

              <div>
                <label className={labelStyles}>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  disabled={String(currentUser?.id) === String(selectedUser.id)}
                  className={`${selectStyles} w-full disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="user">User</option>
                  <option value="admin">Administrator</option>
                </select>
                {String(currentUser?.id) === String(selectedUser.id) && (
                  <p className="text-yellow-400 text-xs mt-1">You cannot change your own role</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border-default)]">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                className="px-5 py-2 bg-[var(--color-primary)] text-white rounded-md font-medium hover:bg-[var(--color-primary-dark)] transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteModal(false)}>
          <div className={`${cardStyles} max-w-md w-full`} onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete User
            </h2>

            <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-red-500/25">
                {selectedUser.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-[var(--color-text-primary)] font-semibold">{selectedUser.username}</p>
                <p className="text-[var(--color-text-secondary)] text-sm">{selectedUser.email}</p>
              </div>
            </div>

            <p className="text-[var(--color-text-secondary)]">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border-default)]">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-5 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowResetPasswordModal(false)}>
          <div className={`${cardStyles} max-w-md w-full`} onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Reset Password
            </h2>

            <p className="text-[var(--color-text-secondary)] text-sm mb-4">
              Set a new password for <span className="text-[var(--color-text-primary)] font-medium">{selectedUser.username}</span>.
            </p>

            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {formError}
              </div>
            )}

            <div>
              <label className={labelStyles}>New Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className={inputStyles}
                placeholder="Enter new password"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border-default)]">
              <button
                onClick={() => setShowResetPasswordModal(false)}
                className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="px-5 py-2 bg-yellow-600 text-white rounded-md font-medium hover:bg-yellow-700 transition"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
