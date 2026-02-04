import React, { useState } from 'react';
import { X, Trash2, ShieldAlert, Loader2, Lock, AlertTriangle } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, deleteDoc, collection, getDocs, writeBatch, query } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

const DeleteSchoolModal = ({ school, onClose, onSuccess }) => {
    const [step, setStep] = useState(1); // 1: Initial Warning, 2: Password, 3: ID Confirmation
    const [password, setPassword] = useState('');
    const [confirmId, setConfirmId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleReauthenticate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const user = auth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            setStep(3);
        } catch (err) {
            console.error("Re-auth failed:", err);
            setError("Invalid password. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (confirmId !== `DELETE ${school.id}`) {
            setError(`Please type "DELETE ${school.id}" exactly.`);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Function to delete all documents in a collection and their global entries if needed
            const deleteCollection = async (collectionPath, isUserCollection = false) => {
                const colRef = collection(db, collectionPath);
                const colSnap = await getDocs(colRef);
                const batches = [];
                let currentBatch = writeBatch(db);
                let count = 0;

                for (const docSnap of colSnap.docs) {
                    if (isUserCollection) {
                        currentBatch.delete(doc(db, "global_users", docSnap.id));
                    }
                    currentBatch.delete(docSnap.ref);
                    count++;

                    if (count === 450) { // Batch limit is 500, being safe
                        batches.push(currentBatch.commit());
                        currentBatch = writeBatch(db);
                        count = 0;
                    }
                }
                if (count > 0) batches.push(currentBatch.commit());
                await Promise.all(batches);
            };

            // Recursively delete all relevant subcollections (one level deep)
            await deleteCollection(`schools/${school.id}/users`, true);
            await deleteCollection(`schools/${school.id}/students`);
            await deleteCollection(`schools/${school.id}/teachers`);
            await deleteCollection(`schools/${school.id}/classes`);
            await deleteCollection(`schools/${school.id}/parents`);

            // Delete the school document itself
            await deleteDoc(doc(db, "schools", school.id));

            alert(`Deleted! All data for ${school.name} has been removed.`);
            onSuccess();
        } catch (err) {
            console.error("Deletion error:", err);
            setError("Failed to delete all data: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem'
        }}>
            <div className="card glass animate-in zoom-in duration-300" style={{
                width: '100%',
                maxWidth: '450px',
                padding: '2.5rem',
                position: 'relative',
                border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    <X size={24} />
                </button>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        color: '#f87171'
                    }}>
                        <ShieldAlert size={32} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>Dangerous Action</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        Deleting <strong style={{ color: 'white' }}>{school.name}</strong>
                    </p>
                </div>

                {error && (
                    <div style={{
                        padding: '0.75rem',
                        borderRadius: '12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#f87171',
                        fontSize: '0.8rem',
                        marginBottom: '1.5rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                {step === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                            <p style={{ fontSize: '0.85rem', color: '#fbbf24', lineHeight: '1.5', display: 'flex', gap: '0.5rem' }}>
                                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                                This will permanently remove all students, teachers, results, and settings for this school. This action cannot be undone.
                            </p>
                        </div>
                        <button
                            onClick={() => setStep(2)}
                            className="btn"
                            style={{
                                background: '#dc2626',
                                color: 'white',
                                width: '100%',
                                justifyContent: 'center',
                                padding: '1rem',
                                fontWeight: '700'
                            }}
                        >
                            I Understand, Proceed
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <form onSubmit={handleReauthenticate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="input-group">
                            <label className="label" style={{ color: 'white' }}>Verify Super Admin Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    type="password"
                                    className="input-field"
                                    style={{ paddingLeft: '3rem' }}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn"
                            style={{ background: 'white', color: 'black', width: '100%', justifyContent: 'center' }}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : "Verify Identity"}
                        </button>
                    </form>
                )}

                {step === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="input-group">
                            <label className="label" style={{ color: 'white' }}>
                                Type <span style={{ color: '#f87171' }}>DELETE {school.id}</span> to confirm
                            </label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder={`DELETE ${school.id}`}
                                value={confirmId}
                                onChange={(e) => setConfirmId(e.target.value)}
                                style={{ borderColor: confirmId === `DELETE ${school.id}` ? '#34d399' : 'rgba(239, 68, 68, 0.4)' }}
                                autoFocus
                            />
                        </div>
                        <button
                            onClick={handleDelete}
                            disabled={loading || confirmId !== `DELETE ${school.id}`}
                            className="btn"
                            style={{
                                background: confirmId === `DELETE ${school.id}` ? '#dc2626' : 'rgba(255,255,255,0.05)',
                                color: 'white',
                                width: '100%',
                                justifyContent: 'center',
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : "PERMANENTLY DELETE SCHOOL"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeleteSchoolModal;
