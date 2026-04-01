import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api';

interface AuditEntry {
  id: string;
  userId: string;
  user?: { firstName: string; lastName: string; email: string; role: string };
  action: string;
  resource: string;
  resourceId: string;
  changes?: any;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  success: boolean;
  errorMessage?: string;
}

const AuditLogViewer: React.FC = () => {
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');

  const { data: auditData, isLoading, error } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const response = await apiClient.get('/audit-logs');
      return response.data;
    },
  });

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-green-100 text-green-700 border-green-300';
    if (action.includes('DELETE')) return 'bg-red-100 text-red-700 border-red-300';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return 'bg-blue-100 text-blue-700 border-blue-300';
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-red-100 text-red-700 border-red-300';
      case 'CLUB_PRESIDENT': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'STUDENT': return 'bg-blue-100 text-blue-700 border-blue-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border-red-500/50">
        <p className="text-red-400">Failed to load audit logs. Please try again.</p>
      </motion.div>
    );
  }

  const auditEntries = auditData?.data || [];
  
  const filteredEntries = auditEntries.filter((entry: AuditEntry) => {
    if (roleFilter && entry.user?.role !== roleFilter) return false;
    if (resourceFilter && entry.resource !== resourceFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <motion.h2 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-bold neon-text">
          Audit Logs
        </motion.h2>
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setFilterOpen(!filterOpen)}
          className="px-4 py-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] hover:border-[var(--accent)] text-text-primary transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </motion.button>
      </div>

      {filterOpen && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">User Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary focus:outline-none focus:border-[var(--accent)] transition-colors [&>option]:bg-[var(--bg-elevated)] [&>option]:text-text-primary"
              >
                <option value="">All Roles</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="CLUB_PRESIDENT">Club President</option>
                <option value="STUDENT">Student</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Resource</label>
              <select
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary focus:outline-none focus:border-[var(--accent)] transition-colors [&>option]:bg-[var(--bg-elevated)] [&>option]:text-text-primary"
              >
                <option value="">All Resources</option>
                <option value="CLUB">Club</option>
                <option value="ACTIVITY">Activity</option>
                <option value="APPLICATION">Application</option>
                <option value="USER">User</option>
                <option value="AUTH">Authentication</option>
                <option value="COINS">Coins</option>
              </select>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="w-[140px] px-6 py-4 text-left text-sm font-semibold text-text-secondary">Timestamp</th>
                <th className="w-[200px] px-6 py-4 text-left text-sm font-semibold text-text-secondary">User</th>
                <th className="w-[120px] px-6 py-4 text-left text-sm font-semibold text-text-secondary">Role</th>
                <th className="w-[120px] px-6 py-4 text-left text-sm font-semibold text-text-secondary">Action</th>
                <th className="w-[200px] px-6 py-4 text-left text-sm font-semibold text-text-secondary">Resource</th>
                <th className="w-[100px] px-6 py-4 text-left text-sm font-semibold text-text-secondary">Status</th>
                <th className="w-[140px] px-6 py-4 text-left text-sm font-semibold text-text-secondary">IP Address</th>
                <th className="w-[80px] px-6 py-4 text-right text-sm font-semibold text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredEntries.map((entry: AuditEntry, index: number) => (
                  <motion.tr
                    key={entry.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    <td className="px-6 py-4 text-text-secondary text-sm whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {entry.user ? (
                        <div className="overflow-hidden">
                          <p className="font-medium text-text-primary truncate">
                            {entry.user.firstName} {entry.user.lastName}
                          </p>
                          <p className="text-sm text-text-tertiary truncate">{entry.user.email}</p>
                        </div>
                      ) : (
                        <p className="text-text-tertiary">Unknown User</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${getRoleColor(entry.user?.role || '')}`}>
                        {entry.user?.role?.replace('_', ' ') || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${getActionColor(entry.action)}`}>
                        {entry.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-text-primary truncate">{entry.resource}</p>
                      <p className="text-xs text-text-tertiary truncate">ID: {entry.resourceId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${entry.success ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'}`}>
                        {entry.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary font-mono text-sm whitespace-nowrap">
                      {entry.ipAddress}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          setSelectedEntry(entry);
                          setDetailDialogOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-[var(--accent-muted)] text-[var(--accent)] transition-colors"
                        title="View Details"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>

      <AnimatePresence>
        {detailDialogOpen && selectedEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setDetailDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold neon-text mb-6">Audit Log Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Timestamp</p>
                    <p className="text-text-primary">{new Date(selectedEntry.timestamp).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary mb-1">User</p>
                    <p className="text-text-primary">
                      {selectedEntry.user
                        ? `${selectedEntry.user.firstName} ${selectedEntry.user.lastName} (${selectedEntry.user.email})`
                        : 'Unknown User'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Role</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleColor(selectedEntry.user?.role || '')}`}>
                      {selectedEntry.user?.role?.replace('_', ' ') || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Action</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getActionColor(selectedEntry.action)}`}>
                      {selectedEntry.action.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Resource</p>
                    <p className="text-text-primary">{selectedEntry.resource} (ID: {selectedEntry.resourceId})</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Status</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${selectedEntry.success ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}>
                      {selectedEntry.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary mb-1">IP Address</p>
                    <p className="text-text-primary font-mono">{selectedEntry.ipAddress}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-text-secondary mb-1">User Agent</p>
                  <p className="text-text-primary font-mono text-xs bg-[var(--bg-subtle)] p-3 rounded-lg break-all">
                    {selectedEntry.userAgent}
                  </p>
                </div>
                {selectedEntry.changes && (
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Changes</p>
                    <pre className="text-text-primary font-mono text-xs bg-[var(--bg-subtle)] p-3 rounded-lg overflow-auto">
                      {JSON.stringify(selectedEntry.changes, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedEntry.errorMessage && (
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Error Message</p>
                    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                      <p className="text-red-400">{selectedEntry.errorMessage}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-8">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDetailDialogOpen(false)}
                  className="w-full neon-button"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuditLogViewer;

