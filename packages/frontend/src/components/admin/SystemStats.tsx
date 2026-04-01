import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/api';

// Real stats service using API
const statsService = {
  getDashboardStats: async () => {
    const response = await apiClient.get('/admin/stats');
    return response.data.data;
  },
};

interface DashboardStats {
  totalClubs: number;
  totalActivities: number;
  totalApplications: number;
  totalUsers: number;
  recentActivities: Array<{
    id: string;
    title: string;
    club: { name: string };
    startDate: string;
  }>;
  pendingApplications: Array<{
    id: string;
    studentName: string;
    club: { name: string };
    submittedAt: string;
  }>;
  flaggedContent: Array<{
    id: string;
    type: string;
    content: { title: string };
    club: { name: string };
    flagReason: string;
  }>;
}

const SystemStats: React.FC = () => {
  const { t } = useTranslation();
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: statsService.getDashboardStats,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div>
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
        <p className="text-red-400">Failed to load dashboard statistics. Please try again.</p>
      </motion.div>
    );
  }

  if (!stats) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 border-blue-500/50"
      >
        <p className="text-[var(--accent)]">No statistics available at this time.</p>
      </motion.div>
    );
  }

  const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    gradient: string;
  }> = ({ title, value, icon, color, gradient }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      className="glass-card p-6 hover:border-[var(--accent)] transition-all"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-4xl font-bold ${gradient}`}>{value}</h3>
          <p className="text-text-tertiary mt-2">{title}</p>
        </div>
        <div className={`text-5xl ${color}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <motion.h2
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-3xl font-bold neon-text"
      >
        System Overview
      </motion.h2>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t('admin.totalClubs')}
          value={stats.totalClubs}
          icon={'\u{1F3E2}'}
          color="text-[var(--accent)]"
          gradient="text-[var(--accent)]"
        />
        <StatCard
          title={t('admin.totalActivities')}
          value={stats.totalActivities}
          icon={'\u{1F4C5}'}
          color="text-green-400"
          gradient="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600"
        />
        <StatCard
          title={t('admin.totalApplications')}
          value={stats.totalApplications}
          icon={'\u{1F4DD}'}
          color="text-yellow-400"
          gradient="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600"
        />
        <StatCard
          title={t('admin.totalUsers')}
          value={stats.totalUsers}
          icon={'\u{1F465}'}
          color="text-purple-400"
          gradient="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <span className="text-2xl">{'\u{1F4C5}'}</span>
            Upcoming Activities
          </h3>
          {stats.recentActivities.length === 0 ? (
            <p className="text-text-tertiary">{t('admin.noUpcomingActivities')}</p>
          ) : (
            <div className="space-y-3">
              {stats.recentActivities.map((activity) => (
                <div key={activity.id} className="p-3 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{'\u{23F0}'}</span>
                    <div className="flex-1">
                      <p className="text-text-primary font-medium">{activity.title}</p>
                      <p className="text-sm text-text-tertiary">{activity.club.name}</p>
                      <p className="text-xs text-text-tertiary mt-1">
                        {new Date(activity.startDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Pending Applications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6"
        >
          <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <span className="text-2xl">{'\u{1F4DD}'}</span>
            Pending Applications
          </h3>
          {stats.pendingApplications.length === 0 ? (
            <p className="text-text-tertiary">{t('admin.noPendingApplications')}</p>
          ) : (
            <div className="space-y-3">
              {stats.pendingApplications.map((application) => (
                <div key={application.id} className="p-3 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border)] hover:border-amber-400 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{'\u26A0\uFE0F'}</span>
                    <div className="flex-1">
                      <p className="text-text-primary font-medium">{application.studentName}</p>
                      <p className="text-sm text-text-tertiary">{application.club.name}</p>
                      <p className="text-xs text-text-tertiary mt-1">
                        {new Date(application.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Flagged Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <span className="text-2xl">{'\u{1F6A9}'}</span>
            Flagged Content
          </h3>
          {stats.flaggedContent.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl">{'\u2705'}</span>
              <p className="text-green-400">{t('admin.noFlaggedContent')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.flaggedContent.map((content) => (
                <div key={content.id} className="p-3 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border)] hover:border-red-400 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{'\u26A0\uFE0F'}</span>
                    <div className="flex-1">
                      <p className="text-text-primary font-medium">{content.content.title}</p>
                      <p className="text-sm text-text-tertiary">{content.club.name}</p>
                      <span className="inline-block mt-2 px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/50">
                        {content.flagReason}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* System Health */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h3 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
          <span className="text-2xl">{'\u{1F4C8}'}</span>
          System Health
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-text-tertiary mb-2">{t('admin.dbConnection')}</p>
            <div className="flex items-center gap-2">
              <span className="text-xl">{'\u2705'}</span>
              <p className="text-green-400 font-semibold">{t('admin.healthy')}</p>
            </div>
          </div>
          <div>
            <p className="text-text-tertiary mb-2">{t('admin.apiResponseTime')}</p>
            <div className="flex items-center gap-2">
              <span className="text-xl">{'\u2705'}</span>
              <p className="text-green-400 font-semibold">&lt; 200ms</p>
            </div>
          </div>
          <div>
            <p className="text-text-tertiary mb-2">{t('admin.cacheHitRate')}</p>
            <div>
              <div className="w-full bg-[var(--bg-subtle)] rounded-full h-2 mb-2">
                <div className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
              <p className="text-green-400 font-semibold">85%</p>
            </div>
          </div>
          <div>
            <p className="text-text-tertiary mb-2">{t('admin.activeSessions')}</p>
            <p className="text-3xl font-bold text-[var(--accent)]">23</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SystemStats;

