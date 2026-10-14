export type PayFrequency = 'WEEKLY' | 'BIWEEKLY';

export interface Job {
  id: string;
  title: string;
  companyName: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  color: string;
  matchKeywords: string | null;
  hourlyRate: number | null;
  payFrequency: PayFrequency;
  payday: string | null; // any one payday, "YYYY-MM-DD"
  isActive: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobInput {
  title: string;
  companyName: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  color?: string;
  matchKeywords?: string;
  hourlyRate?: number;
  payFrequency?: PayFrequency;
  payday?: string;
}

export type UpdateJobInput = Partial<Omit<CreateJobInput, 'location' | 'latitude' | 'longitude' | 'matchKeywords' | 'hourlyRate' | 'payday'>> & {
  // null clears the field
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  matchKeywords?: string | null;
  hourlyRate?: number | null;
  payday?: string | null;
};