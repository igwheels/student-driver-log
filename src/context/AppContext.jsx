import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, deleteDoc, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';

const AppContext = createContext(null);
const STORAGE_KEY = 'sdl_data_v1';

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

  // Save to localStorage when data changes
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ students, logs }));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [students, logs, hydrated]);

  // Load from Firestore when user logs in
  useEffect(() => {
    if (!user?.id || !hydrated) return;

    const loadFromFirestore = async () => {
      try {
        setSyncing(true);
        console.log('Loading from Firestore for user:', user.id);

        // Load students
        const studentsRef = collection(db, 'users', user.id, 'students');
        const studentsSnap = await getDocs(studentsRef);
        const studentsData = studentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        console.log('Students loaded from Firestore:', studentsData);
        setStudents(studentsData);

        // Load logs for each student
        const logsData = {};
        for (const student of studentsData) {
          const logsRef = collection(db, 'users', user.id, 'students', student.id, 'logs');
          const logsSnap = await getDocs(logsRef);
          logsData[student.id] = logsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        console.log('Logs loaded from Firestore:', logsData);
        setLogs(logsData);
      } catch (e) {
        console.error('Failed to load from Firestore:', e);
      } finally {
        setSyncing(false);
      }
    };

    loadFromFirestore();
  }, [user?.id, hydrated]);

  const addStudent = async (student) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const newStudent = { id, ...student };
    setStudents((prev) => [...prev, newStudent]);

    // Save to Firestore
    if (user?.id) {
      try {
        console.log('Saving student to Firestore:', newStudent, 'for user:', user.id);
        await addDoc(collection(db, 'users', user.id, 'students'), newStudent);
        console.log('Student saved successfully');
      } catch (e) {
        console.error('Failed to save student to Firestore:', e);
      }
    } else {
      console.log('No user logged in, student not saved to Firestore');
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

    // Save to Firestore
    if (user?.id) {
      try {
        console.log('Saving log to Firestore:', newLog, 'for user:', user.id, 'student:', studentId);
        await addDoc(collection(db, 'users', user.id, 'students', studentId, 'logs'), newLog);
        console.log('Log saved successfully');
      } catch (e) {
        console.error('Failed to save log to Firestore:', e);
      }
    } else {
      console.log('No user logged in, log not saved to Firestore');
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

    // Delete from Firestore
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

    // Delete from Firestore
    if (user?.id) {
      try {
        await deleteDoc(doc(db, 'users', user.id, 'students', studentId, 'logs', driveId));
      } catch (e) {
        console.warn('Failed to delete log from Firestore', e);
      }
    }
  };

  return (
    <AppContext.Provider
      value={{ user, setUser, students, addStudent, addLog, getLogs, getTotals, deleteStudent, deleteDrive, hydrated, syncing }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  const logout = () => {
    context.setUser(null);
    console.log('User logged out');
  };

  // Log user changes for debugging
  if (context.user) {
    console.log('Current user:', { id: context.user.id, name: context.user.name, email: context.user.email });
  }

  return {
    ...context,
    logout,
  };
};
