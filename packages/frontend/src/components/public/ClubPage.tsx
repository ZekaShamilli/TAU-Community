import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-toastify';
import { clubService } from '../../services/clubService';
import { activityService } from '../../services/activityService';
import { applicationService } from '../../services/applicationService';
import { useAuth } from '../../contexts/AuthContext';

interface ApplicationFormData {
  motivation: string;
}

const ClubPage: React.FC = () => {
  const { clubSlug } = useParams<{ clubSlug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [applicationDialogOpen, setApplicationDialogOpen] = useState(false);
  const [leaveClubDialogOpen, setLeaveClubDialogOpen] = useState(false);
  
  // Activity registration states
  const [activityRegistrations, setActivityRegistrations] = useState<Record<string, boolean>>({});
  const [activityParticipants, setActivityParticipants] = useState<Record<string, number>>({});
  const [registeringActivities, setRegisteringActivities] = useState<Record<string, boolean>>({});

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ApplicationFormData>({
    defaultValues: {
      motivation: '',
    },
  });

  // Fetch club data
  const {
    data: club,
    isLoading: clubLoading,
    error: clubError,
  } = useQuery({
    queryKey: ['club-by-slug', clubSlug],
    queryFn: () => clubSlug ? clubService.getClubBySlug(clubSlug) : null,
    enabled: !!clubSlug,
  });

  // Fetch club activities
  const {
    data: activities,
    isLoading: activitiesLoading,
  } = useQuery({
    queryKey: ['club-activities-public', club?.id],
    queryFn: () => club ? activityService.getClubActivities(club.id) : [],
    enabled: !!club,
  });

  // Fetch activity registrations and participants for all activities
  React.useEffect(() => {
    if (!activities || activities.length === 0) return;

    const fetchActivityData = async () => {
      const registrations: Record<string, boolean> = {};
      const participants: Record<string, number> = {};

      for (const activity of activities) {
        try {
          // Check registration
          if (isAuthenticated) {
            const regStatus = await activityService.checkRegistration(activity.id);
            registrations[activity.id] = regStatus.isRegistered;
          }
          
          // Get participants count
          const participantsList = await activityService.getActivityParticipants(activity.id);
          participants[activity.id] = participantsList.length;
        } catch (error) {
          console.error(`Failed to fetch data for activity ${activity.id}:`, error);
        }
      }

      setActivityRegistrations(registrations);
      setActivityParticipants(participants);
    };

    fetchActivityData();
  }, [activities, isAuthenticated]);

  // Check user's application status for this club
  const {
    data: applicationStatus,
    isLoading: applicationStatusLoading,
    error: applicationStatusError,
  } = useQuery({
    queryKey: ['user-application-status', club?.id, user?.email],
    queryFn: async () => {
      if (!club || !user?.email) {
        return null;
      }
      
      try {
        const response = await applicationService.checkExistingApplication(club.id, user.email);
        return response;
      } catch (error) {
        console.error('Failed to check application status:', error);
        return null;
      }
    },
    enabled: !!club && !!user?.email && isAuthenticated,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Submit application mutation
  const submitApplicationMutation = useMutation({
    mutationFn: (data: { clubId: string; motivation: string; userEmail?: string }) => 
      applicationService.submitApplication(
        { clubId: data.clubId, motivation: data.motivation }, 
        data.userEmail
      ),
    onSuccess: () => {
      toast.success('Application submitted successfully! You will receive a confirmation email shortly.');
      setApplicationDialogOpen(false);
      reset();
    },
    onError: (error: any) => {
      console.error('Application submission error:', error);
      
      const errorCode = error.response?.data?.error?.code;
      const errorMessage = error.response?.data?.error?.message;
      
      if (errorCode === 'DUPLICATE_APPLICATION') {
        toast.error('You have already applied to this club. Please check your application status.');
      } else if (errorCode === 'CLUB_NOT_FOUND') {
        toast.error('Club not found or inactive.');
      } else if (errorCode === 'VALIDATION_ERROR') {
        toast.error(errorMessage || 'Please fill in all required fields correctly.');
      } else {
        toast.error(errorMessage || 'Failed to submit application. Please try again.');
      }
    },
  });

  // Leave club mutation
  const leaveClubMutation = useMutation({
    mutationFn: (applicationId: string) => applicationService.deleteApplication(applicationId),
    onSuccess: () => {
      toast.success('You have successfully left the club.');
      setLeaveClubDialogOpen(false);
      // Refetch application status
      window.location.reload();
    },
    onError: (error: any) => {
      console.error('Leave club error:', error);
      toast.error('Failed to leave club. Please try again.');
    },
  });

  const handleSubmitApplication = async (data: ApplicationFormData) => {
    if (!club || !user) {
      toast.error('Please sign in to submit an application.');
      return;
    }

    try {
      const checkResponse = await applicationService.checkExistingApplication(club.id, user.email);
      if (checkResponse.exists) {
        toast.error(`You have already applied to this club. Status: ${checkResponse.application?.status}`);
        return;
      }
    } catch (error) {
      console.warn('Could not check existing application before submit:', error);
    }
    
    const applicationData = {
      clubId: club.id,
      motivation: data.motivation,
      userEmail: user.email,
    };
    submitApplicationMutation.mutate(applicationData);
  };

  const handleApplyClick = async () => {
    // If user is president, go to dashboard
    if (buttonConfig && buttonConfig.isPresident) {
      navigate('/club-dashboard');
      return;
    }

    if (!isAuthenticated || !user) {
      navigate('/login', { 
        state: { 
          from: { pathname: `/kulup/${clubSlug}` },
          message: 'Please sign in to apply to clubs'
        } 
      });
      return;
    }
    
    // Check if user already has an application
    if (applicationStatus?.exists) {
      const status = applicationStatus.application?.status;
      if (status === 'PENDING') {
        toast.info('Your application is pending review by the club president.');
      } else if (status === 'APPROVED') {
        // Show leave club dialog
        setLeaveClubDialogOpen(true);
      } else if (status === 'REJECTED') {
        toast.error('Your previous application was rejected. Please contact the club president for more information.');
      }
      return;
    }
    
    setApplicationDialogOpen(true);
  };

  const handleLeaveClub = () => {
    if (applicationStatus?.application?.id) {
      leaveClubMutation.mutate(applicationStatus.application.id);
    }
  };

  // Get button text and style based on application status
  const getApplicationButtonConfig = () => {
    // If user is the president of this club
    if (user && club && club.president?.id === user.id) {
      return {
        text: 'Club President',
        disabled: false,
        className: 'px-8 py-4 text-lg rounded-xl bg-gradient-to-r from-neon-purple to-pink-500 border-2 border-neon-purple/50 text-white font-semibold cursor-pointer hover:shadow-lg hover:shadow-neon-purple/50 transition-all',
        isPresident: true,
      };
    }

    if (!isAuthenticated) {
      return {
        text: 'Sign In to Apply',
        disabled: false,
        className: 'neon-button',
        isPresident: false,
      };
    }

    if (applicationStatusLoading) {
      return {
        text: 'Loading...',
        disabled: true,
        className: 'neon-button opacity-50',
        isPresident: false,
      };
    }

    if (applicationStatus?.exists) {
      const status = applicationStatus.application?.status;
      
      if (status === 'PENDING') {
        return {
          text: 'Application Pending',
          disabled: true,
          className: 'px-8 py-4 text-lg rounded-xl bg-yellow-500/20 border-2 border-yellow-500/50 text-yellow-400 cursor-not-allowed',
          isPresident: false,
        };
      } else if (status === 'APPROVED') {
        return {
          text: 'You are a Member',
          disabled: false,
          className: 'px-8 py-4 text-lg rounded-xl bg-green-500/20 border-2 border-green-500/50 text-green-400 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400 transition-colors cursor-pointer group',
          isPresident: false,
        };
      } else if (status === 'REJECTED') {
        return {
          text: 'Application Rejected',
          disabled: true,
          className: 'px-8 py-4 text-lg rounded-xl bg-red-500/20 border-2 border-red-500/50 text-red-400 cursor-not-allowed',
          isPresident: false,
        };
      }
    }

    return {
      text: 'Apply to Join',
      disabled: false,
      className: 'neon-button',
      isPresident: false,
    };
  };

  const buttonConfig = getApplicationButtonConfig();

  if (clubLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  if (clubError || !club) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 max-w-md w-full text-center"
        >
          <div className="text-red-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Club Not Found</h2>
          <p className="text-text-tertiary mb-6">The club you're looking for doesn't exist or may have been removed.</p>
          <button
            onClick={() => navigate('/')}
            className="neon-button px-6 py-2"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  const upcomingActivities = activities?.filter(
    activity => new Date(activity.startDate) > new Date() && activity.status === 'PUBLISHED'
  ) || [];

  const pastActivities = activities?.filter(
    activity => new Date(activity.startDate) <= new Date() && activity.status === 'PUBLISHED'
  ) || [];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="glass-card rounded-none border-b border-dark-600 sticky top-0 z-50 backdrop-blur-xl"
      >
        <div className="container mx-auto px-4 py-4">
          {/* Top Row - Logo and User Menu */}
          <div className="flex items-center justify-between mb-3">
            <motion.div
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate('/')}
              className="cursor-pointer"
            >
              <h1 className="text-2xl font-bold neon-text">TAU Community</h1>
            </motion.div>
            
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  {(user?.role === 'SUPER_ADMIN' || user?.role === 'CLUB_PRESIDENT') && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate('/dashboard')}
                      className="px-4 py-2 text-sm rounded-lg glass-card-hover text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Dashboard
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/')}
                    className="px-4 py-2 text-sm rounded-lg glass-card-hover text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Home
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/signup')}
                    className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Sign Up
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/login')}
                    className="neon-button px-4 py-2 text-sm"
                  >
                    Sign In
                  </motion.button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative bg-gradient-to-br from-neon-blue/20 via-dark-900 to-neon-purple/20 py-16"
      >
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2">
              <motion.h1
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-5xl font-bold mb-4 neon-text"
              >
                {club.name}
              </motion.h1>
              <motion.p
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-xl text-text-secondary mb-6"
              >
                {club.description}
              </motion.p>
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex gap-3 flex-wrap"
              >
                <span className="px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
                  Active Club
                </span>
                <span className="px-4 py-2 bg-dark-800/50 border border-dark-600 rounded-lg text-text-secondary text-sm">
                  {upcomingActivities.length} Upcoming Events
                </span>
              </motion.div>
            </div>
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center md:text-right"
            >
              <button
                onClick={handleApplyClick}
                disabled={buttonConfig.disabled}
                title={applicationStatus?.exists && applicationStatus.application?.status === 'APPROVED' ? 'Click to leave this club' : ''}
                className={`${buttonConfig.className} px-8 py-4 text-lg mb-3 w-full md:w-auto relative`}
              >
                {applicationStatus?.exists && applicationStatus.application?.status === 'APPROVED' ? (
                  <>
                    <span className="group-hover:hidden">{buttonConfig.text}</span>
                    <span className="hidden group-hover:inline">Leave Club</span>
                  </>
                ) : (
                  buttonConfig.text
                )}
              </button>
              <p className="text-text-tertiary text-sm">
                {applicationStatus?.exists && applicationStatus.application?.status === 'APPROVED'
                  ? 'Welcome to the club!'
                  : applicationStatus?.exists && applicationStatus.application?.status === 'PENDING'
                  ? 'Your application is under review'
                  : isAuthenticated 
                  ? 'Join our community of students'
                  : 'Sign in to join our community'
                }
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Activities Section */}
          <div className="lg:col-span-2 space-y-8">
            {/* Upcoming Activities */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <svg className="w-6 h-6 text-neon-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h2 className="text-2xl font-bold text-text-primary">Upcoming Activities</h2>
              </div>
              
              {activitiesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-blue"></div>
                </div>
              ) : upcomingActivities.length === 0 ? (
                <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
                  <p className="text-blue-400 text-sm">No upcoming activities scheduled. Check back soon for new events!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingActivities.map((activity, index) => {
                    // Get registration status from centralized state
                    const isRegistered = activityRegistrations[activity.id] || false;
                    const participantsCount = activityParticipants[activity.id] || 0;
                    const isRegistering = registeringActivities[activity.id] || false;
                    
                    // Check if user is a member of this club OR is the president
                    const isPresident = user && club.president?.id === user.id;
                    const isClubMember = isPresident || (applicationStatus?.exists && applicationStatus.application?.status === 'APPROVED');

                    const handleRegisterToggle = async () => {
                      if (!isAuthenticated) {
                        navigate('/login');
                        return;
                      }
                      
                      if (!isClubMember) {
                        toast.error('You must be a member of this club to register for activities');
                        return;
                      }

                      setRegisteringActivities(prev => ({ ...prev, [activity.id]: true }));
                      try {
                        if (isRegistered) {
                          await activityService.unregisterFromActivity(activity.id);
                          setActivityRegistrations(prev => ({ ...prev, [activity.id]: false }));
                          setActivityParticipants(prev => ({ ...prev, [activity.id]: (prev[activity.id] || 1) - 1 }));
                          toast.success('Successfully unregistered from activity');
                        } else {
                          await activityService.registerForActivity(activity.id);
                          setActivityRegistrations(prev => ({ ...prev, [activity.id]: true }));
                          setActivityParticipants(prev => ({ ...prev, [activity.id]: (prev[activity.id] || 0) + 1 }));
                          toast.success('Successfully registered for activity!');
                        }
                      } catch (error: any) {
                        const errorCode = error.response?.data?.error?.code;
                        if (errorCode === 'ACTIVITY_FULL') {
                          toast.error('This activity is full');
                        } else if (errorCode === 'ALREADY_REGISTERED') {
                          toast.error('You are already registered');
                        } else if (errorCode === 'NOT_CLUB_MEMBER') {
                          toast.error('You must be a member of this club to register for activities');
                        } else {
                          toast.error('Failed to register. Please try again.');
                        }
                      } finally {
                        setRegisteringActivities(prev => ({ ...prev, [activity.id]: false }));
                      }
                    };

                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 + index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                        className="bg-dark-800/50 border border-dark-600 rounded-lg p-4 hover:border-neon-blue/50 transition-all"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-semibold text-text-primary">{activity.title}</h3>
                          {isAuthenticated && isClubMember && (
                            <button
                              onClick={handleRegisterToggle}
                              disabled={isRegistering}
                              title={isRegistered ? 'Click to unregister from this activity' : 'Click to register for this activity'}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all group relative ${
                                isRegistered
                                  ? 'bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400'
                                  : 'bg-neon-blue/20 border border-neon-blue/50 text-neon-blue hover:bg-neon-blue/30'
                              }`}
                            >
                              <span className={isRegistered ? 'group-hover:hidden' : ''}>
                                {isRegistering ? 'Loading...' : isRegistered ? 'Registered' : 'Register'}
                              </span>
                              {isRegistered && !isRegistering && (
                                <span className="hidden group-hover:inline">
                                  Unregister
                                </span>
                              )}
                            </button>
                          )}
                          {isAuthenticated && !isClubMember && (
                            <div className="px-4 py-2 rounded-lg text-sm bg-gray-500/20 border border-gray-500/50 text-text-tertiary cursor-not-allowed">
                              Members Only
                            </div>
                          )}
                        </div>
                        <p className="text-text-tertiary text-sm mb-4">{activity.description}</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-text-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {new Date(activity.startDate).toLocaleDateString()} at{' '}
                            {new Date(activity.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {new Date(activity.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="flex items-center gap-2 text-text-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {activity.location}
                          </div>
                          <div className="flex items-center gap-2 text-text-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {participantsCount} registered
                            {activity.maxParticipants && ` / ${activity.maxParticipants} max`}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Past Activities */}
            {pastActivities.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="glass-card p-6"
              >
                <h2 className="text-2xl font-bold text-text-primary mb-6">Past Activities</h2>
                <div className="space-y-3">
                  {pastActivities.slice(0, 5).map((activity, index) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 bg-dark-800/30 rounded-lg"
                    >
                      <svg className="w-5 h-5 text-text-tertiary mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-text-primary font-medium">{activity.title}</h4>
                        <p className="text-text-tertiary text-sm">
                          {new Date(activity.startDate).toLocaleDateString()} {'\u2022'} {activity.location}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {pastActivities.length > 5 && (
                  <p className="text-text-tertiary text-sm text-center mt-4">
                    And {pastActivities.length - 5} more past activities...
                  </p>
                )}
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Club Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="glass-card p-6"
            >
              <h3 className="text-xl font-bold text-text-primary mb-4">Club Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-text-tertiary text-sm mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-lg text-sm ${
                    club.isActive 
                      ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                      : 'bg-gray-500/20 border border-gray-500/50 text-text-tertiary'
                  }`}>
                    {club.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div>
                  <p className="text-text-tertiary text-sm mb-1">Established</p>
                  <p className="text-text-primary">{new Date(club.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-text-tertiary text-sm mb-1">Total Activities</p>
                  <p className="text-text-primary">
                    {activities?.filter((a: any) => a.status === 'PUBLISHED').length || 0} activities organized
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Contact Info */}
            {club.president && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="glass-card p-6"
              >
                <h3 className="text-xl font-bold text-text-primary mb-4">Club President</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="text-text-primary">
                      {club.president.firstName} {club.president.lastName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="text-text-primary">{club.president.email}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Apply CTA */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 }}
              className="glass-card p-6 text-center"
            >
              <h3 className="text-xl font-bold text-text-primary mb-2">
                {applicationStatus?.exists && applicationStatus.application?.status === 'APPROVED'
                  ? 'You are a Member!'
                  : 'Interested in Joining?'
                }
              </h3>
              <p className="text-text-tertiary text-sm mb-4">
                {applicationStatus?.exists && applicationStatus.application?.status === 'APPROVED'
                  ? 'You are part of this amazing community!'
                  : applicationStatus?.exists && applicationStatus.application?.status === 'PENDING'
                  ? 'Your application is being reviewed by the club president.'
                  : isAuthenticated 
                  ? 'Submit your application and become part of our community!'
                  : 'Sign in to submit your application and become part of our community!'
                }
              </p>
              <button
                onClick={handleApplyClick}
                disabled={buttonConfig.disabled}
                title={applicationStatus?.exists && applicationStatus.application?.status === 'APPROVED' ? 'Click to leave this club' : ''}
                className={`${buttonConfig.className} w-full py-3 relative`}
              >
                  {applicationStatus?.exists && applicationStatus.application?.status === 'APPROVED' ? (
                    <>
                      <span className="group-hover:hidden">{buttonConfig.text}</span>
                      <span className="hidden group-hover:inline">Leave Club</span>
                    </>
                  ) : (
                  buttonConfig.text
                )}
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Application Dialog */}
      {applicationDialogOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-3xl font-bold text-text-primary mb-4">Apply to Join {club.name}</h2>
            <p className="text-text-tertiary mb-6">
              Tell us why you want to join {club.name}. The club president will review your application and get back to you.
            </p>
            
            {user && (
              <div className="bg-dark-800/50 border border-dark-600 rounded-lg p-4 mb-6">
                <p className="text-sm font-semibold text-text-secondary mb-2">Application Details:</p>
                <p className="text-sm text-text-tertiary">
                  <strong>Name:</strong> {user.firstName} {user.lastName}
                </p>
                <p className="text-sm text-text-tertiary">
                  <strong>Email:</strong> {user.email}
                </p>
              </div>
            )}
            
            <form onSubmit={handleSubmit(handleSubmitApplication)} className="space-y-4">
              <Controller
                name="motivation"
                control={control}
                rules={{
                  required: 'Please tell us why you want to join this club',
                  minLength: {
                    value: 50,
                    message: 'Please write at least 50 characters',
                  },
                  maxLength: {
                    value: 1000,
                    message: 'Maximum 1000 characters allowed',
                  },
                }}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Why do you want to join this club?
                    </label>
                    <textarea
                      {...field}
                      rows={6}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600 rounded-lg text-text-primary placeholder-gray-500 focus:outline-none focus:border-neon-blue transition-colors resize-none"
                      placeholder="Tell us about your interests, what you hope to gain from joining, and how you can contribute to the club..."
                    />
                    <div className="flex justify-between mt-1">
                      {errors.motivation && (
                        <p className="text-red-400 text-xs">{errors.motivation.message}</p>
                      )}
                      <p className="text-text-tertiary text-xs ml-auto">{field.value.length}/1000 characters</p>
                    </div>
                  </div>
                )}
              />
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setApplicationDialogOpen(false)}
                  className="flex-1 px-6 py-3 bg-dark-800 border border-dark-600 rounded-lg text-text-primary hover:bg-dark-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitApplicationMutation.isPending}
                  className="flex-1 neon-button py-3"
                >
                  {submitApplicationMutation.isPending ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Submitting...
                    </div>
                  ) : (
                    'Submit Application'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Leave Club Confirmation Dialog */}
      {leaveClubDialogOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 max-w-md w-full"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">Leave {club.name}?</h2>
              <p className="text-text-tertiary">
                Are you sure you want to leave this club? You will need to reapply if you want to join again.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setLeaveClubDialogOpen(false)}
                disabled={leaveClubMutation.isPending}
                className="flex-1 px-6 py-3 bg-dark-800 border border-dark-600 rounded-lg text-text-primary hover:bg-dark-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveClub}
                disabled={leaveClubMutation.isPending}
                className="flex-1 px-6 py-3 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                {leaveClubMutation.isPending ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Leaving...
                  </div>
                ) : (
                  'Leave Club'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ClubPage;

