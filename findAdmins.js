import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

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

const findSuperAdmins = async () => {
    try {
        const usersCol = collection(db, 'global_users');
        const q = query(usersCol, where('role', 'in', ['super_admin', 'super-admin']));
        const snapshot = await getDocs(q);
        
        console.log(`Found ${snapshot.docs.length} super admins`);
        snapshot.forEach(doc => {
            console.log(doc.id, '=>', doc.data());
        });
        process.exit(0);
    } catch (error) {
        console.error('Error finding super admins:', error);
        process.exit(1);
    }
};

findSuperAdmins();
