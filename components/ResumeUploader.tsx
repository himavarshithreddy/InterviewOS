import React, { useState } from 'react';
import { apiClient } from '@/src/services/apiClient';
import { CandidateProfile, ApiError } from '@/types';
import { CONFIG, ERROR_MESSAGES } from '@/src/constants';

interface Props {
  onUploadComplete: (profile: CandidateProfile) => void;
}

export const ResumeUploader: React.FC<Props> = ({ onUploadComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      return ERROR_MESSAGES.FILE_TOO_LARGE;
    }

    // Check file type
    const isValidType = CONFIG.ACCEPTED_MIME_TYPES.includes(file.type) ||
      CONFIG.ACCEPTED_FILE_TYPES.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isValidType) {
      return ERROR_MESSAGES.INVALID_FILE_TYPE;
    }

    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError(ERROR_MESSAGES.NO_FILE);
      return;
    }

    if (!targetRole.trim()) {
      setError(ERROR_MESSAGES.NO_TARGET_ROLE);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profile = await apiClient.parseResume(selectedFile, targetRole.trim());
      onUploadComplete(profile);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || ERROR_MESSAGES.PARSE_FAILED);
      console.error('Resume parsing error:', apiError);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedFile && targetRole.trim()) {
      handleUpload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl p-8 max-w-md w-full border border-slate-700">
        <h2 className="text-3xl font-bold mb-2 text-slate-100">Upload Your Resume</h2>
        <p className="text-slate-400 mb-6">Let's get started with your AI interview</p>

        <div className="space-y-4">
          {/* Target Role Input */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              Target Job Role *
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., Senior Frontend Engineer"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              Resume File *
            </label>
            <div className="relative">
              <input
                type="file"
                onChange={handleFileSelect}
                accept={CONFIG.ACCEPTED_FILE_TYPES.join(',')}
                className="hidden"
                id="resume-upload"
                disabled={loading}
              />
              <label
                htmlFor="resume-upload"
                className={`flex items-center justify-center w-full px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${selectedFile
                    ? 'border-green-500 bg-green-500 bg-opacity-10'
                    : 'border-slate-600 hover:border-slate-500 bg-slate-700'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-center">
                  {selectedFile ? (
                    <>
                      <div className="text-green-400 mb-1">✓ {selectedFile.name}</div>
                      <div className="text-xs text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-slate-300 mb-1">Choose a file</div>
                      <div className="text-xs text-slate-400">
                        PDF, DOC, or DOCX (max 10MB)
                      </div>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900 bg-opacity-20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={loading || !selectedFile || !targetRole.trim()}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${loading || !selectedFile || !targetRole.trim()
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
              }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing Resume...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-4 text-center">
          Your resume will be analyzed by AI to create a personalized interview panel
        </p>
      </div>
    </div>
  );
};
