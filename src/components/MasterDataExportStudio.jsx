import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    query,
    where,
    addDoc,
    serverTimestamp
} from 'firebase/firestore';
import {
    Download, Database, FileSpreadsheet, Archive, CheckCircle2,
    AlertCircle, Loader2, Users, GraduationCap, DollarSign,
    Layers, ShieldCheck, Package, RefreshCw, ArrowDownToLine,
    Sparkles, AlertTriangle, Lock, History, ShieldAlert, ScanSearch
} from 'lucide-react';
import {
    formatSafeDate,
    downloadSingleCSV,
    exportMultiSheetExcel,
    exportZipArchive,
    arrayToCSV
} from '../utils/exportHelpers';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const PRESET_REASONS = [
    'Emergency Principal Request',
    'Pre-Deletion Master Backup',
    'Account Locked / Data Handover',
    'Technical Support & Audit'
];

/**
 * Strict Owner-Only check:
 * Only allows the true Master Admin Owner account — excludes BDOs, Managers, Accountants, and sub-admins.
 */
export const checkStrictMasterOwner = (user, adminProfile, isBdo) => {
    if (!user || isBdo) return false;
    const roleType = (adminProfile?.roleType || '').toLowerCase();
    const roleTitle = (adminProfile?.roleTitle || '').toLowerCase();
    if (
        roleType === 'bdo' ||
        roleTitle.includes('bdo') ||
        roleTitle.includes('manager') ||
        roleTitle.includes('accountant') ||
        roleTitle.includes('support')
    ) {
        return false;
    }

    return Boolean(
        user.uid === 'K1T1CwRoTdYtQJDCRNEc0NK9vjt2' ||
        user.email === 'admin@system.local' ||
        adminProfile?.isMasterAdmin === true ||
        adminProfile?.role === 'master_admin'
    );
};

export default function MasterDataExportStudio({ schoolId, school }) {
    const { user, adminProfile, isBdo } = useAdminAuth();
    const isStrictOwner = checkStrictMasterOwner(user, adminProfile, isBdo);

    // Manual Scan States (Zero unnecessary reads on mount!)
    const [hasScanned, setHasScanned] = useState(false);
    const [statsLoading, setStatsLoading] = useState(false);
    const [counts, setCounts] = useState({
        students: 0,
        teachers: 0,
        classes: 0,
        feeTransactions: 0,
        parents: 0,
        storeItems: 0
    });
    const [schoolProfile, setSchoolProfile] = useState(school || null);

    // Export Progress & Feedback States
    const [exportingCategory, setExportingCategory] = useState(null);
    const [progressStatus, setProgressStatus] = useState('');
    const [progressPercent, setProgressPercent] = useState(0);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Audit Log History
    const [auditLogs, setAuditLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    // Confirmation + Reason Modal State
    const [confirmModal, setConfirmModal] = useState({
        open: false,
        actionType: null, // 'all_excel' | 'all_zip' | 'category'
        categoryKey: null,
        format: null,
        label: ''
    });
    const [exportReason, setExportReason] = useState(PRESET_REASONS[0]);
    const [customReason, setCustomReason] = useState('');

    // Fetch Audit Logs for this school (lightweight query)
    const fetchAuditLogs = useCallback(async () => {
        if (!schoolId || !isStrictOwner) return;
        setLoadingLogs(true);
        try {
            const q = query(
                collection(db, 'master_export_audit_logs'),
                where('schoolId', '==', schoolId)
            );
            const snap = await getDocs(q);
            const list = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => {
                    const tA = a.exportedAt?.seconds || (a.createdAtIso ? new Date(a.createdAtIso).getTime() / 1000 : 0);
                    const tB = b.exportedAt?.seconds || (b.createdAtIso ? new Date(b.createdAtIso).getTime() / 1000 : 0);
                    return tB - tA;
                })
                .slice(0, 15);
            setAuditLogs(list);
        } catch (err) {
            console.warn('[MasterDataExportStudio] Could not load audit logs:', err);
        } finally {
            setLoadingLogs(false);
        }
    }, [schoolId, isStrictOwner]);

    useEffect(() => {
        fetchAuditLogs();
    }, [fetchAuditLogs]);

    // Write Export Audit Log to Firestore (non-blocking if fails)
    const writeAuditLog = async ({ exportType, format, reason, recordSummary, fileName }) => {
        try {
            await addDoc(collection(db, 'master_export_audit_logs'), {
                schoolId,
                schoolName: schoolProfile?.name || school?.name || schoolId,
                exportedByUid: user?.uid || 'unknown',
                exportedByName: adminProfile?.name || user?.displayName || 'Master Admin',
                exportedByEmail: user?.email || adminProfile?.email || '',
                exportType,
                format,
                reason: reason || 'Master Admin Emergency Backup',
                fileName: fileName || '',
                recordSummary: recordSummary || '',
                createdAtIso: new Date().toISOString(),
                exportedAt: serverTimestamp()
            });
            fetchAuditLogs();
        } catch (err) {
            console.warn('[MasterDataExportStudio] Audit log write warning:', err);
        }
    };

    // 1. Manual Quick Stats Scan (triggered ONLY when Master Admin clicks Scan)
    const handleScanRecords = useCallback(async () => {
        if (!schoolId) return;
        setStatsLoading(true);
        setErrorMessage('');
        try {
            const profSnap = await getDoc(doc(db, 'schools', schoolId, 'settings', 'profile')).catch(() => null);
            if (profSnap && profSnap.exists()) {
                setSchoolProfile({ ...(school || {}), ...profSnap.data() });
            } else if (school) {
                setSchoolProfile(school);
            }

            const classesSnap = await getDocs(query(collection(db, `schools/${schoolId}/classes`))).catch(() => ({ docs: [] }));
            const classDocs = classesSnap.docs.filter(d => d.id !== 'action_metadata');

            const studentIdSet = new Set();
            for (const cDoc of classDocs) {
                const stdsSnap = await getDocs(collection(db, `schools/${schoolId}/classes/${cDoc.id}/students`)).catch(() => ({ docs: [] }));
                stdsSnap.docs.forEach(s => studentIdSet.add(s.id));
            }
            const rootStudentsSnap = await getDocs(query(collection(db, `schools/${schoolId}/students`))).catch(() => ({ docs: [] }));
            rootStudentsSnap.docs.forEach(s => studentIdSet.add(s.id));

            const [teachersSnap, parentsSnap, feeSnap, storeSnap] = await Promise.all([
                getDocs(query(collection(db, `schools/${schoolId}/teachers`))).catch(() => ({ docs: [] })),
                getDocs(query(collection(db, `schools/${schoolId}/parents`))).catch(() => ({ docs: [] })),
                getDocs(query(collection(db, `schools/${schoolId}/feeTransactions`))).catch(() => ({ docs: [] })),
                getDocs(query(collection(db, `schools/${schoolId}/store_items`))).catch(() => ({ docs: [] }))
            ]);

            setCounts({
                students: studentIdSet.size,
                teachers: teachersSnap.docs.length,
                classes: classDocs.length,
                feeTransactions: feeSnap.docs.length,
                parents: parentsSnap.docs.length,
                storeItems: storeSnap.docs.length
            });
            setHasScanned(true);
        } catch (err) {
            console.warn('[MasterDataExportStudio] Scan error:', err);
            setErrorMessage('Failed to scan school records: ' + (err.message || 'Unknown error'));
        } finally {
            setStatsLoading(false);
        }
    }, [schoolId, school]);

    // 2. Comprehensive Data Fetcher (Identical schema to Principal App DataExportStudio)
    const fetchAllSchoolData = async (onProgress = () => {}) => {
        onProgress(10, 'Scanning classes & school structure...');

        const profSnap = await getDoc(doc(db, 'schools', schoolId, 'settings', 'profile')).catch(() => null);
        const mergedProfile = profSnap && profSnap.exists()
            ? { ...(school || {}), ...profSnap.data() }
            : (schoolProfile || school || {});

        const classesSnap = await getDocs(query(collection(db, `schools/${schoolId}/classes`)));
        const classDocs = classesSnap.docs.filter(d => d.id !== 'action_metadata');
        const classMap = {};
        const classesList = classDocs.map(d => {
            const data = d.data();
            const cObj = {
                id: d.id,
                className: data.name || data.className || d.id,
                section: data.section || '',
                tuitionFee: data.monthlyFee || data.tuitionFee || 0,
                incharge: data.incharge || data.teacherName || '',
                room: data.roomNumber || data.room || ''
            };
            classMap[d.id] = cObj;
            return cObj;
        });

        onProgress(30, 'Retrieving all student records...');
        const studentMap = new Map();

        for (const cDoc of classDocs) {
            try {
                const sSnap = await getDocs(collection(db, `schools/${schoolId}/classes/${cDoc.id}/students`));
                sSnap.docs.forEach(docSnap => {
                    const sData = docSnap.data();
                    const sId = docSnap.id;
                    const cInfo = classMap[cDoc.id] || {};
                    studentMap.set(sId, {
                        admissionNo: sData.admissionNo || sData.regNo || sData.grNo || sId,
                        rollNo: sData.rollNo || '',
                        fullName: sData.name || sData.fullName || sData.studentName || 'Student',
                        className: sData.className || cInfo.className || '',
                        section: sData.section || cInfo.section || '',
                        fatherName: sData.fatherName || sData.parentDetails?.fatherName || sData.parentName || '',
                        fatherPhone: sData.fatherPhone || sData.phone || sData.parentDetails?.phone || sData.whatsapp || '',
                        fatherCnic: sData.fatherCnic || sData.cnic || sData.parentDetails?.cnic || '',
                        gender: sData.gender || '',
                        dob: formatSafeDate(sData.dob || sData.dateOfBirth),
                        admissionDate: formatSafeDate(sData.admissionDate || sData.joiningDate || sData.createdAt),
                        monthlyFee: sData.monthlyFee || sData.tuitionFee || cInfo.tuitionFee || 0,
                        discount: sData.discount || sData.concession || 0,
                        currentBalance: sData.dues || sData.balance || sData.currentBalance || 0,
                        status: sData.status || (sData.isLeft ? 'Left' : 'Active'),
                        address: sData.address || sData.homeAddress || '',
                        religion: sData.religion || 'Islam'
                    });
                });
            } catch (err) {
                console.warn(`Could not read students from class ${cDoc.id}:`, err);
            }
        }

        try {
            const rootStudentsSnap = await getDocs(query(collection(db, `schools/${schoolId}/students`)));
            rootStudentsSnap.docs.forEach(docSnap => {
                const sData = docSnap.data();
                const sId = docSnap.id;
                if (!studentMap.has(sId)) {
                    const cInfo = classMap[sData.classId] || {};
                    studentMap.set(sId, {
                        admissionNo: sData.admissionNo || sData.regNo || sData.grNo || sId,
                        rollNo: sData.rollNo || '',
                        fullName: sData.name || sData.fullName || sData.studentName || 'Student',
                        className: sData.className || cInfo.className || '',
                        section: sData.section || cInfo.section || '',
                        fatherName: sData.fatherName || sData.parentDetails?.fatherName || sData.parentName || '',
                        fatherPhone: sData.fatherPhone || sData.phone || sData.parentDetails?.phone || sData.whatsapp || '',
                        fatherCnic: sData.fatherCnic || sData.cnic || sData.parentDetails?.cnic || '',
                        gender: sData.gender || '',
                        dob: formatSafeDate(sData.dob || sData.dateOfBirth),
                        admissionDate: formatSafeDate(sData.admissionDate || sData.joiningDate || sData.createdAt),
                        monthlyFee: sData.monthlyFee || sData.tuitionFee || cInfo.tuitionFee || 0,
                        discount: sData.discount || sData.concession || 0,
                        currentBalance: sData.dues || sData.balance || sData.currentBalance || 0,
                        status: sData.status || (sData.isLeft ? 'Left' : 'Active'),
                        address: sData.address || sData.homeAddress || '',
                        religion: sData.religion || 'Islam'
                    });
                }
            });
        } catch {
            // root fallback silent
        }

        const studentsList = Array.from(studentMap.values());
        const classCountMap = {};
        studentsList.forEach(s => {
            classCountMap[s.className] = (classCountMap[s.className] || 0) + 1;
        });
        const formattedClasses = classesList.map(c => ({
            ...c,
            enrolledStudents: classCountMap[c.className] || 0
        }));

        onProgress(55, 'Gathering teachers & faculty details...');
        const teachersSnap = await getDocs(query(collection(db, `schools/${schoolId}/teachers`))).catch(() => ({ docs: [] }));
        const teachersList = teachersSnap.docs.map(d => {
            const t = d.data();
            return {
                teacherId: d.id,
                fullName: t.name || t.fullName || 'Teacher',
                designation: t.designation || t.role || 'Teacher',
                phone: t.phone || t.contactNo || t.mobile || '',
                cnic: t.cnic || '',
                monthlySalary: t.salary || t.monthlySalary || 0,
                qualification: t.qualification || t.education || '',
                joiningDate: formatSafeDate(t.joiningDate || t.dateOfJoining || t.createdAt),
                assignedClasses: Array.isArray(t.assignedClasses) ? t.assignedClasses.join(', ') : (t.assignedClasses || ''),
                status: t.status || 'Active',
                address: t.address || ''
            };
        });

        onProgress(70, 'Compiling fee receipts & transaction history...');
        const feeSnap = await getDocs(query(collection(db, `schools/${schoolId}/feeTransactions`))).catch(() => ({ docs: [] }));
        const feeList = feeSnap.docs.map(d => {
            const f = d.data();
            return {
                receiptNo: f.receiptNo || d.id,
                studentName: f.studentName || f.student?.name || '',
                className: f.className || f.student?.className || '',
                rollNo: f.rollNo || f.student?.rollNo || '',
                paidAmount: f.amount || f.paidAmount || 0,
                paymentDate: formatSafeDate(f.date || f.paymentDate || f.timestamp || f.createdAt),
                paymentMethod: f.method || f.paymentMethod || 'Cash',
                monthsCovered: f.monthsCovered || f.month || '',
                duesRemaining: f.balanceRemaining !== undefined ? f.balanceRemaining : (f.newBalance || 0),
                collectedBy: f.collectedBy || f.cashier || f.receivedBy || 'Admin'
            };
        });

        onProgress(85, 'Fetching parent contacts & linked students...');
        const parentsSnap = await getDocs(query(collection(db, `schools/${schoolId}/parents`))).catch(() => ({ docs: [] }));
        const parentsList = parentsSnap.docs.map(d => {
            const p = d.data();
            const linked = Array.isArray(p.linkedStudents)
                ? p.linkedStudents.map(s => typeof s === 'object' ? (s.name || s.studentId) : s).join('; ')
                : (p.linkedStudents || '');
            return {
                parentId: d.id,
                fatherName: p.name || p.fatherName || '',
                phone: p.phone || p.mobile || p.contact || '',
                cnic: p.cnic || '',
                occupation: p.occupation || '',
                address: p.address || '',
                linkedStudents: linked
            };
        });

        onProgress(92, 'Checking inventory & store records...');
        const storeSnap = await getDocs(query(collection(db, `schools/${schoolId}/store_items`))).catch(() => ({ docs: [] }));
        const storeList = storeSnap.docs.map(d => {
            const item = d.data();
            return {
                itemId: d.id,
                itemName: item.name || item.itemName || '',
                category: item.category || 'General',
                salePrice: item.salePrice || item.price || 0,
                costPrice: item.costPrice || 0,
                inStock: item.stock || item.quantity || 0
            };
        });

        onProgress(98, 'Formatting datasets for export...');
        setCounts({
            students: studentsList.length,
            teachers: teachersList.length,
            classes: formattedClasses.length,
            feeTransactions: feeList.length,
            parents: parentsList.length,
            storeItems: storeList.length
        });
        setHasScanned(true);

        return {
            classes: formattedClasses,
            students: studentsList,
            teachers: teachersList,
            feeTransactions: feeList,
            parents: parentsList,
            storeItems: storeList,
            schoolProfile: mergedProfile
        };
    };

    const getSafeSchoolPrefix = () => {
        const name = schoolProfile?.name || school?.name || schoolId || 'School';
        return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 25);
    };

    // 3. Handler: Master Excel Export
    const handleExportMasterExcel = async (reason) => {
        setExportingCategory('all_excel');
        setProgressPercent(5);
        setProgressStatus('Initializing complete school backup...');
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const data = await fetchAllSchoolData((pct, msg) => {
                setProgressPercent(pct);
                setProgressStatus(msg);
            });

            setProgressStatus('Generating Multi-Sheet Excel Workbook...');
            setProgressPercent(99);

            const schoolName = getSafeSchoolPrefix();
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `${schoolName}_Master_Export_${dateStr}.xlsx`;

            const sheets = {
                'Students Master': data.students,
                'Teachers & Staff': data.teachers,
                'Classes & Structure': data.classes,
                'Fee History': data.feeTransactions,
                'Parents Directory': data.parents
            };
            if (data.storeItems.length > 0) {
                sheets['Store Inventory'] = data.storeItems;
            }

            exportMultiSheetExcel(fileName, sheets);

            await writeAuditLog({
                exportType: 'Complete Master Excel',
                format: 'XLSX',
                reason,
                fileName,
                recordSummary: `${data.students.length} Students, ${data.teachers.length} Teachers, ${data.feeTransactions.length} Receipts`
            });

            setProgressPercent(100);
            setSuccessMessage(`Success! Multi-Sheet Excel "${fileName}" downloaded and logged in Audit History.`);
        } catch (err) {
            console.error('[MasterDataExportStudio] Export Excel failed:', err);
            setErrorMessage('Export failed: ' + (err.message || 'Unknown network error'));
        } finally {
            setExportingCategory(null);
            setProgressStatus('');
        }
    };

    // 4. Handler: Full ZIP Archive Export
    const handleExportZipArchive = async (reason) => {
        setExportingCategory('all_zip');
        setProgressPercent(5);
        setProgressStatus('Initiating full archive package...');
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const data = await fetchAllSchoolData((pct, msg) => {
                setProgressPercent(pct);
                setProgressStatus(msg);
            });

            setProgressStatus('Compressing CSV tables and JSON into .ZIP archive...');
            setProgressPercent(95);

            const schoolName = getSafeSchoolPrefix();
            const dateStr = new Date().toISOString().split('T')[0];
            const zipName = `${schoolName}_Full_System_Backup_${dateStr}.zip`;

            const readmeText = `===========================================================
SCHOOL DATA SOVEREIGNTY BACKUP ARCHIVE (MASTER ADMIN EXPORT)
School: ${schoolProfile?.name || school?.name || 'School Management System'}
School ID: ${schoolId}
Export Date: ${new Date().toLocaleString()}
Exported By: ${adminProfile?.name || user?.email || 'Master Admin'}
Reason: ${reason}
Generated by: MAI School Management System (Super Admin Console)
===========================================================

This archive contains 100% of the school's data in universal standard formats:

1. Students.csv           - Master Student Roster (Roll No, Parents, Fees, Contacts)
2. Teachers.csv           - Faculty & Staff Directory (Designations, Salaries, Phone)
3. Classes.csv            - Class Structure, Sections, Monthly Fees
4. Fee_Transactions.csv   - Complete Receipt Logs & Collection History
5. Parents.csv            - Parent Directory & Linked Students
6. Store_Inventory.csv    - School Bookstore & Uniform Stock
7. Complete_Database.json - Raw JSON data structure for direct software migration

All CSV files are encoded in UTF-8 with BOM for 100% compatibility with
Microsoft Excel, Google Sheets, LibreOffice, and any modern database.
===========================================================`;

            const filesMap = {
                'README_INSTRUCTIONS.txt': readmeText,
                'Students.csv': arrayToCSV(data.students),
                'Teachers.csv': arrayToCSV(data.teachers),
                'Classes.csv': arrayToCSV(data.classes),
                'Fee_Transactions.csv': arrayToCSV(data.feeTransactions),
                'Parents.csv': arrayToCSV(data.parents),
                'Complete_Database.json': JSON.stringify(data, null, 2)
            };

            if (data.storeItems.length > 0) {
                filesMap['Store_Inventory.csv'] = arrayToCSV(data.storeItems);
            }

            exportZipArchive(zipName, filesMap);

            await writeAuditLog({
                exportType: 'Complete System Backup',
                format: 'ZIP (CSVs + JSON)',
                reason,
                fileName: zipName,
                recordSummary: `${data.students.length} Students, ${data.teachers.length} Teachers, ${data.feeTransactions.length} Receipts`
            });

            setProgressPercent(100);
            setSuccessMessage(`Success! Full archive "${zipName}" downloaded and logged in Audit History.`);
        } catch (err) {
            console.error('[MasterDataExportStudio] Export ZIP failed:', err);
            setErrorMessage('Archive export failed: ' + (err.message || 'Unknown network error'));
        } finally {
            setExportingCategory(null);
            setProgressStatus('');
        }
    };

    // 5. Handler: Single Category Export (Excel or CSV)
    const handleCategoryExport = async (categoryKey, format, reason) => {
        setExportingCategory(`${categoryKey}_${format}`);
        setErrorMessage('');
        setSuccessMessage('');
        setProgressStatus(`Exporting ${categoryKey}...`);

        try {
            const schoolName = getSafeSchoolPrefix();
            const dateStr = new Date().toISOString().split('T')[0];
            let rows = [];
            let sheetName = 'Export';
            let fileName = `${schoolName}_${categoryKey}_${dateStr}`;

            if (categoryKey === 'students') {
                sheetName = 'Students';
                fileName = `${schoolName}_Students_${dateStr}`;
                const classesSnap = await getDocs(query(collection(db, `schools/${schoolId}/classes`)));
                const cDocs = classesSnap.docs.filter(d => d.id !== 'action_metadata');
                const studentMap = new Map();

                for (const cDoc of cDocs) {
                    const cData = cDoc.data();
                    const sSnap = await getDocs(collection(db, `schools/${schoolId}/classes/${cDoc.id}/students`));
                    sSnap.docs.forEach(docSnap => {
                        const sData = docSnap.data();
                        studentMap.set(docSnap.id, {
                            admissionNo: sData.admissionNo || sData.regNo || docSnap.id,
                            rollNo: sData.rollNo || '',
                            fullName: sData.name || sData.fullName || 'Student',
                            className: sData.className || cData.name || '',
                            section: sData.section || cData.section || '',
                            fatherName: sData.fatherName || sData.parentDetails?.fatherName || '',
                            fatherPhone: sData.fatherPhone || sData.phone || sData.parentDetails?.phone || '',
                            fatherCnic: sData.fatherCnic || sData.cnic || '',
                            gender: sData.gender || '',
                            dob: formatSafeDate(sData.dob || sData.dateOfBirth),
                            admissionDate: formatSafeDate(sData.admissionDate || sData.joiningDate),
                            monthlyFee: sData.monthlyFee || sData.tuitionFee || cData.monthlyFee || 0,
                            discount: sData.discount || sData.concession || 0,
                            balanceDues: sData.dues || sData.balance || 0,
                            status: sData.status || (sData.isLeft ? 'Left' : 'Active'),
                            address: sData.address || ''
                        });
                    });
                }
                const rootSnap = await getDocs(query(collection(db, `schools/${schoolId}/students`))).catch(() => ({ docs: [] }));
                rootSnap.docs.forEach(docSnap => {
                    if (!studentMap.has(docSnap.id)) {
                        const sData = docSnap.data();
                        studentMap.set(docSnap.id, {
                            admissionNo: sData.admissionNo || sData.regNo || docSnap.id,
                            rollNo: sData.rollNo || '',
                            fullName: sData.name || sData.fullName || 'Student',
                            className: sData.className || '',
                            section: sData.section || '',
                            fatherName: sData.fatherName || sData.parentDetails?.fatherName || '',
                            fatherPhone: sData.fatherPhone || sData.phone || sData.parentDetails?.phone || '',
                            fatherCnic: sData.fatherCnic || sData.cnic || '',
                            gender: sData.gender || '',
                            dob: formatSafeDate(sData.dob || sData.dateOfBirth),
                            admissionDate: formatSafeDate(sData.admissionDate || sData.joiningDate),
                            monthlyFee: sData.monthlyFee || sData.tuitionFee || 0,
                            discount: sData.discount || sData.concession || 0,
                            balanceDues: sData.dues || sData.balance || 0,
                            status: sData.status || (sData.isLeft ? 'Left' : 'Active'),
                            address: sData.address || ''
                        });
                    }
                });
                rows = Array.from(studentMap.values());
            } else if (categoryKey === 'teachers') {
                sheetName = 'Teachers';
                fileName = `${schoolName}_Teachers_${dateStr}`;
                const tSnap = await getDocs(query(collection(db, `schools/${schoolId}/teachers`)));
                rows = tSnap.docs.map(d => {
                    const t = d.data();
                    return {
                        fullName: t.name || t.fullName || 'Teacher',
                        designation: t.designation || t.role || 'Teacher',
                        phone: t.phone || t.contactNo || '',
                        cnic: t.cnic || '',
                        monthlySalary: t.salary || t.monthlySalary || 0,
                        qualification: t.qualification || '',
                        joiningDate: formatSafeDate(t.joiningDate || t.createdAt),
                        assignedClasses: Array.isArray(t.assignedClasses) ? t.assignedClasses.join(', ') : (t.assignedClasses || ''),
                        status: t.status || 'Active'
                    };
                });
            } else if (categoryKey === 'fees') {
                sheetName = 'Fee Transactions';
                fileName = `${schoolName}_Fee_Transactions_${dateStr}`;
                const fSnap = await getDocs(query(collection(db, `schools/${schoolId}/feeTransactions`)));
                rows = fSnap.docs.map(d => {
                    const f = d.data();
                    return {
                        receiptNo: f.receiptNo || d.id,
                        studentName: f.studentName || '',
                        className: f.className || '',
                        rollNo: f.rollNo || '',
                        paidAmount: f.amount || f.paidAmount || 0,
                        paymentDate: formatSafeDate(f.date || f.paymentDate || f.timestamp),
                        paymentMethod: f.method || f.paymentMethod || 'Cash',
                        monthCovered: f.monthsCovered || f.month || '',
                        remainingBalance: f.balanceRemaining || f.newBalance || 0,
                        collectedBy: f.collectedBy || f.cashier || 'Admin'
                    };
                });
            } else if (categoryKey === 'classes') {
                sheetName = 'Classes';
                fileName = `${schoolName}_Classes_${dateStr}`;
                const cSnap = await getDocs(query(collection(db, `schools/${schoolId}/classes`)));
                rows = cSnap.docs.filter(d => d.id !== 'action_metadata').map(d => {
                    const c = d.data();
                    return {
                        className: c.name || c.className || '',
                        section: c.section || '',
                        monthlyTuitionFee: c.monthlyFee || c.tuitionFee || 0,
                        classTeacher: c.incharge || c.teacherName || '',
                        roomNumber: c.roomNumber || ''
                    };
                });
            } else if (categoryKey === 'parents') {
                sheetName = 'Parents';
                fileName = `${schoolName}_Parents_${dateStr}`;
                const pSnap = await getDocs(query(collection(db, `schools/${schoolId}/parents`)));
                rows = pSnap.docs.map(d => {
                    const p = d.data();
                    return {
                        fatherName: p.name || p.fatherName || '',
                        phone: p.phone || p.mobile || '',
                        cnic: p.cnic || '',
                        occupation: p.occupation || '',
                        address: p.address || ''
                    };
                });
            } else if (categoryKey === 'store') {
                sheetName = 'Store Inventory';
                fileName = `${schoolName}_Store_Inventory_${dateStr}`;
                const sSnap = await getDocs(query(collection(db, `schools/${schoolId}/store_items`)));
                rows = sSnap.docs.map(d => {
                    const item = d.data();
                    return {
                        itemName: item.name || '',
                        category: item.category || 'General',
                        salePrice: item.salePrice || item.price || 0,
                        costPrice: item.costPrice || 0,
                        inStock: item.stock || item.quantity || 0
                    };
                });
            }

            if (rows.length === 0) {
                setErrorMessage(`No records found for ${categoryKey} to export.`);
                return;
            }

            const finalFileName = format === 'excel' ? `${fileName}.xlsx` : `${fileName}.csv`;
            if (format === 'excel') {
                exportMultiSheetExcel(finalFileName, { [sheetName]: rows });
            } else {
                downloadSingleCSV(finalFileName, rows);
            }

            await writeAuditLog({
                exportType: `${sheetName} Export`,
                format: format === 'excel' ? 'XLSX' : 'CSV',
                reason,
                fileName: finalFileName,
                recordSummary: `${rows.length} records`
            });

            setSuccessMessage(`Success! "${finalFileName}" downloaded (${rows.length} records) and logged in Audit History.`);
        } catch (err) {
            console.error('[MasterDataExportStudio] Category export error:', err);
            setErrorMessage(`Failed to export ${categoryKey}: ` + (err.message || 'Network error'));
        } finally {
            setExportingCategory(null);
            setProgressStatus('');
        }
    };

    const openConfirmModal = ({ actionType, categoryKey = null, format = null, label }) => {
        setExportReason(PRESET_REASONS[0]);
        setCustomReason('');
        setConfirmModal({
            open: true,
            actionType,
            categoryKey,
            format,
            label
        });
    };

    const handleConfirmProceed = () => {
        const finalReason = exportReason === 'custom'
            ? (customReason.trim() || 'Master Admin Emergency Export')
            : exportReason;

        const { actionType, categoryKey, format } = confirmModal;
        setConfirmModal({ open: false, actionType: null, categoryKey: null, format: null, label: '' });

        if (actionType === 'all_excel') {
            handleExportMasterExcel(finalReason);
        } else if (actionType === 'all_zip') {
            handleExportZipArchive(finalReason);
        } else if (actionType === 'category') {
            handleCategoryExport(categoryKey, format, finalReason);
        }
    };

    // Strict Access Denied Fallback
    if (!isStrictOwner) {
        return (
            <div style={{
                padding: '32px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#991B1B'
            }}>
                <ShieldAlert size={36} style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: '800', fontSize: '15px' }}>Restricted: Master Admin Owner Only</div>
                <div style={{ fontSize: '12.5px', marginTop: '4px', color: '#7F1D1D' }}>
                    School data backup and export privileges are strictly reserved for the Master Admin Owner account.
                </div>
            </div>
        );
    }

    const exportCategories = [
        {
            key: 'students',
            title: 'Students Master Roster',
            desc: 'Complete student directory with roll numbers, admission details, parent contacts, fees, and dues.',
            icon: GraduationCap,
            bg: '#EEF2FF',
            color: '#4F46E5',
            border: '#C7D2FE',
            count: counts.students,
            unit: 'Students'
        },
        {
            key: 'teachers',
            title: 'Teachers & Staff Directory',
            desc: 'All faculty profiles, designations, monthly salaries, phone numbers, CNIC, and joining dates.',
            icon: Users,
            bg: '#F0FDFA',
            color: '#0D9488',
            border: '#99F6E4',
            count: counts.teachers,
            unit: 'Staff'
        },
        {
            key: 'fees',
            title: 'Fee Transactions & Receipts',
            desc: 'Chronological fee payment logs, paid amounts, receipt numbers, payment methods, and balances.',
            icon: DollarSign,
            bg: '#ECFDF5',
            color: '#059669',
            border: '#A7F3D0',
            count: counts.feeTransactions,
            unit: 'Receipts'
        },
        {
            key: 'classes',
            title: 'Classes & Fee Structure',
            desc: 'Registered class levels, sections, base tuition fee schedules, and enrolled student counts.',
            icon: Layers,
            bg: '#FAF5FF',
            color: '#7C3AED',
            border: '#DDD6FE',
            count: counts.classes,
            unit: 'Classes'
        },
        {
            key: 'parents',
            title: 'Parents Contact Directory',
            desc: 'Parent and guardian names, verified phone numbers, CNIC records, addresses, and linked siblings.',
            icon: Users,
            bg: '#EFF6FF',
            color: '#2563EB',
            border: '#BFDBFE',
            count: counts.parents,
            unit: 'Parents'
        },
        {
            key: 'store',
            title: 'Store & Inventory Stock',
            desc: 'School bookstore inventory, uniform stock, retail prices, cost prices, and quantities in hand.',
            icon: Package,
            bg: '#FFFBEB',
            color: '#D97706',
            border: '#FDE68A',
            count: counts.storeItems,
            unit: 'Items'
        }
    ];

    const formatLogTime = (log) => {
        try {
            if (log.exportedAt?.toDate) {
                return log.exportedAt.toDate().toLocaleString();
            }
            if (log.createdAtIso) {
                return new Date(log.createdAtIso).toLocaleString();
            }
        } catch {
            // fallback
        }
        return 'Just now';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* 1. Header Banner */}
            <div style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '10px',
                padding: '18px 20px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #1E3A8A 0%, #4F46E5 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        flexShrink: 0,
                        boxShadow: '0 6px 14px rgba(79, 70, 229, 0.25)'
                    }}>
                        <Database size={24} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>
                                Master Admin Emergency Data Export Studio
                            </h2>
                            <span style={{
                                padding: '2px 9px',
                                fontSize: '11px',
                                fontWeight: '700',
                                borderRadius: '999px',
                                backgroundColor: '#FEF3C7',
                                color: '#92400E',
                                border: '1px solid #FDE68A',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <Lock size={11} /> Owner-Only Access
                            </span>
                            <span style={{
                                padding: '2px 9px',
                                fontSize: '11px',
                                fontWeight: '700',
                                borderRadius: '999px',
                                backgroundColor: '#ECFDF5',
                                color: '#065F46',
                                border: '1px solid #A7F3D0',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <ShieldCheck size={11} /> 100% Read-Only
                            </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#475569' }}>
                            Export complete school data in universal formats (Excel, CSV, ZIP/JSON) for emergency principal support, handovers, or pre-deletion backups.
                        </p>
                    </div>
                </div>

                {/* Manual Scan Button (Prevents unnecessary Firestore reads) */}
                <button
                    type="button"
                    onClick={handleScanRecords}
                    disabled={statsLoading || !!exportingCategory}
                    style={{
                        padding: '9px 16px',
                        borderRadius: '8px',
                        border: hasScanned ? '1px solid #CBD5E1' : '1px solid #4F46E5',
                        backgroundColor: hasScanned ? '#F8FAFC' : '#4F46E5',
                        color: hasScanned ? '#334155' : '#FFFFFF',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        cursor: (statsLoading || exportingCategory) ? 'not-allowed' : 'pointer',
                        opacity: (statsLoading || exportingCategory) ? 0.65 : 1
                    }}
                >
                    {statsLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : hasScanned ? (
                        <RefreshCw size={14} />
                    ) : (
                        <ScanSearch size={15} />
                    )}
                    <span>{statsLoading ? 'Scanning Records...' : hasScanned ? 'Re-Scan Counts' : 'Scan School Records'}</span>
                </button>
            </div>

            {/* Alerts */}
            {errorMessage && (
                <div style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#991B1B',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '13px',
                    fontWeight: '600'
                }}>
                    <AlertCircle size={18} style={{ flexShrink: 0 }} />
                    <span>{errorMessage}</span>
                </div>
            )}
            {successMessage && (
                <div style={{
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    color: '#065F46',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '13px',
                    fontWeight: '600'
                }}>
                    <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* 2. Hero Card: One-Click Complete School Backup */}
            <div style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 55%, #0F172A 100%)',
                borderRadius: '14px',
                padding: '24px',
                color: '#FFFFFF',
                border: '1px solid #312E81',
                boxShadow: '0 12px 24px rgba(15, 23, 42, 0.22)'
            }}>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '20px'
                }}>
                    <div style={{ maxWidth: '620px', flex: '1 1 360px' }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(99, 102, 241, 0.22)',
                            border: '1px solid rgba(129, 140, 248, 0.35)',
                            color: '#C7D2FE',
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            marginBottom: '10px'
                        }}>
                            <Sparkles size={12} /> Full-System Emergency Backup
                        </div>
                        <h3 style={{ margin: '0 0 8px', fontSize: '21px', fontWeight: '800', color: '#FFFFFF' }}>
                            One-Click Complete School Backup
                        </h3>
                        <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#CBD5E1', lineHeight: '1.55' }}>
                            Download 100% of <strong>{school?.name || schoolId}</strong> records in a single unified package — Students, Teachers, Classes, Fee Receipts, Parents, and Store Inventory. Every export requires a reason and is recorded in the Master Audit Log.
                        </p>

                        {/* Quick Count Badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', fontWeight: '600' }}>
                            {!hasScanned ? (
                                <span style={{
                                    padding: '5px 11px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.14)',
                                    color: '#E2E8F0'
                                }}>
                                    Click &quot;Scan School Records&quot; above to preview counts (saves Firestore reads) — or export directly.
                                </span>
                            ) : (
                                <>
                                    <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)' }}>
                                        Students: {counts.students}
                                    </span>
                                    <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)' }}>
                                        Teachers: {counts.teachers}
                                    </span>
                                    <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)' }}>
                                        Classes: {counts.classes}
                                    </span>
                                    <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)' }}>
                                        Receipts: {counts.feeTransactions}
                                    </span>
                                    <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)' }}>
                                        Parents: {counts.parents}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Hero Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '250px' }}>
                        <button
                            type="button"
                            disabled={!!exportingCategory}
                            onClick={() => openConfirmModal({
                                actionType: 'all_excel',
                                label: 'Complete Master Excel (.XLSX)'
                            })}
                            style={{
                                padding: '12px 18px',
                                borderRadius: '10px',
                                border: 'none',
                                background: 'linear-gradient(90deg, #10B981 0%, #0D9488 100%)',
                                color: '#FFFFFF',
                                fontWeight: '800',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                cursor: exportingCategory ? 'not-allowed' : 'pointer',
                                opacity: exportingCategory ? 0.65 : 1,
                                boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)'
                            }}
                        >
                            {exportingCategory === 'all_excel' ? (
                                <>
                                    <Loader2 size={17} className="animate-spin" />
                                    <span>Generating Excel...</span>
                                </>
                            ) : (
                                <>
                                    <FileSpreadsheet size={17} />
                                    <span>Download Master Excel (.XLSX)</span>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            disabled={!!exportingCategory}
                            onClick={() => openConfirmModal({
                                actionType: 'all_zip',
                                label: 'Complete System Backup (.ZIP + JSON)'
                            })}
                            style={{
                                padding: '12px 18px',
                                borderRadius: '10px',
                                border: '1px solid rgba(129, 140, 248, 0.45)',
                                backgroundColor: '#4F46E5',
                                color: '#FFFFFF',
                                fontWeight: '800',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                cursor: exportingCategory ? 'not-allowed' : 'pointer',
                                opacity: exportingCategory ? 0.65 : 1,
                                boxShadow: '0 6px 16px rgba(79, 70, 229, 0.3)'
                            }}
                        >
                            {exportingCategory === 'all_zip' ? (
                                <>
                                    <Loader2 size={17} className="animate-spin" />
                                    <span>Packing ZIP Archive...</span>
                                </>
                            ) : (
                                <>
                                    <Archive size={17} />
                                    <span>Download Full Backup (.ZIP + JSON)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Live Progress Bar */}
                {(exportingCategory === 'all_excel' || exportingCategory === 'all_zip') && (
                    <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(99, 102, 241, 0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#C7D2FE', marginBottom: '6px' }}>
                            <span>{progressStatus || 'Processing export...'}</span>
                            <span>{progressPercent}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#1E293B', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${progressPercent}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #2DD4BF 0%, #6366F1 100%)',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Category-Wise Modular Exports */}
            <div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '8px',
                    marginBottom: '14px'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                            Category-Wise Modular Exports
                        </h3>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                            Export individual school datasets as Microsoft Excel (.xlsx) or Universal UTF-8 CSV.
                        </p>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                        6 Modules
                    </span>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                    gap: '14px'
                }}>
                    {exportCategories.map(cat => {
                        const Icon = cat.icon;
                        const isExportingExcel = exportingCategory === `${cat.key}_excel`;
                        const isExportingCsv = exportingCategory === `${cat.key}_csv`;
                        const isBusy = !!exportingCategory;

                        return (
                            <div
                                key={cat.key}
                                style={{
                                    backgroundColor: '#FFFFFF',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '10px',
                                    padding: '16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: '12px'
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <div style={{
                                            width: '38px',
                                            height: '38px',
                                            borderRadius: '9px',
                                            backgroundColor: cat.bg,
                                            color: cat.color,
                                            border: `1px solid ${cat.border}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Icon size={19} />
                                        </div>
                                        <span style={{
                                            padding: '3px 9px',
                                            borderRadius: '6px',
                                            backgroundColor: '#F1F5F9',
                                            color: '#334155',
                                            fontSize: '11.5px',
                                            fontWeight: '700'
                                        }}>
                                            {statsLoading ? '...' : hasScanned ? `${cat.count} ${cat.unit}` : 'Ready'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{cat.title}</div>
                                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', lineHeight: '1.45' }}>
                                        {cat.desc}
                                    </div>
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '8px',
                                    paddingTop: '10px',
                                    borderTop: '1px solid #F1F5F9'
                                }}>
                                    <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => openConfirmModal({
                                            actionType: 'category',
                                            categoryKey: cat.key,
                                            format: 'excel',
                                            label: `${cat.title} (Excel .xlsx)`
                                        })}
                                        style={{
                                            padding: '7px 10px',
                                            borderRadius: '7px',
                                            border: '1px solid #CBD5E1',
                                            backgroundColor: '#F8FAFC',
                                            color: '#065F46',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '5px',
                                            cursor: isBusy ? 'not-allowed' : 'pointer',
                                            opacity: isBusy ? 0.55 : 1
                                        }}
                                    >
                                        {isExportingExcel ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                                        <span>Excel (.xlsx)</span>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => openConfirmModal({
                                            actionType: 'category',
                                            categoryKey: cat.key,
                                            format: 'csv',
                                            label: `${cat.title} (CSV)`
                                        })}
                                        style={{
                                            padding: '7px 10px',
                                            borderRadius: '7px',
                                            border: '1px solid #CBD5E1',
                                            backgroundColor: '#F8FAFC',
                                            color: '#3730A3',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '5px',
                                            cursor: isBusy ? 'not-allowed' : 'pointer',
                                            opacity: isBusy ? 0.55 : 1
                                        }}
                                    >
                                        {isExportingCsv ? <Loader2 size={13} className="animate-spin" /> : <ArrowDownToLine size={13} />}
                                        <span>CSV File</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 4. Master Export Audit Log History */}
            <div style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '10px',
                overflow: 'hidden'
            }}>
                <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <History size={16} color="#1E3A8A" />
                        <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                            Master Export Audit Log (This School)
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={fetchAuditLogs}
                        disabled={loadingLogs}
                        style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#475569',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <RefreshCw size={12} className={loadingLogs ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>

                {loadingLogs ? (
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: '12.5px', color: '#64748B' }}>
                        Loading audit history...
                    </div>
                ) : auditLogs.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: '12.5px', color: '#64748B' }}>
                        No Master Admin data exports recorded for this school yet.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#F1F5F9', textAlign: 'left', color: '#334155' }}>
                                    <th style={{ padding: '9px 12px', borderBottom: '1px solid #E2E8F0' }}>Date &amp; Time</th>
                                    <th style={{ padding: '9px 12px', borderBottom: '1px solid #E2E8F0' }}>Export Type</th>
                                    <th style={{ padding: '9px 12px', borderBottom: '1px solid #E2E8F0' }}>Reason</th>
                                    <th style={{ padding: '9px 12px', borderBottom: '1px solid #E2E8F0' }}>Records</th>
                                    <th style={{ padding: '9px 12px', borderBottom: '1px solid #E2E8F0' }}>Exported By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                        <td style={{ padding: '9px 12px', color: '#475569', whiteSpace: 'nowrap' }}>
                                            {formatLogTime(log)}
                                        </td>
                                        <td style={{ padding: '9px 12px', fontWeight: '700', color: '#0F172A' }}>
                                            {log.exportType} <span style={{ color: '#6366F1', fontSize: '11px' }}>({log.format})</span>
                                        </td>
                                        <td style={{ padding: '9px 12px', color: '#334155' }}>{log.reason}</td>
                                        <td style={{ padding: '9px 12px', color: '#475569' }}>{log.recordSummary || '—'}</td>
                                        <td style={{ padding: '9px 12px', color: '#475569' }}>
                                            {log.exportedByName || log.exportedByEmail}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 5. Security Confirmation + Reason Modal */}
            {confirmModal.open && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.72)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9999999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '470px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.38)',
                        border: '1px solid #CBD5E1'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '16px 20px',
                            background: 'linear-gradient(90deg, #0F172A 0%, #1E1B4B 100%)',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '9px',
                                backgroundColor: 'rgba(255,255,255,0.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#A5B4FC'
                            }}>
                                <Lock size={19} />
                            </div>
                            <div>
                                <div style={{ fontSize: '15px', fontWeight: '800' }}>Confirm Master Admin Export</div>
                                <div style={{ fontSize: '11.5px', color: '#C7D2FE' }}>
                                    Audit-Logged Emergency Data Extraction
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{
                                padding: '11px 13px',
                                borderRadius: '8px',
                                backgroundColor: '#FFFBEB',
                                border: '1px solid #FDE68A',
                                color: '#92400E',
                                fontSize: '12px',
                                lineHeight: '1.5',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '9px'
                            }}>
                                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                                <div>
                                    <strong>Confidentiality &amp; Audit Notice:</strong> This file contains sensitive student, parent, and financial records. This action will be permanently logged under your Master Admin account.
                                </div>
                            </div>

                            <div style={{
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                fontSize: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '5px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748B' }}>Target School:</span>
                                    <strong style={{ color: '#0F172A' }}>{school?.name || schoolId}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748B' }}>Export Package:</span>
                                    <strong style={{ color: '#4F46E5' }}>{confirmModal.label}</strong>
                                </div>
                            </div>

                            {/* Reason Selector */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                                    Reason for Export (Required for Audit Log) *
                                </label>
                                <select
                                    value={exportReason}
                                    onChange={(e) => setExportReason(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        borderRadius: '7px',
                                        border: '1px solid #CBD5E1',
                                        fontSize: '12.5px',
                                        color: '#0F172A',
                                        backgroundColor: '#FFFFFF'
                                    }}
                                >
                                    {PRESET_REASONS.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                    <option value="custom">Other (Specify below)...</option>
                                </select>

                                {exportReason === 'custom' && (
                                    <input
                                        type="text"
                                        value={customReason}
                                        onChange={(e) => setCustomReason(e.target.value)}
                                        placeholder="Enter short reason (e.g., Principal requested via phone)..."
                                        style={{
                                            width: '100%',
                                            marginTop: '8px',
                                            padding: '8px 10px',
                                            borderRadius: '7px',
                                            border: '1px solid #CBD5E1',
                                            fontSize: '12.5px',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '12px 20px',
                            backgroundColor: '#F8FAFC',
                            borderTop: '1px solid #E2E8F0',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '10px'
                        }}>
                            <button
                                type="button"
                                onClick={() => setConfirmModal({ open: false, actionType: null, categoryKey: null, format: null, label: '' })}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '7px',
                                    border: '1px solid #CBD5E1',
                                    backgroundColor: '#FFFFFF',
                                    color: '#475569',
                                    fontSize: '12.5px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmProceed}
                                disabled={exportReason === 'custom' && !customReason.trim()}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '7px',
                                    border: 'none',
                                    backgroundColor: '#4F46E5',
                                    color: '#FFFFFF',
                                    fontSize: '12.5px',
                                    fontWeight: '700',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: (exportReason === 'custom' && !customReason.trim()) ? 'not-allowed' : 'pointer',
                                    opacity: (exportReason === 'custom' && !customReason.trim()) ? 0.55 : 1
                                }}
                            >
                                <Download size={14} />
                                <span>Proceed &amp; Download</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
