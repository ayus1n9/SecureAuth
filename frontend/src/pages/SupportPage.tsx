import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.js';
import { Users, Search, ShieldCheck } from 'lucide-react';

interface SupportUserItem {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export const SupportPage: React.FC = () => {
  const [users, setUsers] = useState<SupportUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const url = search ? `/api/v1/users?search=${encodeURIComponent(search)}` : '/api/v1/users';
      const res = await apiRequest<{ data: SupportUserItem[] }>(url);
      setUsers(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load support user directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-400" />
          Support Queue & Diagnostics
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Scoped support interface providing strictly minimal non-sensitive user metadata under least-privilege principles.
        </p>
      </div>

      <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 flex-shrink-0" />
        <span>
          <strong>Data Minimization Enforced:</strong> As a Support operator, you can inspect identity existence and status. Administrative operations, password hashes, and user private records are withheld.
        </span>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Search Input */}
      <div className="relative mb-6">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Lookup user by name or email..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* User Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900 border-b border-slate-800 text-xs uppercase font-semibold text-slate-400">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Registration Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  Loading support directory...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No matching user accounts found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{u.fullName}</td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-blue-400">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
