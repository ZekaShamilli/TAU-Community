import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/api';
import { coinService } from '../../services/coinService';

const UserManagement: React.FC = () => {
  const { t } = useTranslation();
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
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [showEditNewPw, setShowEditNewPw] = useState(false);

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

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string; phone: string }) => {
      const response = await apiClient.put(`/users/${data.id}`, { phone: data.phone });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('İstifadəçi məlumatları yeniləndi');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Xəta baş verdi');
    },
  });

  const adminChangePasswordMutation = useMutation({
    mutationFn: async (data: { id: string; newPassword: string }) => {
      const response = await apiClient.post(`/users/${data.id}/change-password`, { newPassword: data.newPassword });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Şifrə dəyişdirildi');
      setEditNewPassword('');
      setEditConfirmPassword('');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Şifrə dəyişdirilə bilmədi');
    },
  });

  const handleOpenEditUser = (user: any) => {
    setUserToEdit(user);
    setEditPhone(user.phone || '');
    setEditNewPassword('');
    setEditConfirmPassword('');
    setEditUserDialogOpen(true);
  };

  const handleSaveEditUser = async () => {
    if (!userToEdit) return;
    let hasError = false;
    if (editPhone !== (userToEdit.phone || '')) {
      try {
        await updateUserMutation.mutateAsync({ id: userToEdit.id, phone: editPhone });
      } catch { hasError = true; }
    }
    if (editNewPassword) {
      if (editNewPassword !== editConfirmPassword) {
        toast.error('Şifrələr uyğun gəlmir');
        return;
      }
      if (editNewPassword.length < 8) {
        toast.error('Şifrə ən azı 8 simvol olmalıdır');
        return;
      }
      try {
        await adminChangePasswordMutation.mutateAsync({ id: userToEdit.id, newPassword: editNewPassword });
      } catch { hasError = true; }
    }
    if (!hasError) {
      setEditUserDialogOpen(false);
      setUserToEdit(null);
    }
  };

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
      case 'SUPER_ADMIN': return 'bg-red-50 text-red-700 border-red-200';
      case 'CLUB_PRESIDENT': return 'bg-amber-50 text-amber-700 border-amber-200';
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
        <motion.h2 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-bold neon-text">{t('admin.userManagement')}</motion.h2>
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowTransactions(!showTransactions)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-medium hover:shadow-lg hover:shadow-yellow-500/50 transition-all flex items-center gap-2"
        >
          <span>{'\u{1FA99}'}</span>
          {showTransactions ? t('admin.hideCoinTransactions') : t('admin.viewCoinTransactions')}
        </motion.button>
      </div>

      {showTransactions && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-text-primary">{t('admin.coinTransactionHistory')}</h3>
            <p className="text-text-tertiary text-sm">{transactions?.length || 0} {t('admin.transactions')}</p>
          </div>
          {transactions && transactions.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactions.map((tx: any) => {
                const isBonus = tx.transactionType === 'BONUS';
                const isPenalty = tx.transactionType === 'PENALTY';
                const isAward = tx.transactionType === 'AWARD';
                
                return (
                  <div key={tx.id} className="glass-card p-4 hover:bg-[var(--bg-subtle)] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            isBonus ? 'bg-green-50 text-green-700' :
                            isPenalty ? 'bg-red-50 text-red-700' :
                            'bg-blue-50 text-blue-700'
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
                            <span className="text-[var(--text-secondary)]">Club:</span> {tx.clubName}
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
              <p className="text-text-tertiary">{t('admin.noTransactions')}</p>
            </div>
          )}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">{t('admin.search')}</label>
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder={t('admin.searchUsers')} className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">{t('admin.filterByRole')}</label>
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }} className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary focus:outline-none focus:border-[var(--accent)] transition-colors">
              <option value="">{t('admin.allRoles')}</option>
              <option value="SUPER_ADMIN">{t('admin.superAdmin')}</option>
              <option value="CLUB_PRESIDENT">{t('admin.clubPresident')}</option>
              <option value="STUDENT">{t('admin.student')}</option>
            </select>
          </div>
          <div className="flex items-end"><p className="text-text-tertiary">{users.length} {t('admin.usersFound')}</p></div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center p-8"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.name')}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.email')}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.role')}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.coins')}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.status')}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.joined')}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredUsers.map((user: any, index: number) => {
                      const userCoins = coinBalances?.[user.id] || { balance: 0 };
                      return (
                        <motion.tr key={user.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: index * 0.05 }} className="border-b border-[var(--border)] hover:bg-[var(--bg-subtle)] transition-colors">
                          <td className="px-6 py-4"><p className="font-medium text-text-primary">{user.firstName} {user.lastName}</p></td>
                          <td className="px-6 py-4 text-text-secondary">{user.email}</td>
                          <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${getRoleColor(user.role)}`}>{getRoleLabel(user.role)}</span></td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border-yellow-500/50 flex items-center gap-1 w-fit">
                              <span>{'\u{1FA99}'}</span>
                              <span>{userCoins.balance}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${user.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-500/20 text-text-tertiary border-gray-500/50'}`}>{user.isActive ? t('admin.active') : t('admin.inactive')}</span></td>
                          <td className="px-6 py-4 text-text-secondary">{new Date(user.createdAt).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setUserToAdjust(user); setAdjustCoinsDialogOpen(true); }} className="p-2 rounded-lg hover:bg-yellow-500/20 text-yellow-400 transition-colors" title="Adjust Coins">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setSelectedUser(user); setViewDialogOpen(true); }} className="p-2 rounded-lg hover:bg-[var(--accent-muted)] text-[var(--accent)] transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleOpenEditUser(user)} className="p-2 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors" title="İstifadəçini redaktə et">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
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
            <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
              <p className="text-text-tertiary text-sm">{t('admin.showing')} {page * rowsPerPage + 1} – {Math.min((page + 1) * rowsPerPage, users.length)} {t('admin.of')} {users.length}</p>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-4 py-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] text-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-panel)] transition-colors">Previous</motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setPage(page + 1)} disabled={(page + 1) * rowsPerPage >= users.length} className="px-4 py-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] text-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-panel)] transition-colors">Next</motion.button>
              </div>
            </div>
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {viewDialogOpen && selectedUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewDialogOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="glass-card p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold neon-text mb-6">{t('admin.userDetails')}</h3>
              {isLoadingDetails ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div></div>
              ) : (
                <div className="space-y-6">
                  <div><h4 className="text-xl font-bold text-text-primary">{selectedUser.firstName} {selectedUser.lastName}</h4><p className="text-text-tertiary">{selectedUser.email}</p></div>

                  <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Əlaqə məlumatları</p>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-text-tertiary w-28 shrink-0">E-poçt</span>
                        <span className="text-sm text-text-primary font-medium">{selectedUser.email}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-text-tertiary w-28 shrink-0">Telefon</span>
                        <span className="text-sm text-text-primary font-medium">
                          {(userDetailsData?.user?.phone || selectedUser.phone) ? (userDetailsData?.user?.phone || selectedUser.phone) : <span className="text-text-tertiary italic">Daxil edilməyib</span>}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div><p className="text-sm text-text-tertiary mb-2">Rol</p><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleColor(selectedUser.role)}`}>{getRoleLabel(selectedUser.role)}</span></div>
                    <div><p className="text-sm text-text-tertiary mb-2">Status</p><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${selectedUser.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-500/20 text-text-tertiary border-gray-500/50'}`}>{selectedUser.isActive ? t('admin.active') : t('admin.inactive')}</span></div>
                  </div>
                  <div><p className="text-sm text-text-tertiary mb-2">Qeydiyyat tarixi</p><p className="text-text-primary">{new Date(selectedUser.createdAt).toLocaleDateString()}</p></div>
                  <div><h5 className="text-lg font-semibold text-text-primary mb-4 border-t border-[var(--border)] pt-4">{t('admin.clubMemberships')}</h5>
                    {userDetailsData?.clubs && userDetailsData.clubs.length > 0 ? (
                      <div className="space-y-3">{userDetailsData.clubs.map((club: any) => (<div key={club.id} className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-4"><p className="font-medium text-text-primary">{club.name}</p><p className="text-sm text-text-tertiary">Role: {club.memberRole || 'Member'} {'\u2022'} Joined: {new Date(club.joinedAt).toLocaleDateString()}</p></div>))}</div>
                    ) : (<p className="text-text-tertiary">{t('admin.noClubMemberships')}</p>)}
                  </div>
                  {userDetailsData?.applications && userDetailsData.applications.length > 0 && (
                    <div><h5 className="text-lg font-semibold text-text-primary mb-4 border-t border-[var(--border)] pt-4">{t('admin.clubApplications')}</h5>
                      <div className="space-y-3">{userDetailsData.applications.map((app: any) => (<div key={app.id} className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-4"><p className="font-medium text-text-primary">{app.clubName}</p><div className="flex items-center gap-2 mt-2"><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${app.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' : app.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{app.status}</span><span className="text-sm text-text-tertiary">Applied: {new Date(app.createdAt).toLocaleDateString()}</span></div></div>))}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-8"><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setViewDialogOpen(false)} className="w-full neon-button">{t('admin.close')}</motion.button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteDialogOpen && userToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteDialogOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="glass-card p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold text-red-400 mb-4">{t('admin.confirmDelete')}</h3>
              <p className="text-text-secondary mb-2">Are you sure you want to delete user <strong className="text-text-primary">{userToDelete.firstName} {userToDelete.lastName}</strong>?</p>
              <p className="text-text-tertiary text-sm mb-6">{t('admin.cannotUndo')}</p>
              <div className="flex gap-4">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setDeleteDialogOpen(false)} className="flex-1 px-6 py-3 rounded-xl border border-[var(--border-strong)] text-text-primary font-semibold hover:bg-[var(--bg-subtle)] transition-colors">{t('admin.cancel')}</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)} disabled={deleteUserMutation.isPending} className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-text-primary font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{deleteUserMutation.isPending ? t('admin.deleting') : t('admin.delete')}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adjustCoinsDialogOpen && userToAdjust && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setAdjustCoinsDialogOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="glass-card p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4">{'\u{1FA99}'} {t('admin.adjustCoins')}</h3>
              <div className="mb-6">
                <p className="text-text-primary font-medium">{userToAdjust.firstName} {userToAdjust.lastName}</p>
                <p className="text-text-tertiary text-sm">{userToAdjust.email}</p>
                <p className="text-yellow-400 mt-2">{t('admin.currentBalance')}: {coinBalances?.[userToAdjust.id]?.balance || 0} {'\u{1FA99}'}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('admin.amount')}</label>
                <input type="number" value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} placeholder={t('admin.amountPlaceholder')} className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('admin.reason')}</label>
                <textarea value={coinReason} onChange={(e) => setCoinReason(e.target.value)} placeholder={t('admin.reasonPlaceholder')} rows={3} className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors resize-none" />
              </div>
              <div className="flex gap-4">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setAdjustCoinsDialogOpen(false)} className="flex-1 px-6 py-3 rounded-xl border border-[var(--border-strong)] text-text-primary font-semibold hover:bg-[var(--bg-subtle)] transition-colors">{t('admin.cancel')}</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleAdjustCoins} disabled={adjustCoinsMutation.isPending} className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold hover:shadow-lg hover:shadow-yellow-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">{adjustCoinsMutation.isPending ? t('admin.adjusting') : t('admin.adjustCoinsBtn')}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editUserDialogOpen && userToEdit && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditUserDialogOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="glass-card p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold neon-text mb-2">İstifadəçini Redaktə Et</h3>
              <p className="text-text-tertiary text-sm mb-6">{userToEdit.firstName} {userToEdit.lastName} &bull; {userToEdit.email}</p>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Telefon nömrəsi</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+994 XX XXX XX XX"
                    className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
                <div className="border-t border-[var(--border)] pt-4">
                  <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Yeni şifrə təyin et (isteğe bağlı)</p>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type={showEditNewPw ? 'text' : 'password'}
                        value={editNewPassword}
                        onChange={(e) => setEditNewPassword(e.target.value)}
                        placeholder="Yeni şifrə (ən azı 8 simvol)"
                        className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] transition-colors pr-10"
                      />
                      <button type="button" onClick={() => setShowEditNewPw(!showEditNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                        {showEditNewPw ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                      </button>
                    </div>
                    <input
                      type="password"
                      value={editConfirmPassword}
                      onChange={(e) => setEditConfirmPassword(e.target.value)}
                      placeholder="Şifrəni təsdiqlə"
                      className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
                    {editNewPassword && editConfirmPassword && editNewPassword !== editConfirmPassword && (
                      <p className="text-xs text-red-500">Şifrələr uyğun gəlmir</p>
                    )}
                    <p className="text-xs text-text-tertiary">Cari şifrə tələb olunmur — admin olaraq dəyişirsiniz.</p>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setEditUserDialogOpen(false)} className="flex-1 px-6 py-3 rounded-xl border border-[var(--border-strong)] text-text-primary font-semibold hover:bg-[var(--bg-subtle)] transition-colors">Ləğv et</motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSaveEditUser} disabled={updateUserMutation.isPending || adminChangePasswordMutation.isPending} className="flex-1 neon-button disabled:opacity-50 disabled:cursor-not-allowed">
                    {(updateUserMutation.isPending || adminChangePasswordMutation.isPending) ? 'Saxlanılır...' : 'Saxla'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;

