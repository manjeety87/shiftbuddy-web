import { getMyJobs, useJobsChanged } from './jobs';
import { useFetch } from './useFetch';

/** The user's jobs, kept fresh — a job added from a picker's "Add job" shows up when the sheet closes. */
export const useMyJobs = () => {
    const query = useFetch(getMyJobs);
    useJobsChanged(query.refetch);
    return query;
};
