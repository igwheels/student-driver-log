import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Local-first data store. Students and drive logs persist in localStorage.
 * When you wire up Firebase (see README), mirror these writes to Firestore
 * so data syncs across devices and powers the weekly emails.
 */
const AppContext = createContext(null);
const STORAGE_KEY = 'sdl_data_v1';

export function AppProvider({ children }) {
  const [user, setUser] = useState(null); // { id, name, email }
  const [students, setStudents] = useState([]); // { id, firstName, lastName, email, state }
  const [logs, setLogs] = useState({}); // { [studentId]: DriveLog[] }
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setStudents(data.students ?? []);
        setLogs(data.logs ?? {});
      }
    } catch (e) {
      console.warn('Failed to load saved data', e);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ students, logs }));
    } catch (e) {
      console.warn('Failed to save data', e);
    }
  }, [students, logs, hydrated]);

  const addStudent = (student) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    setStudents((prev) => [...prev, { id, ...student }]);
    return id;
  };

  /**
   * DriveLog shape:
   * {
   *   id, date (yyyy-mm-dd), startTime (ISO), endTime (ISO),
   *   durationMinutes, timeOfDay: 'day' | 'night',
   *   type: 'local' | 'rural' | 'highway',
   *   distanceMiles: number | null
   * }
   */
  const addLog = (studentId, log) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    setLogs((prev) => ({
      ...prev,
      [studentId]: [{ id, ...log }, ...(prev[studentId] ?? [])],
    }));
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

  const deleteStudent = (studentId) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setLogs((prev) => {
      const updated = { ...prev };
      delete updated[studentId];
      return updated;
    });
  };

  const deleteDrive = (studentId, driveId) => {
    setLogs((prev) => ({
      ...prev,
      [studentId]: prev[studentId]?.filter((log) => log.id !== driveId) ?? [],
    }));
  };

  return (
    <AppContext.Provider
      value={{ user, setUser, students, addStudent, addLog, getLogs, getTotals, deleteStudent, deleteDrive, hydrated }}
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
