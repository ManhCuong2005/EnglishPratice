import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Layout from './components/Layout.jsx';
import { SkeletonPage, Toasts } from './components/Common.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ImportPage from './pages/ImportPage.jsx';
import LibraryPage from './pages/LibraryPage.jsx';
import ListeningPage from './pages/ListeningPage.jsx';
import SetDetail from './pages/SetDetail.jsx';
import StudyPage from './pages/StudyPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { db } from './lib/db.js';
import { getSetMetrics, reviewWord } from './lib/learning.js';
import { sampleSet } from './data/sample.js';

const defaultSettings = {
  theme: 'light',
  dailyGoal: 15,
  soundEnabled: true,
  autoSpeak: true,
  geminiApiKey: '',
  geminiModel: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash',
};

function readRoute() {
  const value = window.location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [page, id, mode] = value.split('/');
  const validPages = ['dashboard', 'library', 'listening', 'import', 'settings', 'set', 'study'];
  return validPages.includes(page) ? { page, id, mode } : { page: 'dashboard' };
}

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [sets, setSets] = useState([]);
  const setsRef = useRef([]);
  const [sessions, setSessions] = useState([]);
  const [listeningLessons, setListeningLessons] = useState([]);
  const listeningLessonsRef = useRef([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((title, message = '', type = 'success', duration = 4000) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, title, message, type }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), duration);
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [savedSets, savedSessions, savedSettings, savedListeningLessons] = await Promise.all([
          db.getSets(), db.getSessions(), db.getSettings(), db.getListeningLessons(),
        ]);
        let initialSets = savedSets;
        if (!savedSettings.initialized && savedSets.length === 0) {
          await db.putSet(sampleSet);
          await db.putSetting('initialized', true);
          initialSets = [sampleSet];
        }
        if (!active) return;
        setsRef.current = initialSets;
        setSets(initialSets);
        setSessions(savedSessions.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)));
        listeningLessonsRef.current = savedListeningLessons;
        setListeningLessons(savedListeningLessons);
        setSettings({ ...defaultSettings, ...savedSettings });
      } catch (error) {
        if (active) addToast('Không mở được dữ liệu', error.message, 'error', 8000);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, [addToast]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.style.colorScheme = settings.theme;
  }, [settings.theme]);

  const navigate = useCallback((path) => {
    window.location.hash = `#/${path}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const refreshData = useCallback(async () => {
    const [nextSets, nextSessions, nextSettings, nextListeningLessons] = await Promise.all([
      db.getSets(), db.getSessions(), db.getSettings(), db.getListeningLessons(),
    ]);
    setsRef.current = nextSets;
    setSets(nextSets);
    setSessions(nextSessions.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)));
    listeningLessonsRef.current = nextListeningLessons;
    setListeningLessons(nextListeningLessons);
    setSettings({ ...defaultSettings, ...nextSettings });
  }, []);

  const saveSet = useCallback(async (set, notify = true) => {
    const now = new Date().toISOString();
    const normalized = { ...set, updatedAt: now, createdAt: set.createdAt || now };
    await db.putSet(normalized);
    const index = setsRef.current.findIndex((item) => item.id === normalized.id);
    const next = index >= 0
      ? setsRef.current.map((item) => item.id === normalized.id ? normalized : item)
      : [normalized, ...setsRef.current];
    next.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    setsRef.current = next;
    setSets(next);
    if (notify) addToast(index >= 0 ? 'Đã lưu thay đổi' : 'Bộ từ đã sẵn sàng', `${normalized.words.length} từ vựng đã được lưu.`);
    return normalized;
  }, [addToast]);

  const deleteSet = useCallback(async (id) => {
    await db.deleteSet(id);
    const next = setsRef.current.filter((set) => set.id !== id);
    setsRef.current = next;
    setSets(next);
    setSessions((current) => current.filter((session) => session.setId !== id));
    addToast('Đã xóa bộ từ', 'Các dữ liệu học liên quan đến bộ từ đã được gỡ.', 'info');
  }, [addToast]);

  const saveListeningLesson = useCallback(async (lesson, notify = true) => {
    const now = new Date().toISOString();
    const normalized = { ...lesson, updatedAt: now, createdAt: lesson.createdAt || now };
    await db.putListeningLesson(normalized);
    const exists = listeningLessonsRef.current.some((item) => item.id === normalized.id);
    const next = exists
      ? listeningLessonsRef.current.map((item) => item.id === normalized.id ? normalized : item)
      : [normalized, ...listeningLessonsRef.current];
    next.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    listeningLessonsRef.current = next;
    setListeningLessons(next);
    if (notify) addToast(exists ? 'Đã lưu tiến độ nghe' : 'Bài luyện nghe đã sẵn sàng', normalized.title);
    return normalized;
  }, [addToast]);

  const deleteListeningLesson = useCallback(async (id) => {
    await db.deleteListeningLesson(id);
    const next = listeningLessonsRef.current.filter((lesson) => lesson.id !== id);
    listeningLessonsRef.current = next;
    setListeningLessons(next);
    addToast('Đã xóa bài luyện nghe', '', 'info');
  }, [addToast]);

  const addListeningWordsToSet = useCallback(async (items, lessonInfo = {}) => {
    const seen = new Set();
    const words = (items || []).map((item) => {
      const source = typeof item === 'string' ? { term: item } : item;
      return {
        id: crypto.randomUUID(),
        term: String(source.term || source.answer || '').trim(),
        meaning: String(source.meaning || 'Từ hoặc cụm từ trong bài nghe').trim(),
        pronunciation: String(source.pronunciation || '').trim(),
        partOfSpeech: String(source.partOfSpeech || 'other'),
        example: String(source.example || '').trim(),
        exampleMeaning: String(source.exampleMeaning || '').trim(),
        level: source.level || 'B1',
        tags: ['luyện nghe'],
        note: String(source.note || `Trích từ bài nghe “${lessonInfo.title || 'Luyện nghe'}”`).trim(),
        needsReview: !source.meaning,
      };
    }).filter((word) => {
      const key = word.term.toLocaleLowerCase('en');
      if (!word.term || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!words.length) throw new Error('Không có từ hợp lệ để thêm vào flashcard.');
    return saveSet({
      id: crypto.randomUUID(),
      title: `Từ cần ôn · ${lessonInfo.title || 'Luyện nghe'}`,
      description: 'Những từ bạn cần luyện thêm sau bài nghe.',
      icon: '🎧',
      color: 'blue',
      source: 'Kết quả luyện nghe',
      words,
      progress: {},
      stats: { sessions: 0, totalAnswered: 0, totalCorrect: 0, lastStudiedAt: null },
    });
  }, [saveSet]);

  const review = useCallback(async (setId, wordId, rating) => {
    const set = setsRef.current.find((item) => item.id === setId);
    if (!set) return;
    const currentProgress = set.progress?.[wordId];
    const nextProgress = reviewWord(currentProgress, rating);
    const isCorrect = rating !== 'again';
    const updated = {
      ...set,
      progress: { ...(set.progress || {}), [wordId]: nextProgress },
      stats: {
        sessions: set.stats?.sessions || 0,
        totalAnswered: (set.stats?.totalAnswered || 0) + 1,
        totalCorrect: (set.stats?.totalCorrect || 0) + (isCorrect ? 1 : 0),
        lastStudiedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
    await saveSet(updated, false);
  }, [saveSet]);

  const completeSession = useCallback(async ({ setId, mode, answered, correct, durationSeconds }) => {
    const session = {
      id: crypto.randomUUID(), setId, mode, answered, correct, durationSeconds,
      completedAt: new Date().toISOString(),
    };
    await db.putSession(session);
    setSessions((current) => [session, ...current]);

    const set = setsRef.current.find((item) => item.id === setId);
    if (set) {
      await saveSet({
        ...set,
        stats: { ...(set.stats || {}), sessions: (set.stats?.sessions || 0) + 1, lastStudiedAt: session.completedAt },
      }, false);
    }
  }, [saveSet]);

  const saveSettings = useCallback(async (changes) => {
    const next = { ...settings, ...changes };
    await Promise.all(Object.entries(changes).map(([key, value]) => db.putSetting(key, value)));
    setSettings(next);
    addToast('Đã lưu cài đặt');
  }, [settings, addToast]);

  const dueCount = useMemo(() => sets.reduce((sum, set) => sum + getSetMetrics(set).due, 0), [sets]);
  const selectedSet = route.id ? sets.find((set) => set.id === route.id) : null;

  if (!ready) return <SkeletonPage />;

  let page;
  if (route.page === 'dashboard') page = <Dashboard sets={sets} sessions={sessions} settings={settings} navigate={navigate} />;
  if (route.page === 'library') page = <LibraryPage sets={sets} navigate={navigate} />;
  if (route.page === 'listening') page = <ListeningPage lessons={listeningLessons} settings={settings} saveLesson={saveListeningLesson} deleteLesson={deleteListeningLesson} addWordsToSet={addListeningWordsToSet} navigate={navigate} toast={addToast} />;
  if (route.page === 'import') page = <ImportPage settings={settings} saveSet={saveSet} navigate={navigate} toast={addToast} />;
  if (route.page === 'settings') page = <SettingsPage settings={settings} saveSettings={saveSettings} refreshData={refreshData} toast={addToast} />;
  if (route.page === 'set') page = <SetDetail set={selectedSet} saveSet={saveSet} deleteSet={deleteSet} navigate={navigate} />;
  if (route.page === 'study') page = <StudyPage set={selectedSet} initialMode={route.mode} onReview={review} onComplete={completeSession} settings={settings} navigate={navigate} />;

  return (
    <>
      <Layout
        route={route}
        navigate={navigate}
        settings={settings}
        dueCount={dueCount}
        onToggleTheme={() => saveSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
      >
        {page}
      </Layout>
      <Toasts items={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </>
  );
}
