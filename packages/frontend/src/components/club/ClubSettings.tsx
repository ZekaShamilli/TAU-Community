import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Club } from '../../types';
import { clubService } from '../../services/clubService';

interface ClubSettingsProps {
  club: Club;
}

function compressImage(file: File, maxWidth = 400, maxHeight = 400, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ClubSettings: React.FC<ClubSettingsProps> = ({ club }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(club.logoUrl || null);
  const [pendingLogo, setPendingLogo] = useState<string | null | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);

  const logoMutation = useMutation({
    mutationFn: (logoUrl: string | null) => clubService.uploadClubLogo(club.id, logoUrl),
    onSuccess: () => {
      toast.success('Club logo updated!');
      queryClient.invalidateQueries({ queryKey: ['club', club.id] });
      queryClient.invalidateQueries({ queryKey: ['club-by-slug'] });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      setPendingLogo(undefined);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Failed to update logo';
      toast.error(msg);
    },
  });

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }
    try {
      const compressed = await compressImage(file);
      setPreviewUrl(compressed);
      setPendingLogo(compressed);
    } catch {
      toast.error('Failed to process image');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemoveLogo = () => {
    setPreviewUrl(null);
    setPendingLogo(null);
  };

  const handleDiscard = () => {
    setPreviewUrl(club.logoUrl || null);
    setPendingLogo(undefined);
  };

  const handleSave = () => {
    if (pendingLogo === undefined) return;
    logoMutation.mutate(pendingLogo);
  };

  const hasPendingChanges = pendingLogo !== undefined;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8"
      >
        <h2 className="text-2xl font-bold neon-text mb-6">Club Settings</h2>

        <div className="space-y-8">
          {/* Club Logo Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              Club Logo
            </label>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Preview */}
              <div className="flex-shrink-0">
                <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-white/10 bg-white/5 flex items-center justify-center relative group">
                  {previewUrl ? (
                    <>
                      <img
                        src={previewUrl}
                        alt="Club logo"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          title="Change photo"
                          className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                        >
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={handleRemoveLogo}
                          title="Remove photo"
                          className="p-1.5 rounded-lg bg-red-500/30 hover:bg-red-500/50 transition-colors"
                        >
                          <svg className="w-4 h-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-4xl font-bold text-white/30 select-none">
                        {club.name[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload area */}
              <div className="flex-1 min-w-0">
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-neon-blue bg-neon-blue/10'
                      : 'border-white/20 hover:border-white/40 bg-white/3 hover:bg-white/5'
                  }`}
                >
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-400">
                    <span className="text-neon-blue font-medium">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {hasPendingChanges && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 mt-3"
                  >
                    <button
                      onClick={handleSave}
                      disabled={logoMutation.isPending}
                      className="neon-button px-5 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {logoMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Saving...
                        </span>
                      ) : 'Save Logo'}
                    </button>
                    <button
                      onClick={handleDiscard}
                      disabled={logoMutation.isPending}
                      className="px-5 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
                    >
                      Discard
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Club Name */}
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
              <span className="text-yellow-400">ℹ️</span> Name, description, and other settings can only be changed by a system administrator.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ClubSettings;
