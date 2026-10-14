// A job is known by where it is, not by the role: someone can be a "Sales Associate"
// at two stores, but "Fairweather" and "International Clothiers" are never confused.
// So the workplace is the name everywhere, and the role is the detail line.

interface NamedJob {
    title: string;
    companyName?: string | null;
}

/** What to call a job: its workplace ("Boathouse"), or the role when no workplace was entered. */
export const jobName = (job: NamedJob) => job.companyName?.trim() || job.title;

/** The role, shown under the name ("Retail Sales Supervisor") — empty when it would just repeat the name. */
export const jobRole = (job: NamedJob) => {
    const name = jobName(job);
    return job.title.trim().toLowerCase() === name.toLowerCase() ? '' : job.title;
};
