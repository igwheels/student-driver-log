import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  addDoc, collection, collectionGroup, deleteDoc, doc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

const AppContext = createContext(null);
const STORAGE_KEY = 'sdl_data_v1';

const normalizeEmail = (email) => email.trim().toLowerCase();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState({});
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setStudents(data.students ?? []);
        setLogs(data.logs ?? {});
      }
    } catch (e) {
      console.warn('Failed to load from localStorage', e);
    } finally {
      setHydrated(true);
    }
  }, []);

  // Save to localStorage when data changes (offline fallback / cache)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ students, logs }));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [students, logs, hydrated]);

  // Load owned + shared students (and their logs) from Firestore when user logs in
  useEffect(() => {
    if (!user?.id || !hydrated) return;

    const loadFromFirestore = async () => {
      try {
        setSyncing(true);
        const userEmail = normalizeEmail(user.email || '');

        // Students this user owns
        const ownedSnap = await getDocs(collection(db, 'users', user.id, 'students'));
        const ownedStudents = ownedSnap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
          ownerId: d.data().ownerId || user.id,
          isOwner: true,
        }));

        // Students shared with this user's email, found via a collection-group query
        // (avoids scanning every user's data — only matches students that list this email)
        let sharedStudents = [];
        console.log('Looking for students shared with:', userEmail);
        try {
          const sharedQuery = query(
            collectionGroup(db, 'students'),
            where('sharedWithEmails', 'array-contains', userEmail)
          );
          const sharedSnap = await getDocs(sharedQuery);
          console.log('Shared-student query returned', sharedSnap.docs.length, 'document(s)');
          sharedStudents = sharedSnap.docs
            .filter((d) => d.data().ownerId !== user.id) // safety: don't double-list own students
            .map((d) => ({ ...d.data(), id: d.id, isOwner: false }));
        } catch (e) {
          console.error('Failed to load shared students (likely a Firestore rules issue):', e);
        }

        const allStudents = [...ownedStudents, ...sharedStudents];
        setStudents(allStudents);

        const logsData = {};
        for (const student of allStudents) {
          try {
            const logsSnap = await getDocs(
              collection(db, 'users', student.ownerId, 'students', student.id, 'logs')
            );
            logsData[student.id] = logsSnap.docs
              .map((d) => ({ ...d.data(), id: d.id }))
              .sort((a, b) => new Date(b.date) - new Date(a.date));
          } catch (e) {
            // Keep whatever was already cached rather than wiping it with an
            // empty array — a failure loading one student's logs shouldn't
            // erase previously-synced data for them, or block every other
            // student in this session from loading at all.
            console.error(`Failed to load logs for ${student.firstName} ${student.lastName}:`, e);
            logsData[student.id] = logs[student.id] ?? [];
          }
        }
        setLogs(logsData);
      } catch (e) {
        console.error('Failed to load from Firestore:', e);
      } finally {
        setSyncing(false);
      }
    };

    loadFromFirestore();
  }, [user?.id, user?.email, hydrated]);

  const addStudent = async (student) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const newStudent = {
      id,
      ...student,
      ownerId: user?.id,
      ownerName: user?.name ?? '',
      ownerEmail: user?.email ?? '',
      sharedWith: [],
      sharedWithEmails: [],
      isOwner: true,
    };
    setStudents((prev) => [...prev, newStudent]);

    if (user?.id) {
      try {
        await setDoc(doc(db, 'users', user.id, 'students', id), newStudent);
      } catch (e) {
        console.error('Failed to save student to Firestore:', e);
      }
    }
    return id;
  };

  const addLog = async (studentId, log) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const newLog = { id, ...log };
    setLogs((prev) => ({
      ...prev,
      [studentId]: [newLog, ...(prev[studentId] ?? [])],
    }));

    if (user?.id) {
      try {
        const student = students.find((s) => s.id === studentId);
        const ownerId = student?.ownerId || user.id;
        await setDoc(doc(db, 'users', ownerId, 'students', studentId, 'logs', id), newLog);
      } catch (e) {
        console.error('Failed to save log to Firestore:', e);
      }
    }
  };

  const getLogs = (studentId) => logs[studentId] ?? [];

  const getTotals = (studentId) => {
    const entries = getLogs(studentId);
    let total = 0;
    let night = 0;
    for (const e of entries) {
      total += e.durationMinutes;
      if (e.timeOfDay === 'night') night += e.durationMinutes;
    }
    return { totalMinutes: total, nightMinutes: night };
  };

  const deleteStudent = async (studentId) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setLogs((prev) => {
      const updated = { ...prev };
      delete updated[studentId];
      return updated;
    });

    if (user?.id) {
      try {
        await deleteDoc(doc(db, 'users', user.id, 'students', studentId));
      } catch (e) {
        console.warn('Failed to delete student from Firestore', e);
      }
    }
  };

  const deleteDrive = async (studentId, driveId) => {
    setLogs((prev) => ({
      ...prev,
      [studentId]: prev[studentId]?.filter((log) => log.id !== driveId) ?? [],
    }));

    if (user?.id) {
      try {
        const student = students.find((s) => s.id === studentId);
        const ownerId = student?.ownerId || user.id;
        await deleteDoc(doc(db, 'users', ownerId, 'students', studentId, 'logs', driveId));
      } catch (e) {
        console.warn('Failed to delete log from Firestore', e);
      }
    }
  };

  const isOwner = (studentId) => {
    const student = students.find((s) => s.id === studentId);
    return student?.ownerId === user?.id;
  };

  // Share a student by email. Access takes effect immediately once the recipient is
  // signed in with that email (Firestore rules check sharedWithEmails directly) —
  // whether they already have an account or create one later. An invitation record
  // is always created so a background job (see scripts/send-invitation-emails.js) can
  // email the recipient a link, either way.
  const shareStudent = async (studentId, recipientEmail) => {
    const email = normalizeEmail(recipientEmail);
    const student = students.find((s) => s.id === studentId);
    if (!student || student.ownerId !== user?.id) {
      throw new Error('Only the owner can share a student');
    }
    if (email === normalizeEmail(user.email || '')) {
      throw new Error("You can't share with yourself");
    }

    const currentSharedWith = student.sharedWith || [];
    if (currentSharedWith.some((s) => s.email === email)) {
      throw new Error('Already shared with that email');
    }

    const updatedSharedWith = [...currentSharedWith, { email, addedAt: new Date().toISOString() }];
    const updatedSharedWithEmails = updatedSharedWith.map((s) => s.email);

    const studentRef = doc(db, 'users', user.id, 'students', studentId);
    await updateDoc(studentRef, {
      sharedWith: updatedSharedWith,
      sharedWithEmails: updatedSharedWithEmails,
    });

    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, sharedWith: updatedSharedWith, sharedWithEmails: updatedSharedWithEmails }
          : s
      )
    );

    await addDoc(collection(db, 'invitations'), {
      email,
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      ownerId: user.id,
      ownerName: user.name,
      ownerEmail: user.email,
      createdAt: new Date().toISOString(),
      emailSent: false,
    });
  };

  const unshareStudent = async (studentId, recipientEmail) => {
    const email = normalizeEmail(recipientEmail);
    const student = students.find((s) => s.id === studentId);
    if (!student || student.ownerId !== user?.id) {
      throw new Error('Only the owner can unshare a student');
    }

    const updatedSharedWith = (student.sharedWith || []).filter((s) => s.email !== email);
    const updatedSharedWithEmails = updatedSharedWith.map((s) => s.email);

    const studentRef = doc(db, 'users', user.id, 'students', studentId);
    await updateDoc(studentRef, {
      sharedWith: updatedSharedWith,
      sharedWithEmails: updatedSharedWithEmails,
    });

    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, sharedWith: updatedSharedWith, sharedWithEmails: updatedSharedWithEmails }
          : s
      )
    );
  };

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        students,
        addStudent,
        addLog,
        getLogs,
        getTotals,
        deleteStudent,
        deleteDrive,
        hydrated,
        syncing,
        isOwner,
        shareStudent,
        unshareStudent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  return {
    ...context,
    logout: () => context.setUser(null),
  };
};
