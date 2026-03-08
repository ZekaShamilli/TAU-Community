import React from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { applicationService } from '../../services/applicationService';

interface ApplicationReviewProps {
  clubId: string;
}

const ApplicationReview: React.FC<ApplicationReviewProps> = ({ clubId }) => {
  const queryClient = useQueryClient();

  const {
    data: applications,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['club-applications', clubId],
    queryFn: () => applicationService.getClubApplications(clubId),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      applicationService.reviewApplication(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-applications'] });
      toast.success('Application reviewed successfully!');
    },
    onError: () => {
      toast.error('Failed to review application');
    },
  });

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
        <p className="text-red-400">Failed to load applications. Please try again.</p>
      </motion.div>
    );
  }

  const applicationList = applications || [];
  const pendingApplications = applicationList.filter((app: any) => app.status === 'PENDING');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold neon-text">Application Review</h2>
        <p className="text-gray-400 mt-1">Review and manage club membership applications</p>
      </div>

      {/* Applications List */}
      {pendingApplications.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 text-center"
        >
          <span className="text-6xl mb-4 block">📝</span>
          <h3 className="text-xl font-bold text-text-primary mb-2">No Pending Applications</h3>
          <p className="text-gray-400">All applications have been reviewed!</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {pendingApplications.map((application: any, index: number) => (
            <motion.div
              key={application.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card p-6"
            >
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-text-primary mb-2">
                    {application.student?.firstName} {application.student?.lastName}
                  </h3>
                  <p className="text-gray-400 mb-1">{application.student?.email}</p>
                  <p className="text-sm text-gray-500">
                    Applied: {new Date(application.submittedAt).toLocaleDateString()}
                  </p>
                  
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Motivation:</h4>
                    <div className="text-gray-300 bg-white/5 p-3 rounded-lg border border-white/10 max-h-32 overflow-y-auto">
                      <p className="break-all whitespace-pre-wrap">
                        {application.motivation}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => reviewMutation.mutate({ id: application.id, status: 'APPROVED' })}
                    disabled={reviewMutation.isPending}
                    className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ✓ Approve
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => reviewMutation.mutate({ id: application.id, status: 'REJECTED' })}
                    disabled={reviewMutation.isPending}
                    className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ✗ Reject
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* All Applications Summary */}
      {applicationList.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <h3 className="text-xl font-bold text-text-primary mb-4">Application Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                {applicationList.filter((a: any) => a.status === 'PENDING').length}
              </p>
              <p className="text-gray-400 mt-1">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600">
                {applicationList.filter((a: any) => a.status === 'APPROVED').length}
              </p>
              <p className="text-gray-400 mt-1">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
                {applicationList.filter((a: any) => a.status === 'REJECTED').length}
              </p>
              <p className="text-gray-400 mt-1">Rejected</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ApplicationReview;
