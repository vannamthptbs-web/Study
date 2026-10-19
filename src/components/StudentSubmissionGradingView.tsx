import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  GraduationCap,
  Calendar,
  User,
  Camera,
  FolderOpen,
  ExternalLink,
  ChevronRight,
  RotateCcw,
  Save,
  Eye,
  X,
  Sparkles,
  BookOpenCheck,
  Check,
  Award,
  Layers,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuizSubmissionResult, Grade, Subject, UserProfile } from '../types/study';
import { getAllQuizHistory, updateQuizSubmissionGrading } from '../services/storage';
import { STUDENT_SUBMISSION_DRIVE_FOLDER_URL } from '../services/firebaseWorkspace';
import { MarkdownContent } from './MarkdownContent';
import { GRADES, SUBJECTS } from '../data/subjects';

interface Props {
  currentUser: UserProfile;
  onNotification: (msg: string) => void;
  onSelectQuizToView?: (quizId: string) => void;
}

export const StudentSubmissionGradingView: React.FC<Props> = ({
  currentUser,
  onNotification,
}) => {
  const [submissions, setSubmissions] = useState<QuizSubmissionResult[]>(() => getAllQuizHistory());
  const [selectedSubmission, setSelectedSubmission] = useState<QuizSubmissionResult | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'graded'>('pending');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Grading form state for selected submission
  const [editingScore, setEditingScore] = useState<number>(0);
  const [editingTeacherFeedback, setEditingTeacherFeedback] = useState<string>('');
  const [editingEssayFeedback, setEditingEssayFeedback] = useState<Record<number, { score: number; comment: string }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Photo zoom modal
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; name: string } | null>(null);

  // Refresh submissions list
  const refreshList = () => {
    const list = getAllQuizHistory();
    setSubmissions(list);
  };

  // Select a submission to grade
  const handleOpenGrading = (sub: QuizSubmissionResult) => {
    setSelectedSubmission(sub);

    // Initialize grading inputs with existing data or sensible defaults
    const essayMap: Record<number, { score: number; comment: string }> = {};
    let initialTotalScore = sub.score || 0;

    if (sub.essayQuestions && sub.essayQuestions.length > 0) {
      sub.essayQuestions.forEach((eq) => {
        const existing = sub.essayFeedback?.[eq.id];
        if (existing) {
          essayMap[eq.id] = { ...existing };
        } else {
          // If not graded yet, start with blank or full points based on student answer presence
          const studentAns = sub.essayAnswers?.[eq.id] || '';
          essayMap[eq.id] = {
            score: studentAns.trim() ? Number((eq.points || 5).toFixed(1)) : 0,
            comment: '',
          };
        }
      });
    }

    setEditingEssayFeedback(essayMap);
    setEditingScore(initialTotalScore > 0 ? initialTotalScore : 10);
    setEditingTeacherFeedback(
      sub.teacherFeedback ||
        (sub.status === 'graded'
          ? 'Bài làm tốt, chữ viết rõ ràng và tính toán chính xác.'
          : 'Thầy/Cô khen ngợi tinh thần làm bài tích cực của con!')
    );
  };

  // Close grading modal
  const handleCloseGrading = () => {
    setSelectedSubmission(null);
  };

  // Recalculate total score when essay item score changes
  const handleEssayScoreChange = (qId: number, newScore: number) => {
    setEditingEssayFeedback((prev) => {
      const updated = {
        ...prev,
        [qId]: {
          score: newScore,
          comment: prev[qId]?.comment || '',
        },
      };

      // If mixed or essay exam, recalculate suggested total score
      if (selectedSubmission) {
        const mcqCount = selectedSubmission.questions?.length || 0;
        const essayCount = selectedSubmission.essayQuestions?.length || 0;

        let totalEssayEarned = 0;
        let totalEssayMax = 0;
        selectedSubmission.essayQuestions?.forEach((eq) => {
          totalEssayMax += eq.points || 5;
          totalEssayEarned += (eq.id === qId ? newScore : updated[eq.id]?.score || 0);
        });

        if (mcqCount > 0 && essayCount > 0) {
          const mcqPart = (selectedSubmission.correctCount / mcqCount) * 5;
          const essayPart = totalEssayMax > 0 ? (totalEssayEarned / totalEssayMax) * 5 : 5;
          setEditingScore(Math.round((mcqPart + essayPart) * 10) / 10);
        } else if (essayCount > 0 && totalEssayMax > 0) {
          setEditingScore(Math.round(((totalEssayEarned / totalEssayMax) * 10) * 10) / 10);
        }
      }

      return updated;
    });
  };

  const handleEssayCommentChange = (qId: number, comment: string) => {
    setEditingEssayFeedback((prev) => ({
      ...prev,
      [qId]: {
        score: prev[qId]?.score || 0,
        comment,
      },
    }));
  };

  // Save grade
  const handleSaveGrading = async () => {
    if (!selectedSubmission) return;

    setIsSaving(true);
    try {
      const updated = updateQuizSubmissionGrading(selectedSubmission.id, {
        score: editingScore,
        teacherFeedback: editingTeacherFeedback.trim(),
        essayFeedback: editingEssayFeedback,
        gradedBy: currentUser.name || 'Thầy/Cô giáo',
      });

      if (updated) {
        refreshList();
        setSelectedSubmission(updated);
        onNotification(`Đã chấm điểm thành công cho học sinh ${updated.userName}: ${editingScore}/10 điểm! 🌟`);

        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
          });
        } catch {}
      }
    } catch (e) {
      console.error(e);
      onNotification('Lỗi khi lưu điểm. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick feedback chip helper
  const handleAddQuickComment = (qId: number, phrase: string) => {
    const current = editingEssayFeedback[qId]?.comment || '';
    const updated = current ? `${current}. ${phrase}` : phrase;
    handleEssayCommentChange(qId, updated);
  };

  // Filtered list
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // Status
      const isPending = sub.status === 'pending_grading';
      if (statusFilter === 'pending' && !isPending) return false;
      if (statusFilter === 'graded' && isPending) return false;

      // Grade
      if (gradeFilter !== 'all' && sub.grade !== gradeFilter) return false;

      // Subject
      if (subjectFilter !== 'all' && sub.subject !== subjectFilter) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (sub.userName || '').toLowerCase().includes(q);
        const topicMatch = (sub.topic || '').toLowerCase().includes(q);
        const emailMatch = (sub.userEmail || '').toLowerCase().includes(q);
        if (!nameMatch && !topicMatch && !emailMatch) return false;
      }

      return true;
    });
  }, [submissions, statusFilter, gradeFilter, subjectFilter, searchQuery]);

  // Statistics
  const pendingCount = useMemo(() => {
    return submissions.filter((s) => s.status === 'pending_grading').length;
  }, [submissions]);

  const gradedCount = useMemo(() => {
    return submissions.filter((s) => s.status === 'graded').length;
  }, [submissions]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-amber-700 via-orange-700 to-indigo-900 text-white rounded-3xl p-6 sm:p-8 shadow-md">
        <div className="max-w-4xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold text-amber-200 border border-white/10">
              <ClipboardCheck className="w-4 h-4 text-amber-300" />
              <span>Góc Chấm Bài Của Thầy/Cô • Không Sử Dụng AI Chấm Tự Động</span>
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black shadow-xs">
              <span>{pendingCount} bài chờ chấm</span>
            </span>
          </div>

          <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">
            Quản lý & Chấm bài học sinh nộp
          </h2>
          <p className="text-amber-100 text-xs sm:text-sm leading-relaxed max-w-3xl">
            Thầy/Cô trực tiếp xem bài làm trắc nghiệm, bài giải tự luận và <strong>ảnh chụp bài viết tay trên vở</strong> của học sinh để chấm điểm, nhận xét chi tiết và trả điểm cho học sinh. Kết quả sẽ được tự động đồng bộ vào Google Sheets.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
            <a
              href={STUDENT_SUBMISSION_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold transition-all shadow-2xs"
            >
              <FolderOpen className="w-4 h-4 text-amber-300" />
              <span>Mở thư mục Google Drive chứa ảnh bài làm</span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-200" />
            </a>

            <button
              type="button"
              onClick={refreshList}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-semibold transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Làm mới danh sách</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng bài đã nộp</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{submissions.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <ClipboardCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-amber-200 shadow-xs flex items-center justify-between ring-1 ring-amber-300/60">
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Chờ Thầy/Cô chấm</p>
            <p className="text-2xl font-black text-amber-600 mt-1 flex items-center gap-2">
              <span>{pendingCount}</span>
              {pendingCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping inline-block" />
              )}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Đã hoàn thành chấm</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{gradedCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Filters and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Status Tab buttons */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Chờ chấm điểm ({pendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('graded')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'graded'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Đã chấm điểm ({gradedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả bài nộp ({submissions.length})
          </button>
        </div>

        {/* Grade & Subject dropdowns and Search */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Tất cả khối lớp</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Tất cả môn học</option>
            {SUBJECTS.slice(0, 5).map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên học sinh, đề..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 4. Submissions Table / Cards */}
      {filteredSubmissions.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <h4 className="font-extrabold text-slate-700 text-sm sm:text-base">
            Không tìm thấy bài nộp nào
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {statusFilter === 'pending'
              ? 'Tuyệt vời! Hiện tại không còn bài thi nào đang chờ chấm điểm.'
              : 'Hãy thay đổi bộ lọc hoặc đợi học sinh nộp bài thi mới.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubmissions.map((sub) => {
            const isPending = sub.status === 'pending_grading';
            const photoCount = sub.submittedPhotos?.length || 0;
            const essayCount = sub.essayQuestions?.length || 0;
            const mcqCount = sub.questions?.length || 0;

            return (
              <div
                key={sub.id}
                className={`rounded-2xl p-5 border transition-all flex flex-col justify-between space-y-4 group bg-white shadow-2xs hover:shadow-md ${
                  isPending
                    ? 'border-amber-300 ring-1 ring-amber-200/80 hover:border-amber-400'
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div className="space-y-3">
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {sub.subject} • {sub.grade}
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1 ${
                        isPending
                          ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isPending ? (
                        <>
                          <Clock className="w-3 h-3" />
                          <span>Chờ Thầy/Cô chấm</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Đã chấm: {sub.score}/10đ</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Student name and topic */}
                  <div>
                    <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>{sub.userName || 'Học sinh'}</span>
                    </h4>
                    <p className="text-xs font-semibold text-slate-700 mt-1 line-clamp-1">
                      {sub.topic}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Nộp lúc: {new Date(sub.timestamp).toLocaleString('vi-VN')}
                    </p>
                  </div>

                  {/* Exam details & photo count */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                      {mcqCount > 0 ? `${mcqCount} câu TN` : ''}
                      {mcqCount > 0 && essayCount > 0 ? ' + ' : ''}
                      {essayCount > 0 ? `${essayCount} câu TL` : ''}
                    </span>

                    {photoCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 font-bold border border-sky-200 flex items-center gap-1">
                        <Camera className="w-3 h-3 text-sky-600" />
                        <span>{photoCount} ảnh bài làm</span>
                      </span>
                    )}

                    {sub.gradedBy && (
                      <span className="text-emerald-700 font-semibold block w-full mt-1">
                        GV chấm: <strong>{sub.gradedBy}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Action button */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleOpenGrading(sub)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                      isPending
                        ? 'bg-amber-600 hover:bg-amber-700 text-white hover:scale-101'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-101'
                    }`}
                  >
                    <span>{isPending ? 'Chấm bài ngay ✍️' : 'Xem & Sửa điểm 📝'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Teacher Grading Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                    Chấm bài trực tiếp
                  </span>
                  <span className="text-xs text-slate-300 font-bold">
                    {selectedSubmission.subject} • {selectedSubmission.grade}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                  <span>Học sinh: {selectedSubmission.userName}</span>
                  <span className="text-xs text-slate-300 font-normal">
                    (Nộp lúc {new Date(selectedSubmission.timestamp).toLocaleString('vi-VN')})
                  </span>
                </h3>
              </div>

              <button
                type="button"
                onClick={handleCloseGrading}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Notice that AI is NOT auto-grading */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Lưu ý nghiệp vụ sư phạm:</strong> Hệ thống không sử dụng AI chấm điểm tự động. Thầy/Cô trực tiếp đánh giá câu trả lời, lời giải và đối chiếu ảnh chụp bài làm viết tay của học sinh để cho điểm.
                </span>
              </div>

              {/* PART 1: Trắc nghiệm (nếu có) */}
              {selectedSubmission.questions && selectedSubmission.questions.length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                        I
                      </span>
                      <span>Phần Trắc Nghiệm ({selectedSubmission.questions.length} câu)</span>
                    </h4>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                      Đúng {selectedSubmission.correctCount}/{selectedSubmission.questions.length} câu
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedSubmission.questions.map((q, idx) => {
                      const studentChoice = selectedSubmission.userAnswers?.[q.id] || '';
                      const isCorrect = studentChoice.toUpperCase() === (q.correctAnswer || '').toUpperCase();

                      return (
                        <div key={q.id} className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-slate-800">
                              Câu {idx + 1}: <MarkdownContent content={q.question} compact={true} />
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md font-extrabold shrink-0 ${
                                isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isCorrect ? 'Đúng (+1đ)' : 'Sai'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 pt-1">
                            <span>
                              Học sinh chọn: <strong className={isCorrect ? 'text-emerald-700' : 'text-rose-600'}>{studentChoice || 'Chưa chọn'}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Đáp án chuẩn: <strong className="text-emerald-700">{q.correctAnswer}</strong>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PART 2: Tự luận và Ảnh bài làm của học sinh */}
              {selectedSubmission.essayQuestions && selectedSubmission.essayQuestions.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                        II
                      </span>
                      <span>Phần Tự Luận & Chấm Bài Của Thầy/Cô ({selectedSubmission.essayQuestions.length} câu)</span>
                    </h4>
                  </div>

                  <div className="space-y-6">
                    {selectedSubmission.essayQuestions.map((eq, eIdx) => {
                      const studentAns = selectedSubmission.essayAnswers?.[eq.id] || '';
                      const currentGrading = editingEssayFeedback[eq.id] || { score: eq.points || 5, comment: '' };
                      const questionPhotos = selectedSubmission.submittedPhotos?.filter((p) => p.questionId === eq.id) || [];

                      return (
                        <div key={eq.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                          {/* Question header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Câu Tự Luận {eIdx + 1} (Tối đa {eq.points || 5} điểm)
                              </span>
                              <div className="text-sm font-bold text-slate-900 pt-1">
                                <MarkdownContent content={eq.question} compact={true} />
                              </div>
                            </div>
                          </div>

                          {/* Reference Sample Answer & Rubric for Teacher */}
                          <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                              <BookOpenCheck className="w-4 h-4 text-indigo-600" />
                              Đáp án mẫu & Barem điểm chuẩn của Thầy/Cô:
                            </span>
                            <div className="text-slate-600 leading-relaxed">
                              <MarkdownContent content={eq.sampleAnswer} />
                            </div>
                            {eq.rubric && (
                              <p className="text-[11px] text-slate-500 italic border-t border-slate-100 pt-1">
                                Barem: {eq.rubric}
                              </p>
                            )}
                          </div>

                          {/* Student's Typed Solution */}
                          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs space-y-1">
                            <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                              <span>✍️ Bài giải học sinh gõ trên máy:</span>
                            </span>
                            {studentAns ? (
                              <p className="text-slate-800 whitespace-pre-wrap font-medium leading-relaxed bg-white p-3 rounded-lg border border-indigo-100">
                                {studentAns}
                              </p>
                            ) : (
                              <p className="text-slate-400 italic">Học sinh không nhập bài gõ trên máy (kiểm tra ảnh bài làm viết tay bên dưới).</p>
                            )}
                          </div>

                          {/* Student's Attached Photos for this question */}
                          {questionPhotos.length > 0 && (
                            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs space-y-2">
                              <span className="font-bold text-sky-950 flex items-center gap-1.5">
                                <Camera className="w-4 h-4 text-sky-600" />
                                <span>Ảnh bài làm viết tay học sinh đính kèm cho câu này ({questionPhotos.length} ảnh):</span>
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                {questionPhotos.map((photo) => (
                                  <div
                                    key={photo.id}
                                    className="relative group rounded-xl overflow-hidden border border-slate-300 bg-white shadow-2xs hover:scale-102 transition-transform cursor-pointer"
                                    onClick={() => setZoomPhoto({ url: photo.previewUrl || `data:${photo.mimeType};base64,${photo.data}`, name: photo.name })}
                                  >
                                    <img
                                      src={photo.previewUrl || `data:${photo.mimeType};base64,${photo.data}`}
                                      alt={photo.name}
                                      className="w-full h-24 object-cover"
                                    />
                                    <div className="p-1.5">
                                      <p className="text-[10px] font-semibold text-slate-700 truncate">{photo.name}</p>
                                    </div>
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                      <Eye className="w-4 h-4 mr-1" />
                                      <span>Phóng to</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Teacher's Grading Controls for this question */}
                          <div className="p-4 rounded-xl bg-white border border-amber-300 ring-1 ring-amber-200/70 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                                <span>🎯 Điểm số cho câu {eIdx + 1} (Tối đa {eq.points || 5}đ):</span>
                              </label>

                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={eq.points || 5}
                                  step={0.25}
                                  value={currentGrading.score}
                                  onChange={(e) => handleEssayScoreChange(eq.id, parseFloat(e.target.value) || 0)}
                                  className="w-20 px-3 py-1.5 rounded-xl border border-amber-400 font-black text-amber-900 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                                <span className="text-xs font-bold text-slate-500">/ {eq.points || 5} điểm</span>
                              </div>
                            </div>

                            {/* Comment textarea */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Lời nhận xét của Thầy/Cô cho câu này:
                              </label>
                              <textarea
                                rows={2}
                                value={currentGrading.comment}
                                onChange={(e) => handleEssayCommentChange(eq.id, e.target.value)}
                                placeholder="Nhập nhận xét cụ thể (ví dụ: Lời giải đúng, phép tính cẩn thận, cần chú ý đơn vị đo...)"
                                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                              />
                            </div>

                            {/* Quick praise/comment tags */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[10px] font-bold text-slate-400">Gợi ý nhanh:</span>
                              {[
                                'Lời giải rất tốt 👏',
                                'Tính toán chính xác 💯',
                                'Chữ viết sạch đẹp 🌟',
                                'Cần ghi rõ đơn vị đo ⚠️',
                                'Bài giải chưa hoàn thiện 📝',
                              ].map((phrase) => (
                                <button
                                  key={phrase}
                                  type="button"
                                  onClick={() => handleAddQuickComment(eq.id, phrase)}
                                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-amber-100 text-slate-700 text-[10px] font-semibold transition-colors"
                                >
                                  + {phrase}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ALL PHOTOS (If student submitted photos not attached to specific question) */}
              {selectedSubmission.submittedPhotos && selectedSubmission.submittedPhotos.length > 0 && (
                <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-sky-600" />
                      <span>Toàn bộ ảnh bài làm học sinh chụp ({selectedSubmission.submittedPhotos.length} ảnh)</span>
                    </h4>
                    <a
                      href={STUDENT_SUBMISSION_DRIVE_FOLDER_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-sky-50 text-sky-800 text-xs font-bold hover:bg-sky-100 border border-sky-200"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-sky-600" />
                      <span>Xem thư mục Drive</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {selectedSubmission.submittedPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all group"
                        onClick={() => setZoomPhoto({ url: photo.previewUrl || `data:${photo.mimeType};base64,${photo.data}`, name: photo.name })}
                      >
                        <img
                          src={photo.previewUrl || `data:${photo.mimeType};base64,${photo.data}`}
                          alt={photo.name}
                          className="w-full h-24 object-cover"
                        />
                        <p className="p-1.5 text-[10px] font-semibold text-slate-700 truncate">{photo.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PART 3: Overall Final Score & Evaluation */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-600" />
                      <span>Điểm Tổng Kết Của Thầy/Cô (Thang điểm 10)</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Điểm này sẽ hiển thị trực tiếp cho học sinh và đồng bộ vào Google Sheets.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={editingScore}
                      onChange={(e) => setEditingScore(parseFloat(e.target.value) || 0)}
                      className="w-24 px-3 py-2 rounded-xl border border-amber-400 bg-white font-black text-xl text-amber-900 text-center shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-sm font-black text-slate-600">/ 10 điểm</span>
                  </div>
                </div>

                {/* Overall Teacher Feedback */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Lời phê & Đánh giá chung của Thầy/Cô:
                  </label>
                  <textarea
                    rows={3}
                    value={editingTeacherFeedback}
                    onChange={(e) => setEditingTeacherFeedback(e.target.value)}
                    placeholder="Viết lời phê, khích lệ và hướng dẫn bổ trợ cho học sinh..."
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer (Sticky action bar) */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={handleCloseGrading}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Đóng lại
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveGrading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all hover:scale-102 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Đang lưu điểm...' : 'Xác nhận chấm điểm & Trả bài cho học sinh'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Zoom Modal */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[92vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 text-white flex items-center justify-between text-xs font-bold border-b border-slate-800">
              <span className="truncate pr-4">{zoomPhoto.name}</span>
              <button
                type="button"
                onClick={() => setZoomPhoto(null)}
                className="p-1 rounded-lg hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center bg-slate-950">
              <img
                src={zoomPhoto.url}
                alt={zoomPhoto.name}
                className="max-h-[80vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
