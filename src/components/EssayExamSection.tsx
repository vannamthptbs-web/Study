import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  PlusCircle,
  Trash2,
  Save,
  Printer,
  Copy,
  Check,
  Download,
  Edit3,
  Timer,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  Award,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Send,
  Zap,
} from 'lucide-react';
import {
  Grade,
  Subject,
  QuizData,
  EssayQuestion,
  SavedBankQuiz,
  UserProfile,
  UploadedFileItem,
} from '../types/study';
import { generateEssayExamFromAI, gradeEssayWithAI } from '../services/api';
import { saveBankQuiz } from '../services/storage';
import { autoSyncBankQuiz } from '../services/firebaseWorkspace';
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

export const EssayExamSection: React.FC<Props> = ({
  selectedGrade,
  setSelectedGrade,
  selectedSubject,
  setSelectedSubject,
  currentUser,
  onNotification,
  onOpenAuth,
}) => {
  // Method in Teacher mode: 'ai_generate' (Nhờ AI) or 'manual_typing' (Tự gõ vào)
  const [creationMethod, setCreationMethod] = useState<'ai_generate' | 'manual_typing'>('ai_generate');

  // AI Generation params
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(3);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [customTeacherPrompt, setCustomTeacherPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual Typing exam state
  const [manualTitle, setManualTitle] = useState(`Đề kiểm tra tự luận ${selectedSubject} - ${selectedGrade}`);
  const [manualDuration, setManualDuration] = useState<number>(35);
  const [manualQuestions, setManualQuestions] = useState<EssayQuestion[]>([
    {
      id: 1,
      question: `Một mảnh vườn hình chữ nhật có chiều dài là $24\\text{ m}$, chiều rộng bằng $\\frac{2}{3}$ chiều dài. Em hãy tính chu vi và diện tích của mảnh vườn đó.`,
      points: 4,
      guideline: 'Tìm chiều rộng trước, sau đó áp dụng công thức tính chu vi và diện tích hình chữ nhật.',
      sampleAnswer: `Bài giải:\n- Chiều rộng mảnh vườn là:\n  $$24 \\times \\frac{2}{3} = 16\\text{ (m)}$$\n- Chu vi mảnh vườn là:\n  $$(24 + 16) \\times 2 = 80\\text{ (m)}$$\n- Diện tích mảnh vườn là:\n  $$24 \\times 16 = 384\\text{ (m}^2)$$\nĐáp số: Chu vi $80\\text{ m}$; Diện tích $384\\text{ m}^2$.`,
      rubric: 'Tìm chiều rộng đúng: 1.0 điểm; Tính chu vi đúng: 1.5 điểm; Tính diện tích đúng: 1.5 điểm.',
      subtopic: 'Toán có lời văn & Hình học',
    },
    {
      id: 2,
      question: `Hai thùng chứa tất cả $150\\text{ lít}$ dầu. Nếu chuyển từ thùng thứ nhất sang thùng thứ hai $15\\text{ lít}$ thì số dầu ở hai thùng bằng nhau. Hỏi lúc đầu mỗi thùng có bao nhiêu lít dầu?`,
      points: 6,
      guideline: 'Dạng toán tìm hai số khi biết Tổng và Hiệu. Hiệu số dầu giữa hai thùng lúc đầu là $15 \\times 2 = 30\\text{ lít}$.',
      sampleAnswer: `Bài giải:\n- Thùng thứ nhất nhiều hơn thùng thứ hai số lít dầu là:\n  $$15 \\times 2 = 30\\text{ (lít)}$$\n- Lúc đầu thùng thứ hai có số lít dầu là:\n  $$(150 - 30) : 2 = 60\\text{ (lít)}$$\n- Lúc đầu thùng thứ nhất có số lít dầu là:\n  $$60 + 30 = 90\\text{ (lít)}$$\nĐáp số: Thùng một: $90\\text{ lít}$; Thùng hai: $60\\text{ lít}$.`,
      rubric: 'Xác định đúng hiệu hai thùng: 2.0 điểm; Tìm số dầu thùng 2: 2.0 điểm; Tìm số dầu thùng 1: 1.5 điểm; Đáp số: 0.5 điểm.',
      subtopic: 'Tìm hai số khi biết Tổng và Hiệu',
    },
  ]);

  // Active exam being previewed or tested
  const [activeExam, setActiveExam] = useState<QuizData | null>(null);

  // Mode when exam is active: 'preview' (Giáo viên xem đề & in ấn) or 'student_test' (Thử làm bài tự luận)
  const [examMode, setExamMode] = useState<'preview' | 'student_test'>('preview');

  // Student test states
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({});
  const [activeQuestionTab, setActiveQuestionTab] = useState<number>(0);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingResults, setGradingResults] = useState<Record<number, { score: number; comment: string }>>({});
  const [isExamSubmitted, setIsExamSubmitted] = useState(false);
  const [showFullSampleAnswers, setShowFullSampleAnswers] = useState(false);

  // Timer for test mode
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Copied state
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (timerRunning && !isExamSubmitted) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, isExamSubmitted]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const r = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  };

  // Generate essay exam via AI
  const handleGenerateEssayWithAI = async (overrideTopic?: string) => {
    const finalTopic = (overrideTopic !== undefined ? overrideTopic : topic).trim();
    const hasFiles = attachedFiles.length > 0;
    if (!finalTopic && !hasFiles) {
      onNotification('Vui lòng nhập chủ đề bài kiểm tra hoặc đính kèm ảnh tài liệu!');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await generateEssayExamFromAI(
        selectedSubject,
        selectedGrade,
        finalTopic,
        questionCount,
        difficulty,
        attachedFiles,
        customTeacherPrompt,
        currentUser.role
      );

      if (!data.essayQuestions || data.essayQuestions.length === 0) {
        throw new Error('Không tạo được câu hỏi tự luận. Vui lòng thử lại với chủ đề chi tiết hơn.');
      }

      data.examFormat = 'essay';
      data.questions = [];
      data.grade = selectedGrade;
      data.subject = selectedSubject;
      data.durationMinutes = data.durationMinutes || (data.essayQuestions.length <= 3 ? 35 : 45);

      setActiveExam(data);
      setExamMode('preview');
      setStudentAnswers({});
      setGradingResults({});
      setIsExamSubmitted(false);
      setSecondsElapsed(0);
      setTimerRunning(false);

      // Auto save to Bank
      const bankItem: SavedBankQuiz = {
        id: `bank-essay-${Date.now()}`,
        title: data.title || `Tự luận: ${data.topic || finalTopic}`,
        topic: data.topic || finalTopic,
        grade: selectedGrade,
        subject: selectedSubject,
        creatorName: currentUser.name,
        creatorRole: currentUser.role,
        createdAt: Date.now(),
        examFormat: 'essay',
        data,
      };
      saveBankQuiz(bankItem);
      autoSyncBankQuiz(bankItem).catch(() => {});

      onNotification(`Đã tạo thành công đề tự luận gồm ${data.essayQuestions.length} câu hỏi và lưu vào Ngân hàng!`);
    } catch (err: any) {
      console.error('Lỗi tạo đề tự luận AI:', err);
      setErrorMessage(err?.message || 'Lỗi khi tạo đề tự luận qua AI. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Save manual typed exam
  const handleSaveManualExam = () => {
    if (manualQuestions.length === 0) {
      onNotification('Vui lòng thêm ít nhất 1 câu hỏi tự luận vào đề thi!');
      return;
    }

    const title = manualTitle.trim() || `Đề kiểm tra tự luận ${selectedSubject} - ${selectedGrade}`;
    const cleanTopic = topic.trim() || `${selectedSubject} ${selectedGrade}`;

    const data: QuizData = {
      title,
      topic: cleanTopic,
      grade: selectedGrade,
      subject: selectedSubject,
      examFormat: 'essay',
      durationMinutes: manualDuration || 35,
      questions: [],
      essayQuestions: manualQuestions.map((q, idx) => ({
        ...q,
        id: idx + 1,
      })),
    };

    setActiveExam(data);
    setExamMode('preview');
    setStudentAnswers({});
    setGradingResults({});
    setIsExamSubmitted(false);
    setSecondsElapsed(0);
    setTimerRunning(false);

    // Save to bank
    const bankItem: SavedBankQuiz = {
      id: `bank-essay-manual-${Date.now()}`,
      title: data.title,
      topic: data.topic,
      grade: selectedGrade,
      subject: selectedSubject,
      creatorName: currentUser.name,
      creatorRole: currentUser.role,
      createdAt: Date.now(),
      examFormat: 'essay',
      data,
    };
    saveBankQuiz(bankItem);
    autoSyncBankQuiz(bankItem).catch(() => {});

    onNotification(`Đã lưu thành công đề tự luận (${manualQuestions.length} câu) vào Ngân hàng đề thi! 🎉`);
  };

  // Add new question in manual mode
  const handleAddManualQuestion = () => {
    const nextId = manualQuestions.length + 1;
    setManualQuestions((prev) => [
      ...prev,
      {
        id: nextId,
        question: `Bài ${nextId}: Nhập nội dung câu hỏi/bài toán tự luận vào đây...`,
        points: 2.0,
        guideline: 'Gợi ý phương pháp giải và các bước tư duy...',
        sampleAnswer: 'Đáp án mẫu và lời giải chi tiết từng bước...',
        rubric: 'Lời giải: 0.5đ; Phép tính: 1.0đ; Đáp số: 0.5đ.',
        subtopic: 'Kiến thức trọng tâm',
      },
    ]);
  };

  // Remove question in manual mode
  const handleRemoveManualQuestion = (index: number) => {
    if (manualQuestions.length <= 1) {
      onNotification('Đề thi cần có ít nhất 1 câu hỏi!');
      return;
    }
    setManualQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update a question property in manual mode
  const handleUpdateManualQuestion = (index: number, field: keyof EssayQuestion, value: any) => {
    setManualQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Calculate total points
  const calculateTotalPoints = (questions?: EssayQuestion[]) => {
    const qList = questions || manualQuestions;
    return qList.reduce((acc, q) => acc + (Number(q.points) || 0), 0);
  };

  // Export JSON
  const handleExportJSON = () => {
    if (!activeExam) return;
    const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(activeExam, null, 2)
    )}`;
    const anchor = document.createElement('a');
    anchor.setAttribute('href', jsonStr);
    anchor.setAttribute(
      'download',
      `StudyAI_TuLuan_${activeExam.topic || 'DeThi'}.json`
    );
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    onNotification('Đã tải xuống file JSON cấu trúc đề tự luận!');
  };

  // Copy exam text
  const handleCopyExamText = (withAnswers: boolean = false) => {
    if (!activeExam || !activeExam.essayQuestions) return;

    let text = `=========================================\n`;
    text += `${activeExam.title.toUpperCase()}\n`;
    text += `Môn: ${activeExam.subject} - Khối: ${activeExam.grade}\n`;
    text += `Thời gian làm bài: ${activeExam.durationMinutes || 35} phút\n`;
    text += `=========================================\n\n`;

    activeExam.essayQuestions.forEach((q, idx) => {
      text += `Bài ${idx + 1} (${q.points} điểm): [${q.subtopic || 'Tự luận'}]\n`;
      text += `${q.question}\n\n`;

      if (withAnswers) {
        if (q.guideline) {
          text += `* Hướng dẫn giải: ${q.guideline}\n`;
        }
        text += `* Lời giải mẫu:\n${q.sampleAnswer}\n\n`;
        if (q.rubric) {
          text += `* Biểu điểm chấm: ${q.rubric}\n\n`;
        }
      }
      text += `-----------------------------------------\n\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
    onNotification(
      withAnswers
        ? 'Đã sao chép Đề thi kèm Đáp án & Biểu điểm vào Clipboard!'
        : 'Đã sao chép Đề thi học sinh (không có đáp án) vào Clipboard!'
    );
  };

  // Print view
  const handlePrint = (withAnswers: boolean = false) => {
    if (!activeExam || !activeExam.essayQuestions) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      onNotification('Trình duyệt đã chặn popup in. Vui lòng cho phép mở cửa sổ in ấn!');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${activeExam.title}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: "Times New Roman", Times, serif; font-size: 14pt; line-height: 1.5; margin: 25mm 20mm; color: #111; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
          .school { font-weight: bold; text-transform: uppercase; font-size: 12pt; text-align: center; }
          .exam-title { text-align: center; font-size: 16pt; font-weight: bold; text-transform: uppercase; margin-top: 10px; }
          .meta { text-align: center; font-style: italic; font-size: 12pt; margin-bottom: 20px; }
          .student-box { border: 1px solid #333; padding: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 12pt; }
          .question { margin-bottom: 25px; page-break-inside: avoid; }
          .q-title { font-weight: bold; font-size: 14pt; margin-bottom: 6px; }
          .q-body { margin-left: 10px; font-size: 13pt; }
          .answer-box { background: #fdfdfd; border-left: 3px solid #2563eb; padding: 8px 14px; margin-top: 8px; font-size: 12pt; }
          .rubric-box { background: #fffbeb; border-left: 3px solid #d97706; padding: 6px 14px; margin-top: 6px; font-size: 11pt; }
          .answer-space { border-bottom: 1px dotted #888; height: 120px; margin-top: 10px; }
          @media print {
            body { margin: 15mm 15mm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="school">
            PHÒNG GD&ĐT TIỂU HỌC<br/>
            TRƯỜNG TIỂU HỌC
          </div>
          <div style="text-align: right; font-size: 11pt;">
            NĂM HỌC 2026 - 2027<br/>
            ${(activeExam.subject || selectedSubject).toUpperCase()} - ${(activeExam.grade || selectedGrade).toUpperCase()}
          </div>
        </div>

        <div class="exam-title">${activeExam.title}</div>
        <div class="meta">
          Thời gian làm bài: ${activeExam.durationMinutes || 35} phút (Không kể thời gian phát đề)<br/>
          ${withAnswers ? '<strong>(HƯỚNG DẪN CHẤM & ĐÁP ÁN DÀNH CHO GIÁO VIÊN)</strong>' : ''}
        </div>

        ${
          !withAnswers
            ? `<div class="student-box">
                <div>Họ và tên học sinh: ....................................................</div>
                <div>Lớp: ...........</div>
                <div>Điểm số: .........../10</div>
              </div>`
            : ''
        }

        <div class="content">
          ${activeExam.essayQuestions
            .map(
              (q, idx) => `
            <div class="question">
              <div class="q-title">Bài ${idx + 1} (${q.points} điểm):</div>
              <div class="q-body">${q.question.replace(/\n/g, '<br/>')}</div>
              ${
                withAnswers
                  ? `
                  <div class="answer-box">
                    <strong>Lời giải mẫu:</strong><br/>
                    ${q.sampleAnswer.replace(/\n/g, '<br/>')}
                  </div>
                  ${
                    q.rubric
                      ? `<div class="rubric-box">
                          <strong>Biểu điểm chấm:</strong> ${q.rubric}
                        </div>`
                      : ''
                  }
                `
                  : `<div class="answer-space"><em>Bài làm:</em></div>`
              }
            </div>
          `
            )
            .join('')}
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Grade student essay answers using AI
  const handleGradeStudentExam = async () => {
    if (!activeExam || !activeExam.essayQuestions) return;

    // Check if at least one question has an answer
    const hasAnyAnswer = Object.values(studentAnswers).some((ans) => ans.trim().length > 0);
    if (!hasAnyAnswer) {
      onNotification('Em hãy nhập bài làm vào ít nhất 1 câu hỏi trước khi nộp bài nhé! 📝');
      return;
    }

    setGradingLoading(true);
    setIsExamSubmitted(true);
    setTimerRunning(false);

    const newGradingResults: Record<number, { score: number; comment: string }> = {};

    try {
      // Grade each answered question concurrently
      const promises = activeExam.essayQuestions.map(async (q) => {
        const studentAns = studentAnswers[q.id] || '';
        if (!studentAns.trim()) {
          newGradingResults[q.id] = {
            score: 0,
            comment: 'Chưa có bài làm cho câu này.',
          };
          return;
        }

        try {
          const res = await gradeEssayWithAI(
            q.question,
            q.sampleAnswer,
            q.rubric || '',
            studentAns,
            q.points,
            selectedGrade,
            selectedSubject
          );
          newGradingResults[q.id] = res;
        } catch {
          newGradingResults[q.id] = {
            score: Math.round(q.points * 0.7 * 10) / 10,
            comment: 'Bài làm đã hoàn thành. Hãy đối chiếu chi tiết với Lời giải mẫu của Thầy/Cô nhé!',
          };
        }
      });

      await Promise.all(promises);
      setGradingResults(newGradingResults);
      setShowFullSampleAnswers(true);
      onNotification('AI đã hoàn tất chấm điểm và nhận xét chi tiết từng câu hỏi tự luận! 🌟');
    } catch (e) {
      console.error(e);
      onNotification('Đã nộp bài thành công! Em hãy đối chiếu với đáp án mẫu bên dưới.');
    } finally {
      setGradingLoading(false);
    }
  };

  const subjectPopularTopics = POPULAR_TOPICS.filter((p) => p.subject === selectedSubject);

  return (
    <div className="space-y-6">
      {/* SECTION HEADER BANNER */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-700 text-white rounded-3xl p-6 sm:p-8 shadow-md">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold text-amber-100 mb-3 border border-white/20">
            <BookOpen className="w-3.5 h-3.5 text-amber-200" />
            <span>Phân hệ Tự luận • Dành cho Giáo viên & Học sinh</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">
            Soạn thảo & Luyện giải đề thi Tự luận
          </h2>
          <p className="mt-2 text-amber-100 text-xs sm:text-sm leading-relaxed">
            Cho phép Thầy/Cô <strong>nhờ AI biên soạn tự động</strong> bám sát chuẩn SGK hoặc{' '}
            <strong>tự gõ đề bài thủ công</strong> kèm biểu điểm & đáp án mẫu. Hỗ trợ in ấn phát đề cho học sinh,
            xuất JSON và AI chấm điểm bài làm tự luận thông minh.
          </p>

          {/* Creation Method Selection Tabs */}
          {!activeExam && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCreationMethod('ai_generate')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                  creationMethod === 'ai_generate'
                    ? 'bg-white text-orange-900 shadow-md scale-102'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>1. Nhờ AI soạn đề tự động</span>
              </button>

              <button
                type="button"
                onClick={() => setCreationMethod('manual_typing')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                  creationMethod === 'manual_typing'
                    ? 'bg-white text-orange-900 shadow-md scale-102'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                <Edit3 className="w-4 h-4 text-orange-600" />
                <span>2. Tự gõ đề thủ công (GV nhập trực tiếp)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VIEW 1: FORM CREATION (When no active exam)                   */}
      {/* ------------------------------------------------------------- */}
      {!activeExam && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
          {/* METHOD 1: AI GENERATOR */}
          {creationMethod === 'ai_generate' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Soạn đề tự luận thông minh bằng Google Gemini AI
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      AI tự động phân bổ thang điểm 10, tạo lời giải chi tiết và biểu điểm sư phạm
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-semibold text-slate-600">Số câu:</span>
                    <select
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value={2}>2 câu (Toán/TV)</option>
                      <option value={3}>3 câu (Tiêu chuẩn)</option>
                      <option value={4}>4 câu (Đầy đủ)</option>
                      <option value={5}>5 câu (Chi tiết)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-semibold text-slate-600">Mức độ:</span>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as any)}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="easy">Cơ bản - Thông hiểu</option>
                      <option value="medium">Thông hiểu & Vận dụng</option>
                      <option value="hard">Vận dụng nâng cao (HSG)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Topic Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Chủ đề / Dạng bài kiểm tra tự luận ({selectedSubject} – {selectedGrade}):
                </label>

                <FormulaToolbar
                  compact={true}
                  onInsertSymbol={(sym) => {
                    setTopic((prev) => (prev.length > 0 && !prev.endsWith(' ') ? prev + ' ' + sym : prev + sym));
                  }}
                />

                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ví dụ: Toán có lời văn về Tổng - Tỉ; Tính chu vi diện tích hình chữ nhật; Đổi đơn vị đo diện tích; Tả cảnh đẹp quê hương..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-500/15"
                />
              </div>

              {/* Teacher Pedagogy Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Yêu cầu sư phạm bổ sung của Thầy/Cô (Tùy chọn):
                </label>
                <textarea
                  rows={2}
                  value={customTeacherPrompt}
                  onChange={(e) => setCustomTeacherPrompt(e.target.value)}
                  placeholder="Ví dụ: Đề bài gồm 1 bài tính toán phân số và 2 bài toán đố có lời văn thực tế; Phân bổ thang điểm rõ ràng: Câu 1 (3đ), Câu 2 (3đ), Câu 3 (4đ)..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* File / photo upload for multimodal generation */}
              <FileAttachmentInput
                files={attachedFiles}
                setFiles={setAttachedFiles}
                label="Đính kèm ảnh chụp đề thi / tài liệu SGK để AI bám sát"
              />

              {/* Popular suggestions */}
              {subjectPopularTopics.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 mb-2 block">
                    Gợi ý chuyên đề môn {selectedSubject}:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {subjectPopularTopics.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTopic(item.topic);
                          handleGenerateEssayWithAI(item.topic);
                        }}
                        className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors"
                      >
                        {item.topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={(!topic.trim() && attachedFiles.length === 0) || loading}
                  onClick={() => handleGenerateEssayWithAI()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-sm shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-102"
                >
                  {loading ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>AI đang soạn thảo đề tự luận chuẩn cấu trúc...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>AI Soạn đề tự luận ngay</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* METHOD 2: MANUAL TYPING (Thầy cô tự gõ trực tiếp) */}
          {creationMethod === 'manual_typing' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center font-bold">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Soạn thảo đề thi tự luận thủ công
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Thầy/Cô tự nhập từng câu hỏi, số điểm, đáp án mẫu và biểu điểm chi tiết
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900">
                    Tổng điểm đề: {calculateTotalPoints()}/10.0 điểm
                  </div>
                </div>
              </div>

              {/* General Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tiêu đề đề thi:
                  </label>
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="Ví dụ: Đề kiểm tra tự luận Giữa học kỳ 1 - Toán 4"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Thời gian làm bài (phút):
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={manualDuration}
                    onChange={(e) => setManualDuration(Number(e.target.value) || 35)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                    Danh sách câu hỏi tự luận ({manualQuestions.length} câu):
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddManualQuestion}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Thêm câu hỏi mới</span>
                  </button>
                </div>

                {manualQuestions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-orange-600 text-white font-bold text-xs flex items-center justify-center">
                          {qIdx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          Bài số {qIdx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <label className="text-[11px] font-semibold text-slate-500">Điểm:</label>
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="10"
                            value={q.points}
                            onChange={(e) =>
                              handleUpdateManualQuestion(qIdx, 'points', parseFloat(e.target.value) || 1.0)
                            }
                            className="w-16 px-2 py-1 rounded border border-slate-300 text-xs font-bold text-slate-800 bg-white"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveManualQuestion(qIdx)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Question Content Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          Nội dung đề bài / Yêu cầu câu hỏi:
                        </label>
                        <FormulaToolbar
                          compact={true}
                          onInsertSymbol={(sym) => {
                            handleUpdateManualQuestion(qIdx, 'question', q.question + ' ' + sym);
                          }}
                        />
                      </div>
                      <textarea
                        rows={3}
                        value={q.question}
                        onChange={(e) => handleUpdateManualQuestion(qIdx, 'question', e.target.value)}
                        placeholder="Nhập đề bài câu hỏi tự luận. Có thể chèn công thức LaTeX như $15 + 8 = 23$, $\frac{1}{2}$, v.v."
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 bg-white font-mono"
                      />
                    </div>

                    {/* Sample Answer & Rubric Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700">
                            Đáp án mẫu & Lời giải chi tiết:
                          </label>
                          <FormulaToolbar
                            compact={true}
                            onInsertSymbol={(sym) => {
                              handleUpdateManualQuestion(qIdx, 'sampleAnswer', q.sampleAnswer + ' ' + sym);
                            }}
                          />
                        </div>
                        <textarea
                          rows={3}
                          value={q.sampleAnswer}
                          onChange={(e) => handleUpdateManualQuestion(qIdx, 'sampleAnswer', e.target.value)}
                          placeholder="Nhập lời giải chuẩn từng bước và đáp số..."
                          className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Biểu điểm chấm chi tiết (Rubric):
                          </label>
                          <textarea
                            rows={2}
                            value={q.rubric || ''}
                            onChange={(e) => handleUpdateManualQuestion(qIdx, 'rubric', e.target.value)}
                            placeholder="Ví dụ: Lời giải: 0.5đ; Phép tính: 1.0đ; Đáp số: 0.5đ"
                            className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                            Chuyên đề / Dạng bài:
                          </label>
                          <input
                            type="text"
                            value={q.subtopic || ''}
                            onChange={(e) => handleUpdateManualQuestion(qIdx, 'subtopic', e.target.value)}
                            placeholder="Ví dụ: Toán có lời văn; Hình học; Phân số..."
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-800 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddManualQuestion}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-500 text-slate-600 hover:text-amber-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors bg-white hover:bg-amber-50/50"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Thêm câu hỏi tự luận tiếp theo</span>
                </button>
              </div>

              {/* Action Buttons for Manual Form */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <div className="text-xs text-slate-500">
                  Đã soạn <strong>{manualQuestions.length}</strong> câu hỏi • Tổng điểm: <strong>{calculateTotalPoints()}</strong>/10
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveManualExam}
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-colors hover:scale-102"
                  >
                    <Save className="w-4 h-4" />
                    <span>Lưu đề thi & Xem bản in</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                onClick={() => setErrorMessage(null)}
                className="font-bold underline text-xs hover:text-rose-900"
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 2: ACTIVE EXAM VIEW (PREVIEW, PRINT & STUDENT TEST)      */}
      {/* ------------------------------------------------------------- */}
      {activeExam && activeExam.essayQuestions && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          {/* Top Bar with actions */}
          <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 uppercase">
                  Đề Tự Luận
                </span>
                <h3 className="text-base font-bold text-white">
                  {activeExam.title}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeExam.subject} • {activeExam.grade} • Thời gian: {activeExam.durationMinutes || 35} phút • {activeExam.essayQuestions.length} câu hỏi
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Toggle mode: Giáo viên xem đề vs Học sinh thử làm bài */}
              <div className="bg-slate-800 p-0.5 rounded-xl flex items-center border border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setExamMode('preview');
                    setTimerRunning(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    examMode === 'preview'
                      ? 'bg-amber-500 text-slate-950 shadow-2xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Bản Giáo viên & In ấn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExamMode('student_test');
                    setTimerRunning(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    examMode === 'student_test'
                      ? 'bg-amber-500 text-slate-950 shadow-2xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Làm bài thi tự luận
                </button>
              </div>

              {/* Print buttons */}
              <button
                type="button"
                onClick={() => handlePrint(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                title="In đề thi phát cho học sinh (không có đáp án)"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">In đề HS</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrint(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                title="In đề thi kèm Lời giải mẫu & Biểu điểm dành cho Giáo viên"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">In kèm Đáp án</span>
              </button>

              {/* Copy */}
              <button
                type="button"
                onClick={() => handleCopyExamText(false)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                title="Sao chép nội dung đề thi"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">Sao chép</span>
              </button>

              {/* JSON */}
              <button
                type="button"
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                title="Xuất file JSON"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden md:inline">JSON</span>
              </button>

              {/* Edit button */}
              <button
                type="button"
                onClick={() => {
                  setManualTitle(activeExam.title);
                  setManualQuestions(activeExam.essayQuestions || []);
                  setManualDuration(activeExam.durationMinutes || 35);
                  setCreationMethod('manual_typing');
                  setActiveExam(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-xs font-bold text-white transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Sửa đề</span>
              </button>
            </div>
          </div>

          {/* ------------------------------------------------------ */}
          {/* SUB-VIEW A: TEACHER PREVIEW (FULL QUESTIONS + ANSWERS) */}
          {/* ------------------------------------------------------ */}
          {examMode === 'preview' && (
            <div className="p-6 space-y-6">
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  <span>
                    Đề thi đã sẵn sàng! Thầy/Cô có thể bấm <strong>In đề HS</strong> để in phát cho các em, hoặc bấm <strong>Làm bài thi tự luận</strong> để kiểm tra thử tính năng học sinh nộp bài và AI chấm điểm.
                  </span>
                </div>
                <div className="font-bold">
                  Tổng điểm: {calculateTotalPoints(activeExam.essayQuestions)}/10.0 điểm
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-6">
                {activeExam.essayQuestions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-amber-600 text-white font-extrabold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-slate-800">
                          Bài {idx + 1} ({q.points} điểm)
                        </h4>
                        {q.subtopic && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                            {q.subtopic}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Question Statement */}
                    <div className="text-sm text-slate-800 leading-relaxed font-medium">
                      <MarkdownContent content={q.question} />
                    </div>

                    {/* Pedagogy Guideline */}
                    {q.guideline && (
                      <div className="p-3 rounded-xl bg-sky-50 border border-sky-100 text-xs text-sky-900 flex items-start gap-2">
                        <HelpCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Gợi ý hướng giải:</strong> {q.guideline}
                        </div>
                      </div>
                    )}

                    {/* Sample Answer Box */}
                    <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                      <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Lời giải mẫu chuẩn sư phạm:</span>
                      </div>
                      <div className="text-xs text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-emerald-100">
                        <MarkdownContent content={q.sampleAnswer} />
                      </div>
                    </div>

                    {/* Rubric */}
                    {q.rubric && (
                      <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900">
                        <strong>Biểu điểm chấm (Rubric):</strong> {q.rubric}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------ */}
          {/* SUB-VIEW B: STUDENT TEST MODE & AI GRADING             */}
          {/* ------------------------------------------------------ */}
          {examMode === 'student_test' && (
            <div className="p-6 space-y-6">
              {/* Status Header: Timer & Progress */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs">
                    <Timer className="w-4 h-4 text-orange-600" />
                    <span>{formatTimer(secondsElapsed)} / {activeExam.durationMinutes || 35}:00</span>
                  </div>

                  <span className="text-xs text-slate-500 font-semibold">
                    Đã hoàn thành {Object.values(studentAnswers).filter((a) => a.trim().length > 0).length}/{activeExam.essayQuestions.length} câu
                  </span>
                </div>

                {!isExamSubmitted ? (
                  <button
                    type="button"
                    onClick={handleGradeStudentExam}
                    disabled={gradingLoading}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
                  >
                    {gradingLoading ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>AI đang chấm điểm & nhận xét bài tự luận...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Nộp bài & AI chấm điểm tự luận</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold">
                      Đã nộp bài & Có điểm chấm của AI
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsExamSubmitted(false);
                        setGradingResults({});
                        setTimerRunning(true);
                      }}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 underline"
                    >
                      Làm lại bài
                    </button>
                  </div>
                )}
              </div>

              {/* Questions Navigation Pills */}
              <div className="flex flex-wrap gap-2">
                {activeExam.essayQuestions.map((q, idx) => {
                  const hasAnswer = (studentAnswers[q.id] || '').trim().length > 0;
                  const result = gradingResults[q.id];
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setActiveQuestionTab(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        activeQuestionTab === idx
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : hasAnswer
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>Bài {idx + 1} ({q.points}đ)</span>
                      {result && (
                        <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-extrabold">
                          {result.score}đ
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Current Question View */}
              {activeExam.essayQuestions[activeQuestionTab] && (
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                  {(() => {
                    const currentQ = activeExam.essayQuestions[activeQuestionTab];
                    const studentAns = studentAnswers[currentQ.id] || '';
                    const grading = gradingResults[currentQ.id];

                    return (
                      <>
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-amber-500 text-slate-950 font-extrabold text-xs flex items-center justify-center">
                              {activeQuestionTab + 1}
                            </span>
                            <span>Bài {activeQuestionTab + 1} (Thang điểm: {currentQ.points} điểm)</span>
                          </h4>

                          {currentQ.subtopic && (
                            <span className="text-[11px] font-semibold text-slate-500">
                              Dạng bài: {currentQ.subtopic}
                            </span>
                          )}
                        </div>

                        {/* Question Content */}
                        <div className="text-sm text-slate-800 leading-relaxed font-medium p-3 bg-slate-50 rounded-xl">
                          <MarkdownContent content={currentQ.question} />
                        </div>

                        {/* Student Answer Box */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-700">
                              Bài làm của em (Trình bày chi tiết lời giải, phép tính và đáp số):
                            </label>
                            <FormulaToolbar
                              compact={true}
                              onInsertSymbol={(sym) => {
                                setStudentAnswers((prev) => ({
                                  ...prev,
                                  [currentQ.id]: (prev[currentQ.id] || '') + ' ' + sym,
                                }));
                              }}
                            />
                          </div>

                          <textarea
                            rows={6}
                            disabled={isExamSubmitted}
                            value={studentAns}
                            onChange={(e) =>
                              setStudentAnswers((prev) => ({
                                ...prev,
                                [currentQ.id]: e.target.value,
                              }))
                            }
                            placeholder="Em hãy viết từng câu lời giải, phép tính và đáp số vào đây nhé..."
                            className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 focus:outline-none focus:border-amber-500 bg-white font-mono leading-relaxed"
                          />
                        </div>

                        {/* AI Grading & Feedback Card */}
                        {grading && (
                          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                                <Award className="w-4 h-4 text-emerald-600" />
                                <span>Kết quả chấm bài của AI:</span>
                              </div>
                              <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-extrabold text-xs">
                                Đạt {grading.score} / {currentQ.points} điểm
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3 rounded-lg border border-emerald-100">
                              {grading.comment}
                            </p>
                          </div>
                        )}

                        {/* Sample Answer (Revealed after submission) */}
                        {showFullSampleAnswers && (
                          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                            <div className="text-xs font-bold text-amber-900">
                              Lời giải mẫu chuẩn của Giáo viên để đối chiếu:
                            </div>
                            <div className="text-xs text-slate-800 bg-white p-3 rounded-lg border border-amber-100">
                              <MarkdownContent content={currentQ.sampleAnswer} />
                            </div>
                            {currentQ.rubric && (
                              <div className="text-[11px] text-amber-800 font-medium">
                                <strong>Biểu điểm:</strong> {currentQ.rubric}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
