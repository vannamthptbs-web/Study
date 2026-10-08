import { Grade, Subject, QuizData, UploadedFileItem, UserRole } from '../types/study';
import {
  getEffectiveApiKey,
  clientSendMessageToTutor,
  clientSolveProblemWithAI,
  clientGenerateTopicReview,
  clientGenerateQuizFromAI,
  clientGenerateEssayExamFromAI,
  clientGradeEssayWithAI,
} from './geminiClient';

// Safe JSON response parser that handles HTML error pages, 502/504 gateways, and non-JSON payloads gracefully
async function parseJsonResponse<T>(response: Response, defaultErrorMsg: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `${defaultErrorMsg} (mã lỗi ${response.status})`);
    } else {
      if (response.status === 404) {
        throw new Error(
          `Lỗi 404 (Không tìm thấy endpoint backend). Dự án khi deploy Vercel đang chạy chế độ web tĩnh. Vui lòng cấu hình GEMINI_API_KEY trên Vercel hoặc nhập API Key trực tiếp trong phần Quản trị!`
        );
      }
      throw new Error(`${defaultErrorMsg} (mã lỗi ${response.status}). Vui lòng bấm Thử lại sau giây lát!`);
    }
  }

  if (!isJson) {
    throw new Error('Máy chủ phản hồi không đúng định dạng JSON. Vui lòng bấm Thử lại!');
  }

  return await response.json();
}

function handleVercelHelpMessage(error: any): string {
  const msg = error?.message || '';
  if (msg.includes('404') || msg.includes('Không tìm thấy') || msg.includes('500') || msg.includes('GEMINI_API_KEY is not configured')) {
    return `${msg}\n\n💡 Mẹo khắc phục trên Vercel:\n1. Vào Vercel Dashboard -> Settings -> Environment Variables -> Thêm biến GEMINI_API_KEY.\n2. Hoặc mở tab Quản trị -> mục "Cấu hình AI & Vercel" để nhập API Key chạy trực tiếp!`;
  }
  return msg;
}

export async function sendMessageToTutor(
  messages: { role: string; content: string }[],
  grade: Grade,
  subject: Subject,
  files?: UploadedFileItem[]
): Promise<string> {
  const payloadFiles = files?.map((f) => ({
    name: f.name,
    mimeType: f.mimeType,
    data: f.data,
  }));

  // Step 1: Try server backend endpoint
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, grade, subject, files: payloadFiles }),
    });

    const data = await parseJsonResponse<{ reply: string }>(
      response,
      'Lỗi kết nối tới trợ lý AI StudyAI'
    );
    return data.reply;
  } catch (backendError: any) {
    console.warn('Backend /api/chat issue, attempting direct client fallback:', backendError?.message);

    // Step 2: Check for client-side API Key (Vercel static fallback)
    const clientKey = getEffectiveApiKey();
    if (clientKey) {
      try {
        return await clientSendMessageToTutor(clientKey, messages, grade, subject, files);
      } catch (clientErr: any) {
        console.error('Client Gemini call also failed:', clientErr);
        throw new Error(`Lỗi kết nối AI: ${clientErr?.message || 'Không thể tạo phản hồi'}`);
      }
    }

    throw new Error(handleVercelHelpMessage(backendError));
  }
}

export async function solveProblemWithAI(
  problem: string,
  grade: Grade,
  subject: Subject,
  files?: UploadedFileItem[]
): Promise<string> {
  const payloadFiles = files?.map((f) => ({
    name: f.name,
    mimeType: f.mimeType,
    data: f.data,
  }));

  try {
    const response = await fetch('/api/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem, grade, subject, files: payloadFiles }),
    });

    const data = await parseJsonResponse<{ solution: string }>(
      response,
      'Lỗi khi giải bài tập từng bước'
    );
    return data.solution;
  } catch (backendError: any) {
    console.warn('Backend /api/solve issue, attempting client fallback:', backendError?.message);

    const clientKey = getEffectiveApiKey();
    if (clientKey) {
      try {
        return await clientSolveProblemWithAI(clientKey, problem, grade, subject, files);
      } catch (clientErr: any) {
        throw new Error(`Lỗi khi giải bài: ${clientErr?.message || 'Không thể giải bài'}`);
      }
    }

    throw new Error(handleVercelHelpMessage(backendError));
  }
}

export async function generateTopicReview(
  topic: string,
  grade: Grade,
  subject: Subject
): Promise<string> {
  try {
    const response = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, grade, subject }),
    });

    const data = await parseJsonResponse<{ review: string }>(
      response,
      'Lỗi khi tạo đề cương ôn bài'
    );
    return data.review;
  } catch (backendError: any) {
    console.warn('Backend /api/review issue, attempting client fallback:', backendError?.message);

    const clientKey = getEffectiveApiKey();
    if (clientKey) {
      try {
        return await clientGenerateTopicReview(clientKey, topic, grade, subject);
      } catch (clientErr: any) {
        throw new Error(`Lỗi ôn bài: ${clientErr?.message || 'Không thể tạo đề cương'}`);
      }
    }

    throw new Error(handleVercelHelpMessage(backendError));
  }
}

export async function generateQuizFromAI(
  subject: Subject,
  grade: Grade,
  topic: string,
  questionCount: number = 5,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  files?: UploadedFileItem[],
  customPrompt?: string,
  role: UserRole = 'student'
): Promise<QuizData> {
  const payloadFiles = files?.map((f) => ({
    name: f.name,
    mimeType: f.mimeType,
    data: f.data,
  }));

  try {
    const response = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        grade,
        topic,
        questionCount,
        difficulty,
        files: payloadFiles,
        customPrompt,
        role,
      }),
    });

    const data = await parseJsonResponse<QuizData>(
      response,
      'Lỗi khi tạo câu hỏi trắc nghiệm'
    );
    return data;
  } catch (backendError: any) {
    console.warn('Backend /api/quiz issue, attempting client fallback:', backendError?.message);

    const clientKey = getEffectiveApiKey();
    if (clientKey) {
      try {
        return await clientGenerateQuizFromAI(
          clientKey,
          subject,
          grade,
          topic,
          questionCount,
          difficulty,
          files,
          customPrompt,
          role
        );
      } catch (clientErr: any) {
        throw new Error(`Lỗi tạo bài trắc nghiệm: ${clientErr?.message || 'Không thể tạo đề'}`);
      }
    }

    throw new Error(handleVercelHelpMessage(backendError));
  }
}

export async function generateEssayExamFromAI(
  subject: Subject,
  grade: Grade,
  topic: string,
  questionCount: number = 3,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  files?: UploadedFileItem[],
  customPrompt?: string,
  role: UserRole = 'teacher'
): Promise<QuizData> {
  const payloadFiles = files?.map((f) => ({
    name: f.name,
    mimeType: f.mimeType,
    data: f.data,
  }));

  try {
    const response = await fetch('/api/essay-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        grade,
        topic,
        questionCount,
        difficulty,
        files: payloadFiles,
        customPrompt,
        role,
      }),
    });

    const data = await parseJsonResponse<QuizData>(
      response,
      'Lỗi khi tạo đề thi tự luận'
    );
    data.examFormat = 'essay';
    return data;
  } catch (backendError: any) {
    console.warn('Backend /api/essay-exam issue, attempting client fallback:', backendError?.message);

    const clientKey = getEffectiveApiKey();
    if (clientKey) {
      try {
        return await clientGenerateEssayExamFromAI(
          clientKey,
          subject,
          grade,
          topic,
          questionCount,
          difficulty,
          files,
          customPrompt
        );
      } catch (clientErr: any) {
        throw new Error(`Lỗi tạo đề tự luận: ${clientErr?.message || 'Không thể tạo đề'}`);
      }
    }

    throw new Error(handleVercelHelpMessage(backendError));
  }
}

export async function gradeEssayWithAI(
  question: string,
  sampleAnswer: string,
  rubric: string,
  studentAnswer: string,
  maxPoints: number = 2,
  grade?: Grade,
  subject?: Subject
): Promise<{ score: number; comment: string }> {
  try {
    const response = await fetch('/api/grade-essay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        sampleAnswer,
        rubric,
        studentAnswer,
        maxPoints,
        grade,
        subject,
      }),
    });

    return await parseJsonResponse<{ score: number; comment: string }>(
      response,
      'Lỗi khi chấm điểm bài tự luận'
    );
  } catch (backendError: any) {
    const clientKey = getEffectiveApiKey();
    if (clientKey) {
      try {
        return await clientGradeEssayWithAI(
          clientKey,
          question,
          sampleAnswer,
          rubric,
          studentAnswer,
          maxPoints,
          grade,
          subject
        );
      } catch (clientErr: any) {
        throw new Error(`Lỗi chấm điểm: ${clientErr?.message || 'Không thể chấm bài'}`);
      }
    }

    throw new Error(handleVercelHelpMessage(backendError));
  }
}
