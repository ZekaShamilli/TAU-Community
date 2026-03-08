import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import apiClient from '../../lib/api';
import { coinService } from '../../services/coinService';

const UserManagement: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [adjustCoinsDialogOpen, setAdjustCoinsDialogOpen] = useState(false);
  const [userToAdjust, setUserToAdjust] = useState<any | null>(null);
  const [coinAmount, setCoinAmount] = useState('');
  const [coinReason, setCoinReason] = useState('');
  const [showTransactions, setShowTransactions] = useState(false);

  const queryClient = useQueryClient();

  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get('/users');
      return response.data;
    },
  });

  // Fetch coin balances for all users
  const users = usersData?.data || [];
  const userIds = React.useMemo(() => users.map((u: any) => u.id), [users]);

  const { data: coinBalances } = useQuery({
    queryKey: ['all-user-coins', userIds],
    queryFn: async () => {
      const balances: Record<string, any> = {};
      await Promise.all(
        userIds.map(async (userId: string) => {
          try {
            const coins = await coinService.getUserCoins(userId);
            balances[userId] = coins;
          } catch (error) {
            balances[userId] = { balance: 0, totalEarned: 0, totalSpent: 0 };
          }
        })
      );
      return balances;
    },
    enabled: userIds.length > 0,
  });

  const { data: transactions } = useQuery({
    queryKey: ['coin-transactions'],
    queryFn: () => coinService.getTransactions(),
    enabled: showTransactions,
  });

  const adjustCoinsMutation = useMutation({
    mutationFn: (data: { userId: string; amount: number; reason: string }) =>
      coinService.adjustCoins(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-user-coins'] });
      queryClient.invalidateQueries({ queryKey: ['coin-transactions'] });
      toast.success('Coins adjusted successfully!');
      setAdjustCoinsDialogOpen(false);
      setUserToAdjust(null);
      setCoinAmount('');
      setCoinReason('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to adjust coins');
    },
  });

  const handleAdjustCoins = () => {
    if (!userToAdjust) return;
    
    const amount = parseInt(coinAmount);
    if (isNaN(amount) || amount === 0) {
      toast.error('Please enter a valid non-zero amount');
      return;
    }

    adjustCoinsMutation.mutate({
      userId: userToAdjust.id,
      amount,
      reason: coinReason || 'Admin adjustment',
    });
  };

  const { data: userDetailsData, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['user-details', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser?.id) return null;
      const response = await apiClient.get(`/users/${selectedUser.id}`);
      return response.data.data || response.data;
    },
    enabled: !!selectedUser?.id && viewDialogOpen,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.delete(`/users/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully!');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete user');
    },
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'CLUB_PRESIDENT': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'STUDENT': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default: return 'bg-gray-500/20 text-text-tertiary border-gray-500/50';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'Super Admin';
      case 'CLUB_PRESIDENT': return 'Club President';
      case 'STUDENT': return 'Student';
      default: return role;
    }
  };

  if (error) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border-red-500/50">
        <p className="text-red-400">Failed to load users. Please try again later.</p>
      </motion.div>
    );
  }

  const filteredUsers = users.filter((user: any) => {
    if (roleFilter && user.role !== roleFilter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      return user.firstName?.toLowerCase().includes(searchLower) || user.lastName?.toLowerCase().includes(searchLower) || user.email?.toLowerCase().includes(searchLower);
    }
    return true;
  }).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <motion.h2 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-bold neon-text">User Management</motion.h2>
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowTransactions(!showTransactions)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-medium hover:shadow-lg hover:shadow-yellow-500/50 transition-all flex items-center gap-2"
        >
          <span>{'\u{1FA99}'}</span>
          {showTransactions ? 'Hide' : 'View'} Coin Transactions
        </motion.button>
      </div>

      {showTransactions && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-text-primary">Coin Transaction History</h3>
            <p className="text-text-tertiary text-sm">{transactions?.length || 0} transactions</p>
          </div>
          {transactions && transactions.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactions.map((tx: any) => {
                const isBonus = tx.transactionType === 'BONUS';
                const isPenalty = tx.transactionType === 'PENALTY';
                const isAward = tx.transactionType === 'AWARD';
                
                return (
                  <div key={tx.id} className="glass-card p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            isBonus ? 'bg-green-500/20 text-green-400' :
                            isPenalty ? 'bg-red-500/20 text-red-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {tx.transactionType}
                          </span>
                          <p className="text-text-primary font-medium">
                            {tx.fromUser ? `${tx.fromUser.firstName} ${tx.fromUser.lastName}` : 'System'} 
                            {' -> '}
                            {tx.toUser ? `${tx.toUser.firstName} ${tx.toUser.lastName}` : 'System'}
                          </p>
                        </div>
                        <p className="text-sm text-text-tertiary">{tx.reason}</p>
                        {tx.clubName && (
                          <p className="text-xs text-text-tertiary mt-1">
                            <span className="text-neon-purple">Club:</span> {tx.clubName}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-lg ${
                          isPenalty ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                          {isPenalty ? '-' : '+'}{tx.amount} {'\u{1FA99}'}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <span className="text-6xl mb-4 block">{'\u{1F4CA}'}</span>
              <p className="text-text-tertiary">No transactions yet</p>
            </div>
          )}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Search</label>
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search users..." className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder-gray-500 focus:outline-none focus:border-neon-blue transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Filter by Role</label>
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary focus:outline-none focus:border-neon-blue transition-colors">
              <option value="">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="CLUB_PRESIDENT">Club President</option>
              <option value="STUDENT">Student</option>
            </select>
          </div>
          <div className="flex items-end"><p className="text-text-tertiary">{users.length} users found</p></div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center p-8"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-blue"></div></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Role</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Coins</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Joined</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredUsers.map((user: any, index: number) => {
                      const userCoins = coinBalances?.[user.id] || { balance: 0 };
                      return (
                        <motion.tr key={user.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: index * 0.05 }} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4"><p className="font-medium text-text-primary">{user.firstName} {user.lastName}</p></td>
                          <td className="px-6 py-4 text-text-secondary">{user.email}</td>
                          <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${getRoleColor(user.role)}`}>{getRoleLabel(user.role)}</span></td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border-yellow-500/50 flex items-center gap-1 w-fit">
                              <span>{'\u{1FA99}'}</span>
                              <span>{userCoins.balance}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${user.isActive ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-gray-500/20 text-text-tertiary border-gray-500/50'}`}>{user.isActive ? 'Active' : 'Inactive'}</span></td>
                          <td className="px-6 py-4 text-text-secondary">{new Date(user.createdAt).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setUserToAdjust(user); setAdjustCoinsDialogOpen(true); }} className="p-2 rounded-lg hover:bg-yellow-500/20 text-yellow-400 transition-colors" title="Adjust Coins">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setSelectedUser(user); setViewDialogOpen(true); }} className="p-2 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true); }} className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
              <p className="text-text-tertiary text-sm">Showing {page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, users.length)} of {users.length} users</p>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors">Previous</motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setPage(page + 1)} disabled={(page + 1) * rowsPerPage >= users.length} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors">Next</motion.button>
              </div>
            </div>
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {viewDialogOpen && selectedUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewDialogOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="glass-card p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold neon-text mb-6">User Details</h3>
              {isLoadingDetails ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-blue"></div></div>
              ) : (
                <div className="space-y-6">
                  <div><h4 className="text-xl font-bold text-text-primary">{selectedUser.firstName} {selectedUser.lastName}</h4><p className="text-text-tertiary">{selectedUser.email}</p></div>
                  <div className="grid grid-cols-2 gap-6">
                    <div><p className="text-sm text-text-tertiary mb-2">Role</p><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleColor(selectedUser.role)}`}>{getRoleLabel(selectedUser.role)}</span></div>
                    <div><p className="text-sm text-text-tertiary mb-2">Status</p><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${selectedUser.isActive ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-gray-500/20 text-text-tertiary border-gray-500/50'}`}>{selectedUser.isActive ? 'Active' : 'Inactive'}</span></div>
                  </div>
                  <div><p className="text-sm text-text-tertiary mb-2">Joined</p><p className="text-text-primary">{new Date(selectedUser.createdAt).toLocaleDateString()}</p></div>
                  <div><h5 className="text-lg font-semibold text-text-primary mb-4 border-t border-white/10 pt-4">Club Memberships</h5>
                    {userDetailsData?.clubs && userDetailsData.clubs.length > 0 ? (
                      <div className="space-y-3">{userDetailsData.clubs.map((club: any) => (<div key={club.id} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4"><p className="font-medium text-text-primary">{club.name}</p><p className="text-sm text-text-tertiary">Role: {club.memberRole || 'Member'} {'\u2022'} Joined: {new Date(club.joinedAt).toLocaleDateString()}</p></div>))}</div>
                    ) : (<p className="text-text-tertiary">Not a member of any clubs</p>)}
                  </div>
                  {userDetailsData?.applications && userDetailsData.applications.length > 0 && (
                    <div><h5 className="text-lg font-semibold text-text-primary mb-4 border-t border-white/10 pt-4">Club Applications</h5>
                      <div className="space-y-3">{userDetailsData.applications.map((app: any) => (<div key={app.id} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4"><p className="font-medium text-text-primary">{app.clubName}</p><div className="flex items-center gap-2 mt-2"><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${app.status === 'APPROVED' ? 'bg-green-500/20 text-green-400 border-green-500/50' : app.status === 'REJECTED' ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'}`}>{app.status}</span><span className="text-sm text-text-tertiary">Applied: {new Date(app.createdAt).toLocaleDateString()}</span></div></div>))}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-8"><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setViewDialogOpen(false)} className="w-full neon-button">Close</motion.button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteDialogOpen && userToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteDialogOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="glass-card p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold text-red-400 mb-4">Confirm Delete</h3>
              <p className="text-text-secondary mb-2">Are you sure you want to delete user <strong className="text-text-primary">{userToDelete.firstName} {userToDelete.lastName}</strong>?</p>
              <p className="text-text-tertiary text-sm mb-6">This action cannot be undone.</p>
              <div className="flex gap-4">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setDeleteDialogOpen(false)} className="flex-1 px-6 py-3 rounded-xl border-2 border-white/20 text-text-primary font-semibold hover:bg-white/5 transition-colors">Cancel</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)} disabled={deleteUserMutation.isPending} className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-text-primary font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adjustCoinsDialogOpen && userToAdjust && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setAdjustCoinsDialogOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="glass-card p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4">{'\u{1FA99}'} Adjust Coins</h3>
              <div className="mb-6">
                <p className="text-text-primary font-medium">{userToAdjust.firstName} {userToAdjust.lastName}</p>
                <p className="text-text-tertiary text-sm">{userToAdjust.email}</p>
                <p className="text-yellow-400 mt-2">Current Balance: {coinBalances?.[userToAdjust.id]?.balance || 0} {'\u{1FA99}'}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-2">Amount (use negative to remove)</label>
                <input type="number" value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} placeholder="e.g., 10 or -5" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors" />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-secondary mb-2">Reason</label>
                <textarea value={coinReason} onChange={(e) => setCoinReason(e.target.value)} placeholder="e.g., Admin adjustment" rows={3} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors resize-none" />
              </div>
              <div className="flex gap-4">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setAdjustCoinsDialogOpen(false)} className="flex-1 px-6 py-3 rounded-xl border-2 border-white/20 text-text-primary font-semibold hover:bg-white/5 transition-colors">Cancel</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleAdjustCoins} disabled={adjustCoinsMutation.isPending} className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold hover:shadow-lg hover:shadow-yellow-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">{adjustCoinsMutation.isPending ? 'Adjusting...' : 'Adjust Coins'}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;

