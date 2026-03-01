export const calculateTrialDays = (trialStartDate) => {
    if (!trialStartDate) return {
        notStarted: true,
        daysLeft: 14,
        isExpired: false,
        startDateFormatted: '--',
        endDateFormatted: '--'
    };

    // Handle Firestore Timestamp or Date object
    const start = trialStartDate.toDate ? trialStartDate.toDate() : new Date(trialStartDate);

    // Add 14 days to the start date
    const end = new Date(start);
    end.setDate(end.getDate() + 14);

    const now = new Date();
    const diffTime = end.getTime() - now.getTime();

    // Calculate days left, Math.ceil to include partial days remaining
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isExpired = daysLeft <= 0;

    return {
        notStarted: false,
        daysLeft: isExpired ? 0 : daysLeft,
        isExpired,
        startDateFormatted: start.toLocaleDateString(),
        endDateFormatted: end.toLocaleDateString()
    };
};
