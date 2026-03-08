import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-toastify';
import apiClient from '../../lib/api';

interface Application {
  id: string;
  club_id: string;
  student_name: string;
  student_email: string;
  motivation: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitted_at: string;
  reviewed_at?: string;
  review_comments?: string;
  club?: { id: string; name: string };
  student?: { firstName: string; lastName: string; email: string };
}

interface ReviewFormData {
  status: 'APPROVED' | 'REJECTED';
  reviewComments: string;
}

const ApplicationManagement: React.FC = () => {
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [menuApplicationId, setMenuApplicationId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { control, handleSubmit, formState: { errors }, reset, setValue } = useForm<ReviewFormData>();

  const { data: applicationsData, isLoading, error } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const response = await apiClient.get('/applications');
      return response.data.data || response.data || [];
    },
  });

  const reviewApplicationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ReviewFormData }) => {
      const response = await apiClient.put(`/applications/${id}/status`, { status: data.status, reviewNotes: data.reviewComments });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Application reviewed successfully!');
      setReviewDialogOpen(false);
      setSelectedApplication(null);
      reset();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to review application');
    },
  });

  const deleteApplicationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/applications/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Application deleted successfully!');
    },
    onError: () => {
      toast.error('Failed to delete application');
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'REJECTED': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'PENDING': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default: return 'bg-gray-500/20 text-text-tertiary border-gray-500/50';
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-blue"></div></div>;
  }

  if (error) {
    return <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border-red-500/50"><p className="text-red-400">Failed to load applications. Please try again.</p></motion.div>;
  }

  const applications = applicationsData || [];

  return (
    <div className="space-y-6">
      <motion.h2 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-bold neon-text">Application Management</motion.h2>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Student</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Club</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Submitted</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Reviewed</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {applications.map((application: Application, index: number) => (
                  <motion.tr key={application.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: index * 0.05 }} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-text-primary">{application.student?.firstName} {application.student?.lastName}</p>
                        <p className="text-sm text-text-tertiary">{application.student?.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-primary">{application.club?.name || 'Unknown Club'}</td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(application.status)}`}>{application.status}</span></td>
                    <td className="px-6 py-4 text-text-secondary">{new Date(application.submittedAt || application.submitted_at || application.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-text-secondary">{application.reviewedAt || application.reviewed_at ? new Date(application.reviewedAt || application.reviewed_at).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block">
                        <motion.button 
                          whileHover={{ scale: 1.1 }} 
                          whileTap={{ scale: 0.9 }} 
                          onClick={() => setMenuApplicationId(menuApplicationId === application.id ? null : application.id)} 
                          className="p-2 rounded-lg bg-dark-800/50 border border-neon-blue/30 hover:border-neon-blue/60 hover:shadow-lg hover:shadow-neon-blue/30 transition-all text-neon-blue"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </motion.button>
                        <AnimatePresence>
                          {menuApplicationId === application.id && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 mt-2 w-48 bg-dark-800 rounded-lg overflow-hidden shadow-xl z-50">
                              <button onClick={() => { setSelectedApplication(application); setViewDialogOpen(true); setMenuApplicationId(null); }} className="w-full px-4 py-3 text-left text-text-secondary hover:bg-dark-700 transition-colors flex items-center gap-3">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                View Details
                              </button>
                              {application.status === 'PENDING' && (
                                <>
                                  <button onClick={() => { setSelectedApplication(application); setValue('status', 'APPROVED'); setValue('reviewComments', ''); setReviewDialogOpen(true); setMenuApplicationId(null); }} className="w-full px-4 py-3 text-left hover:bg-dark-700 transition-colors flex items-center gap-3 text-green-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Approve
                                  </button>
                                  <button onClick={() => { setSelectedApplication(application); setValue('status', 'REJECTED'); setValue('reviewComments', ''); setReviewDialogOpen(true); setMenuApplicationId(null); }} className="w-full px-4 py-3 text-left hover:bg-dark-700 transition-colors flex items-center gap-3 text-red-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Reject
                                  </button>
                                </>
                              )}
                              <button onClick={() => { if (window.confirm(`Are you sure you want to delete this application?`)) { deleteApplicationMutation.mutate(application.id); } setMenuApplicationId(null); }} className="w-full px-4 py-3 text-left hover:bg-dark-700 text-red-400 transition-colors flex items-center gap-3">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Delete
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>

      <AnimatePresence>
        {viewDialogOpen && selectedApplication && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewDialogOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="glass-card p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold neon-text mb-6">Application Details</h3>
              <div className="space-y-4">
                <div><h4 className="text-xl font-bold text-text-primary break-words">{selectedApplication.student?.firstName} {selectedApplication.student?.lastName}</h4><p className="text-text-tertiary break-all">{selectedApplication.student?.email}</p></div>
                <div><p className="text-sm text-text-tertiary mb-1">Club</p><p className="text-text-primary break-words">{selectedApplication.club?.name || 'Unknown Club'}</p></div>
                <div><p className="text-sm text-text-tertiary mb-1">Status</p><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(selectedApplication.status)}`}>{selectedApplication.status}</span></div>
                <div><p className="text-sm text-text-tertiary mb-1">Motivation</p><p className="text-text-primary break-words whitespace-pre-wrap">{selectedApplication.motivation}</p></div>
                {selectedApplication.review_comments && (<div><p className="text-sm text-text-tertiary mb-1">Review Comments</p><p className="text-text-primary break-words whitespace-pre-wrap">{selectedApplication.review_comments}</p></div>)}
                <div><p className="text-sm text-text-tertiary">Submitted: {new Date(selectedApplication.submitted_at).toLocaleString()}</p>{selectedApplication.reviewed_at && (<p className="text-sm text-text-tertiary">Reviewed: {new Date(selectedApplication.reviewed_at).toLocaleString()}</p>)}</div>
              </div>
              <div className="mt-8"><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setViewDialogOpen(false)} className="w-full neon-button">Close</motion.button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewDialogOpen && selectedApplication && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setReviewDialogOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="glass-card p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold neon-text mb-6">Review Application</h3>
              <form onSubmit={handleSubmit((data) => selectedApplication && reviewApplicationMutation.mutate({ id: selectedApplication.id, data }))} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Review Comments *</label>
                  <Controller name="reviewComments" control={control} rules={{ required: 'Review comments are required' }} render={({ field }) => (<textarea {...field} rows={4} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder-gray-500 focus:outline-none focus:border-neon-blue transition-colors resize-none" placeholder="Provide feedback for the applicant..." />)} />
                  {errors.reviewComments && (<p className="mt-2 text-sm text-red-400">{errors.reviewComments.message}</p>)}
                </div>
                <div className="flex gap-4">
                  <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setReviewDialogOpen(false)} className="flex-1 px-6 py-3 rounded-xl border-2 border-white/20 text-text-primary font-semibold hover:bg-white/5 transition-colors">Cancel</motion.button>
                  <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={reviewApplicationMutation.isPending} className="flex-1 neon-button disabled:opacity-50 disabled:cursor-not-allowed">{reviewApplicationMutation.isPending ? 'Reviewing...' : 'Submit Review'}</motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ApplicationManagement;

