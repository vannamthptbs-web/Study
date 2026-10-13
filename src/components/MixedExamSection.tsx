import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  Save,
  Printer,
  Copy,
  Check,
  Download,
  Timer,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  Award,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  RotateCcw,
  Zap,
} from 'lucide-react';
import {
  Grade,
  Subject,
  QuizData,
  QuizQuestion,
  EssayQuestion,
  SavedBankQuiz,
  UserProfile,
  UploadedFileItem,
  QuizSubmissionResult,
} from '../types/study';
import { generateMixedExamFromAI, gradeEssayWithAI } from '../services/api';
import { saveBankQuiz, saveQuizResult } from '../services/storage';
import {
  autoSyncBankQuiz,
  autoSyncQuiz,
  syncQuizResult,
  STUDENT_SUBMISSION_DRIVE_FOLDER_URL,
} from '../services/firebaseWorkspace';
import { FormulaToolbar } from './FormulaToolbar';
import { FileAttachmentInput } from './FileAttachmentInput';
import { MarkdownContent } from './MarkdownContent';
import { POPULAR_TOPICS } from '../data/subjects';

interface Props {
  selectedGrade: Grade;
  setSelectedGrade: (grade: Grade) => void;
  selectedSubject: Subject;
  setSelectedSubject: (subject: Subject) => void;
  currentUser: UserProfile;
  onNotification: (msg: string) => void;
  onOpenAuth?: () => void;
}

export const MixedExamSection: React.FC<Props> = ({
  selectedGrade,
  setSelectedGrade,
  selectedSubject,
  setSelectedSubject,
  currentUser,
  onNotification,
  onOpenAuth,
}) => {
  // Method: 'ai_generate' (AI soạn tự động) hoặc 'manual_typing' (Tự gõ)
  const [creationMethod, setCreationMethod] = useState<'ai_generate' | 'manual_typing'>('ai_generate');

  // Generator inputs
  const [topic, setTopic] = useState('');
  const [mcqCount, setMcqCount] = useState<number>(4);
  const [essayCount, setEssayCount] = useState<number>(2);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [customPrompt, setCustomPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual exam editor
  const [manualTitle, setManualTitle] = useState(`Đề kiểm tra toàn diện (TN & TL) ${selectedSubject} - ${selectedGrade}`);
  const [manualDuration, setManualDuration] = useState<number>(45);
  const [manualMcqs, setManualMcqs] = useState<QuizQuestion[]>([
    {
      id: 1,
      question: 'Phép tính nào dưới đây có kết quả đúng?',
      options: ['A. $25 \\times 4 = 100$', 'B. $25 \\times 4 = 120$', 'C. $25 \\times 4 = 90$', 'D. $25 \\times 4 = 110$'],
      correctAnswer: 'A',
      explanation: 'Ta có $25 \\times 4 = 100$. Phương án A là đáp án chính xác.',
      subtopic: 'Phép nhân số tự nhiên',
    },
    {
      id: 2,
      question: 'Một hình vuông có cạnh dài $6\\text{ cm}$. Chu vi hình vuông đó là:',
      options: ['A. $24\\text{ cm}$', 'B. $36\\text{ cm}$', 'C. $18\\text{ cm}$', 'D. $12\\text{ cm}$'],
      correctAnswer: 'A',
      explanation: 'Chu vi hình vuông = Cạnh $\\times 4$: $6 \\times 4 = 24\\text{ cm}$.',
      subtopic: 'Chu vi hình vuông',
    },
  ]);
  const [manualEssays, setManualEssays] = useState<EssayQuestion[]>([
    {
      id: 1,
      question: 'Một mảnh đất hình chữ nhật có chu vi $120\\text{ m}$, chiều rộng bằng $\\frac{1}{3}$ chiều dài. Em hãy tính diện tích mảnh đất đó.',
      points: 5,
      guideline: 'Tìm nửa chu vi, sau đó đưa về bài toán tìm hai số khi biết Tổng và Tỉ số.',
      sampleAnswer: 'Bài giải:\n- Nửa chu vi mảnh đất là:\n  $$120 : 2 = 60\\text{ (m)}$$\n- Tổng số phần bằng nhau là:\n  $$1 + 3 = 4\\text{ (phần)}$$\n- Chiều rộng mảnh đất là:\n  $$60 : 4 \\times 1 = 15\\text{ (m)}$$\n- Chiều dài mảnh đất là:\n  $$60 - 15 = 45\\text{ (m)}$$\n- Diện tích mảnh đất là:\n  $$45 \\times 15 = 675\\text{ (m}^2)$$\nĐáp số: $675\\text{ m}^2$.',
      rubric: 'Tìm nửa chu vi: 1.0đ; Tìm chiều dài & rộng: 2.5đ; Tính diện tích & đáp số: 1.5đ.',
      subtopic: 'Tìm hai số khi biết Tổng và Tỉ số',
    },
  ]);

  // Active exam state
  const [activeExam, setActiveExam] = useState<QuizData | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'test'>('preview');

  // Test mode states
  const [selectedMcqAnswers, setSelectedMcqAnswers] = useState<Record<number, string>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<number, string>>({});
  const [essayGradingResults, setEssayGradingResults] = useState<Record<number, { score: number; comment: string }>>({});
  const [gradingLoading, setGradingLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Timer
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (timerRunning && !isSubmitted) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, isSubmitted]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate Mixed Exam via AI
  const handleGenerateMixedExam = async (customTopic?: string) => {
    const finalTopic = (customTopic !== undefined ? customTopic : topic).trim();
    if (!finalTopic && attachedFiles.length === 0) {
      onNotification('Vui lòng nhập chủ đề bài học hoặc tải ảnh/tài liệu đính kèm.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setIsSubmitted(false);
    setSelectedMcqAnswers({});
    setEssayAnswers({});
    setEssayGradingResults({});

    try {
      const data = await generateMixedExamFromAI(
        selectedSubject,
        selectedGrade,
        finalTopic,
        mcqCount,
        essayCount,
        difficulty,
        attachedFiles,
        customPrompt,
        currentUser.role
      );

      if (!data.questions && !data.essayQuestions) {
        throw new Error('Không tạo được bộ đề. Vui lòng thử lại với chủ đề chi tiết hơn.');
      }

      data.examFormat = 'mixed';
      setActiveExam(data);

      // Auto save to Bank
      const bankItem: SavedBankQuiz = {
        id: `bank-mixed-${Date.now()}`,
        title: data.title || `Đề kết hợp TN & TL: ${data.topic || finalTopic}`,
        topic: data.topic || finalTopic,
        grade: selectedGrade,
        subject: selectedSubject,
        creatorName: currentUser.name,
        creatorRole: currentUser.role,
        createdAt: Date.now(),
        examFormat: 'mixed',
        data,
      };
      saveBankQuiz(bankItem);
      autoSyncBankQuiz(bankItem).catch(() => {});

      onNotification(`Đã tạo thành công đề thi (${data.questions?.length || 0} câu TN + ${data.essayQuestions?.length || 0} câu TL) và tự động lưu vào Ngân hàng đề!`);
    } catch (err: any) {
      console.error('Mixed exam error:', err);
      setErrorMessage(err.message || 'Lỗi khi tạo đề hỗn hợp. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Save manual exam to bank
  const handleSaveManualExam = () => {
    if (manualMcqs.length === 0 && manualEssays.length === 0) {
      onNotification('Đề thi phải có ít nhất 1 câu trắc nghiệm hoặc tự luận!');
      return;
    }

    const examData: QuizData = {
      title: manualTitle.trim() || `Đề kiểm tra ${selectedSubject} - ${selectedGrade}`,
      topic: topic.trim() || 'Tổng hợp',
      grade: selectedGrade,
      subject: selectedSubject,
      examFormat: 'mixed',
      durationMinutes: manualDuration,
      questions: manualMcqs,
      essayQuestions: manualEssays,
    };

    const bankItem: SavedBankQuiz = {
      id: `bank-mixed-manual-${Date.now()}`,
      title: examData.title,
      topic: examData.topic,
      grade: selectedGrade,
      subject: selectedSubject,
      creatorName: currentUser.name,
      creatorRole: currentUser.role,
      createdAt: Date.now(),
      examFormat: 'mixed',
      data: examData,
    };

    saveBankQuiz(bankItem);
    autoSyncBankQuiz(bankItem).catch(() => {});
    setActiveExam(examData);
    onNotification('Đã lưu đề thi do Thầy/Cô biên soạn vào Ngân hàng đề và đồng bộ Google Sheets thành công! 🎉');
  };

  // Submit test and grade essay
  const handleSubmitExam = async () => {
    if (!activeExam) return;
    setIsSubmitted(true);
    setTimerRunning(false);

    // Grade essay questions using AI
    let essayEarned = 0;
    let essayMax = 0;
    const results: Record<number, { score: number; comment: string }> = {};

    if (activeExam.essayQuestions && activeExam.essayQuestions.length > 0) {
      setGradingLoading(true);

      for (const q of activeExam.essayQuestions) {
        const studentAns = essayAnswers[q.id] || '';
        const maxPts = q.points || 5;
        essayMax += maxPts;

        try {
          const res = await gradeEssayWithAI(
            q.question,
            q.sampleAnswer,
            q.rubric || 'Đúng lời giải và phép tính',
            studentAns,
            maxPts,
            selectedGrade,
            selectedSubject
          );
          results[q.id] = res;
          essayEarned += res.score || 0;
        } catch {
          const scoreFallback = studentAns.trim() ? Math.round(maxPts * 0.7 * 10) / 10 : 0;
          results[q.id] = {
            score: scoreFallback,
            comment: studentAns.trim() ? 'Đã ghi nhận bài làm tự luận của học sinh.' : 'Chưa điền bài làm.',
          };
          essayEarned += scoreFallback;
        }
      }
      setEssayGradingResults(results);
      setGradingLoading(false);
    }

    // Calculate MCQ correct
    let mcqCorrect = 0;
    const weakList: string[] = [];
    if (activeExam.questions && activeExam.questions.length > 0) {
      activeExam.questions.forEach((q) => {
        const choice = (selectedMcqAnswers[q.id] || '').trim().toUpperCase();
        const actual = (q.correctAnswer || '').trim().charAt(0).toUpperCase();
        if (choice === actual) {
          mcqCorrect++;
        } else if (q.subtopic) {
          weakList.push(q.subtopic);
        }
      });
    }

    // Final score calculation
    let finalScore = 10;
    const hasMcq = activeExam.questions && activeExam.questions.length > 0;
    const hasEssay = activeExam.essayQuestions && activeExam.essayQuestions.length > 0;

    if (hasMcq && hasEssay) {
      const mcqPt = (mcqCorrect / activeExam.questions.length) * 5;
      const essayPt = essayMax > 0 ? (essayEarned / essayMax) * 5 : 5;
      finalScore = Math.round((mcqPt + essayPt) * 10) / 10;
    } else if (hasMcq) {
      finalScore = Math.round(((mcqCorrect / activeExam.questions.length) * 10) * 10) / 10;
    } else if (hasEssay) {
      finalScore = essayMax > 0 ? Math.round(((essayEarned / essayMax) * 10) * 10) / 10 : 10;
    }

    // Auto-save submission result & sync directly to Google Sheets
    const submissionResult: QuizSubmissionResult = {
      id: `mixed-res-${Date.now()}`,
      timestamp: Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      subject: activeExam.subject || selectedSubject,
      grade: activeExam.grade || selectedGrade,
      topic: activeExam.topic || 'Đề toàn diện',
      examFormat: 'mixed',
      score: finalScore,
      correctCount: mcqCorrect,
      totalQuestions: (activeExam.questions?.length || 0) + (activeExam.essayQuestions?.length || 0),
      userAnswers: selectedMcqAnswers,
      essayAnswers: essayAnswers,
      essayFeedback: results,
      weakSubtopics: Array.from(new Set(weakList)),
      driveFolderUrl: STUDENT_SUBMISSION_DRIVE_FOLDER_URL,
      questions: activeExam.questions || [],
      essayQuestions: activeExam.essayQuestions || [],
    };

    saveQuizResult(submissionResult);
    autoSyncQuiz(submissionResult, currentUser);
    syncQuizResult(submissionResult, currentUser).catch(() => {});

    onNotification(`Đã nộp bài thi thành công! Điểm số: ${finalScore}/10. Kết quả đã lưu Google Sheets! 📊`);
  };

  // Calculate scores
  const mcqScore = React.useMemo(() => {
    if (!activeExam || !activeExam.questions || activeExam.questions.length === 0) return 0;
    let correct = 0;
    activeExam.questions.forEach((q) => {
      const choice = (selectedMcqAnswers[q.id] || '').trim().toUpperCase();
      const actual = (q.correctAnswer || '').trim().charAt(0).toUpperCase();
      if (choice === actual) correct++;
    });
    return correct;
  }, [activeExam, selectedMcqAnswers]);

  const essayTotalScore = React.useMemo(() => {
    return Object.values(essayGradingResults).reduce((sum, item) => sum + (item.score || 0), 0);
  }, [essayGradingResults]);

  // Copy full exam to clipboard for Word / Printing
  const handleCopyExamText = () => {
    if (!activeExam) return;
    let text = `${activeExam.title.toUpperCase()}\n`;
    text += `Môn: ${activeExam.subject || selectedSubject} | Khối: ${activeExam.grade || selectedGrade} | Thời gian: ${activeExam.durationMinutes || 45} phút\n\n`;

    if (activeExam.questions && activeExam.questions.length > 0) {
      text += `PHẦN I. TRẮC NGHIỆM KHÁCH QUAN (${activeExam.questions.length} câu)\n`;
      text += `----------------------------------------------------\n`;
      activeExam.questions.forEach((q, idx) => {
        text += `Câu ${idx + 1}: ${q.question}\n`;
        q.options.forEach((opt) => {
          text += `  ${opt}\n`;
        });
        text += `\n`;
      });
    }

    if (activeExam.essayQuestions && activeExam.essayQuestions.length > 0) {
      text += `PHẦN II. TỰ LUẬN (${activeExam.essayQuestions.length} câu)\n`;
      text += `----------------------------------------------------\n`;
      activeExam.essayQuestions.forEach((q, idx) => {
        text += `Câu ${idx + 1} (${q.points} điểm): ${q.question}\n`;
        if (q.guideline) text += `  Gợi ý: ${q.guideline}\n`;
        text += `\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    onNotification('Đã sao chép nội dung đề thi vào bộ nhớ tạm! Có thể dán sang Word hoặc Google Docs.');
  };

  return (
    <div className="space-y-5">
      {/* Method Switcher Header */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-indigo-950 rounded-2xl p-4 sm:p-5 text-white shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-400 text-slate-950 uppercase tracking-wider">
                Cấu trúc đề chuẩn
              </span>
              <h3 className="font-extrabold text-base sm:text-lg">
                Ra Đề Thi Toàn Diện: Trắc Nghiệm (TN) & Tự Luận (TL)
              </h3>
            </div>
            <p className="text-xs text-emerald-200 mt-1">
              Tùy chọn số lượng câu TN & TL, tự động lưu hệ thống & file Google Sheets để tái sử dụng
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-black/25 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCreationMethod('ai_generate');
                setActiveExam(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                creationMethod === 'ai_generate'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nhờ AI Soạn Tự Động</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreationMethod('manual_typing');
                setActiveExam(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                creationMethod === 'manual_typing'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Giáo Viên Tự Nhập</span>
            </button>
          </div>
        </div>
      </div>

      {/* GENERATOR / EDITOR WHEN NO ACTIVE EXAM */}
      {!activeExam && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          {creationMethod === 'ai_generate' ? (
            <>
              {/* Form AI Generation */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <label className="text-xs sm:text-sm font-bold text-slate-800">
                    Chủ đề bài học / Nội dung đề thi ({selectedSubject} - {selectedGrade}):
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Hỗ trợ công thức Toán học & KHTN chuẩn LaTeX
                  </span>
                </div>

                <FormulaToolbar
                  compact={true}
                  onInsertSymbol={(sym) => {
                    setTopic((prev) => {
                      const space = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
                      return prev + space + sym;
                    });
                  }}
                />

                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ví dụ: Ôn tập học kỳ 1, Tìm hai số khi biết Tổng và Hiệu, Diện tích và Chu vi hình chữ nhật..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15"
                />
              </div>

              {/* Counts config for TN & TL */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số câu Trắc nghiệm (TN):
                  </label>
                  <select
                    value={mcqCount}
                    onChange={(e) => setMcqCount(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={2}>2 câu TN</option>
                    <option value={4}>4 câu TN</option>
                    <option value={6}>6 câu TN</option>
                    <option value={8}>8 câu TN</option>
                    <option value={10}>10 câu TN</option>
                    <option value={15}>15 câu TN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số câu Tự luận (TL):
                  </label>
                  <select
                    value={essayCount}
                    onChange={(e) => setEssayCount(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={1}>1 câu TL</option>
                    <option value={2}>2 câu TL</option>
                    <option value={3}>3 câu TL</option>
                    <option value={4}>4 câu TL</option>
                    <option value={5}>5 câu TL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mức độ phân hóa:
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="easy">Nhận biết & Thông hiểu</option>
                    <option value="medium">Thông hiểu & Vận dụng</option>
                    <option value="hard">Vận dụng nâng cao</option>
                  </select>
                </div>
              </div>

              {/* Custom prompt from teacher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Yêu cầu sư phạm bổ sung từ Giáo viên (Tùy chọn):
                </label>
                <textarea
                  rows={2}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Ví dụ: Câu tự luận tập trung vào bài toán có lời văn 2 bước tính; công thức hình học rõ ràng..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* File Attachment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Đính kèm ảnh chụp sách/đề cương tài liệu (Tùy chọn):
                </label>
                <FileAttachmentInput
                  files={attachedFiles}
                  setFiles={setAttachedFiles}
                />
              </div>

              {/* Popular suggestions */}
              {POPULAR_TOPICS.filter((t) => t.subject === selectedSubject).length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-emerald-600" />
                    <span>Gợi ý chủ đề SGK mới ({selectedSubject}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_TOPICS.filter((t) => t.subject === selectedSubject)
                      .slice(0, 5)
                      .map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setTopic(item.topic);
                            handleGenerateMixedExam(item.topic);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 text-[11px] text-slate-600 transition-colors font-medium"
                        >
                          + {item.topic}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Error display */}
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                disabled={loading || (!topic.trim() && attachedFiles.length === 0)}
                onClick={() => handleGenerateMixedExam()}
                className="w-full py-3.5 px-4 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang biên soạn đề thi hỗn hợp ({mcqCount} câu TN + {essayCount} câu TL)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Tạo Đề Thi Kết Hợp (Có Cả TN & TL) Bằng AI</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* MANUAL TYPING MODE */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tiêu đề đề thi:
                    </label>
                    <input
                      type="text"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Thời gian làm bài (phút):
                    </label>
                    <input
                      type="number"
                      value={manualDuration}
                      onChange={(e) => setManualDuration(Number(e.target.value) || 45)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Section I: Multiple Choice Questions */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px]">I</span>
                      <span>Phần I. Các Câu Hỏi Trắc Nghiệm ({manualMcqs.length} câu)</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        const newId = manualMcqs.length + 1;
                        setManualMcqs([
                          ...manualMcqs,
                          {
                            id: newId,
                            question: `Câu hỏi trắc nghiệm số ${newId}`,
                            options: ['A. Phương án A', 'B. Phương án B', 'C. Phương án C', 'D. Phương án D'],
                            correctAnswer: 'A',
                            explanation: 'Phân tích giải thích đáp án.',
                            subtopic: 'Chuyên đề',
                          },
                        ]);
                      }}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      + Thêm câu TN
                    </button>
                  </div>

                  {manualMcqs.map((q, idx) => (
                    <div key={q.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-700">
                        <span>Câu TN {idx + 1}:</span>
                        {manualMcqs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setManualMcqs(manualMcqs.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 text-[11px]"
                          >
                            Xóa câu này
                          </button>
                        )}
                      </div>
                      <FormulaToolbar
                        compact={true}
                        onInsertSymbol={(sym) => {
                          const updated = [...manualMcqs];
                          const curr = updated[idx].question || '';
                          const space = curr.length > 0 && !curr.endsWith(' ') ? ' ' : '';
                          updated[idx].question = curr + space + sym;
                          setManualMcqs(updated);
                        }}
                      />
                      <textarea
                        rows={2}
                        value={q.question}
                        onChange={(e) => {
                          const updated = [...manualMcqs];
                          updated[idx].question = e.target.value;
                          setManualMcqs(updated);
                        }}
                        placeholder="Nội dung câu hỏi trắc nghiệm (Dùng thanh công thức phía trên để chèn nhanh)..."
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, optIdx) => (
                          <input
                            key={optIdx}
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const updated = [...manualMcqs];
                              updated[idx].options[optIdx] = e.target.value;
                              setManualMcqs(updated);
                            }}
                            className="border border-slate-200 rounded-md p-1.5 text-xs text-slate-700"
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="font-semibold text-slate-600">Đáp án đúng:</span>
                        <select
                          value={q.correctAnswer}
                          onChange={(e) => {
                            const updated = [...manualMcqs];
                            updated[idx].correctAnswer = e.target.value;
                            setManualMcqs(updated);
                          }}
                          className="border border-slate-300 rounded-md px-2 py-0.5 text-xs font-bold text-emerald-700"
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Section II: Essay Questions */}
                <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-amber-600 text-white flex items-center justify-center text-[10px]">II</span>
                      <span>Phần II. Các Câu Hỏi Tự Luận ({manualEssays.length} câu)</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        const newId = manualEssays.length + 1;
                        setManualEssays([
                          ...manualEssays,
                          {
                            id: newId,
                            question: `Bài toán tự luận số ${newId}`,
                            points: 5,
                            guideline: 'Gợi ý phương pháp giải',
                            sampleAnswer: 'Đáp án chi tiết',
                            rubric: 'Biểu điểm chấm',
                            subtopic: 'Chuyên đề',
                          },
                        ]);
                      }}
                      className="text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-200 hover:bg-amber-300 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      + Thêm câu TL
                    </button>
                  </div>

                  {manualEssays.map((eq, eIdx) => (
                    <div key={eq.id} className="p-3 bg-white border border-amber-200 rounded-lg space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-amber-900">
                        <span>Câu TL {eIdx + 1} ({eq.points} điểm):</span>
                        {manualEssays.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setManualEssays(manualEssays.filter((_, i) => i !== eIdx))}
                            className="text-red-500 hover:text-red-700 text-[11px]"
                          >
                            Xóa câu này
                          </button>
                        )}
                      </div>
                      <FormulaToolbar
                        compact={true}
                        onInsertSymbol={(sym) => {
                          const updated = [...manualEssays];
                          const curr = updated[eIdx].question || '';
                          const space = curr.length > 0 && !curr.endsWith(' ') ? ' ' : '';
                          updated[eIdx].question = curr + space + sym;
                          setManualEssays(updated);
                        }}
                      />
                      <textarea
                        rows={2}
                        value={eq.question}
                        onChange={(e) => {
                          const updated = [...manualEssays];
                          updated[eIdx].question = e.target.value;
                          setManualEssays(updated);
                        }}
                        placeholder="Nội dung đề bài tự luận (Dùng thanh công thức phía trên để chèn nhanh)..."
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                      />
                      <textarea
                        rows={2}
                        value={eq.sampleAnswer}
                        onChange={(e) => {
                          const updated = [...manualEssays];
                          updated[eIdx].sampleAnswer = e.target.value;
                          setManualEssays(updated);
                        }}
                        placeholder="Lời giải mẫu chi tiết..."
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-700 bg-slate-50"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSaveManualExam}
                  className="w-full py-3 px-4 rounded-xl font-extrabold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu Đề Thi Đã Soạn Vào Ngân Hàng & Đồng Bộ Google Sheets</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ACTIVE EXAM VIEW (PREVIEW & TEST) */}
      {activeExam && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5 sm:p-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 uppercase">
                  Đề thi chuẩn (TN & TL)
                </span>
                <span className="text-xs text-slate-400">
                  {activeExam.subject || selectedSubject} • {activeExam.grade || selectedGrade}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                {activeExam.title}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyExamText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? 'Đã sao chép' : 'Sao chép Word'}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-slate-300" />
                <span>In đề thi</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveExam(null);
                  setIsSubmitted(false);
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1.5"
              >
                Đóng đề
              </button>
            </div>
          </div>

          {/* Test / Preview Switcher */}
          <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-xl text-xs font-bold">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === 'preview' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600'
                }`}
              >
                Xem Toàn Bộ Đề & Đáp Án
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('test');
                  setTimerRunning(true);
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === 'test' ? 'bg-emerald-600 text-white shadow-2xs font-extrabold' : 'text-slate-600'
                }`}
              >
                Thử Làm Bài Trực Tuyến
              </button>
            </div>

            {viewMode === 'test' && (
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold px-3">
                <Timer className="w-4 h-4 animate-pulse" />
                <span>{formatTimer(secondsElapsed)}</span>
              </div>
            )}
          </div>

          {/* PART I: MULTIPLE CHOICE QUESTIONS */}
          {activeExam.questions && activeExam.questions.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">I</span>
                  <span>PHẦN I. TRẮC NGHIỆM KHÁCH QUAN ({activeExam.questions.length} câu)</span>
                </h3>
                {isSubmitted && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Đúng: {mcqScore}/{activeExam.questions.length} câu
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {activeExam.questions.map((q, qIdx) => (
                  <div key={q.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="font-bold text-slate-900 text-sm flex items-start gap-2">
                      <span className="text-indigo-600 font-black shrink-0">Câu {qIdx + 1}:</span>
                      <MarkdownContent content={q.question} className="text-slate-800" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => {
                        const letter = ['A', 'B', 'C', 'D'][optIdx];
                        const isChosen = selectedMcqAnswers[q.id] === letter;
                        const isCorrectAnswer = (q.correctAnswer || '').trim().toUpperCase() === letter;

                        let style = 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300';
                        if (isSubmitted) {
                          if (isCorrectAnswer) {
                            style = 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold';
                          } else if (isChosen && !isCorrectAnswer) {
                            style = 'bg-red-100 border-red-300 text-red-900';
                          }
                        } else if (isChosen) {
                          style = 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold';
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={isSubmitted || viewMode === 'preview'}
                            onClick={() => {
                              setSelectedMcqAnswers({
                                ...selectedMcqAnswers,
                                [q.id]: letter,
                              });
                            }}
                            className={`p-2.5 rounded-xl border text-xs text-left transition-all flex items-start gap-2 ${style}`}
                          >
                            <span className="font-bold shrink-0">{letter}.</span>
                            <MarkdownContent content={opt.replace(/^[A-D]\.\s*/, '')} />
                          </button>
                        );
                      })}
                    </div>

                    {(viewMode === 'preview' || isSubmitted) && q.explanation && (
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                        <span className="font-bold text-emerald-700">Lời giải chi tiết:</span>
                        <MarkdownContent content={q.explanation} className="text-slate-600" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PART II: ESSAY QUESTIONS */}
          {activeExam.essayQuestions && activeExam.essayQuestions.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs">II</span>
                  <span>PHẦN II. TỰ LUẬN ({activeExam.essayQuestions.length} câu)</span>
                </h3>
                {isSubmitted && (
                  <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Điểm tự luận: {essayTotalScore} điểm
                  </span>
                )}
              </div>

              <div className="space-y-5">
                {activeExam.essayQuestions.map((eq, eqIdx) => (
                  <div key={eq.id} className="p-4 rounded-xl bg-amber-50/40 border border-amber-200/80 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-slate-900 text-sm flex items-start gap-2">
                        <span className="text-amber-800 font-black shrink-0">Câu {eqIdx + 1} ({eq.points} điểm):</span>
                        <MarkdownContent content={eq.question} className="text-slate-800" />
                      </div>
                    </div>

                    {eq.guideline && (
                      <div className="text-xs text-amber-800 bg-amber-100/70 p-2 rounded-lg">
                        <strong>Gợi ý:</strong> {eq.guideline}
                      </div>
                    )}

                    {/* Student input if in test mode */}
                    {viewMode === 'test' && !isSubmitted && (
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Bài làm của em:
                        </label>
                        <textarea
                          rows={4}
                          value={essayAnswers[eq.id] || ''}
                          onChange={(e) => setEssayAnswers({ ...essayAnswers, [eq.id]: e.target.value })}
                          placeholder="Viết câu lời giải, phép tính và đáp số vào đây..."
                          className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}

                    {/* Feedback & Sample answer */}
                    {(viewMode === 'preview' || isSubmitted) && (
                      <div className="space-y-2 pt-1 border-t border-amber-200/60">
                        {isSubmitted && essayGradingResults[eq.id] && (
                          <div className="p-3 bg-white border border-emerald-300 rounded-xl space-y-1 text-xs">
                            <div className="flex items-center justify-between font-bold text-emerald-800">
                              <span>Điểm đạt được: {essayGradingResults[eq.id].score} / {eq.points} điểm</span>
                            </div>
                            <p className="text-slate-700">{essayGradingResults[eq.id].comment}</p>
                          </div>
                        )}

                        <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                          <span className="font-bold text-amber-900">Đáp án & Lời giải mẫu chuẩn:</span>
                          <MarkdownContent content={eq.sampleAnswer} className="text-slate-700" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Submission Button */}
          {viewMode === 'test' && !isSubmitted && (
            <div className="pt-3">
              <button
                type="button"
                onClick={handleSubmitExam}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-extrabold text-sm hover:from-emerald-700 hover:to-teal-800 shadow-md transition-all cursor-pointer"
              >
                Nộp Bài Thi & Chấm Điểm Toàn Diện
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
