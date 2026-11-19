export const calculateTrialDays = (trialStartDate, durationDays = 7, trialEndDate = null, accountType = 'demo', isPermanent = false) => {
    if (isPermanent) {
        return {
            isPermanent: true,
            isOnboarded: false,
            notStarted: false,
            daysLeft: 9999,
            isExpired: false,
            startDateFormatted: 'Permanent',
            endDateFormatted: 'Never (Showcase)',
            label: 'Permanent Demo'
        };
    }

    if (accountType === 'onboarded') {
        return {
            isPermanent: false,
            isOnboarded: true,
            notStarted: false,
            daysLeft: 0,
            isExpired: false,
            startDateFormatted: '--',
            endDateFormatted: '--',
            label: 'Official'
        };
    }

    if (!trialStartDate && !trialEndDate) return {
        isPermanent: false,
        isOnboarded: false,
        notStarted: true,
        daysLeft: durationDays || 7,
        isExpired: false,
        startDateFormatted: '--',
        endDateFormatted: '--',
        label: 'Not Started'
    };

    // Handle Firestore Timestamp or Date object
    const now = new Date();
    let start = null;
    let end = null;

    if (trialEndDate) {
        end = trialEndDate.toDate ? trialEndDate.toDate() : new Date(trialEndDate);
        if (trialStartDate) {
            start = trialStartDate.toDate ? trialStartDate.toDate() : new Date(trialStartDate);
        } else {
            start = new Date(end);
            start.setDate(start.getDate() - (durationDays || 7));
        }
    } else {
        start = trialStartDate.toDate ? trialStartDate.toDate() : new Date(trialStartDate);
        end = new Date(start);
        end.setDate(end.getDate() + (Number(durationDays) || 7));
    }

    const diffTime = end.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isExpired = daysLeft <= 0;

    return {
        isOnboarded: false,
        notStarted: false,
        daysLeft: isExpired ? 0 : daysLeft,
        isExpired,
        startDateFormatted: start ? start.toLocaleDateString() : '--',
        endDateFormatted: end ? end.toLocaleDateString() : '--',
        label: isExpired ? 'Expired' : `${daysLeft}d Left`
    };
};
