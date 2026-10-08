import React, { useState } from 'react';
import {
  BookOpen,
  MessageSquareText,
  Wand2,
  BookOpenCheck,
  CheckCircle2,
  BarChart3,
  ShieldCheck,
  KeyRound,
  ExternalLink,
  ChevronRight,
  Database,
  Sparkles,
  Award,
  Layers,
  ArrowRight,
  Check,
  Copy,
  AlertTriangle,
  Lightbulb,
  FileSpreadsheet,
  GraduationCap,
  Users,
  Code,
} from 'lucide-react';
import { ActiveTab, UserProfile } from '../types/study';
import { DEFAULT_SHEET_URL, getSpreadsheetUrl } from '../services/firebaseWorkspace';

interface Props {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenAuth?: () => void;
  currentUser?: UserProfile;
}

export const UserGuide: React.FC<Props> = ({ setActiveTab, onOpenAuth, currentUser }) => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [copiedLink, setCopiedLink] = useState(false);
  const currentSheetUrl = getSpreadsheetUrl() || DEFAULT_SHEET_URL;

  const handleCopySheetLink = () => {
    navigator.clipboard.writeText(currentSheetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const menuSections = [
    {
      id: 'chat',
      title: '1. Menu "Hỏi AI" (Gia sư AI 24/7)',
      icon: MessageSquareText,
      color: 'from-indigo-500 to-sky-500',
      badge: 'Trợ lý học tập thông minh',
    },
    {
      id: 'solver',
      title: '2. Menu "Giải bài" (Từng bước chi tiết)',
      icon: Wand2,
      color: 'from-violet-500 to-purple-600',
      badge: 'Toán & Môn học Tiểu học',
    },
    {
      id: 'review',
      title: '3. Menu "Ôn bài" (Hệ thống hóa kiến thức)',
      icon: BookOpenCheck,
      color: 'from-amber-500 to-orange-500',
      badge: 'Trọng tâm & Sơ đồ tư duy',
    },
    {
      id: 'quiz',
      title: '4. Menu "Trắc nghiệm & Tạo đề"',
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      badge: 'Luyện thi & Giáo viên soạn đề',
    },
    {
      id: 'progress',
      title: '5. Menu "Tiến độ học tập"',
      icon: BarChart3,
      color: 'from-blue-500 to-cyan-600',
      badge: 'Điểm số & Lỗ hổng kiến thức',
    },
    {
      id: 'admin',
      title: '6. Menu "Quản trị" (Admin Panel)',
      icon: ShieldCheck,
      color: 'from-rose-500 to-red-600',
      badge: 'Toàn quyền Admin & Google Sheet',
    },
    {
      id: 'auth',
      title: '7. Tài khoản, Đăng nhập & Đổi mật khẩu',
      icon: KeyRound,
      color: 'from-pink-500 to-rose-500',
      badge: 'Bảo mật & Lưu trữ tài khoản',
    },
    {
      id: 'principles',
      title: '8. 6 Nguyên Tắc Lưu Trữ Google Sheets',
      icon: Database,
      color: 'from-emerald-600 to-green-700',
      badge: 'Database duy nhất của App',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-sky-600 text-white p-6 sm:p-10 shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-sky-100 border border-white/20">
            <BookOpen className="w-3.5 h-3.5 text-amber-300" />
            <span>Sổ Tay Hướng Dẫn Sử Dụng Chi Tiết Từ A - Z</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Hướng Dẫn Toàn Diện Về Nội Dung & Các Menu Trong StudyAI
          </h1>

          <p className="text-sm sm:text-base text-indigo-100 leading-relaxed font-normal">
            Tài liệu chi tiết hướng dẫn học sinh, giáo viên và quản trị viên khai thác toàn bộ sức mạnh của nền tảng:
            từ Gia sư AI, bộ giải toán, trắc nghiệm, quản lý đề thi cho đến quy chuẩn lưu trữ dữ liệu trực tiếp vào Google Sheets.
          </p>

          <div className="pt-2 flex flex-wrap gap-3 items-center text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 font-medium">
              🎒 Dành cho Lớp 1 - Lớp 5
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 font-medium">
              📖 Chuẩn SGK GDPT 2018 (Kết nối tri thức, Chân trời, Cánh diều)
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-semibold flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-300" />
              <span>Google Sheets = Database duy nhất</span>
            </span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Anchor Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {menuSections.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                const el = document.getElementById(`section-${item.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all hover:scale-[1.02] flex flex-col justify-between ${
                activeSection === item.id
                  ? 'bg-indigo-50/90 border-indigo-400 shadow-sm ring-2 ring-indigo-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${item.color} flex items-center justify-center text-white shadow-2xs`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Menu</span>
              </div>
              <div className="font-bold text-xs sm:text-sm text-slate-800 line-clamp-1">{item.title}</div>
              <span className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{item.badge}</span>
            </button>
          );
        })}
      </div>

      {/* Bảng Tổng Quan Các Menu & Nơi Dữ Liệu Được Lưu Trực Tiếp */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-base sm:text-lg">
                Bảng Tổng Hợp Chi Tiết Tất Cả Menu & Chức Năng Trong App
              </h2>
              <p className="text-xs text-slate-500">
                Tra cứu nhanh đối tượng sử dụng, nhiệm vụ chính và bảng Google Sheets tương ứng
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            Database: Google Sheets duy nhất
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                <th className="py-2.5 px-3 rounded-l-xl">Menu / Tab</th>
                <th className="py-2.5 px-3">Đối tượng</th>
                <th className="py-2.5 px-3">Nội dung & Tính năng chính</th>
                <th className="py-2.5 px-3">Ghi vào Google Sheets</th>
                <th className="py-2.5 px-3 rounded-r-xl text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <tr className="hover:bg-indigo-50/40 transition-colors">
                <td className="py-3 px-3 font-bold text-indigo-700 flex items-center gap-1.5">
                  <MessageSquareText className="w-4 h-4 text-indigo-500" />
                  <span>1. Hỏi AI</span>
                </td>
                <td className="py-3 px-3 text-slate-800 font-medium">Học sinh / Thầy cô</td>
                <td className="py-3 px-3">
                  Gia sư AI 24/7 đối thoại, giải thích bài học, đính kèm ảnh chụp bài tập, nút Làm mới, giữ nguyên màn hình ban đầu.
                </td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-[11px] font-semibold">
                    TienDoHocTap (XP)
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-xs font-bold transition-colors"
                  >
                    Mở tab
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-violet-50/40 transition-colors">
                <td className="py-3 px-3 font-bold text-violet-700 flex items-center gap-1.5">
                  <Wand2 className="w-4 h-4 text-violet-500" />
                  <span>2. Giải bài</span>
                </td>
                <td className="py-3 px-3 text-slate-800 font-medium">Học sinh / Thầy cô</td>
                <td className="py-3 px-3">
                  Giải toán & tự luận 4-6 bước: tóm tắt, sơ đồ đoạn thẳng, lời giải chi tiết, công thức LaTeX, bẫy cần tránh.
                </td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 font-mono text-[11px] font-semibold">
                    TienDoHocTap (Bài giải)
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => setActiveTab('solver')}
                    className="px-2.5 py-1 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-800 text-xs font-bold transition-colors"
                  >
                    Mở tab
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-amber-50/40 transition-colors">
                <td className="py-3 px-3 font-bold text-amber-700 flex items-center gap-1.5">
                  <BookOpenCheck className="w-4 h-4 text-amber-500" />
                  <span>3. Ôn bài</span>
                </td>
                <td className="py-3 px-3 text-slate-800 font-medium">Học sinh / Thầy cô</td>
                <td className="py-3 px-3">
                  Đề cương tóm tắt kiến thức trọng tâm, bảng quy tắc, ví dụ que tính/đoạn thẳng, sơ đồ tư duy, nút Làm mới.
                </td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-mono text-[11px] font-semibold">
                    TienDoHocTap (Ôn bài)
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => setActiveTab('review')}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold transition-colors"
                  >
                    Mở tab
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-emerald-50/40 transition-colors">
                <td className="py-3 px-3 font-bold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>4. Trắc nghiệm</span>
                </td>
                <td className="py-3 px-3 text-slate-800 font-medium">Học sinh & Giáo viên</td>
                <td className="py-3 px-3">
                  Học sinh luyện đề bấm giờ, chấm điểm thang 10, phát hiện lỗ hổng. Giáo viên soạn đề ma trận, xuất JSON.
                </td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono text-[11px] font-semibold">
                    LichSuQuiz, NganHangDeThi
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => setActiveTab('quiz')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold transition-colors"
                  >
                    Mở tab
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-blue-50/40 transition-colors">
                <td className="py-3 px-3 font-bold text-blue-700 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <span>5. Tiến độ</span>
                </td>
                <td className="py-3 px-3 text-slate-800 font-medium">Học sinh / Thầy cô</td>
                <td className="py-3 px-3">
                  Biểu đồ học tập, điểm XP, chuỗi ngày streak, danh sách lỗ hổng kiến thức cần ôn, xem điểm Google Sheets.
                </td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-[11px] font-semibold">
                    TienDoHocTap, LoHongKienThuc
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => setActiveTab('progress')}
                    className="px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold transition-colors"
                  >
                    Mở tab
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-rose-50/40 transition-colors">
                <td className="py-3 px-3 font-bold text-rose-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-rose-500" />
                  <span>6. Quản trị</span>
                </td>
                <td className="py-3 px-3 text-slate-800 font-medium">Ban Quản trị (Admin)</td>
                <td className="py-3 px-3">
                  Vị trí lưu link Google Sheet, quản lý toàn bộ tài khoản, đổi mật khẩu theo ID duy nhất, theo dõi bài thi toàn trường, xuất CSV.
                </td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-mono text-[11px] font-semibold">
                    TaiKhoan (Toàn quyền)
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => setActiveTab('admin')}
                    className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold transition-colors"
                  >
                    Mở tab
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="space-y-8">
        {/* ========================================================= */}
        {/* SECTION 1: HỎI AI (GIA SƯ AI)                            */}
        {/* ========================================================= */}
        <section
          id="section-chat"
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 scroll-mt-20"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <MessageSquareText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Tính năng trọng tâm</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  Menu "Hỏi AI" – Gia Sư Thông Minh 24/7
                </h2>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('chat')}
              className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <span>Mở tab Hỏi AI</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Nội dung & Cách thức hoạt động</span>
              </h3>
              <ul className="space-y-2 list-disc list-inside text-slate-600">
                <li>
                  <strong>Học cùng Gia sư AI:</strong> Đóng vai người thầy/cô tận tâm, xưng hô "Thầy/Cô - Con (hoặc Em)",
                  giải thích bài học nhẹ nhàng, ấm áp và kiên nhẫn.
                </li>
                <li>
                  <strong>Giao diện ban đầu luôn giữ nguyên:</strong> Màn hình chào mừng, gợi ý câu hỏi nhanh, tóm tắt môn
                  học và các chủ đề tiêu biểu <em>không bao giờ bị mất đi</em> khi học sinh trò chuyện, giúp bé tra cứu
                  tiện lợi mọi lúc.
                </li>
                <li>
                  <strong>Đính kèm hình ảnh đề bài:</strong> Học sinh có thể chụp ảnh phiếu bài tập, trang sách giáo khoa
                  hoặc chữ viết tay; AI sẽ tự động đọc đề bài và hướng dẫn từng bước.
                </li>
                <li>
                  <strong>Đố vui củng cố:</strong> Kết thúc mỗi câu trả lời, Gia sư AI luôn gửi tặng một câu đố vui nhỏ để
                  bé tự thử thách tư duy của mình.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Nút "Làm mới" & Thao tác nhanh</span>
              </h3>
              <p>
                Nút <strong>"Làm mới"</strong> (biểu tượng xoay tròn) ở góc trên khung chat cho phép học sinh xóa sạch
                lịch sử phiên hỏi đáp hiện tại ngay lập tức để chuyển sang môn học hoặc chủ đề khác một cách mượt mà.
              </p>
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-1.5">
                <span className="font-bold text-indigo-900">💡 Mẹo nhỏ cho học sinh:</span>
                <p className="text-indigo-800 text-xs">
                  Nhập rõ ràng khối lớp của con ở góc trên để AI điều chỉnh độ khó và từ ngữ phù hợp nhất với lứa tuổi!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 2: GIẢI BÀI                                      */}
        {/* ========================================================= */}
        <section
          id="section-solver"
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 scroll-mt-20"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <Wand2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">Giải toán & Tự luận</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  Menu "Giải bài" – Hướng Dẫn Từng Bước Chuẩn Mực
                </h2>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('solver')}
              className="px-4 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <span>Mở tab Giải bài</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <p>
              Module <strong>Giải bài</strong> được thiết kế theo đúng phương pháp giảng dạy sư phạm Tiểu học hiện hành:
              <strong> tuyệt đối không chỉ đưa đáp số trống không</strong>, mà dẫn dắt học sinh qua 4 bước tư duy:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-violet-700 text-xs">Bước 1</div>
                <div className="font-extrabold text-slate-900 text-sm">Tóm Tắt Đề Bài</div>
                <p className="text-[11px] text-slate-500">Ghi lại đại lượng đã cho và đại lượng cần tìm kiếm.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-violet-700 text-xs">Bước 2</div>
                <div className="font-extrabold text-slate-900 text-sm">Phân Tích Cách Giải</div>
                <p className="text-[11px] text-slate-500">Vẽ sơ đồ đoạn thẳng hoặc lập luận mối quan hệ.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-violet-700 text-xs">Bước 3</div>
                <div className="font-extrabold text-slate-900 text-sm">Bài Giải Chi Tiết</div>
                <p className="text-[11px] text-slate-500">Câu lời giải chuẩn, phép tính có đơn vị đo rõ ràng.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-violet-700 text-xs">Bước 4</div>
                <div className="font-extrabold text-slate-900 text-sm">Đáp Số & Ghi Nhớ</div>
                <p className="text-[11px] text-slate-500">Đáp số chính xác kèm quy tắc cần khắc sâu.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-violet-50/70 border border-violet-100 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-600" />
                <span>
                  <strong>Thanh ký hiệu toán học Tiểu học:</strong> Tích hợp sẵn nút chèn phân số, phép nhân (×),
                  chia (:), diện tích (cm²), khối lượng (kg) giúp bé nhập đề bài nhanh chóng!
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 3: ÔN BÀI THEO CHỦ ĐỀ                            */}
        {/* ========================================================= */}
        <section
          id="section-review"
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 scroll-mt-20"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <BookOpenCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Hệ thống hóa kiến thức</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  Menu "Ôn bài" – Đề Cương Tóm Tắt & Sơ Đồ Tư Duy
                </h2>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('review')}
              className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <span>Mở tab Ôn bài</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 text-sm">Các nội dung cung cấp khi ôn bài:</h3>
              <ul className="space-y-2 list-disc list-inside">
                <li>
                  <strong>Trọng tâm lý thuyết:</strong> Các khái niệm cốt lõi, bảng công thức, mẹo ghi nhớ nhanh.
                </li>
                <li>
                  <strong>Ví dụ minh họa tiểu học:</strong> Các ví dụ gắn liền với đồ vật, quả táo, que tính gần gũi.
                </li>
                <li>
                  <strong>Bài tập tự luyện kèm đáp án:</strong> Các câu hỏi trắc nghiệm và tự luận để bé kiểm tra mức độ
                  hiểu bài của mình.
                </li>
                <li>
                  <strong>Sơ đồ tóm tắt ghi nhớ:</strong> Trực quan hóa cấu trúc bài học thành các nhánh ghi nhớ.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 text-sm">Chủ đề đề xuất theo từng môn:</h3>
              <p>
                Hệ thống đề xuất các chuyên đề hay thi như: <em>Bảng cửu chương, Tìm hai số khi biết Tổng và Hiệu, Phân số,
                Phân biệt chính tả l/n, Từ ghép & từ láy, Đời sống thực vật, Các triều đại lịch sử Việt Nam</em>.
              </p>
              <p>
                Nút <strong>"Làm mới"</strong> giúp xóa chủ đề đang hiển thị để nhập chủ đề mới chỉ trong 1 thao tác.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 4: TRẮC NGHIỆM & TẠO ĐỀ                          */}
        {/* ========================================================= */}
        <section
          id="section-quiz"
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 scroll-mt-20"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Đánh giá & Khảo thí</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  Menu "Trắc nghiệm & Tạo đề" – Chấm Điểm & Ngân Hàng Đề Thi
                </h2>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('quiz')}
              className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <span>Mở tab Trắc nghiệm</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <span>Dành Cho Học Sinh (Làm Bài Thi)</span>
              </h3>
              <ul className="space-y-1.5 list-disc list-inside">
                <li>Lựa chọn môn học, khối lớp và chủ đề muốn luyện tập.</li>
                <li>Làm bài trắc nghiệm có đồng hồ bấm giờ tính thời gian.</li>
                <li>Chấm điểm tự động trên thang điểm 10, hiển thị đáp án đúng và lời giải thích chi tiết từng câu.</li>
                <li>
                  Tự động phát hiện <strong>lỗ hổng kiến thức</strong> (các câu làm sai) và lưu vào hồ sơ cá nhân.
                </li>
                <li>
                  <strong>Tự động lưu điểm sang Google Sheets:</strong> Mọi bài nộp được tự động ghi vào sheet{' '}
                  <code>LichSuQuiz</code> trong nền!
                </li>
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
              <h3 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <span>Dành Cho Giáo Viên (Soạn Đề & Ngân Hàng Đề)</span>
              </h3>
              <ul className="space-y-1.5 list-disc list-inside text-emerald-950">
                <li>
                  Bật công tắc <strong>"Chế độ Giáo viên soạn đề"</strong>.
                </li>
                <li>
                  Dùng trợ lý AI sinh đề thi ma trận chuẩn theo chủ đề hoặc tự chỉnh sửa từng câu hỏi, đáp án A-B-C-D.
                </li>
                <li>
                  Nhấn <strong>"Lưu vào Ngân hàng đề thi"</strong>: đề thi được ghi trực tiếp vào Google Sheets tab{' '}
                  <code>NganHangDeThi</code>.
                </li>
                <li>Đề thi trong ngân hàng sẽ hiển thị cho học sinh trên toàn trường cùng tham gia luyện tập!</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 5: TIẾN ĐỘ HỌC TẬP                               */}
        {/* ========================================================= */}
        <section
          id="section-progress"
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 scroll-mt-20"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Theo dõi & Thống kê</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  Menu "Tiến độ học tập" – Biểu Đồ & Lỗ Hổng Kiến Thức
                </h2>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('progress')}
              className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <span>Mở tab Tiến độ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Điểm XP & Streak</span>
              </div>
              <p className="text-slate-600 text-xs">
                Tích lũy điểm kinh nghiệm mỗi khi hoàn thành bài hỏi đáp, giải toán hay làm bài thi. Chuỗi ngày học
                liên tục (Streak) giúp rèn luyện thói quen tự học hàng ngày.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Lỗ Hổng Kiến Thức</span>
              </div>
              <p className="text-slate-600 text-xs">
                Hệ thống tự động ghi nhận các chủ đề học sinh hay trả lời sai trong bài trắc nghiệm. Khi bé đã luyện tập
                và tự tin nắm vững, có thể bấm "Đã nắm vững" để hoàn tất.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Lịch Sử Bài Thi</span>
              </div>
              <p className="text-slate-600 text-xs">
                Xem lại danh sách tất cả các bài kiểm tra đã làm, xem điểm số, số câu đúng/sai và có đường dẫn mở trực tiếp
                bảng tính Google Sheets để xem điểm tổng thể.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 6: QUẢN TRỊ ADMIN                                */}
        {/* ========================================================= */}
        <section
          id="section-admin"
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 scroll-mt-20"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Đặc quyền quản trị (Chỉ Admin)</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  Menu "Quản trị" (Admin Panel) – Cấu Hình Ứng Dụng & Quản Trị Hệ Thống
                </h2>
              </div>
            </div>

            {currentUser?.role === 'admin' ? (
              <button
                onClick={() => setActiveTab('admin')}
                className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <span>Mở tab Quản trị</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold">
                🔒 Dành riêng cho Admin
              </span>
            )}
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                <strong>Bảo mật phân quyền:</strong> Chỉ có Quản trị viên (Admin) sau khi nhập đúng thông tin đăng nhập mới có quyền xem cấu hình link Google Sheets, xem danh sách học sinh và giáo viên, đổi mật khẩu và xem mã Apps Script chuẩn.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span>Cấu Hình Link Google Sheet (Chỉ Admin)</span>
                </div>
                <p className="text-xs text-slate-600">
                  Nơi Admin gắn đường link Web App Google Apps Script để làm database duy nhất. Học sinh và giáo viên không được xem hoặc chỉnh sửa liên kết này.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Danh Sách Học Sinh & Giáo Viên (Chỉ Admin)</span>
                </div>
                <p className="text-xs text-slate-600">
                  Quản lý danh sách toàn bộ người dùng đăng ký, đặt lại mật khẩu theo ID duy nhất, cập nhật phân quyền (Admin, Giáo viên, Học sinh).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Code className="w-4 h-4 text-indigo-600" />
                  <span>Mã Apps Script Chuẩn (Chỉ Admin)</span>
                </div>
                <p className="text-xs text-slate-600">
                  Cung cấp mã nguồn Google Apps Script (.gs) hoàn chỉnh chuẩn hóa cho Google Sheet. Chỉ Admin mới được xem và sao chép.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 7: TÀI KHOẢN, ĐĂNG NHẬP, ĐĂNG XUẤT, ĐỔI MẬT KHẨU */}
        {/* ========================================================= */}
        <section
          id="section-auth"
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 scroll-mt-20"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center font-bold">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-pink-600 uppercase tracking-wider">Xác thực an toàn</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  Tài Khoản: Đăng Nhập, Đăng Xuất & Đổi Mật Khẩu
                </h2>
              </div>
            </div>

            {onOpenAuth && (
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <span>Mở cửa sổ Tài khoản</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm text-slate-600">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900 text-sm">1. Đăng Ký & Đăng Nhập</h3>
              <p>
                Hỗ trợ 3 vai trò: <strong>Học sinh, Giáo viên, Quản trị viên</strong>. Khi đăng ký, tài khoản được tự
                động ghi trực tiếp vào Google Sheets (sheet <code>TaiKhoan</code>).
              </p>
              <p className="text-[11px] text-slate-500">
                Tài khoản Quản trị viên (Admin) được cấp quyền riêng biệt cho Ban Quản trị nhà trường để bảo mật hệ thống.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900 text-sm">2. Đổi Mật Khẩu Tức Thì</h3>
              <p>
                Người dùng có thể đổi mật khẩu bất kỳ lúc nào tại tab <em>Hồ sơ</em> hoặc được Admin đặt lại tại Admin
                Panel.
              </p>
              <p className="font-semibold text-emerald-700 text-xs">
                ✓ Mật khẩu mới được lưu và đồng bộ trực tiếp lên Google Sheets cho lần đăng nhập sau.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900 text-sm">3. Đăng Xuất & Bảo Toàn Dữ Liệu</h3>
              <p>
                Khi bấm <strong>Đăng xuất</strong>, app chuyển về chế độ Khách an toàn.
              </p>
              <p className="font-semibold text-indigo-700 text-xs">
                ✓ Dữ liệu đã lưu trên Google Sheets được giữ nguyên 100%, không bị xóa hay mất mát khi đăng nhập lại!
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 8: 6 NGUYÊN TẮC LƯU TRỮ GOOGLE SHEETS            */}
        {/* ========================================================= */}
        <section
          id="section-principles"
          className="bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-emerald-500/30 shadow-lg space-y-6 scroll-mt-20"
        >
          <div className="flex items-start justify-between gap-4 border-b border-emerald-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center font-bold">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  Quy chuẩn kỹ thuật bắt buộc
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  6 Nguyên Tắc Bắt Buộc Về Lưu Trữ Dữ Liệu
                </h2>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>GOOGLE SHEETS = DATABASE DUY NHẤT</span>
            </div>
          </div>

          {currentUser?.role === 'admin' ? (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-emerald-300 font-bold">Link Google Sheet lưu trữ dữ liệu hiện tại (Chỉ Admin):</span>
                <button
                  onClick={handleCopySheetLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 font-mono text-[11px] transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Đã sao chép' : 'Sao chép link'}</span>
                </button>
              </div>
              <div className="font-mono text-xs text-slate-300 break-all bg-black/30 p-2.5 rounded-xl border border-white/5">
                {currentSheetUrl}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 text-xs text-slate-300">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                <strong>Bảo mật thông tin:</strong> Vị trí cấu hình liên kết Google Sheets và mã Apps Script chỉ hiển thị cho Quản trị viên (Admin) trong mục Quản trị.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-200">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="font-bold text-emerald-300 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/30 text-emerald-200 flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>Google Sheets là nguồn dữ liệu duy nhất</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Toàn bộ dữ liệu mẫu, dữ liệu tự động tạo, dữ liệu hard-code trên App đã được loại bỏ. Khi mở App hoặc
                reload, dữ liệu được đọc trực tiếp từ Google Sheets.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="font-bold text-emerald-300 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/30 text-emerald-200 flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>Ghi trực tiếp & Đọc lại dữ liệu mới</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Khi Admin/GV/HS thêm hoặc chỉnh sửa dữ liệu và nhấn Lưu/Xác nhận, dữ liệu được ghi trực tiếp vào Google
                Sheets và App cập nhật lại trạng thái mới nhất ngay lập tức.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="font-bold text-emerald-300 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/30 text-emerald-200 flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>Không được tự ý xóa dữ liệu</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Dữ liệu đã được Admin/GV/HS tạo và lưu phải được giữ nguyên khi reload App, đăng xuất, đăng nhập lại hoặc
                mở App lần sau trên mọi thiết bị.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="font-bold text-emerald-300 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/30 text-emerald-200 flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <span>Cập nhật đúng bản ghi theo ID duy nhất</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Khi chỉnh sửa (đổi mật khẩu, đổi vai trò, cập nhật tiến độ), hệ thống chỉ cập nhật đúng bản ghi được chọn
                dựa trên ID duy nhất, không được xóa rồi ghi lại toàn bộ Sheet và không ghi đè các bản ghi khác.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="font-bold text-emerald-300 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/30 text-emerald-200 flex items-center justify-center text-xs font-bold">
                  5
                </span>
                <span>Bảo vệ an toàn khi mất kết nối</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Nếu Google Sheets/API gặp sự cố mạng hoặc dữ liệu tải chưa đầy đủ, hệ thống có chốt an toàn ngăn chặn
                tuyệt đối việc ghi đè rỗng hoặc xóa dữ liệu trên Google Sheets.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="font-bold text-emerald-300 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/30 text-emerald-200 flex items-center justify-center text-xs font-bold">
                  6
                </span>
                <span>Không dùng dữ liệu tạm làm nguồn chính</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Không dùng localStorage, sessionStorage hoặc bộ nhớ tạm làm nguồn dữ liệu chính. Toàn bộ tiến trình tuân
                thủ quy tắc: <strong>ĐỌC ➔ HIỂN THỊ ➔ THÊM/SỬA ➔ LƯU VÀO GOOGLE SHEETS</strong>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
