import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUser, QuizSubmissionResult, UserProfile, UserRole } from '../types/study';

// Initialize Firebase App instance safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Provider with Google Sheets scope
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

// In-memory token cache (Do NOT store in localStorage per security guidelines)
export const DEFAULT_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbwSHX1Q0KVnrdab_vxKpdt_lEUZ89CrUeYsuB1_ZU0qNWtYPIVrAfw3Ng8w71vHl3IwqQ/exec';

let cachedAccessToken: string | null = null;
let cachedSpreadsheetId: string | null = null;
const SPREADSHEET_ID_KEY = 'study_ai_spreadsheet_id_v1';
const WEBHOOK_URL_KEY = 'study_ai_apps_script_webhook_url_v1';
const LAST_AUTOSYNC_TIME_KEY = 'study_ai_last_autosync_time_v1';

export const getAppsScriptWebhookUrl = (): string => {
  const saved = localStorage.getItem(WEBHOOK_URL_KEY);
  if (!saved || !saved.includes('script.google.com')) {
    return DEFAULT_SHEET_URL;
  }
  return saved;
};

export const setAppsScriptWebhookUrl = (url: string): void => {
  const clean = url.trim();
  localStorage.setItem(WEBHOOK_URL_KEY, clean);
  // Đồng bộ cấu hình URL Google Sheets tới server proxy
  fetch('/api/sheets/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: clean }),
  }).catch(() => {});
};

export const getLastAutoSyncTime = (): number => {
  const t = localStorage.getItem(LAST_AUTOSYNC_TIME_KEY);
  return t ? parseInt(t, 10) : 0;
};

export const recordAutoSyncTime = (): void => {
  localStorage.setItem(LAST_AUTOSYNC_TIME_KEY, Date.now().toString());
};

export const getCachedAccessToken = () => cachedAccessToken;

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

// Initialize Auth listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Google Sign-In with popup
export const signInWithGoogle = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không thể nhận access token từ Google.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    // Normal user cancellation - do not treat as an unhandled error
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      return null;
    }
    console.error('Lỗi đăng nhập Google:', error);
    throw error;
  }
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// ==========================================
// GOOGLE SHEETS INTEGRATION HELPERS
// ==========================================

// Find or create "StudyAI - Quản Lý Học Tập & Điểm Số" spreadsheet
export const getOrCreateSpreadsheet = async (token: string): Promise<string> => {
  // Check if we already have the ID in localStorage
  const savedId = localStorage.getItem(SPREADSHEET_ID_KEY);
  if (savedId) {
    cachedSpreadsheetId = savedId;
    return savedId;
  }

  // Create new Spreadsheet with 2 sheets: "TaiKhoan" and "LichSuQuiz"
  try {
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: 'StudyAI - Quản Lý Học Tập & Điểm Số',
        },
        sheets: [
          {
            properties: {
              title: 'TaiKhoan',
              gridProperties: { rowCount: 100, columnCount: 10 },
            },
          },
          {
            properties: {
              title: 'LichSuQuiz',
              gridProperties: { rowCount: 200, columnCount: 12 },
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || 'Không thể tạo Google Sheet');
    }

    const created = await createRes.json();
    const newId = created.spreadsheetId;
    localStorage.setItem(SPREADSHEET_ID_KEY, newId);
    cachedSpreadsheetId = newId;

    // Initialize headers for "TaiKhoan"
    await appendSheetRow(
      token,
      newId,
      'TaiKhoan!A1',
      [
        [
          'Mã ID',
          'Email',
          'Họ Và Tên',
          'Vai Trò (Học sinh / GV)',
          'Khối Lớp',
          'Môn Phụ Trách / Yêu Thích',
          'Trường Học',
          'Thời Gian Đăng Ký',
        ],
      ]
    );

    // Initialize headers for "LichSuQuiz"
    await appendSheetRow(
      token,
      newId,
      'LichSuQuiz!A1',
      [
        [
          'Mã Bài Thi',
          'Thời Gian',
          'Email Người Làm',
          'Họ Tên',
          'Vai Trò',
          'Môn Học',
          'Khối Lớp',
          'Chủ Đề Quiz',
          'Số Câu Đúng',
          'Tổng Số Câu',
          'Điểm Số (Thang 10)',
          'Lỗ Hổng Kiến Thức (Chủ đề sai)',
        ],
      ]
    );

    return newId;
  } catch (error) {
    console.error('Lỗi tạo Google Sheet:', error);
    throw error;
  }
};

// Append rows to a specific Google Sheet range
export const appendSheetRow = async (
  token: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Không thể ghi dữ liệu vào Google Sheets');
  }

  return await res.json();
};

export const getSpreadsheetUrl = (): string | null => {
  const id = cachedSpreadsheetId || localStorage.getItem(SPREADSHEET_ID_KEY);
  return id ? `https://docs.google.com/spreadsheets/d/${id}` : DEFAULT_SHEET_URL;
};

// Parse spreadsheet ID from a Google Sheet URL or direct ID
export const parseSpreadsheetId = (input: string): string => {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
};

// Set custom spreadsheet linked by Admin
export const setCustomSpreadsheetId = (input: string): string => {
  const parsedId = parseSpreadsheetId(input);
  if (!parsedId) {
    throw new Error('Đường link hoặc ID Google Sheet không hợp lệ.');
  }
  cachedSpreadsheetId = parsedId;
  localStorage.setItem(SPREADSHEET_ID_KEY, parsedId);
  return parsedId;
};

// Helper: Ensure a sheet/tab exists in the spreadsheet
export const ensureSheetTabExists = async (
  token: string,
  spreadsheetId: string,
  tabTitle: string
) => {
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!metaRes.ok) return;
    const meta = await metaRes.json();
    const sheetTitles = meta.sheets?.map((s: any) => s.properties?.title) || [];
    if (!sheetTitles.includes(tabTitle)) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: { title: tabTitle },
                },
              },
            ],
          }),
        }
      );
    }
  } catch (e) {
    console.warn(`Lỗi tạo tab ${tabTitle}:`, e);
  }
};

// Helper: Overwrite or update an entire sheet range
export const updateSheetRange = async (
  token: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Không thể cập nhật Google Sheets');
  }

  return await res.json();
};

// ==========================================
// ADMIN: SYNC ALL APP DATA TO GOOGLE SHEETS
// ==========================================
export const syncAllAppDataToGoogleSheets = async (
  tokenOverride?: string
): Promise<{
  success: boolean;
  spreadsheetId: string;
  sheetUrl: string;
  stats: {
    accountsCount: number;
    quizzesCount: number;
    bankCount: number;
    weakTopicsCount: number;
  };
}> => {
  const token = tokenOverride || cachedAccessToken;
  if (!token) {
    throw new Error(
      'Chưa kết nối tài khoản Google. Vui lòng bấm Đăng nhập Google để cấp quyền Google Sheets trước khi đồng bộ.'
    );
  }

  const spreadsheetId = await getOrCreateSpreadsheet(token);

  // Import stored data from storage
  const {
    getStoredAccounts,
    getStoredProfile,
    getStoredQuizHistory,
    getBankQuizzes,
    getStoredWeakTopics,
  } = await import('./storage');

  const accounts = getStoredAccounts();
  const currentProfile = getStoredProfile();
  const quizHistory = getStoredQuizHistory();
  const bankQuizzes = getBankQuizzes();
  const weakTopics = getStoredWeakTopics();

  // Make sure current profile is also included in accounts list
  if (!accounts.some((a) => a.id === currentProfile.id || a.email === currentProfile.email)) {
    accounts.unshift({
      id: currentProfile.id,
      username: currentProfile.username || (currentProfile.email ? currentProfile.email.split('@')[0] : 'user'),
      email: currentProfile.email,
      name: currentProfile.name,
      role: currentProfile.role,
      grade: currentProfile.grade,
      subject: currentProfile.favoriteSubject,
      school: currentProfile.school || 'Trường Tiểu học',
      createdAt: Date.now(),
    });
  }

  // Ensure all 5 tabs exist in Google Sheets
  await ensureSheetTabExists(token, spreadsheetId, 'TaiKhoan');
  await ensureSheetTabExists(token, spreadsheetId, 'LichSuQuiz');
  await ensureSheetTabExists(token, spreadsheetId, 'NganHangDeThi');
  await ensureSheetTabExists(token, spreadsheetId, 'LoHongKienThuc');
  await ensureSheetTabExists(token, spreadsheetId, 'TienDoHocTap');

  // 1. Sync Sheet TaiKhoan
  const taiKhoanRows: any[][] = [
    [
      'Mã ID',
      'Tên Đăng Nhập',
      'Email Tài Khoản',
      'Mật Khẩu',
      'Họ Và Tên',
      'Vai Trò',
      'Khối Lớp',
      'Môn Học Phụ Trách',
      'Trường Học',
      'Thời Gian Đăng Ký',
    ],
    ...accounts.map((acc) => [
      acc.id,
      acc.username || (acc.email ? acc.email.split('@')[0] : 'user'),
      acc.email,
      acc.password || (acc.username === 'admin' ? 'admin123' : ''),
      acc.name,
      acc.role === 'admin' ? 'Quản trị viên (Admin)' : acc.role === 'teacher' ? 'Giáo viên (GV)' : 'Học sinh',
      acc.grade || 'Lớp 4',
      acc.subject || '',
      acc.school || 'Trường Tiểu học',
      new Date(acc.createdAt).toLocaleString('vi-VN'),
    ]),
  ];
  await updateSheetRange(token, spreadsheetId, 'TaiKhoan!A1:J' + (taiKhoanRows.length + 10), taiKhoanRows);

  // 2. Sync Sheet LichSuQuiz
  const lichSuRows: any[][] = [
    [
      'Mã Bài Thi',
      'Thời Gian',
      'Email Học Sinh',
      'Họ Tên',
      'Vai Trò',
      'Môn Học',
      'Khối Lớp',
      'Chủ Đề Quiz',
      'Số Câu Đúng',
      'Tổng Số Câu',
      'Điểm Số (Thang 10)',
      'Lỗ Hổng Kiến Thức',
    ],
    ...quizHistory.map((q) => [
      q.id,
      new Date(q.timestamp).toLocaleString('vi-VN'),
      q.userEmail || currentProfile.email,
      q.userName || currentProfile.name,
      q.userRole || currentProfile.role,
      q.subject,
      q.grade,
      q.topic,
      q.correctCount,
      q.totalQuestions,
      q.score,
      q.weakSubtopics?.join(', ') || 'Không có',
    ]),
  ];
  await updateSheetRange(token, spreadsheetId, 'LichSuQuiz!A1:L' + (lichSuRows.length + 10), lichSuRows);

  // 3. Sync Sheet NganHangDeThi
  const bankRows: any[][] = [
    [
      'Mã Đề',
      'Tiêu Đề Đề Thi',
      'Chủ Đề',
      'Môn Học',
      'Khối Lớp',
      'Người Soạn',
      'Vai Trò',
      'Số Lượng Câu Hỏi',
      'Ngày Tạo',
    ],
    ...bankQuizzes.map((b) => [
      b.id,
      b.title,
      b.topic,
      b.subject,
      b.grade,
      b.creatorName,
      b.creatorRole === 'teacher' ? 'Giáo viên' : 'Học sinh',
      b.data?.questions?.length || 0,
      new Date(b.createdAt).toLocaleString('vi-VN'),
    ]),
  ];
  await updateSheetRange(token, spreadsheetId, 'NganHangDeThi!A1:I' + (bankRows.length + 10), bankRows);

  // 4. Sync Sheet LoHongKienThuc
  const weakRows: any[][] = [
    ['Mã Lỗ Hổng', 'Môn Học', 'Chuyên Đề Bị Sai', 'Số Lần Trả Lời Sai', 'Tổng Lần Kiểm Tra', 'Trạng Thái', 'Cập Nhật Lần Cuối'],
    ...weakTopics.map((w) => [
      w.id,
      w.subject,
      w.topicName,
      w.wrongCount,
      w.totalTested,
      w.status === 'mastered' ? 'Đã nắm vững' : w.status === 'reviewing' ? 'Đang ôn tập' : 'Cần luyện tập',
      new Date(w.lastMissedDate).toLocaleString('vi-VN'),
    ]),
  ];
  await updateSheetRange(token, spreadsheetId, 'LoHongKienThuc!A1:G' + (weakRows.length + 10), weakRows);

  // 5. Sync Sheet TienDoHocTap
  const progressRows: any[][] = [
    [
      'Tên Học Sinh/GV',
      'Email',
      'Khối Lớp',
      'Điểm XP Tích Lũy',
      'Chuỗi Ngày Học (Streak)',
      'Số Câu Hỏi Đã Hỏi',
      'Số Bài Tập Đã Giải',
      'Số Đề Cương Đã Ôn',
      'Số Đề Thi Đã Làm',
      'Điểm TB Trắc Nghiệm',
    ],
    [
      currentProfile.name,
      currentProfile.email,
      currentProfile.grade,
      currentProfile.xp,
      currentProfile.streakDays,
      currentProfile.stats.questionsAsked,
      currentProfile.stats.problemsSolved,
      currentProfile.stats.reviewsCreated,
      currentProfile.stats.quizzesCompleted,
      currentProfile.stats.quizzesCompleted > 0
        ? (currentProfile.stats.totalQuizScoreSum / currentProfile.stats.quizzesCompleted).toFixed(1)
        : '0.0',
    ],
  ];
  await updateSheetRange(token, spreadsheetId, 'TienDoHocTap!A1:J' + (progressRows.length + 10), progressRows);

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  return {
    success: true,
    spreadsheetId,
    sheetUrl,
    stats: {
      accountsCount: accounts.length,
      quizzesCount: quizHistory.length,
      bankCount: bankQuizzes.length,
      weakTopicsCount: weakTopics.length,
    },
  };
};

// ==========================================
// USER ACCOUNT SYNCHRONIZATION
// ==========================================

export const syncUserRegistration = async (
  user: AppUser,
  accessToken?: string | null
): Promise<{ firestoreSuccess: boolean; sheetsSuccess: boolean; sheetUrl?: string }> => {
  let firestoreSuccess = false;
  let sheetsSuccess = false;
  let sheetUrl: string | undefined = undefined;

  // 1. Save to Firestore `users` collection
  try {
    const userDocRef = doc(db, 'users', user.id);
    await setDoc(
      userDocRef,
      {
        ...user,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    firestoreSuccess = true;
  } catch (err) {
    console.warn('Lưu vào Firestore thất bại (dùng local fallback):', err);
  }

  // 2. Save to Google Sheets if access token available
  const token = accessToken || cachedAccessToken;
  if (token) {
    try {
      const sheetId = await getOrCreateSpreadsheet(token);
      await appendSheetRow(token, sheetId, 'TaiKhoan!A:J', [
        [
          user.id,
          user.username || (user.email ? user.email.split('@')[0] : 'user'),
          user.email,
          user.password || (user.username === 'admin' ? 'admin123' : ''),
          user.name,
          user.role === 'teacher' ? 'Giáo viên (GV)' : user.role === 'admin' ? 'Quản trị viên (Admin)' : 'Học sinh',
          user.grade || 'Lớp 4',
          user.subject || '',
          user.school || 'Trường Tiểu học',
          new Date(user.createdAt).toLocaleString('vi-VN'),
        ],
      ]);
      sheetsSuccess = true;
      sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
    } catch (sheetErr) {
      console.warn('Lưu vào Google Sheets thất bại:', sheetErr);
    }
  }

  return { firestoreSuccess, sheetsSuccess, sheetUrl };
};

// ==========================================
// QUIZ RESULT SYNCHRONIZATION
// ==========================================

export const syncQuizResult = async (
  result: QuizSubmissionResult,
  user: UserProfile,
  accessToken?: string | null
): Promise<{ firestoreSuccess: boolean; sheetsSuccess: boolean }> => {
  let firestoreSuccess = false;
  let sheetsSuccess = false;

  // 1. Save to Firestore `quiz_results` collection
  try {
    const quizDocRef = doc(db, 'quiz_results', result.id);
    await setDoc(quizDocRef, {
      ...result,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      savedAt: Date.now(),
    });
    firestoreSuccess = true;
  } catch (err) {
    console.warn('Lưu kết quả quiz vào Firestore thất bại:', err);
  }

  // 2. Save to Google Sheets if access token available
  const token = accessToken || cachedAccessToken;
  if (token) {
    try {
      const sheetId = await getOrCreateSpreadsheet(token);
      await appendSheetRow(token, sheetId, 'LichSuQuiz!A:L', [
        [
          result.id,
          new Date(result.timestamp).toLocaleString('vi-VN'),
          user.email || 'Học sinh ẩn danh',
          user.name,
          user.role === 'teacher' ? 'Giáo viên' : 'Học sinh',
          result.subject,
          result.grade,
          result.topic,
          result.correctCount,
          result.totalQuestions,
          result.score,
          result.weakSubtopics?.join(', ') || 'Không có',
        ],
      ]);
      sheetsSuccess = true;
    } catch (sheetErr) {
      console.warn('Ghi kết quả vào Google Sheets thất bại:', sheetErr);
    }
  }

  return { firestoreSuccess, sheetsSuccess };
};

// ==========================================
// AUTOMATIC REAL-TIME SYNC ENGINE
// ("thông tin trên app lưu tự động qua gg sheet chứ k cần nút chức năng đẩy qua")
// ==========================================

// Helper to post directly to Google Apps Script Webhook (or via backend proxy)
export async function sendToAppsScriptWebhook(action: string, payload: any): Promise<boolean> {
  const webhookUrl = getAppsScriptWebhookUrl();
  if (!webhookUrl) return false;

  // 1. Try server proxy first (avoids browser CORS & handles 302 redirects)
  try {
    const res = await fetch('/api/sheets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload, sheetUrl: webhookUrl }),
    });
    if (res.ok) {
      return true;
    }
  } catch (proxyErr) {
    // Fall back to direct browser fetch
  }

  // 2. Direct browser fetch with no-cors fallback
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'no-cors',
      body: JSON.stringify({ action, payload, timestamp: Date.now() }),
    });
    return true;
  } catch (e) {
    console.warn('Lỗi gửi dữ liệu tới Apps Script Webhook:', e);
    return false;
  }
}

// Fetch all data from Google Sheets (Database duy nhất)
export async function fetchSheetData(): Promise<{
  accounts?: AppUser[];
  quizzes?: QuizSubmissionResult[];
  bankQuizzes?: any[];
  weakTopics?: any[];
} | null> {
  const webhookUrl = getAppsScriptWebhookUrl();
  try {
    const res = await fetch('/api/sheets/read_all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetUrl: webhookUrl }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        return data.data;
      }
    }
  } catch (err) {
    console.warn('Lỗi đọc dữ liệu từ Google Sheets proxy:', err);
  }
  return null;
}

// Cập nhật mật khẩu trực tiếp vào Google Sheets theo ID duy nhất
export const updateSheetPassword = async (userId: string, newPassword: string): Promise<void> => {
  try {
    await sendToAppsScriptWebhook('update_password', {
      id: userId,
      userId,
      newPassword,
    });
  } catch (e) {
    console.warn('Lỗi cập nhật mật khẩu lên Google Sheet:', e);
  }
};

// 1. Tự động lưu tài khoản (HS, GV, Admin) khi tạo mới hoặc đổi mật khẩu
export const autoSyncUser = async (user: AppUser): Promise<void> => {
  try {
    recordAutoSyncTime();
    // Gửi qua webhook nếu có
    sendToAppsScriptWebhook('sync_user', user);

    // Đồng bộ Firestore
    try {
      const userDocRef = doc(db, 'users', user.id);
      await setDoc(userDocRef, { ...user, updatedAt: Date.now() }, { merge: true });
    } catch {}

    // Đồng bộ Google Sheets nếu có token
    const token = cachedAccessToken;
    if (token) {
      const sheetId = await getOrCreateSpreadsheet(token);
      await appendSheetRow(token, sheetId, 'TaiKhoan!A:J', [
        [
          user.id,
          user.username || (user.email ? user.email.split('@')[0] : 'user'),
          user.email,
          user.password || (user.username === 'admin' ? 'admin123' : ''),
          user.name,
          user.role === 'admin' ? 'Quản trị viên (Admin)' : user.role === 'teacher' ? 'Giáo viên (GV)' : 'Học sinh',
          user.grade || 'Lớp 4',
          user.subject || '',
          user.school || 'Trường Tiểu học',
          new Date(user.createdAt).toLocaleString('vi-VN'),
        ],
      ]);
    }
  } catch (e) {
    console.warn('Auto-sync user background error:', e);
  }
};

// 2. Tự động lưu kết quả bài làm trắc nghiệm của học sinh
export const autoSyncQuiz = async (
  result: QuizSubmissionResult,
  user: UserProfile
): Promise<void> => {
  if (user.isGuest || user.id === 'guest') return;
  try {
    recordAutoSyncTime();
    sendToAppsScriptWebhook('sync_quiz', { result, user });

    // Firestore
    try {
      const quizDocRef = doc(db, 'quiz_results', result.id);
      await setDoc(quizDocRef, {
        ...result,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        savedAt: Date.now(),
      });
    } catch {}

    // Google Sheets
    const token = cachedAccessToken;
    if (token) {
      const sheetId = await getOrCreateSpreadsheet(token);
      await appendSheetRow(token, sheetId, 'LichSuQuiz!A:L', [
        [
          result.id,
          new Date(result.timestamp).toLocaleString('vi-VN'),
          user.email || user.username || 'Học sinh',
          user.name,
          user.role === 'teacher' ? 'Giáo viên' : 'Học sinh',
          result.subject,
          result.grade,
          result.topic,
          result.correctCount,
          result.totalQuestions,
          result.score,
          result.weakSubtopics?.join(', ') || 'Không có',
        ],
      ]);

      // Tự động cập nhật dòng Tiến độ học tập của người này
      await appendSheetRow(token, sheetId, 'TienDoHocTap!A:J', [
        [
          user.name,
          user.email || user.username,
          user.grade,
          user.xp,
          user.streakDays,
          user.stats.questionsAsked,
          user.stats.problemsSolved,
          user.stats.reviewsCreated,
          user.stats.quizzesCompleted,
          user.stats.quizzesCompleted > 0
            ? (user.stats.totalQuizScoreSum / user.stats.quizzesCompleted).toFixed(1)
            : result.score.toFixed(1),
        ],
      ]);
    }
  } catch (e) {
    console.warn('Auto-sync quiz background error:', e);
  }
};

// 3. Tự động lưu tiến độ học tập (XP, câu hỏi, bài giải)
export const autoSyncProgress = async (user: UserProfile): Promise<void> => {
  if (user.isGuest || user.id === 'guest') return;
  try {
    recordAutoSyncTime();
    sendToAppsScriptWebhook('sync_progress', user);

    const token = cachedAccessToken;
    if (token) {
      const sheetId = await getOrCreateSpreadsheet(token);
      await appendSheetRow(token, sheetId, 'TienDoHocTap!A:J', [
        [
          user.name,
          user.email || user.username,
          user.grade,
          user.xp,
          user.streakDays,
          user.stats.questionsAsked,
          user.stats.problemsSolved,
          user.stats.reviewsCreated,
          user.stats.quizzesCompleted,
          user.stats.quizzesCompleted > 0
            ? (user.stats.totalQuizScoreSum / user.stats.quizzesCompleted).toFixed(1)
            : '0.0',
        ],
      ]);
    }
  } catch (e) {
    console.warn('Auto-sync progress background error:', e);
  }
};

// 4. Tự động lưu đề thi do Giáo viên / Học sinh biên soạn vào ngân hàng
export const autoSyncBankQuiz = async (quiz: any): Promise<void> => {
  try {
    recordAutoSyncTime();
    sendToAppsScriptWebhook('sync_bank', quiz);

    const token = cachedAccessToken;
    if (token) {
      const sheetId = await getOrCreateSpreadsheet(token);
      await appendSheetRow(token, sheetId, 'NganHangDeThi!A:I', [
        [
          quiz.id,
          quiz.title,
          quiz.topic,
          quiz.subject,
          quiz.grade,
          quiz.creatorName,
          quiz.creatorRole === 'teacher' ? 'Giáo viên' : 'Học sinh',
          quiz.data?.questions?.length || quiz.data?.essayQuestions?.length || 0,
          new Date(quiz.createdAt).toLocaleString('vi-VN'),
        ],
      ]);
    }
  } catch (e) {
    console.warn('Auto-sync bank quiz error:', e);
  }
};

// Sample Google Apps Script Code template for Admin (Hỗ trợ Đọc -> Ghi -> Sửa theo ID duy nhất)
export const SAMPLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * STUDYAI - MÃ NGUỒN GOOGLE APPS SCRIPT CHUẨN (HỆ THỐNG CƠ SỞ DỮ LIỆU ĐẦY ĐỦ)
 * Dành riêng cho Ban Quản Trị Hệ Thống (Admin)
 * 
 * ✨ ĐẶC ĐIỂM BẢNG TÍNH GOOGLE SHEETS:
 * 1. Bảng biểu đẹp mắt, tiêu đề Tiếng Việt rõ ràng, màu sắc chuyên nghiệp.
 * 2. Tự động khởi tạo đầy đủ 5 trang tính (Tabs):
 *    - TaiKhoan (Quản lý tài khoản, mật khẩu, họ tên, vai trò, trường, khối lớp, môn)
 *    - LichSuQuiz (Lưu chi tiết điểm số, số câu đúng/sai, lỗ hổng kiến thức)
 *    - TienDoHocTap (Lưu XP, chuỗi ngày Streak, số câu hỏi/bài giải đã học)
 *    - NganHangDeThi (Lưu đề thi trắc nghiệm do Thầy/Cô và Học sinh biên soạn)
 *    - LoHongKienThuc (Theo dõi các chuyên đề học sinh hay trả lời sai)
 * 3. Tự động đóng băng hàng tiêu đề (Freeze Header), căn chỉnh độ rộng cột và định dạng.
 * 4. Cho phép Đọc (Read), Ghi mới (Create), Cập nhật (Update) mật khẩu/thông tin theo Mã ID duy nhất.
 * 
 * 🛠️ CÁCH TRIỂN KHAI (CHỈ 1 PHÚT):
 * 1. Mở file Google Sheet của bạn -> Chọn Tiện ích mở rộng (Extensions) -> Apps Script.
 * 2. Xóa hết mã cũ trong file Code.gs, dán toàn bộ mã này vào.
 * 3. Nhấn nút Lưu (biểu tượng đĩa mềm 💾).
 * 4. Nhấn "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment).
 *    - Loại: "Ứng dụng web" (Web app).
 *    - Mô tả: StudyAI Database Pro v3.
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me).
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone).
 * 5. Bấm Triển khai, đăng nhập cấp quyền Google, sao chép URL kết thúc bằng "/exec".
 * 6. Dán URL này vào mục "Vị Trí Lưu Link Google Sheet" trong Quản trị của StudyAI!
 * =========================================================================
 */

function doGet(e) {
  return handleRequest(e ? e.parameter : {});
}

function doPost(e) {
  var data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch(err) {
    data = e ? e.parameter : {};
  }
  return handleRequest(data);
}

function handleRequest(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = (data && data.action) ? data.action : "ping";
  var payload = (data && data.payload) ? data.payload : {};

  try {
    // 1. TỰ ĐỘNG KHỞI TẠO HOẶC ĐỊNH DẠNG CẢ 5 BẢNG ĐẦY ĐỦ TIÊU ĐỀ TIẾNG VIỆT
    initAllSheets(ss);

    // 2. ĐỌC TOÀN BỘ DỮ LIỆU TỪ GOOGLE SHEETS
    if (action === "read_all" || action === "get_all") {
      var result = {
        accounts: readSheetAsJson(ss, "TaiKhoan", ["id", "username", "email", "password", "name", "role", "grade", "subject", "school", "createdAt"]),
        quizzes: readSheetAsJson(ss, "LichSuQuiz", ["id", "timestamp", "userEmail", "userName", "userRole", "subject", "grade", "topic", "correctCount", "totalQuestions", "score", "weakSubtopics"]),
        bankQuizzes: readSheetAsJson(ss, "NganHangDeThi", ["id", "title", "topic", "subject", "grade", "creatorName", "creatorRole", "createdAt", "dataJson"]),
        weakTopics: readSheetAsJson(ss, "LoHongKienThuc", ["id", "userId", "subject", "topicName", "wrongCount", "totalTested", "status", "lastMissedDate"])
      };
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. THÊM / CẬP NHẬT TÀI KHOẢN THEO ID HOẶC EMAIL (Không bao giờ ghi đè sai dòng)
    if (action === "sync_user" || action === "upsert_user") {
      var sheet = getOrCreateFormattedSheet(ss, "TaiKhoan", [
        "Mã ID", "Tên Đăng Nhập", "Email Tài Khoản", "Mật Khẩu", "Họ Và Tên",
        "Vai Trò", "Khối Lớp", "Môn Học Phụ Trách", "Trường Học", "Thời Gian Đăng Ký"
      ], "#1e3a8a");

      var identifier = payload.id || payload.username || payload.email;
      var rowIdx = findRowIndexByIdOrEmail(sheet, identifier);

      var roleLabel = payload.role === "admin" ? "Quản trị viên (Admin)" : (payload.role === "teacher" ? "Giáo viên (GV)" : "Học sinh");
      var rowData = [
        payload.id || ("user-" + new Date().getTime()),
        payload.username || (payload.email ? payload.email.split("@")[0] : "user"),
        payload.email || "",
        payload.password || "",
        payload.name || "",
        roleLabel,
        payload.grade || "Lớp 4",
        payload.subject || "",
        payload.school || "Trường Tiểu học",
        payload.createdAt ? new Date(payload.createdAt).toLocaleString("vi-VN") : new Date().toLocaleString("vi-VN")
      ];

      if (rowIdx > 0) {
        // Nếu bản ghi cũ đã có mật khẩu mà bản ghi mới để trống, giữ lại mật khẩu cũ
        if (!rowData[3]) {
          var oldPw = sheet.getRange(rowIdx, 4).getValue();
          if (oldPw) rowData[3] = oldPw;
        }
        sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
        var lastRow = sheet.getLastRow();
        styleDataRow(sheet, lastRow, rowData.length);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. ĐỔI MẬT KHẨU THEO MÃ ID HOẶC EMAIL DUY NHẤT
    if (action === "update_password") {
      var sheet = ss.getSheetByName("TaiKhoan");
      if (sheet) {
        var idToFind = payload.id || payload.userId || payload.email || payload.username;
        var rowIdx = findRowIndexByIdOrEmail(sheet, idToFind);
        if (rowIdx > 0 && payload.newPassword) {
          sheet.getRange(rowIdx, 4).setValue(payload.newPassword);
          return ContentService.createTextOutput(JSON.stringify({ status: "success", updatedRow: rowIdx })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 5. XÓA TÀI KHOẢN THEO ID DUY NHẤT
    if (action === "delete_user") {
      var sheet = ss.getSheetByName("TaiKhoan");
      if (sheet) {
        var rowIdx = findRowIndexByIdOrEmail(sheet, payload.id || payload.userId || payload.email);
        if (rowIdx > 0) {
          sheet.deleteRow(rowIdx);
          return ContentService.createTextOutput(JSON.stringify({ status: "success", deletedRow: rowIdx })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 6. LƯU BÀI LÀM TRẮC NGHIỆM
    if (action === "sync_quiz") {
      var sheet = getOrCreateFormattedSheet(ss, "LichSuQuiz", [
        "Mã Bài Thi", "Thời Gian Nộp", "Email Học Sinh", "Họ Tên", "Vai Trò",
        "Môn Học", "Khối Lớp", "Chủ Đề Quiz", "Số Câu Đúng", "Tổng Số Câu", "Điểm Số (/10)", "Lỗ Hổng Kiến Thức"
      ], "#065f46");

      var r = payload.result || {};
      var u = payload.user || {};
      var rowData = [
        r.id || ("quiz-" + new Date().getTime()),
        new Date(r.timestamp || Date.now()).toLocaleString("vi-VN"),
        u.email || u.username || "",
        u.name || "Học sinh",
        u.role === "teacher" ? "Giáo viên" : (u.role === "admin" ? "Admin" : "Học sinh"),
        r.subject || "",
        r.grade || "",
        r.topic || "",
        r.correctCount || 0,
        r.totalQuestions || 0,
        r.score !== undefined ? Number(r.score).toFixed(1) : "0.0",
        (r.weakSubtopics && r.weakSubtopics.length > 0) ? r.weakSubtopics.join(", ") : "Đạt chuẩn (Không có)"
      ];
      sheet.appendRow(rowData);
      styleDataRow(sheet, sheet.getLastRow(), rowData.length);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 7. LƯU TIẾN ĐỘ HỌC TẬP (CẬP NHẬT THEO EMAIL/USER)
    if (action === "sync_progress") {
      var sheet = getOrCreateFormattedSheet(ss, "TienDoHocTap", [
        "Email / Username", "Họ Và Tên", "Khối Lớp", "Điểm Tích Lũy (XP)", "Chuỗi Học (Streak)",
        "Số Câu Đã Hỏi", "Số Bài Đã Giải", "Số Đề Ôn Tập", "Số Đề Đã Thi", "Điểm Trung Bình"
      ], "#4c1d95");

      var rowIdx = findRowIndexByIdOrEmail(sheet, payload.email || payload.id || payload.username);
      var rowData = [
        payload.email || payload.username || payload.id || "",
        payload.name || "",
        payload.grade || "Lớp 4",
        payload.xp || 0,
        payload.streakDays || 1,
        payload.stats ? (payload.stats.questionsAsked || 0) : 0,
        payload.stats ? (payload.stats.problemsSolved || 0) : 0,
        payload.stats ? (payload.stats.reviewsCreated || 0) : 0,
        payload.stats ? (payload.stats.quizzesCompleted || 0) : 0,
        payload.stats && payload.stats.quizzesCompleted > 0 ? (payload.stats.totalQuizScoreSum / payload.stats.quizzesCompleted).toFixed(1) : "0.0"
      ];
      if (rowIdx > 0) {
        sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
        styleDataRow(sheet, sheet.getLastRow(), rowData.length);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 8. LƯU ĐỀ THI VÀO NGÂN HÀNG
    if (action === "sync_bank") {
      var sheet = getOrCreateFormattedSheet(ss, "NganHangDeThi", [
        "Mã Đề Thi", "Tiêu Đề Đề Thi", "Chuyên Đề", "Môn Học", "Khối Lớp",
        "Người Soạn Đề", "Vai Trò", "Số Lượng Câu", "Ngày Tạo", "Dữ Liệu JSON"
      ], "#831843");

      var rowIdx = findRowIndexByIdOrEmail(sheet, payload.id);
      var qCount = (payload.data && payload.data.questions) ? payload.data.questions.length : 0;
      var rowData = [
        payload.id || ("bank-" + new Date().getTime()),
        payload.title || "Đề ôn tập",
        payload.topic || "",
        payload.subject || "",
        payload.grade || "",
        payload.creatorName || "",
        payload.creatorRole === "teacher" ? "Giáo viên" : "Học sinh",
        qCount,
        new Date(payload.createdAt || Date.now()).toLocaleString("vi-VN"),
        JSON.stringify(payload.data || {})
      ];
      if (rowIdx > 0) {
        sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
        styleDataRow(sheet, sheet.getLastRow(), rowData.length);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 9. LƯU LỖ HỔNG KIẾN THỨC
    if (action === "sync_weak_topic") {
      var sheet = getOrCreateFormattedSheet(ss, "LoHongKienThuc", [
        "Mã Lỗ Hổng", "User ID / Email", "Môn Học", "Tên Chuyên Đề Bị Sai",
        "Số Lần Trả Lời Sai", "Tổng Số Lần Kiểm Tra", "Trạng Thái Ôn Tập", "Ngày Ghi Nhận"
      ], "#991b1b");

      var items = Array.isArray(payload.items) ? payload.items : [payload];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it || !it.id) continue;
        var rowIdx = findRowIndexByIdOrEmail(sheet, it.id);
        var statusVi = it.status === "mastered" ? "Đã nắm vững" : (it.status === "reviewing" ? "Đang ôn tập" : "Cần rèn luyện thêm");
        var rowData = [
          it.id,
          payload.userId || it.userId || "",
          it.subject || "",
          it.topicName || "",
          it.wrongCount || 1,
          it.totalTested || 1,
          statusVi,
          new Date(it.lastMissedDate || Date.now()).toLocaleString("vi-VN")
        ];
        if (rowIdx > 0) {
          sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
          styleDataRow(sheet, sheet.getLastRow(), rowData.length);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Khởi tạo đầy đủ và trang trí chuyên nghiệp cho 5 sheets
function initAllSheets(ss) {
  getOrCreateFormattedSheet(ss, "TaiKhoan", [
    "Mã ID", "Tên Đăng Nhập", "Email Tài Khoản", "Mật Khẩu", "Họ Và Tên",
    "Vai Trò", "Khối Lớp", "Môn Học Phụ Trách", "Trường Học", "Thời Gian Đăng Ký"
  ], "#1e3a8a");

  getOrCreateFormattedSheet(ss, "LichSuQuiz", [
    "Mã Bài Thi", "Thời Gian Nộp", "Email Học Sinh", "Họ Tên", "Vai Trò",
    "Môn Học", "Khối Lớp", "Chủ Đề Quiz", "Số Câu Đúng", "Tổng Số Câu", "Điểm Số (/10)", "Lỗ Hổng Kiến Thức"
  ], "#065f46");

  getOrCreateFormattedSheet(ss, "TienDoHocTap", [
    "Email / Username", "Họ Và Tên", "Khối Lớp", "Điểm Tích Lũy (XP)", "Chuỗi Học (Streak)",
    "Số Câu Đã Hỏi", "Số Bài Đã Giải", "Số Đề Ôn Tập", "Số Đề Đã Thi", "Điểm Trung Bình"
  ], "#4c1d95");

  getOrCreateFormattedSheet(ss, "NganHangDeThi", [
    "Mã Đề Thi", "Tiêu Đề Đề Thi", "Chuyên Đề", "Môn Học", "Khối Lớp",
    "Người Soạn Đề", "Vai Trò", "Số Lượng Câu", "Ngày Tạo", "Dữ Liệu JSON"
  ], "#831843");

  getOrCreateFormattedSheet(ss, "LoHongKienThuc", [
    "Mã Lỗ Hổng", "User ID / Email", "Môn Học", "Tên Chuyên Đề Bị Sai",
    "Số Lần Trả Lời Sai", "Tổng Số Lần Kiểm Tra", "Trạng Thái Ôn Tập", "Ngày Ghi Nhận"
  ], "#991b1b");
}

function getOrCreateFormattedSheet(ss, name, headers, headerColor) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  // Nếu sheet mới tạo hoặc trống, ghi dòng tiêu đề có định dạng đẹp mắt
  if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);

    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground(headerColor || "#1e293b");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontSize(11);
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    sheet.setRowHeight(1, 38);

    // Tự động căn chỉnh độ rộng các cột
    for (var c = 1; c <= headers.length; c++) {
      sheet.autoResizeColumn(c);
    }
  }
  return sheet;
}

function styleDataRow(sheet, rowIdx, colCount) {
  try {
    var range = sheet.getRange(rowIdx, 1, 1, colCount);
    range.setVerticalAlignment("middle");
    range.setFontSize(10);
    sheet.setRowHeight(rowIdx, 28);
  } catch(e) {}
}

function findRowIndexByIdOrEmail(sheet, identifier) {
  if (!identifier) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  var clean = String(identifier).trim().toLowerCase();
  // Quét cả cột 1 (ID), cột 2 (Username), cột 3 (Email)
  var numCols = Math.min(sheet.getLastColumn(), 3);
  var values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  for (var i = 0; i < values.length; i++) {
    for (var col = 0; col < numCols; col++) {
      if (values[i][col] && String(values[i][col]).trim().toLowerCase() === clean) {
        return i + 2;
      }
    }
  }
  return -1;
}

function readSheetAsJson(ss, name, keys) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var numCols = keys.length;
  var actualCols = sheet.getLastColumn();
  var colsToRead = Math.min(numCols, actualCols);
  var values = sheet.getRange(2, 1, lastRow - 1, colsToRead).getValues();

  var list = [];
  for (var r = 0; r < values.length; r++) {
    var obj = {};
    for (var c = 0; c < colsToRead; c++) {
      obj[keys[c]] = values[r][c];
    }
    // Nếu có username và id
    if (!obj.username && obj.email) {
      obj.username = String(obj.email).split("@")[0];
    }
    // Chuẩn hóa role
    if (obj.role) {
      var rLower = String(obj.role).toLowerCase();
      if (rLower.includes("admin") || rLower.includes("quản trị")) obj.role = "admin";
      else if (rLower.includes("giáo viên") || rLower.includes("gv") || rLower.includes("teacher")) obj.role = "teacher";
      else obj.role = "student";
    }
    list.push(obj);
  }
  return list;
};`;
