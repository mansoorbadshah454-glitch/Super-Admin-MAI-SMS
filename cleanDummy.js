import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, query, limit } from "firebase/firestore";

// Using the same config as firebase.js
const firebaseConfig = {
    apiKey: "AIzaSyARAU5c_8nJd4KcVWsAVBDV529nObmW9Vs",
    authDomain: "mai-sms-a8dad.firebaseapp.com",
    projectId: "mai-sms-a8dad",
    storageBucket: "mai-sms-a8dad.firebasestorage.app",
    messagingSenderId: "550173587112",
    appId: "1:550173587112:web:d4bff4b8796cc8cb00349d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const cleanDummies = async () => {
    try {
        const schoolsCol = collection(db, 'schools');
        
        let deletedCount = 0;
        let batchCount = 0;
        
        // Loop to make sure we get all of them if there are more than 100
        while (true) {
            const existingDummyDocs = await getDocs(query(schoolsCol, limit(500)));
            const deletePromises = [];
            
            existingDummyDocs.forEach(doc => {
                const data = doc.data();
                // Check if it's a dummy school either by name or id pattern from previous code
                if (data.name?.startsWith('Dummy School') || (doc.id.length > 15 && !doc.id.startsWith('SCHOOL_'))) {
                    deletePromises.push(deleteDoc(doc.ref));
                }
            });
            
            if (deletePromises.length === 0) break;
            
            await Promise.all(deletePromises);
            deletedCount += deletePromises.length;
            batchCount++;
            console.log(`Batch ${batchCount}: Deleted ${deletePromises.length} old dummy schools.`);
        }

        console.log(`Successfully completely removed ${deletedCount} dummy schools from the database!`);
        process.exit(0);
    } catch (error) {
        console.error('Error deleting dummy schools:', error);
        process.exit(1);
    }
};

cleanDummies();
