import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import ClubManagement from './ClubManagement';
import ApplicationManagement from './ApplicationManagement';
import ContentModeration from './ContentModeration';
import AuditLogViewer from './AuditLogViewer';
import SystemStats from './SystemStats';
import UserManagement from './UserManagement';
import LanguageSwitcher from '../common/LanguageSwitcher';
import ThemeToggle from '../common/ThemeToggle';

const SuperAdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const tabs = [
    { id: 0, name: t('dashboard.overview'), icon: '📊' },
    { id: 1, name: t('dashboard.clubManagement'), icon: '🏢' },
    { id: 2, name: t('dashboard.applications'), icon: '📝' },
    { id: 3, name: t('dashboard.userManagement'), icon: '👥' },
    { id: 4, name: t('dashboard.contentModeration'), icon: '🛡️' },
    { id: 5, name: t('dashboard.auditLogs'), icon: '📜' },
  ];

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
  };

  return (
    <div className="min-h-screen clean-shell">
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="soft-topbar"
      >
        <div className="mobile-container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎓</span>
            <div>
              <h1 className="text-xl font-bold neon-text">TAU Community</h1>
              <p className="text-xs text-text-tertiary">{t('dashboard.superAdmin')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LanguageSwitcher />
            <button onClick={() => navigate('/')} className="secondary-cta flex items-center gap-2 px-4 py-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="hidden md:block">{t('common.home')}</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-3 rounded-xl border border-white/20 bg-dark-800/70 px-4 py-2 hover:border-neon-blue/50"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-text-primary font-bold">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </div>
                <span className="text-text-primary text-sm hidden md:block">{user?.email}</span>
                <svg className={`w-4 h-4 text-text-tertiary transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-48 minimal-panel overflow-hidden"
                >
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="w-full px-4 py-3 text-left text-text-secondary hover:bg-dark-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t('common.settings')}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left text-red-400 hover:bg-dark-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {t('auth.logout')}
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      <div className="mobile-container py-6">
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className={`transition-all flex items-center gap-2 ${
                currentTab === tab.id
                  ? 'tab-chip-active'
                  : 'tab-chip'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              {tab.name}
            </motion.button>
          ))}
        </div>

        <motion.div
          key={currentTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {currentTab === 0 && <SystemStats />}
          {currentTab === 1 && <ClubManagement />}
          {currentTab === 2 && <ApplicationManagement />}
          {currentTab === 3 && <UserManagement />}
          {currentTab === 4 && <ContentModeration />}
          {currentTab === 5 && <AuditLogViewer />}
        </motion.div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;

