import React from 'react';
import { motion } from 'framer-motion';
import { Club } from '../../types';

interface ClubSettingsProps {
  club: Club;
}

const ClubSettings: React.FC<ClubSettingsProps> = ({ club }) => {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8"
      >
        <h2 className="text-2xl font-bold neon-text mb-6">Club Settings</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Club Name
            </label>
            <input
              type="text"
              value={club.name}
              disabled
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder-gray-500 focus:outline-none focus:border-neon-blue transition-colors disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={club.description}
              disabled
              rows={4}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder-gray-500 focus:outline-none focus:border-neon-blue transition-colors resize-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              URL Slug
            </label>
            <input
              type="text"
              value={club.urlSlug}
              disabled
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder-gray-500 focus:outline-none focus:border-neon-blue transition-colors disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Status
            </label>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                club.isActive
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
              }`}>
                {club.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <p className="text-sm text-gray-400">
              <span className="text-yellow-400">ℹ️</span> Settings editing is coming soon! Contact your system administrator to make changes.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ClubSettings;
