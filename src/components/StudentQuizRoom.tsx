import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Award,
  Timer,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  FileText,
  Sparkles,
  Sheet,
  Check,
  ExternalLink,
  Layers,
  ChevronRight,
  User,
  GraduationCap,
  Calendar,
  HelpCircle,
  Send,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Grade,
  Subject,
  UserProfile,
  SavedBankQuiz,
  QuizQuestion,
  EssayQuestion,
  QuizSubmissionResult,
} from '../types/study';
import { GRADES, SUBJECTS } from '../data/subjects';
import { getBankQuizzes, saveQuizResult } from '../services/storage';
import { autoSyncQuiz, syncQuizResult, getSpreadsheetUrl } from '../services/firebaseWorkspace';
import { MarkdownContent } from './MarkdownContent';

interface Props {
  selectedGrade: Grade;
  setSelectedGrade: (grade: Grade) => void;
  selectedSubject: Subject;
  setSelectedSubject: (subject: Subject) => void;
  currentUser: UserProfile;
  onQuizCompleted: (result: QuizSubmissionResult) => void;
  onNotification: (msg: string) => void;
  onOpenAuth?: () => void;
}

export const StudentQuizRoom: React.FC<Props> = ({
  selectedGrade,
  setSelectedGrade,
  selectedSubject,
  setSelectedSubject,
  currentUser,
  onQuizCompleted,
  onNotification,
  onOpenAuth,
}) => {
  // Filter for bank quizzes
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all'); // all, mcq, essay, mixed

  // Active quiz being taken
  const [activeQuiz, setActiveQuiz] = useState<SavedBankQuiz | null>(null);

  // Student answers
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<number, string>>({});

  // Status
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<QuizSubmissionResult | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Timer
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Current question active tab / navigation
  const [activeQuestionTab, setActiveQuestionTab] = useState<'mcq' | 'essay'>('mcq');
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);

  // All quizzes from question bank
  const [allBankQuizzes, setAllBankQuizzes] = useState<SavedBankQuiz[]>([]);

  useEffect(() => {
    setAllBankQuizzes(getBankQuizzes());
  }, []);

  // Timer effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && !isSubmitted) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, isSubmitted]);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  // Filter bank quizzes specifically for the student's selected grade
  // Only show quizzes created for this grade
  const gradeQuizzes = allBankQuizzes.filter((quiz) => {
    // 1. Must match selected grade
    if (quiz.grade !== selectedGrade) return false;

    // 2. Filter by subject
    if (subjectFilter !== 'all' && quiz.subject !== subjectFilter) {
      return false;
    }

    // 3. Filter by format
    const hasMcq = Array.isArray(quiz.data?.questions) && quiz.data.questions.length > 0;
    const hasEssay = Array.isArray(quiz.data?.essayQuestions) && quiz.data.essayQuestions.length > 0;
    const isMixed = quiz.examFormat === 'mixed' || (hasMcq && hasEssay);
    const isEssayOnly = !isMixed && (quiz.examFormat === 'essay' || hasEssay);
    const isMcqOnly = !isMixed && !isEssayOnly;

    if (formatFilter === 'mcq' && !isMcqOnly) return false;
    if (formatFilter === 'essay' && !isEssayOnly) return false;
    if (formatFilter === 'mixed' && !isMixed) return false;

    return true;
  });

  // Start taking a quiz
  const handleStartQuiz = (quiz: SavedBankQuiz) => {
    setActiveQuiz(quiz);
    setSelectedAnswers({});
    setEssayAnswers({});
    setIsSubmitted(false);
    setSubmissionResult(null);
    setSecondsElapsed(0);
    setIsTimerRunning(true);
    setCurrentMcqIndex(0);
    setSyncMessage(null);

    const hasMcq = Array.isArray(quiz.data?.questions) && quiz.data.questions.length > 0;
    if (hasMcq) {
      setActiveQuestionTab('mcq');
    } else {
      setActiveQuestionTab('essay');
    }

    onNotification(`Bắt đầu làm bài: ${quiz.title}`);
  };

  // Submit and grade the quiz
  const handleSubmitExam = async () => {
    if (!activeQuiz || !activeQuiz.data) return;

    const mcqs = activeQuiz.data.questions || [];
    const essays = activeQuiz.data.essayQuestions || [];

    const totalMcqs = mcqs.length;
    const totalEssays = essays.length;
    const totalQuestions = totalMcqs + totalEssays;

    if (totalQuestions === 0) {
      onNotification('Bộ đề này không có câu hỏi nào để chấm điểm.');
      return;
    }

    // Grade MCQs
    let correctMcqCount = 0;
    const weakSubtopics: string[] = [];

    mcqs.forEach((q) => {
      const userChoice = (selectedAnswers[q.id] || '').trim().toUpperCase();
      const actualCorrect = (q.correctAnswer || '').trim().charAt(0).toUpperCase();

      if (userChoice === actualCorrect) {
        correctMcqCount += 1;
      } else {
        if (q.subtopic) {
          weakSubtopics.push(q.subtopic);
        }
      }
    });

    // Score calculation on scale of 10
    let finalScore = 0;
    if (totalEssays === 0) {
      // 100% MCQ
      finalScore = Math.round(((correctMcqCount / totalMcqs) * 10) * 10) / 10;
    } else if (totalMcqs === 0) {
      // 100% Essay: Award completion base score (teacher will review or self-study)
      const answeredEssayCount = Object.keys(essayAnswers).filter(
        (k) => (essayAnswers[Number(k)] || '').trim().length > 0
      ).length;
      finalScore = Math.round(((answeredEssayCount / totalEssays) * 10) * 10) / 10;
    } else {
      // Mixed exam: 60% MCQ, 40% Essay (or proportional)
      const mcqWeight = 6.0;
      const essayWeight = 4.0;
      const mcqScore = (correctMcqCount / totalMcqs) * mcqWeight;

      const answeredEssayCount = Object.keys(essayAnswers).filter(
        (k) => (essayAnswers[Number(k)] || '').trim().length > 0
      ).length;
      const essayScore = (answeredEssayCount / totalEssays) * essayWeight;

      finalScore = Math.round((mcqScore + essayScore) * 10) / 10;
    }

    const result: QuizSubmissionResult = {
      id: `quiz-res-${Date.now()}`,
      timestamp: Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email || currentUser.username,
      userRole: 'student',
      subject: activeQuiz.subject,
      grade: activeQuiz.grade,
      topic: activeQuiz.title,
      examFormat: activeQuiz.examFormat,
      score: finalScore,
      correctCount: correctMcqCount,
      totalQuestions: totalQuestions,
      userAnswers: selectedAnswers,
      essayAnswers: essayAnswers,
      weakSubtopics: Array.from(new Set(weakSubtopics)),
      questions: mcqs,
      essayQuestions: essays,
    };

    setIsSubmitted(true);
    setIsTimerRunning(false);
    setSubmissionResult(result);

    // Save locally
    saveQuizResult(result);
    onQuizCompleted(result);

    // Auto sync to Google Sheets & Firestore in background
    setSyncMessage('Đang lưu bài thi và đồng bộ điểm số lên Google Sheets của lớp...');
    autoSyncQuiz(result, currentUser);
    syncQuizResult(result, currentUser)
      .then((syncRes) => {
        if (syncRes.sheetsSuccess || syncRes.firestoreSuccess) {
          setSyncMessage('✓ Đã tự động lưu kết quả bài làm vào bảng tính Google Sheets của lớp!');
        } else {
          setSyncMessage('✓ Đã lưu kết quả bài làm vào hồ sơ học tập của em!');
        }
      })
      .catch(() => {
        setSyncMessage('✓ Đã lưu kết quả bài làm vào hồ sơ học tập của em!');
      });

    // Confetti celebration if score >= 7.5
    if (finalScore >= 7.5) {
      try {
        confetti({
          particleCount: 120,
          spread: 75,
          origin: { y: 0.6 },
        });
      } catch {}
    }
  };

  const sheetUrl = getSpreadsheetUrl();

  // ==============================================================
  // VIEW 1: TAKING THE QUIZ OR VIEWING RESULTS
  // ==============================================================
  if (activeQuiz) {
    const mcqs = activeQuiz.data?.questions || [];
    const essays = activeQuiz.data?.essayQuestions || [];
    const hasMcqs = mcqs.length > 0;
    const hasEssays = essays.length > 0;
    const isMixed = hasMcqs && hasEssays;

    const totalAnsweredMcqs = Object.keys(selectedAnswers).length;
    const totalAnsweredEssays = Object.keys(essayAnswers).filter(
      (k) => (essayAnswers[Number(k)] || '').trim().length > 0
    ).length;
    const totalAnswered = totalAnsweredMcqs + totalAnsweredEssays;
    const totalQuestions = mcqs.length + essays.length;

    return (
      <div className="space-y-6">
        {/* Exam Header Top Bar */}
        <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-7 shadow-lg border border-indigo-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="font-extrabold text-xs px-2.5 py-1 rounded-lg bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {activeQuiz.subject}
                </span>
                <span className="font-bold text-xs px-2.5 py-1 rounded-lg bg-white/10 text-white">
                  {activeQuiz.grade}
                </span>
                <span className="font-bold text-xs px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-200 border border-amber-300/30">
                  {isMixed
                    ? 'Đề Toàn Diện (TN & TL)'
                    : hasEssays
                    ? 'Đề Tự Luận'
                    : 'Đề Trắc Nghiệm'}
                </span>
                {activeQuiz.creatorName && (
                  <span className="text-xs text-indigo-200">
                    GV: <strong>{activeQuiz.creatorName}</strong>
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                {activeQuiz.title}
              </h2>
              <p className="text-xs sm:text-sm text-indigo-200 mt-1">
                Chuyên đề: <strong>{activeQuiz.topic}</strong>
              </p>
            </div>

            {/* Timer & Back button */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 bg-black/30 border border-white/15 px-3.5 py-2 rounded-2xl shadow-inner">
                <Timer className="w-4 h-4 text-amber-300 animate-pulse" />
                <span className="font-mono font-bold text-sm sm:text-base text-amber-300">
                  {formatTime(secondsElapsed)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isSubmitted) {
                    if (window.confirm('Em có chắc chắn muốn rời khỏi bài thi đang làm dở không?')) {
                      setActiveQuiz(null);
                      setIsSubmitted(false);
                    }
                  } else {
                    setActiveQuiz(null);
                    setIsSubmitted(false);
                  }
                }}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-colors border border-white/10"
              >
                ← Thoát bài thi
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          {!isSubmitted && (
            <div className="mt-4 pt-4 border-t border-indigo-800/60 flex items-center justify-between text-xs text-indigo-200">
              <span>
                Đã hoàn thành: <strong>{totalAnswered} / {totalQuestions}</strong> câu
              </span>
              <div className="w-48 bg-black/40 rounded-full h-2 overflow-hidden border border-white/10">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (totalAnswered / (totalQuestions || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* SUBMISSION RESULT REPORT (IF SUBMITTED)                         */}
        {/* ============================================================== */}
        {isSubmitted && submissionResult && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-400 shadow-xl space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 shadow-xs">
                  <Award className="w-9 h-9" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs mb-1 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Bài thi đã được chấm điểm tự động!</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                    Kết Quả Bài Thi Của {currentUser.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thời gian làm bài: <strong>{formatTime(secondsElapsed)}</strong> • Hoàn thành:{' '}
                    <strong>{new Date().toLocaleTimeString('vi-VN')}</strong>
                  </p>
                </div>
              </div>

              {/* Big Score Card */}
              <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-2xl px-6 py-4 text-center shadow-md shrink-0 min-w-[150px]">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-100 block">
                  Điểm số đạt được
                </span>
                <span className="text-3xl sm:text-4xl font-black">
                  {submissionResult.score}
                </span>
                <span className="text-xs text-emerald-200 font-bold"> / 10 điểm</span>
              </div>
            </div>

            {/* Sync Status to Google Sheets */}
            {syncMessage && (
              <div className="flex items-center justify-between gap-2 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
                <div className="flex items-center gap-2">
                  <Sheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{syncMessage}</span>
                </div>
                {sheetUrl && (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline shrink-0"
                  >
                    <span>Mở Google Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* Quick summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold block">Tổng số câu hỏi</span>
                <span className="text-lg font-black text-slate-900">{totalQuestions} câu</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] text-emerald-700 font-bold block">Trắc nghiệm đúng</span>
                <span className="text-lg font-black text-emerald-700">
                  {submissionResult.correctCount} / {mcqs.length} câu
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                <span className="text-[11px] text-amber-800 font-bold block">Tự luận đã làm</span>
                <span className="text-lg font-black text-amber-800">
                  {totalAnsweredEssays} / {essays.length} câu
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
                <span className="text-[11px] text-indigo-700 font-bold block">Xếp loại bài làm</span>
                <span className="text-sm font-black text-indigo-900">
                  {submissionResult.score >= 9
                    ? 'Xuất sắc ⭐⭐⭐'
                    : submissionResult.score >= 8
                    ? 'Giỏi ⭐⭐'
                    : submissionResult.score >= 6.5
                    ? 'Khá ⭐'
                    : 'Cần cố gắng'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
              <button
                type="button"
                onClick={() => handleStartQuiz(activeQuiz)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Làm lại bài thi này</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveQuiz(null);
                  setIsSubmitted(false);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition-colors border border-slate-300"
              >
                <span>Chọn đề thi khác trong ngân hàng</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* EXAM QUESTIONS AREA (DOING OR REVIEWING)                       */}
        {/* ============================================================== */}
        <div className="space-y-6">
          {/* Section 1: Multiple Choice Questions (if present) */}
          {hasMcqs && (
            <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                    I
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Phần I: Trắc Nghiệm Khách Quan
                    </h3>
                    <p className="text-xs text-slate-500">
                      Chọn 1 phương án đúng nhất cho mỗi câu hỏi ({mcqs.length} câu)
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold bg-sky-50 text-sky-700 px-3 py-1 rounded-full border border-sky-200">
                  {totalAnsweredMcqs} / {mcqs.length} đã chọn
                </span>
              </div>

              {/* List of MCQ questions */}
              <div className="space-y-6">
                {mcqs.map((q, idx) => {
                  const studentAnswer = selectedAnswers[q.id];
                  const actualCorrect = (q.correctAnswer || '').trim().charAt(0).toUpperCase();
                  const isCorrect = isSubmitted && studentAnswer === actualCorrect;
                  const isWrong = isSubmitted && studentAnswer && studentAnswer !== actualCorrect;

                  return (
                    <div
                      key={q.id || idx}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                        isSubmitted
                          ? isCorrect
                            ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/10'
                            : isWrong
                            ? 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-500/10'
                            : 'bg-slate-50/60 border-slate-200'
                          : studentAnswer
                          ? 'bg-indigo-50/30 border-indigo-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Question Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center ${
                              isSubmitted
                                ? isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : isWrong
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                                : studentAnswer
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-500">
                            Câu {idx + 1}:
                          </span>
                          {q.subtopic && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                              {q.subtopic}
                            </span>
                          )}
                        </div>

                        {/* Result badge after submission */}
                        {isSubmitted && (
                          <div>
                            {isCorrect ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                                <Check className="w-3.5 h-3.5" /> Đúng
                              </span>
                            ) : isWrong ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full">
                                <XCircle className="w-3.5 h-3.5" /> Sai
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                Chưa trả lời
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Question Text */}
                      <div className="text-sm font-semibold text-slate-900 mb-4 leading-relaxed">
                        <MarkdownContent content={q.question} compact={true} />
                      </div>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(q.options || []).map((opt, optIdx) => {
                          const letter = ['A', 'B', 'C', 'D'][optIdx];
                          const isSelected = studentAnswer === letter;
                          const isOptionCorrect = actualCorrect === letter;

                          let optionStyles = 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20';

                          if (isSubmitted) {
                            if (isOptionCorrect) {
                              optionStyles = 'bg-emerald-100/80 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-500/20';
                            } else if (isSelected && !isOptionCorrect) {
                              optionStyles = 'bg-rose-100/80 border-rose-500 text-rose-950 font-bold line-through';
                            } else {
                              optionStyles = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                            }
                          } else if (isSelected) {
                            optionStyles = 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-bold ring-2 ring-indigo-300';
                          }

                          return (
                            <button
                              key={letter}
                              type="button"
                              disabled={isSubmitted}
                              onClick={() => {
                                if (isSubmitted) return;
                                setSelectedAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: letter,
                                }));
                              }}
                              className={`p-3 rounded-xl border text-left text-xs transition-all flex items-start gap-2.5 ${optionStyles}`}
                            >
                              <span
                                className={`w-6 h-6 rounded-lg font-black text-xs shrink-0 flex items-center justify-center transition-colors ${
                                  isSubmitted
                                    ? isOptionCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : isSelected
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-slate-200 text-slate-600'
                                    : isSelected
                                    ? 'bg-white text-indigo-700'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {letter}
                              </span>
                              <div className="flex-1 mt-0.5">
                                <MarkdownContent content={opt} compact={true} />
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation (Shown when submitted) */}
                      {isSubmitted && q.explanation && (
                        <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                          <span className="font-bold text-indigo-700 block mb-1">
                            💡 Lời giải chi tiết:
                          </span>
                          <MarkdownContent content={q.explanation} compact={true} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Essay Questions (if present) */}
          {hasEssays && (
            <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                    {hasMcqs ? 'II' : 'I'}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                      {hasMcqs ? 'Phần II: Tự Luận' : 'Phần Tự Luận'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Trình bày lời giải chi tiết và các bước tính ({essays.length} câu)
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-200">
                  {totalAnsweredEssays} / {essays.length} đã làm
                </span>
              </div>

              {/* List of Essay questions */}
              <div className="space-y-6">
                {essays.map((eq, eIdx) => {
                  const studentText = essayAnswers[eq.id] || '';

                  return (
                    <div
                      key={eq.id || eIdx}
                      className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-2xs hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center">
                            {eIdx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            Bài {eIdx + 1}:
                          </span>
                          <span className="text-xs font-bold text-amber-700">
                            ({eq.points || eq.maxScore || 2.5} điểm)
                          </span>
                          {eq.subtopic && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                              {eq.subtopic}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Question text */}
                      <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                        <MarkdownContent content={eq.question} compact={true} />
                      </div>

                      {/* Input textarea for student answer */}
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-xs font-bold text-slate-700">
                          {isSubmitted ? 'Bài làm của em:' : 'Nhập lời giải / bài làm của em:'}
                        </label>
                        <textarea
                          rows={3}
                          disabled={isSubmitted}
                          value={studentText}
                          onChange={(e) => {
                            if (isSubmitted) return;
                            setEssayAnswers((prev) => ({
                              ...prev,
                              [eq.id]: e.target.value,
                            }));
                          }}
                          placeholder="Em hãy viết các bước giải và đáp số vào đây..."
                          className={`w-full rounded-xl p-3 text-xs focus:outline-none transition-all ${
                            isSubmitted
                              ? 'bg-slate-50 border border-slate-200 text-slate-800'
                              : 'bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                          }`}
                        />
                      </div>

                      {/* Sample Solution Guide (shown after submission) */}
                      {isSubmitted && (eq.solutionGuide || eq.sampleAnswer) && (
                        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-slate-800 space-y-1.5">
                          <span className="font-extrabold text-amber-900 block">
                            📖 Hướng dẫn giải chi tiết & Đáp án chuẩn của Thầy/Cô:
                          </span>
                          <MarkdownContent
                            content={eq.solutionGuide || eq.sampleAnswer || ''}
                            compact={true}
                          />
                          {(eq.rubric || eq.scoringRubric) && (
                            <div className="pt-2 border-t border-amber-200/60 text-[11px] text-amber-950 font-medium">
                              <strong>Biểu điểm tham khảo:</strong>{' '}
                              {Array.isArray(eq.scoringRubric)
                                ? eq.scoringRubric.join(' • ')
                                : eq.rubric}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Submit Button */}
          {!isSubmitted && (
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600">
                <span>
                  Em đã làm: <strong>{totalAnswered} / {totalQuestions}</strong> câu hỏi.
                </span>
                {totalAnswered < totalQuestions && (
                  <p className="text-amber-600 font-semibold mt-0.5">
                    ⚠️ Còn {totalQuestions - totalAnswered} câu chưa hoàn thành. Em có thể kiểm tra lại trước khi nộp.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleSubmitExam}
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Nộp Bài & Chấm Điểm 🎯</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==============================================================
  // VIEW 2: STUDENT QUIZ DASHBOARD (ONLY CHOOSE GRADE & QUIZZES)
  // ==============================================================
  return (
    <div className="space-y-6">
      {/* Student Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-indigo-700/50">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-blue-200 mb-3 border border-white/10">
            <GraduationCap className="w-3.5 h-3.5 text-blue-300" />
            <span>Phòng Luyện Thi Của Học Sinh • Đồng bộ điểm số Google Sheets</span>
          </div>

          <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">
            Luyện Thi & Làm Bài Tập Theo Khối Lớp
          </h2>
          <p className="mt-2 text-blue-100 text-xs sm:text-sm leading-relaxed">
            Xin chào <strong>{currentUser.name}</strong> ({currentUser.grade || selectedGrade})!
            Dưới đây là các bộ đề ôn tập và kiểm tra do <strong>Thầy/Cô giáo</strong> đã biên soạn.
            Em hãy chọn khối lớp để mở đề và bắt đầu làm bài nhé.
          </p>

          {/* Quick Grade Selector Bar for Students */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white/15 px-3.5 py-2 rounded-2xl backdrop-blur-xs border border-white/15">
              <span className="text-blue-200 text-xs font-bold">Khối lớp của em:</span>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value as Grade)}
                className="bg-transparent font-black text-white text-sm focus:outline-none cursor-pointer"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g} className="text-slate-900">
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white/15 px-3.5 py-2 rounded-2xl backdrop-blur-xs border border-white/15">
              <span className="text-blue-200 text-xs font-bold">Môn học:</span>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="bg-transparent font-black text-white text-sm focus:outline-none cursor-pointer"
              >
                <option value="all" className="text-slate-900">
                  Tất cả môn học
                </option>
                {SUBJECTS.map((s) => (
                  <option key={s.id} value={s.id} className="text-slate-900">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white/15 px-3.5 py-2 rounded-2xl backdrop-blur-xs border border-white/15">
              <span className="text-blue-200 text-xs font-bold">Hình thức:</span>
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="bg-transparent font-black text-white text-sm focus:outline-none cursor-pointer"
              >
                <option value="all" className="text-slate-900">
                  Tất cả hình thức
                </option>
                <option value="mcq" className="text-slate-900">
                  Trắc nghiệm
                </option>
                <option value="essay" className="text-slate-900">
                  Tự luận
                </option>
                <option value="mixed" className="text-slate-900">
                  Toàn diện (TN & TL)
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Quizzes List Cards Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Danh sách đề thi Thầy/Cô giao cho {selectedGrade}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-extrabold">
              {gradeQuizzes.length} đề thi
            </span>
          </div>
        </div>

        {gradeQuizzes.length === 0 ? (
          /* Empty state */
          <div className="p-10 rounded-3xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-500 flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-800">
              Chưa có đề thi nào cho {selectedGrade}{' '}
              {subjectFilter !== 'all' ? `môn ${subjectFilter}` : ''}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Thầy/Cô chưa đưa đề thi mới cho khối lớp này. Em có thể chọn khối lớp khác ở trên hoặc quay lại sau nhé!
            </p>
          </div>
        ) : (
          /* List of cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gradeQuizzes.map((quiz, qIdx) => {
              const hasMcq = Array.isArray(quiz.data?.questions) && quiz.data.questions.length > 0;
              const hasEssay = Array.isArray(quiz.data?.essayQuestions) && quiz.data.essayQuestions.length > 0;
              const isMixed = quiz.examFormat === 'mixed' || (hasMcq && hasEssay);
              const isEssayOnly = !isMixed && (quiz.examFormat === 'essay' || hasEssay);

              const mcqCount = quiz.data?.questions?.length || 0;
              const essayCount = quiz.data?.essayQuestions?.length || 0;
              const totalCount = mcqCount + essayCount;

              return (
                <div
                  key={quiz.id || qIdx}
                  className="bg-white rounded-3xl p-5 border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2.5">
                    {/* Tags */}
                    <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {quiz.subject}
                        </span>
                        <span className="font-bold text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {quiz.grade}
                        </span>
                      </div>

                      {isMixed ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                          TN & TL
                        </span>
                      ) : isEssayOnly ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                          Tự luận
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-200">
                          Trắc nghiệm
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors">
                      {quiz.title}
                    </h4>

                    {/* Meta Info */}
                    <div className="text-xs text-slate-500 space-y-1">
                      <p className="line-clamp-1">
                        Chủ đề: <strong>{quiz.topic}</strong>
                      </p>
                      <p className="line-clamp-1">
                        Soạn bởi:{' '}
                        <strong className="text-slate-700">
                          {quiz.creatorName || 'Giáo viên bộ môn'}
                        </strong>
                      </p>
                    </div>
                  </div>

                  {/* Card Footer: Question Count & Action Button */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">
                      {isMixed
                        ? `${mcqCount} TN + ${essayCount} TL`
                        : `${totalCount} câu hỏi`}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleStartQuiz(quiz)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all group-hover:shadow-md"
                    >
                      <span>Vào Làm Bài</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
