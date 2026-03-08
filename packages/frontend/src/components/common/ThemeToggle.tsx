import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  // Temporarily hidden - keeping functionality for future use
  return null;
  
  /* Original code - commented out for now
  const { t } = useTranslation();
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <motion.button
      whileHover={{ y: -1, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={toggleMode}
      className="surface-button"
      title={isDark ? t('common.lightMode') : t('common.darkMode')}
      aria-label={isDark ? t('common.lightMode') : t('common.darkMode')}
    >
      <span className="theme-icon" aria-hidden>
        {isDark ? '☀️' : '🌙'}
      </span>
      <span className="hidden sm:inline">
        {isDark ? t('common.lightMode') : t('common.darkMode')}
      </span>
    </motion.button>
  );
  */
};

export default ThemeToggle;

