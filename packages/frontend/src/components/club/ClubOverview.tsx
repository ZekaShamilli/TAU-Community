import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Club } from '../../types';
import { activityService } from '../../services/activityService';
import { applicationService } from '../../services/applicationService';

interface ClubOverviewProps {
  club: Club;
  onTabChange?: (tabIndex: number) => void;
}

const ClubOverview: React.FC<ClubOverviewProps> = ({ club, onTabChange }) => {
  const navigate = useNavigate();

  // Fetch club activities
  const {
    data: activitiesData,
    isLoading: activitiesLoading,
  } = useQuery({
    queryKey: ['club-activities', club.id],
    queryFn: () => activityService.getClubActivities(club.id),
  });

  // Fetch application summary
  const {
    data: applicationSummary,
    isLoading: applicationsLoading,
  } = useQuery({
    queryKey: ['application-summary', club.id],
    queryFn: () => applicationService.getApplicationSummary(club.id),
  });

  const activities = activitiesData || [];
  const upcomingActivities = activities.filter(
    activity => new Date(activity.startDate) > new Date()
  ).slice(0, 5);

  const recentApplications = applicationSummary?.recent || [];

  const StatCard: React.FC<{
    title: string;
    value: number | string;
    icon: string;
    gradient: string;
    action?: () => void;
    actionLabel?: string;
  }> = ({ title, value, icon, gradient, action, actionLabel }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`text-4xl font-bold ${gradient}`}>{value}</h3>
          <p className="text-text-secondary mt-2">{title}</p>
        </div>
        <span className="text-5xl">{icon}</span>
      </div>
      {action && actionLabel && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={action}
          className="w-full px-4 py-2 rounded-lg border-2 border-neon-blue text-neon-blue font-semibold hover:bg-neon-blue/10 transition-colors"
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold neon-text">Club Overview</h2>
          <p className="text-text-secondary mt-1">Welcome back! Here's what's happening with {club.name}.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(`/kulup/${club.urlSlug}`)}
          className="neon-button flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View Public Page
        </motion.button>
      </div>

      {/* Club Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <h3 className="text-xl font-bold text-text-primary mb-4">Club Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <p className="text-text-secondary mb-4">{club.description}</p>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                club.isActive
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-gray-500/20 text-text-tertiary border border-gray-500/50'
              }`}>
                {club.isActive ? 'Active' : 'Inactive'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/50">
                URL: /kulup/{club.urlSlug}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/50">
                Created: {new Date(club.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-secondary mb-3">Quick Actions</h4>
            <div className="flex flex-col gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onTabChange?.(1)}
                className="px-4 py-2 rounded-lg border border-white/20 text-text-primary hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <span>{'\u002B'}</span>
                Create Activity
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onTabChange?.(2)}
                className="px-4 py-2 rounded-lg border border-white/20 text-text-primary hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <span>{'\u{1F4DD}'}</span>
                Review Applications
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Activities"
          value={activities.length}
          icon={'\u{1F4C5}'}
          gradient="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600"
          action={() => onTabChange?.(1)}
          actionLabel="Manage Activities"
        />
        <StatCard
          title="Upcoming Activities"
          value={upcomingActivities.length}
          icon={'\u23F0'}
          gradient="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600"
        />
        <StatCard
          title="Total Applications"
          value={applicationSummary?.total || 0}
          icon={'\u{1F4DD}'}
          gradient="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600"
          action={() => onTabChange?.(2)}
          actionLabel="Review Applications"
        />
        <StatCard
          title="Pending Applications"
          value={applicationSummary?.pending || 0}
          icon={'\u23F3'}
          gradient="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Activities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <span>{'\u{1F4C5}'}</span>
            Upcoming Activities
          </h3>
          {activitiesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-blue"></div>
            </div>
          ) : upcomingActivities.length === 0 ? (
            <div className="p-4 bg-blue-100 border border-blue-300 rounded-xl">
              <p className="text-blue-700 text-sm">
                No upcoming activities. Create your first activity to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingActivities.map((activity) => (
                <div key={activity.id} className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-neon-blue/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-text-primary font-medium">{activity.title}</p>
                      <p className="text-sm text-text-secondary">{activity.location}</p>
                      <p className="text-xs text-text-secondary mt-1">
                        {new Date(activity.startDate).toLocaleDateString()} at{' '}
                        {new Date(activity.startDate).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      activity.status === 'PUBLISHED'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                        : 'bg-gray-500/20 text-text-tertiary border border-gray-500/50'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Applications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6"
        >
          <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <span>{'\u{1F4DD}'}</span>
            Recent Applications
          </h3>
          {applicationsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-blue"></div>
            </div>
          ) : recentApplications.length === 0 ? (
            <div className="p-4 bg-blue-100 border border-blue-300 rounded-xl">
              <p className="text-blue-700 text-sm">No recent applications.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentApplications.map((application) => (
                <div key={application.id} className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-neon-blue/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-text-primary font-medium">{application.studentName}</p>
                      <p className="text-sm text-text-secondary">{application.studentEmail}</p>
                      <p className="text-xs text-text-secondary mt-1">
                        Applied {new Date(application.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      application.status === 'APPROVED'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                        : application.status === 'REJECTED'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                    }`}>
                      {application.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Application Summary */}
      {applicationSummary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <h3 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
            <span>{'\u{1F4C8}'}</span>
            Application Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <h4 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
                {applicationSummary.total}
              </h4>
              <p className="text-text-secondary mt-2">Total Applications</p>
            </div>
            <div className="text-center">
              <h4 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                {applicationSummary.pending}
              </h4>
              <p className="text-text-secondary mt-2">Pending Review</p>
            </div>
            <div className="text-center">
              <h4 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600">
                {applicationSummary.approved}
              </h4>
              <p className="text-text-secondary mt-2">Approved</p>
            </div>
            <div className="text-center">
              <h4 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
                {applicationSummary.rejected}
              </h4>
              <p className="text-text-secondary mt-2">Rejected</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ClubOverview;

