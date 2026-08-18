import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, deleteDoc, doc, getDocs, query, where, writeBatch, updateDoc } from 'firebase/firestore';

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

        // Load owned students
        const studentsRef = collection(db, 'users', user.id, 'students');
        const studentsSnap = await getDocs(studentsRef);
        const ownedStudents = studentsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          ownerId: doc.data().ownerId || user.id, // Ensure ownerId is set
          isOwner: true,
        }));

        // Load shared students - students shared with this user's email
        const sharedStudents = [];
        try {
          const usersRef = collection(db, 'users');
          const usersSnap = await getDocs(usersRef);

          for (const userDoc of usersSnap.docs) {
            const studentsRef = collection(userDoc.ref, 'students');
            const studentsSnap = await getDocs(studentsRef);

            for (const studentDoc of studentsSnap.docs) {
              const studentData = studentDoc.data();
              const sharedWith = studentData.sharedWith || [];

              // Check if this student is shared with current user's email
              if (Array.isArray(sharedWith) && sharedWith.some(share => share.email === user.email)) {
                sharedStudents.push({
                  id: studentDoc.id,
                  ...studentData,
                  ownerId: userDoc.id,
                  isOwner: false,
                });
              }
            }
          }
        } catch (e) {
          console.warn('Failed to load shared students:', e);
        }

        // Combine owned and shared students
        const allStudents = [...ownedStudents, ...sharedStudents];
        console.log('Students loaded from Firestore:', allStudents);
        setStudents(allStudents);

        // Load logs for each student
        const logsData = {};
        for (const student of allStudents) {
          const logsRef = collection(db, 'users', student.ownerId, 'students', student.id, 'logs');
          const logsSnap = await getDocs(logsRef);
          logsData[student.id] = logsSnap.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
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
  }, [user?.id, user?.email, hydrated]);

  const addStudent = async (student) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const newStudent = { id, ...student, ownerId: user?.id, sharedWith: [], isOwner: true };
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
        const student = students.find(s => s.id === studentId);
        const ownerId = student?.ownerId || user.id;
        console.log('Saving log to Firestore:', newLog, 'for user:', user.id, 'student:', studentId);
        await addDoc(collection(db, 'users', ownerId, 'students', studentId, 'logs'), newLog);
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
        const student = students.find(s => s.id === studentId);
        const ownerId = student?.ownerId || user.id;
        await deleteDoc(doc(db, 'users', ownerId, 'students', studentId));
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
        const student = students.find(s => s.id === studentId);
        const ownerId = student?.ownerId || user.id;
        await deleteDoc(doc(db, 'users', ownerId, 'students', studentId, 'logs', driveId));
      } catch (e) {
        console.warn('Failed to delete log from Firestore', e);
      }
    }
  };

  // Check if user owns a student
  const isOwner = (studentId) => {
    const student = students.find(s => s.id === studentId);
    return student?.ownerId === user?.id;
  };

  // Check if a user exists in Firebase Auth
  const checkIfUserExists = async (email) => {
    try {
      // Query users collection to see if anyone with this email exists
      const usersRef = collection(db, 'users');
      const q = query(usersRef);
      const usersSnap = await getDocs(q);

      for (const userDoc of usersSnap.docs) {
        // We can't query Firebase Auth directly from client, but we can check Firestore
        // For now, we'll assume any user in Firestore exists
        // In a real app, you'd use a Cloud Function to check Auth
      }

      // Create an invitation regardless - it will be checked when user signs up
      return false; // Default to "send invitation"
    } catch (e) {
      console.error('Failed to check if user exists:', e);
      return false;
    }
  };

  // Share a student with another user
  const shareStudent = async (studentId, recipientEmail, recipientName) => {
    const student = students.find(s => s.id === studentId);
    if (!student || student.ownerId !== user?.id) {
      throw new Error('Only the owner can share a student');
    }

    try {
      // Update the student's sharedWith array
      const currentSharedWith = student.sharedWith || [];
      const alreadyShared = currentSharedWith.some(s => s.email === recipientEmail);

      if (alreadyShared) {
        throw new Error('This student is already shared with that email');
      }

      const updatedSharedWith = [...currentSharedWith, { email: recipientEmail, addedAt: new Date().toISOString() }];

      // Update Firestore
      const studentRef = doc(db, 'users', user.id, 'students', studentId);
      await updateDoc(studentRef, { sharedWith: updatedSharedWith });

      // Update local state
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, sharedWith: updatedSharedWith } : s))
      );

      console.log('Student shared with', recipientEmail);

      // Create an invitation record
      await addDoc(collection(db, 'invitations'), {
        email: recipientEmail,
        studentId: studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        ownerId: user.id,
        ownerName: user.name,
        ownerEmail: user.email,
        createdAt: new Date().toISOString(),
        accepted: false,
      });

      return true;
    } catch (e) {
      console.error('Failed to share student:', e);
      throw e;
    }
  };

  // Unshare a student with a user
  const unshareStudent = async (studentId, recipientEmail) => {
    const student = students.find(s => s.id === studentId);
    if (!student || student.ownerId !== user?.id) {
      throw new Error('Only the owner can unshare a student');
    }

    try {
      const updatedSharedWith = (student.sharedWith || []).filter(s => s.email !== recipientEmail);

      // Update Firestore
      const studentRef = doc(db, 'users', user.id, 'students', studentId);
      await updateDoc(studentRef, { sharedWith: updatedSharedWith });

      // Update local state
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, sharedWith: updatedSharedWith } : s))
      );

      console.log('Student unshared from', recipientEmail);
      return true;
    } catch (e) {
      console.error('Failed to unshare student:', e);
      throw e;
    }
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
        checkIfUserExists,
      }}
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
