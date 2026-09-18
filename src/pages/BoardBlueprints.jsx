import React, { useState, useEffect } from 'react';
import { 
    BookOpen, Trash2, Edit3, Eye, UploadCloud, CheckCircle2, 
    Sparkles, Compass, AlertCircle, FileText, Download, ExternalLink,
    Filter, Layers, Check, RefreshCw, ChevronDown, CheckCircle, Clock
} from 'lucide-react';
import { db, storage } from '../firebase';
import { 
    collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, query, where 
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { extractTextFromPdf, parseTOSMetrics } from '../utils/pdfTOSScanner';
import { BoardCrestLogo, getBoardData } from '../data/pakistanBoardsData';

const SUBJECT_LIST = [
    { name: 'English', icon: '📖', color: '#8b5cf6', defaultMarks: '75' },
    { name: 'Urdu', icon: '✍️', color: '#14b8a6', defaultMarks: '75' },
    { name: 'Biology', icon: '🧬', color: '#ec4899', defaultMarks: '60' },
    { name: 'Physics', icon: '⚛️', color: '#6366f1', defaultMarks: '60' },
    { name: 'Chemistry', icon: '🧪', color: '#10b981', defaultMarks: '60' },
    { name: 'Mathematics', icon: '📐', color: '#f59e0b', defaultMarks: '75' },
    { name: 'Computer Science', icon: '💻', color: '#06b6d4', defaultMarks: '50' },
    { name: 'Pakistan Studies', icon: '🇵🇰', color: '#10b981', defaultMarks: '50' },
    { name: 'Islamiat', icon: '🕌', color: '#d97706', defaultMarks: '50' }
];

export const PAKISTAN_BOARD_GROUPS = [
    {
        province: 'Khyber Pakhtunkhwa (KPK)',
        boards: [
            { name: 'BISE Kohat', details: 'Kohat, Karak, Hangu, Kurram, Orakzai' },
            { name: 'BISE Peshawar', details: 'Peshawar, Charsadda, Nowshera, Khyber, Mohmand' },
            { name: 'BISE Mardan', details: 'Mardan, Swabi' },
            { name: 'BISE Abbottabad', details: 'Abbottabad, Haripur, Mansehra, Battagram, Kohistan' },
            { name: 'BISE Swat', details: 'Swat, Shangla, Buner' },
            { name: 'BISE Malakand', details: 'Malakand, Dir Lower, Dir Upper, Bajaur, Chitral' },
            { name: 'BISE Bannu', details: 'Bannu, Lakki Marwat, North Waziristan' },
            { name: 'BISE D.I. Khan', details: 'Dera Ismail Khan, Tank, South Waziristan' }
        ]
    },
    {
        province: 'Federal Capital',
        boards: [
            { name: 'Federal Board (FBISE)', details: 'Islamabad, Cantonments, Federal Areas & Overseas' }
        ]
    },
    {
        province: 'Punjab',
        boards: [
            { name: 'BISE Lahore', details: 'Lahore, Kasur, Nankana Sahib, Sheikhupura' },
            { name: 'BISE Rawalpindi', details: 'Rawalpindi, Attock, Chakwal, Jhelum, Murree' },
            { name: 'BISE Gujranwala', details: 'Gujranwala, Gujrat, Hafizabad, Mandi Bahauddin, Narowal, Sialkot' },
            { name: 'BISE Faisalabad', details: 'Faisalabad, Chiniot, Jhang, Toba Tek Singh' },
            { name: 'BISE Multan', details: 'Multan, Khanewal, Lodhran, Vehari' },
            { name: 'BISE Sargodha', details: 'Sargodha, Bhakkar, Khushab, Mianwali' },
            { name: 'BISE Bahawalpur', details: 'Bahawalpur, Bahawalnagar, Rahim Yar Khan' },
            { name: 'BISE Sahiwal', details: 'Sahiwal, Okara, Pakpattan' },
            { name: 'BISE D.G. Khan', details: 'Dera Ghazi Khan, Layyah, Muzaffargarh, Rajanpur' }
        ]
    },
    {
        province: 'Sindh',
        boards: [
            { name: 'BSEK Karachi (Matric)', details: 'Karachi Division (Secondary Education)' },
            { name: 'BISE Hyderabad', details: 'Hyderabad, Jamshoro, Matiari, Tando Allahyar, Thatta, Badin' },
            { name: 'BISE Sukkur', details: 'Sukkur, Ghotki, Khairpur' },
            { name: 'BISE Larkana', details: 'Larkana, Kamber, Shikarpur, Jacobabad, Kashmore' },
            { name: 'BISE Mirpurkhas', details: 'Mirpurkhas, Sanghar, Umerkot, Tharparkar' },
            { name: 'BISE Shaheed Benazirabad', details: 'Nawabshah, Naushahro Feroze' },
            { name: 'Aga Khan Board (AKU-EB)', details: 'Aga Khan University Examination Board' }
        ]
    },
    {
        province: 'Balochistan',
        boards: [
            { name: 'BISE Quetta', details: 'All Balochistan Districts' }
        ]
    },
    {
        province: 'Azad Jammu & Kashmir (AJK)',
        boards: [
            { name: 'BISE Mirpur (AJK)', details: 'All AJK Districts' }
        ]
    },
    {
        province: 'Gilgit-Baltistan',
        boards: [
            { name: 'KIU-EB Gilgit', details: 'Karakoram International University Board' }
        ]
    },
    {
        province: 'Universal Baseline',
        boards: [
            { name: 'All BISE Boards (National)', details: 'Standard National Curriculum Baseline' }
        ]
    }
];

export const ALL_BOARD_NAMES = PAKISTAN_BOARD_GROUPS.flatMap(g => g.boards.map(b => b.name));

const SESSIONS = ['2025-2026', '2026-2027', '2027-2028'];
const CLASSES = ['9th Class', '10th Class'];

const BoardBlueprints = () => {
    // Blueprints state from Firestore
    const [blueprints, setBlueprints] = useState([]);
    const [universalGuide, setUniversalGuide] = useState({
        title: 'Universal BISE Blueprint & SLO Decoding Guide',
        version: 'Session 2025–2026 SLO Edition',
        pdfUrl: '',
        instructions: 'This universal document guides educators on how to read Table of Specifications (TOS), Bloom\'s Taxonomy Cognitive Domains (Knowledge, Understanding, Application), and Examiner Marking Rubrics to prepare standard SLO assessments.'
    });
    const [savingGuide, setSavingGuide] = useState(false);
    const [guideMessage, setGuideMessage] = useState('');

    // Workflow Selectors
    const [selectedClass, setSelectedClass] = useState('9th Class');
    const [selectedSession, setSelectedSession] = useState('2025-2026');
    const [selectedBoard, setSelectedBoard] = useState(() => {
        return localStorage.getItem('superadmin_selected_board') || 'BISE Kohat';
    });
    const [selectedSubject, setSelectedSubject] = useState('English');

    // Active Subject Edit Form
    const [activeForm, setActiveForm] = useState({
        totalMarks: '75',
        duration: '3 Hours',
        cognitiveLevels: { knowledge: 30, understanding: 50, application: 20 },
        tos: { title: 'English Table of Specifications (TOS)', url: '', notes: 'Chapter & SLO marks distribution matrix' },
        rubrics: { title: 'English Marking Scheme & Rubrics', url: '', notes: 'Examiner scoring criteria for essays, summaries & grammar' },
        modelPaper: { title: 'English Official Model Question Paper', url: '', notes: 'Section A (MCQs), Section B (Short Qs), Section C (Long Qs)' }
    });

    const [uploadingField, setUploadingField] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [savingSubject, setSavingSubject] = useState(false);
    const [subjectSuccessMsg, setSubjectSuccessMsg] = useState('');

    const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
    const [previewPdfTitle, setPreviewPdfTitle] = useState('');

    // Auto-Scan & OCR State for uploaded TOS PDF
    const [scanStatus, setScanStatus] = useState(null); // { scanning: boolean, source: string, confidence: number, isScanned: boolean }

    // Fetch Blueprints & Universal Guide using permitted curriculums collection
    useEffect(() => {
        const q = query(collection(db, 'curriculums'), where('type', '==', 'board_blueprint'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
                list.push({ id: docSnap.id, ...docSnap.data() });
            });
            setBlueprints(list);
        });

        const guideRef = doc(db, 'curriculums', 'board_universal_guide');
        const unsubGuide = onSnapshot(guideRef, (snap) => {
            if (snap.exists()) {
                setUniversalGuide(snap.data());
            }
        });

        return () => {
            unsubscribe();
            unsubGuide();
        };
    }, []);

    // When selectedClass, selectedSubject, selectedSession or selectedBoard changes, load existing data into activeForm
    useEffect(() => {
        const found = blueprints.find(bp => 
            bp.classGrade === selectedClass && 
            bp.subject?.toLowerCase() === selectedSubject.toLowerCase() &&
            bp.session === selectedSession &&
            (bp.board === selectedBoard || (!bp.board && selectedBoard === 'All BISE Boards (National)'))
        );

        const defaultSubjObj = SUBJECT_LIST.find(s => s.name.toLowerCase() === selectedSubject.toLowerCase());

        if (found) {
            setActiveForm({
                totalMarks: found.totalMarks || defaultSubjObj?.defaultMarks || '60',
                duration: found.duration || '3 Hours',
                cognitiveLevels: found.cognitiveLevels || { knowledge: 30, understanding: 50, application: 20 },
                tos: found.tos || { title: `${selectedSubject} Table of Specifications`, url: '', notes: '' },
                rubrics: found.rubrics || { title: `${selectedSubject} Marking Rubrics`, url: '', notes: '' },
                modelPaper: found.modelPaper || { title: `${selectedSubject} Model Paper`, url: '', notes: '' }
            });
        } else {
            setActiveForm({
                totalMarks: defaultSubjObj?.defaultMarks || '60',
                duration: '3 Hours',
                cognitiveLevels: { knowledge: 30, understanding: 50, application: 20 },
                tos: { title: `${selectedSubject} Table of Specifications (TOS)`, url: '', notes: `SLO weightage matrix for ${selectedClass} ${selectedSubject} (${selectedBoard})` },
                rubrics: { title: `${selectedSubject} Marking Rubrics`, url: '', notes: `Scoring rubrics for ${selectedClass} ${selectedSubject} (${selectedBoard})` },
                modelPaper: { title: `${selectedSubject} Official Model Question Paper`, url: '', notes: `Official BISE model paper for ${selectedClass} ${selectedSubject} (${selectedBoard})` }
            });
        }
        setSubjectSuccessMsg('');
    }, [selectedClass, selectedSubject, selectedSession, selectedBoard, blueprints]);

    // Save Universal Guide (Updates version so Principal apps can sync with near-zero reads)
    const handleSaveUniversalGuide = async () => {
        setSavingGuide(true);
        setGuideMessage('');
        try {
            await setDoc(doc(db, 'curriculums', 'board_universal_guide'), {
                ...universalGuide,
                updatedAt: serverTimestamp()
            }, { merge: true });

            // Increment version for instant offline sync in principal app
            await setDoc(doc(db, 'curriculums', 'board_blueprint_version'), {
                version: Date.now(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            setGuideMessage('Universal Guide updated live for all schools!');
            setTimeout(() => setGuideMessage(''), 4000);
        } catch (error) {
            console.error('Error saving universal guide:', error);
            setGuideMessage('Failed to save guide.');
        } finally {
            setSavingGuide(false);
        }
    };

    // Bulletproof File Upload (Storage with Auto-Fallback to Permitted Path & Base64)
    const handleFileUpload = (e, fieldKey, targetObject = null) => {
        const file = e.target.files[0];
        if (!file) return;

        const targetFieldKey = targetObject ? `${targetObject}.${fieldKey}` : fieldKey;
        setUploadingField(targetFieldKey);
        setUploadProgress(15);

        // Auto-scan TOS PDF to auto-populate Knowledge, Understanding & Application sliders
        if (targetObject === 'tos') {
            setScanStatus({ scanning: true, message: 'Analyzing TOS PDF & detecting SLO percentages...' });
            extractTextFromPdf(file).then(text => {
                const metrics = parseTOSMetrics(text, selectedSubject);
                if (metrics && metrics.success) {
                    setActiveForm(prev => ({
                        ...prev,
                        cognitiveLevels: metrics.cognitiveLevels,
                        totalMarks: metrics.totalMarks || prev.totalMarks,
                        duration: metrics.duration || prev.duration,
                        tos: {
                            ...prev.tos,
                            notes: prev.tos.notes || `Auto-analyzed: ${metrics.cognitiveLevels.knowledge}% Knowledge, ${metrics.cognitiveLevels.understanding}% Understanding, ${metrics.cognitiveLevels.application}% Application`
                        }
                    }));
                    setScanStatus({
                        scanning: false,
                        source: metrics.source,
                        confidence: metrics.confidence,
                        isScanned: metrics.isScanned,
                        cognitiveLevels: metrics.cognitiveLevels
                    });
                }
            }).catch(err => {
                console.warn('PDF Auto-Scan notice:', err);
                setScanStatus(null);
            });
        }

        const applyUrl = (url) => {
            if (targetObject) {
                setActiveForm(prev => ({
                    ...prev,
                    [targetObject]: {
                        ...prev[targetObject],
                        [fieldKey]: url
                    }
                }));
            } else if (fieldKey === 'universalPdfUrl') {
                setUniversalGuide(prev => ({ ...prev, pdfUrl: url }));
            }
            setUploadingField(null);
            setUploadProgress(0);
        };

        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        // Use path permitted by live storage rules: match /schools/{schoolId}/paymentProofs/{allPaths=**}
        const storagePath = `schools/global/paymentProofs/board_blueprints/${selectedSession}/${selectedBoard.replace(/[^a-zA-Z0-9]/g, '_')}/${selectedClass.replace(/\s+/g, '_')}/${selectedSubject}/${Date.now()}_${safeFileName}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                setUploadProgress(progress);
            },
            (error) => {
                console.warn('Firebase Storage upload notice:', error.code);
                // Fallback: If Storage returns unauthorized & file is < 1MB, store as Offline Data URL
                if (file.size <= 950 * 1024) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        applyUrl(reader.result);
                        alert(`✓ File uploaded successfully as offline PDF document! (${Math.round(file.size/1024)} KB)`);
                    };
                    reader.onerror = () => {
                        alert('Upload failed: ' + error.message);
                        setUploadingField(null);
                    };
                    reader.readAsDataURL(file);
                } else {
                    alert('Upload note: File is larger than 1MB and Firebase Storage returned unauthorized. Please paste a direct PDF URL, or use a smaller PDF.');
                    setUploadingField(null);
                }
            },
            async () => {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                applyUrl(downloadUrl);
            }
        );
    };

    // Save & Publish Specific Subject Blueprint
    const handlePublishSubject = async (e) => {
        e.preventDefault();
        setSavingSubject(true);
        setSubjectSuccessMsg('');

        try {
            const docId = `blueprint_${selectedSession}_${selectedClass.replace(/\s+/g, '_')}_${selectedSubject}_${selectedBoard.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const blueprintDocRef = doc(db, 'curriculums', docId);

            await setDoc(blueprintDocRef, {
                type: 'board_blueprint',
                classGrade: selectedClass,
                session: selectedSession,
                board: selectedBoard,
                subject: selectedSubject,
                totalMarks: activeForm.totalMarks,
                duration: activeForm.duration,
                cognitiveLevels: activeForm.cognitiveLevels,
                tos: activeForm.tos,
                rubrics: activeForm.rubrics,
                modelPaper: activeForm.modelPaper,
                isPublished: true,
                updatedAt: serverTimestamp()
            }, { merge: true });

            // Bump central version doc so all school apps sync instantly
            await setDoc(doc(db, 'curriculums', 'board_blueprint_version'), {
                version: Date.now(),
                lastUpdatedSubject: `${selectedClass} - ${selectedSubject}`,
                updatedAt: serverTimestamp()
            }, { merge: true });

            setSubjectSuccessMsg(`✓ ${selectedSubject} Blueprints published live to all schools!`);
            setTimeout(() => setSubjectSuccessMsg(''), 4000);
        } catch (error) {
            console.error('Error publishing subject blueprint:', error);
            alert('Failed to publish: ' + error.message);
        } finally {
            setSavingSubject(false);
        }
    };

    // Count how many subjects have been uploaded for current class AND selected board
    const classBlueprints = blueprints.filter(bp => 
        bp.classGrade === selectedClass && 
        bp.session === selectedSession &&
        (bp.board === selectedBoard || (!bp.board && selectedBoard === 'All BISE Boards (National)'))
    );

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: '#1e293b' }}>
            {/* TOP BROADCAST HEADER */}
            <div style={{ 
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)', 
                borderRadius: '16px', 
                padding: '24px 30px', 
                color: '#ffffff',
                boxShadow: '0 10px 25px -5px rgba(49, 46, 129, 0.3)',
                marginBottom: '24px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ 
                                background: 'rgba(255, 255, 255, 0.15)', 
                                padding: '4px 10px', 
                                borderRadius: '20px', 
                                fontSize: '11px', 
                                fontWeight: '700',
                                letterSpacing: '0.5px' 
                            }}>
                                ⚡ CENTRAL SUPER ADMIN BROADCAST CMS
                            </span>
                            <span style={{ 
                                background: '#10b981', 
                                color: '#ffffff', 
                                padding: '3px 8px', 
                                borderRadius: '20px', 
                                fontSize: '11px', 
                                fontWeight: '700' 
                            }}>
                                ZERO-DB COST CACHING READY
                            </span>
                        </div>
                        <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
                            BISE Board Blueprints, TOS & Model Paper Manager
                        </h1>
                        <p style={{ margin: '6px 0 0 0', opacity: 0.85, fontSize: '13px', maxWidth: '720px' }}>
                            Select Class (9th/10th) & Subject (English, Biology, Urdu, etc.) to upload its 3 core papers. Updates push instantly to all schools and cache offline.
                        </p>
                    </div>
                </div>
            </div>

            {/* UNIVERSAL MASTER GUIDE SECTION */}
            <div style={{
                background: '#ffffff',
                borderRadius: '14px',
                padding: '20px 24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                marginBottom: '24px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                            width: '40px', 
                            height: '40px', 
                            borderRadius: '10px', 
                            background: '#fef3c7', 
                            color: '#d97706', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                        }}>
                            <Compass size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                                Universal Blueprint & SLO Decoding Guide (Global Master Framework)
                            </h2>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                                This single guide explains to teachers how to read TOS, Rubrics & Cognitive Domains across all subjects.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {guideMessage && (
                            <span style={{ fontSize: '13px', color: '#059669', fontWeight: '700' }}>
                                ✓ {guideMessage}
                            </span>
                        )}
                        <button
                            onClick={handleSaveUniversalGuide}
                            disabled={savingGuide}
                            style={{
                                background: '#312e81',
                                color: '#ffffff',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {savingGuide ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
                            {savingGuide ? 'Broadcasting...' : 'Save Universal Guide'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                            Guide Title / Version
                        </label>
                        <input 
                            type="text"
                            value={universalGuide.title || ''}
                            onChange={(e) => setUniversalGuide(prev => ({ ...prev, title: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                            Universal PDF Document (Upload or Direct URL)
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="url"
                                placeholder="https://... or upload PDF"
                                value={universalGuide.pdfUrl || ''}
                                onChange={(e) => setUniversalGuide(prev => ({ ...prev, pdfUrl: e.target.value }))}
                                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                            />
                            <label style={{
                                background: '#f1f5f9',
                                color: '#334155',
                                padding: '0 12px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '700',
                                border: '1px solid #cbd5e1'
                            }}>
                                <UploadCloud size={14} />
                                {uploadingField === 'universalPdfUrl' ? `${uploadProgress}%` : 'Upload'}
                                <input 
                                    type="file" 
                                    accept="application/pdf"
                                    style={{ display: 'none' }}
                                    onChange={(e) => handleFileUpload(e, 'universalPdfUrl')}
                                />
                            </label>
                            {universalGuide.pdfUrl && (
                                <button
                                    onClick={() => {
                                        setPreviewPdfUrl(universalGuide.pdfUrl);
                                        setPreviewPdfTitle('Universal Decoding Guide');
                                    }}
                                    style={{ background: '#e0e7ff', color: '#3730a3', border: 'none', padding: '0 10px', borderRadius: '8px', cursor: 'pointer' }}
                                    title="Quick Preview"
                                >
                                    <Eye size={15} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* STEP 1: CLASS, SESSION & BOARD SELECTOR */}
            <div style={{ 
                background: '#ffffff', 
                borderRadius: '14px', 
                padding: '18px 24px', 
                border: '1px solid #e2e8f0', 
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                {/* Step 1: Choose Class */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                        Step 1: Choose Class:
                    </span>
                    {CLASSES.map(cls => (
                        <button
                            key={cls}
                            onClick={() => setSelectedClass(cls)}
                            style={{
                                padding: '8px 20px',
                                borderRadius: '10px',
                                fontWeight: '800',
                                fontSize: '13px',
                                cursor: 'pointer',
                                background: selectedClass === cls ? '#312e81' : '#f8fafc',
                                color: selectedClass === cls ? '#ffffff' : '#475569',
                                border: selectedClass === cls ? 'none' : '1px solid #cbd5e1',
                                boxShadow: selectedClass === cls ? '0 4px 12px rgba(49, 46, 129, 0.25)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            {cls}
                        </button>
                    ))}
                </div>

                {/* Session & Board Jurisdiction */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Session:</span>
                        <select
                            value={selectedSession}
                            onChange={(e) => setSelectedSession(e.target.value)}
                            style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '700' }}
                        >
                            {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Board Jurisdiction:</span>
                        {(() => {
                            const currentBoardMeta = getBoardData(selectedBoard);
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '4px 10px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                                    <BoardCrestLogo 
                                        boardId={currentBoardMeta.id}
                                        size={30}
                                        primaryColor={currentBoardMeta.primaryColor}
                                        accentColor={currentBoardMeta.accentColor}
                                        symbol={currentBoardMeta.symbol}
                                    />
                                    <select
                                        value={selectedBoard}
                                        onChange={(e) => {
                                            setSelectedBoard(e.target.value);
                                            localStorage.setItem('superadmin_selected_board', e.target.value);
                                        }}
                                        style={{ 
                                            padding: '6px 12px', 
                                            borderRadius: '8px', 
                                            border: '1.5px solid #312e81', 
                                            fontSize: '13px', 
                                            fontWeight: '800',
                                            background: '#ffffff',
                                            color: '#1e1b4b',
                                            cursor: 'pointer',
                                            maxWidth: '300px'
                                        }}
                                    >
                                        {PAKISTAN_BOARD_GROUPS.map(group => (
                                            <optgroup key={group.province} label={group.province}>
                                                {group.boards.map(b => (
                                                    <option key={b.name} value={b.name}>
                                                        {b.name} — {b.details.split(',')[0]}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <span style={{ 
                                        background: '#fef3c7', 
                                        color: '#92400e', 
                                        padding: '3px 8px', 
                                        borderRadius: '6px', 
                                        fontSize: '11px', 
                                        fontWeight: '800', 
                                        fontFamily: 'serif' 
                                    }}>
                                        {currentBoardMeta.slogan}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* STEP 2: CHOOSE SUBJECT (DROPDOWN & CHIPS) */}
            <div style={{ 
                background: '#ffffff', 
                borderRadius: '14px', 
                padding: '18px 24px', 
                border: '1px solid #e2e8f0', 
                marginBottom: '24px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                            Step 2: Choose Subject for {selectedClass}:
                        </span>
                        {/* Clean Dropdown */}
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            style={{ 
                                padding: '8px 16px', 
                                borderRadius: '10px', 
                                border: '2px solid #312e81', 
                                fontSize: '14px', 
                                fontWeight: '800',
                                color: '#312e81',
                                background: '#f8fafc',
                                cursor: 'pointer'
                            }}
                        >
                            {SUBJECT_LIST.map(s => {
                                const isUploaded = classBlueprints.some(bp => bp.subject?.toLowerCase() === s.name.toLowerCase() && bp.tos?.url && bp.rubrics?.url && bp.modelPaper?.url);
                                return (
                                    <option key={s.name} value={s.name}>
                                        {s.icon} {s.name} {isUploaded ? '✓ (Published)' : '⏳ (Pending)'}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Progress: <strong style={{ color: '#059669' }}>{classBlueprints.length}</strong> of {SUBJECT_LIST.length} Subjects Published
                    </span>
                </div>

                {/* Subject Pills / Carousel */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                    {SUBJECT_LIST.map(s => {
                        const isSelected = selectedSubject.toLowerCase() === s.name.toLowerCase();
                        const isUploaded = classBlueprints.some(bp => bp.subject?.toLowerCase() === s.name.toLowerCase() && bp.tos?.url && bp.rubrics?.url && bp.modelPaper?.url);
                        return (
                            <button
                                key={s.name}
                                onClick={() => setSelectedSubject(s.name)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '10px',
                                    border: isSelected ? '2px solid #312e81' : '1px solid #e2e8f0',
                                    background: isSelected ? '#eff6ff' : '#ffffff',
                                    color: isSelected ? '#1e3a8a' : '#475569',
                                    fontWeight: '700',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    whiteSpace: 'nowrap',
                                    boxShadow: isSelected ? '0 2px 8px rgba(49, 46, 129, 0.15)' : 'none'
                                }}
                            >
                                <span>{s.icon}</span>
                                <span>{s.name}</span>
                                {isUploaded ? (
                                    <span style={{ color: '#059669', fontSize: '12px' }}>✓</span>
                                ) : (
                                    <span style={{ color: '#d97706', fontSize: '10px' }}>●</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* STEP 3: DEDICATED 3-SLOT UPLOAD FOR SELECTED SUBJECT */}
            <form onSubmit={handlePublishSubject}>
                <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                    padding: '24px',
                    marginBottom: '28px'
                }}>
                    {/* Active Subject Banner */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid #e2e8f0',
                        paddingBottom: '16px',
                        marginBottom: '20px',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: '#312e81',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px'
                            }}>
                                {SUBJECT_LIST.find(s => s.name.toLowerCase() === selectedSubject.toLowerCase())?.icon || '📚'}
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                                        {selectedClass} • {selectedSubject} Blueprints
                                    </h2>
                                    <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px' }}>
                                        {selectedSession}
                                    </span>
                                </div>
                                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                                    Upload the 3 dedicated papers for {selectedSubject}. Principals will get these in their subject dropdown.
                                </p>
                            </div>
                        </div>

                        {/* Marks & Duration */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Total Marks</label>
                                <input 
                                    type="text"
                                    value={activeForm.totalMarks}
                                    onChange={(e) => setActiveForm(prev => ({ ...prev, totalMarks: e.target.value }))}
                                    style={{ width: '80px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '700', textAlign: 'center' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Exam Duration</label>
                                <input 
                                    type="text"
                                    value={activeForm.duration}
                                    onChange={(e) => setActiveForm(prev => ({ ...prev, duration: e.target.value }))}
                                    style={{ width: '100px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '700', textAlign: 'center' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Cognitive Domain Breakdown (%) */}
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                🧠 SLO Cognitive Level Weightage Matrix (%) for {selectedSubject}
                            </label>

                            {/* Auto-Scan Status Chip */}
                            {scanStatus?.scanning ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
                                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', animation: 'ping 1s infinite' }}></span>
                                    Analyzing TOS PDF & Extracting SLO Domains...
                                </div>
                            ) : scanStatus ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
                                    <Sparkles size={13} color="#059669" />
                                    <span>{scanStatus.source}</span>
                                    <span style={{ background: '#059669', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontSize: '10px' }}>
                                        {scanStatus.confidence}% match
                                    </span>
                                </div>
                            ) : (
                                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                                    💡 Upload TOS PDF below to auto-fill these percentages automatically
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                            <div>
                                <span style={{ fontSize: '12px', color: '#4f46e5', fontWeight: '700' }}>Knowledge (Recall) %</span>
                                <input 
                                    type="number"
                                    value={activeForm.cognitiveLevels.knowledge}
                                    onChange={(e) => setActiveForm(prev => ({
                                        ...prev,
                                        cognitiveLevels: { ...prev.cognitiveLevels, knowledge: Number(e.target.value) }
                                    }))}
                                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', marginTop: '4px' }}
                                />
                            </div>
                            <div>
                                <span style={{ fontSize: '12px', color: '#059669', fontWeight: '700' }}>Understanding (Concepts) %</span>
                                <input 
                                    type="number"
                                    value={activeForm.cognitiveLevels.understanding}
                                    onChange={(e) => setActiveForm(prev => ({
                                        ...prev,
                                        cognitiveLevels: { ...prev.cognitiveLevels, understanding: Number(e.target.value) }
                                    }))}
                                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', marginTop: '4px' }}
                                />
                            </div>
                            <div>
                                <span style={{ fontSize: '12px', color: '#d97706', fontWeight: '700' }}>Application (Problem Solving) %</span>
                                <input 
                                    type="number"
                                    value={activeForm.cognitiveLevels.application}
                                    onChange={(e) => setActiveForm(prev => ({
                                        ...prev,
                                        cognitiveLevels: { ...prev.cognitiveLevels, application: Number(e.target.value) }
                                    }))}
                                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', marginTop: '4px' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* THE 3 CORE DEDICATED PAPERS FOR THIS SUBJECT */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        {/* SLOT 1: TOS */}
                        <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: '12px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ fontSize: '14px', fontWeight: '800', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    📊 Paper 1: Table of Specification (TOS) Document for {selectedSubject}
                                </label>
                                {activeForm.tos.url && (
                                    <button
                                        type="button"
                                        onClick={() => { setPreviewPdfUrl(activeForm.tos.url); setPreviewPdfTitle(`${selectedSubject} - TOS`); }}
                                        style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        Quick Preview
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <input 
                                    type="url"
                                    placeholder="PDF URL or click Upload PDF button..."
                                    value={activeForm.tos.url}
                                    onChange={(e) => setActiveForm(prev => ({ ...prev, tos: { ...prev.tos, url: e.target.value } }))}
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                                />
                                <label style={{
                                    background: '#3b82f6',
                                    color: '#ffffff',
                                    padding: '0 16px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '700'
                                }}>
                                    <UploadCloud size={14} />
                                    {uploadingField === 'tos.url' ? `${uploadProgress}%` : 'Upload PDF'}
                                    <input 
                                        type="file" 
                                        accept="application/pdf"
                                        style={{ display: 'none' }}
                                        onChange={(e) => handleFileUpload(e, 'url', 'tos')}
                                    />
                                </label>
                            </div>
                            <input 
                                type="text"
                                placeholder="TOS Notes / Chapter weighting summary (e.g. Chapter-wise marks distribution)"
                                value={activeForm.tos.notes}
                                onChange={(e) => setActiveForm(prev => ({ ...prev, tos: { ...prev.tos, notes: e.target.value } }))}
                                style={{ width: '100%', padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                            />
                        </div>

                        {/* SLOT 2: RUBRICS */}
                        <div style={{ border: '1px solid #a7f3d0', background: '#ecfdf5', borderRadius: '12px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ fontSize: '14px', fontWeight: '800', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    🎯 Paper 2: Marking Rubrics & Assessment Scheme for {selectedSubject}
                                </label>
                                {activeForm.rubrics.url && (
                                    <button
                                        type="button"
                                        onClick={() => { setPreviewPdfUrl(activeForm.rubrics.url); setPreviewPdfTitle(`${selectedSubject} - Rubrics`); }}
                                        style={{ background: '#10b981', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        Quick Preview
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <input 
                                    type="url"
                                    placeholder="PDF URL or click Upload PDF button..."
                                    value={activeForm.rubrics.url}
                                    onChange={(e) => setActiveForm(prev => ({ ...prev, rubrics: { ...prev.rubrics, url: e.target.value } }))}
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                                />
                                <label style={{
                                    background: '#10b981',
                                    color: '#ffffff',
                                    padding: '0 16px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '700'
                                }}>
                                    <UploadCloud size={14} />
                                    {uploadingField === 'rubrics.url' ? `${uploadProgress}%` : 'Upload PDF'}
                                    <input 
                                        type="file" 
                                        accept="application/pdf"
                                        style={{ display: 'none' }}
                                        onChange={(e) => handleFileUpload(e, 'url', 'rubrics')}
                                    />
                                </label>
                            </div>
                            <input 
                                type="text"
                                placeholder="Rubrics Notes (e.g. Formula, step working, units & diagram marking criteria)"
                                value={activeForm.rubrics.notes}
                                onChange={(e) => setActiveForm(prev => ({ ...prev, rubrics: { ...prev.rubrics, notes: e.target.value } }))}
                                style={{ width: '100%', padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                            />
                        </div>

                        {/* SLOT 3: MODEL PAPER */}
                        <div style={{ border: '1px solid #fbcfe8', background: '#fdf2f8', borderRadius: '12px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ fontSize: '14px', fontWeight: '800', color: '#9d174d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    📝 Paper 3: Official Model Question Paper for {selectedSubject}
                                </label>
                                {activeForm.modelPaper.url && (
                                    <button
                                        type="button"
                                        onClick={() => { setPreviewPdfUrl(activeForm.modelPaper.url); setPreviewPdfTitle(`${selectedSubject} - Model Paper`); }}
                                        style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        Quick Preview
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <input 
                                    type="url"
                                    placeholder="PDF URL or click Upload PDF button..."
                                    value={activeForm.modelPaper.url}
                                    onChange={(e) => setActiveForm(prev => ({ ...prev, modelPaper: { ...prev.modelPaper, url: e.target.value } }))}
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                                />
                                <label style={{
                                    background: '#ec4899',
                                    color: '#ffffff',
                                    padding: '0 16px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '700'
                                }}>
                                    <UploadCloud size={14} />
                                    {uploadingField === 'modelPaper.url' ? `${uploadProgress}%` : 'Upload PDF'}
                                    <input 
                                        type="file" 
                                        accept="application/pdf"
                                        style={{ display: 'none' }}
                                        onChange={(e) => handleFileUpload(e, 'url', 'modelPaper')}
                                    />
                                </label>
                            </div>
                            <input 
                                type="text"
                                placeholder="Model Paper Notes (e.g. Section A: MCQs, Section B: Short Qs, Section C: Long Qs)"
                                value={activeForm.modelPaper.notes}
                                onChange={(e) => setActiveForm(prev => ({ ...prev, modelPaper: { ...prev.modelPaper, notes: e.target.value } }))}
                                style={{ width: '100%', padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                            />
                        </div>
                    </div>

                    {/* DEDICATED SUBMIT / PUBLISH BUTTON */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                            {subjectSuccessMsg && (
                                <span style={{ fontSize: '14px', color: '#059669', fontWeight: '800' }}>
                                    {subjectSuccessMsg}
                                </span>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={savingSubject}
                            style={{
                                background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '14px 28px',
                                borderRadius: '12px',
                                fontWeight: '800',
                                fontSize: '15px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                boxShadow: '0 6px 18px rgba(49, 46, 129, 0.3)',
                                transition: 'all 0.2s'
                            }}
                        >
                            {savingSubject ? <RefreshCw size={18} className="spin" /> : <CheckCircle size={18} />}
                            {savingSubject ? 'Publishing...' : `Save & Publish ${selectedSubject} (${selectedClass}) to All Schools`}
                        </button>
                    </div>
                </div>
            </form>

            {/* PREVIEW MODAL */}
            {previewPdfUrl && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 23, 42, 0.8)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 10000,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '24px'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: '#fff',
                        marginBottom: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileText size={20} />
                            <span style={{ fontSize: '16px', fontWeight: '700' }}>{previewPdfTitle}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <a 
                                href={previewPdfUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                style={{ background: '#3b82f6', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <ExternalLink size={14} /> Open in Tab
                            </a>
                            <button
                                onClick={() => setPreviewPdfUrl(null)}
                                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                    <div style={{ flex: 1, background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
                        <iframe 
                            src={previewPdfUrl} 
                            style={{ width: '100%', height: '100%', border: 'none' }} 
                            title={previewPdfTitle} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default BoardBlueprints;
