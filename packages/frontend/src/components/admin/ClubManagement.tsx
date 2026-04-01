import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { clubService } from '../../services/clubService';
import { Club, CreateClubRequest } from '../../types';

interface CreateClubFormData {
  name: string;
  description: string;
}

const ClubManagement: React.FC = () => {
  const { t } = useTranslation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [changePresidentDialogOpen, setChangePresidentDialogOpen] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [selectedPresidentId, setSelectedPresidentId] = useState<string>('');
  const [menuClubId, setMenuClubId] = useState<string | null>(null);
  const [existingClubNames, setExistingClubNames] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  const queryClient = useQueryClient();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuClubId) {
        const target = event.target as HTMLElement;
        // Check if click is outside the menu
        if (!target.closest('.actions-menu-container')) {
          setMenuClubId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuClubId]);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateClubFormData>();

  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    formState: { errors: editErrors },
    reset: resetEdit,
    setValue: setEditValue,
  } = useForm<CreateClubFormData>();

  // Fetch clubs based on active tab
  const {
    data: clubsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['clubs', activeTab],
    queryFn: () => clubService.getClubs({ page: 1, limit: 100, status: activeTab }),
  });

  // Fetch available presidents
  const {
    data: availablePresidents,
    isLoading: isLoadingPresidents,
  } = useQuery({
    queryKey: ['available-presidents'],
    queryFn: () => clubService.getAvailablePresidents(),
    enabled: changePresidentDialogOpen,
  });

  // Create club mutation
  const createClubMutation = useMutation({
    mutationFn: (data: CreateClubRequest) => clubService.createClub(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast.success('Club created successfully!');
      setCreateDialogOpen(false);
      reset();
    },
    onError: (error: any) => {
      console.error('Create club error:', error);
      let errorMessage = 'Failed to create club';
      
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      if (errorMessage.includes('already exists')) {
        errorMessage = 'A club with this name already exists. Please choose a different name.';
      }
      
      toast.error(errorMessage);
    },
  });

  // Update club mutation
  const updateClubMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateClubFormData> }) => 
      clubService.updateClub(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast.success('Club updated successfully!');
      setEditDialogOpen(false);
      setSelectedClub(null);
      resetEdit();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update club');
    },
  });

  // Delete club mutation
  const deleteClubMutation = useMutation({
    mutationFn: (clubId: string) => clubService.deleteClub(clubId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast.success('Club deleted successfully!');
      setDeleteDialogOpen(false);
      setSelectedClub(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete club');
    },
  });

  // Archive club mutation
  const archiveClubMutation = useMutation({
    mutationFn: (clubId: string) => clubService.archiveClub(clubId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast.success('Club archived successfully!');
      setArchiveDialogOpen(false);
      setSelectedClub(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to archive club');
    },
  });

  // Restore club mutation
  const restoreClubMutation = useMutation({
    mutationFn: (clubId: string) => clubService.restoreClub(clubId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast.success('Club restored successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to restore club');
    },
  });

  // Change president mutation
  const changePresidentMutation = useMutation({
    mutationFn: ({ clubId, presidentId }: { clubId: string; presidentId: string }) => 
      clubService.changePresident(clubId, presidentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setChangePresidentDialogOpen(false);
      setSelectedClub(null);
      setSelectedPresidentId('');
      toast.success('Club president updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update club president');
    },
  });

  // Fetch existing club names when create dialog opens
  useEffect(() => {
    if (createDialogOpen) {
      clubService.getClubNames()
        .then(names => setExistingClubNames(names))
        .catch(error => console.error('Failed to fetch club names:', error));
    }
  }, [createDialogOpen]);

  const handleCreateClub = (data: CreateClubFormData) => {
    createClubMutation.mutate(data);
  };

  const handleEditClub = (data: CreateClubFormData) => {
    if (selectedClub) {
      const updateData = {
        name: data.name,
        description: data.description
      };
      updateClubMutation.mutate({ id: selectedClub.id, data: updateData });
    }
  };

  const handleDeleteClub = () => {
    if (selectedClub) {
      deleteClubMutation.mutate(selectedClub.id);
    }
  };

  const handleViewDetails = (club: Club) => {
    setSelectedClub(club);
    setViewDialogOpen(true);
    setMenuClubId(null);
  };

  const handleEditClick = (club: Club) => {
    setSelectedClub(club);
    setEditValue('name', club.name);
    setEditValue('description', club.description);
    setEditDialogOpen(true);
    setMenuClubId(null);
  };

  const handleArchiveClick = (club: Club) => {
    setSelectedClub(club);
    setArchiveDialogOpen(true);
    setMenuClubId(null);
  };

  const handleArchiveClub = () => {
    if (selectedClub) {
      // Call archive mutation instead of delete
      archiveClubMutation.mutate(selectedClub.id);
      setArchiveDialogOpen(false);
    }
  };

  const handleRestoreClick = (club: Club) => {
    restoreClubMutation.mutate(club.id);
    setMenuClubId(null);
  };

  const handleChangePresidentClick = (club: Club) => {
    setSelectedClub(club);
    setSelectedPresidentId(club.presidentId || '');
    setChangePresidentDialogOpen(true);
    setMenuClubId(null);
  };

  const handleChangePresident = () => {
    if (selectedClub && selectedPresidentId) {
      changePresidentMutation.mutate({
        clubId: selectedClub.id,
        presidentId: selectedPresidentId,
      });
    }
  };

  const handleDeleteClick = (club: Club) => {
    setSelectedClub(club);
    setDeleteDialogOpen(true);
    setMenuClubId(null);
  };

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
        <p className="text-red-400">Failed to load clubs. Please try again.</p>
      </motion.div>
    );
  }

  const clubs = clubsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <h2 className="text-3xl font-bold neon-text">{t('admin.clubManagement')}</h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCreateDialogOpen(true)}
          disabled={activeTab === 'archived'}
          className="neon-button disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Club
          </span>
        </motion.button>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-1"
      >
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'active'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
            }`}
          >
            Active Clubs
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'archived'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
            }`}
          >
            Archived Clubs
          </button>
        </div>
      </motion.div>

      {/* Clubs Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.clubName')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.president')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.status')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.totalActivities')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.totalApplications')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-secondary">{t('admin.created')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-secondary">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {clubs.map((club: Club, index: number) => (
                  <motion.tr
                    key={club.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-text-primary">{club.name}</p>
                        <p className="text-sm text-text-tertiary">/{club.url_slug}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {club.president ? (
                        <div>
                          <p className="text-text-primary">{club.president.first_name} {club.president.last_name}</p>
                          <p className="text-sm text-text-tertiary">{club.president.email}</p>
                        </div>
                      ) : (
                        <p className="text-text-tertiary">{t('admin.noPresident')}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        club.is_active
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                          : 'bg-gray-500/20 text-text-tertiary border border-gray-500/50'
                      }`}>
                        {club.is_active ? t('admin.active') : t('admin.inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-strong)]">
                        {club.activities_count || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-strong)]">
                        {club.applications_count || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {new Date(club.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block actions-menu-container">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setMenuClubId(menuClubId === club.id ? null : club.id)}
                          className="p-2 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--bg-panel)] border border-[var(--border)] hover:border-[var(--accent)] transition-all"
                        >
                          <svg className="w-5 h-5 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </motion.button>
                        
                        <AnimatePresence>
                          {menuClubId === club.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 mt-2 w-64 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl shadow-float z-50 overflow-hidden"
                            >
                              <button
                                onClick={() => handleViewDetails(club)}
                                className="w-full px-5 py-3.5 text-left hover:bg-[var(--bg-subtle)] transition-colors flex items-center gap-3 text-text-primary text-base font-medium border-b border-[var(--border)]"
                              >
                                <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View Details
                              </button>
                              
                              {activeTab === 'active' ? (
                                <>
                                  <button
                                    onClick={() => handleEditClick(club)}
                                    className="w-full px-5 py-3.5 text-left hover:bg-[var(--bg-subtle)] transition-colors flex items-center gap-3 text-text-primary text-base font-medium border-b border-[var(--border)]"
                                  >
                                    <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit Club
                                  </button>
                                  <button
                                    onClick={() => handleChangePresidentClick(club)}
                                    className="w-full px-5 py-3.5 text-left hover:bg-[var(--bg-subtle)] transition-colors flex items-center gap-3 text-text-primary text-base font-medium border-b border-[var(--border)]"
                                  >
                                    <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Change President
                                  </button>
                                  <button
                                    onClick={() => handleArchiveClick(club)}
                                    className="w-full px-5 py-3.5 text-left hover:bg-[var(--bg-subtle)] transition-colors flex items-center gap-3 text-text-primary text-base font-medium border-b border-[var(--border)]"
                                  >
                                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                    Archive Club
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(club)}
                                    className="w-full px-5 py-3.5 text-left hover:bg-red-500/20 text-red-400 transition-colors flex items-center gap-3 text-base font-medium"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete Club
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleRestoreClick(club)}
                                    className="w-full px-5 py-3.5 text-left hover:bg-[var(--bg-subtle)] transition-colors flex items-center gap-3 text-text-primary text-base font-medium border-b border-[var(--border)]"
                                  >
                                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Restore Club
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(club)}
                                    className="w-full px-5 py-3.5 text-left hover:bg-red-500/20 text-red-400 transition-colors flex items-center gap-3 text-base font-medium"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Permanently Delete
                                  </button>
                                </>
                              )}
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

      {/* Create Club Dialog */}
      <AnimatePresence>
        {createDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setCreateDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold neon-text mb-6">{t('admin.createNewClub')}</h3>
              
              {existingClubNames.length > 0 && (
                <div className="mb-6 p-4 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl">
                  <p className="text-sm text-[var(--text-secondary)] mb-2">
                    <strong>{t('admin.existingClubs')}:</strong> {existingClubNames.join(', ')}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Please choose a unique name for your new club.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit(handleCreateClub)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('admin.clubName')} *
                  </label>
                  <Controller
                    name="name"
                    control={control}
                    rules={{ required: t('admin.clubNameRequired') }}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] transition-colors"
                        placeholder={t('admin.clubNamePlaceholder')}
                      />
                    )}
                  />
                  {errors.name && (
                    <p className="mt-2 text-sm text-red-400">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Description *
                  </label>
                  <Controller
                    name="description"
                    control={control}
                    rules={{ required: t('admin.descriptionRequired') }}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={4}
                        className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                        placeholder={t('admin.clubDescPlaceholder')}
                      />
                    )}
                  />
                  {errors.description && (
                    <p className="mt-2 text-sm text-red-400">{errors.description.message}</p>
                  )}
                </div>

                <div className="p-4 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl">
                  <p className="text-sm text-[var(--text-secondary)]">
                    You can assign a president to this club later using the "Change President" option in the club menu.
                  </p>
                </div>

                <div className="flex gap-4">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCreateDialogOpen(false)}
                    className="flex-1 px-6 py-3 rounded-xl border border-[var(--border-strong)] text-text-primary font-semibold hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={createClubMutation.isPending}
                    className="flex-1 neon-button disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createClubMutation.isPending ? t('admin.creating') : t('admin.createClub')}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Details Dialog */}
      <AnimatePresence>
        {viewDialogOpen && selectedClub && (
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
              className="glass-card p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold neon-text mb-6">{t('admin.clubDetails')}</h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-xl font-bold text-text-primary mb-2">{selectedClub.name}</h4>
                  <p className="text-text-tertiary">URL: /{selectedClub.url_slug}</p>
                </div>

                <div>
                  <h5 className="text-sm font-semibold text-text-secondary mb-2">{t('admin.description')}</h5>
                  <p className="text-text-primary">{selectedClub.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h5 className="text-sm font-semibold text-text-secondary mb-2">{t('admin.president')}</h5>
                    {selectedClub.president ? (
                      <div>
                        <p className="text-text-primary">{selectedClub.president.first_name} {selectedClub.president.last_name}</p>
                        <p className="text-text-tertiary text-sm">{selectedClub.president.email}</p>
                      </div>
                    ) : (
                      <p className="text-text-tertiary">{t('admin.noPresident')}</p>
                    )}
                  </div>

                  <div>
                    <h5 className="text-sm font-semibold text-text-secondary mb-2">{t('admin.statistics')}</h5>
                    <p className="text-text-primary">Activities: {selectedClub.activities_count || 0}</p>
                    <p className="text-text-primary">Applications: {selectedClub.applications_count || 0}</p>
                    <p className="text-text-primary">Status: {selectedClub.is_active ? t('admin.active') : t('admin.inactive')}</p>
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-semibold text-text-secondary mb-2">Created</h5>
                  <p className="text-text-primary">{new Date(selectedClub.created_at).toLocaleString()}</p>
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

      {/* Edit Club Dialog */}
      <AnimatePresence>
        {editDialogOpen && selectedClub && (
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
              <h3 className="text-2xl font-bold neon-text mb-6">{t('admin.editClub')}</h3>

              <form onSubmit={handleEditSubmit(handleEditClub)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('admin.clubName')} *
                  </label>
                  <Controller
                    name="name"
                    control={editControl}
                    rules={{ required: t('admin.clubNameRequired') }}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] transition-colors"
                      />
                    )}
                  />
                  {editErrors.name && (
                    <p className="mt-2 text-sm text-red-400">{editErrors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Description *
                  </label>
                  <Controller
                    name="description"
                    control={editControl}
                    rules={{ required: t('admin.descriptionRequired') }}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={4}
                        className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                      />
                    )}
                  />
                  {editErrors.description && (
                    <p className="mt-2 text-sm text-red-400">{editErrors.description.message}</p>
                  )}
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
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={updateClubMutation.isPending}
                    className="flex-1 neon-button disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateClubMutation.isPending ? t('admin.updating') : t('admin.updateClub')}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteDialogOpen && selectedClub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setDeleteDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-8 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-red-400 mb-4">{t('admin.deleteClubTitle')}</h3>
              <p className="text-text-secondary mb-6">
                Are you sure you want to delete "{selectedClub.name}"? This action cannot be undone and will remove all associated activities and applications.
              </p>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDeleteDialogOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-[var(--border-strong)] text-text-primary font-semibold hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDeleteClub}
                  disabled={deleteClubMutation.isPending}
                  className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-text-primary font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteClubMutation.isPending ? t('admin.deleting') : t('admin.delete')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Archive Confirmation Dialog */}
      <AnimatePresence>
        {archiveDialogOpen && selectedClub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setArchiveDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-8 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-yellow-400 mb-4">{t('admin.archiveClubTitle')}</h3>
              <p className="text-text-secondary mb-6">
                Are you sure you want to archive "{selectedClub.name}"? This will deactivate the club but preserve all data. You can reactivate it later.
              </p>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setArchiveDialogOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-[var(--border-strong)] text-text-primary font-semibold hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleArchiveClub}
                  disabled={archiveClubMutation.isPending}
                  className="flex-1 px-6 py-3 rounded-xl bg-yellow-500 text-text-primary font-semibold hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {archiveClubMutation.isPending ? t('admin.archiving') : t('admin.archive')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change President Dialog */}
      <AnimatePresence>
        {changePresidentDialogOpen && selectedClub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setChangePresidentDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-8 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold neon-text mb-6">{t('admin.changeClubPresident')}</h3>
              
              <div className="space-y-4 mb-6">
                <p className="text-text-primary">
                  Select a new president for <strong>{selectedClub.name}</strong>
                </p>
                <p className="text-text-tertiary text-sm">
                  Current President: {selectedClub.president ? 
                    `${selectedClub.president.firstName} ${selectedClub.president.lastName} (${selectedClub.president.email})` : 
                    'No president assigned'
                  }
                </p>
                
                {isLoadingPresidents ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--accent)]"></div>
                  </div>
                ) : (
                  <select
                    value={selectedPresidentId}
                    onChange={(e) => setSelectedPresidentId(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-xl text-text-primary focus:outline-none focus:border-[var(--accent)] transition-colors"
                  >
                    <option value="">{t('admin.noPresidentOption')}</option>
                    {availablePresidents?.map((user: any) => (
                      <option key={user.id} value={user.id} className="bg-[var(--bg-elevated)]">
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setChangePresidentDialogOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-[var(--border-strong)] text-text-primary font-semibold hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleChangePresident}
                  disabled={changePresidentMutation.isPending || !selectedPresidentId}
                  className="flex-1 neon-button disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changePresidentMutation.isPending ? t('admin.updating') : t('admin.updatePresident')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClubManagement;

