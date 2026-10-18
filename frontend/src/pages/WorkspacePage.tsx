import React, { useState, useEffect } from 'react';
import { apiRequest, ApiError } from '../api/client.js';
import { Plus, Trash2, Edit3, Shield, Search, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface RecordItem {
  id: string;
  title: string;
  content: string;
  classification: 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  createdAt: string;
  updatedAt: string;
}

export const WorkspacePage: React.FC = () => {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modal / Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [classification, setClassification] = useState<'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'>('CONFIDENTIAL');

  const loadRecords = async () => {
    try {
      setLoading(true);
      const url = search ? `/api/v1/records?search=${encodeURIComponent(search)}` : '/api/v1/records';
      const res = await apiRequest<{ data: RecordItem[] }>(url);
      setRecords(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editingRecord) {
        await apiRequest(`/api/v1/records/${editingRecord.id}`, {
          method: 'PUT',
          body: JSON.stringify({ title, content, classification }),
        });
        setSuccess('Record successfully updated');
      } else {
        await apiRequest('/api/v1/records', {
          method: 'POST',
          body: JSON.stringify({ title, content, classification }),
        });
        setSuccess('Record successfully created');
      }
      setShowCreateModal(false);
      setEditingRecord(null);
      setTitle('');
      setContent('');
      loadRecords();
    } catch (err: any) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to save record');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this record?')) return;
    setError(null);
    try {
      await apiRequest(`/api/v1/records/${id}`, { method: 'DELETE' });
      setSuccess('Record successfully deleted');
      loadRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to delete record');
    }
  };

  const openEdit = (record: RecordItem) => {
    setEditingRecord(record);
    setTitle(record.title);
    setContent(record.content);
    setClassification(record.classification);
    setShowCreateModal(true);
  };

  const openCreate = () => {
    setEditingRecord(null);
    setTitle('');
    setContent('');
    setClassification('CONFIDENTIAL');
    setShowCreateModal(true);
  };

  const getClassificationBadge = (type: string) => {
    switch (type) {
      case 'RESTRICTED':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'CONFIDENTIAL':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Lock className="w-6 h-6 text-emerald-400" />
            Protected Workspace
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Server-enforced object ownership ensures only you can view or modify your data.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Record
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search owned records by title or content..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* Records Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading records...</div>
      ) : records.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-12 text-center">
          <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No records found</h3>
          <p className="text-sm text-slate-400 mt-1 mb-4">You have not created any records yet or no records match your search filter.</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Record
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {records.map((record) => (
            <div
              key={record.id}
              className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-6 flex flex-col justify-between transition-colors shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${getClassificationBadge(record.classification)}`}>
                    {record.classification}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {new Date(record.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-2 line-clamp-1">{record.title}</h3>
                <p className="text-sm text-slate-400 line-clamp-4 leading-relaxed whitespace-pre-wrap">{record.content}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  onClick={() => openEdit(record)}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Edit Record"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(record.id)}
                  className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                  title="Delete Record"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Create/Edit */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">
              {editingRecord ? 'Edit Record' : 'Create New Protected Record'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sensitive API Keys & Config"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Classification Level
                </label>
                <select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="INTERNAL">Internal</option>
                  <option value="CONFIDENTIAL">Confidential</option>
                  <option value="RESTRICTED">Restricted</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Content (Encrypted at Rest / Owner-Access Only)
                </label>
                <textarea
                  required
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Record payload content..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                >
                  {editingRecord ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
