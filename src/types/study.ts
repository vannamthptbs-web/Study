export type Grade =
  | 'Lớp 1'
  | 'Lớp 2'
  | 'Lớp 3'
  | 'Lớp 4'
  | 'Lớp 5'
  | 'Lớp 6'
  | 'Lớp 7'
  | 'Lớp 8'
  | 'Lớp 9'
  | 'Lớp 10'
  | 'Lớp 11'
  | 'Lớp 12';

export type Subject =
  | 'Toán'
  | 'KHTN'
  | 'Khoa học'
  | 'Vật lý'
  | 'Hóa học'
  | 'Sinh học'
  | 'Tiếng Việt'
  | 'Ngữ văn'
  | 'Tiếng Anh'
  | 'Lịch sử & Địa lý'
  | 'Tin học'
  | 'Đạo đức';

export type UserRole = 'student' | 'teacher' | 'admin';

export interface AppUser {
  id: string;
  username: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  grade: Grade;
  subject?: Subject;
  school?: string;
  createdAt: number;
}

export interface SubjectInfo {
  id: Subject;
  name: string;
  icon: string;
  color: string;
  bgLight: string;
  badgeColor: string;
  description: string;
}

export interface UploadedFileItem {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64 without prefix or raw data
  previewUrl?: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  subject?: Subject;
  grade?: Grade;
  files?: Array<{ name: string; mimeType: string }>;
}

export type ExamFormat = 'multiple_choice' | 'essay';

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string; // 'A', 'B', 'C', 'D'
  explanation: string;
  subtopic: string;
}

export interface EssayQuestion {
  id: number;
  question: string;
  points: number; // Điểm số cho câu này (ví dụ: 2 điểm)
  guideline?: string; // Gợi ý hướng giải / tư duy sư phạm
  sampleAnswer: string; // Đáp án mẫu / Lời giải chi tiết
  rubric?: string; // Biểu điểm chấm chi tiết
  subtopic?: string; // Chuyên đề / Dạng bài
}

export interface QuizData {
  title: string;
  topic: string;
  grade?: Grade;
  subject?: Subject;
  examFormat?: ExamFormat;
  durationMinutes?: number;
  questions: QuizQuestion[];
  essayQuestions?: EssayQuestion[];
}

export interface QuizSubmissionResult {
  id: string;
  timestamp: number;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: UserRole;
  subject: Subject;
  grade: Grade;
  topic: string;
  examFormat?: ExamFormat;
  score: number; // e.g. 8.0/10
  correctCount: number;
  totalQuestions: number;
  userAnswers: Record<number, string>; // question id -> selected option letter
  essayAnswers?: Record<number, string>; // question id -> student essay answer
  essayFeedback?: Record<number, { score: number; comment: string }>;
  weakSubtopics: string[];
  questions: QuizQuestion[];
  essayQuestions?: EssayQuestion[];
  syncedToSheets?: boolean;
  syncedToFirestore?: boolean;
}

export interface WeakTopicItem {
  id: string;
  subject: Subject;
  topicName: string;
  wrongCount: number;
  totalTested: number;
  lastMissedDate: number;
  status: 'needs_practice' | 'reviewing' | 'mastered';
}

export interface UserProfile {
  id: string;
  username?: string;
  isGuest?: boolean;
  name: string;
  email: string;
  role: UserRole;
  avatarSeed: string;
  grade: Grade;
  favoriteSubject: Subject;
  school?: string;
  xp: number;
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
  stats: {
    questionsAsked: number;
    problemsSolved: number;
    reviewsCreated: number;
    quizzesCompleted: number;
    totalQuizScoreSum: number;
  };
}

export interface SavedBankQuiz {
  id: string;
  title: string;
  topic: string;
  grade: Grade;
  subject: Subject;
  creatorName: string;
  creatorRole: UserRole;
  createdAt: number;
  examFormat?: ExamFormat;
  data: QuizData;
}

export type ActiveTab = 'chat' | 'solver' | 'review' | 'quiz' | 'progress' | 'admin' | 'guide';
