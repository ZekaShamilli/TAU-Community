import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'az';

  const toggleLanguage = () => {
    const newLang = currentLanguage === 'en' ? 'az' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <motion.button
      whileHover={{ y: -1, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={toggleLanguage}
      className="surface-button"
      title={currentLanguage === 'en' ? t('common.switchToAzerbaijani') : t('common.switchToEnglish')}
    >
      <span className="theme-icon text-sm">🌐</span>
      <span className="hidden sm:inline">{currentLanguage === 'en' ? 'AZ' : 'EN'}</span>
    </motion.button>
  );
};

export default LanguageSwitcher;
