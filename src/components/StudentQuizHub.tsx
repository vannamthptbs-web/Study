import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Sparkles,
  Timer,
  Award,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  BookOpenCheck,
  Check,
  X,
  Target,
  FileText,
  Layers,
  Search,
  Filter,
  GraduationCap,
  User,
  Sheet,
  Download,
  Calendar,
  Lock,
  Camera,
  Image as ImageIcon,
  ExternalLink,
  Trash2,
  Eye,
  UploadCloud,
  FolderOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Grade,
  Subject,
  SavedBankQuiz,
  QuizQuestion,
  EssayQuestion,
  QuizSubmissionResult,
  UserProfile,
  SubmittedPhotoFile,
} from '../types/study';
import { SUBJECTS, GRADES } from '../data/subjects';
import { getBankQuizzes, saveQuizResult } from '../services/storage';
import {
  autoSyncQuiz,
  syncQuizResult,
  getSpreadsheetUrl,
  STUDENT_SUBMISSION_DRIVE_FOLDER_URL,
  STUDENT_SUBMISSION_DRIVE_FOLDER_ID,
  uploadSubmissionPhoto,
} from '../services/firebaseWorkspace';
import { gradeEssayWithAI } from '../services/api';
import { MarkdownContent } from './MarkdownContent';
import { FormulaToolbar } from './FormulaToolbar';

interface Props {
  selectedGrade: Grade;
  setSelectedGrade: (grade: Grade) => void;
  selectedSubject: Subject;
  setSelectedSubject: (subject: Subject) => void;
  currentUser: UserProfile;
  onQuizCompleted: (result: QuizSubmissionResult) => void;
  onNotification: (msg: string) => void;
  onOpenAuth?: () => void;
  selectedBankQuiz?: SavedBankQuiz | null;
  onClearSelectedBankQuiz?: () => void;
}

export const StudentQuizHub: React.FC<Props> = ({
  selectedGrade,
  setSelectedGrade,
  selectedSubject,
  setSelectedSubject,
  currentUser,
  onQuizCompleted,
  onNotification,
  onOpenAuth,
  selectedBankQuiz,
  onClearSelectedBankQuiz,
}) => {
  // Bank list
  const [bankList, setBankList] = useState<SavedBankQuiz[]>(getBankQuizzes());
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active quiz being taken by student
  const [activeQuiz, setActiveQuiz] = useState<SavedBankQuiz | null>(null);

  // Test state
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<number, string>>({});
  const [essayFeedback, setEssayFeedback] = useState<Record<number, { score: number; comment: string }>>({});
  const [isGradingEssay, setIsGradingEssay] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizSubmissionResult | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Photo attachments for student answer submission (Google Drive)
  const [submittedPhotos, setSubmittedPhotos] = useState<SubmittedPhotoFile[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState<{ url: string; name: string } | null>(null);

  // Timer
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Handle photo upload / camera capture
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, questionId?: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingPhoto(true);
    const newPhotos: SubmittedPhotoFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const rawBase64 = base64.includes(',') ? base64.split(',')[1] : base64;

        const photoItem: SubmittedPhotoFile = {
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name || `AnhBaiLam_${submittedPhotos.length + newPhotos.length + 1}.jpg`,
          mimeType: file.type || 'image/jpeg',
          data: rawBase64,
          previewUrl: base64,
          driveFolderUrl: STUDENT_SUBMISSION_DRIVE_FOLDER_URL,
          driveFolderId: STUDENT_SUBMISSION_DRIVE_FOLDER_ID,
          uploadedAt: Date.now(),
          questionId,
        };

        newPhotos.push(photoItem);
      } catch (readErr) {
        console.warn('Lỗi đọc ảnh bài làm:', readErr);
      }
    }

    if (newPhotos.length > 0) {
      setSubmittedPhotos((prev) => [...prev, ...newPhotos]);
      onNotification(`Đã đính kèm ${newPhotos.length} ảnh bài làm! Hệ thống sẽ lưu vào Google Drive khi nộp.`);
    }

    setIsUploadingPhoto(false);
    e.target.value = '';
  };

  const handleRemovePhoto = (id: string) => {
    setSubmittedPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Reload bank when component mounts or changes
  useEffect(() => {
    setBankList(getBankQuizzes());
  }, []);

  // When selectedBankQuiz prop is received, immediately open it
  useEffect(() => {
    if (selectedBankQuiz) {
      handleStartQuiz(selectedBankQuiz);
      if (onClearSelectedBankQuiz) {
        onClearSelectedBankQuiz();
      }
    }
  }, [selectedBankQuiz]);

  // Timer effect
  useEffect(() => {
    let interval: any = null;
    if (timerRunning && !isSubmitted) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, isSubmitted]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  // Filter bank quizzes: strictly for selected grade AND authored by teachers or admins
  const teacherQuizzesForGrade = useMemo(() => {
    return bankList.filter((b) => {
      if (!b) return false;
      // 1. Khối lớp do học sinh chọn
      if (b.grade !== selectedGrade) return false;

      // 2. Chỉ hiện những bộ câu hỏi do GIÁO VIÊN hoặc ADMIN đã soạn
      const isTeacherAuthored = b.creatorRole === 'teacher' || b.creatorRole === 'admin';
      if (!isTeacherAuthored) return false;

      // 3. Lọc theo môn học nếu chọn
      if (subjectFilter !== 'all' && b.subject !== subjectFilter) return false;

      // 4. Tìm kiếm từ khóa
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (b.title || '').toLowerCase().includes(q);
        const topicMatch = (b.topic || '').toLowerCase().includes(q);
        const authorMatch = (b.creatorName || '').toLowerCase().includes(q);
        const subjMatch = (b.subject || '').toLowerCase().includes(q);
        if (!titleMatch && !topicMatch && !authorMatch && !subjMatch) return false;
      }

      return true;
    });
  }, [bankList, selectedGrade, subjectFilter, searchQuery]);

  // Start taking a quiz
  const handleStartQuiz = (quiz: SavedBankQuiz) => {
    setActiveQuiz(quiz);
    setSelectedAnswers({});
    setEssayAnswers({});
    setEssayFeedback({});
    setSubmittedPhotos([]);
    setIsSubmitted(false);
    setQuizResult(null);
    setCurrentMcqIndex(0);
    setSecondsElapsed(0);
    setTimerRunning(true);
    setSyncStatus(null);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Close active quiz
  const handleExitQuiz = () => {
    setActiveQuiz(null);
    setSubmittedPhotos([]);
    setTimerRunning(false);
    setIsSubmitted(false);
    setQuizResult(null);
  };

  // Handle select MCQ option
  const handleSelectOption = (qId: number, letter: string) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [qId]: letter,
    }));
  };

  // Handle submit quiz
  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;

    setTimerRunning(false);
    setIsSubmitted(true);

    const questions: QuizQuestion[] = activeQuiz.data?.questions || [];
    const essayQuestions: EssayQuestion[] = activeQuiz.data?.essayQuestions || [];

    // 1. Grade MCQs
    let mcqCorrect = 0;
    const weakList: string[] = [];

    questions.forEach((q) => {
      const userChoice = (selectedAnswers[q.id] || '').trim().toUpperCase();
      const actualCorrect = (q.correctAnswer || '').trim().charAt(0).toUpperCase();
      if (userChoice === actualCorrect) {
        mcqCorrect += 1;
      } else if (q.subtopic) {
        weakList.push(q.subtopic);
      }
    });

    // 2. Grade Essays (if any)
    const feedbackMap: Record<number, { score: number; comment: string }> = {};
    let essayPointsEarned = 0;
    let essayMaxPoints = 0;

    if (essayQuestions.length > 0) {
      setIsGradingEssay(true);
      for (const eq of essayQuestions) {
        const studentText = (essayAnswers[eq.id] || '').trim();
        const maxPts = eq.points || 5;
        essayMaxPoints += maxPts;

        if (!studentText) {
          feedbackMap[eq.id] = {
            score: 0,
            comment: 'Chưa có bài giải tự luận.',
          };
        } else {
          try {
            const graded = await gradeEssayWithAI(
              eq.question,
              eq.sampleAnswer,
              eq.rubric || 'Đúng câu lời giải, phép tính và đáp số',
              studentText,
              maxPts,
              activeQuiz.grade,
              activeQuiz.subject
            );
            feedbackMap[eq.id] = graded;
            essayPointsEarned += graded.score || 0;
          } catch {
            // Fallback rubric scoring based on keywords
            const sampleLen = (eq.sampleAnswer || '').length;
            const textLen = studentText.length;
            const ratio = Math.min(textLen / Math.max(sampleLen, 50), 1.0);
            const scoreCalc = Math.round(maxPts * Math.max(ratio * 0.8, 0.4) * 10) / 10;
            feedbackMap[eq.id] = {
              score: scoreCalc,
              comment: 'Bài giải đã bám sát câu hỏi và lời giải chi tiết của Thầy/Cô.',
            };
            essayPointsEarned += scoreCalc;
          }
        }
      }
      setEssayFeedback(feedbackMap);
      setIsGradingEssay(false);
    }

    // 3. Compute final weighted score on scale 10
    let finalScore = 10;
    const hasMcq = questions.length > 0;
    const hasEssay = essayQuestions.length > 0;

    if (hasMcq && hasEssay) {
      // 50% MCQ, 50% Essay
      const mcqScore = (mcqCorrect / questions.length) * 5;
      const essayScore = essayMaxPoints > 0 ? (essayPointsEarned / essayMaxPoints) * 5 : 5;
      finalScore = Math.round((mcqScore + essayScore) * 10) / 10;
    } else if (hasMcq) {
      finalScore = Math.round(((mcqCorrect / questions.length) * 10) * 10) / 10;
    } else if (hasEssay) {
      finalScore = essayMaxPoints > 0 ? Math.round(((essayPointsEarned / essayMaxPoints) * 10) * 10) / 10 : 10;
    }

    // 4. Upload photo submissions to Google Drive folder
    if (submittedPhotos.length > 0) {
      setSyncStatus(`Đang đồng bộ ${submittedPhotos.length} ảnh bài làm lên Google Drive...`);
      for (const photo of submittedPhotos) {
        uploadSubmissionPhoto(
          {
            name: photo.name,
            mimeType: photo.mimeType,
            data: photo.data,
            questionId: photo.questionId,
          },
          { name: currentUser.name, grade: activeQuiz.grade }
        ).catch((err) => {
          console.warn('Lỗi upload ảnh lên Google Drive:', err);
        });
      }
    }

    // Build submission result
    const result: QuizSubmissionResult = {
      id: `quiz-res-${Date.now()}`,
      timestamp: Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      subject: activeQuiz.subject,
      grade: activeQuiz.grade,
      topic: activeQuiz.topic,
      examFormat: activeQuiz.examFormat || (hasMcq && hasEssay ? 'mixed' : hasEssay ? 'essay' : 'multiple_choice'),
      score: finalScore,
      correctCount: mcqCorrect,
      totalQuestions: questions.length + essayQuestions.length,
      userAnswers: selectedAnswers,
      essayAnswers: essayAnswers,
      essayFeedback: feedbackMap,
      submittedPhotos: submittedPhotos,
      driveFolderUrl: STUDENT_SUBMISSION_DRIVE_FOLDER_URL,
      weakSubtopics: Array.from(new Set(weakList)),
      questions,
      essayQuestions,
    };

    setQuizResult(result);

    // Save locally
    saveQuizResult(result);
    onQuizCompleted(result);

    // Auto sync to Google Sheets & Firestore
    setSyncStatus('Đang tự động lưu kết quả vào Google Sheets & Google Drive...');
    autoSyncQuiz(result, currentUser);
    syncQuizResult(result, currentUser).then((syncRes) => {
      if (syncRes.sheetsSuccess || syncRes.firestoreSuccess) {
        setSyncStatus('Đã tự động lưu kết quả bài thi vào Google Sheets & tài khoản thành công! 📊');
      } else {
        setSyncStatus('Đã tự động lưu kết quả vào hệ thống tài khoản của bạn.');
      }
    });

    // Confetti celebration if score >= 8
    if (finalScore >= 8) {
      try {
        confetti({
          particleCount: 120,
          spread: 75,
          origin: { y: 0.6 },
        });
      } catch {}
    }

    onNotification(`Đã hoàn thành bài thi: ${finalScore}/10 điểm! 🌟`);
  };

  const getChoiceLetter = (optStr: string, idx: number) => {
    const letters = ['A', 'B', 'C', 'D'];
    const trimmed = optStr.trim();
    if (trimmed.length >= 2 && trimmed[1] === '.') {
      return trimmed[0].toUpperCase();
    }
    return letters[idx] || 'A';
  };

  const sheetUrl = getSpreadsheetUrl();

  return (
    <div className="space-y-6">
      {/* 1. STUDENT BANNER & ROLE RECOGNITION */}
      <div className="bg-gradient-to-r from-indigo-900 via-sky-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-sky-200 border border-white/10">
              <GraduationCap className="w-3.5 h-3.5 text-sky-300" />
              <span>Góc Luyện Thi Học Sinh • Chỉ chọn khối lớp • Đề chuẩn Thầy Cô biên soạn</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">
              Phòng Luyện Thi & Làm Đề Chuẩn
            </h2>
            <p className="text-sky-100 text-xs sm:text-sm leading-relaxed">
              Dành riêng cho học sinh: Em chỉ cần chọn <strong>Khối lớp</strong> để xem các bộ đề thi trắc nghiệm & tự luận do Thầy/Cô đã biên soạn.
              Sau khi nộp bài, hệ thống sẽ <strong>chấm điểm tự động</strong> và <strong>lưu kết quả vào Google Sheets</strong>.
            </p>
          </div>

          {/* Quick info & Switch Role Button for Teachers */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-xs space-y-2.5 shrink-0 w-full md:w-auto">
            <div className="flex items-center gap-2 text-sky-200">
              <User className="w-4 h-4 text-emerald-400" />
              <span>Tài khoản: <strong className="text-white">{currentUser.name}</strong></span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-bold text-[10px]">
                {currentUser.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}
              </span>
            </div>
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full text-left flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors text-[11px]"
              >
                <span>Thầy/Cô đăng nhập để soạn đề</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 2. CHỌN KHỐI LỚP (GRADE SELECTOR) - THE ONLY INPUT FOR STUDENTS */}
        <div className="mt-6 pt-5 border-t border-white/15 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-200 uppercase tracking-wider">
              1. Chọn khối lớp của em:
            </span>
            <span className="text-xs text-sky-300 font-medium">
              Đang chọn: <strong className="text-white underline">{selectedGrade}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {(['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'] as Grade[]).map((g) => {
              const isSelected = selectedGrade === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setSelectedGrade(g);
                    if (activeQuiz && activeQuiz.grade !== g) {
                      setActiveQuiz(null);
                    }
                  }}
                  className={`py-3 px-4 rounded-2xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-sm ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 scale-102 ring-3 ring-amber-300/60 shadow-md font-black'
                      : 'bg-white/15 text-white hover:bg-white/25 hover:scale-101 border border-white/10'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 ${isSelected ? 'text-amber-800' : 'text-sky-300'}`} />
                  <span>{g}</span>
                </button>
              );
            })}
          </div>

          {/* Secondary & High school grade dropdown if student is in other grades */}
          <div className="flex items-center gap-2 pt-1 text-xs text-sky-200">
            <span>Hoặc khối khác:</span>
            <select
              value={selectedGrade}
              onChange={(e) => {
                const g = e.target.value as Grade;
                setSelectedGrade(g);
                if (activeQuiz && activeQuiz.grade !== g) setActiveQuiz(null);
              }}
              className="bg-white/20 text-white font-bold rounded-lg px-2.5 py-1 text-xs focus:outline-none cursor-pointer"
            >
              {GRADES.map((g) => (
                <option key={g} value={g} className="text-slate-900">
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. ACTIVE QUIZ TAKING INTERFACE */}
      {activeQuiz ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden space-y-0">
          {/* Top Bar of Active Quiz */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                  {activeQuiz.subject}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                  {activeQuiz.grade}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  GV biên soạn: <strong>{activeQuiz.creatorName}</strong>
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                {activeQuiz.title}
              </h3>
            </div>

            <div className="flex items-center gap-3">
              {/* Timer */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs">
                <Timer className="w-4 h-4 text-indigo-600" />
                <span>{formatTimer(secondsElapsed)}</span>
              </div>

              {!isSubmitted ? (
                <button
                  type="button"
                  onClick={handleSubmitQuiz}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all hover:scale-102"
                >
                  Nộp bài chấm điểm
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleExitQuiz}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Chọn đề khác</span>
                </button>
              )}
            </div>
          </div>

          {/* PART 1: TRẮC NGHIỆM (MCQ) - IF PRESENT */}
          {activeQuiz.data?.questions && activeQuiz.data.questions.length > 0 && (
            <div className="p-6 border-b border-slate-200 space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
                    I
                  </span>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Phần Trắc Nghiệm ({activeQuiz.data.questions.length} câu)
                  </h4>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  Đã chọn: {Object.keys(selectedAnswers).length}/{activeQuiz.data.questions.length} câu
                </span>
              </div>

              {/* Navigation bubbles */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-xs font-bold text-slate-400 shrink-0">Câu:</span>
                {activeQuiz.data.questions.map((q, idx) => {
                  const isAnswered = selectedAnswers[q.id] !== undefined;
                  const isCurrent = idx === currentMcqIndex;
                  const isCorrect =
                    isSubmitted &&
                    selectedAnswers[q.id] === (q.correctAnswer || '').trim().charAt(0).toUpperCase();

                  let style = 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400';
                  if (isSubmitted) {
                    style = isCorrect
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-rose-600 text-white border-rose-600';
                  } else if (isCurrent) {
                    style = 'bg-indigo-600 text-white border-indigo-600 font-bold ring-2 ring-indigo-300';
                  } else if (isAnswered) {
                    style = 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentMcqIndex(idx)}
                      className={`w-8 h-8 rounded-xl border text-xs font-semibold flex items-center justify-center shrink-0 transition-all ${style}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Single Question Card */}
              {activeQuiz.data.questions[currentMcqIndex] && (() => {
                const q = activeQuiz.data.questions[currentMcqIndex];
                return (
                  <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                          Câu {currentMcqIndex + 1}/{activeQuiz.data.questions.length}
                        </span>
                        {q.subtopic && (
                          <span className="text-xs text-slate-500 font-medium">
                            Chuyên đề: <strong>{q.subtopic}</strong>
                          </span>
                        )}
                      </div>
                      <div className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        <MarkdownContent content={q.question} compact={true} />
                      </div>
                    </div>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {q.options.map((opt, oIdx) => {
                        const letter = getChoiceLetter(opt, oIdx);
                        const isSelected = selectedAnswers[q.id] === letter;
                        const correctLetter = (q.correctAnswer || '').trim().charAt(0).toUpperCase();
                        const isRightChoice = letter === correctLetter;

                        let cardStyle = 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-slate-50';

                        if (isSubmitted) {
                          if (isRightChoice) {
                            cardStyle = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold ring-1 ring-emerald-500';
                          } else if (isSelected && !isRightChoice) {
                            cardStyle = 'bg-rose-50 border-rose-500 text-rose-950 line-through ring-1 ring-rose-500';
                          } else {
                            cardStyle = 'bg-slate-50/60 border-slate-200 opacity-60';
                          }
                        } else if (isSelected) {
                          cardStyle = 'bg-indigo-50/80 border-indigo-600 text-indigo-950 font-semibold ring-2 ring-indigo-500/30';
                        }

                        return (
                          <button
                            key={oIdx}
                            type="button"
                            disabled={isSubmitted}
                            onClick={() => handleSelectOption(q.id, letter)}
                            className={`p-4 rounded-xl border text-left text-sm transition-all flex items-start gap-3 shadow-2xs ${cardStyle}`}
                          >
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                isSubmitted
                                  ? isRightChoice
                                    ? 'bg-emerald-600 text-white'
                                    : isSelected
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-slate-200 text-slate-600'
                                  : isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {isSubmitted ? (
                                isRightChoice ? (
                                  <Check className="w-4 h-4" />
                                ) : isSelected ? (
                                  <X className="w-4 h-4" />
                                ) : (
                                  letter
                                )
                              ) : (
                                letter
                              )}
                            </div>
                            <div className="flex-1 mt-0.5 pointer-events-none overflow-hidden">
                              <MarkdownContent content={opt} compact={true} />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Step-by-step explanation if submitted */}
                    {isSubmitted && (
                      <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <BookOpenCheck className="w-4 h-4 text-indigo-600" />
                          <span>
                            Đáp án đúng: <strong className="text-emerald-700">{q.correctAnswer}</strong>
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                          <MarkdownContent content={q.explanation} />
                        </div>
                      </div>
                    )}

                    {/* Previous / Next buttons */}
                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        disabled={currentMcqIndex === 0}
                        onClick={() => setCurrentMcqIndex((prev) => prev - 1)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Câu trước</span>
                      </button>

                      {currentMcqIndex < activeQuiz.data.questions.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => setCurrentMcqIndex((prev) => prev + 1)}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
                        >
                          <span>Câu kế tiếp</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold">Hết phần trắc nghiệm</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* PART 2: TỰ LUẬN (ESSAY) - IF PRESENT */}
          {activeQuiz.data?.essayQuestions && activeQuiz.data.essayQuestions.length > 0 && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center">
                    II
                  </span>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Phần Tự Luận ({activeQuiz.data.essayQuestions.length} câu)
                  </h4>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  Tự trình bày bài giải chi tiết
                </span>
              </div>

              <div className="space-y-6">
                {activeQuiz.data.essayQuestions.map((eq, eIdx) => {
                  const fb = essayFeedback[eq.id];
                  return (
                    <div key={eq.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                            Câu Tự luận {eIdx + 1} ({eq.points || 5} điểm)
                          </span>
                          <div className="text-sm sm:text-base font-bold text-slate-900 pt-1">
                            <MarkdownContent content={eq.question} compact={true} />
                          </div>
                          {eq.guideline && (
                            <p className="text-xs text-slate-500 italic">
                              💡 Gợi ý: {eq.guideline}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Formula toolbar for student */}
                      {!isSubmitted && (
                        <FormulaToolbar
                          compact={true}
                          onInsertSymbol={(sym) => {
                            setEssayAnswers((prev) => ({
                              ...prev,
                              [eq.id]: (prev[eq.id] || '') + (prev[eq.id] && !prev[eq.id].endsWith(' ') ? ' ' : '') + sym,
                            }));
                          }}
                        />
                      )}

                      {/* Student answer textarea */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Bài giải của em:
                        </label>
                        <textarea
                          rows={4}
                          disabled={isSubmitted}
                          value={essayAnswers[eq.id] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEssayAnswers((prev) => ({
                              ...prev,
                              [eq.id]: val,
                            }));
                          }}
                          placeholder="Nhập câu lời giải, phép tính và đáp số của em vào đây (hoặc chụp ảnh bài làm bên dưới)..."
                          className="w-full rounded-xl border border-slate-300 p-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-700"
                        />
                      </div>

                      {/* Photo submission toolbar for this essay question */}
                      <div className="space-y-2 pt-1 border-t border-slate-200/60">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {!isSubmitted && (
                              <>
                                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-bold text-[11px] transition-transform active:scale-95 shadow-2xs">
                                  <Camera className="w-3.5 h-3.5 text-sky-600" />
                                  <span>Chụp ảnh bài giải (Camera)</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => handlePhotoUpload(e, eq.id)}
                                  />
                                </label>

                                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[11px] transition-transform active:scale-95 shadow-2xs">
                                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Chọn ảnh từ máy</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => handlePhotoUpload(e, eq.id)}
                                  />
                                </label>
                              </>
                            )}
                          </div>

                          {submittedPhotos.filter((p) => p.questionId === eq.id).length > 0 && (
                            <span className="text-[11px] font-bold text-sky-700 bg-sky-100/70 px-2 py-0.5 rounded-md">
                              Đã chụp: {submittedPhotos.filter((p) => p.questionId === eq.id).length} ảnh cho câu này
                            </span>
                          )}
                        </div>

                        {/* Thumbnails of photos for this question */}
                        {submittedPhotos.filter((p) => p.questionId === eq.id).length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {submittedPhotos
                              .filter((p) => p.questionId === eq.id)
                              .map((photo) => (
                                <div
                                  key={photo.id}
                                  className="relative group rounded-xl overflow-hidden border border-slate-300 bg-white shadow-2xs"
                                >
                                  <img
                                    src={photo.previewUrl || `data:${photo.mimeType};base64,${photo.data}`}
                                    alt={photo.name}
                                    className="w-16 h-16 object-cover cursor-pointer hover:scale-105 transition-transform"
                                    onClick={() =>
                                      setPreviewModalImage({
                                        url: photo.previewUrl || `data:${photo.mimeType};base64,${photo.data}`,
                                        name: photo.name,
                                      })
                                    }
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewModalImage({
                                        url: photo.previewUrl || `data:${photo.mimeType};base64,${photo.data}`,
                                        name: photo.name,
                                      })
                                    }
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {!isSubmitted && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePhoto(photo.id)}
                                      className="absolute top-0.5 right-0.5 p-1 rounded-full bg-rose-600 text-white shadow-xs"
                                      title="Xóa ảnh"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Submission Feedback & Sample Answer */}
                      {isSubmitted && (
                        <div className="space-y-3 pt-2">
                          {/* Score and feedback */}
                          {fb && (
                            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                              <div className="flex items-center justify-between font-bold">
                                <span>Điểm tự luận: {fb.score}/{eq.points || 5} điểm</span>
                              </div>
                              <p className="text-slate-700">{fb.comment}</p>
                            </div>
                          )}

                          {/* Teacher's Sample Answer */}
                          <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <BookOpenCheck className="w-3.5 h-3.5 text-indigo-600" />
                              Đáp án mẫu & Biểu điểm của Thầy/Cô:
                            </span>
                            <div className="text-slate-600 leading-relaxed">
                              <MarkdownContent content={eq.sampleAnswer} />
                            </div>
                            {eq.rubric && (
                              <p className="text-[11px] text-slate-500 italic border-t border-slate-100 pt-1">
                                Tiêu chí chấm: {eq.rubric}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PART 3: CHỤP ẢNH & ĐÍNH KÈM BÀI LÀM TRÊN GIẤY / VỞ GHI (LƯU VÀO GOOGLE DRIVE) */}
          <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-sky-600 text-white font-extrabold text-xs flex items-center justify-center">
                    <Camera className="w-4 h-4" />
                  </span>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Chụp ảnh bài làm & Bài giải viết tay
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-200">
                    Lưu vào Google Drive
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Em có thể dùng camera điện thoại chụp ảnh bài giải trên vở hoặc giấy nháp để gửi cho Thầy/Cô. Mọi ảnh sẽ được tự động lưu vào Google Drive:
                </p>
              </div>

              {/* Link to target Google Drive folder */}
              <a
                href={STUDENT_SUBMISSION_DRIVE_FOLDER_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-sky-50 border border-sky-300 text-xs font-bold text-sky-700 transition-colors shadow-2xs shrink-0"
              >
                <FolderOpen className="w-4 h-4 text-sky-600" />
                <span>Mở thư mục Google Drive</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>

            {/* Camera / Upload buttons */}
            {!isSubmitted && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {/* Direct Camera button */}
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-transform active:scale-95">
                  <Camera className="w-4 h-4" />
                  <span>Chụp ảnh ngay (Camera)</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e)}
                  />
                </label>

                {/* Gallery / File picker button */}
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs shadow-2xs transition-transform active:scale-95">
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  <span>Chọn ảnh từ thiết bị</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e)}
                  />
                </label>

                {isUploadingPhoto && (
                  <span className="text-xs font-semibold text-sky-700 animate-pulse flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 animate-bounce" />
                    Đang xử lý ảnh bài làm...
                  </span>
                )}
              </div>
            )}

            {/* Gallery of all attached photos */}
            {submittedPhotos.length > 0 ? (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
                  <span>Ảnh bài làm đã đính kèm ({submittedPhotos.length} ảnh):</span>
                  <span className="text-sky-600">Sẵn sàng lưu vào Google Drive khi nộp</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {submittedPhotos.map((photo, pIdx) => (
                    <div
                      key={photo.id}
                      className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white shadow-2xs hover:shadow-md transition-all"
                    >
                      <img
                        src={photo.previewUrl || `data:${photo.mimeType};base64,${photo.data}`}
                        alt={photo.name}
                        className="w-full h-24 object-cover cursor-pointer"
                        onClick={() =>
                          setPreviewModalImage({
                            url: photo.previewUrl || `data:${photo.mimeType};base64,${photo.data}`,
                            name: photo.name,
                          })
                        }
                      />
                      <div className="p-2 space-y-0.5">
                        <p className="text-[11px] font-bold text-slate-800 truncate" title={photo.name}>
                          {photo.name}
                        </p>
                        <span className="text-[10px] text-sky-600 font-semibold block">
                          {photo.questionId ? `Câu TL ${photo.questionId}` : `Ảnh bài làm ${pIdx + 1}`}
                        </span>
                      </div>

                      {/* View zoom button */}
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewModalImage({
                            url: photo.previewUrl || `data:${photo.mimeType};base64,${photo.data}`,
                            name: photo.name,
                          })
                        }
                        className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Xem ảnh phóng to"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete button (if not submitted) */}
                      {!isSubmitted && (
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(photo.id)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-md bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Xóa ảnh này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-white/70 text-center text-xs text-slate-500">
                Chưa có ảnh nào được đính kèm. Em có thể bấm "Chụp ảnh ngay (Camera)" để chụp ảnh bài làm trên vở hoặc giấy nháp.
              </div>
            )}
          </div>

          {/* SUBMIT BUTTON BAR (WHEN NOT SUBMITTED) */}
          {!isSubmitted && (
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleExitQuiz}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Trở lại danh sách đề
              </button>

              <button
                type="button"
                onClick={handleSubmitQuiz}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-sm transition-all hover:scale-102 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Nộp bài & Chấm điểm tự động</span>
              </button>
            </div>
          )}

          {/* SCORECARD AND GOOGLE SHEETS & DRIVE SYNC RESULTS (WHEN SUBMITTED) */}
          {isSubmitted && quizResult && (
            <div className="p-6 sm:p-8 bg-gradient-to-br from-indigo-50/80 via-white to-emerald-50/60 border-t border-slate-200 space-y-6">
              <div className="max-w-xl mx-auto text-center space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-md">
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-900">
                  Điểm số của em: {quizResult.score}/10 điểm
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Hoàn thành trong {formatTimer(secondsElapsed)} • Đúng {quizResult.correctCount}/{quizResult.questions.length} câu trắc nghiệm
                </p>

                {/* Live Google Sheets sync banner */}
                {syncStatus && (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2 shadow-2xs">
                    <Sheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{syncStatus}</span>
                  </div>
                )}

                {/* Submitted Photos Display & Link to Google Drive */}
                {quizResult.submittedPhotos && quizResult.submittedPhotos.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 text-left space-y-3 shadow-2xs mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-sky-100 text-sky-800">
                          <Camera className="w-4 h-4" />
                        </span>
                        <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                          Ảnh bài làm đã nộp ({quizResult.submittedPhotos.length} ảnh)
                        </h4>
                      </div>
                      <a
                        href={STUDENT_SUBMISSION_DRIVE_FOLDER_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Mở thư mục Google Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                      {quizResult.submittedPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:ring-2 hover:ring-sky-500 transition-all bg-slate-50"
                          onClick={() =>
                            setPreviewModalImage({
                              url: photo.previewUrl || `data:${photo.mimeType};base64,${photo.data}`,
                              name: photo.name,
                            })
                          }
                        >
                          <img
                            src={photo.previewUrl || `data:${photo.mimeType};base64,${photo.data}`}
                            alt={photo.name}
                            className="w-full h-16 object-cover"
                          />
                          <p className="text-[10px] text-slate-600 truncate p-1 font-semibold">{photo.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleStartQuiz(activeQuiz)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Làm lại bài thi này</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExitQuiz}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                  >
                    <span>Chọn đề khác trong Ngân hàng</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 4. STUDENT QUESTION BANK LIST (ONLY TEACHER-AUTHORED QUIZZES FOR SELECTED GRADE) */
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Môn học:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSubjectFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    subjectFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả môn
                </button>
                {SUBJECTS.slice(0, 5).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubjectFilter(s.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      subjectFilter === s.name
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm chủ đề, tên đề..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* List of Available Teacher Quizzes */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <span>Bộ đề của Giáo viên dành cho {selectedGrade}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                  {teacherQuizzesForGrade.length} bộ đề
                </span>
              </h3>
              <span className="text-xs text-slate-400 hidden sm:inline">
                Chỉ hiện đề thi do Thầy/Cô biên soạn
              </span>
            </div>

            {teacherQuizzesForGrade.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                  Chưa có bộ đề nào của Giáo viên cho {selectedGrade}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Em hãy chọn khối lớp khác (Lớp 1, 2, 3, 4, 5) để luyện thi, hoặc nhờ Thầy/Cô đăng nhập tài khoản Giáo viên để biên soạn thêm bộ đề mới vào Ngân hàng.
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-2">
                  {(['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'] as Grade[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGrade(g)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 text-indigo-700"
                    >
                      Xem {g}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teacherQuizzesForGrade.map((quiz, qIdx) => {
                  const mcqCount = quiz.data?.questions?.length || 0;
                  const essayCount = quiz.data?.essayQuestions?.length || 0;
                  const isMixed = mcqCount > 0 && essayCount > 0;
                  const isEssay = !isMixed && essayCount > 0;
                  const isMcq = !isMixed && !isEssay;

                  return (
                    <div
                      key={quiz.id || qIdx}
                      className="bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4 text-left group"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {quiz.subject} • {quiz.grade}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                              isMixed
                                ? 'bg-amber-100 text-amber-800'
                                : isEssay
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {isMixed ? 'Toàn diện (TN & TL)' : isEssay ? 'Tự luận' : 'Trắc nghiệm'}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                          {quiz.title}
                        </h4>

                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          Chủ đề: {quiz.topic}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-semibold text-emerald-700">
                            {isMixed
                              ? `${mcqCount} câu TN + ${essayCount} câu TL`
                              : isEssay
                              ? `${essayCount} câu tự luận`
                              : `${mcqCount} câu trắc nghiệm`}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {quiz.data?.durationMinutes || 35} phút
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                            GV: <strong className="text-slate-600">{quiz.creatorName}</strong>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleStartQuiz(quiz)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-xs transition-transform group-hover:scale-102"
                          >
                            <span>Vào thi ngay</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal for Uploaded Photos */}
      {previewModalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between text-xs font-bold">
              <span className="truncate pr-4">{previewModalImage.name}</span>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="p-1 rounded-lg hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center bg-slate-950">
              <img
                src={previewModalImage.url}
                alt={previewModalImage.name}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
