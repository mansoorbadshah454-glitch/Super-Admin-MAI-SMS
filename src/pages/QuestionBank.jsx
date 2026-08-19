import React, { useState, useEffect } from 'react';
import { 
    BookOpen, Sparkles, Plus, Trash2, Edit3, CheckCircle2, 
    Upload, FileText, Search, RefreshCw, AlertCircle, Eye, 
    Layers, Check, HelpCircle, Save, Database
} from 'lucide-react';
import { db } from '../firebase';
import { 
    collection, getDocs, doc, setDoc, deleteDoc, 
    writeBatch, serverTimestamp, query, where, orderBy 
} from 'firebase/firestore';

const ALL_CLASSES = ['Nursery', 'Prep', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const COMMON_SUBJECTS_BY_CLASS = {
    'Nursery': ['English (Alphabets)', 'Urdu (Huroof-e-Tahajji)', 'Mathematics (Counting)', 'General Knowledge & Rhymes'],
    'Prep': ['English (Words & Phonics)', 'Urdu (Jor-Tor)', 'Mathematics (Shapes & Numbers)', 'General Knowledge & Drawing'],
    '1': ['General Science', 'Mathematics', 'English', 'Urdu', 'Islamiat', 'General Knowledge'],
    '2': ['General Science', 'Mathematics', 'English', 'Urdu', 'Islamiat', 'General Knowledge', 'Computer'],
    '3': ['General Science', 'Mathematics', 'English', 'Urdu', 'Islamiat', 'Social Studies', 'Computer'],
    '4': ['General Science', 'Mathematics', 'English', 'Urdu', 'Islamiat', 'Social Studies', 'Computer'],
    '5': ['General Science', 'Mathematics', 'English', 'Urdu', 'Islamiat', 'Social Studies', 'Computer'],
    '6': ['General Science', 'Mathematics', 'English', 'Urdu', 'Islamiat', 'History', 'Geography', 'Computer Education'],
    '7': ['General Science', 'Mathematics', 'English', 'Urdu', 'Islamiat', 'History', 'Geography', 'Computer Education'],
    '8': ['General Science', 'Mathematics', 'English', 'Urdu', 'Islamiat', 'History', 'Geography', 'Computer Education'],
    '9': ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer Science', 'English', 'Urdu', 'Islamiat', 'Pak Studies', 'General Science'],
    '10': ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer Science', 'English', 'Urdu', 'Islamiat', 'Pak Studies', 'General Science']
};

const DEFAULT_CURRICULUMS = [
    {
        id: 'punjab_board',
        name: 'Punjab Textbook Board (PCTB)',
        classes: ALL_CLASSES,
        subjectsByClass: COMMON_SUBJECTS_BY_CLASS
    },
    {
        id: 'kpk_board',
        name: 'KPK Textbook Board (Peshawar - KPTB)',
        classes: ALL_CLASSES,
        subjectsByClass: COMMON_SUBJECTS_BY_CLASS
    },
    {
        id: 'federal_board',
        name: 'Federal Board (FBISE / NBF Islamabad)',
        classes: ALL_CLASSES,
        subjectsByClass: COMMON_SUBJECTS_BY_CLASS
    },
    {
        id: 'sindh_board',
        name: 'Sindh Textbook Board (STBB Jamshoro)',
        classes: ALL_CLASSES,
        subjectsByClass: COMMON_SUBJECTS_BY_CLASS
    },
    {
        id: 'balochistan_board',
        name: 'Balochistan Textbook Board (BTB Quetta)',
        classes: ALL_CLASSES,
        subjectsByClass: COMMON_SUBJECTS_BY_CLASS
    },
    {
        id: 'ajk_board',
        name: 'AJK Textbook Board (Muzaffarabad)',
        classes: ALL_CLASSES,
        subjectsByClass: COMMON_SUBJECTS_BY_CLASS
    },
    {
        id: 'oxford_series',
        name: 'Oxford University Press (OUP Series)',
        classes: ALL_CLASSES,
        subjectsByClass: COMMON_SUBJECTS_BY_CLASS
    },
    {
        id: 'afaq_series',
        name: 'AFAQ Publications (Sun / Iqbal Series)',
        classes: ALL_CLASSES,
        subjectsByClass: COMMON_SUBJECTS_BY_CLASS
    },
    {
        id: 'cambridge_curriculum',
        name: 'Cambridge International (O-Levels / IGCSE)',
        classes: ALL_CLASSES,
        subjectsByClass: COMMON_SUBJECTS_BY_CLASS
    },
    {
        id: 'general_custom',
        name: 'General / Custom School Syllabus',
        classes: ALL_CLASSES,
        subjectsByClass: COMMON_SUBJECTS_BY_CLASS
    }
];

const QuestionBank = () => {
    const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'ai-ingest' | 'manual-add'
    const [curriculums, setCurriculums] = useState(DEFAULT_CURRICULUMS);
    const [selectedCurriculum, setSelectedCurriculum] = useState('punjab_board');
    const [selectedClass, setSelectedClass] = useState('9');
    const [selectedSubject, setSelectedSubject] = useState('Physics');
    const [selectedChapter, setSelectedChapter] = useState('1');
    const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Custom Board Modal State
    const [showAddBoardModal, setShowAddBoardModal] = useState(false);
    const [newBoardName, setNewBoardName] = useState('');
    const [isSavingBoard, setIsSavingBoard] = useState(false);

    // AI Ingestion States
    const [chapterName, setChapterName] = useState('Physical Quantities and Measurement');
    const [rawText, setRawText] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
    const [isParsingAI, setIsParsingAI] = useState(false);
    const [parsedDrafts, setParsedDrafts] = useState([]);
    const [ingestSuccessMsg, setIngestSuccessMsg] = useState('');
    const [ingestErrorMsg, setIngestErrorMsg] = useState('');

    const [questions, setQuestions] = useState([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    // Fetch Custom Curriculums & Questions from Firestore & Local Storage
    const fetchCurriculumsAndQuestions = async () => {
        setLoadingQuestions(true);
        try {
            // 1. Load locally cached custom boards
            const localCustom = JSON.parse(localStorage.getItem('custom_curriculums') || '[]');
            
            // 2. Fetch any custom curriculums from Firestore
            let firestoreCustom = [];
            try {
                const currSnap = await getDocs(collection(db, 'curriculums'));
                currSnap.forEach(d => {
                    const data = d.data();
                    if (!DEFAULT_CURRICULUMS.some(dc => dc.id === d.id)) {
                        firestoreCustom.push({ id: d.id, classes: ALL_CLASSES, subjectsByClass: COMMON_SUBJECTS_BY_CLASS, ...data });
                    }
                });
            } catch (e) {
                console.warn("Firestore curriculums read fallback to local:", e.message);
            }

            // Merge unique custom boards
            const allCustom = [...localCustom];
            firestoreCustom.forEach(fc => {
                if (!allCustom.some(c => c.id === fc.id)) {
                    allCustom.push(fc);
                }
            });

            setCurriculums([...DEFAULT_CURRICULUMS, ...allCustom]);

            // 3. Fetch Questions
            try {
                const qRef = collection(db, 'global_question_bank');
                const snap = await getDocs(qRef);
                const list = [];
                snap.forEach(docSnap => {
                    list.push({ id: docSnap.id, ...docSnap.data() });
                });
                setQuestions(list);
            } catch (qErr) {
                console.warn("Question bank fetch error:", qErr.message);
            }
        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            setLoadingQuestions(false);
        }
    };

    const fetchQuestions = fetchCurriculumsAndQuestions;

    useEffect(() => {
        fetchCurriculumsAndQuestions();
    }, []);

    // Create New Custom Board (Resilient: Local + Firestore sync)
    const handleCreateCustomBoard = async (e) => {
        e.preventDefault();
        if (!newBoardName.trim()) return;
        setIsSavingBoard(true);

        const boardId = newBoardName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
        const newBoard = {
            id: boardId,
            name: newBoardName.trim(),
            classes: ALL_CLASSES,
            subjectsByClass: COMMON_SUBJECTS_BY_CLASS
        };

        // 1. Immediately save to localStorage
        try {
            const existing = JSON.parse(localStorage.getItem('custom_curriculums') || '[]');
            const updated = [...existing, newBoard];
            localStorage.setItem('custom_curriculums', JSON.stringify(updated));
        } catch (storageErr) {
            console.error("LocalStorage save error:", storageErr);
        }

        // 2. Update UI state immediately
        setCurriculums(prev => [...prev, newBoard]);
        setSelectedCurriculum(boardId);
        setNewBoardName('');
        setShowAddBoardModal(false);

        // 3. Sync to Firestore in background
        try {
            await setDoc(doc(db, 'curriculums', boardId), {
                ...newBoard,
                createdAt: serverTimestamp()
            });
            console.log(`Board "${newBoard.name}" synced to Firestore.`);
        } catch (err) {
            console.warn("Firestore sync warning (board preserved locally):", err.message);
        } finally {
            setIsSavingBoard(false);
        }

        alert(`Board "${newBoard.name}" has been created and activated successfully!`);
    };

    // Filtered Questions
    const filteredQuestions = questions.filter(q => {
        const matchCurr = !selectedCurriculum || q.curriculumId === selectedCurriculum;
        const matchClass = !selectedClass || String(q.class) === String(selectedClass);
        const matchSubject = !selectedSubject || q.subject?.toLowerCase() === selectedSubject.toLowerCase();
        const matchChapter = !selectedChapter || String(q.chapterNumber) === String(selectedChapter);
        const matchType = selectedTypeFilter === 'all' || q.type === selectedTypeFilter;
        const matchSearch = !searchQuery || 
            q.question?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            q.questionUrdu?.includes(searchQuery);
        return matchCurr && matchClass && matchSubject && matchChapter && matchType && matchSearch;
    });

    const activeCurriculumObj = curriculums.find(c => c.id === selectedCurriculum) || curriculums[0];
    const availableSubjects = activeCurriculumObj?.subjectsByClass?.[selectedClass] || [
        'Physics', 'Chemistry', 'Biology', 'Mathematics', 'English', 'Urdu', 'Islamiat', 'Pak Studies', 'Computer Science'
    ];

    // Handle Image Selection
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    // AI Parsing Logic using Gemini API
    const handleRunAIExtraction = async () => {
        if (!apiKey.trim()) {
            setIngestErrorMsg('Please provide a Gemini API Key to enable AI Vision / Text Extraction.');
            return;
        }
        if (!rawText.trim() && !selectedImage) {
            setIngestErrorMsg('Please paste textbook text or upload an image/screenshot of the chapter exercise.');
            return;
        }

        setIsParsingAI(true);
        setIngestErrorMsg('');
        setIngestSuccessMsg('');
        localStorage.setItem('gemini_api_key', apiKey.trim());

        try {
            const prompt = `You are an expert curriculum digitization engine.
Extract all exam questions from this textbook page / exercise text for Class ${selectedClass}, Subject: ${selectedSubject}, Chapter ${selectedChapter}: "${chapterName}".

Return STRICTLY a JSON array matching this format (no markdown code blocks, just raw JSON array):
[
  {
    "type": "mcq", // "mcq" | "short" | "long"
    "difficulty": "medium", // "easy" | "medium" | "hard"
    "question": "English question text here",
    "questionUrdu": "اردو متن (اگر دستیاب ہو)",
    "options": ["Option A", "Option B", "Option C", "Option D"], // required for mcq, empty array [] for short/long
    "correctAnswer": "Exact correct answer string or option text",
    "marks": 1 // 1 for mcq, 2 for short, 5 for long
  }
]`;

            let contents = [];

            if (selectedImage && imagePreview) {
                const base64Data = imagePreview.split(',')[1];
                contents = [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt + "\n\nAlso extract from this image:" },
                            {
                                inlineData: {
                                    mimeType: selectedImage.type || 'image/jpeg',
                                    data: base64Data
                                }
                            },
                            ...(rawText.trim() ? [{ text: "\nAdditional Context/Text:\n" + rawText }] : [])
                        ]
                    }
                ];
            } else {
                contents = [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt + "\n\nText to process:\n" + rawText }
                        ]
                    }
                ];
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: contents,
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData?.error?.message || `API Error: ${response.status}`);
            }

            const data = await response.json();
            const rawResponseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!rawResponseText) throw new Error("No response received from Gemini AI.");

            let parsedList = [];
            try {
                parsedList = JSON.parse(rawResponseText);
            } catch (e) {
                // Fallback sanitize
                const cleaned = rawResponseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
                parsedList = JSON.parse(cleaned);
            }

            if (!Array.isArray(parsedList) || parsedList.length === 0) {
                throw new Error("Could not extract questions in valid format.");
            }

            // Map and attach curriculum metadata
            const enriched = parsedList.map((item, idx) => ({
                id: `temp_${Date.now()}_${idx}`,
                curriculumId: selectedCurriculum,
                class: String(selectedClass),
                subject: selectedSubject,
                chapterNumber: Number(selectedChapter),
                chapterName: chapterName,
                type: item.type || (item.options?.length ? 'mcq' : 'short'),
                difficulty: item.difficulty || 'medium',
                question: item.question || '',
                questionUrdu: item.questionUrdu || '',
                options: Array.isArray(item.options) ? item.options : [],
                correctAnswer: item.correctAnswer || (item.options?.[0] || ''),
                marks: item.marks || (item.type === 'long' ? 5 : item.type === 'short' ? 2 : 1)
            }));

            setParsedDrafts(enriched);
            setIngestSuccessMsg(`AI successfully extracted ${enriched.length} questions! Review and edit below, then click "Save to Question Bank".`);
        } catch (err) {
            console.error("AI Extraction Error:", err);
            setIngestErrorMsg(`Failed to extract questions: ${err.message}`);
        } finally {
            setIsParsingAI(false);
        }
    };

    // Save Parsed Drafts to Firestore
    const handleSaveDraftsToDatabase = async () => {
        if (parsedDrafts.length === 0) return;
        setIsParsingAI(true);
        try {
            const batch = writeBatch(db);
            parsedDrafts.forEach(draft => {
                const docRef = doc(collection(db, 'global_question_bank'));
                const { id, ...cleanData } = draft;
                batch.set(docRef, {
                    ...cleanData,
                    createdAt: serverTimestamp()
                });
            });

            await batch.commit();
            setIngestSuccessMsg(`Successfully saved ${parsedDrafts.length} questions to Global Question Bank!`);
            setParsedDrafts([]);
            setRawText('');
            setSelectedImage(null);
            setImagePreview(null);
            fetchCurriculumsAndQuestions();
        } catch (err) {
            console.error("Save Drafts Error:", err);
            setIngestErrorMsg(`Error saving to database: ${err.message}`);
        } finally {
            setIsParsingAI(false);
        }
    };

    // Delete single question
    const handleDeleteQuestion = async (id) => {
        if (!window.confirm("Are you sure you want to delete this question?")) return;
        try {
            await deleteDoc(doc(db, 'global_question_bank', id));
            setQuestions(prev => prev.filter(q => q.id !== id));
        } catch (err) {
            console.error("Delete question error:", err);
            alert("Failed to delete question.");
        }
    };

    return (
        <div style={{ padding: '1.5rem', color: '#f8fafc' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex' }}>
                            <BookOpen size={24} color="#fff" />
                        </div>
                        Curriculum & Question Bank
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Master repository of syllabus questions shared across all schools with AI ingestion
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setShowAddBoardModal(true)}
                        style={{
                            padding: '0.6rem 1.2rem',
                            borderRadius: '10px',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}
                    >
                        <Plus size={16} />
                        + Add Custom Board
                    </button>

                    <button
                        onClick={() => setActiveTab('browse')}
                        style={{
                            padding: '0.6rem 1.2rem',
                            borderRadius: '10px',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: activeTab === 'browse' ? '#4f46e5' : 'rgba(255,255,255,0.05)',
                            color: activeTab === 'browse' ? '#ffffff' : '#94a3b8',
                            border: '1px solid ' + (activeTab === 'browse' ? '#6366f1' : 'rgba(255,255,255,0.1)')
                        }}
                    >
                        <Database size={16} />
                        Browse Questions ({questions.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('ai-ingest')}
                        style={{
                            padding: '0.6rem 1.2rem',
                            borderRadius: '10px',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: activeTab === 'ai-ingest' ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                            color: '#ffffff',
                            border: '1px solid ' + (activeTab === 'ai-ingest' ? '#ec4899' : 'rgba(255,255,255,0.1)')
                        }}
                    >
                        <Sparkles size={16} />
                        AI Vision / OCR Ingest
                    </button>
                </div>
            </div>

            {/* ADD CUSTOM BOARD MODAL */}
            {showAddBoardModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '2rem', maxWidth: '480px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f8fafc', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <BookOpen size={20} color="#34d399" />
                            Add New Board / Publisher
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
                            Create a custom textbook board (e.g. Peshawar KPTB, AFAQ Series, Oxford, Cantab) to ingest questions.
                        </p>

                        <form onSubmit={handleCreateCustomBoard}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                                    Board / Curriculum Name
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. KPK Textbook Board (Peshawar) or Oxford Progressive"
                                    value={newBoardName}
                                    onChange={(e) => setNewBoardName(e.target.value)}
                                    required
                                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.9rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddBoardModal(false)}
                                    style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#94a3b8', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingBoard}
                                    style={{ padding: '0.6rem 1.4rem', borderRadius: '8px', background: '#10b981', color: '#fff', border: 'none', fontWeight: '700', cursor: isSavingBoard ? 'not-allowed' : 'pointer' }}
                                >
                                    {isSavingBoard ? 'Saving...' : 'Create Board'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TAB 1: AI INGESTION STUDIO */}
            {activeTab === 'ai-ingest' && (
                <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1.5rem', backdropFilter: 'blur(10px)', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
                        <Sparkles size={20} color="#ec4899" />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>AI Vision & Bulk Question Extraction</h2>
                    </div>

                    {/* API Key Banner */}
                    <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8', minWidth: '120px' }}>Gemini API Key:</span>
                        <input
                            type="password"
                            placeholder="AIzaSy... (Enter your Google Gemini API Key)"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
                        />
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Key is saved securely in your local browser storage</span>
                    </div>

                    {/* Selectors Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Curriculum / Board</label>
                            <select
                                value={selectedCurriculum}
                                onChange={(e) => setSelectedCurriculum(e.target.value)}
                                style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.6rem', borderRadius: '8px' }}
                            >
                                {curriculums.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Class</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.6rem', borderRadius: '8px' }}
                            >
                                {ALL_CLASSES.map(c => <option key={c} value={c}>{c === 'Nursery' || c === 'Prep' ? c : `Class ${c}`}</option>)}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Subject</label>
                            <select
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value)}
                                style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.6rem', borderRadius: '8px' }}
                            >
                                {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Chapter Number</label>
                            <input
                                type="number"
                                min="1"
                                max="30"
                                value={selectedChapter}
                                onChange={(e) => setSelectedChapter(e.target.value)}
                                style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.6rem', borderRadius: '8px' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Chapter Title</label>
                            <input
                                type="text"
                                placeholder="e.g. Physical Quantities..."
                                value={chapterName}
                                onChange={(e) => setChapterName(e.target.value)}
                                style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.6rem', borderRadius: '8px' }}
                            />
                        </div>
                    </div>

                    {/* Inputs: Image Upload & Raw Text Paste */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                        {/* Image Upload Box */}
                        <div style={{ border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '12px', padding: '1.25rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)' }}>
                            <Upload size={32} color="#818cf8" style={{ margin: '0 auto 0.5rem' }} />
                            <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.25rem' }}>Upload Exercise Image / PDF Page</h3>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>Take photo of book exercise or snapshot from PDF</p>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                style={{ display: 'none' }}
                                id="book-image-input"
                            />
                            <label
                                htmlFor="book-image-input"
                                style={{ padding: '0.5rem 1rem', background: '#3730a3', color: '#fff', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', display: 'inline-block' }}
                            >
                                {selectedImage ? 'Change Image' : 'Select Book Photo'}
                            </label>
                            {imagePreview && (
                                <div style={{ marginTop: '1rem', position: 'relative' }}>
                                    <img src={imagePreview} alt="Preview" style={{ maxHeight: '180px', margin: '0 auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }} />
                                    <p style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>✔ Image Loaded ({selectedImage?.name})</p>
                                </div>
                            )}
                        </div>

                        {/* Raw Text Paste Box */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <FileText size={16} />
                                Or Paste Raw Exercise Text from Web / Notes
                            </label>
                            <textarea
                                rows="8"
                                placeholder={`1. Which of the following is a base unit? (a) Pascal (b) Kilogram (c) Newton (d) Watt\n2. Define velocity.\n3. What is meant by inertia?`}
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                                style={{ flex: 1, width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem', resize: 'vertical' }}
                            />
                        </div>
                    </div>

                    {/* Error / Success Messages */}
                    {ingestErrorMsg && (
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={18} />
                            {ingestErrorMsg}
                        </div>
                    )}
                    {ingestSuccessMsg && (
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle2 size={18} />
                            {ingestSuccessMsg}
                        </div>
                    )}

                    {/* Action Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button
                            onClick={handleRunAIExtraction}
                            disabled={isParsingAI}
                            style={{
                                padding: '0.75rem 1.75rem',
                                borderRadius: '10px',
                                fontWeight: '700',
                                fontSize: '0.95rem',
                                cursor: isParsingAI ? 'not-allowed' : 'pointer',
                                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                                color: '#fff',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                boxShadow: '0 4px 14px rgba(236, 72, 153, 0.3)'
                            }}
                        >
                            {isParsingAI ? (
                                <>
                                    <RefreshCw className="animate-spin" size={18} />
                                    AI Scanning & Extracting...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    Scan & Extract Questions (AI)
                                </>
                            )}
                        </button>
                    </div>

                    {/* AI Preview & Edit Table */}
                    {parsedDrafts.length > 0 && (
                        <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Eye size={18} />
                                    Extracted Questions Preview ({parsedDrafts.length})
                                </h3>
                                <button
                                    onClick={handleSaveDraftsToDatabase}
                                    style={{
                                        padding: '0.6rem 1.4rem',
                                        borderRadius: '8px',
                                        background: '#10b981',
                                        color: '#fff',
                                        fontWeight: '700',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <Save size={16} />
                                    Commit & Save All ({parsedDrafts.length}) to Question Bank
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {parsedDrafts.map((q, idx) => (
                                    <div key={q.id || idx} style={{ background: '#0f172a', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: q.type === 'mcq' ? '#3b82f6' : q.type === 'short' ? '#10b981' : '#f59e0b', color: '#fff', fontWeight: '700', textTransform: 'uppercase' }}>
                                                {q.type} ({q.marks} Mark{q.marks > 1 ? 's' : ''})
                                            </span>
                                            <button
                                                onClick={() => setParsedDrafts(prev => prev.filter((_, i) => i !== idx))}
                                                style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                                                title="Remove this draft question"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <p style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                            <span style={{ color: '#6366f1' }}>Q{idx + 1}: </span> {q.question}
                                        </p>
                                        {q.questionUrdu && (
                                            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', direction: 'rtl', marginBottom: '0.5rem' }}>
                                                {q.questionUrdu}
                                            </p>
                                        )}

                                        {q.type === 'mcq' && q.options?.length > 0 && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                {q.options.map((opt, oIdx) => (
                                                    <div key={oIdx} style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', borderRadius: '6px', background: opt === q.correctAnswer ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)', border: '1px solid ' + (opt === q.correctAnswer ? '#10b981' : 'rgba(255,255,255,0.05)'), color: opt === q.correctAnswer ? '#34d399' : '#94a3b8' }}>
                                                        <strong>{String.fromCharCode(65 + oIdx)}:</strong> {opt} {opt === q.correctAnswer && '✔'}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {q.type !== 'mcq' && q.correctAnswer && (
                                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                                <strong style={{ color: '#10b981' }}>Model Answer:</strong> {q.correctAnswer}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: BROWSE & SEARCH QUESTIONS */}
            {activeTab === 'browse' && (
                <div>
                    {/* Filters Bar */}
                    <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.5rem', backdropFilter: 'blur(10px)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Board</label>
                                <select
                                    value={selectedCurriculum}
                                    onChange={(e) => setSelectedCurriculum(e.target.value)}
                                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}
                                >
                                    {curriculums.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Class</label>
                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}
                                >
                                    {ALL_CLASSES.map(c => <option key={c} value={c}>{c === 'Nursery' || c === 'Prep' ? c : `Class ${c}`}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Subject</label>
                                <select
                                    value={selectedSubject}
                                    onChange={(e) => setSelectedSubject(e.target.value)}
                                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}
                                >
                                    {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Chapter Number</label>
                                <select
                                    value={selectedChapter}
                                    onChange={(e) => setSelectedChapter(e.target.value)}
                                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}
                                >
                                    <option value="">All Chapters</option>
                                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={String(n)}>Chapter {n}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Question Type</label>
                                <select
                                    value={selectedTypeFilter}
                                    onChange={(e) => setSelectedTypeFilter(e.target.value)}
                                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}
                                >
                                    <option value="all">All Types</option>
                                    <option value="mcq">MCQs</option>
                                    <option value="short">Short Questions</option>
                                    <option value="long">Long Questions</option>
                                </select>
                            </div>
                        </div>

                        {/* Search bar & Refresh */}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <Search size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                                <input
                                    type="text"
                                    placeholder="Search question keyword in English or Urdu..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.5rem 0.5rem 0.5rem 2.2rem', borderRadius: '6px', fontSize: '0.85rem' }}
                                />
                            </div>
                            <button
                                onClick={fetchCurriculumsAndQuestions}
                                style={{ padding: '0.5rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                            >
                                <RefreshCw size={14} className={loadingQuestions ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Question List View */}
                    {loadingQuestions ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                            <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', color: '#6366f1' }} />
                            Loading Question Bank...
                        </div>
                    ) : filteredQuestions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(30,41,59,0.4)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            <BookOpen size={40} color="#64748b" style={{ margin: '0 auto 1rem' }} />
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#cbd5e1' }}>No Questions Found</h3>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', marginBottom: '1.25rem' }}>
                                There are no questions matching this filter. Switch to "AI Vision / OCR Ingest" to add new questions in seconds.
                            </p>
                            <button
                                onClick={() => setActiveTab('ai-ingest')}
                                style={{ padding: '0.6rem 1.2rem', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <Sparkles size={16} />
                                Ingest Questions with AI
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
                                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                    Showing <strong>{filteredQuestions.length}</strong> questions in {selectedSubject} (Class {selectedClass})
                                </span>
                            </div>

                            {filteredQuestions.map((q, idx) => (
                                <div key={q.id} style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.25rem', backdropFilter: 'blur(8px)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: q.type === 'mcq' ? '#3b82f6' : q.type === 'short' ? '#10b981' : '#f59e0b', color: '#fff', fontWeight: '700', textTransform: 'uppercase' }}>
                                                {q.type} ({q.marks} Mark{q.marks > 1 ? 's' : ''})
                                            </span>
                                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                                                Ch {q.chapterNumber}: {q.chapterName}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc' }}>
                                                {q.difficulty}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => handleDeleteQuestion(q.id)}
                                            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}
                                            title="Delete question"
                                            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#f8fafc', marginBottom: '0.35rem' }}>
                                        <span style={{ color: '#818cf8', marginRight: '0.35rem' }}>#{idx + 1}</span> {q.question}
                                    </h4>

                                    {q.questionUrdu && (
                                        <p style={{ fontSize: '0.9rem', color: '#cbd5e1', direction: 'rtl', marginBottom: '0.6rem' }}>
                                            {q.questionUrdu}
                                        </p>
                                    )}

                                    {q.type === 'mcq' && q.options?.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            {q.options.map((opt, optIdx) => (
                                                <div key={optIdx} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', borderRadius: '6px', background: opt === q.correctAnswer ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.6)', border: '1px solid ' + (opt === q.correctAnswer ? '#10b981' : 'rgba(255,255,255,0.05)'), color: opt === q.correctAnswer ? '#34d399' : '#94a3b8' }}>
                                                    <strong>{String.fromCharCode(65 + optIdx)}:</strong> {opt} {opt === q.correctAnswer && '✔'}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {q.type !== 'mcq' && q.correctAnswer && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(15,23,42,0.5)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                                            <span style={{ color: '#10b981', fontWeight: '600' }}>Answer / Key: </span>
                                            {q.correctAnswer}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default QuestionBank;
