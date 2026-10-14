import { formatDuration } from './shiftTime';
import { showAlert } from './dialog';

/**
 * Before saving a shift shorter than the 3-hour minimum: extend it, keep it, or go back.
 * Resolves 'extend' | 'keep' | 'cancel'.
 */
export const confirmShortShift = (durationMinutes: number): Promise<'extend' | 'keep' | 'cancel'> =>
    new Promise((resolve) => {
        showAlert(
            `Only ${formatDuration(durationMinutes)} long`,
            "Under Ontario's 3-hour rule, if you usually work more than 3 hours a day you're generally paid for at least 3 hours. Make this shift 3 hours?",
            [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
                { text: 'Keep It', onPress: () => resolve('keep') },
                { text: 'Make It 3 Hours', onPress: () => resolve('extend') },
            ],
            { cancelable: true, onDismiss: () => resolve('cancel') }
        );
    });
