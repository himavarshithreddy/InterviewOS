import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '@/src/services/apiClient';
import { CandidateProfile, ApiError } from '@/types';
import { CONFIG, ERROR_MESSAGES } from '@/src/constants';
import { Upload, FileText, Briefcase, Code, GraduationCap, Award } from 'lucide-react';

interface Props {
  onUploadComplete: (profile: CandidateProfile) => void;
}

export const ResumeUploader: React.FC<Props> = ({ onUploadComplete }) => {
  const [error, setError] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState('');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Extreme'>('Medium');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedProfile, setParsedProfile] = useState<CandidateProfile | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      return ERROR_MESSAGES.FILE_TOO_LARGE;
    }
    const isValidType = (CONFIG.ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type) ||
      CONFIG.ACCEPTED_FILE_TYPES.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!isValidType) {
      return ERROR_MESSAGES.INVALID_FILE_TYPE;
    }
    return null;
  };

  const handleFile = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      setParsedProfile(null);
      setPreviewError(null);
      setError(null);
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      setParsedProfile(null);
      setPreviewError(null);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setParsedProfile(null);
    setPreviewError(null);
  };

  const handleParseResume = async () => {
    if (!selectedFile || !targetRole.trim()) return;

    setPreviewLoading(true);
    setPreviewError(null);
    setError(null);

    try {
      const profile = await apiClient.parseResume(selectedFile, targetRole.trim());
      if (profile.isResume === false) {
        setPreviewError(ERROR_MESSAGES.NOT_A_RESUME);
        setParsedProfile(null);
      } else {
        setParsedProfile(profile);
        setPreviewError(null);
      }
    } catch (err) {
      const apiError = err as ApiError;
      setPreviewError(apiError.message || ERROR_MESSAGES.PARSE_FAILED);
      setParsedProfile(null);
      console.error('Resume parsing error:', apiError);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFile(file ?? null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file ?? null);
  };

  const handleProceed = () => {
    if (!parsedProfile || parsedProfile.isResume === false) return;
    onUploadComplete({ ...parsedProfile, difficulty });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedFile && targetRole.trim() && !parsedProfile) {
      handleParseResume();
    }
  };

  const canParse = selectedFile && targetRole.trim() && !previewLoading;
  const canProceed = parsedProfile && parsedProfile.isResume !== false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-full px-6 pb-16"
      style={{ paddingTop: '1.5rem' }}
    >
      <div className="text-center mb-12">
        <h1 className="text-4xl font-semibold mb-4 text-foreground">
          Upload Your Resume
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-lg">
          Our AI will analyze your experience and tailor interview questions specifically for you.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-16 items-start w-full">
        <div
          className="flex flex-col gap-6 justify-center glass rounded-xl border py-6 px-6 md:px-8 w-full min-h-[420px] resume-upload-upload"
          style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
        >
          <div className="px-6 md:px-8">
            <div
              ref={dropzoneRef}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-xl px-8 py-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${isDragging ? 'scale-[1.02]' : ''
                }`}
              style={{
                backgroundColor: isDragging ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                minHeight: '140px',
                height: '140px'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept={CONFIG.ACCEPTED_FILE_TYPES.join(',')}
                className="hidden"
                disabled={previewLoading}
              />

              {selectedFile ? (
                <div className="flex flex-col items-center justify-center space-y-3 w-full min-w-0 px-2">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-center w-full min-w-0">
                    <p className="font-medium text-lg mb-1 text-foreground truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Click to change file
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-white/70" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-lg mb-1 text-foreground">
                      Drop your resume or click to upload
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PDF, DOC, or DOCX format (max 10MB)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 md:px-8 flex flex-col gap-4">
            <label htmlFor="target-role" className="block text-sm font-medium uppercase tracking-[0.2em] text-primary/80">
              Target Job Role <span className="text-destructive">*</span>
            </label>
            <input
              id="target-role"
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., Senior Frontend Engineer"
              className="w-full h-14 px-4 bg-transparent border border-border/50 rounded-xl text-base text-foreground placeholder-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 transition-all"
              disabled={previewLoading}
            />
          </div>

          <div className="px-6 md:px-8 flex flex-col gap-4">
            <label className="block text-sm font-medium uppercase tracking-[0.2em] text-primary/80">
              Interview Difficulty
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['Easy', 'Medium', 'Hard', 'Extreme'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all ${difficulty === level
                    ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                    : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-gray-200'
                    }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground px-1">
              {difficulty === 'Easy' && 'Friendly & guiding. Good for beginners.'}
              {difficulty === 'Medium' && 'Standard professional interview. Balanced.'}
              {difficulty === 'Hard' && 'Strict & probing. Expects detailed answers.'}
              {difficulty === 'Extreme' && 'Intimidating & zero fluff. Edge cases only.'}
            </p>
          </div>

          {error && (
            <div className="px-6 md:px-8">
              <div className="bg-destructive/10 rounded-xl p-4 text-destructive text-sm">
                {error}
              </div>
            </div>
          )}

          <div className="px-6 md:px-8 flex flex-col gap-5 pt-6">
            <button
              onClick={handleParseResume}
              disabled={!canParse}
              className={`w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl active:scale-[0.98] transition-all duration-200 h-14 rounded-xl px-8 text-lg font-medium cursor-pointer ${!canParse ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'pointer-events-auto'
                }`}
            >
              {previewLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Parsing...
                </>
              ) : (
                'Continue'
              )}
            </button>
            <button
              onClick={handleProceed}
              disabled={!canProceed}
              className={`w-full inline-flex items-center justify-center gap-2 bg-primary/80 text-primary-foreground shadow-lg hover:bg-primary/70 hover:shadow-xl active:scale-[0.98] transition-all duration-200 h-14 rounded-xl px-8 text-lg font-medium cursor-pointer border border-primary/50 ${!canProceed ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'pointer-events-auto'
                }`}
            >
              Proceed
            </button>
          </div>
        </div>

        {/* Preview Section */}
        <div className="glass rounded-xl border p-2 min-h-[420px] flex flex-col justify-center shadow-lg shadow-black/20 w-full resume-upload-preview overflow-hidden mb-12" style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}>
          {!selectedFile ? (
            <div className="flex flex-col items-center justify-center text-center flex-1">
              <div className="w-14 h-14 mb-6 rounded-xl bg-white/5 flex items-center justify-center">
                <FileText className="w-7 h-7 text-white/60" />
              </div>
              <p className="font-medium text-lg mb-1 text-foreground">Resume preview will appear here</p>
              <p className="text-sm text-muted-foreground">Upload a file and click Continue to see the parsed preview</p>
            </div>
          ) : selectedFile && !parsedProfile && !previewLoading && !previewError ? (
            <div className="flex flex-col items-center justify-center text-center flex-1">
              <div className="w-14 h-14 mb-6 rounded-xl bg-white/5 flex items-center justify-center">
                <FileText className="w-7 h-7 text-white/60" />
              </div>
              <p className="font-medium text-lg mb-1 text-foreground">Ready to parse</p>
              <p className="text-sm text-muted-foreground">Enter target role and click Continue to analyze with Gemini</p>
            </div>
          ) : previewLoading ? (
            <div className="flex flex-col items-center justify-center text-center flex-1">
              <svg className="animate-spin h-10 w-10 text-primary mb-6" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="font-medium text-lg mb-1 text-foreground">Decoding your story...</p>
              <p className="text-sm text-muted-foreground">AI is extracting your highlights</p>
            </div>
          ) : previewError ? (
            <div className="flex flex-col items-center justify-center text-center flex-1">
              <div className="w-14 h-14 mb-6 rounded-xl bg-destructive/10 flex items-center justify-center">
                <FileText className="w-7 h-7 text-destructive" />
              </div>
              <p className="font-medium text-lg mb-1 text-foreground">Preview unavailable</p>
              <p className="text-sm text-destructive">{previewError}</p>
            </div>
          ) : parsedProfile ? (
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-8 min-w-0 w-full break-words" style={{ padding: '2rem 1.5rem 1.5rem 2rem' }}>
                {/* Profile header card */}
                <div className="rounded-xl bg-white/[0.04] p-6 pl-8 min-w-0">
                  <h3 className="text-3xl text-gray-200 mb-2 break-words tracking-tight">
                    {parsedProfile.name || 'Unknown'}
                  </h3>
                  {parsedProfile.jobTitle && (
                    <p className="text-primary/90 text-base mb-4">{parsedProfile.jobTitle}</p>
                  )}
                  {parsedProfile.summary && (
                    <p className="text-gray-400 text-base leading-relaxed break-words">
                      {parsedProfile.summary}
                    </p>
                  )}
                </div>

                {/* Experience */}
                {(parsedProfile.experienceEntries?.length ?? 0) > 0 && (
                  <section className="min-w-0" style={{ marginTop: '1.5rem' }}>
                    <div className="flex items-center gap-2 mb-4 pl-2">
                      <Briefcase className="w-5 h-5 shrink-0 text-primary/70" />
                      <h4 className="text-sm uppercase tracking-widest text-primary/70">Work Experience</h4>
                    </div>
                    <div className="space-y-4">
                      {parsedProfile.experienceEntries!.map((entry, i) => (
                        <div key={i} className="rounded-lg bg-white/[0.03] p-5 pl-6">
                          <p className="text-gray-200 text-base break-words">{entry.title}</p>
                          <p className="text-sm text-gray-400 break-words mt-1.5">
                            {[entry.company, entry.dates].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Key achievements / highlights */}
                {parsedProfile.experience && parsedProfile.experience.filter((b) => b.trim()).length > 0 && (
                  <section className="min-w-0" style={{ marginTop: '1.5rem' }}>
                    <div className="flex items-center gap-2 mb-4 pl-2">
                      <Award className="w-5 h-5 shrink-0 text-primary/70" />
                      <h4 className="text-sm uppercase tracking-widest text-primary/70">Key Highlights</h4>
                    </div>
                    <ul className="space-y-3 pl-6">
                      {parsedProfile.experience.filter((b) => b.trim()).map((bullet, i) => (
                        <li key={i} className="text-base text-gray-400 leading-relaxed break-words">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Skills */}
                {parsedProfile.skills && parsedProfile.skills.length > 0 && (
                  <section className="min-w-0" style={{ marginTop: '1.5rem' }}>
                    <div className="flex items-center gap-2 mb-4 pl-2">
                      <Code className="w-5 h-5 shrink-0 text-primary/70" />
                      <h4 className="text-sm uppercase tracking-widest text-primary/70">Skills</h4>
                    </div>
                    <p className="text-base text-gray-400 leading-relaxed break-words pl-2">
                      {parsedProfile.skills.join(', ')}
                    </p>
                  </section>
                )}

                {/* Education */}
                {parsedProfile.education && parsedProfile.education.length > 0 && (
                  <section className="min-w-0" style={{ marginTop: '1.5rem' }}>
                    <div className="flex items-center gap-2 mb-4 pl-2">
                      <GraduationCap className="w-5 h-5 shrink-0 text-primary/70" />
                      <h4 className="text-sm uppercase tracking-widest text-primary/70">Education</h4>
                    </div>
                    <div className="space-y-3">
                      {parsedProfile.education.map((edu, i) => (
                        <p key={i} className="text-base text-gray-400 break-words pl-4">
                          {edu}
                        </p>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="mt-16 pt-4">
        <div className="w-full bg-background border-t border-border/80 px-4 py-4 rounded-b-3xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground/90">
          <div className="flex items-center gap-2">
            <div className="relative h-6 w-6 flex items-center justify-center rounded-md border border-border bg-background text-primary">
              <span className="text-xs font-bold">I</span>
            </div>
            <span className="font-semibold tracking-tight text-sm text-foreground">
              InterviewOS
            </span>
          </div>
          <p>© {new Date().getFullYear()} InterviewOS. Built with Gemini 3.</p>
        </div>
      </footer>
    </motion.div>
  );
};
