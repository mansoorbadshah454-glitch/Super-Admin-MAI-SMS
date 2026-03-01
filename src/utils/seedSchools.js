import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, query, limit } from 'firebase/firestore';

const PREFIX = 'dummy_';

export const seedDummySchools = async () => {
    try {
        const schoolsCol = collection(db, 'schools');

        // Remove existing dummy schools to avoid duplicates
        const existingDummyDocs = await getDocs(query(schoolsCol, limit(100)));
        const deletePromises = [];
        existingDummyDocs.forEach(doc => {
            if (doc.data().name?.startsWith('Dummy School')) {
                deletePromises.push(deleteDoc(doc.ref));
            }
        });
        await Promise.all(deletePromises);
        console.log(`Deleted ${deletePromises.length} old dummy schools.`);

        const statuses = ['active', 'active', 'active', 'suspended', 'stop']; // 60% active, 40% suspended/stop
        const payments = ['paid', 'unpaid', 'paid']; // 66% paid
        const cities = ['New York', 'London', 'Berlin', 'Tokyo', 'Sydney', 'Paris', 'Dubai', 'Singapore'];

        const seedPromises = Array.from({ length: 50 }).map(async (_, index) => {
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            const randomPayment = payments[Math.floor(Math.random() * payments.length)];
            const randomCity = cities[Math.floor(Math.random() * cities.length)];

            // Create some past dates for trial simulation
            // 70% chance to be inside a trial (active or expired)
            const isTrial = Math.random() > 0.3;
            let trialStartDate = null;
            if (isTrial) {
                const msInDay = 24 * 60 * 60 * 1000;
                const daysAgo = Math.floor(Math.random() * 20); // 0 to 20 days ago
                trialStartDate = new Date(Date.now() - (daysAgo * msInDay));
            }

            return addDoc(schoolsCol, {
                name: `Dummy School ${index + 1} - ${randomCity}`,
                address: `${Math.floor(Math.random() * 9999)} Main St, ${randomCity}`,
                contact: `+1-555-${Math.floor(1000 + Math.random() * 9000)}`,
                status: randomStatus,
                paymentStatus: randomPayment,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                trialStartDate: trialStartDate || null,
                principalId: null, // Dummy data
            });
        });

        await Promise.all(seedPromises);
        console.log('Successfully seeded 50 dummy schools!');
        return true;
    } catch (error) {
        console.error('Error seeding dummy schools:', error);
        return false;
    }
};
