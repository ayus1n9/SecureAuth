import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';

export const AccessDeniedPage: React.FC = () => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-slate-950 border border-slate-800 rounded-xl p-8 shadow-2xl">
        <div className="inline-flex p-3 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mb-4">
          <ShieldX className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">403 — Access Denied</h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Your current account role lacks the required permissions to view this resource. Server-side RBAC actively prevents unauthorized access.
        </p>
        <Link
          to="/workspace"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Workspace
        </Link>
      </div>
    </div>
  );
};
