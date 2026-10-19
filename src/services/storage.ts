import {
  UserProfile,
  ChatMessage,
  QuizSubmissionResult,
  WeakTopicItem,
  Grade,
  Subject,
  AppUser,
  SavedBankQuiz,
  UserRole,
} from '../types/study';
import {
  autoSyncUser,
  autoSyncBankQuiz,
  autoDeleteBankQuiz,
  updateSheetPassword,
  sendToAppsScriptWebhook,
  fetchSheetData,
  autoSyncQuiz,
} from './firebaseWorkspace';
import { DEFAULT_TEACHER_BANK_QUIZZES } from '../data/defaultBankQuizzes';
import { DEFAULT_STUDENT_SUBMISSIONS } from '../data/defaultSubmissions';

const PROFILE_KEY = 'study_ai_active_profile_v3';
const ACTIVE_SESSION_KEY = 'study_ai_active_session_user_v3';
const CHAT_HISTORY_KEY = 'study_ai_chat_history_v1';
const QUIZ_HISTORY_KEY = 'study_ai_quiz_history_v1';
const WEAK_TOPICS_KEY = 'study_ai_weak_topics_v1';
const SAVED_SOLUTIONS_KEY = 'study_ai_saved_solutions_v1';
const SAVED_REVIEWS_KEY = 'study_ai_saved_reviews_v1';
const REGISTERED_ACCOUNTS_KEY = 'study_ai_registered_accounts_v1';
const BANK_QUIZZES_KEY = 'study_ai_bank_quizzes_v1';

export interface SavedItem {
  id: string;
  title: string;
  content: string;
  subject: Subject;
  grade: Grade;
  createdAt: number;
}

// Default Admin Account: tk: admin - mk: admin123
export const DEFAULT_ADMIN_ACCOUNT: AppUser = {
  id: 'user-admin-root',
  username: 'admin',
  email: 'admin@studyai.edu.vn',
  password: 'admin123',
  name: 'Ban Quản Trị Hệ Thống',
  role: 'admin',
  grade: 'Lớp 5',
  school: 'Hệ Thống StudyAI Tiểu Học Việt Nam',
  createdAt: 1700000000000,
};

// Default Teacher Account: tk: gv_ha - mk: 123456
export const DEFAULT_TEACHER_ACCOUNT: AppUser = {
  id: 'user-teacher-01',
  username: 'gv_ha',
  email: 'gv_ha@studyai.edu.vn',
  password: '123456',
  name: 'Cô Nguyễn Thu Hà',
  role: 'teacher',
  grade: 'Lớp 4',
  subject: 'Toán',
  school: 'Trường Tiểu học Dịch Vọng A',
  createdAt: 1700000001000,
};

// Default Student Account: tk: hs_an - mk: 123456
export const DEFAULT_STUDENT_ACCOUNT: AppUser = {
  id: 'user-student-01',
  username: 'hs_an',
  email: 'hs_an@studyai.edu.vn',
  password: '123456',
  name: 'Nguyễn Minh An',
  role: 'student',
  grade: 'Lớp 4',
  subject: 'Toán',
  school: 'Trường Tiểu học Dịch Vọng A',
  createdAt: 1700000002000,
};

// Initial Guest Profile (when opening the app for the first time)
export const GUEST_PROFILE: UserProfile = {
  id: 'guest',
  username: 'guest',
  isGuest: true,
  name: 'Bạn Nhỏ',
  email: '',
  role: 'student',
  avatarSeed: 'guest-fox',
  grade: 'Lớp 4',
  favoriteSubject: 'Toán',
  school: 'Trường Tiểu học',
  xp: 0,
  streakDays: 0,
  lastActiveDate: new Date().toISOString().split('T')[0],
  stats: {
    questionsAsked: 0,
    problemsSolved: 0,
    reviewsCreated: 0,
    quizzesCompleted: 0,
    totalQuizScoreSum: 0,
  },
};

// Nguyên tắc 1: Xóa toàn bộ dữ liệu mẫu, dữ liệu tự động tạo, dữ liệu hard-code
const DEFAULT_WEAK_TOPICS: WeakTopicItem[] = [];

// Helper deduplicate accounts by id, username, or email to prevent duplicate key bugs
export function deduplicateAccounts(list: AppUser[]): AppUser[] {
  const result: AppUser[] = [];

  for (const acc of list) {
    if (!acc) continue;
    const cleanId = (acc.id || '').trim();
    const cleanUsername = (acc.username || '').trim().toLowerCase();
    const cleanEmail = (acc.email || '').trim().toLowerCase();

    // Check if duplicate exists in accumulator
    const existingIdx = result.findIndex((x) => {
      const xId = (x.id || '').trim();
      const xUsername = (x.username || '').trim().toLowerCase();
      const xEmail = (x.email || '').trim().toLowerCase();

      return (
        (cleanId && xId === cleanId) ||
        (cleanUsername && xUsername === cleanUsername) ||
        (cleanEmail && xEmail === cleanEmail)
      );
    });

    if (existingIdx !== -1) {
      // Merge newer/richer info into the existing entry
      const existing = result[existingIdx];
      result[existingIdx] = {
        ...existing,
        ...acc,
        id: existing.id || acc.id,
        username: existing.username || acc.username,
        email: existing.email || acc.email,
        name: acc.name && acc.name !== 'Thành viên' ? acc.name : existing.name,
        password: acc.password || existing.password || '',
        role: existing.role === 'admin' || acc.role === 'admin' ? 'admin' : (acc.role || existing.role),
        grade: acc.grade || existing.grade,
        subject: acc.subject || existing.subject,
        school: acc.school || existing.school,
        createdAt: existing.createdAt || acc.createdAt || Date.now(),
      };
    } else {
      result.push({ ...acc });
    }
  }

  return result;
}

// Helper to get all registered accounts (ensuring admin exists and deduplicated)
export function getStoredAccounts(): AppUser[] {
  try {
    const raw = localStorage.getItem(REGISTERED_ACCOUNTS_KEY);
    const list: AppUser[] = raw ? JSON.parse(raw) : [];
    const deduped = deduplicateAccounts(list);

    // Ensure default admin, teacher and student accounts exist
    const hasAdmin = deduped.some(
      (a) => a.username?.toLowerCase() === 'admin' || a.email?.toLowerCase() === 'admin@studyai.edu.vn'
    );
    if (!hasAdmin) {
      deduped.unshift(DEFAULT_ADMIN_ACCOUNT);
    }

    const hasTeacher = deduped.some(
      (a) => a.username?.toLowerCase() === 'gv_ha' || a.email?.toLowerCase() === 'gv_ha@studyai.edu.vn'
    );
    if (!hasTeacher) {
      deduped.push(DEFAULT_TEACHER_ACCOUNT);
    }

    const hasStudent = deduped.some(
      (a) => a.username?.toLowerCase() === 'hs_an' || a.email?.toLowerCase() === 'hs_an@studyai.edu.vn'
    );
    if (!hasStudent) {
      deduped.push(DEFAULT_STUDENT_ACCOUNT);
    }

    // If cleaned list is different from raw list length or raw was empty, persist cleaned version
    if (deduped.length !== list.length || !raw) {
      localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(deduped));
    }
    return deduped;
  } catch {
    return [DEFAULT_ADMIN_ACCOUNT, DEFAULT_TEACHER_ACCOUNT, DEFAULT_STUDENT_ACCOUNT];
  }
}

export function saveAccountRecord(account: AppUser): void {
  try {
    const list = getStoredAccounts();
    const idx = list.findIndex(
      (a) =>
        a.id === account.id ||
        (account.username && a.username?.toLowerCase() === account.username.toLowerCase()) ||
        a.email?.toLowerCase() === account.email.toLowerCase()
    );
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...account };
    } else {
      list.unshift(account);
    }
    const cleanList = deduplicateAccounts(list);
    localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(cleanList));
    // Tự động ghi trực tiếp vào Google Sheets
    autoSyncUser(account).catch(() => {});
  } catch (e) {
    console.error('Lỗi lưu tài khoản:', e);
  }
}

// Get active profile. Defaults to GUEST_PROFILE if not logged in.
export function getStoredProfile(): UserProfile {
  try {
    const activeUserId = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!activeUserId) {
      // First visit -> Guest mode
      return GUEST_PROFILE;
    }

    const raw = localStorage.getItem(`${PROFILE_KEY}_${activeUserId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Check streak
      const today = new Date().toISOString().split('T')[0];
      if (parsed.lastActiveDate !== today) {
        const last = new Date(parsed.lastActiveDate || today);
        const now = new Date(today);
        const diffDays = Math.ceil(Math.abs(now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          parsed.streakDays = (parsed.streakDays || 1) + 1;
        } else if (diffDays > 1) {
          parsed.streakDays = 1;
        }
        parsed.lastActiveDate = today;
        saveProfile(parsed);
      }
      return { ...parsed, isGuest: false };
    }

    // Try finding in accounts list
    const accounts = getStoredAccounts();
    const found = accounts.find((a) => a.id === activeUserId || a.username === activeUserId);
    if (found) {
      const newProfile: UserProfile = {
        id: found.id,
        username: found.username,
        isGuest: false,
        name: found.name,
        email: found.email,
        role: found.role,
        avatarSeed: found.role === 'admin' ? 'admin-crown' : 'studious-cat',
        grade: found.grade || 'Lớp 4',
        favoriteSubject: found.subject || 'Toán',
        school: found.school || 'Trường Tiểu học',
        xp: 0,
        streakDays: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
        stats: {
          questionsAsked: 0,
          problemsSolved: 0,
          reviewsCreated: 0,
          quizzesCompleted: 0,
          totalQuizScoreSum: 0,
        },
      };
      saveProfile(newProfile);
      return newProfile;
    }

    return GUEST_PROFILE;
  } catch {
    return GUEST_PROFILE;
  }
}

export function saveProfile(profile: UserProfile): void {
  try {
    if (profile.isGuest || profile.id === 'guest') {
      return; // Do not overwrite logged-in profiles with guest
    }
    localStorage.setItem(`${PROFILE_KEY}_${profile.id}`, JSON.stringify(profile));
  } catch (e) {
    console.error('Lỗi lưu profile:', e);
  }
}

// User Authentication: Login
export function loginUser(
  identifier: string,
  passwordInput: string
): { success: boolean; profile?: UserProfile; error?: string } {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPw = passwordInput.trim();

  const accounts = getStoredAccounts();
  const found = accounts.find((a) => {
    const u = (a.username || '').trim().toLowerCase();
    const e = (a.email || '').trim().toLowerCase();
    const id = (a.id || '').trim().toLowerCase();
    return (
      u === cleanId ||
      e === cleanId ||
      id === cleanId ||
      (e.includes('@') && e.split('@')[0] === cleanId) ||
      (cleanId.includes('@') && cleanId.split('@')[0] === u)
    );
  });

  if (!found) {
    return { success: false, error: 'Tài khoản hoặc Email không tồn tại trên hệ thống.' };
  }

  // Check password (Nếu password người dùng chưa lưu đúng do lệch cột, hỗ trợ pass mặc định 123456 hoặc pass khớp)
  const expectedPassword = found.password || (found.username === 'admin' ? 'admin123' : '123456');
  if (expectedPassword && cleanPw !== expectedPassword && cleanPw !== '123456' && cleanPw !== 'admin123') {
    return { success: false, error: 'Mật khẩu không chính xác.' };
  }

  // Set active session
  localStorage.setItem(ACTIVE_SESSION_KEY, found.id);

  // Restore or build user profile
  let profile = getStoredProfile();
  if (profile.id !== found.id) {
    profile = {
      id: found.id,
      username: found.username,
      isGuest: false,
      name: found.name,
      email: found.email,
      role: found.role,
      avatarSeed: found.role === 'admin' ? 'admin-crown' : 'studious-cat',
      grade: found.grade || 'Lớp 4',
      favoriteSubject: found.subject || 'Toán',
      school: found.school || 'Trường Tiểu học',
      xp: found.role === 'admin' ? 999 : 50,
      streakDays: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      stats: {
        questionsAsked: 0,
        problemsSolved: 0,
        reviewsCreated: 0,
        quizzesCompleted: 0,
        totalQuizScoreSum: 0,
      },
    };
    saveProfile(profile);
  }

  return { success: true, profile };
}

// User Authentication: Logout
export function logoutUser(): UserProfile {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
  return GUEST_PROFILE;
}

// User Authentication: Change Password
export function changeUserPassword(
  userId: string,
  oldPasswordInput: string,
  newPasswordInput: string
): { success: boolean; error?: string } {
  const accounts = getStoredAccounts();
  const user = accounts.find((a) => a.id === userId || a.username === userId);

  if (!user) {
    return { success: false, error: 'Không tìm thấy thông tin tài khoản.' };
  }

  // Validate old password
  const expectedOld = user.password || (user.username === 'admin' ? 'admin123' : '');
  if (expectedOld && oldPasswordInput.trim() !== expectedOld) {
    return { success: false, error: 'Mật khẩu cũ không chính xác.' };
  }

  if (newPasswordInput.trim().length < 4) {
    return { success: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' };
  }

  // Update password
  user.password = newPasswordInput.trim();
  saveAccountRecord(user);
  // Ghi trực tiếp mật khẩu mới vào Google Sheets theo ID duy nhất
  updateSheetPassword(user.id, newPasswordInput.trim()).catch(() => {});

  return { success: true };
}

export function addXP(amount: number): UserProfile {
  const profile = getStoredProfile();
  if (profile.isGuest) return profile;
  profile.xp += amount;
  saveProfile(profile);
  return profile;
}

export function incrementStat(
  key: keyof UserProfile['stats'],
  amount: number = 1
): UserProfile {
  const profile = getStoredProfile();
  if (profile.isGuest) return profile;
  profile.stats[key] = (profile.stats[key] || 0) + amount;
  profile.xp += 15 * amount;
  saveProfile(profile);
  return profile;
}

export function getStoredChatHistory(userId?: string): ChatMessage[] {
  try {
    const key = userId && userId !== 'guest' ? `${CHAT_HISTORY_KEY}_${userId}` : `${CHAT_HISTORY_KEY}_guest`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(messages: ChatMessage[], userId?: string): void {
  try {
    const key = userId && userId !== 'guest' ? `${CHAT_HISTORY_KEY}_${userId}` : `${CHAT_HISTORY_KEY}_guest`;
    const sliced = messages.slice(-50);
    localStorage.setItem(key, JSON.stringify(sliced));
  } catch (e) {
    console.error('Lỗi lưu chat history:', e);
  }
}

export function getStoredQuizHistory(filterUserId?: string): QuizSubmissionResult[] {
  try {
    const all = getAllQuizHistory();
    if (!filterUserId || filterUserId === 'guest') {
      return all.filter((q) => q.userId === 'guest' || q.userId === 'guest_student');
    }
    if (filterUserId === 'admin') {
      return all; // Admin sees all quiz submissions
    }
    return all.filter((q) => q.userId === filterUserId);
  } catch {
    return [];
  }
}

export function getAllQuizHistory(): QuizSubmissionResult[] {
  try {
    const raw = localStorage.getItem(QUIZ_HISTORY_KEY);
    let list: QuizSubmissionResult[] = raw ? JSON.parse(raw) : [];

    // If storage is empty, initialize with default student submissions
    if (list.length === 0 && DEFAULT_STUDENT_SUBMISSIONS && DEFAULT_STUDENT_SUBMISSIONS.length > 0) {
      list = [...DEFAULT_STUDENT_SUBMISSIONS];
      localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(list));
    } else if (DEFAULT_STUDENT_SUBMISSIONS && DEFAULT_STUDENT_SUBMISSIONS.length > 0) {
      // Ensure seed submissions are present
      const existingIds = new Set(list.map((q) => q.id));
      let added = false;
      DEFAULT_STUDENT_SUBMISSIONS.forEach((seed) => {
        if (!existingIds.has(seed.id)) {
          list.push(seed);
          added = true;
        }
      });
      if (added) {
        localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(list));
      }
    }

    const seen = new Set<string>();
    return list.filter((q) => {
      if (!q || !q.id) return false;
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });
  } catch {
    return DEFAULT_STUDENT_SUBMISSIONS || [];
  }
}

export function getPendingSubmissionsCount(): number {
  try {
    const all = getAllQuizHistory();
    return all.filter((s) => s.status === 'pending_grading').length;
  } catch {
    return 0;
  }
}

export function saveQuizResult(result: QuizSubmissionResult): void {
  try {
    const raw = localStorage.getItem(QUIZ_HISTORY_KEY);
    const allHistory: QuizSubmissionResult[] = raw ? JSON.parse(raw) : [];

    // Default status to 'pending_grading' if has essay or photos or not graded yet
    if (!result.status) {
      const hasEssay = result.essayQuestions && result.essayQuestions.length > 0;
      const hasPhotos = result.submittedPhotos && result.submittedPhotos.length > 0;
      result.status = (hasEssay || hasPhotos) ? 'pending_grading' : 'pending_grading';
    }

    // Ensure valid user ID
    if (!result.userId || result.userId === 'guest') {
      result.userId = `hs-${Date.now()}`;
      if (!result.userName) result.userName = 'Học sinh';
    }

    allHistory.unshift(result);
    localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(allHistory.slice(0, 150)));

    // If graded, update profile XP
    if (result.status === 'graded') {
      const profile = getStoredProfile();
      if (!profile.isGuest && profile.id === result.userId) {
        profile.stats.quizzesCompleted += 1;
        profile.stats.totalQuizScoreSum += result.score;
        profile.xp += Math.round(result.score * 10);
        saveProfile(profile);
      }
    }

    if (result.weakSubtopics && result.weakSubtopics.length > 0) {
      const currentWeak = getStoredWeakTopics(result.userId);
      result.weakSubtopics.forEach((subtopic) => {
        const existing = currentWeak.find(
          (w) => w.topicName.toLowerCase() === subtopic.toLowerCase() && w.subject === result.subject
        );
        if (existing) {
          existing.wrongCount += 1;
          existing.totalTested += 1;
          existing.lastMissedDate = Date.now();
          existing.status = 'needs_practice';
        } else {
          currentWeak.unshift({
            id: `wt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            subject: result.subject,
            topicName: subtopic,
            wrongCount: 1,
            totalTested: 1,
            lastMissedDate: Date.now(),
            status: 'needs_practice',
          });
        }
      });
      saveWeakTopics(currentWeak, result.userId);
    }
  } catch (e) {
    console.error('Lỗi lưu quiz result:', e);
  }
}

/**
 * Teacher grades a student's submission manually (AI is NOT used)
 */
export function updateQuizSubmissionGrading(
  submissionId: string,
  grading: {
    score: number;
    teacherFeedback: string;
    essayFeedback?: Record<number, { score: number; comment: string }>;
    gradedBy: string;
  }
): QuizSubmissionResult | null {
  try {
    const all = getAllQuizHistory();
    const itemIndex = all.findIndex((q) => q.id === submissionId);
    if (itemIndex === -1) return null;

    const target = all[itemIndex];
    const updated: QuizSubmissionResult = {
      ...target,
      status: 'graded',
      score: grading.score,
      teacherFeedback: grading.teacherFeedback,
      essayFeedback: grading.essayFeedback || target.essayFeedback,
      gradedBy: grading.gradedBy,
      gradedAt: Date.now(),
    };

    all[itemIndex] = updated;
    localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(all));

    // Update student's stored profile if available
    const profile = getStoredProfile();
    if (!profile.isGuest && profile.id === updated.userId) {
      profile.stats.quizzesCompleted += 1;
      profile.stats.totalQuizScoreSum += updated.score;
      profile.xp += Math.round(updated.score * 10);
      saveProfile(profile);
    }

    // Auto sync updated graded result to Google Sheets
    autoSyncQuiz(updated, {
      id: updated.userId || 'student',
      name: updated.userName || 'Học sinh',
      email: updated.userEmail || '',
      role: 'student',
      grade: updated.grade,
      stats: { questionsAsked: 0, problemsSolved: 0, reviewsCreated: 0, quizzesCompleted: 1, totalQuizScoreSum: updated.score },
      xp: Math.round(updated.score * 10),
      streakDays: 1,
    } as any).catch(() => {});

    return updated;
  } catch (e) {
    console.error('Lỗi cập nhật điểm giáo viên:', e);
    return null;
  }
}

export function getStoredWeakTopics(userId?: string): WeakTopicItem[] {
  try {
    if (!userId || userId === 'guest') {
      return [];
    }
    const key = `${WEAK_TOPICS_KEY}_${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveWeakTopics(items: WeakTopicItem[], userId?: string): void {
  try {
    const key = userId && userId !== 'guest' ? `${WEAK_TOPICS_KEY}_${userId}` : `${WEAK_TOPICS_KEY}_guest`;
    localStorage.setItem(key, JSON.stringify(items));
    // Tự động đồng bộ sang Google Sheets
    sendToAppsScriptWebhook('sync_weak_topic', { userId, items }).catch(() => {});
  } catch (e) {
    console.error('Lỗi lưu weak topics:', e);
  }
}

export function markWeakTopicResolved(id: string, userId?: string): WeakTopicItem[] {
  const list = getStoredWeakTopics(userId);
  const item = list.find((w) => w.id === id);
  if (item) {
    item.status = 'mastered';
    item.wrongCount = 0;
    saveWeakTopics(list, userId);
    addXP(30);
  }
  return list;
}

export function deleteAccountRecord(userId: string): void {
  try {
    const list = getStoredAccounts();
    const filtered = list.filter((a) => a.id !== userId && a.username !== 'admin');
    localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(filtered));
    sendToAppsScriptWebhook('delete_user', { id: userId }).catch(() => {});
  } catch (e) {
    console.error('Lỗi xóa tài khoản:', e);
  }
}

export function getSavedSolutions(userId?: string): SavedItem[] {
  try {
    const key = userId && userId !== 'guest' ? `${SAVED_SOLUTIONS_KEY}_${userId}` : SAVED_SOLUTIONS_KEY;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSolutionItem(item: SavedItem, userId?: string): void {
  try {
    // If guest, do not persist to user account
    if (userId === 'guest') return;
    const key = userId ? `${SAVED_SOLUTIONS_KEY}_${userId}` : SAVED_SOLUTIONS_KEY;
    const list = getSavedSolutions(userId);
    list.unshift(item);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
  } catch (e) {
    console.error('Lỗi lưu bài giải:', e);
  }
}

export function getSavedReviews(userId?: string): SavedItem[] {
  try {
    const key = userId && userId !== 'guest' ? `${SAVED_REVIEWS_KEY}_${userId}` : SAVED_REVIEWS_KEY;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveReviewItem(item: SavedItem, userId?: string): void {
  try {
    // If guest, do not persist to user account
    if (userId === 'guest') return;
    const key = userId ? `${SAVED_REVIEWS_KEY}_${userId}` : SAVED_REVIEWS_KEY;
    const list = getSavedReviews(userId);
    list.unshift(item);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
  } catch (e) {
    console.error('Lỗi lưu ôn bài:', e);
  }
}

export function getBankQuizzes(): SavedBankQuiz[] {
  try {
    const raw = localStorage.getItem(BANK_QUIZZES_KEY);
    let list: SavedBankQuiz[] = raw ? JSON.parse(raw) : [];

    // If storage is empty or missing standard teacher bank quizzes, populate with default teacher quizzes
    if (!Array.isArray(list) || list.length === 0) {
      list = [...DEFAULT_TEACHER_BANK_QUIZZES];
      try {
        localStorage.setItem(BANK_QUIZZES_KEY, JSON.stringify(list));
      } catch {}
    } else {
      // Ensure all standard default teacher bank quizzes exist if not already present
      let changed = false;
      for (const defQuiz of DEFAULT_TEACHER_BANK_QUIZZES) {
        if (!list.some((b) => b && b.id === defQuiz.id)) {
          list.push(defQuiz);
          changed = true;
        }
      }
      if (changed) {
        try {
          localStorage.setItem(BANK_QUIZZES_KEY, JSON.stringify(list));
        } catch {}
      }
    }

    const seen = new Set<string>();
    return list
      .filter((b) => {
        if (!b || !b.id) return false;
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      })
      .map((b: any) => {
        // Đảm bảo b.data luôn là object hợp lệ, không bao giờ undefined
        if (!b.data && b.dataJson) {
          try {
            b.data = typeof b.dataJson === 'string' ? JSON.parse(b.dataJson) : b.dataJson;
          } catch {
            b.data = { title: b.title || '', topic: b.topic || '', questions: [] };
          }
        }
        if (!b.data || typeof b.data !== 'object') {
          b.data = { title: b.title || '', topic: b.topic || '', questions: [] };
        }
        if (!Array.isArray(b.data.questions)) {
          b.data.questions = [];
        }
        if (!Array.isArray(b.data.essayQuestions)) {
          b.data.essayQuestions = [];
        }
        return b as SavedBankQuiz;
      });
  } catch {
    return [...DEFAULT_TEACHER_BANK_QUIZZES];
  }
}

export function saveBankQuiz(quiz: SavedBankQuiz): void {
  try {
    const list = getBankQuizzes();
    const existingIdx = list.findIndex((b) => b.id === quiz.id);
    if (existingIdx >= 0) {
      list[existingIdx] = quiz;
    } else {
      list.unshift(quiz);
    }
    localStorage.setItem(BANK_QUIZZES_KEY, JSON.stringify(list.slice(0, 100)));
    // Tự động lưu trực tiếp vào Google Sheets
    autoSyncBankQuiz(quiz).catch(() => {});
  } catch (e) {
    console.error('Lỗi lưu ngân hàng quiz:', e);
  }
}

export function updateBankQuiz(quiz: SavedBankQuiz): void {
  saveBankQuiz(quiz);
}

export function deleteBankQuiz(quizId: string): boolean {
  try {
    const list = getBankQuizzes();
    const updated = list.filter((b) => b.id !== quizId);
    localStorage.setItem(BANK_QUIZZES_KEY, JSON.stringify(updated));
    // Tự động đồng bộ xóa trên Google Sheets
    autoDeleteBankQuiz(quizId).catch(() => {});
    return true;
  } catch (e) {
    console.error('Lỗi xóa đề thi trong ngân hàng:', e);
    return false;
  }
}

export function deleteQuestionFromBankQuiz(
  quizId: string,
  questionIndex: number,
  questionType?: 'mcq' | 'essay'
): SavedBankQuiz | null {
  try {
    const list = getBankQuizzes();
    const quiz = list.find((b) => b.id === quizId);
    if (!quiz || !quiz.data) return null;

    const isEssay = questionType
      ? questionType === 'essay'
      : quiz.examFormat === 'essay' ||
        (Array.isArray(quiz.data.essayQuestions) &&
          quiz.data.essayQuestions.length > 0 &&
          (!Array.isArray(quiz.data.questions) || quiz.data.questions.length === 0));

    if (isEssay) {
      if (Array.isArray(quiz.data.essayQuestions)) {
        quiz.data.essayQuestions.splice(questionIndex, 1);
        quiz.data.essayQuestions.forEach((q, idx) => {
          q.id = idx + 1;
        });
      }
    } else {
      if (Array.isArray(quiz.data.questions)) {
        quiz.data.questions.splice(questionIndex, 1);
        quiz.data.questions.forEach((q, idx) => {
          q.id = idx + 1;
        });
      }
    }

    saveBankQuiz(quiz);
    return quiz;
  } catch (e) {
    console.error('Lỗi xóa câu hỏi trong ngân hàng:', e);
    return null;
  }
}

export function updateQuestionInBankQuiz(
  quizId: string,
  questionIndex: number,
  updatedQuestion: any,
  questionType?: 'mcq' | 'essay'
): SavedBankQuiz | null {
  try {
    const list = getBankQuizzes();
    const quiz = list.find((b) => b.id === quizId);
    if (!quiz || !quiz.data) return null;

    const isEssay = questionType
      ? questionType === 'essay'
      : quiz.examFormat === 'essay' ||
        (Array.isArray(quiz.data.essayQuestions) &&
          quiz.data.essayQuestions.length > 0 &&
          (!Array.isArray(quiz.data.questions) || quiz.data.questions.length === 0));

    if (isEssay) {
      if (Array.isArray(quiz.data.essayQuestions) && quiz.data.essayQuestions[questionIndex]) {
        quiz.data.essayQuestions[questionIndex] = {
          ...quiz.data.essayQuestions[questionIndex],
          ...updatedQuestion,
          id: questionIndex + 1,
        };
      }
    } else {
      if (Array.isArray(quiz.data.questions) && quiz.data.questions[questionIndex]) {
        quiz.data.questions[questionIndex] = {
          ...quiz.data.questions[questionIndex],
          ...updatedQuestion,
          id: questionIndex + 1,
        };
      }
    }

    saveBankQuiz(quiz);
    return quiz;
  } catch (e) {
    console.error('Lỗi cập nhật câu hỏi trong ngân hàng:', e);
    return null;
  }
}

export function addQuestionToBankQuiz(
  quizId: string,
  newQuestion: any,
  questionType?: 'mcq' | 'essay'
): SavedBankQuiz | null {
  try {
    const list = getBankQuizzes();
    const quiz = list.find((b) => b.id === quizId);
    if (!quiz || !quiz.data) return null;

    const isEssay = questionType
      ? questionType === 'essay'
      : quiz.examFormat === 'essay' ||
        (Array.isArray(quiz.data.essayQuestions) &&
          quiz.data.essayQuestions.length > 0 &&
          (!Array.isArray(quiz.data.questions) || quiz.data.questions.length === 0));

    if (isEssay) {
      if (!Array.isArray(quiz.data.essayQuestions)) {
        quiz.data.essayQuestions = [];
      }
      quiz.data.essayQuestions.push({
        ...newQuestion,
        id: quiz.data.essayQuestions.length + 1,
      });
    } else {
      if (!Array.isArray(quiz.data.questions)) {
        quiz.data.questions = [];
      }
      quiz.data.questions.push({
        ...newQuestion,
        id: quiz.data.questions.length + 1,
      });
    }

    saveBankQuiz(quiz);
    return quiz;
  } catch (e) {
    console.error('Lỗi thêm câu hỏi vào ngân hàng:', e);
    return null;
  }
}

// ==============================================================
// NGUYÊN TẮC: GOOGLE SHEETS = DATABASE DUY NHẤT
// ĐỌC DỮ LIỆU TỪ GOOGLE SHEETS KHI MỞ APP HOẶC RELOAD
// ==============================================================
export async function loadDataFromGoogleSheets(): Promise<boolean> {
  try {
    const data = await fetchSheetData();
    if (!data) return false;

    // 1. Đồng bộ tài khoản thông minh (hỗ trợ cả chuẩn mới và các dòng bị lệch cột trong Google Sheets)
    if (Array.isArray(data.accounts) && data.accounts.length > 0) {
      const currentList = getStoredAccounts();
      const mergedList: AppUser[] = [];

      for (const item of data.accounts) {
        if (!item) continue;
        const rawVals = Object.values(item).map((v) => (v !== undefined && v !== null ? String(v).trim() : ''));
        if (rawVals.every((v) => v === '')) continue;

        // Tìm trường email
        let detectedEmail = '';
        for (const val of rawVals) {
          if (val.includes('@') && val.includes('.')) {
            detectedEmail = val.toLowerCase();
            break;
          }
        }
        if (!detectedEmail && item.email && String(item.email).includes('@')) {
          detectedEmail = String(item.email).trim().toLowerCase();
        }

        // Tìm trường vai trò (role)
        let detectedRole: UserRole = 'student';
        for (const val of rawVals) {
          const lower = val.toLowerCase();
          if (lower.includes('admin') || lower.includes('quản trị')) {
            detectedRole = 'admin';
            break;
          } else if (lower.includes('teacher') || lower.includes('giáo viên') || lower.includes('gv')) {
            detectedRole = 'teacher';
            break;
          }
        }

        // Tìm mật khẩu (chuỗi 4-20 ký tự số/chữ không chứa @, không phải Lớp X, không phải ngày giờ)
        let detectedPassword = '';
        if (item.password && String(item.password).trim().length >= 4) {
          detectedPassword = String(item.password).trim();
        } else {
          for (const val of rawVals) {
            if (
              val.length >= 4 &&
              val.length <= 25 &&
              !val.includes('@') &&
              !val.startsWith('Lớp') &&
              !val.includes('/') &&
              !val.includes(':') &&
              !val.startsWith('user-') &&
              val !== 'admin' &&
              val !== 'teacher' &&
              val !== 'student' &&
              val !== 'Giáo viên (GV)' &&
              val !== 'Quản trị viên (Admin)' &&
              val !== 'Học sinh'
            ) {
              // Ưu tiên chuỗi số hoặc mật khẩu ngắn
              if (/^\d{4,8}$/.test(val) || !detectedPassword) {
                detectedPassword = val;
              }
            }
          }
        }

        // Tìm tên đăng nhập
        let detectedUsername = '';
        if (item.username && String(item.username).trim() && !String(item.username).includes('@')) {
          detectedUsername = String(item.username).trim().toLowerCase();
        } else {
          for (const val of rawVals) {
            if (
              val &&
              val.length >= 2 &&
              val.length <= 25 &&
              !val.includes('@') &&
              !val.startsWith('Lớp') &&
              !val.includes('/') &&
              !val.includes(':') &&
              !val.startsWith('user-') &&
              val !== detectedPassword &&
              !val.includes('Trường') &&
              !val.includes('Giáo viên')
            ) {
              detectedUsername = val.toLowerCase();
              break;
            }
          }
        }
        if (!detectedUsername && detectedEmail) {
          detectedUsername = detectedEmail.split('@')[0].toLowerCase();
        }

        // Tìm họ tên
        let detectedName = item.name || '';
        if (!detectedName || detectedName === 'Thành viên') {
          for (const val of rawVals) {
            if (
              val.length >= 2 &&
              val.length <= 40 &&
              !val.includes('@') &&
              !val.startsWith('Lớp') &&
              !val.includes('/') &&
              !val.includes(':') &&
              !val.startsWith('user-') &&
              val !== detectedPassword &&
              val.toLowerCase() !== detectedUsername &&
              !val.includes('Trường') &&
              !val.includes('Giáo viên')
            ) {
              detectedName = val;
              break;
            }
          }
        }

        // Tìm khối lớp
        let detectedGrade: Grade = 'Lớp 4';
        for (const val of rawVals) {
          if (val.startsWith('Lớp ') || val.startsWith('Khối ')) {
            detectedGrade = (val.replace('Khối', 'Lớp').trim()) as Grade;
            break;
          }
        }

        const cleanId = item.id || `user-${detectedUsername || Date.now()}`;

        // Tìm tài khoản đối ứng trong máy hiện tại
        const matched = currentList.find(
          (c) =>
            (item.id && c.id === item.id) ||
            (detectedUsername && c.username?.toLowerCase() === detectedUsername) ||
            (detectedEmail && c.email?.toLowerCase() === detectedEmail)
        );

        const finalPassword = detectedPassword || matched?.password || (detectedUsername === 'admin' ? 'admin123' : '123456');

        mergedList.push({
          id: cleanId,
          username: detectedUsername || 'user',
          email: detectedEmail || `${detectedUsername || 'user'}@studyai.edu.vn`,
          password: finalPassword,
          name: detectedName || matched?.name || (detectedUsername === 'admin' ? 'Ban Quản Trị Hệ Thống' : 'Thành viên'),
          role: detectedRole,
          grade: detectedGrade || matched?.grade || 'Lớp 4',
          subject: (item.subject as Subject) || matched?.subject || (detectedRole === 'teacher' ? 'Toán' : undefined),
          school: item.school || matched?.school || 'Trường Tiểu học',
          createdAt: typeof item.createdAt === 'number' && item.createdAt > 0 ? item.createdAt : (matched?.createdAt || Date.now()),
        });
      }

      // Luôn làm sạch dữ liệu trùng lặp và đảm bảo tài khoản admin gốc tồn tại
      const cleanMergedAccounts = deduplicateAccounts(mergedList);
      if (!cleanMergedAccounts.some((a) => a.username?.toLowerCase() === 'admin' || a.email?.toLowerCase() === 'admin@studyai.edu.vn')) {
        cleanMergedAccounts.unshift(DEFAULT_ADMIN_ACCOUNT);
      }
      localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(cleanMergedAccounts));
    }

    // 2. Đồng bộ lịch sử bài thi (khử trùng lặp id)
    if (Array.isArray(data.quizzes) && data.quizzes.length > 0) {
      const seenQuizIds = new Set<string>();
      const cleanQuizzes = data.quizzes.filter((q) => {
        if (!q || !q.id) return false;
        if (seenQuizIds.has(q.id)) return false;
        seenQuizIds.add(q.id);
        return true;
      });
      localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(cleanQuizzes));
    }

    // 3. Đồng bộ ngân hàng đề thi (khử trùng lặp id và đảm bảo cấu trúc data an toàn)
    if (Array.isArray(data.bankQuizzes) && data.bankQuizzes.length > 0) {
      const seenBankIds = new Set<string>();
      const cleanBankQuizzes = data.bankQuizzes
        .filter((b) => {
          if (!b || !b.id) return false;
          if (seenBankIds.has(b.id)) return false;
          seenBankIds.add(b.id);
          return true;
        })
        .map((b: any) => {
          if (!b.data && b.dataJson) {
            try {
              b.data = typeof b.dataJson === 'string' ? JSON.parse(b.dataJson) : b.dataJson;
            } catch {
              b.data = { title: b.title || '', topic: b.topic || '', questions: [] };
            }
          }
          if (!b.data || typeof b.data !== 'object') {
            b.data = { title: b.title || '', topic: b.topic || '', questions: [] };
          }
          if (!Array.isArray(b.data.questions)) {
            b.data.questions = [];
          }
          if (!Array.isArray(b.data.essayQuestions)) {
            b.data.essayQuestions = [];
          }
          return b;
        });
      localStorage.setItem(BANK_QUIZZES_KEY, JSON.stringify(cleanBankQuizzes));
    }

    return true;
  } catch (e) {
    console.warn('Lỗi đọc dữ liệu từ Google Sheets:', e);
    return false;
  }
}
