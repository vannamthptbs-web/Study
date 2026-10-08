import React, { useState } from 'react';
import {
  ShieldCheck,
  Sheet,
  ExternalLink,
  CheckCircle2,
  Users,
  BookOpen,
  AlertTriangle,
  FolderOpen,
  Link,
  Save,
  Search,
  Check,
  Trash2,
  KeyRound,
  RefreshCw,
  Zap,
  Code,
  Copy,
  Eye,
  EyeOff,
  UserPlus,
  X,
  Lock,
  Download,
  AlertCircle,
} from 'lucide-react';
import {
  AppUser,
  QuizSubmissionResult,
  SavedBankQuiz,
  UserProfile,
  UserRole,
  Grade,
  Subject,
} from '../types/study';
import { GRADES, SUBJECTS } from '../data/subjects';
import {
  getSpreadsheetUrl,
  setCustomSpreadsheetId,
  syncAllAppDataToGoogleSheets,
  signInWithGoogle,
  getAppsScriptWebhookUrl,
  setAppsScriptWebhookUrl,
  getLastAutoSyncTime,
  SAMPLE_APPS_SCRIPT_CODE,
  DEFAULT_SHEET_URL,
} from '../services/firebaseWorkspace';
import {
  getStoredAccounts,
  getAllQuizHistory,
  getBankQuizzes,
  getStoredWeakTopics,
  saveProfile,
  deleteAccountRecord,
  saveAccountRecord,
  loginUser,
  loadDataFromGoogleSheets,
} from '../services/storage';

interface Props {
  currentUser: UserProfile;
  onUserChanged: (updated: UserProfile) => void;
  onNotification: (msg: string) => void;
}

export const AdminPanel: React.FC<Props> = ({
  currentUser,
  onUserChanged,
  onNotification,
}) => {
  const currentUrl = getSpreadsheetUrl() || DEFAULT_SHEET_URL;
  const [sheetInput, setSheetInput] = useState(currentUrl);
  const [savedSheetUrl, setSavedSheetUrl] = useState(currentUrl);
  const [webhookInput, setWebhookInput] = useState(getAppsScriptWebhookUrl() || DEFAULT_SHEET_URL);
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSheet, setCopiedSheet] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'sheet' | 'accounts' | 'quizzes'>('sheet');

  // Password reset modal state
  const [resettingUser, setResettingUser] = useState<AppUser | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');

  // Delete confirm modal state
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);

  // Add new user modal state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('student');
  const [newUserGrade, setNewUserGrade] = useState<Grade>('Lớp 4');
  const [newUserSchool, setNewUserSchool] = useState('Trường Tiểu học');

  // Visibility toggle for account passwords in table
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Non-admin login form state inside Admin panel
  const [adminLoginId, setAdminLoginId] = useState('admin');
  const [adminLoginPw, setAdminLoginPw] = useState('admin123');
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);

  const [accounts, setAccounts] = useState<AppUser[]>(getStoredAccounts);
  const [quizHistory, setQuizHistory] = useState<QuizSubmissionResult[]>(getAllQuizHistory);
  const bankQuizzes: SavedBankQuiz[] = getBankQuizzes();
  const weakTopics = getStoredWeakTopics(currentUser.id);
  const lastSyncTime = getLastAutoSyncTime();

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  // 1. Direct Admin Login for Non-Admin users
  const handleAdminLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAdminLoginError(null);
    setAdminLoginLoading(true);

    const res = loginUser(adminLoginId, adminLoginPw);
    setAdminLoginLoading(false);

    if (res.success && res.profile) {
      onUserChanged(res.profile);
      onNotification('Đã mở toàn bộ quyền Quản trị viên (Admin) thành công! 🚀');
    } else {
      setAdminLoginError(res.error || 'Tài khoản hoặc mật khẩu Quản trị không chính xác.');
    }
  };

  // Quick 1-click admin login
  const handleQuickLoginAdmin = () => {
    setAdminLoginId('admin');
    const adminAccount = getStoredAccounts().find((a) => a.username === 'admin');
    const pw = adminAccount?.password || 'admin123';
    setAdminLoginPw(pw);
    const res = loginUser('admin', pw);
    if (res.success && res.profile) {
      onUserChanged(res.profile);
      onNotification('Đã kích hoạt toàn bộ quyền Quản trị viên (Admin) thành công! 🚀');
    } else {
      setAdminLoginError(res.error || 'Không thể đăng nhập tài khoản Quản trị.');
    }
  };

  // 2. Save custom sheet link (Vị trí lưu link Google Sheet cho admin)
  const handleSaveSheetLink = () => {
    const val = sheetInput.trim();
    if (!val) {
      onNotification('Vui lòng nhập đường link bảng tính Google Sheet hoặc URL Web App script.');
      return;
    }

    // Sync with server proxy
    fetch('/api/sheets/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: val }),
    }).catch(() => {});

    if (val.includes('script.google.com')) {
      setAppsScriptWebhookUrl(val);
      setSavedSheetUrl(val);
      setWebhookInput(val);
      onNotification('Đã lưu link Web App Google Sheet thành công! Link: ' + val);
      loadDataFromGoogleSheets().then(() => {
        setAccounts(getStoredAccounts());
        setQuizHistory(getAllQuizHistory());
      }).catch(() => {});
      return;
    }

    try {
      const parsedId = setCustomSpreadsheetId(val);
      const fullUrl = `https://docs.google.com/spreadsheets/d/${parsedId}`;
      setSavedSheetUrl(fullUrl);
      setSheetInput(fullUrl);
      onNotification('Đã lưu liên kết Google Sheet thành công! Bảng tính: ' + parsedId);
      loadDataFromGoogleSheets().then(() => {
        setAccounts(getStoredAccounts());
        setQuizHistory(getAllQuizHistory());
      }).catch(() => {});
    } catch (e: any) {
      onNotification(e.message || 'Link Google Sheet không hợp lệ.');
    }
  };

  const handleCopySheetLink = () => {
    if (!savedSheetUrl) return;
    navigator.clipboard.writeText(savedSheetUrl);
    setCopiedSheet(true);
    setTimeout(() => setCopiedSheet(false), 2000);
    onNotification('Đã sao chép liên kết Google Sheet vào bộ nhớ tạm!');
  };

  const handleClearSheetLink = () => {
    localStorage.removeItem('study_ai_spreadsheet_id_v1');
    setSavedSheetUrl('');
    setSheetInput('');
    onNotification('Đã gỡ liên kết Google Sheet hiện tại.');
  };

  // Save Apps Script Webhook URL
  const handleSaveWebhook = () => {
    setAppsScriptWebhookUrl(webhookInput);
    onNotification('Đã lưu cấu hình Google Apps Script Webhook thành công!');
  };

  // Copy sample Apps Script code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(SAMPLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
    onNotification('Đã sao chép mã Google Apps Script vào bộ nhớ tạm!');
  };

  // Connect Google account to enable Google Sheets API
  const handleConnectGoogle = async () => {
    try {
      onNotification('Đang mở cửa sổ xác thực Google Sheets...');
      const res = await signInWithGoogle();
      if (res) {
        onNotification('Đã kết nối tài khoản Google thành công! Hệ thống tự động đồng bộ thời gian thực.');
        await syncAllAppDataToGoogleSheets(res.accessToken);
        setSavedSheetUrl(getSpreadsheetUrl() || savedSheetUrl);
      }
    } catch (e: any) {
      if (e?.code !== 'auth/popup-closed-by-user') {
        onNotification('Lỗi kết nối Google: ' + (e.message || 'Không xác định'));
      }
    }
  };

  // Force sync all data
  const handleSyncAllData = async () => {
    setSyncing(true);
    setSyncSuccessMsg(null);
    try {
      let res;
      try {
        res = await syncAllAppDataToGoogleSheets();
      } catch (err: any) {
        if (err.message?.includes('Chưa kết nối tài khoản Google')) {
          onNotification('Vui lòng đăng nhập tài khoản Google để cấp quyền Google Sheets...');
          const googleRes = await signInWithGoogle();
          if (googleRes) {
            res = await syncAllAppDataToGoogleSheets(googleRes.accessToken);
          } else {
            setSyncing(false);
            return;
          }
        } else {
          throw err;
        }
      }

      if (res && res.success) {
        setSavedSheetUrl(res.sheetUrl);
        setSheetInput(res.sheetUrl);
        setSyncSuccessMsg(`Đã cập nhật toàn bộ: ${res.stats.accountsCount} tài khoản, ${res.stats.quizzesCount} bài thi, ${res.stats.bankCount} đề thi ngân hàng sang Google Sheet! 🚀`);
        onNotification('Đã đồng bộ toàn bộ dữ liệu sang Google Sheet thành công!');
      }
    } catch (err: any) {
      console.error(err);
      onNotification('Lỗi đồng bộ Google Sheets: ' + (err.message || 'Không xác định'));
    } finally {
      setSyncing(false);
    }
  };

  // Confirm delete account
  const handleConfirmDelete = () => {
    if (!deletingUser) return;
    if (deletingUser.username === 'admin') {
      onNotification('Không thể xóa tài khoản Quản trị viên gốc.');
      setDeletingUser(null);
      return;
    }
    deleteAccountRecord(deletingUser.id);
    setAccounts(getStoredAccounts());
    loadDataFromGoogleSheets().then(() => setAccounts(getStoredAccounts())).catch(() => {});
    onNotification(`Đã xóa tài khoản ${deletingUser.name} khỏi hệ thống.`);
    setDeletingUser(null);
  };

  // Reset / change password for any account
  const handleConfirmResetPassword = () => {
    if (!resettingUser) return;
    if (!newPasswordVal.trim() || newPasswordVal.trim().length < 4) {
      onNotification('Mật khẩu mới phải có ít nhất 4 ký tự.');
      return;
    }
    resettingUser.password = newPasswordVal.trim();
    saveAccountRecord(resettingUser);
    setAccounts(getStoredAccounts());
    loadDataFromGoogleSheets().then(() => setAccounts(getStoredAccounts())).catch(() => {});

    // If currently logged in as this user, update profile state
    if (currentUser.id === resettingUser.id) {
      onUserChanged({
        ...currentUser,
        name: resettingUser.name,
      });
    }

    onNotification(`Đã đổi mật khẩu cho tài khoản ${resettingUser.name} thành công! Mật khẩu mới đã được lưu cho lần đăng nhập sau.`);
    setResettingUser(null);
    setNewPasswordVal('');
  };

  // Change role inline
  const handleChangeRole = (account: AppUser, newRole: UserRole) => {
    if (account.username === 'admin' && newRole !== 'admin') {
      onNotification('Không thể thay đổi vai trò của Quản trị viên gốc.');
      return;
    }
    account.role = newRole;
    saveAccountRecord(account);
    setAccounts(getStoredAccounts());
    loadDataFromGoogleSheets().then(() => setAccounts(getStoredAccounts())).catch(() => {});
    if (currentUser.id === account.id) {
      onUserChanged({ ...currentUser, role: newRole });
    }
    onNotification(`Đã cập nhật vai trò của ${account.name} thành ${newRole === 'admin' ? 'Admin' : newRole === 'teacher' ? 'Giáo viên' : 'Học sinh'}.`);
  };

  // Add new account manually by Admin
  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      onNotification('Vui lòng điền họ tên và email.');
      return;
    }
    if (!newUserPassword.trim() || newUserPassword.trim().length < 4) {
      onNotification('Mật khẩu phải có ít nhất 4 ký tự.');
      return;
    }

    const uName = newUserUsername.trim() || newUserEmail.split('@')[0] || `user_${Date.now()}`;
    const newUser: AppUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      username: uName.toLowerCase(),
      name: newUserName.trim(),
      email: newUserEmail.trim().toLowerCase(),
      password: newUserPassword.trim(),
      role: newUserRole,
      grade: newUserGrade,
      subject: newUserRole === 'teacher' ? 'Toán' : undefined,
      school: newUserSchool.trim() || 'Trường Tiểu học',
      createdAt: Date.now(),
    };

    saveAccountRecord(newUser);
    setAccounts(getStoredAccounts());
    loadDataFromGoogleSheets().then(() => setAccounts(getStoredAccounts())).catch(() => {});
    onNotification(`Đã tạo mới tài khoản ${newUser.name} thành công!`);
    setShowAddUserModal(false);
    setNewUserName('');
    setNewUserUsername('');
    setNewUserEmail('');
    setNewUserPassword('');
  };

  // Export Quiz History to CSV
  const handleExportQuizCSV = () => {
    if (quizHistory.length === 0) {
      onNotification('Chưa có dữ liệu bài làm để xuất.');
      return;
    }
    const headers = ['Thời gian,Họ tên,Email,Môn học,Khối lớp,Chủ đề,Số câu đúng,Tổng câu,Điểm số,Lỗ hổng'];
    const rows = quizHistory.map((q) =>
      [
        `"${new Date(q.timestamp).toLocaleString('vi-VN')}"`,
        `"${q.userName || ''}"`,
        `"${q.userEmail || ''}"`,
        `"${q.subject}"`,
        `"${q.grade}"`,
        `"${q.topic.replace(/"/g, '""')}"`,
        q.correctCount,
        q.totalQuestions,
        q.score.toFixed(1),
        `"${(q.weakSubtopics || []).join('; ').replace(/"/g, '""')}"`,
      ].join(',')
    );
    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StudyAI_LichSuQuiz_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotification('Đã tải xuống file CSV kết quả bài làm Quiz thành công!');
  };

  const filteredAccounts = accounts.filter((acc) => {
    const matchesRole = roleFilter === 'all' || acc.role === roleFilter;
    const matchesSearch =
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (acc.username && acc.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (acc.school && acc.school.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  // =========================================================================
  // ACCESS GATE: If current user is not admin, show interactive admin login!
  // =========================================================================
  if (currentUser.role !== 'admin') {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 text-center max-w-lg mx-auto space-y-6 shadow-md my-8 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold mb-2">
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Khu Vực Quản Trị Hệ Thống Toàn Quyền</span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900">
            Đăng nhập quyền Quản trị viên (Admin)
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
            Để truy cập toàn bộ quyền quản trị, cấu hình vị trí lưu link Google Sheet, quản lý tài khoản và đổi mật khẩu, vui lòng đăng nhập tài khoản Quản trị.
          </p>
        </div>

        <form onSubmit={handleAdminLoginSubmit} className="space-y-3 text-left">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tài khoản Admin / Email:
            </label>
            <input
              type="text"
              value={adminLoginId}
              onChange={(e) => setAdminLoginId(e.target.value)}
              placeholder="admin"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mật khẩu Admin:
            </label>
            <input
              type="password"
              value={adminLoginPw}
              onChange={(e) => setAdminLoginPw(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          {adminLoginError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{adminLoginError}</span>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={adminLoginLoading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all"
            >
              {adminLoginLoading ? 'Đang xác thực...' : 'Đăng Nhập Quản Trị Viên'}
            </button>

            <button
              type="button"
              onClick={handleQuickLoginAdmin}
              className="w-full py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Zap className="w-4 h-4 text-amber-600 fill-amber-500" />
              <span>⚡ Mở nhanh quyền Admin (Mặc định: admin / admin123)</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // =========================================================================
  // FULL ADMIN PANEL: When user is authenticated as Admin
  // =========================================================================
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Admin Header Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-xs font-semibold text-sky-300 mb-3 border border-indigo-400/30">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span>Khu Vực Quản Trị Toàn Quyền – Ban Quản Trị Hệ Thống</span>
          </div>

          <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">
            Quản trị toàn bộ ứng dụng & Vị trí lưu link Google Sheets
          </h2>
          <p className="mt-2 text-slate-300 text-xs sm:text-sm leading-relaxed">
            Hệ thống quản lý toàn bộ học sinh, giáo viên, đề thi và bảng điểm.
            <strong> Mọi thông tin trên app được tự động lưu vào Google Sheet trong nền</strong> mà không cần thao tác đẩy thủ công.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-white/10 text-slate-200 border border-white/10 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Chế độ tự động lưu: <strong>ĐANG BẬT</strong></span>
            </div>
            {lastSyncTime > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-white/10 text-slate-300 border border-white/10">
                Ghi nhận gần nhất: {new Date(lastSyncTime).toLocaleTimeString('vi-VN')}
              </div>
            )}
            {savedSheetUrl && (
              <a
                href={savedSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5 hover:bg-emerald-500/30 transition-colors"
              >
                <Sheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bảng tính đang liên kết ↗</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Admin Sub Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveAdminSubTab('sheet')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeAdminSubTab === 'sheet'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sheet className="w-4 h-4" />
          <span>Vị Trí Lưu Link Google Sheet & Tự Động Lưu</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeAdminSubTab === 'accounts'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Quản Lý Toàn Bộ Tài Khoản ({accounts.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('quizzes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeAdminSubTab === 'quizzes'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Toàn Bộ Bài Làm Quiz ({quizHistory.length})</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* SUB-TAB 1: VỊ TRÍ GẮN & LƯU LINK GOOGLE SHEET CHO ADMIN          */}
      {/* ================================================================= */}
      {activeAdminSubTab === 'sheet' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Sheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Vị Trí Lưu Link Google Sheet Cho Quản Trị Viên (Admin)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dán đường link bảng tính Google Sheet để hệ thống tự động lưu điểm số, tài khoản và tiến độ học tập
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Tự động lưu: BẬT</span>
              </div>
            </div>

            {/* Input Link Google Sheet */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Đường link hoặc Spreadsheet ID Google Sheets:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Link className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    placeholder="Ví dụ: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5.../edit"
                    className="w-full pl-9 pr-3 py-3 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <button
                  onClick={handleSaveSheetLink}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu liên kết</span>
                </button>

                {savedSheetUrl && (
                  <>
                    <button
                      onClick={handleCopySheetLink}
                      className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                      title="Sao chép link Google Sheet"
                    >
                      {copiedSheet ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedSheet ? 'Đã chép' : 'Sao chép link'}</span>
                    </button>

                    <a
                      href={savedSheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-5 py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs sm:text-sm border border-emerald-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Mở Google Sheet</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    <button
                      onClick={handleClearSheetLink}
                      className="px-3 py-3 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
                      title="Gỡ liên kết bảng tính này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Auto-Sync Explanation Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 border border-emerald-200/90 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tự động đồng bộ ngầm (Không cần bấm nút đẩy qua)</span>
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Tất cả thông tin trên ứng dụng được tự động lưu sang Google Sheet
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-xl">
                    Mỗi khi có học sinh/giáo viên tạo tài khoản mới, hoàn thành bài quiz, đổi mật khẩu hoặc học tập tích lũy XP, hệ thống tự động ghi nhận ngay lập tức vào 5 bảng:
                    <strong> TaiKhoan</strong>, <strong>LichSuQuiz</strong>, <strong>TienDoHocTap</strong>, <strong>LoHongKienThuc</strong>, <strong>NganHangDeThi</strong>.
                  </p>
                </div>

                <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                  <button
                    onClick={handleConnectGoogle}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-300 shadow-2xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                    </svg>
                    <span>Cấp quyền Google Sheets</span>
                  </button>

                  <button
                    onClick={handleSyncAllData}
                    disabled={syncing}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>{syncing ? 'Đang kiểm tra...' : 'Đồng bộ lại toàn bộ'}</span>
                  </button>
                </div>
              </div>

              {syncSuccessMsg && (
                <div className="p-3 rounded-xl bg-white border border-emerald-300 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{syncSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Optional: Apps Script Webhook Integration */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                    Google Apps Script Webhook (Tùy chọn - Ghi dữ liệu trực tiếp 100% không cần đăng nhập Google)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Gắn Web App URL từ Google Sheets để mọi thiết bị học sinh đều có thể tự động ghi vào sheet mà không cần popup
                  </p>
                </div>

                <button
                  onClick={() => setShowCodeSnippet(!showCodeSnippet)}
                  className="text-xs text-indigo-700 font-bold hover:underline flex items-center gap-1"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>{showCodeSnippet ? 'Ẩn mã Apps Script' : 'Xem mã Apps Script'}</span>
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSaveWebhook}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200"
                >
                  Lưu Webhook
                </button>
              </div>

              {showCodeSnippet && (
                <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                    <span>Mã Google Apps Script (Tools &gt; Script editor):</span>
                    <button
                      onClick={handleCopyCode}
                      className="text-xs text-sky-400 font-bold flex items-center gap-1 hover:underline"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
                    </button>
                  </div>
                  <pre className="overflow-x-auto max-h-48 text-[11px] leading-relaxed scrollbar-thin">
                    {SAMPLE_APPS_SCRIPT_CODE}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 font-bold">
                <Users className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{accounts.length}</div>
              <span className="text-xs text-slate-500 font-medium">Tài khoản trên hệ thống</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 font-bold">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{quizHistory.length}</div>
              <span className="text-xs text-slate-500 font-medium">Lượt làm bài trắc nghiệm</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 font-bold">
                <FolderOpen className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{bankQuizzes.length}</div>
              <span className="text-xs text-slate-500 font-medium">Đề trong ngân hàng</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2 font-bold">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{weakTopics.length}</div>
              <span className="text-xs text-slate-500 font-medium">Lỗ hổng kiến thức</span>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 2: QUẢN LÝ TOÀN BỘ TÀI KHOẢN (Mở quyền toàn bộ cho admin) */}
      {/* ================================================================= */}
      {activeAdminSubTab === 'accounts' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Quản lý toàn bộ tài khoản (Admin Control Panel)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
                  {filteredAccounts.length}/{accounts.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Xem chi tiết, kiểm tra mật khẩu, đổi mật khẩu, phân quyền hoặc xóa tài khoản
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowAddUserModal(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Thêm tài khoản</span>
              </button>

              {/* Filter Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm tên, username, email..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    roleFilter === 'all' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setRoleFilter('student')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    roleFilter === 'student' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Học sinh
                </button>
                <button
                  onClick={() => setRoleFilter('teacher')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    roleFilter === 'teacher' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Giáo viên
                </button>
                <button
                  onClick={() => setRoleFilter('admin')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    roleFilter === 'admin' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Họ Tên / Username</th>
                  <th className="py-2.5 px-3">Email đăng ký</th>
                  <th className="py-2.5 px-3">Phân quyền</th>
                  <th className="py-2.5 px-3">Khối lớp & Môn</th>
                  <th className="py-2.5 px-3">Mật khẩu lưu</th>
                  <th className="py-2.5 px-3 text-right">Thao tác Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((acc) => {
                  const isVisible = visiblePasswords[acc.id];
                  const displayPw = acc.password || (acc.username === 'admin' ? 'admin123' : 'Chưa đặt');
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span>{acc.name}</span>
                          {acc.username === 'admin' && (
                            <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded">
                              Root Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-normal">@{acc.username || 'user'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        {acc.email}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={acc.role}
                          onChange={(e) => handleChangeRole(acc, e.target.value as UserRole)}
                          className={`px-2 py-1 rounded-lg font-bold text-[11px] border cursor-pointer focus:outline-none ${
                            acc.role === 'admin'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : acc.role === 'teacher'
                              ? 'bg-sky-50 text-sky-800 border-sky-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          <option value="student">Học sinh</option>
                          <option value="teacher">Giáo viên</option>
                          <option value="admin">Quản trị viên</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {acc.grade} {acc.subject ? `• ${acc.subject}` : ''}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span>{isVisible ? displayPw : '••••••••'}</span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(acc.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded"
                            title={isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5">
                        <button
                          onClick={() => {
                            setResettingUser(acc);
                            setNewPasswordVal(acc.password || '');
                          }}
                          title="Đổi / Đặt lại mật khẩu"
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] transition-colors inline-flex items-center gap-1"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Đổi MK</span>
                        </button>

                        {acc.username !== 'admin' && (
                          <button
                            onClick={() => setDeletingUser(acc)}
                            title="Xóa tài khoản"
                            className="p-1 rounded-lg hover:bg-rose-100 text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 3: TOÀN BỘ LỊCH SỬ BÀI LÀM QUIZ                           */}
      {/* ================================================================= */}
      {activeAdminSubTab === 'quizzes' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Toàn bộ lịch sử bài làm trắc nghiệm trên hệ thống
              </h3>
              <p className="text-xs text-slate-500">
                Theo dõi kết quả điểm thi và chuyên đề của học sinh
              </p>
            </div>

            {quizHistory.length > 0 && (
              <button
                onClick={handleExportQuizCSV}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất file CSV bảng điểm</span>
              </button>
            )}
          </div>

          {quizHistory.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              Chưa có bài thi trắc nghiệm nào được nộp trên hệ thống.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Thời gian</th>
                    <th className="py-2 px-3">Người làm</th>
                    <th className="py-2 px-3">Môn học</th>
                    <th className="py-2 px-3">Khối lớp</th>
                    <th className="py-2 px-3">Chủ đề</th>
                    <th className="py-2 px-3">Kết quả</th>
                    <th className="py-2 px-3">Điểm số</th>
                    <th className="py-2 px-3">Lỗ hổng kiến thức</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quizHistory.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(q.timestamp).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {q.userName || 'Học sinh'}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-700">{q.subject}</td>
                      <td className="py-2 px-3 text-slate-600">{q.grade}</td>
                      <td className="py-2 px-3 text-slate-700 max-w-xs truncate">{q.topic}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">
                        {q.correctCount}/{q.totalQuestions}
                      </td>
                      <td className="py-2 px-3 font-extrabold text-indigo-700">
                        {q.score.toFixed(1)}/10
                      </td>
                      <td className="py-2 px-3 text-slate-500 text-[11px]">
                        {q.weakSubtopics && q.weakSubtopics.length > 0
                          ? q.weakSubtopics.join(', ')
                          : 'Đạt chuẩn'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 1: ĐẶT LẠI MẬT KHẨU CHO TÀI KHOẢN (LƯU CHO LẦN ĐĂNG NHẬP SAU) */}
      {/* ================================================================= */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-sm text-slate-900">
                  Đổi mật khẩu tài khoản
                </h4>
              </div>
              <button
                onClick={() => setResettingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-600">
                Tài khoản: <strong>{resettingUser.name}</strong> ({resettingUser.username || resettingUser.email})
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Mật khẩu mới sẽ được lưu lại để người dùng đăng nhập cho các lần sau.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nhập mật khẩu mới (tối thiểu 4 ký tự):
              </label>
              <input
                type="text"
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                placeholder="Ví dụ: 123456"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResettingUser(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmResetPassword}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
              >
                Lưu mật khẩu mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: XÁC NHẬN XÓA TÀI KHOẢN (TRÁNH DÙNG WINDOW.CONFIRM)       */}
      {/* ================================================================= */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="font-bold text-sm text-slate-900">
                Xác nhận xóa tài khoản?
              </h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài khoản <strong>{deletingUser.name}</strong> ({deletingUser.email || deletingUser.username})? Toàn bộ dữ liệu gắn liền sẽ bị xóa.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: THÊM TÀI KHOẢN MỚI TRỰC TIẾP TỪ ADMIN                    */}
      {/* ================================================================= */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-sm text-slate-900">
                  Thêm tài khoản người dùng mới
                </h4>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và tên:
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Username:
                  </label>
                  <input
                    type="text"
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    placeholder="nguyenvana"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mật khẩu:
                  </label>
                  <input
                    type="password"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email:
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="a@gmail.com"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vai trò:
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                  >
                    <option value="student">Học sinh</option>
                    <option value="teacher">Giáo viên</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Khối lớp:
                  </label>
                  <select
                    value={newUserGrade}
                    onChange={(e) => setNewUserGrade(e.target.value as Grade)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Trường học:
                </label>
                <input
                  type="text"
                  value={newUserSchool}
                  onChange={(e) => setNewUserSchool(e.target.value)}
                  placeholder="Tiểu học Kim Đồng..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
                >
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
