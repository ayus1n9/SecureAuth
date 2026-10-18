import React, { useState, useEffect } from 'react';
import { apiRequest, ApiError } from '../api/client.js';
import { BarChart3, Users, ShieldAlert, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.js';

interface StatsMetrics {
  totalUsers: number;
  roleDistribution: {
    USER: number;
    SUPPORT: number;
    ADMIN: number;
  };
  activeSessions: number;
  totalRecords: number;
  totalAuditEvents: number;
  systemStatus: string;
}

interface AdminUserItem {
  id: string;
  email: string;
  fullName: string;
  role: 'USER' | 'SUPPORT' | 'ADMIN';
  failedLoginAttempts: number;
  createdAt: string;
  _count?: { sessions: number; records: number };
}

interface AuditLogItem {
  id: string;
  eventType: string;
  actorId: string | null;
  ipAddress: string | null;
  timestamp: string;
  details: any;
}

export const AdminPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState<StatsMetrics | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'audits'>('users');

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes, auditsRes] = await Promise.all([
        apiRequest<{ metrics: StatsMetrics }>('/api/v1/admin/stats'),
        apiRequest<{ data: AdminUserItem[] }>('/api/v1/users'),
        apiRequest<{ data: AuditLogItem[] }>('/api/v1/admin/audit-logs?limit=25'),
      ]);
      setStats(statsRes.metrics);
      setUsers(usersRes.data);
      setAuditLogs(auditsRes.data);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to load administrative data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'USER' | 'SUPPORT' | 'ADMIN') => {
    setMsg(null);
    try {
      const res = await apiRequest(`/api/v1/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      setMsg({ type: 'success', text: res.message });
      loadData();
    } catch (err: any) {
      const apiErr = err as ApiError;
      setMsg({ type: 'error', text: apiErr.message || 'Failed to update user role' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-red-400" />
          Administrative Security Console
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Server-authenticated administrator operations, role governance, and security audit log streams.
        </p>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-3 border ${
            msg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats.roleDistribution.ADMIN} Admins · {stats.roleDistribution.SUPPORT} Support · {stats.roleDistribution.USER} Users
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Sessions</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.activeSessions}</div>
            <div className="text-[11px] text-slate-500 mt-1">PostgreSQL stateful sessions</div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Secured Records</span>
              <ShieldAlert className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalRecords}</div>
            <div className="text-[11px] text-slate-500 mt-1">Access-controlled objects</div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Audit Trail Records</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalAuditEvents}</div>
            <div className="text-[11px] text-slate-500 mt-1">Immutable security log events</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'users'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          User Governance & Roles
        </button>
        <button
          onClick={() => setActiveTab('audits')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'audits'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Security Audit Logs
        </button>
      </div>

      {/* User Governance Tab */}
      {activeTab === 'users' && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 border-b border-slate-800 text-xs uppercase font-semibold text-slate-400">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Active Sessions</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Loading user records...
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{u.fullName}</td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{u.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            u.role === 'ADMIN'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : u.role === 'SUPPORT'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                        {u._count?.sessions ?? 0} active
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isCurrent ? (
                          <span className="text-xs text-slate-500 italic">Self (Locked)</span>
                        ) : (
                          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5">
                            <button
                              onClick={() => handleRoleChange(u.id, 'USER')}
                              disabled={u.role === 'USER'}
                              className={`px-2 py-1 text-[11px] rounded font-medium transition-colors ${
                                u.role === 'USER' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              User
                            </button>
                            <button
                              onClick={() => handleRoleChange(u.id, 'SUPPORT')}
                              disabled={u.role === 'SUPPORT'}
                              className={`px-2 py-1 text-[11px] rounded font-medium transition-colors ${
                                u.role === 'SUPPORT' ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Support
                            </button>
                            <button
                              onClick={() => handleRoleChange(u.id, 'ADMIN')}
                              disabled={u.role === 'ADMIN'}
                              className={`px-2 py-1 text-[11px] rounded font-medium transition-colors ${
                                u.role === 'ADMIN' ? 'bg-slate-800 text-red-400' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Admin
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Security Audit Logs Tab */}
      {activeTab === 'audits' && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 border-b border-slate-800 text-xs uppercase font-semibold text-slate-400">
              <tr>
                <th className="px-6 py-4">Event Type</th>
                <th className="px-6 py-4">Actor ID</th>
                <th className="px-6 py-4">Client IP</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/50 transition-colors font-mono text-xs">
                  <td className="px-6 py-3 font-semibold text-emerald-400">{log.eventType}</td>
                  <td className="px-6 py-3 text-slate-400 truncate max-w-[120px]">{log.actorId || 'SYSTEM'}</td>
                  <td className="px-6 py-3 text-slate-400">{log.ipAddress || '—'}</td>
                  <td className="px-6 py-3 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-3 text-slate-400 truncate max-w-[200px]">
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
