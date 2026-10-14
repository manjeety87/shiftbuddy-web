import type { CreateJobInput, Job, UpdateJobInput } from '../interfaces/job.d';
import { api } from './api';
import { createChangeSignal } from './changeSignal';
import { emitShiftsChanged } from './shiftEvents';

const jobsChanged = createChangeSignal();

/** Runs `onChange` whenever a job is created, edited or deleted. */
export const useJobsChanged = jobsChanged.useChanged;

export const getMyJobs = async (): Promise<Job[]> => {
    const { data } = await api.get<{ data: Job[] }>('/jobs');
    return data.data;
};

export const createJob = async (input: CreateJobInput): Promise<Job> => {
    const { data } = await api.post<{ data: Job }>('/jobs', input);
    jobsChanged.emit();
    return data.data;
};

export const updateJob = async (jobId: string, input: UpdateJobInput): Promise<Job> => {
    const { data } = await api.patch<{ data: Job }>(`/jobs/${jobId}`, input);
    jobsChanged.emit();
    return data.data;
};

export const deleteJob = async (jobId: string): Promise<void> => {
    await api.delete(`/jobs/${jobId}`);
    jobsChanged.emit();
    emitShiftsChanged(); // the backend removes the job's upcoming shifts with it
};

export const getJobById = async (jobId: string): Promise<Job> => {
    const { data } = await api.get<{ data: Job }>(`/jobs/${jobId}`);
    return data.data;
};