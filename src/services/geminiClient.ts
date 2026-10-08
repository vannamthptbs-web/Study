import { GoogleGenAI, Type } from '@google/genai/web';
import { Grade, Subject, QuizData, UploadedFileItem, UserRole } from '../types/study';
import { DIRECT_GEMINI_API_KEY } from '../config/aiConfig';

const STORAGE_API_KEY = 'study_ai_gemini_api_key';

export function getCustomApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_API_KEY) || '';
  } catch {
    return '';
  }
}

export function setCustomApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(STORAGE_API_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_API_KEY);
    }
  } catch (e) {
    console.error('Cannot save custom API key:', e);
  }
}

export function getEffectiveApiKey(): string {
  // 1. Cấu hình trực tiếp trong mã nguồn (dành cho đẩy thẳng lên GitHub & Vercel)
  if (DIRECT_GEMINI_API_KEY && typeof DIRECT_GEMINI_API_KEY === 'string' && DIRECT_GEMINI_API_KEY.trim().length > 0) {
    return DIRECT_GEMINI_API_KEY.trim();
  }

  // 2. Cấu hình qua giao diện Admin trong LocalStorage trình duyệt
  const custom = getCustomApiKey();
  if (custom) return custom;

  // 3. Biến môi trường VITE_GEMINI_API_KEY từ Vercel/Vite
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }

  return '';
}

// Convert uploaded base64 files for client-side Gemini call
function buildFileParts(files?: UploadedFileItem[]) {
  if (!files || !Array.isArray(files) || files.length === 0) return [];
  const parts: any[] = [];
  for (const f of files) {
    if (f.data && f.mimeType) {
      parts.push({
        inlineData: {
          mimeType: f.mimeType,
          data: f.data,
        },
      });
    }
  }
  return parts;
}

const BASE_TUTOR_SYSTEM_INSTRUCTION = `Bạn là "StudyAI Tiểu học" – một Gia sư AI thông minh, vui vẻ, ấm áp, kiên nhẫn và giàu kinh nghiệm sư phạm Tiểu học dành riêng cho học sinh và thầy cô Việt Nam (từ Lớp 1 đến Lớp 5).
NGUYÊN TẮC:
1. Xưng hô thân mật: "Thầy/Cô - Con (hoặc Em)" hoặc "StudyAI - Bạn nhỏ".
2. Bám sát SGK mới Bộ GD&ĐT (Kết nối tri thức, Chân trời sáng tạo, Cánh diều).
3. Hướng dẫn từng bước trực quan, không chỉ đưa đáp án.
4. Mọi phép tính, phân số, công thức viết bằng LaTeX chuẩn ($...$ hoặc $$...$$).`;

// Candidate models for client fallback
const CLIENT_CANDIDATE_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];

async function executeWithModelFallback<T>(
  apiKey: string,
  runFn: (ai: GoogleGenAI, model: string) => Promise<T>,
  timeoutMs = 18000
): Promise<T> {
  const ai = new GoogleGenAI({ apiKey });
  let lastError: any;
  for (const model of CLIENT_CANDIDATE_MODELS) {
    try {
      const result = await Promise.race([
        runFn(ai, model),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Hết thời gian chờ phản hồi (${timeoutMs}ms)`)), timeoutMs)
        ),
      ]);
      return result;
    } catch (err: any) {
      lastError = err;
      console.warn(`Client Gemini model ${model} issue:`, err?.message);
    }
  }
  throw lastError;
}

export async function testGeminiApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || !apiKey.trim()) return false;
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: 'Chào bạn, trả lời "OK" nếu kết nối thành công.',
    });
    return !!res.text;
  } catch (err) {
    console.error('Test API Key failed:', err);
    throw err;
  }
}

export async function clientSendMessageToTutor(
  apiKey: string,
  messages: { role: string; content: string }[],
  grade: Grade,
  subject: Subject,
  files?: UploadedFileItem[]
): Promise<string> {
  return await executeWithModelFallback(apiKey, async (ai, model) => {
    const systemInstruction = `${BASE_TUTOR_SYSTEM_INSTRUCTION}\nKhối lớp: ${grade}, Môn học: ${subject}.`;
    const formattedContents = messages.map((m, index) => {
      const isLatestUser = index === messages.length - 1 && m.role === 'user';
      const parts: any[] = [];
      if (isLatestUser && files && files.length > 0) {
        parts.push(...buildFileParts(files));
      }
      parts.push({ text: m.content || '(Xem hình ảnh/tệp tin đính kèm và hướng dẫn giúp em)' });
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts,
      };
    });

    const response = await ai.models.generateContent({
      model,
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || 'Thầy/cô chưa xử lý được câu trả lời này. Em hãy thử lại nhé!';
  });
}

export async function clientSolveProblemWithAI(
  apiKey: string,
  problem: string,
  grade: Grade,
  subject: Subject,
  files?: UploadedFileItem[]
): Promise<string> {
  return await executeWithModelFallback(apiKey, async (ai, model) => {
    const hasText = problem && problem.trim().length > 0;
    const promptText = `Học sinh lớp: ${grade}, Môn học: ${subject}.
Đề bài cần giải ${hasText ? `:\n"""\n${problem}\n"""` : 'được đính kèm trong hình ảnh/tệp tin đính kèm.'}
YÊU CẦU:
1. 🔍 TÓM TẮT ĐỀ BÀI (cho biết gì, hỏi gì).
2. 📋 DỮ KIỆN & CÔNG THỨC: viết công thức LaTeX chuẩn ($...$).
3. 📝 BÀI GIẢI CHI TIẾT: câu lời giải rõ ràng, phép tính và đáp số.
4. 💡 LƯU Ý LỖI BÉ HAY SAI.
5. 🎯 BÀI TẬP TỰ LUYỆN TƯƠNG TỰ.`;

    const parts: any[] = [];
    if (files && files.length > 0) {
      parts.push(...buildFileParts(files));
    }
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction: BASE_TUTOR_SYSTEM_INSTRUCTION,
        temperature: 0.5,
      },
    });

    return response.text || 'Không thể tạo lời giải lúc này.';
  });
}

export async function clientGenerateTopicReview(
  apiKey: string,
  topic: string,
  grade: Grade,
  subject: Subject
): Promise<string> {
  return await executeWithModelFallback(apiKey, async (ai, model) => {
    const prompt = `Học sinh khối lớp: ${grade}, Môn: ${subject}.
Chủ đề / Tên bài học: "${topic}".
Hãy xây dựng đề cương ôn tập toàn diện chuẩn SGK Tiểu học mới:
1. 📌 Tổng quan & Ý nghĩa thực tế
2. 🔑 Khái niệm & Quy tắc cốt lõi
3. 📐 Bảng công thức chuẩn LaTeX ($...$)
4. 💡 Ví dụ minh họa điển hình có lời giải
5. ⚠️ Lỗi sai bé thường gặp
6. ⚡ Tóm tắt 30 giây ghi nhớ nhanh
7. ❓ 3 câu đố vui tự kiểm tra`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: BASE_TUTOR_SYSTEM_INSTRUCTION,
        temperature: 0.6,
      },
    });

    return response.text || 'Không thể tạo tài liệu ôn tập.';
  });
}

export async function clientGenerateQuizFromAI(
  apiKey: string,
  subject: Subject,
  grade: Grade,
  topic: string,
  questionCount: number = 5,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  files?: UploadedFileItem[],
  customPrompt?: string,
  role: UserRole = 'student'
): Promise<QuizData> {
  return await executeWithModelFallback(apiKey, async (ai, model) => {
    const count = Math.min(Math.max(Number(questionCount) || 5, 2), 20);
    const promptText = `Bạn là chuyên gia soạn thảo đề thi trắc nghiệm Tiểu học Việt Nam:
- Đối tượng: ${role === 'teacher' ? 'Giáo viên' : 'Học sinh'}
- Lớp: ${grade}, Môn: ${subject}, Chủ đề: "${topic}"
- Số lượng: ${count} câu, Mức độ: ${difficulty}
${customPrompt ? `- Yêu cầu thêm: ${customPrompt}` : ''}
YÊU CẦU:
1. Đúng 4 phương án A, B, C, D.
2. correctAnswer chỉ là chữ cái: "A", "B", "C" hoặc "D".
3. Mọi công thức, phép tính toán học viết trong LaTeX ($...$).
4. explanation giải thích cặn kẽ tại sao đúng/sai.
5. subtopic ghi rõ tên chuyên đề nhỏ.`;

    const parts: any[] = [];
    if (files && files.length > 0) {
      parts.push(...buildFileParts(files));
    }
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            topic: { type: Type.STRING },
            grade: { type: Type.STRING },
            subject: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  subtopic: { type: Type.STRING },
                },
                required: ['id', 'question', 'options', 'correctAnswer', 'explanation', 'subtopic'],
              },
            },
          },
          required: ['title', 'topic', 'questions'],
        },
      },
    });

    const raw = response.text || '{}';
    return JSON.parse(raw);
  });
}

export async function clientGenerateEssayExamFromAI(
  apiKey: string,
  subject: Subject,
  grade: Grade,
  topic: string,
  questionCount: number = 3,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  files?: UploadedFileItem[],
  customPrompt?: string
): Promise<QuizData> {
  return await executeWithModelFallback(apiKey, async (ai, model) => {
    const count = Math.min(Math.max(Number(questionCount) || 3, 1), 10);
    const promptText = `Bạn là chuyên gia sư phạm Tiểu học Việt Nam biên soạn đề thi tự luận chuẩn theo SGK:
- Lớp: ${grade}, Môn: ${subject}, Chủ đề: "${topic}"
- Số lượng: ${count} câu tự luận, Mức độ: ${difficulty}
${customPrompt ? `- Yêu cầu thêm: ${customPrompt}` : ''}
YÊU CẦU:
1. Mỗi câu có: id, question (đề bài), points (số điểm, tổng các câu bằng 10), guideline (gợi ý cách giải), sampleAnswer (lời giải chi tiết mẫu), rubric (biểu điểm chấm), subtopic.
2. Công thức và phép tính toán học viết trong LaTeX ($...$).`;

    const parts: any[] = [];
    if (files && files.length > 0) {
      parts.push(...buildFileParts(files));
    }
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            topic: { type: Type.STRING },
            grade: { type: Type.STRING },
            subject: { type: Type.STRING },
            durationMinutes: { type: Type.INTEGER },
            essayQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  question: { type: Type.STRING },
                  points: { type: Type.NUMBER },
                  guideline: { type: Type.STRING },
                  sampleAnswer: { type: Type.STRING },
                  rubric: { type: Type.STRING },
                  subtopic: { type: Type.STRING },
                },
                required: ['id', 'question', 'points', 'sampleAnswer', 'rubric'],
              },
            },
          },
          required: ['title', 'topic', 'essayQuestions'],
        },
      },
    });

    const raw = response.text || '{}';
    const parsed = JSON.parse(raw);
    parsed.examFormat = 'essay';
    parsed.questions = [];
    return parsed;
  });
}

export async function clientGradeEssayWithAI(
  apiKey: string,
  question: string,
  sampleAnswer: string,
  rubric: string,
  studentAnswer: string,
  maxPoints: number = 2,
  grade?: Grade,
  subject?: Subject
): Promise<{ score: number; comment: string }> {
  return await executeWithModelFallback(apiKey, async (ai, model) => {
    const prompt = `Bạn là giáo viên chấm thi Tiểu học tận tâm (${subject || 'Toán'} - ${grade || 'Tiểu học'}).
- Đề bài tự luận: "${question}"
- Thang điểm tối đa: ${maxPoints} điểm
- Đáp án mẫu & lời giải chuẩn: "${sampleAnswer}"
- Biểu điểm: "${rubric || 'Đúng lời giải và phép tính'}"
- Bài làm của học sinh:
"""
${studentAnswer}
"""
Hãy chấm điểm (0 đến ${maxPoints}) và nhận xét lời phê ân cần, giúp học sinh sửa lỗi và tiến bộ.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            comment: { type: Type.STRING },
          },
          required: ['score', 'comment'],
        },
      },
    });

    const raw = response.text || '{"score": 0, "comment": "Chưa thể chấm điểm."}';
    return JSON.parse(raw);
  });
}
