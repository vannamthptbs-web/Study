import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Filter,
  Trash2,
  Edit3,
  Plus,
  Play,
  BookOpen,
  Calendar,
  User,
  GraduationCap,
  Sparkles,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Download,
  Save,
  RotateCcw,
  Layers,
  FileText,
} from 'lucide-react';
import {
  SavedBankQuiz,
  QuizQuestion,
  EssayQuestion,
  Grade,
  Subject,
  AppUser,
} from '../types/study';
import {
  getBankQuizzes,
  deleteBankQuiz,
  updateBankQuiz,
  deleteQuestionFromBankQuiz,
  updateQuestionInBankQuiz,
  addQuestionToBankQuiz,
} from '../services/storage';
import { GRADES, SUBJECTS } from '../data/subjects';
import { MarkdownContent } from './MarkdownContent';
import { FormulaToolbar } from './FormulaToolbar';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  onSelectQuiz: (quiz: SavedBankQuiz) => void;
  onNotification: (message: string) => void;
}

export const QuestionBankModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectQuiz,
  onNotification,
}) => {
  const [bankList, setBankList] = useState<SavedBankQuiz[]>(getBankQuizzes());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedFormatFilter, setSelectedFormatFilter] = useState<string>('all'); // all, multiple_choice, essay

  // Selected quiz for viewing / editing
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [isEditingQuizMeta, setIsEditingQuizMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaGrade, setMetaGrade] = useState<Grade>('Lớp 4');
  const [metaSubject, setMetaSubject] = useState<Subject>('Toán');

  // Editing single question modal / state
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null);
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>(['', '', '', '']);
  const [editCorrectAnswer, setEditCorrectAnswer] = useState('A');
  const [editExplanation, setEditExplanation] = useState('');
  const [editSubtopic, setEditSubtopic] = useState('');
  const [editMaxScore, setEditMaxScore] = useState<number>(2.5);
  const [editRubric, setEditRubric] = useState<string[]>(['']);

  // Adding new question state
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  // Deletion confirmation state
  const [confirmDeleteQuizId, setConfirmDeleteQuizId] = useState<string | null>(null);
  const [confirmDeleteQIdx, setConfirmDeleteQIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const refreshList = () => {
    setBankList(getBankQuizzes());
  };

  // Grade groupings
  const elementaryGrades = ['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'];
  const secondaryGrades = ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9'];
  const highSchoolGrades = ['Lớp 10', 'Lớp 11', 'Lớp 12'];

  // Filtered bank list
  const filteredQuizzes = useMemo(() => {
    return bankList.filter((item) => {
      // Grade filter
      if (selectedGradeFilter !== 'all') {
        if (selectedGradeFilter === 'group_elementary') {
          if (!elementaryGrades.includes(item.grade)) return false;
        } else if (selectedGradeFilter === 'group_secondary') {
          if (!secondaryGrades.includes(item.grade)) return false;
        } else if (selectedGradeFilter === 'group_high') {
          if (!highSchoolGrades.includes(item.grade)) return false;
        } else if (item.grade !== selectedGradeFilter) {
          return false;
        }
      }

      // Subject filter
      if (selectedSubjectFilter !== 'all' && item.subject !== selectedSubjectFilter) {
        return false;
      }

      // Format filter
      const isEssay =
        item.examFormat === 'essay' ||
        (item.data && Array.isArray(item.data.essayQuestions) && item.data.essayQuestions.length > 0);
      if (selectedFormatFilter === 'multiple_choice' && isEssay) return false;
      if (selectedFormatFilter === 'essay' && !isEssay) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const topicMatch = (item.topic || '').toLowerCase().includes(q);
        const authorMatch = (item.creatorName || '').toLowerCase().includes(q);
        const gradeMatch = (item.grade || '').toLowerCase().includes(q);
        const subjectMatch = (item.subject || '').toLowerCase().includes(q);
        if (!titleMatch && !topicMatch && !authorMatch && !gradeMatch && !subjectMatch) {
          return false;
        }
      }

      return true;
    });
  }, [bankList, selectedGradeFilter, selectedSubjectFilter, selectedFormatFilter, searchQuery]);

  const activeQuiz = bankList.find((b) => b.id === activeQuizId) || null;
  const isCurrentQuizEssay =
    activeQuiz?.examFormat === 'essay' ||
    (activeQuiz?.data && Array.isArray(activeQuiz.data.essayQuestions) && activeQuiz.data.essayQuestions.length > 0);

  // Handle open active quiz in detail
  const handleOpenDetail = (quiz: SavedBankQuiz) => {
    setActiveQuizId(quiz.id);
    setIsEditingQuizMeta(false);
    setEditingQuestionIdx(null);
    setIsAddingQuestion(false);
  };

  // Handle Delete whole quiz
  const handleDeleteQuiz = (id: string) => {
    deleteBankQuiz(id);
    refreshList();
    if (activeQuizId === id) {
      setActiveQuizId(null);
    }
    setConfirmDeleteQuizId(null);
    onNotification('Đã xóa thành công đề thi khỏi Ngân hàng đề!');
  };

  // Start editing quiz metadata
  const handleStartEditMeta = () => {
    if (!activeQuiz) return;
    setMetaTitle(activeQuiz.title || '');
    setMetaGrade(activeQuiz.grade || 'Lớp 4');
    setMetaSubject(activeQuiz.subject || 'Toán');
    setIsEditingQuizMeta(true);
  };

  // Save quiz metadata
  const handleSaveMeta = () => {
    if (!activeQuiz) return;
    const updated: SavedBankQuiz = {
      ...activeQuiz,
      title: metaTitle.trim() || activeQuiz.title,
      grade: metaGrade,
      subject: metaSubject,
      data: {
        ...activeQuiz.data,
        title: metaTitle.trim() || activeQuiz.data.title,
        grade: metaGrade,
        subject: metaSubject,
      },
    };
    updateBankQuiz(updated);
    refreshList();
    setIsEditingQuizMeta(false);
    onNotification('Đã cập nhật thông tin tiêu đề và khối lớp của đề thi!');
  };

  // Start editing single question
  const handleStartEditQuestion = (idx: number) => {
    if (!activeQuiz || !activeQuiz.data) return;
    setEditingQuestionIdx(idx);
    setIsAddingQuestion(false);

    if (isCurrentQuizEssay) {
      const q = activeQuiz.data.essayQuestions?.[idx];
      if (q) {
        setEditQuestionText(q.question || '');
        setEditExplanation(q.solutionGuide || '');
        setEditSubtopic(q.subtopic || '');
        setEditMaxScore(q.maxScore || 2.5);
        setEditRubric(q.scoringRubric ? [...q.scoringRubric] : ['']);
      }
    } else {
      const q = activeQuiz.data.questions?.[idx];
      if (q) {
        setEditQuestionText(q.question || '');
        setEditOptions(q.options && q.options.length >= 4 ? [...q.options] : ['', '', '', '']);
        setEditCorrectAnswer(q.correctAnswer || 'A');
        setEditExplanation(q.explanation || '');
        setEditSubtopic(q.subtopic || '');
      }
    }
  };

  // Save edited single question
  const handleSaveQuestion = () => {
    if (!activeQuiz || editingQuestionIdx === null) return;

    if (isCurrentQuizEssay) {
      const updatedQ: Partial<EssayQuestion> = {
        question: editQuestionText.trim(),
        solutionGuide: editExplanation.trim(),
        subtopic: editSubtopic.trim(),
        maxScore: Number(editMaxScore) || 2.5,
        scoringRubric: editRubric.filter((r) => r.trim().length > 0),
      };
      updateQuestionInBankQuiz(activeQuiz.id, editingQuestionIdx, updatedQ);
    } else {
      const updatedQ: Partial<QuizQuestion> = {
        question: editQuestionText.trim(),
        options: editOptions.map((opt, i) => opt.trim() || `Phương án ${['A', 'B', 'C', 'D'][i]}`),
        correctAnswer: editCorrectAnswer,
        explanation: editExplanation.trim(),
        subtopic: editSubtopic.trim(),
      };
      updateQuestionInBankQuiz(activeQuiz.id, editingQuestionIdx, updatedQ);
    }

    refreshList();
    setEditingQuestionIdx(null);
    onNotification(`Đã lưu thay đổi cho câu hỏi ${editingQuestionIdx + 1}!`);
  };

  // Delete single question
  const handleDeleteQuestion = (idx: number) => {
    if (!activeQuiz) return;
    deleteQuestionFromBankQuiz(activeQuiz.id, idx);
    refreshList();
    setConfirmDeleteQIdx(null);
    onNotification(`Đã xóa câu hỏi ${idx + 1} khỏi đề thi!`);
  };

  // Start adding new question
  const handleStartAddQuestion = () => {
    setIsAddingQuestion(true);
    setEditingQuestionIdx(null);
    setEditQuestionText('');
    setEditOptions(['', '', '', '']);
    setEditCorrectAnswer('A');
    setEditExplanation('');
    setEditSubtopic('');
    setEditMaxScore(2.5);
    setEditRubric(['Đúng kết quả và trình bày rõ ràng (+2.5 điểm)']);
  };

  // Save new added question
  const handleSaveNewQuestion = () => {
    if (!activeQuiz) return;
    if (!editQuestionText.trim()) {
      onNotification('Vui lòng nhập nội dung câu hỏi!');
      return;
    }

    if (isCurrentQuizEssay) {
      const newEssayQ: EssayQuestion = {
        id: (activeQuiz.data.essayQuestions?.length || 0) + 1,
        question: editQuestionText.trim(),
        solutionGuide: editExplanation.trim() || 'Học sinh trình bày đầy đủ các bước giải.',
        subtopic: editSubtopic.trim() || activeQuiz.topic,
        maxScore: Number(editMaxScore) || 2.5,
        scoringRubric: editRubric.filter((r) => r.trim().length > 0),
      };
      addQuestionToBankQuiz(activeQuiz.id, newEssayQ);
    } else {
      const newQ: QuizQuestion = {
        id: (activeQuiz.data.questions?.length || 0) + 1,
        question: editQuestionText.trim(),
        options: editOptions.map((opt, i) => opt.trim() || `Phương án ${['A', 'B', 'C', 'D'][i]}`),
        correctAnswer: editCorrectAnswer,
        explanation: editExplanation.trim() || 'Lời giải chi tiết cho câu hỏi.',
        subtopic: editSubtopic.trim() || activeQuiz.topic,
      };
      addQuestionToBankQuiz(activeQuiz.id, newQ);
    }

    refreshList();
    setIsAddingQuestion(false);
    onNotification('Đã thêm 1 câu hỏi mới vào đề thi!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-6xl w-full h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Ngân Hàng Đề Thi & Quản Lý Câu Hỏi</h3>
                <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full font-bold">
                  {bankList.length} đề thi
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Phân loại theo khối lớp, tra cứu công thức Toán/KHTN, chỉnh sửa & xóa câu hỏi linh hoạt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left column list / Right column detail */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50/50">
          {/* ======================================================== */}
          {/* LEFT PANEL: Filters & Quizzes List                       */}
          {/* ======================================================== */}
          <div className="w-full md:w-5/12 lg:w-4/12 border-r border-slate-200 flex flex-col bg-white overflow-hidden">
            {/* Search and Filters Header */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/80 space-y-2.5 shrink-0">
              {/* Search bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên đề, môn, tác giả..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              {/* Grade Group Tabs */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedGradeFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                      selectedGradeFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Tất cả khối
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGradeFilter('group_elementary')}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                      selectedGradeFilter === 'group_elementary'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Tiểu học (1-5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGradeFilter('group_secondary')}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                      selectedGradeFilter === 'group_secondary'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    THCS (6-9)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGradeFilter('group_high')}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                      selectedGradeFilter === 'group_high'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    THPT (10-12)
                  </button>
                </div>

                {/* Specific Grade Selector if elementary/secondary/high selected */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin text-[11px]">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGradeFilter(g)}
                      className={`px-2 py-0.5 rounded font-semibold whitespace-nowrap text-[10px] ${
                        selectedGradeFilter === g
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject & Format dropdown filter */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                >
                  <option value="all">Tất cả môn học</option>
                  <option value="Toán">Toán học</option>
                  <option value="KHTN">Khoa học tự nhiên (KHTN)</option>
                  <option value="Khoa học">Tự nhiên & Khoa học</option>
                  <option value="Tiếng Việt">Tiếng Việt / Ngữ văn</option>
                  <option value="Tiếng Anh">Tiếng Anh</option>
                  <option value="Lịch sử & Địa lý">Lịch sử & Địa lý</option>
                  <option value="Tin học">Tin học</option>
                </select>

                <select
                  value={selectedFormatFilter}
                  onChange={(e) => setSelectedFormatFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                >
                  <option value="all">Tất cả hình thức</option>
                  <option value="multiple_choice">Trắc nghiệm</option>
                  <option value="essay">Tự luận</option>
                </select>
              </div>
            </div>

            {/* Quizzes List Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
              {filteredQuizzes.length === 0 ? (
                <div className="py-12 px-4 text-center text-slate-400 space-y-2">
                  <BookOpen className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">Chưa có đề thi nào phù hợp với bộ lọc</p>
                  <p className="text-[11px] text-slate-400">
                    Hãy tạo đề mới trong phần Luyện thi & Tạo đề
                  </p>
                </div>
              ) : (
                filteredQuizzes.map((quiz, idx) => {
                  const isEssay =
                    quiz.examFormat === 'essay' ||
                    (quiz.data && Array.isArray(quiz.data.essayQuestions) && quiz.data.essayQuestions.length > 0);
                  const qCount = isEssay
                    ? quiz.data?.essayQuestions?.length || 0
                    : quiz.data?.questions?.length || 0;
                  const isSelected = activeQuizId === quiz.id;

                  return (
                    <div
                      key={quiz.id ? `${quiz.id}-${idx}` : `q-${idx}`}
                      onClick={() => handleOpenDetail(quiz)}
                      className={`p-3 rounded-2xl border text-left cursor-pointer transition-all shadow-2xs space-y-2 ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-500/20'
                          : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                          {quiz.subject} • {quiz.grade}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            isEssay ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {isEssay ? 'Tự luận' : 'Trắc nghiệm'}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-xs line-clamp-2">
                        {quiz.title}
                      </h4>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                        <span className="font-semibold text-slate-600">{qCount} câu hỏi</span>
                        <span className="text-[10px]">
                          {quiz.createdAt
                            ? new Date(quiz.createdAt).toLocaleDateString('vi-VN')
                            : 'Mới tạo'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* RIGHT PANEL: Quiz Detail, Question Editor & Actions      */}
          {/* ======================================================== */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/40">
            {!activeQuiz ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-500 mb-3">
                  <FileText className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-slate-700">Chọn một đề thi từ danh sách</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Nhấp vào bất kỳ đề thi nào ở bên trái để xem toàn bộ danh sách câu hỏi, chỉnh sửa nội dung hoặc xóa câu hỏi.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Active Quiz Header */}
                <div className="p-4 sm:p-5 bg-white border-b border-slate-200 shrink-0 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {isEditingQuizMeta ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={metaTitle}
                            onChange={(e) => setMetaTitle(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm font-bold border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500"
                            placeholder="Tiêu đề đề thi..."
                          />
                          <div className="flex items-center gap-2">
                            <select
                              value={metaGrade}
                              onChange={(e) => setMetaGrade(e.target.value as Grade)}
                              className="text-xs px-2 py-1 border border-slate-300 rounded-lg bg-white"
                            >
                              {GRADES.map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                            <select
                              value={metaSubject}
                              onChange={(e) => setMetaSubject(e.target.value as Subject)}
                              className="text-xs px-2 py-1 border border-slate-300 rounded-lg bg-white"
                            >
                              <option value="Toán">Toán</option>
                              <option value="KHTN">KHTN</option>
                              <option value="Khoa học">Khoa học</option>
                              <option value="Tiếng Việt">Tiếng Việt</option>
                              <option value="Tiếng Anh">Tiếng Anh</option>
                            </select>
                            <button
                              type="button"
                              onClick={handleSaveMeta}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                            >
                              Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingQuizMeta(false)}
                              className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-extrabold text-xs px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {activeQuiz.subject}
                            </span>
                            <span className="font-bold text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                              {activeQuiz.grade}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-md font-bold ${
                                isCurrentQuizEssay
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {isCurrentQuizEssay ? 'Tự luận' : 'Trắc nghiệm'}
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                            {activeQuiz.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Chuyên đề: <strong>{activeQuiz.topic}</strong> • Soạn bởi:{' '}
                            <strong>{activeQuiz.creatorName}</strong>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions on this quiz */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isEditingQuizMeta && (
                        <button
                          type="button"
                          onClick={handleStartEditMeta}
                          title="Sửa tiêu đề & khối lớp"
                          className="p-2 text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-xl transition-colors border border-slate-200"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteQuizId(activeQuiz.id)}
                        title="Xóa đề thi khỏi ngân hàng"
                        className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectQuiz(activeQuiz);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Mở làm đề này</span>
                      </button>
                    </div>
                  </div>

                  {/* Add question button */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-600">
                      Danh sách câu hỏi (
                      {isCurrentQuizEssay
                        ? activeQuiz.data?.essayQuestions?.length || 0
                        : activeQuiz.data?.questions?.length || 0}{' '}
                      câu):
                    </span>
                    <button
                      type="button"
                      onClick={handleStartAddQuestion}
                      className="flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm câu hỏi mới</span>
                    </button>
                  </div>
                </div>

                {/* Question List / Editor Scroll View */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin">
                  {/* FORM: Add new question */}
                  {isAddingQuestion && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/60 border-2 border-indigo-400 shadow-sm space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between pb-2 border-b border-indigo-200">
                        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                          <Plus className="w-4 h-4" />
                          Thêm câu hỏi mới vào đề thi ({isCurrentQuizEssay ? 'Tự luận' : 'Trắc nghiệm'})
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsAddingQuestion(false)}
                          className="text-slate-400 hover:text-slate-600 text-xs"
                        >
                          Hủy bỏ
                        </button>
                      </div>

                      {/* Formula toolbar for inserting symbols */}
                      <FormulaToolbar
                        onInsertSymbol={(sym) => {
                          setEditQuestionText((prev) => prev + sym);
                        }}
                        compact={true}
                      />

                      {/* Question input */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nội dung câu hỏi:
                        </label>
                        <textarea
                          rows={3}
                          value={editQuestionText}
                          onChange={(e) => setEditQuestionText(e.target.value)}
                          placeholder="Nhập nội dung câu hỏi (hỗ trợ công thức Toán và KHTN dạng $...$)..."
                          className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* If multiple choice: options A B C D */}
                      {!isCurrentQuizEssay ? (
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-700">
                            4 Phương án lựa chọn & Đáp án đúng:
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {['A', 'B', 'C', 'D'].map((letter, optIdx) => (
                              <div key={letter} className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditCorrectAnswer(letter)}
                                  className={`w-6 h-6 rounded-md font-bold text-xs shrink-0 flex items-center justify-center border transition-all ${
                                    editCorrectAnswer === letter
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white text-slate-700 border-slate-300'
                                  }`}
                                  title="Chọn làm đáp án đúng"
                                >
                                  {letter}
                                </button>
                                <input
                                  type="text"
                                  value={editOptions[optIdx] || ''}
                                  onChange={(e) => {
                                    const next = [...editOptions];
                                    next[optIdx] = e.target.value;
                                    setEditOptions(next);
                                  }}
                                  placeholder={`Nội dung đáp án ${letter}...`}
                                  className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Điểm số câu này:
                            </label>
                            <input
                              type="number"
                              step="0.25"
                              value={editMaxScore}
                              onChange={(e) => setEditMaxScore(Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Chuyên đề:
                            </label>
                            <input
                              type="text"
                              value={editSubtopic}
                              onChange={(e) => setEditSubtopic(e.target.value)}
                              placeholder="Ví dụ: Vận tốc, Phân số..."
                              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                            />
                          </div>
                        </div>
                      )}

                      {/* Explanation / Solution Guide */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {isCurrentQuizEssay ? 'Hướng dẫn giải chi tiết:' : 'Lời giải chi tiết:'}
                        </label>
                        <textarea
                          rows={2}
                          value={editExplanation}
                          onChange={(e) => setEditExplanation(e.target.value)}
                          placeholder="Nhập lời giải hoặc gợi ý đáp án..."
                          className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingQuestion(false)}
                          className="px-3 py-1.5 bg-white text-slate-600 rounded-xl text-xs font-semibold border border-slate-200"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNewQuestion}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs"
                        >
                          Lưu câu hỏi mới
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Render questions list */}
                  {isCurrentQuizEssay ? (
                    // ESSAY QUESTIONS LIST
                    (activeQuiz.data?.essayQuestions || []).map((q, qIdx) => {
                      const isEditing = editingQuestionIdx === qIdx;

                      return (
                        <div
                          key={q.id ? `essay-${q.id}-${qIdx}` : `essay-${qIdx}`}
                          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-2xs hover:border-slate-300 transition-all"
                        >
                          {isEditing ? (
                            /* EDITING FORM FOR THIS QUESTION */
                            <div className="space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <span className="text-xs font-bold text-indigo-700">
                                  Chỉnh sửa Câu hỏi {qIdx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEditingQuestionIdx(null)}
                                  className="text-xs text-slate-400 hover:text-slate-600"
                                >
                                  Đóng
                                </button>
                              </div>

                              <FormulaToolbar
                                onInsertSymbol={(sym) => {
                                  setEditQuestionText((prev) => prev + sym);
                                }}
                                compact={true}
                              />

                              <textarea
                                rows={3}
                                value={editQuestionText}
                                onChange={(e) => setEditQuestionText(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                              />

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                    Điểm số:
                                  </label>
                                  <input
                                    type="number"
                                    step="0.25"
                                    value={editMaxScore}
                                    onChange={(e) => setEditMaxScore(Number(e.target.value))}
                                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                    Chuyên đề:
                                  </label>
                                  <input
                                    type="text"
                                    value={editSubtopic}
                                    onChange={(e) => setEditSubtopic(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                  Hướng dẫn giải:
                                </label>
                                <textarea
                                  rows={2}
                                  value={editExplanation}
                                  onChange={(e) => setEditExplanation(e.target.value)}
                                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800"
                                />
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingQuestionIdx(null)}
                                  className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveQuestion}
                                  className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
                                >
                                  Lưu thay đổi
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* DISPLAY MODE */
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-extrabold text-xs flex items-center justify-center">
                                    {qIdx + 1}
                                  </span>
                                  <span className="text-xs font-bold text-slate-500">
                                    ({q.maxScore || 2.5} điểm)
                                  </span>
                                  {q.subtopic && (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                                      {q.subtopic}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditQuestion(qIdx)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Sửa câu này"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteQIdx(qIdx)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Xóa câu này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-2 text-sm text-slate-800 font-medium">
                                <MarkdownContent content={q.question} compact={true} />
                              </div>

                              {q.solutionGuide && (
                                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                                  <span className="font-bold text-indigo-700 block mb-0.5">
                                    Hướng dẫn giải:
                                  </span>
                                  <MarkdownContent content={q.solutionGuide} compact={true} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    // MULTIPLE CHOICE QUESTIONS LIST
                    (activeQuiz.data?.questions || []).map((q, qIdx) => {
                      const isEditing = editingQuestionIdx === qIdx;

                      return (
                        <div
                          key={q.id ? `mc-${q.id}-${qIdx}` : `mc-${qIdx}`}
                          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-2xs hover:border-slate-300 transition-all"
                        >
                          {isEditing ? (
                            /* EDITING FORM FOR MULTIPLE CHOICE */
                            <div className="space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <span className="text-xs font-bold text-indigo-700">
                                  Chỉnh sửa Câu hỏi {qIdx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEditingQuestionIdx(null)}
                                  className="text-xs text-slate-400 hover:text-slate-600"
                                >
                                  Đóng
                                </button>
                              </div>

                              <FormulaToolbar
                                onInsertSymbol={(sym) => {
                                  setEditQuestionText((prev) => prev + sym);
                                }}
                                compact={true}
                              />

                              <textarea
                                rows={3}
                                value={editQuestionText}
                                onChange={(e) => setEditQuestionText(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                              />

                              <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-slate-700">
                                  4 Phương án & Đáp án đúng:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {['A', 'B', 'C', 'D'].map((letter, optIdx) => (
                                    <div key={letter} className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setEditCorrectAnswer(letter)}
                                        className={`w-6 h-6 rounded-md font-bold text-xs shrink-0 flex items-center justify-center border transition-all ${
                                          editCorrectAnswer === letter
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-white text-slate-700 border-slate-300'
                                        }`}
                                      >
                                        {letter}
                                      </button>
                                      <input
                                        type="text"
                                        value={editOptions[optIdx] || ''}
                                        onChange={(e) => {
                                          const next = [...editOptions];
                                          next[optIdx] = e.target.value;
                                          setEditOptions(next);
                                        }}
                                        className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-800"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                  Lời giải chi tiết:
                                </label>
                                <textarea
                                  rows={2}
                                  value={editExplanation}
                                  onChange={(e) => setEditExplanation(e.target.value)}
                                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800"
                                />
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingQuestionIdx(null)}
                                  className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveQuestion}
                                  className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
                                >
                                  Lưu thay đổi
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* DISPLAY MODE FOR MULTIPLE CHOICE */
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 font-extrabold text-xs flex items-center justify-center">
                                    {qIdx + 1}
                                  </span>
                                  {q.subtopic && (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                                      {q.subtopic}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditQuestion(qIdx)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Sửa câu này"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteQIdx(qIdx)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Xóa câu này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-2 text-sm text-slate-800 font-medium">
                                <MarkdownContent content={q.question} compact={true} />
                              </div>

                              {/* 4 options display */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                                {(q.options || []).map((opt, oIdx) => {
                                  const letter = ['A', 'B', 'C', 'D'][oIdx];
                                  const isCorrect = (q.correctAnswer || '').trim().toUpperCase() === letter;

                                  return (
                                    <div
                                      key={oIdx}
                                      className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                                        isCorrect
                                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-semibold'
                                          : 'bg-slate-50 border-slate-200 text-slate-700'
                                      }`}
                                    >
                                      <span
                                        className={`w-5 h-5 rounded-md font-bold text-[11px] flex items-center justify-center shrink-0 ${
                                          isCorrect
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white text-slate-600 border border-slate-200'
                                        }`}
                                      >
                                        {letter}
                                      </span>
                                      <div className="flex-1 mt-0.5">
                                        <MarkdownContent content={opt} compact={true} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {q.explanation && (
                                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                                  <span className="font-bold text-indigo-700 block mb-0.5">
                                    Lời giải:
                                  </span>
                                  <MarkdownContent content={q.explanation} compact={true} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Confirm Delete Whole Quiz */}
        {confirmDeleteQuizId && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-center text-slate-900">
                Xác nhận xóa toàn bộ đề thi?
              </h4>
              <p className="text-xs text-center text-slate-500">
                Hành động này sẽ xóa đề thi khỏi ngân hàng cục bộ và đồng bộ xóa trên Google Sheets. Bạn có chắc chắn muốn xóa không?
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteQuizId(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteQuiz(confirmDeleteQuizId)}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Confirm Delete Single Question */}
        {confirmDeleteQIdx !== null && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-center text-slate-900">
                Xác nhận xóa câu hỏi {confirmDeleteQIdx + 1}?
              </h4>
              <p className="text-xs text-center text-slate-500">
                Câu hỏi này sẽ được loại bỏ khỏi đề thi và các câu còn lại sẽ được đánh số lại.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteQIdx(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteQuestion(confirmDeleteQIdx)}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
                >
                  Xóa câu này
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
