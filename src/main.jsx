import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plus, ChevronDown, CalendarDays, Sparkles, Trash2, Clock3, Check, X, Code2, LayoutDashboard, GripVertical, ArrowRight, ArrowLeft, LockKeyhole, Mail, UserRound, Eye, EyeOff, FolderKanban, Pencil, Target, ShieldCheck, Users, RefreshCw, Brain, Cloud, Braces, Database, Layers, Palette, Terminal, BookOpen, Atom } from 'lucide-react';
import { auth, db, firebaseConfigured, functions } from './firebase';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut, getIdTokenResult } from 'firebase/auth';
import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import './style.css';
import './medium.css';
import './project.css';
import './admin.css';
import './goals.css';
import './playful.css';

const columns = [{ id: 'todo', label: 'To do', tone: 'violet' }, { id: 'progress', label: 'In progress', tone: 'blue' }, { id: 'done', label: 'Done', tone: 'green' }];
const categories = ['React', 'Angular', 'JavaScript', 'TypeScript', 'CSS', 'Node.js', 'Frontend', 'Backend', 'APIs', 'Databases', 'Authentication', 'Testing', 'CI/CD', 'Cloud', 'Infrastructure', 'Monitoring', 'Reliability', 'Security', 'Software design', 'System design', 'Architecture', 'Technical leadership', 'Accessibility', 'Performance', 'Project', 'Data', 'Data engineering', 'Python', 'Machine learning', 'Responsible AI', 'Communication', 'DevOps', 'Other'];
const technologyCategories = ['Language', 'Framework', 'Library / plugin', 'Backend / API', 'Database', 'Authentication', 'CI/CD', 'Hosting / deployment', 'Testing', 'Monitoring / analytics', 'Design / planning', 'Other'];
const projectPlanGroups = [
  { title: 'Product plan', fields: [{ id: 'objective', label: 'Problem and goal' }, { id: 'targetUsers', label: 'Target users' }, { id: 'scope', label: 'MVP scope and features' }, { id: 'requirements', label: 'Requirements and acceptance criteria' }] },
  { title: 'Engineering plan', fields: [{ id: 'architecture', label: 'Architecture and key decisions' }, { id: 'repository', label: 'Repository URL', singleLine: true }, { id: 'dependencies', label: 'External services and dependencies' }] },
  { title: 'Delivery plan', fields: [{ id: 'cicd', label: 'CI/CD workflow' }, { id: 'hosting', label: 'Environments and hosting' }, { id: 'testing', label: 'Testing and quality' }] },
  { title: 'Operations and release', fields: [{ id: 'security', label: 'Security and access' }, { id: 'monitoring', label: 'Monitoring and maintenance' }, { id: 'release', label: 'Release checklist and notes' }, { id: 'risks', label: 'Risks and open questions' }] },
];
const initialStored = (() => { try { return JSON.parse(localStorage.getItem('dayboard-tasks')) || []; } catch { return []; } })();
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const cleanResourceLinks = values => values.map(value => { try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; } }).filter(Boolean);
const catalogKey = value => {
  const normalized = String(value || '').trim().toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'skill';
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) hash = Math.imul(hash ^ normalized.charCodeAt(index), 16777619);
  return `${slug}-${(hash >>> 0).toString(36)}`;
};
const writeSharedSkill = async (firestore, goal, topics = goal.topics || []) => {
  const id = goal.catalogId || catalogKey(goal.name);
  const now = new Date().toISOString();
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, 'skillCatalog', id), { id, name: goal.name, createdAt: goal.createdAt || now, updatedAt: now }, { merge: true });
  topics.forEach(topic => {
    const topicId = catalogKey(topic.name);
    batch.set(doc(firestore, 'skillCatalog', id, 'topics', topicId), { name: topic.name, createdAt: topic.createdAt || now }, { merge: true });
  });
  await batch.commit();
  return id;
};

function App() {
  const today = new Date();
  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(today);
  const dateBadge = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(today).toUpperCase();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingWrites = useRef(0);
  const [tasksReady, setTasksReady] = useState(false);
  const [dataError, setDataError] = useState('');
  const [tasks, setTasks] = useState(initialStored);
  const [modal, setModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activePage, setActivePage] = useState('goals');
  const [personalGoals, setPersonalGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalModal, setGoalModal] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);
  const [activeGoal, setActiveGoal] = useState(null);
  const [goalPrioritySaving, setGoalPrioritySaving] = useState(false);
  const [topicName, setTopicName] = useState('');
  const [topicSaving, setTopicSaving] = useState(false);
  const [topicTaskName, setTopicTaskName] = useState('');
  const [topicTaskKind, setTopicTaskKind] = useState('Practice');
  const [topicTaskDate, setTopicTaskDate] = useState(localDateKey());
  const [topicTaskDifficulty, setTopicTaskDifficulty] = useState('Beginner');
  const [topicTaskRevisionDate, setTopicTaskRevisionDate] = useState('');
  const [topicTaskNotes, setTopicTaskNotes] = useState('');
  const [topicTaskLinks, setTopicTaskLinks] = useState('');
  const [studyMinutes, setStudyMinutes] = useState('25');
  const [topicTaskSaving, setTopicTaskSaving] = useState(false);
  const [activeTopicId, setActiveTopicId] = useState(null);
  const [userRole, setUserRole] = useState('user');
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState('');
  const [adminRefresh, setAdminRefresh] = useState(0);
  const [projectModal, setProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [creatingProject, setCreatingProject] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'React', status: 'todo', due: 'Today', priority: 'Medium' });
  useEffect(() => {
    if (!auth) { setAuthReady(true); return undefined; }
    return onAuthStateChanged(auth, currentUser => { setUser(currentUser); if (currentUser) { setActivePage('goals'); setSelectedProjectId(null); } setAuthReady(true); });
  }, []);
  useEffect(() => {
    let active = true;
    setUserRole('user');
    if (!user) return () => { active = false; };
    getIdTokenResult(user).then(token => {
      if (active) setUserRole(token.claims.role === 'admin' ? 'admin' : 'user');
    }).catch(() => { if (active) setUserRole('user'); });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (activePage !== 'admin' || userRole !== 'admin' || !functions) return undefined;
    let active = true;
    setAdminUsersLoading(true);
    setAdminUsersError('');
    httpsCallable(functions, 'adminListUsers')({})
      .then(result => { if (active) setAdminUsers(result.data.users || []); })
      .catch(error => { if (active) setAdminUsersError(error.message || 'Could not load user accounts.'); })
      .finally(() => { if (active) setAdminUsersLoading(false); });
    return () => { active = false; };
  }, [activePage, userRole, adminRefresh]);
  useEffect(() => {
    if (!user || !db) { setTasksReady(false); setGoalsLoading(false); return undefined; }
    let active = true;
    const loadTasks = async () => {
      setTasksReady(false); setGoalsLoading(true); setTasks([]); setPersonalGoals([]); setDataError('');
      try {
        const ref = collection(db, 'users', user.uid, 'tasks');
        const [snapshot, projectSnapshot] = await Promise.all([
          getDocs(ref),
          getDocs(collection(db, 'users', user.uid, 'projects')),
        ]);
        if (!active) return;
        setProjects(projectSnapshot.docs.map(item => ({ ...item.data(), id: item.id, techStack: item.data().techStack || [], plan: item.data().plan || {} })).sort((a, b) => a.name.localeCompare(b.name)));
        if (snapshot.empty) {
          const legacy = localStorage.getItem('dayboard-tasks');
          const startingTasks = legacy ? JSON.parse(legacy) : [];
          if (startingTasks.length) {
            const batch = writeBatch(db);
            startingTasks.forEach(task => batch.set(doc(db, 'users', user.uid, 'tasks', String(task.id)), task));
            await batch.commit();
            localStorage.removeItem('dayboard-tasks');
          }
          setTasks(startingTasks);
        } else {
          setTasks(snapshot.docs.map(item => ({ ...item.data(), id: item.id })));
        }
        try {
          const goalsSnapshot = await getDocs(collection(db, 'users', user.uid, 'goals'));
          const localGoals = goalsSnapshot.docs.map(item => ({ ...item.data(), id: item.id }))
            .filter(goal => goal.type === 'goal-tile')
            .map(goal => ({ ...goal, catalogId: goal.catalogId || catalogKey(goal.name), topics: Array.isArray(goal.topics) ? goal.topics : [] }));
          let sharedGoals = [];
          try {
            // Publish this user's existing skill names and topic names so they become available to future accounts.
            await Promise.all(localGoals.map(goal => writeSharedSkill(db, goal)));
            const sharedSnapshot = await getDocs(collection(db, 'skillCatalog'));
            const sharedEntries = await Promise.all(sharedSnapshot.docs.map(async item => {
              const shared = { ...item.data(), id: item.id };
              const topicSnapshot = await getDocs(collection(db, 'skillCatalog', item.id, 'topics'));
              return { ...shared, topics: topicSnapshot.docs.map(topicDoc => ({ id: topicDoc.id, name: topicDoc.data().name, createdAt: topicDoc.data().createdAt })) };
            }));
            const byCatalogId = new Map(localGoals.map(goal => [goal.catalogId, goal]));
            sharedEntries.forEach(shared => {
              const existing = byCatalogId.get(shared.id) || localGoals.find(goal => catalogKey(goal.name) === shared.id);
              if (!existing) {
                const now = shared.createdAt || new Date().toISOString();
                byCatalogId.set(shared.id, { id: `shared-${shared.id}`, catalogId: shared.id, name: shared.name, type: 'goal-tile', topics: shared.topics.map(topic => ({ ...topic, tasks: [] })), createdAt: now });
                return;
              }
              const seen = new Set((existing.topics || []).map(topic => topic.name.trim().toLowerCase()));
              const additions = shared.topics.filter(topic => !seen.has(topic.name.trim().toLowerCase())).map(topic => ({ ...topic, tasks: [] }));
              const merged = { ...existing, catalogId: shared.id, topics: [...(existing.topics || []), ...additions] };
              byCatalogId.set(shared.id, merged);
            });
            sharedGoals = [...byCatalogId.values()];
            const changedGoals = sharedGoals.filter(goal => { const previous = localGoals.find(item => item.id === goal.id); return !previous || previous.catalogId !== goal.catalogId || previous.topics.length !== goal.topics.length; });
            if (changedGoals.length) {
              const batch = writeBatch(db);
              changedGoals.forEach(goal => batch.set(doc(db, 'users', user.uid, 'goals', goal.id), goal, { merge: true }));
              await batch.commit();
            }
          } catch (catalogError) {
            if (active) setDataError(`Could not sync the shared skill catalog. Deploy the updated Firestore rules, then reload. ${catalogError.message || ''}`);
            sharedGoals = localGoals;
          }
          if (active) setPersonalGoals(sharedGoals.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
        } catch (error) {
          if (active) setDataError(error.message || 'Could not load your goals.');
        }
      } catch (error) {
        if (active) setDataError(error.message || 'Could not load goals from Firebase.');
      } finally { if (active) { setTasksReady(true); setGoalsLoading(false); } }
    };
    loadTasks();
    return () => { active = false; };
  }, [user]);
  const save = async (next) => {
    setTasks(next);
    if (!user || !db) return;
    setDataError('');
    const nextById = new Map(next.map(task => [String(task.id), task]));
    const syncedGoals = personalGoals.map(goal => {
      let changed = false;
      const topics = (goal.topics || []).map(topic => {
        const topicTasks = (topic.tasks || []).map(topicTask => {
          if (!topicTask.boardTaskId) return topicTask;
          const boardTask = nextById.get(String(topicTask.boardTaskId));
          const done = boardTask ? boardTask.status === 'done' : false;
          const addedToBoard = Boolean(boardTask);
          const name = boardTask?.title || topicTask.name;
          const completedAt = done ? (topicTask.completedAt || boardTask?.updatedAt || new Date().toISOString()) : null;
          if (topicTask.done === done && topicTask.addedToBoard === addedToBoard && topicTask.name === name && topicTask.completedAt === completedAt) return topicTask;
          changed = true;
          return { ...topicTask, name, done, completedAt, addedToBoard, ...(boardTask ? {} : { boardTaskId: null }) };
        });
        return topicTasks.some((item, index) => item !== (topic.tasks || [])[index]) ? { ...topic, tasks: topicTasks } : topic;
      });
      return changed ? { ...goal, topics, updatedAt: new Date().toISOString() } : goal;
    });
    pendingWrites.current += 1;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const nextIds = new Set(next.map(task => String(task.id)));
      tasks.forEach(task => { if (!nextIds.has(String(task.id))) batch.delete(doc(db, 'users', user.uid, 'tasks', String(task.id))); });
      next.forEach(task => batch.set(doc(db, 'users', user.uid, 'tasks', String(task.id)), task));
      syncedGoals.forEach((goal, index) => { if (goal !== personalGoals[index]) batch.set(doc(db, 'users', user.uid, 'goals', goal.id), goal); });
      await batch.commit();
      if (syncedGoals.some((goal, index) => goal !== personalGoals[index])) {
        setPersonalGoals(syncedGoals);
        setActiveGoal(current => current ? syncedGoals.find(goal => goal.id === current.id) || current : current);
      }
    } catch (error) { setDataError(error.message || 'Could not save goals to Firebase.'); }
    finally { pendingWrites.current -= 1; setSaving(pendingWrites.current > 0); }
  };
  const submitPersonalGoal = async (event) => {
    event.preventDefault();
    const name = goalName.trim();
    if (!name || !user || !db || goalSaving) return;
    if (personalGoals.some(goal => goal.name.trim().toLowerCase() === name.toLowerCase())) { setDataError('That skill is already in your goals.'); return; }
    const now = new Date().toISOString();
    const sharedId = catalogKey(name);
    const goal = { id: crypto.randomUUID(), catalogId: sharedId, name, type: 'goal-tile', topics: [], createdAt: now };
    setGoalSaving(true);
    pendingWrites.current += 1;
    setSaving(true);
    setDataError('');
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid, 'goals', goal.id), goal);
      batch.set(doc(db, 'skillCatalog', sharedId), { id: sharedId, name, createdAt: now, updatedAt: now }, { merge: true });
      await batch.commit();
      setPersonalGoals(current => [...current, goal]);
      setGoalName('');
      setGoalModal(false);
    } catch (error) {
      setDataError(error.message || 'Could not save this goal.');
    } finally {
      pendingWrites.current -= 1;
      setSaving(pendingWrites.current > 0);
      setGoalSaving(false);
    }
  };
  const submitTopic = async (event) => {
    event.preventDefault();
    const name = topicName.trim();
    if (!name || !activeGoal || !user || !db || topicSaving) return;
    if ((activeGoal.topics || []).some(topic => topic.name.toLowerCase() === name.toLowerCase())) {
      setDataError('That topic is already in this goal.');
      return;
    }
    const now = new Date().toISOString();
    const addedTopic = { id: crypto.randomUUID(), name, createdAt: now };
    const sharedId = activeGoal.catalogId || catalogKey(activeGoal.name);
    const updatedGoal = { ...activeGoal, catalogId: sharedId, topics: [...(activeGoal.topics || []), addedTopic], updatedAt: now };
    setTopicSaving(true);
    pendingWrites.current += 1;
    setSaving(true);
    setDataError('');
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid, 'goals', activeGoal.id), updatedGoal, { merge: true });
      batch.set(doc(db, 'skillCatalog', sharedId), { id: sharedId, name: activeGoal.name, createdAt: activeGoal.createdAt || now, updatedAt: now }, { merge: true });
      batch.set(doc(db, 'skillCatalog', sharedId, 'topics', catalogKey(name)), { name, createdAt: now }, { merge: true });
      await batch.commit();
      setPersonalGoals(current => current.map(goal => goal.id === updatedGoal.id ? updatedGoal : goal));
      setActiveGoal(updatedGoal);
      setActiveTopicId(addedTopic.id);
      setTopicName('');
    } catch (error) {
      setDataError(error.message || 'Could not save this topic.');
    } finally {
      pendingWrites.current -= 1;
      setSaving(pendingWrites.current > 0);
      setTopicSaving(false);
    }
  };
  const saveGoalPriority = async priority => {
    if (!activeGoal || !user || !db || goalPrioritySaving) return;
    const updatedGoal = { ...activeGoal, priority, updatedAt: new Date().toISOString() };
    setGoalPrioritySaving(true); pendingWrites.current += 1; setSaving(true); setDataError('');
    try {
      await setDoc(doc(db, 'users', user.uid, 'goals', activeGoal.id), updatedGoal, { merge: true });
      setPersonalGoals(current => current.map(goal => goal.id === updatedGoal.id ? updatedGoal : goal));
      setActiveGoal(updatedGoal);
    } catch (error) { setDataError(error.message || 'Could not save goal priority.'); }
    finally { pendingWrites.current -= 1; setSaving(pendingWrites.current > 0); setGoalPrioritySaving(false); }
  };
  const saveTopicChange = async (updatedGoal, updatedBoardTasks = []) => {
    if (!user || !db) return false;
    pendingWrites.current += 1; setSaving(true); setDataError('');
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid, 'goals', updatedGoal.id), updatedGoal, { merge: true });
      updatedBoardTasks.forEach(task => batch.set(doc(db, 'users', user.uid, 'tasks', String(task.id)), task));
      await batch.commit();
      if (updatedBoardTasks.length) setTasks(current => current.map(task => updatedBoardTasks.find(updated => String(updated.id) === String(task.id)) || task));
      setPersonalGoals(current => current.map(goal => goal.id === updatedGoal.id ? updatedGoal : goal));
      setActiveGoal(updatedGoal);
      return true;
    } catch (error) {
      setDataError(error.message || 'Could not save this task.');
      return false;
    } finally { pendingWrites.current -= 1; setSaving(pendingWrites.current > 0); }
  };
  const submitTopicTask = async event => {
    event.preventDefault();
    const name = topicTaskName.trim();
    if (!name || !activeGoal || !activeTopicId || topicTaskSaving) return;
    const topic = (activeGoal.topics || []).find(item => item.id === activeTopicId);
    if (!topic) return;
    if ((topic.tasks || []).some(task => task.name.toLowerCase() === name.toLowerCase())) { setDataError('That task already exists in this topic.'); return; }
    setTopicTaskSaving(true);
    const now = new Date().toISOString();
    const newTask = { id: crypto.randomUUID(), name, kind: topicTaskKind, difficulty: topicTaskDifficulty, revisionDate: topicTaskRevisionDate || '', notes: topicTaskNotes.trim(), links: cleanResourceLinks(topicTaskLinks.split(/\r?\n/).map(value => value.trim()).filter(Boolean)), sessions: [], done: false, plannedDate: topicTaskDate || localDateKey(), createdAt: now };
    const updatedGoal = { ...activeGoal, updatedAt: now, topics: activeGoal.topics.map(item => item.id === activeTopicId ? { ...item, tasks: [...(item.tasks || []), newTask] } : item) };
    if (await saveTopicChange(updatedGoal)) { setTopicTaskName(''); setTopicTaskNotes(''); setTopicTaskLinks(''); setTopicTaskRevisionDate(''); }
    setTopicTaskSaving(false);
  };
  const updateTopicTaskField = async (topicId, taskId, field, value) => {
    const updatedGoal = { ...activeGoal, updatedAt: new Date().toISOString(), topics: activeGoal.topics.map(topic => topic.id === topicId ? { ...topic, tasks: (topic.tasks || []).map(task => task.id === taskId ? { ...task, [field]: value } : task) } : topic) };
    const boardUpdates = getLinkedBoardTaskUpdates(topicId, taskId, { [field]: value });
    await saveTopicChange(updatedGoal, boardUpdates);
  };
  const updateTopicTaskFields = async (topicId, taskId, changes) => {
    const updatedGoal = { ...activeGoal, updatedAt: new Date().toISOString(), topics: activeGoal.topics.map(topic => topic.id === topicId ? { ...topic, tasks: (topic.tasks || []).map(task => task.id === taskId ? { ...task, ...changes } : task) } : topic) };
    await saveTopicChange(updatedGoal, getLinkedBoardTaskUpdates(topicId, taskId, changes));
  };
  const getLinkedBoardTaskUpdates = (topicId, taskId, changes) => {
    const topic = activeGoal?.topics?.find(item => item.id === topicId);
    const topicTask = topic?.tasks?.find(item => item.id === taskId);
    if (!topicTask?.boardTaskId) return [];
    const boardTask = tasks.find(item => String(item.id) === String(topicTask.boardTaskId));
    if (!boardTask) return [];
    const updated = { ...boardTask };
    if (Object.prototype.hasOwnProperty.call(changes, 'kind')) updated.learningMode = changes.kind;
    if (Object.prototype.hasOwnProperty.call(changes, 'difficulty')) updated.difficulty = changes.difficulty;
    if (Object.prototype.hasOwnProperty.call(changes, 'revisionDate')) updated.revisionDate = changes.revisionDate;
    if (Object.prototype.hasOwnProperty.call(changes, 'links')) updated.practiceLinks = changes.links;
    if (Object.prototype.hasOwnProperty.call(changes, 'plannedDate')) {
      const plannedDate = changes.plannedDate || localDateKey();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      updated.plannedDate = plannedDate;
      updated.due = plannedDate === localDateKey() ? 'Today' : plannedDate === localDateKey(tomorrow) ? 'Tomorrow' : 'This week';
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'notes')) updated.description = [activeGoal.name, topic.name, changes.notes].filter(Boolean).join(' · ');
    updated.updatedAt = new Date().toISOString();
    return [updated];
  };
  const moveTopicTask = async (task, nextTopicId) => {
    if (task.boardTaskId || task.topicId === nextTopicId) return;
    const { topicId, topicName, legacyTopic, ...taskData } = task;
    const updatedGoal = { ...activeGoal, updatedAt: new Date().toISOString(), topics: activeGoal.topics.map(topic => topic.id === task.topicId ? { ...topic, tasks: (topic.tasks || []).filter(entry => entry.id !== task.id) } : topic.id === nextTopicId ? { ...topic, tasks: [...(topic.tasks || []), taskData] } : topic) };
    await saveTopicChange(updatedGoal);
  };
  const logStudyTime = async (topicId, taskId) => {
    const minutes = Number(studyMinutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) { setDataError('Enter study time from 1 to 1,440 minutes.'); return; }
    const now = new Date().toISOString();
    const updatedGoal = { ...activeGoal, updatedAt: now, topics: activeGoal.topics.map(topic => topic.id === topicId ? { ...topic, tasks: (topic.tasks || []).map(task => task.id === taskId ? { ...task, sessions: [...(task.sessions || []), { id: crypto.randomUUID(), minutes, date: localDateKey(), createdAt: now }] } : task) } : topic) };
    if (await saveTopicChange(updatedGoal)) setStudyMinutes('25');
  };
  const deleteTopicTask = async (topicId, taskId) => {
    const topic = (activeGoal.topics || []).find(item => item.id === topicId);
    const task = (topic?.tasks || []).find(item => item.id === taskId);
    if (!topic || !task || task.boardTaskId || !user || !db || saving) return;
    const updatedGoal = { ...activeGoal, updatedAt: new Date().toISOString(), topics: activeGoal.topics.map(item => item.id === topicId ? { ...item, tasks: item.tasks.filter(topicTask => topicTask.id !== taskId) } : item) };
    pendingWrites.current += 1; setSaving(true); setDataError('');
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid, 'goals', updatedGoal.id), updatedGoal, { merge: true });
      await batch.commit();
      setPersonalGoals(current => current.map(goal => goal.id === updatedGoal.id ? updatedGoal : goal));
      setActiveGoal(updatedGoal);
    } catch (error) { setDataError(error.message || 'Could not delete this task.'); }
    finally { pendingWrites.current -= 1; setSaving(pendingWrites.current > 0); }
  };
  const addTopicTaskToBoard = async (topicId, taskId) => {
    const topic = (activeGoal?.topics || []).find(item => item.id === topicId);
    const task = (topic?.tasks || []).find(item => item.id === taskId);
    if (!topic || !task || task.boardTaskId || !user || !db || saving) return;
    const boardTaskId = crypto.randomUUID();
    const now = new Date().toISOString();
    const plannedDate = task.plannedDate || localDateKey();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const due = plannedDate === localDateKey() ? 'Today' : plannedDate === localDateKey(tomorrow) ? 'Tomorrow' : 'This week';
    const boardTask = { id: boardTaskId, title: task.name, description: [activeGoal.name, topic.name, task.notes].filter(Boolean).join(' · '), category: categories.includes(activeGoal.name) ? activeGoal.name : 'Other', status: 'todo', due, priority: 'Medium', learningMode: task.kind || 'Practice', difficulty: task.difficulty || topic.difficulty || 'Beginner', revisionDate: task.revisionDate || topic.revisionDate || '', practiceLinks: task.links || topic.links || [], plannedDate, linkedGoalId: activeGoal.id, linkedTopicId: topic.id, linkedTopicTaskId: task.id, createdAt: now };
    const updatedGoal = { ...activeGoal, updatedAt: now, topics: activeGoal.topics.map(item => item.id === topicId ? { ...item, tasks: item.tasks.map(topicTask => topicTask.id === taskId ? { ...topicTask, boardTaskId, addedToBoard: true, done: false } : topicTask) } : item) };
    pendingWrites.current += 1; setSaving(true); setDataError('');
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid, 'tasks', boardTaskId), boardTask);
      batch.set(doc(db, 'users', user.uid, 'goals', updatedGoal.id), updatedGoal, { merge: true });
      await batch.commit();
      setTasks(current => [boardTask, ...current]);
      setPersonalGoals(current => current.map(goal => goal.id === updatedGoal.id ? updatedGoal : goal));
      setActiveGoal(updatedGoal);
    } catch (error) { setDataError(error.message || 'Could not add this task to your board.'); }
    finally { pendingWrites.current -= 1; setSaving(pendingWrites.current > 0); }
  };
  const activeGoalTasks = (activeGoal?.topics || []).flatMap(topic => (topic.tasks || []).map(task => ({ ...task, topicId: topic.id, topicName: topic.name, legacyTopic: topic })));
  const visible = tasks;
  const createTask = (e) => { e.preventDefault(); if (!form.title.trim()) return; save([{ ...form, id: Date.now(), title: form.title.trim() }, ...tasks]); setModal(false); setForm({ title: '', description: '', category: 'React', status: 'todo', due: 'Today', priority: 'Medium' }); };
  const move = (id, status) => save(tasks.map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t));
  const remove = (id) => save(tasks.filter(t => t.id !== id));
  const updateSelectedTask = (field, value) => setSelectedTask(current => ({ ...current, [field]: value }));
  const submitTaskEdit = (event) => {
    event.preventDefault();
    save(tasks.map(task => task.id === selectedTask.id ? selectedTask : task));
    setSelectedTask(null);
  };
  const createProject = async (event) => {
    event.preventDefault();
    if (!projectForm.name.trim() || !user || !db) return;
    const project = editingProject
      ? { ...editingProject, name: projectForm.name.trim(), description: projectForm.description.trim(), updatedAt: new Date().toISOString() }
      : { id: String(Date.now()), name: projectForm.name.trim(), description: projectForm.description.trim(), techStack: [], plan: {}, createdAt: new Date().toISOString() };
    setCreatingProject(true);
    pendingWrites.current += 1;
    setSaving(true);
    setDataError('');
    try {
      await setDoc(doc(db, 'users', user.uid, 'projects', project.id), project);
      setProjects(current => (editingProject ? current.map(item => item.id === project.id ? project : item) : [...current, project]).sort((a, b) => a.name.localeCompare(b.name)));
      setProjectModal(false);
      setEditingProject(null);
      setProjectForm({ name: '', description: '' });
      setProjectsOpen(true);
      setSelectedProjectId(project.id);
    } catch (error) {
      setDataError(error.message || 'Could not save the project to Firebase.');
    } finally {
      pendingWrites.current -= 1;
      setSaving(pendingWrites.current > 0);
      setCreatingProject(false);
    }
  };
  const saveProjectUpdate = async (project) => {
    if (!user || !db) return false;
    const updated = { ...project, updatedAt: new Date().toISOString() };
    pendingWrites.current += 1;
    setSaving(true);
    setDataError('');
    try {
      await setDoc(doc(db, 'users', user.uid, 'projects', updated.id), updated);
      setProjects(current => current.map(item => item.id === updated.id ? updated : item).sort((a, b) => a.name.localeCompare(b.name)));
      return true;
    } catch (error) {
      setDataError(error.message || 'Could not update project details.');
      return false;
    } finally {
      pendingWrites.current -= 1;
      setSaving(pendingWrites.current > 0);
    }
  };
  const addTechnology = (project, technology) => saveProjectUpdate({ ...project, techStack: [...(project.techStack || []), { ...technology, id: crypto.randomUUID() }] });
  const removeTechnology = (project, technologyId) => saveProjectUpdate({ ...project, techStack: (project.techStack || []).filter(item => item.id !== technologyId) });
  const saveProjectPlan = (project, plan) => saveProjectUpdate({ ...project, plan });
  const submitAuth = async (e) => {
    e.preventDefault();
    setAuthBusy(true); setAuthError('');
    try {
      if (!firebaseConfigured) throw new Error('Firebase is not configured yet. Add the Firebase web app settings to .env.local.');
      if (authMode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
        if (authForm.name.trim()) await updateProfile(credential.user, { displayName: authForm.name.trim() });
      } else await signInWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
    } catch (error) {
      const messages = { 'auth/email-already-in-use': 'An account already exists for this email. Try signing in.', 'auth/invalid-credential': 'That email and password do not match.', 'auth/weak-password': 'Use a password with at least 6 characters.', 'auth/invalid-email': 'Enter a valid email address.', 'auth/too-many-requests': 'Too many attempts. Please try again shortly.' };
      setAuthError(messages[error.code] || error.message || 'Could not authenticate. Check your Firebase setup and try again.');
    } finally { setAuthBusy(false); }
  };
  const handleSignOut = async () => {
    setSignOutBusy(true);
    try { await signOut(auth); }
    catch (error) { setDataError(error.message || 'Could not sign out.'); }
    finally { setSignOutBusy(false); }
  };

  if (!authReady) return <div className="auth-loading"><span className="loading-spinner"/>Opening your learning board…</div>;
  if (!user) return <AuthPage mode={authMode} setMode={mode => { setAuthMode(mode); setAuthError(''); }} form={authForm} setForm={setAuthForm} error={authError} onSubmit={submitAuth} busy={authBusy} configured={firebaseConfigured} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Code2 size={19}/></div><span>dayboard<span className="brand-period">.</span></span></div>
      <div className="workspace-label">WORKSPACE <button className="tiny-chevron"><ChevronDown size={13}/></button></div>
      <nav className="side-navigation"><button className={`nav-item ${activePage === 'goals' ? 'active' : ''}`} onClick={() => { setSelectedProjectId(null); setActivePage('goals'); }}><Target size={17}/><span>Goals</span></button><button className={`nav-item ${activePage === 'board' && !selectedProjectId ? 'active' : ''}`} onClick={() => { setSelectedProjectId(null); setActivePage('board'); }}><LayoutDashboard size={17}/><span>My board</span><span className="nav-count">{tasks.length}</span></button>{userRole === 'admin' && <button className={`nav-item ${activePage === 'admin' ? 'active' : ''}`} onClick={() => { setSelectedProjectId(null); setActivePage('admin'); }}><ShieldCheck size={17}/><span>Admin</span></button>}<div className="projects-header"><button className={`nav-item projects-nav ${projectsOpen ? 'expanded' : ''}`} aria-expanded={projectsOpen} onClick={() => setProjectsOpen(value => !value)}><FolderKanban size={17}/><span>Projects</span><ChevronDown size={14} className="projects-chevron"/></button><button type="button" className="project-add-button" aria-label="Add project" title="Add project" onClick={() => { setEditingProject(null); setProjectForm({ name: '', description: '' }); setProjectModal(true); }}><Plus size={16}/></button></div>{projectsOpen && <div className="projects-list">{projects.map(project => <div className={`project-link ${selectedProjectId === project.id ? 'selected' : ''}`} key={project.id} title={project.description || project.name}><button type="button" className="project-open-button" onClick={() => { setSelectedProjectId(project.id); setActivePage('board'); }}><span className="project-dot"/><span className="project-name">{project.name}</span></button><button type="button" className="project-edit-button" aria-label={`Edit ${project.name}`} title={`Edit ${project.name}`} onClick={() => { setEditingProject(project); setProjectForm({ name: project.name, description: project.description || '' }); setProjectModal(true); }}><Pencil size={13}/></button></div>)}{projects.length === 0 && <div className="projects-empty">No projects yet</div>}</div>}</nav>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{activePage === 'goals' ? 'Goals' : activePage === 'admin' ? 'Admin' : projects.find(project => project.id === selectedProjectId)?.name || 'My board'}</b></div><div className="top-actions"><span className="today-date"><CalendarDays size={15}/> {dateLabel}</span><button className="signout-button" onClick={handleSignOut} disabled={signOutBusy}>{signOutBusy && <span className="loading-spinner small"/>}{signOutBusy ? 'Signing out…' : 'Sign out'}</button></div></header>
      <section className="page-content">
        {!tasksReady && <div className="data-notice"><span className="loading-spinner"/>Loading your saved goals…</div>}{saving && <div className="save-indicator" role="status"><span className="loading-spinner small"/>Saving changes…</div>}{dataError && <div className="data-error" role="alert">{dataError}</div>}
        {activePage === 'admin' ? <AdminUsersPage users={adminUsers} loading={adminUsersLoading} error={adminUsersError} onRefresh={() => setAdminRefresh(value => value + 1)} /> : activePage === 'goals' ? <GoalsPage goals={personalGoals} loading={goalsLoading} onAddGoal={() => { setGoalName(''); setGoalModal(true); }} onOpenGoal={goal => { setActiveGoal(goal); setActiveTopicId(goal.topics?.[0]?.id || ''); setTopicName(''); setDataError(''); }} /> : selectedProjectId && projects.some(project => project.id === selectedProjectId) ? <ProjectPage project={projects.find(project => project.id === selectedProjectId)} onBack={() => setSelectedProjectId(null)} onEdit={() => { const project = projects.find(item => item.id === selectedProjectId); setEditingProject(project); setProjectForm({ name: project.name, description: project.description || '' }); setProjectModal(true); }} onAddTechnology={addTechnology} onRemoveTechnology={removeTechnology} onSavePlan={saveProjectPlan} saving={saving}/> : <>
        <div className="page-heading"><div><div className="eyebrow"><Sparkles size={13}/> YOUR DAILY PRACTICE</div><h1>Learning board<span className="heading-dot">.</span></h1><p className="subheading">Small steps today. Big things tomorrow.</p></div><button className="primary-button" onClick={() => setModal(true)}><Plus size={17}/> Add a goal</button></div>
        <div className="board-toolbar"><div className="board-title"><h2>Today's goals</h2><span className="board-date">{dateBadge}</span></div><button className={`done-toggle ${showDone ? 'is-on' : ''}`} type="button" aria-expanded={showDone} onClick={() => setShowDone(value => !value)}>{showDone ? <EyeOff size={15}/> : <Eye size={15}/>}<span>{showDone ? 'Hide done' : 'Show done'}</span><span className="done-toggle-count">{tasks.filter(task => task.status === 'done').length}</span></button></div>
        <div className={`board ${showDone ? 'board-with-done' : 'board-two-columns'}`}>{columns.filter(col => showDone || col.id !== 'done').map(col => { const items = visible.filter(t => t.status === col.id); return <section key={col.id} className={`column ${dragOver === col.id ? 'column-over' : ''}`} onDragOver={e => { e.preventDefault(); setDragOver(col.id); }} onDragLeave={() => setDragOver(null)} onDrop={e => { e.preventDefault(); if (dragId) move(dragId, col.id); setDragId(null); setDragOver(null); }}><div className="column-head"><div className="column-label"><span className={`status-dot ${col.tone}`}/><h3>{col.label}</h3><span className="column-count">{items.length}</span></div><button className="icon-button" aria-label={`Add goal to ${col.label}`} onClick={() => { setForm({ ...form, status: col.id }); setModal(true); }}><Plus size={17}/></button></div><div className="task-list">{items.map(task => <article key={task.id} draggable onDragStart={() => setDragId(task.id)} onDragEnd={() => { setDragId(null); setDragOver(null); }} onClick={() => setSelectedTask(task)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTask(task); } }} tabIndex={0} role="button" aria-label={`View details for ${task.title}`} className={`task-card ${dragId === task.id ? 'dragging' : ''}`}><div className="card-top"><span className={`category-tag ${task.category.toLowerCase().replace(/[^a-z]/g, '')}`}>{task.category}</span>{task.learningMode && <span className={`learning-mode mode-${task.learningMode.toLowerCase()}`}>{task.learningMode}</span>}<button className="card-delete" aria-label={`Delete ${task.title}`} onClick={e => { e.stopPropagation(); remove(task.id); }} title="Delete goal"><Trash2 size={15}/></button></div><h4>{task.title}</h4>{task.description && <p>{task.description}</p>}<div className="card-footer"><span className={`priority priority-${task.priority.toLowerCase()}`}><span/> {task.priority}</span><span className={`due ${task.due === 'Today' ? 'due-today' : ''}`}><Clock3 size={13}/>{task.due}</span></div></article>)}{items.length === 0 && <div className="empty-state"><div className="empty-mark"><GripVertical size={19}/></div><span>{col.id === 'done' ? 'Completed goals land here' : 'Drop a goal here'}</span><small>Drag cards to update their status</small></div>}</div>{col.id === 'todo' && <button className="add-inline" onClick={() => { setForm({ ...form, status: col.id }); setModal(true); }}><Plus size={16}/> Add a goal</button>}</section>; })}</div>
        <div className="board-hint"><GripVertical size={14}/> Drag a goal between columns to update its status</div>
        <footer className="page-footer">Made with <span aria-label="love">♥</span> and a little AI</footer>
        </>}
      </section>
    </main>
    {goalModal && <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget && !goalSaving) setGoalModal(false); }}><form className="modal goal-modal" onSubmit={submitPersonalGoal} aria-labelledby="goal-modal-title"><div className="modal-head"><div><span className="modal-eyebrow">YOUR LEARNING GOALS</span><h2 id="goal-modal-title">Add a skill to master</h2></div><button type="button" className="icon-button close-button" aria-label="Close goal form" disabled={goalSaving} onClick={() => setGoalModal(false)}><X size={19}/></button></div><p className="goal-modal-prompt">What technology or skill do you want to excel in?</p><label className="form-label">Technology or skill <span>*</span><input autoFocus required maxLength="80" value={goalName} onChange={event => setGoalName(event.target.value)}/></label><div className="modal-actions"><button type="button" className="cancel-button" disabled={goalSaving} onClick={() => setGoalModal(false)}>Cancel</button><button type="submit" className="primary-button" disabled={goalSaving || !goalName.trim()}>{goalSaving && <span className="loading-spinner small"/>}{goalSaving ? 'Saving…' : <><Check size={16}/> Done</>}</button></div></form></div>}
    {activeGoal && <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget && !topicSaving && !topicTaskSaving) { setActiveGoal(null); setActiveTopicId(null); setDataError(''); } }}>
      <section className="modal goal-detail-modal" aria-labelledby="goal-detail-title">
        <div className="modal-head"><div><span className="modal-eyebrow">SKILL PLAN</span><h2 id="goal-detail-title">{activeGoal.name}</h2></div><button type="button" className="icon-button close-button" aria-label="Close skill plan" disabled={topicSaving || topicTaskSaving} onClick={() => { setActiveGoal(null); setActiveTopicId(null); setDataError(''); }}><X size={19}/></button></div>
        <p className="goal-detail-intro">Organize topics, then build a task list with a topic and learning details for each task.</p>
        <div className="goal-progress-summary">{activeGoalTasks.length} tasks · {activeGoalTasks.filter(task => task.done).length} completed</div>
        <label className="goal-priority-control">Goal priority<select aria-label="Goal priority" value={activeGoal.priority || 'Normal'} disabled={goalPrioritySaving || topicSaving} onChange={event => saveGoalPriority(event.target.value)}><option>Normal</option><option>High</option></select>{goalPrioritySaving && <span className="loading-spinner small"/>}</label>

        <section className="skill-plan-topics" aria-labelledby="skill-plan-topics-title">
          <div className="skill-plan-section-heading"><div><h3 id="skill-plan-topics-title">Topics</h3><p>Add topics here to make them available on each task.</p></div><span>{(activeGoal.topics || []).length}</span></div>
          {(activeGoal.topics || []).length > 0 && <div className="skill-topic-chips">{activeGoal.topics.map(topic => <span key={topic.id}>{topic.name}</span>)}</div>}
          <form className="goal-topic-form" onSubmit={submitTopic}><label className="form-label">New topic <span>*</span><input required maxLength="80" value={topicName} onChange={event => setTopicName(event.target.value)}/></label><button type="submit" className="primary-button" disabled={topicSaving || !topicName.trim()}>{topicSaving && <span className="loading-spinner small"/>}{topicSaving ? 'Saving…' : <><Plus size={16}/> Add topic</>}</button></form>
        </section>

        <section className="skill-plan-task-create" aria-labelledby="skill-plan-task-title">
          <div className="skill-plan-section-heading"><div><h3 id="skill-plan-task-title">Add a task</h3><p>Choose what to learn and how you’ll practice it.</p></div></div>
          <form className="skill-task-create-form" onSubmit={submitTopicTask}>
            <label className="form-label skill-task-title-field"><span className="skill-field-label">Task <span>*</span></span><input required maxLength="100" value={topicTaskName} onChange={event => setTopicTaskName(event.target.value)}/></label>
            <label className="form-label"><span className="skill-field-label">Topic <span>*</span></span><select required value={activeTopicId} onChange={event => setActiveTopicId(event.target.value)} disabled={!activeGoal.topics?.length}><option value="">{activeGoal.topics?.length ? 'Choose a topic' : 'Add a topic first'}</option>{(activeGoal.topics || []).map(topic => <option value={topic.id} key={topic.id}>{topic.name}</option>)}</select></label>
            <label className="form-label">Learning mode<select value={topicTaskKind} onChange={event => setTopicTaskKind(event.target.value)}><option>Learn</option><option>Practice</option><option>Build</option><option>Revise</option></select></label>
            <label className="form-label">Difficulty<select value={topicTaskDifficulty} onChange={event => setTopicTaskDifficulty(event.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
            <label className="form-label">Plan for<input type="date" min={localDateKey()} value={topicTaskDate} onChange={event => setTopicTaskDate(event.target.value)}/></label>
            <label className="form-label">Revision reminder<input type="date" min={localDateKey()} value={topicTaskRevisionDate} onChange={event => setTopicTaskRevisionDate(event.target.value)}/></label>
            <label className="form-label skill-task-wide">Notes<textarea rows="2" value={topicTaskNotes} onChange={event => setTopicTaskNotes(event.target.value)}/></label>
            <label className="form-label skill-task-wide"><span className="skill-field-label">Practice links <span className="optional">One URL per line</span></span><textarea rows="2" value={topicTaskLinks} onChange={event => setTopicTaskLinks(event.target.value)}/></label>
            <button type="submit" className="primary-button skill-task-submit" disabled={topicTaskSaving || saving || !topicTaskName.trim() || !activeTopicId}>{(topicTaskSaving || saving) && <span className="loading-spinner small"/>}{topicTaskSaving ? 'Saving…' : <><Plus size={15}/> Add task</>}</button>
          </form>
        </section>

        {dataError && <div className="goal-topic-error" role="alert">{dataError}</div>}
        <section className="skill-plan-task-list" aria-labelledby="skill-plan-tasks-title"><div className="skill-plan-section-heading"><div><h3 id="skill-plan-tasks-title">Tasks</h3><p>Tasks are grouped here; status changes stay on the board.</p></div><span>{activeGoalTasks.length}</span></div>
          {activeGoalTasks.length ? <div className="skill-task-cards">{activeGoalTasks.map(task => { const topic = task.legacyTopic; const difficulty = task.difficulty || topic.difficulty || 'Beginner'; const revisionDate = task.revisionDate || topic.revisionDate || ''; const notes = task.notes ?? topic.notes ?? ''; const links = task.links || topic.links || []; const minutes = (task.sessions || []).reduce((sum, session) => sum + (Number(session.minutes) || 0), 0) + (!task.sessions?.length && topic.tasks?.[0]?.id === task.id ? (topic.sessions || []).reduce((sum, session) => sum + (Number(session.minutes) || 0), 0) : 0); return <article className="skill-task-card" key={task.id}>
            <header><div><span className={`learning-mode mode-${(task.kind || 'Practice').toLowerCase()}`}>{task.kind || 'Practice'}</span><h4>{task.name}</h4><small>{task.topicName} · {difficulty}</small></div>{task.done && <span className="topic-task-board-status is-done">Done ✓</span>}</header>
            {notes && <p className="skill-task-notes">{notes}</p>}{cleanResourceLinks(links).map(link => <a className="topic-resource-link" key={link} href={link} target="_blank" rel="noreferrer">{link}</a>)}
            <details className="skill-task-details"><summary>Edit details · {revisionDate ? `revision ${revisionDate}` : 'no revision date'}</summary><div className="skill-task-details-grid"><label>Topic<select value={task.topicId} disabled={Boolean(task.boardTaskId)} onChange={event => moveTopicTask(task, event.target.value)}><option value={task.topicId}>{task.topicName}</option>{(activeGoal.topics || []).filter(item => item.id !== task.topicId).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Learning mode<select value={task.kind || 'Practice'} onChange={event => updateTopicTaskField(task.topicId, task.id, 'kind', event.target.value)}><option>Learn</option><option>Practice</option><option>Build</option><option>Revise</option></select></label><label>Difficulty<select value={difficulty} onChange={event => updateTopicTaskField(task.topicId, task.id, 'difficulty', event.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label><label>Revision reminder<input type="date" min={localDateKey()} value={revisionDate} onChange={event => updateTopicTaskField(task.topicId, task.id, 'revisionDate', event.target.value)}/></label><label>Plan for<input type="date" min={localDateKey()} value={task.plannedDate || localDateKey()} onChange={event => updateTopicTaskField(task.topicId, task.id, 'plannedDate', event.target.value)}/></label><label className="skill-task-wide">Notes<textarea defaultValue={notes} rows="2" onBlur={event => { if (event.target.value !== notes) updateTopicTaskField(task.topicId, task.id, 'notes', event.target.value); }}/></label><label className="skill-task-wide">Practice links<textarea defaultValue={cleanResourceLinks(links).join('\n')} rows="2" onBlur={event => { const next = cleanResourceLinks(event.target.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean)); if (JSON.stringify(next) !== JSON.stringify(links)) updateTopicTaskField(task.topicId, task.id, 'links', next); }}/></label>{revisionDate && revisionDate <= localDateKey() && (!task.lastReviewed || task.lastReviewed < revisionDate) && <button type="button" className="revision-reminder" onClick={() => { const next = new Date(); next.setDate(next.getDate() + 7); updateTopicTaskFields(task.topicId, task.id, { lastReviewed: localDateKey(), revisionDate: localDateKey(next) }); }}>Revision due · mark reviewed</button>}</div></details>
            <form className="study-time-form" onSubmit={event => { event.preventDefault(); logStudyTime(task.topicId, task.id); }}><span><Clock3 size={14}/> {minutes} min logged</span><input aria-label={`Minutes studied on ${task.name}`} type="number" min="1" max="1440" value={studyMinutes} onChange={event => setStudyMinutes(event.target.value)}/><button type="submit" disabled={saving}>Log time</button>{task.boardTaskId ? <span className={`topic-task-board-status ${task.done ? 'is-done' : ''}`}>{task.done ? 'Done ✓' : 'On board'}</span> : <button type="button" className="topic-task-add-board" disabled={saving} onClick={() => addTopicTaskToBoard(task.topicId, task.id)}><Plus size={13}/> Add to To do</button>}<button type="button" className="topic-task-delete" aria-label={`Delete ${task.name}`} title={task.boardTaskId ? 'Remove from the board before deleting' : 'Delete task'} disabled={saving || Boolean(task.boardTaskId)} onClick={() => deleteTopicTask(task.topicId, task.id)}><Trash2 size={14}/></button></form>
          </article>; })}</div> : <p className="topic-task-empty">No tasks yet. Add one above and choose its topic.</p>}
        </section>
      </section>
    </div>}
    {modal && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModal(false); }}><form className="modal" onSubmit={createTask}><div className="modal-head"><div><span className="modal-eyebrow">NEW LEARNING GOAL</span><h2>Add to your board</h2></div><button type="button" className="icon-button close-button" onClick={() => setModal(false)}><X size={19}/></button></div><label className="form-label">Goal title <span>*</span><input autoFocus required maxLength="100" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label><label className="form-label">Description <span className="optional">Optional</span><textarea rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label><div className="form-row"><label className="form-label">Topic<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label className="form-label">Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{columns.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}</select></label></div><div className="form-row"><label className="form-label">Due<select value={form.due} onChange={e => setForm({ ...form, due: e.target.value })}><option>Today</option><option>Tomorrow</option><option>This week</option></select></label><label className="form-label">Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setModal(false)}>Cancel</button><button type="submit" className="primary-button"><Plus size={16}/> Add goal</button></div></form></div>}
    {selectedTask && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setSelectedTask(null); }}><form className="modal detail-modal" onSubmit={submitTaskEdit} aria-labelledby="detail-title"><div className="modal-head"><div><span className="modal-eyebrow">EDIT LEARNING GOAL</span><h2 id="detail-title">Update your goal</h2></div><button type="button" className="icon-button close-button" aria-label="Close editor" onClick={() => setSelectedTask(null)}><X size={19}/></button></div><label className="form-label">Goal title <span>*</span><input autoFocus required maxLength="100" value={selectedTask.title} onChange={e => updateSelectedTask('title', e.target.value)}/></label><label className="form-label">Description <span className="optional">Optional</span><textarea rows="4" value={selectedTask.description || ''} onChange={e => updateSelectedTask('description', e.target.value)}/></label><div className="form-row"><label className="form-label">Topic<select value={selectedTask.category} onChange={e => updateSelectedTask('category', e.target.value)}>{categories.map(category => <option key={category}>{category}</option>)}</select></label><label className="form-label">Status<select value={selectedTask.status} onChange={e => updateSelectedTask('status', e.target.value)}>{columns.map(column => <option value={column.id} key={column.id}>{column.label}</option>)}</select></label></div><div className="form-row"><label className="form-label">Due<select value={selectedTask.due} onChange={e => updateSelectedTask('due', e.target.value)}><option>Today</option><option>Tomorrow</option><option>This week</option></select></label><label className="form-label">Priority<select value={selectedTask.priority} onChange={e => updateSelectedTask('priority', e.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></label></div><div className="modal-actions"><button type="button" className="delete-goal-button" onClick={() => { remove(selectedTask.id); setSelectedTask(null); }}>Delete goal</button><button type="button" className="cancel-button" onClick={() => setSelectedTask(null)}>Cancel</button><button type="submit" className="primary-button"><Check size={16}/> Save changes</button></div></form></div>}
    {projectModal && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !creatingProject) { setProjectModal(false); setEditingProject(null); } }}><form className="modal" onSubmit={createProject} aria-labelledby="project-modal-title"><div className="modal-head"><div><span className="modal-eyebrow">PROJECTS</span><h2 id="project-modal-title">{editingProject ? 'Edit project' : 'Create a project'}</h2></div><button type="button" className="icon-button close-button" aria-label="Close project form" disabled={creatingProject} onClick={() => { setProjectModal(false); setEditingProject(null); }}><X size={19}/></button></div><label className="form-label">Project name <span>*</span><input autoFocus required maxLength="80" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}/></label><label className="form-label">Description <span className="optional">Optional</span><textarea rows="3" maxLength="240" value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}/></label><div className="modal-actions"><button type="button" className="cancel-button" disabled={creatingProject} onClick={() => { setProjectModal(false); setEditingProject(null); }}>Cancel</button><button type="submit" className="primary-button" disabled={creatingProject}>{creatingProject && <span className="loading-spinner small"/>}{creatingProject ? 'Saving…' : <><Check size={16}/> {editingProject ? 'Save changes' : 'Create project'}</>}</button></div></form></div>}
  </div>;
}

function ProjectPage({ project, onBack, onEdit, onAddTechnology, onRemoveTechnology, onSavePlan, saving }) {
  const [addingTechnology, setAddingTechnology] = useState(false);
  const [technologyForm, setTechnologyForm] = useState({ name: '', category: 'Framework', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [planDraft, setPlanDraft] = useState(project.plan || {});
  const [savingPlan, setSavingPlan] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const technologies = project.techStack || [];

  useEffect(() => { setPlanDraft(project.plan || {}); }, [project.id]);

  const submitTechnology = async event => {
    event.preventDefault();
    if (!technologyForm.name.trim() || !technologyForm.reason.trim()) return;
    setSubmitting(true);
    const saved = await onAddTechnology(project, { name: technologyForm.name.trim(), category: technologyForm.category, reason: technologyForm.reason.trim() });
    if (saved) {
      setTechnologyForm({ name: '', category: 'Framework', reason: '' });
      setAddingTechnology(false);
    }
    setSubmitting(false);
  };
  const submitPlan = async event => {
    event.preventDefault();
    setSavingPlan(true);
    const saved = await onSavePlan(project, planDraft);
    setPlanSaved(saved);
    setSavingPlan(false);
  };

  return <div className="project-page">
    <button className="back-to-board" onClick={onBack}><ArrowLeft size={15}/> Back to board</button>
    <header className="project-page-heading"><div><div className="eyebrow"><FolderKanban size={13}/> PROJECT WORKSPACE</div><h1>{project.name}</h1><p className="subheading">{project.description || 'Capture the product plan, tools, delivery workflow, and release notes for this app.'}</p></div><button className="secondary-project-button" onClick={onEdit}><Pencil size={14}/> Edit project</button></header>

    <section className="project-plan-section"><div className="project-section-intro"><div><span className="project-section-kicker">FROM IDEA TO RELEASE</span><h2>Project brief</h2><p>Keep the purpose, requirements, engineering choices, delivery plan, and ongoing operations in one place.</p></div></div>
      <form className="project-plan-form" onSubmit={submitPlan}>{projectPlanGroups.map(group => <fieldset className="plan-group" key={group.title}><legend>{group.title}</legend><div className="plan-fields">{group.fields.map(field => <label className={`plan-field ${field.singleLine ? 'single-line' : ''}`} key={field.id}><span>{field.label}</span>{field.singleLine ? <input value={planDraft[field.id] || ''} maxLength="300" onChange={event => { setPlanSaved(false); setPlanDraft({ ...planDraft, [field.id]: event.target.value }); }}/> : <textarea rows="3" maxLength="1600" value={planDraft[field.id] || ''} onChange={event => { setPlanSaved(false); setPlanDraft({ ...planDraft, [field.id]: event.target.value }); }}/>}</label>)}</div></fieldset>)}<div className="plan-actions"><span className="plan-security-note"><LockKeyhole size={13}/> Store secret references here, never secret values.</span><button className="primary-button" type="submit" disabled={savingPlan || saving}>{(savingPlan || saving) && <span className="loading-spinner small"/>}{savingPlan || saving ? 'Saving…' : planSaved ? <><Check size={15}/> Saved</> : 'Save project brief'}</button></div></form>
    </section>

    <section className="tech-section"><div className="tech-section-header"><div><span className="project-section-kicker">TOOLS AND REASONS</span><h2>Technology inventory</h2><p>Track frameworks, plugins, CI/CD, hosting, testing, and other choices with a reason for each.</p></div><button className="primary-button" onClick={() => setAddingTechnology(value => !value)}><Plus size={16}/>{addingTechnology ? 'Close form' : 'Add technology'}</button></div>
      {addingTechnology && <form className="technology-form" onSubmit={submitTechnology}><div className="form-row"><label className="form-label">Technology <span>*</span><input autoFocus required maxLength="60" value={technologyForm.name} onChange={event => setTechnologyForm({ ...technologyForm, name: event.target.value })}/></label><label className="form-label">Category<select value={technologyForm.category} onChange={event => setTechnologyForm({ ...technologyForm, category: event.target.value })}>{technologyCategories.map(category => <option key={category}>{category}</option>)}</select></label></div><label className="form-label">Why are you using it? <span>*</span><textarea required rows="3" maxLength="500" value={technologyForm.reason} onChange={event => setTechnologyForm({ ...technologyForm, reason: event.target.value })}/></label><div className="technology-form-actions"><button type="button" className="cancel-button" disabled={submitting} onClick={() => setAddingTechnology(false)}>Cancel</button><button type="submit" className="primary-button" disabled={submitting || saving}>{(submitting || saving) && <span className="loading-spinner small"/>}{submitting || saving ? 'Saving…' : 'Add to inventory'}</button></div></form>}
      {technologies.length ? <div className="technology-list">{technologies.map(item => <article className="technology-card" key={item.id}><div className="technology-icon"><Code2 size={17}/></div><div className="technology-copy"><span className="technology-category">{item.category || 'Other'}</span><h3>{item.name}</h3><p>{item.reason}</p></div><button type="button" className="technology-delete" aria-label={`Remove ${item.name} from technology inventory`} title="Remove technology" disabled={saving} onClick={() => onRemoveTechnology(project, item.id)}><Trash2 size={15}/></button></article>)}</div> : !addingTechnology && <div className="tech-empty"><div className="technology-icon"><Code2 size={18}/></div><h3>No tools in the inventory yet</h3><p>Add the frameworks, plugins, services, and delivery tools this app will use, with a reason for each.</p><button className="text-add-button" onClick={() => setAddingTechnology(true)}><Plus size={15}/> Add your first technology</button></div>}
    </section>
  </div>;
}

function GoalsPage({ goals, loading, onAddGoal, onOpenGoal }) {
  const skillIcon = name => { const value = name.toLowerCase(); if (/react/.test(value)) return Atom; if (/javascript|typescript|programming|coding/.test(value)) return Braces; if (/cloud|aws|azure|firebase/.test(value)) return Cloud; if (/machine learning|\bml\b|ai|artificial intelligence/.test(value)) return Brain; if (/data|database|sql/.test(value)) return Database; if (/css|design|ui|ux/.test(value)) return Palette; if (/angular|framework|architecture/.test(value)) return Layers; if (/terminal|command line|shell/.test(value)) return Terminal; if (/reading|study|learning/.test(value)) return BookOpen; return Code2; };
  const topics = goals.flatMap(goal => (goal.topics || []).map(topic => ({ ...topic, goalName: goal.name })));
  const allTasks = topics.flatMap(topic => topic.tasks || []);
  const sessions = topics.flatMap(topic => [...(topic.sessions || []), ...(topic.tasks || []).flatMap(task => task.sessions || [])]);
  const today = localDateKey();
  const todayPlanTasks = topics.flatMap(topic => (topic.tasks || []).filter(task => !task.done && task.plannedDate === today).map(task => ({ ...task, topicName: topic.name, goalName: topic.goalName })));
  const todayPlan = todayPlanTasks.length;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
  const weekDone = allTasks.filter(task => task.done && task.completedAt && new Date(task.completedAt) >= weekStart).length;
  const weekMinutes = sessions.filter(session => new Date(session.createdAt) >= weekStart).reduce((sum, session) => sum + (Number(session.minutes) || 0), 0);
  const activeDays = new Set(sessions.map(session => session.date).filter(Boolean));
  let streak = 0; const cursor = new Date();
  if (!activeDays.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (activeDays.has(localDateKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  const dueReviews = topics.reduce((count, topic) => count + ((topic.tasks || []).length ? topic.tasks.filter(task => { const date = task.revisionDate || topic.revisionDate; return date && date <= today && (!task.lastReviewed || task.lastReviewed < date); }).length : (topic.revisionDate && topic.revisionDate <= today && (!topic.lastReviewed || topic.lastReviewed < topic.revisionDate) ? 1 : 0)), 0);
  return <div className="goals-page"><div className="goals-page-heading"><div><div className="eyebrow"><Target size={13}/> SKILLS YOU WANT TO MASTER</div><h1>Goals<span className="heading-dot">.</span></h1><p className="goals-page-subtitle">Choose a skill to plan topics and track your practice.</p></div><button className="primary-button" onClick={onAddGoal}><Plus size={17}/> Add a goal</button></div>{!loading && goals.length > 0 && <><section className="learning-metrics" aria-label="Learning overview"><article><small>DAILY PLAN</small><strong>{todayPlan}</strong><span>tasks scheduled for today</span></article><article><small>LEARNING STREAK</small><strong>{streak} <em>days</em></strong><span>log study time to build consistency</span></article><article><small>THIS WEEK</small><strong>{weekDone} <em>tasks</em></strong><span>{Math.floor(weekMinutes / 60)}h {weekMinutes % 60}m logged · {dueReviews} reviews due</span></article></section><section className="daily-plan"><h2>Today's learning plan</h2>{todayPlanTasks.length ? <ul>{todayPlanTasks.slice(0, 5).map(task => <li key={task.id}><span className={`learning-mode mode-${(task.kind || 'Practice').toLowerCase()}`}>{task.kind || 'Practice'}</span><span><b>{task.name}</b><small>{task.goalName} · {task.topicName}</small></span></li>)}</ul> : <p>Open a skill topic and add a task scheduled for today.</p>}{todayPlanTasks.length > 5 && <small>Plus {todayPlanTasks.length - 5} more on your plan</small>}</section><section className="weekly-review"><div><b>Weekly review</b><span>{weekDone} tasks completed · {Math.floor(weekMinutes / 60)}h {weekMinutes % 60}m learning time</span></div><span>{weekDone === 0 && weekMinutes === 0 ? 'Log a session or complete a task to start your review.' : `${allTasks.length ? Math.round(allTasks.filter(task => task.done).length / allTasks.length * 100) : 0}% of practice tasks completed overall`}</span></section></>}{loading ? <div className="goals-loading"><span className="loading-spinner"/>Loading your goals…</div> : goals.length ? <div className="goal-tile-grid">{goals.map(goal => { const topicCount = (goal.topics || []).length; const tasks = (goal.topics || []).flatMap(topic => topic.tasks || []); const done = tasks.filter(task => task.done).length; const Icon = skillIcon(goal.name); return <button type="button" className="goal-tile" key={goal.id} onClick={() => onOpenGoal(goal)} aria-label={`Open ${goal.name}: ${topicCount} topics, ${done} of ${tasks.length} tasks complete`}><span className="goal-tile-mark"><Icon size={19}/></span><h2>{goal.name}</h2>{goal.priority === 'High' && <span className="goal-priority-badge">High priority</span>}<span className="goal-tile-topic-count">{topicCount} {topicCount === 1 ? 'topic' : 'topics'} · {done}/{tasks.length} tasks done</span>{tasks.length > 0 && <span className="goal-progress-track"><span style={{ width: `${Math.round(done / tasks.length * 100)}%` }}/></span>}</button>; })}</div> : <div className="goals-empty"><div className="goals-illustration" aria-hidden="true"><svg viewBox="0 0 160 120" fill="none"><path d="M29 95c20 12 76 11 101-2" stroke="#B9DFD2" strokeWidth="5" strokeLinecap="round"/><rect x="43" y="20" width="72" height="82" rx="15" transform="rotate(7 43 20)" fill="#FFF" stroke="#CFE7DD" strokeWidth="3"/><path d="m66 42 8 8 15-17" stroke="#087E70" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><path d="m61 66 35 4M59 78l25 3" stroke="#B9DFD2" strokeWidth="4" strokeLinecap="round"/><circle cx="119" cy="29" r="11" fill="#FFB946"/><path d="m31 36 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" fill="#22A58E"/><circle cx="119" cy="82" r="6" fill="#70A94F"/></svg></div><h2>Your learning starts with a skill</h2><p>Add a technology or skill, then break it into topics and focused tasks.</p><button className="primary-button" onClick={onAddGoal}><Plus size={16}/> Add your first goal</button></div>}</div>;
}

function AdminUsersPage({ users, loading, error, onRefresh }) {
  const formatDate = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'Never';
  return <div className="admin-users-page"><div className="admin-page-heading"><div><div className="eyebrow"><ShieldCheck size={13}/> ADMINISTRATION</div><h1>User directory<span className="heading-dot">.</span></h1><p>View the accounts registered for this learning board.</p></div><button className="secondary-button" onClick={onRefresh} disabled={loading}><RefreshCw size={15} className={loading ? 'refresh-spinning' : ''}/> Refresh</button></div><section className="admin-users-card"><header><div><h2>Users</h2><p>{loading ? 'Loading accounts…' : `${users.length} ${users.length === 1 ? 'account' : 'accounts'}`}</p></div><Users size={19}/></header>{error && <div className="admin-users-error" role="alert">{error}</div>}{loading ? <div className="admin-users-loading"><span className="loading-spinner"/>Loading user accounts…</div> : users.length === 0 ? <div className="admin-users-empty">No user accounts were returned.</div> : <div className="admin-table-wrap"><table className="admin-users-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Last sign in</th></tr></thead><tbody>{users.map(account => <tr key={account.uid}><td><div className="admin-account-name"><span>{(account.displayName || account.email || '?').slice(0,1).toUpperCase()}</span><b>{account.displayName || 'Name not provided'}</b></div></td><td>{account.email || '—'}</td><td><span className={`admin-role-pill ${account.role === 'admin' ? 'is-admin' : ''}`}>{account.role}</span></td><td>{formatDate(account.createdAt)}</td><td>{formatDate(account.lastSignInAt)}{account.disabled && <small className="admin-disabled-label"> · disabled</small>}</td></tr>)}</tbody></table></div>}</section><p className="admin-security-note"><LockKeyhole size={14}/> The directory is served by a Firebase callable function and restricted to accounts with the admin role.</p></div>;
}

function AuthPage({ mode, setMode, form, setForm, error, onSubmit, busy, configured }) {
  const signup = mode === 'signup';
  const [showPassword, setShowPassword] = useState(false);
  return <main className="auth-page"><div className="auth-decoration auth-decoration-one"/><div className="auth-decoration auth-decoration-two"/><section className="auth-panel"><div className="auth-brand"><span className="brand-mark"><Code2 size={19}/></span><span>dayboard<span className="brand-period">.</span></span></div><div className="auth-intro"><div className="eyebrow"><Sparkles size={13}/> YOUR DAILY PRACTICE</div><h1>{signup ? 'Make room to grow.' : 'Good to see you.'}</h1><p>{signup ? 'Create a space for the skills you’re building.' : 'Pick up where your learning left off.'}</p></div><form className="auth-form" onSubmit={onSubmit}>
    {signup && <label className="auth-label">Your name<span className="auth-input"><UserRound size={16}/><input required autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></span></label>}
    <label className="auth-label">Email address<span className="auth-input"><Mail size={16}/><input type="email" required autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></span></label>
    <label className="auth-label">Password<span className="auth-input"><LockKeyhole size={16}/><input type={showPassword ? 'text' : 'password'} required minLength="6" autoComplete={signup ? 'new-password' : 'current-password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/><button className="auth-password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {!configured && <p className="auth-setup-note">Firebase isn’t configured for this deployment. For local development, add your web app values to <code>.env.local</code>. For GitHub Pages, add the matching <code>VITE_FIREBASE_*</code> values under this repository’s Settings → Secrets and variables → Actions, then redeploy.</p>}
    <button className="auth-submit" type="submit" disabled={busy || !configured}>{busy && <span className="loading-spinner small"/>}{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}{!busy && <ArrowRight size={17}/>}</button>
  </form><div className="auth-switch">{signup ? 'Already have an account?' : 'New to Dayboard?'} <button onClick={() => setMode(signup ? 'login' : 'signup')}>{signup ? 'Sign in' : 'Create an account'}</button></div><div className="auth-footnote"><LockKeyhole size={13}/> Your learning goals stay in this browser</div></section><aside className="auth-aside"><div className="auth-aside-content"><div className="auth-kicker">A LITTLE PROGRESS, EVERY DAY</div><h2>Turn what you<br/>want to learn into<br/><em>what you know.</em></h2><p>A calm space to keep your coding goals moving forward.</p><div className="auth-preview"><div className="preview-top"><span className="preview-dot violet"/><b>TO DO</b><span className="preview-number">3</span></div><div className="preview-task"><i/><div><b>Practice React hooks</b><small>React · Today</small></div></div><div className="preview-task"><i/><div><b>Explore CSS grid</b><small>CSS · Today</small></div></div><div className="preview-task"><i/><div><b>Review TypeScript</b><small>TypeScript · Tomorrow</small></div></div><div className="preview-progress"><span/></div><div className="preview-progress-caption">One step at a time</div></div></div><div className="auth-aside-footer">Made with <span>♥</span> and a little AI</div></aside></main>;
}

createRoot(document.getElementById('root')).render(<App/>);
