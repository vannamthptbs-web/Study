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
  updateSheetPassword,
  sendToAppsScriptWebhook,
  fetchSheetData,
} from './firebaseWorkspace';

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

    // Ensure default admin account exists
    const adminIndex = deduped.findIndex(
      (a) => a.username?.toLowerCase() === 'admin' || a.email?.toLowerCase() === 'admin@studyai.edu.vn'
    );
    if (adminIndex === -1) {
      deduped.unshift(DEFAULT_ADMIN_ACCOUNT);
    }

    // If cleaned list is different from raw list length or raw was empty, persist cleaned version
    if (deduped.length !== list.length || !raw) {
      localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(deduped));
    }
    return deduped;
  } catch {
    return [DEFAULT_ADMIN_ACCOUNT];
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
  const found = accounts.find(
    (a) =>
      a.username?.toLowerCase() === cleanId ||
      a.email?.toLowerCase() === cleanId
  );

  if (!found) {
    return { success: false, error: 'Tài khoản không tồn tại trên hệ thống.' };
  }

  // Check password
  const expectedPassword = found.password || (found.username === 'admin' ? 'admin123' : '');
  if (expectedPassword && cleanPw !== expectedPassword) {
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
    const raw = localStorage.getItem(QUIZ_HISTORY_KEY);
    const list: QuizSubmissionResult[] = raw ? JSON.parse(raw) : [];
    if (!filterUserId || filterUserId === 'guest') {
      return [];
    }
    if (filterUserId === 'admin') {
      return list; // Admin sees all quiz submissions
    }
    return list.filter((q) => q.userId === filterUserId);
  } catch {
    return [];
  }
}

export function getAllQuizHistory(): QuizSubmissionResult[] {
  try {
    const raw = localStorage.getItem(QUIZ_HISTORY_KEY);
    const list: QuizSubmissionResult[] = raw ? JSON.parse(raw) : [];
    const seen = new Set<string>();
    return list.filter((q) => {
      if (!q || !q.id) return false;
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });
  } catch {
    return [];
  }
}

export function saveQuizResult(result: QuizSubmissionResult): void {
  try {
    // Only save persistently if not a guest
    if (!result.userId || result.userId === 'guest') {
      return;
    }

    const raw = localStorage.getItem(QUIZ_HISTORY_KEY);
    const allHistory: QuizSubmissionResult[] = raw ? JSON.parse(raw) : [];
    allHistory.unshift(result);
    localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(allHistory.slice(0, 100)));

    const profile = getStoredProfile();
    if (!profile.isGuest && profile.id === result.userId) {
      profile.stats.quizzesCompleted += 1;
      profile.stats.totalQuizScoreSum += result.score;
      profile.xp += Math.round(result.score * 10);
      saveProfile(profile);
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
    const list: SavedBankQuiz[] = raw ? JSON.parse(raw) : [];
    const seen = new Set<string>();
    return list.filter((b) => {
      if (!b || !b.id) return false;
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  } catch {
    return [];
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
    localStorage.setItem(BANK_QUIZZES_KEY, JSON.stringify(list.slice(0, 30)));
    // Tự động lưu trực tiếp vào Google Sheets
    autoSyncBankQuiz(quiz).catch(() => {});
  } catch (e) {
    console.error('Lỗi lưu ngân hàng quiz:', e);
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

    // 1. Đồng bộ tài khoản
    if (Array.isArray(data.accounts) && data.accounts.length > 0) {
      const currentList = getStoredAccounts();
      const mergedList: AppUser[] = [];

      for (const item of data.accounts) {
        if (!item || (!item.id && !item.email && !item.username)) continue;
        
        const cleanEmail = (item.email || '').trim().toLowerCase();
        const cleanUsername = (item.username || (cleanEmail ? cleanEmail.split('@')[0] : '')).trim().toLowerCase();
        const cleanId = item.id || `user-${cleanUsername || Date.now()}`;

        // Tìm tài khoản đối ứng trong máy hiện tại
        const matched = currentList.find(
          (c) =>
            (item.id && c.id === item.id) ||
            (cleanUsername && c.username?.toLowerCase() === cleanUsername) ||
            (cleanEmail && c.email?.toLowerCase() === cleanEmail)
        );

        // Mật khẩu lấy từ Google Sheet (nếu có), fallback sang mật khẩu đã lưu ở máy
        const finalPassword = (item.password && String(item.password).trim().length > 0)
          ? String(item.password).trim()
          : (matched?.password || (cleanUsername === 'admin' ? 'admin123' : ''));

        // Chuẩn hóa vai trò
        let userRole: UserRole = 'student';
        const roleStr = String(item.role || '').toLowerCase();
        if (roleStr.includes('admin') || roleStr.includes('quản trị')) {
          userRole = 'admin';
        } else if (roleStr.includes('teacher') || roleStr.includes('giáo viên') || roleStr.includes('gv')) {
          userRole = 'teacher';
        }

        mergedList.push({
          id: cleanId,
          username: cleanUsername || 'user',
          email: cleanEmail,
          password: finalPassword,
          name: item.name || matched?.name || (cleanUsername === 'admin' ? 'Ban Quản Trị Hệ Thống' : 'Thành viên'),
          role: userRole,
          grade: (item.grade as Grade) || matched?.grade || 'Lớp 4',
          subject: (item.subject as Subject) || matched?.subject,
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

    // 3. Đồng bộ ngân hàng đề thi (khử trùng lặp id)
    if (Array.isArray(data.bankQuizzes) && data.bankQuizzes.length > 0) {
      const seenBankIds = new Set<string>();
      const cleanBankQuizzes = data.bankQuizzes.filter((b) => {
        if (!b || !b.id) return false;
        if (seenBankIds.has(b.id)) return false;
        seenBankIds.add(b.id);
        return true;
      });
      localStorage.setItem(BANK_QUIZZES_KEY, JSON.stringify(cleanBankQuizzes));
    }

    return true;
  } catch (e) {
    console.warn('Lỗi đọc dữ liệu từ Google Sheets:', e);
    return false;
  }
}
