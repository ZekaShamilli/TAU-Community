import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activityService } from '../../services/activityService';

interface ActivityManagementProps {
  clubId: string;
}

const ActivityManagement: React.FC<ActivityManagementProps> = ({ clubId }) => {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [selectedActivityParticipants, setSelectedActivityParticipants] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    activityDate: '',
    activityTime: '',
    location: '',
    maxParticipants: '',
    registrationEndDate: '',
    registrationEndTime: ''
  });

  const {
    data: activities,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['club-activities', clubId],
    queryFn: () => activityService.getClubActivities(clubId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => activityService.createActivity({ ...data, clubId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-activities', clubId] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => activityService.updateActivity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-activities', clubId] });
      setIsEditDialogOpen(false);
      setSelectedActivity(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => activityService.deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-activities', clubId] });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      activityDate: '',
      activityTime: '',
      location: '',
      maxParticipants: '',
      registrationEndDate: '',
      registrationEndTime: ''
    });
  };

  const buildPayload = (data: typeof formData) => {
    const startDate = data.activityDate && data.activityTime
      ? new Date(`${data.activityDate}T${data.activityTime}`).toISOString()
      : undefined;
    const endDate = startDate
      ? new Date(new Date(startDate).getTime() + 2 * 60 * 60 * 1000).toISOString()
      : undefined;
    const registrationEndDate = data.registrationEndDate && data.registrationEndTime
      ? new Date(`${data.registrationEndDate}T${data.registrationEndTime}`).toISOString()
      : data.registrationEndDate
        ? new Date(`${data.registrationEndDate}T23:59`).toISOString()
        : undefined;
    return {
      title: data.title,
      description: data.description,
      startDate,
      endDate,
      location: data.location,
      ...(data.maxParticipants ? { maxParticipants: parseInt(data.maxParticipants, 10) } : {}),
      ...(registrationEndDate ? { registrationEndDate } : {}),
    };
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (activity: any) => {
    setSelectedActivity(activity);
    const dt = activity.startDate ? new Date(activity.startDate) : null;
    const pad = (n: number) => String(n).padStart(2, '0');
    setFormData({
      title: activity.title,
      description: activity.description || '',
      activityDate: dt ? `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}` : '',
      activityTime: dt ? `${pad(dt.getHours())}:${pad(dt.getMinutes())}` : '',
      location: activity.location || '',
      maxParticipants: activity.maxParticipants != null ? String(activity.maxParticipants) : '',
      registrationEndDate: activity.registrationEndDate
        ? (() => { const d = new Date(activity.registrationEndDate); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; })()
        : '',
      registrationEndTime: activity.registrationEndDate
        ? (() => { const d = new Date(activity.registrationEndDate); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; })()
        : ''
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(buildPayload(formData));
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedActivity) {
      updateMutation.mutate({ id: selectedActivity.id, data: buildPayload(formData) });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this activity?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleViewParticipants = async (activity: any) => {
    setSelectedActivity(activity);
    try {
      const response = await activityService.getActivityParticipants(activity.id);
      console.log('Participants response:', response);
      
      // Handle different response formats
      let participants: any[] = [];
      if (Array.isArray(response)) {
        participants = response;
      } else if (response && Array.isArray((response as any).data)) {
        participants = (response as any).data;
      } else if (response && (response as any).participants) {
        participants = (response as any).participants;
      }
      
      console.log('Processed participants:', participants);
      setSelectedActivityParticipants(participants);
      setIsParticipantsDialogOpen(true);
    } catch (error) {
      console.error('Failed to load participants:', error);
      setSelectedActivityParticipants([]);
      setIsParticipantsDialogOpen(true);
    }
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
        <p className="text-red-400">Failed to load activities. Please try again.</p>
      </motion.div>
    );
  }

  const activityList = activities || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold neon-text">Activity Management</h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCreate}
          className="neon-button flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Activity
        </motion.button>
      </div>

      {/* Activities List */}
      {activityList.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 text-center"
        >
          <span className="text-6xl mb-4 block">{'\u{1F4C5}'}</span>
          <h3 className="text-xl font-bold text-text-primary mb-2">No Activities Yet</h3>
          <p className="text-text-secondary">Create your first activity to get started!</p>
        </motion.div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Title</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Date & Time</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Location</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Max / Registered</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Participants</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activityList.map((activity: any, index: number) => (
                  <motion.tr
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-text-primary">{activity.title}</p>
                      <p className="text-sm text-text-tertiary">{activity.description?.substring(0, 50)}...</p>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      <p className="font-medium">{new Date(activity.startDate).toLocaleDateString()}</p>
                      <p className="text-xs text-text-tertiary">{new Date(activity.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{activity.location || '—'}</td>
                    <td className="px-6 py-4 text-text-secondary">
                      {activity.maxParticipants != null
                        ? <span className="font-semibold">{activity.maxParticipants}</span>
                        : <span className="text-text-tertiary">—</span>
                      }
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        activity.status === 'PUBLISHED'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                          : activity.status === 'DRAFT'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                          : 'bg-gray-500/20 text-text-tertiary border border-gray-500/50'
                      }`}>
                        {activity.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleViewParticipants(activity)}
                        className="px-3 py-1 bg-neon-purple/20 text-neon-purple border border-neon-purple/50 rounded hover:bg-neon-purple/30 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        View
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(activity)}
                          className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded hover:bg-blue-500/30 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(activity.id)}
                          className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/30 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <AnimatePresence>
        {isCreateDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsCreateDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold neon-text mb-6">Create Activity</h3>
              <form onSubmit={handleSubmitCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Description</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Activity Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.activityDate}
                      onChange={(e) => setFormData({ ...formData, activityDate: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Activity Time *</label>
                    <input
                      type="time"
                      required
                      value={formData.activityTime}
                      onChange={(e) => setFormData({ ...formData, activityTime: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Max Participants</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxParticipants}
                      onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                      placeholder="e.g. 50"
                      className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Registration Deadline (optional)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Last Registration Date</label>
                      <input
                        type="date"
                        value={formData.registrationEndDate}
                        onChange={(e) => setFormData({ ...formData, registrationEndDate: e.target.value })}
                        className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Last Registration Time</label>
                      <input
                        type="time"
                        value={formData.registrationEndTime}
                        onChange={(e) => setFormData({ ...formData, registrationEndTime: e.target.value })}
                        className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="flex-1 px-6 py-3 bg-gray-600/20 text-text-secondary rounded-lg hover:bg-gray-600/30 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="flex-1 neon-button"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Activity'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Dialog */}
      <AnimatePresence>
        {isEditDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsEditDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold neon-text mb-6">Edit Activity</h3>
              <form onSubmit={handleSubmitEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Description</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Activity Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.activityDate}
                      onChange={(e) => setFormData({ ...formData, activityDate: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Activity Time *</label>
                    <input
                      type="time"
                      required
                      value={formData.activityTime}
                      onChange={(e) => setFormData({ ...formData, activityTime: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Max Participants</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxParticipants}
                      onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                      placeholder="e.g. 50"
                      className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Registration Deadline (optional)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Last Registration Date</label>
                      <input
                        type="date"
                        value={formData.registrationEndDate}
                        onChange={(e) => setFormData({ ...formData, registrationEndDate: e.target.value })}
                        className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Last Registration Time</label>
                      <input
                        type="time"
                        value={formData.registrationEndTime}
                        onChange={(e) => setFormData({ ...formData, registrationEndTime: e.target.value })}
                        className="w-full px-4 py-2 bg-dark-800 border border-white/20 rounded-lg text-text-primary focus:outline-none focus:border-neon-blue"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditDialogOpen(false)}
                    className="flex-1 px-6 py-3 bg-gray-600/20 text-text-secondary rounded-lg hover:bg-gray-600/30 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="flex-1 neon-button"
                  >
                    {updateMutation.isPending ? 'Updating...' : 'Update Activity'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Participants Dialog */}
      <AnimatePresence>
        {isParticipantsDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsParticipantsDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold neon-text">Activity Participants</h3>
                <button
                  onClick={() => setIsParticipantsDialogOpen(false)}
                  className="text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {selectedActivity && (
                <div className="mb-6 p-4 bg-dark-800/50 rounded-lg border border-white/10">
                  <h4 className="text-lg font-semibold text-text-primary mb-2">{selectedActivity.title}</h4>
                  <div className="text-sm text-text-secondary space-y-1">
                    <p>Date: {new Date(selectedActivity.startDate).toLocaleDateString()} at {new Date(selectedActivity.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p>Location: {selectedActivity.location}</p>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <p className="text-text-secondary">
                  <span className="font-semibold text-neon-blue">{selectedActivityParticipants.length}</span> {selectedActivityParticipants.length === 1 ? 'participant' : 'participants'} registered
                </p>
              </div>

              {selectedActivityParticipants.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-6xl mb-4 block">{'\u{1F465}'}</span>
                  <p className="text-text-tertiary">No participants yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedActivityParticipants.map((participant: any, index: number) => (
                    <motion.div
                      key={participant.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-4 p-4 bg-dark-800/30 rounded-lg border border-white/10 hover:border-neon-blue/50 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white font-bold text-lg">
                        {participant.user?.firstName?.[0] || participant.user?.first_name?.[0] || '?'}{participant.user?.lastName?.[0] || participant.user?.last_name?.[0] || ''}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-text-primary">
                          {participant.user?.firstName || participant.user?.first_name} {participant.user?.lastName || participant.user?.last_name}
                        </p>
                        <p className="text-sm text-text-tertiary">{participant.user?.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-text-tertiary">Registered</p>
                        <p className="text-sm text-text-secondary">
                          {new Date(participant.registeredAt || participant.registered_at).toLocaleDateString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="mt-6">
                <button
                  onClick={() => setIsParticipantsDialogOpen(false)}
                  className="w-full px-6 py-3 bg-gray-600/20 text-text-secondary rounded-lg hover:bg-gray-600/30 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActivityManagement;

