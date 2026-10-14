import { toast } from "sonner";

// Outcomes are toasts ("Shift copied", "Couldn't save"); questions that need an
// answer are dialogs (`showAlert`). Same helper as the mobile app, so wording,
// duration and the Undo pattern match.

interface NotifyOptions {
  description?: string;
  /** e.g. { label: 'Undo', onPress } — keeps the toast up a little longer */
  action?: { label: string; onPress: () => void };
}

const DURATION_MS = 3500;
const WITH_ACTION_MS = 6000; // time to notice and reach for Undo

const toSonner = ({ description, action }: NotifyOptions = {}) => ({
  description,
  duration: action ? WITH_ACTION_MS : DURATION_MS,
  action: action ? { label: action.label, onClick: action.onPress } : undefined,
});

export const notify = {
  success: (title: string, options?: NotifyOptions) => toast.success(title, toSonner(options)),
  error: (title: string, options?: NotifyOptions) => toast.error(title, toSonner(options)),
  info: (title: string, options?: NotifyOptions) => toast(title, toSonner(options)),
};
