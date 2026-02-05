import React, { useState } from 'react';
import { parseResume } from '../services/geminiService';
import { CandidateProfile } from '../types';

interface Props {
  onUploadComplete: (profile: CandidateProfile) => void;
}

export const ResumeUploader: React.FC<Props> = ({ onUploadComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!targetRole.trim()) {
        setError('Please enter a target job role before uploading.');
        return;
    }

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        // Remove data URL prefix
        const base64Content = base64String.split(',')[1];
        
        const profile = await parseResume(base64Content);
        // Attach the target role to the profile
        onUploadComplete({ ...profile, targetRole });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setError('Failed to process resume. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-800 rounded-xl shadow-lg border border-slate-700 max-w-lg mx-auto mt-10">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Step 1: Setup Profile</h2>
        <p className="text-slate-400">Define the role you want and upload your resume.</p>
      </div>

      <div className="w-full mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">Target Job Role</label>
        <input 
            type="text" 
            value={targetRole}
            onChange={(e) => {
                setTargetRole(e.target.value);
                if(error) setError(null);
            }}
            placeholder="e.g. Senior Frontend Engineer, Product Manager"
            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div className="w-full">
        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${!targetRole ? 'border-slate-700 bg-slate-800/50 cursor-not-allowed' : 'border-slate-600 bg-slate-700 hover:bg-slate-600'}`}>
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-8 h-8 mb-4 text-slate-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
            </svg>
            <p className="mb-2 text-sm text-slate-400"><span className="font-semibold">Click to upload</span> (PDF)</p>
          </div>
          <input 
            type="file" 
            className="hidden" 
            accept=".pdf" 
            onChange={handleFileChange} 
            disabled={loading || !targetRole} 
          />
        </label>
      </div>

      {loading && (
        <div className="mt-4 flex items-center space-x-2 text-blue-400">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Analyzing Resume & Generating Personas...</span>
        </div>
      )}

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </div>
  );
};
