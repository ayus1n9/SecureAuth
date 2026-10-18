import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { Shield, Lock, FileText, Users, BarChart3, LogOut, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'SUPPORT':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  return (
    <nav className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-white font-bold text-lg hover:text-emerald-400 transition-colors">
              <Shield className="w-6 h-6 text-emerald-400" />
              <span>SecureAuth</span>
            </Link>
            <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              AppSec Lab
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-1">
                <Link
                  to="/workspace"
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  Workspace
                </Link>

                {(user.role === 'SUPPORT' || user.role === 'ADMIN') && (
                  <Link
                    to="/support"
                    className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                  >
                    <Users className="w-4 h-4 text-blue-400" />
                    Support Queue
                  </Link>
                )}

                {user.role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                  >
                    <BarChart3 className="w-4 h-4 text-red-400" />
                    Admin Console
                  </Link>
                )}

                <Link
                  to="/profile"
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  Profile
                </Link>
              </div>

              <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold text-white leading-tight">{user.fullName}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>

                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-2 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-md hover:bg-slate-800 transition-colors flex items-center gap-1"
              >
                <Lock className="w-4 h-4 text-emerald-400" />
                Login
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md transition-colors shadow-sm"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
