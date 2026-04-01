import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/api';

interface ContentItem {
  id: string;
  type: 'ACTIVITY';
  title: string;
  description: string;
  clubName?: string;
  createdAt: string;
  date?: string;
  time?: string;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface ContentData {
  activities: ContentItem[];
}

const ContentModeration: React.FC = () => {
  const { t } = useTranslation();
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [menuContentId, setMenuContentId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [clubFilter, setClubFilter] = useState('');

  const queryClient = useQueryClient();

  const { data: contentData, isLoading, error } = useQuery({
    queryKey: ['content-moderation'],
    queryFn: async () => {
      const response = await apiClient.get('/content-moderation');
      return response.data.data as ContentData;
    },
  });

  // Get unique clubs for filter
  const clubs = contentData?.activities
    ? Array.from(new Set(contentData.activities.map(a => a.clubName).filter(Boolean)))
        .sort()
    : [];

  // Filter activities by club
  const filteredActivities = contentData?.activities.filter(activity => {
    if (clubFilter && activity.clubName !== clubFilter) return false;
    return true;
  }) || [];

  // Delete mutation
  const deleteContentMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const response = await apiClient.delete(`/activities/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-moderation'] });
      toast.success('Activity deleted successfully!');
      setMenuContentId(null);
    },
    onError: () => {
      toast.error('Failed to delete activity');
    },
  });

  // Update mutation
  const updateContentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.put(`/activities/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-moderation'] });
      toast.success('Activity updated successfully!');
      setEditDialogOpen(false);
      setSelectedContent(null);
    },
    onError: () => {
      toast.error('Failed to update activity');
    },
  });

  const handleEdit = (item: ContentItem) => {
    setSelectedContent(item);
    setEditTitle(item.title);
    setEditDescription(item.description);
    
    // Extract date and time from startDate if available
    if (item.date) {
      // If date field exists, use it
      setEditDate(item.date);
      setEditTime(item.time || '');
    } else if ((item as any).startDate) {
      // If startDate exists, parse it
      const startDate = new Date((item as any).startDate);
      if (!isNaN(startDate.getTime())) {
        // Valid date
        setEditDate(startDate.toISOString().split('T')[0]);
        // Extract time in HH:MM format
        const hours = startDate.getUTCHours().toString().padStart(2, '0');
        const minutes = startDate.getUTCMinutes().toString().padStart(2, '0');
        setEditTime(`${hours}:${minutes}`);
      } else {
        setEditDate('');
        setEditTime('');
      }
    } else {
      setEditDate('');
      setEditTime('');
    }
    
    setEditDialogOpen(true);
    setMenuContentId(null);
  };

  const handleDelete = (item: ContentItem) => {
    if (window.confirm(`Are you sure you want to delete this activity?`)) {
      deleteContentMutation.mutate({ id: item.id });
    }
  };

  const handleSaveEdit = () => {
    if (!selectedContent) return;
    
    // Combine date and time into proper ISO timestamp
    let startDate = undefined;
    if (editDate) {
      try {
        console.log('editDate:', editDate, 'editTime:', editTime);
        
        // Parse date parts
        const [year, month, day] = editDate.split('-').map(Number);
        
        if (editTime) {
          // Parse time parts
          const [hours, minutes] = editTime.split(':').map(Number);
          // Create date using UTC
          const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
          console.log('Created date:', date);
          if (!isNaN(date.getTime())) {
            startDate = date.toISOString();
          }
        } else {
          // Just date, set time to midnight UTC
          const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
          console.log('Created date:', date);
          if (!isNaN(date.getTime())) {
            startDate = date.toISOString();
          }
        }
        
        console.log('Final startDate:', startDate);
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    }
    
    updateContentMutation.mutate({
      id: selectedContent.id,
      data: {
        title: editTitle,
        description: editDescription,
        startDate: startDate
      }
    });
  };

  const getTypeIcon = (type: string) => {
    return '\u{1F4C5}';
  };

  const getTypeColor = (type: string) => {
    return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 border-red-500/50"
      >
        <p className="text-red-400">Failed to load content. Please try again.</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold neon-text"
        >
          Content Moderation - Activities
        </motion.h2>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-secondary mb-2">{t('admin.filterByClub')}</label>
            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary focus:outline-none focus:border-[var(--accent)] transition-colors [&>option]:bg-[var(--bg-elevated)] [&>option]:text-text-primary"
            >
              <option value="">All Clubs ({contentData?.activities.length || 0} activities)</option>
              {clubs.map((club) => (
                <option key={club} value={club}>
                  {club} ({contentData?.activities.filter(a => a.clubName === club).length || 0})
                </option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card overflow-hidden"
      >
        {filteredActivities.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-text-tertiary">{t('admin.noActivitiesToReview')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.type')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.title')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.description')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.club_col')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.dateTime')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.author')}</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.created')}</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-text-secondary">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredActivities.map((item: ContentItem, index: number) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-[var(--border)] hover:bg-[var(--bg-subtle)] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getTypeIcon(item.type)}</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getTypeColor(item.type)}`}>
                            {item.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-text-primary">{item.title}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-text-secondary max-w-md truncate">
                          {item.description || t('admin.noDescription')}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {item.clubName || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {item.date && item.time ? (
                          <div>
                            <p className="font-medium text-text-primary">{item.date}</p>
                            <p className="text-sm text-text-tertiary">{item.time}</p>
                          </div>
                        ) : (
                          <p className="text-text-tertiary">{t('admin.notSet')}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {item.author ? (
                          <div>
                            <p className="font-medium text-text-primary">
                              {item.author.firstName} {item.author.lastName}
                            </p>
                            <p className="text-sm text-text-tertiary">{item.author.email}</p>
                          </div>
                        ) : (
                          <p className="text-text-tertiary">{t('admin.unknown')}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setMenuContentId(menuContentId === item.id ? null : item.id)}
                            className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] hover:border-[var(--accent)] hover:shadow-soft transition-all text-[var(--accent)]"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </motion.button>
                          <AnimatePresence>
                            {menuContentId === item.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute right-0 mt-2 w-48 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg overflow-hidden shadow-float z-50"
                              >
                                <button
                                  onClick={() => {
                                    setSelectedContent(item);
                                    setViewDialogOpen(true);
                                    setMenuContentId(null);
                                  }}
                                  className="w-full px-4 py-3 text-left text-text-secondary hover:bg-[var(--bg-subtle)] transition-colors flex items-center gap-3"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  View Details
                                </button>
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="w-full px-4 py-3 text-left hover:bg-[var(--bg-subtle)] transition-colors flex items-center gap-3 text-[var(--accent)]"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    handleDelete(item);
                                    setMenuContentId(null);
                                  }}
                                  className="w-full px-4 py-3 text-left hover:bg-red-50 text-red-600 transition-colors flex items-center gap-3"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
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
        )}
      </motion.div>

      <AnimatePresence>
        {viewDialogOpen && selectedContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setViewDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold neon-text mb-6">{t('admin.activityDetails')}</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getTypeIcon(selectedContent.type)}</span>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getTypeColor(selectedContent.type)}`}>
                      {selectedContent.type}
                    </span>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-text-tertiary mb-1">Title</p>
                  <p className="text-xl font-bold text-text-primary">{selectedContent.title}</p>
                </div>

                <div>
                  <p className="text-sm text-text-tertiary mb-1">Description</p>
                  <p className="text-text-primary bg-[var(--bg-subtle)] p-4 rounded-lg">
                    {selectedContent.description || t('admin.noDescriptionProvided')}
                  </p>
                </div>

                {selectedContent.clubName && (
                  <div>
                    <p className="text-sm text-text-tertiary mb-1">Club</p>
                    <p className="text-text-primary">{selectedContent.clubName}</p>
                  </div>
                )}

                {(selectedContent.date || selectedContent.time) && (
                  <div>
                    <p className="text-sm text-text-tertiary mb-1">{t('admin.activityDateTime')}</p>
                    <div className="bg-[var(--bg-subtle)] p-4 rounded-lg">
                      {selectedContent.date && (
                        <p className="font-medium text-text-primary">Date: {selectedContent.date}</p>
                      )}
                      {selectedContent.time && (
                        <p className="text-sm text-text-tertiary">Time: {selectedContent.time}</p>
                      )}
                    </div>
                  </div>
                )}

                {selectedContent.author && (
                  <div>
                    <p className="text-sm text-text-tertiary mb-1">Author</p>
                    <div className="bg-[var(--bg-subtle)] p-4 rounded-lg">
                      <p className="font-medium text-text-primary">
                        {selectedContent.author.firstName} {selectedContent.author.lastName}
                      </p>
                      <p className="text-sm text-text-tertiary">{selectedContent.author.email}</p>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-text-tertiary mb-1">Created</p>
                  <p className="text-text-primary">{new Date(selectedContent.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-8">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setViewDialogOpen(false)}
                  className="w-full neon-button"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editDialogOpen && selectedContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setEditDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold neon-text mb-6">{t('admin.editActivity')}</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('admin.activityTitle')}
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] transition-colors"
                    placeholder={t('admin.enterTitle')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('admin.description')} *
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                    placeholder={t('admin.enterDescription')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {t('admin.activityDate')}
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {t('admin.activityTime')}
                    </label>
                    <input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setEditDialogOpen(false)}
                    className="flex-1 px-6 py-3 rounded-xl border border-[var(--border-strong)] text-text-primary font-semibold hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSaveEdit}
                    disabled={updateContentMutation.isPending}
                    className="flex-1 neon-button disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateContentMutation.isPending ? t('admin.saving') : t('admin.saveChanges')}
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

export default ContentModeration;

