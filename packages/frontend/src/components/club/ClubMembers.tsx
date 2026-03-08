import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationService } from '../../services/applicationService';
import { coinService } from '../../services/coinService';
import { clubService } from '../../services/clubService';

interface ClubMembersProps {
  clubId: string;
}

const ClubMembers: React.FC<ClubMembersProps> = ({ clubId }) => {
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [coinAmount, setCoinAmount] = useState('10');
  const [coinReason, setCoinReason] = useState('');
  const queryClient = useQueryClient();

  const {
    data: applications,
    isLoading: applicationsLoading,
    error: applicationsError,
  } = useQuery({
    queryKey: ['club-applications', clubId],
    queryFn: () => applicationService.getClubApplications(clubId),
  });

  const {
    data: club,
    isLoading: clubLoading,
    error: clubError,
  } = useQuery({
    queryKey: ['club', clubId],
    queryFn: () => clubService.getClub(clubId),
  });

  // Fetch coin balances for all members
  const memberIds = React.useMemo(() => {
    const allApprovedApps = (applications || []).filter((app: any) => app.status === 'APPROVED');
    const ids = allApprovedApps.map((app: any) => app.student?.id || app.studentId).filter(Boolean);
    if (club?.president?.id) {
      ids.push(club.president.id);
    }
    return ids;
  }, [applications, club]);

  const { data: coinBalances } = useQuery({
    queryKey: ['coin-balances', memberIds],
    queryFn: async () => {
      const balances: Record<string, any> = {};
      await Promise.all(
        memberIds.map(async (userId: string) => {
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
    enabled: memberIds.length > 0,
  });

  const isLoading = applicationsLoading || clubLoading;
  const error = applicationsError || clubError;

  const awardCoinsMutation = useMutation({
    mutationFn: (data: { toUserId: string; amount: number; reason: string; clubId: string }) =>
      coinService.awardCoins(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-applications', clubId] });
      setAwardDialogOpen(false);
      setSelectedMember(null);
      setCoinAmount('10');
      setCoinReason('');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberEmail: string) => 
      clubService.removeMember(clubId, memberEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-applications', clubId] });
      toast.success('Member removed from club successfully!');
    },
    onError: () => {
      toast.error('Failed to remove member from club');
    },
  });

  const handleAwardCoins = () => {
    if (!selectedMember) return;
    
    const amount = parseInt(coinAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid coin amount');
      return;
    }

    const userId = selectedMember.student?.id || selectedMember.studentId;
    if (!userId) {
      alert('Unable to identify user');
      return;
    }

    awardCoinsMutation.mutate({
      toUserId: userId,
      amount,
      reason: coinReason || 'Activity participation reward',
      clubId,
    });
  };

  const handleRemoveMember = (member: any) => {
    const memberEmail = member.student?.email || member.studentEmail;
    const memberName = member.student?.firstName && member.student?.lastName 
      ? `${member.student.firstName} ${member.student.lastName}`
      : member.studentName || 'this member';

    if (window.confirm(`Are you sure you want to remove ${memberName} from the club?`)) {
      removeMemberMutation.mutate(memberEmail);
    }
  };

  const openAwardDialog = (member: any) => {
    setSelectedMember(member);
    setAwardDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 border-red-500/50"
      >
        <p className="text-red-400">Failed to load members. Please try again.</p>
      </motion.div>
    );
  }

  // Filter approved applications to get members and add president
  const allApprovedApps = (applications || []).filter((app: any) => app.status === 'APPROVED');
  
  // Remove duplicates by email - keep only the first application from each user
  const uniqueMembers = allApprovedApps.reduce((acc: any[], current: any) => {
    const email = current.student?.email || current.studentEmail;
    const exists = acc.find((item: any) => 
      (item.student?.email || item.studentEmail) === email
    );
    if (!exists && email) {
      acc.push(current);
    }
    return acc;
  }, []);
  
  // Add president to members list if exists
  let members = [...uniqueMembers];
  
  if (club?.president) {
    // Check if president is not already in the list
    const presidentEmail = club.president.email;
    const presidentExists = members.find((m: any) => 
      (m.student?.email || m.studentEmail) === presidentEmail
    );
    
    if (!presidentExists) {
      // Add president as a special member at the beginning
      members.unshift({
        id: `president-${club.president.id}`,
        student: {
          id: club.president.id,
          firstName: club.president.firstName,
          lastName: club.president.lastName,
          email: club.president.email,
        },
        isPresident: true,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold neon-text">Club Members</h2>
        <p className="text-gray-400 mt-1">Manage your club members</p>
      </div>

      {/* Members List */}
      {members.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 text-center"
        >
          <span className="text-6xl mb-4 block">👥</span>
          <h3 className="text-xl font-bold text-text-primary mb-2">No Members Yet</h3>
          <p className="text-gray-400">Approve applications to add members to your club!</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member: any, index: number) => {
            const userId = member.student?.id || member.studentId;
            const userCoins = coinBalances?.[userId] || { balance: 0 };
            
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white font-bold text-lg">
                    {member.student?.firstName?.[0] || member.studentName?.[0] || '?'}
                    {member.student?.lastName?.[0] || member.studentName?.split(' ')[1]?.[0] || ''}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-text-primary">
                      {member.student?.firstName && member.student?.lastName 
                        ? `${member.student.firstName} ${member.student.lastName}`
                        : member.studentName || 'Unknown'}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {member.student?.email || member.studentEmail || 'No email'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {member.isPresident ? (
                        <span className="inline-block px-2 py-1 text-xs rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 border border-purple-500/50">
                          👑 President
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/50">
                          Member
                        </span>
                      )}
                      <span className="inline-block px-2 py-1 text-xs rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/50">
                        🪙 {userCoins.balance}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons - Don't show for president */}
                {!member.isPresident && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => openAwardDialog(member)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-yellow-500/50 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="text-lg">🪙</span>
                      Award Coins
                    </button>
                    <button
                      onClick={() => handleRemoveMember(member)}
                      disabled={removeMemberMutation.isPending}
                      className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove from club"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Member Stats */}
      {members.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <h3 className="text-xl font-bold text-text-primary mb-4">Member Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
                {members.length}
              </p>
              <p className="text-gray-400 mt-1">Total Members</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600">
                {members.length}
              </p>
              <p className="text-gray-400 mt-1">Active</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600">
                {(applications || []).filter((a: any) => a.status === 'PENDING').length}
              </p>
              <p className="text-gray-400 mt-1">Pending</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Award Coins Dialog */}
      <AnimatePresence>
        {awardDialogOpen && selectedMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setAwardDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 max-w-md w-full border-yellow-500/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                  🪙 Award Coins
                </h3>
                <button
                  onClick={() => setAwardDialogOpen(false)}
                  className="text-gray-400 hover:text-text-primary transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Member Info */}
              <div className="flex items-center gap-4 mb-6 p-4 bg-dark-800/50 rounded-lg border border-dark-600">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white font-bold text-lg">
                  {selectedMember.student?.firstName?.[0] || selectedMember.studentName?.[0] || '?'}
                  {selectedMember.student?.lastName?.[0] || selectedMember.studentName?.split(' ')[1]?.[0] || ''}
                </div>
                <div>
                  <h4 className="font-bold text-text-primary">
                    {selectedMember.student?.firstName && selectedMember.student?.lastName 
                      ? `${selectedMember.student.firstName} ${selectedMember.student.lastName}`
                      : selectedMember.studentName || 'Unknown'}
                  </h4>
                  <p className="text-sm text-gray-400">
                    {selectedMember.student?.email || selectedMember.studentEmail || 'No email'}
                  </p>
                </div>
              </div>

              {/* Coin Amount Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Coin Amount
                </label>
                <input
                  type="number"
                  min="1"
                  value={coinAmount}
                  onChange={(e) => setCoinAmount(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-800/50 border border-dark-600 rounded-lg text-text-primary focus:border-yellow-500/50 focus:outline-none transition-colors"
                  placeholder="Enter amount"
                />
              </div>

              {/* Reason Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  value={coinReason}
                  onChange={(e) => setCoinReason(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-800/50 border border-dark-600 rounded-lg text-text-primary focus:border-yellow-500/50 focus:outline-none transition-colors resize-none"
                  placeholder="e.g., Active participation in club activities"
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setAwardDialogOpen(false)}
                  className="flex-1 px-4 py-2 bg-dark-800/50 border border-dark-600 rounded-lg text-gray-300 hover:border-gray-500 transition-colors"
                  disabled={awardCoinsMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAwardCoins}
                  disabled={awardCoinsMutation.isPending}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-yellow-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {awardCoinsMutation.isPending ? 'Awarding...' : 'Award Coins'}
                </button>
              </div>

              {/* Error Message */}
              {awardCoinsMutation.isError && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  Failed to award coins. Please try again.
                </div>
              )}

              {/* Success Message */}
              {awardCoinsMutation.isSuccess && (
                <div className="mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
                  Coins awarded successfully! 🎉
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClubMembers;
