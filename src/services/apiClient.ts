import axios, { AxiosInstance, AxiosError } from 'axios';
import { CandidateProfile, Panelist, FinalReport, ApiError } from '../types';
import { API_ENDPOINTS, CONFIG, ERROR_MESSAGES } from '../constants';

class ApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: '', // Uses proxy configured in vite.config.ts
            timeout: CONFIG.REQUEST_TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error: AxiosError<ApiError>) => {
                return Promise.reject(this.transformError(error));
            }
        );
    }

    /**
     * Transform axios error to ApiError
     */
    private transformError(error: AxiosError<ApiError>): ApiError {
        if (error.response) {
            // Server responded with error
            return {
                error: error.response.data?.error || 'Server Error',
                message: error.response.data?.message || ERROR_MESSAGES.SERVER_ERROR,
                details: error.response.data?.details,
            };
        } else if (error.request) {
            // Request made but no response
            return {
                error: 'Network Error',
                message: ERROR_MESSAGES.NETWORK_ERROR,
            };
        } else {
            // Something else happened
            return {
                error: 'Unknown Error',
                message: error.message || 'An unexpected error occurred',
            };
        }
    }

    /**
     * Retry wrapper with exponential backoff
     */
    private async retryWithBackoff<T>(
        operation: () => Promise<T>,
        retries = CONFIG.RETRY_ATTEMPTS
    ): Promise<T> {
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                const isLastAttempt = attempt === retries - 1;

                // Don't retry on client errors (4xx)
                if (error.error && error.error.includes('Error') && !error.error.includes('Network')) {
                    throw error;
                }

                if (isLastAttempt) {
                    throw error;
                }

                // Exponential backoff
                const delay = CONFIG.RETRY_DELAY * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw new Error('Max retries exceeded');
    }

    /**
     * Parse resume from file
     */
    async parseResume(file: File, targetRole: string): Promise<CandidateProfile> {
        return this.retryWithBackoff(async () => {
            const formData = new FormData();
            formData.append('resume', file);
            formData.append('targetRole', targetRole);

            const response = await this.client.post<CandidateProfile>(
                API_ENDPOINTS.PARSE_RESUME,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                    timeout: 60000, // 60 seconds for file upload
                }
            );

            return response.data;
        });
    }

    /**
     * Generate interviewer panelists
     */
    async generatePanelists(targetRole: string, resumeText: string): Promise<Panelist[]> {
        return this.retryWithBackoff(async () => {
            const response = await this.client.post<Panelist[]>(
                API_ENDPOINTS.GENERATE_PANELISTS,
                { targetRole, resumeText }
            );

            return response.data;
        });
    }

    /**
     * Generate final evaluation report
     */
    async generateReport(candidate: CandidateProfile, transcript: string): Promise<FinalReport> {
        return this.retryWithBackoff(async () => {
            const response = await this.client.post<FinalReport>(
                API_ENDPOINTS.GENERATE_REPORT,
                { candidate, transcript }
            );

            return response.data;
        });
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        const response = await this.client.get(API_ENDPOINTS.HEALTH);
        return response.data;
    }
}

export const apiClient = new ApiClient();
