import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { DIRECT_GEMINI_API_KEY } from './src/config/aiConfig.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));

// Initialize GoogleGenAI SDK with required telemetry header
const getGenAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || DIRECT_GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Common Tutor System Instruction in Vietnamese for Primary School
const BASE_TUTOR_SYSTEM_INSTRUCTION = `Bạn là "StudyAI Tiểu học" – một Gia sư AI thông minh, vui vẻ, ấm áp, kiên nhẫn và giàu kinh nghiệm sư phạm Tiểu học dành riêng cho học sinh và thầy cô Việt Nam (từ Lớp 1 đến Lớp 5).

NGUYÊN TẮC VÀ PHƯƠNG PHÁP SƯ PHẠM TIỂU HỌC CỐT LÕI:
1. XƯNG HÔ THÂN MẬT, GẦN GŨI: Xưng hô "Thầy/Cô - Con (hoặc Em)" hoặc "StudyAI - Bạn nhỏ". Giọng văn luôn tươi vui, nhẹ nhàng, truyền cảm hứng và kiên nhẫn như một người thầy, người cô tận tâm bên cạnh bé.
2. CHUẨN CHƯƠNG TRÌNH GDPT 2018 TIỂU HỌC: Bám sát sách giáo khoa mới (Kết nối tri thức với cuộc sống, Chân trời sáng tạo, Cánh diều) theo đúng khối lớp bé chọn (Lớp 1, 2, 3, 4, hoặc 5).
3. GIẢI THÍCH TRỰC QUAN, DỄ HIỂU:
   - Dùng ví dụ gắn liền với đời sống hàng ngày của trẻ nhỏ (que tính, viên bi, chiếc kẹo, quả táo, tranh vẽ ngộ nghĩnh).
   - Với môn Toán: Hướng dẫn bé tóm tắt bài toán, vẽ sơ đồ đoạn thẳng (nếu là bài toán có lời văn), viết câu lời giải tròn trịa, phép tính có đơn vị đo trong ngoặc đơn, và ghi đáp số rõ ràng.
   - Với môn Tiếng Việt: Giúp bé phân biệt chính tả (l/n, ch/tr, s/x, c/k, g/gh), hiểu nghĩa của từ, đặt câu đủ chủ ngữ - vị ngữ, và hướng dẫn dàn ý bài văn miêu tả/kể chuyện sinh động, giàu hình ảnh và cảm xúc.
   - Với môn Tiếng Anh: Giải thích từ vựng đơn giản, phát âm chuẩn, mẫu câu giao tiếp tự nhiên phù hợp lứa tuổi.
   - Với môn Khoa học, Lịch sử & Địa lý, Tin học, Đạo đức: Giải thích bằng những mẩu chuyện vui, giải đáp tò mò khoa học kỳ thú, giáo dục đạo đức và kỹ năng sống an toàn.
4. TUYỆT ĐỐI KHÔNG CHỈ ĐƯA ĐÁP ÁN: Mục tiêu là giúp bé hiểu bản chất, biết cách suy nghĩ và hào hứng tự mình làm bài.
5. KHÍCH LỆ VÀ ĐỘNG VIÊN: Luôn có lời khen ngợi chân thành ("Con giỏi lắm!", "Rất đáng khen!", "Câu hỏi của bé rất thú vị!").
6. KHI CÓ HÌNH ẢNH / TỆP ĐÍNH KÈM: Đọc kỹ chữ viết tay, hình vẽ, sơ đồ trong ảnh bài tập, trích dẫn lại đề bài rồi mới hướng dẫn giải thích.
7. CUỐI MỖI CÂU TRẢ LỜI: Đưa ra một câu đố vui hoặc thử thách nho nhỏ ("⭐ Thử thách đố vui cho bạn nhỏ:") để bé cùng thử sức.
8. QUY CHUẨN CÔNG THỨC & PHÉP TÍNH:
   - Viết các phép tính, phân số, công thức hình học bằng LaTeX chuẩn ($...$ hoặc $$...$$).
   - Ví dụ: $15 + 8 = 23$, $s = v \\times t$, $P = (a + b) \\times 2$, $\\frac{1}{2} + \\frac{1}{3} = \\frac{5}{6}$, $S = a \\times b$. Đơn vị đo viết chuẩn: $\\text{cm}$, $\\text{m}$, $\\text{cm}^2$, $\\text{kg}$, $\\text{lít}$.`;

// Helper to convert uploaded files to Gemini content parts
function buildFileParts(files?: Array<{ name: string; mimeType: string; data: string }>) {
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

// Candidate models with fast failover: 'gemini-3.5-flash-lite' is super fast (1s) and available; followed by 'gemini-3.8-flash' and 'gemini-3.5-flash'
const CANDIDATE_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash'];

async function generateWithModelFallback<T>(
  generateFn: (model: string) => Promise<T>,
  timeoutMs = 15000
): Promise<T> {
  let lastError: any;
  for (const model of CANDIDATE_MODELS) {
    try {
      const result = await Promise.race([
        generateFn(model),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout model ${model} sau ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
      return result;
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} issue (${err?.message || ''}), trying fallback model...`);
    }
  }
  throw lastError;
}

// User-friendly error message formatter
function formatErrorMessage(err: any, fallbackText: string): string {
  const msg = err?.message || '';
  if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
    return 'Hệ thống AI đang nhận lượng truy cập cao trong giây lát. Vui lòng bấm Thử lại sau vài giây!';
  }
  if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'Hệ thống đã đạt giới hạn yêu cầu tạm thời. Vui lòng đợi một lát rồi thử lại nhé.';
  }
  return fallbackText;
}

// Built-in educational fallback quizzes for common topics when API is experiencing high demand
function generateFallbackQuiz(subject: string, grade: string, topic: string) {
  return {
    title: `Bài kiểm tra vui học củng cố kiến thức: ${topic}`,
    topic,
    grade: grade || 'Lớp 4',
    subject: subject || 'Toán',
    questions: [
      {
        id: 1,
        question: `Khái niệm hoặc quy tắc cơ bản nào sau đây là ĐÚNG khi học về "${topic}" (${subject} - ${grade})?`,
        options: [
          'A. Đây là bài học quan trọng trong chương trình SGK Tiểu học giúp bé rèn luyện tư duy.',
          'B. Quy tắc này chỉ dùng cho người lớn, học sinh tiểu học không cần quan tâm.',
          'C. Hoàn toàn không cần đọc kỹ đề bài khi làm bài tập.',
          'D. Chỉ cần đoán ngẫu nhiên kết quả mà không cần tính toán.',
        ],
        correctAnswer: 'A',
        explanation: 'Phương án A chính xác! Bài học này là kiến thức nền tảng trong sách giáo khoa Tiểu học mới của Bộ GD&ĐT.',
        subtopic: 'Kiến thức trọng tâm bài học',
      },
      {
        id: 2,
        question: `Khi giải bài toán hoặc bài tập liên quan đến "${topic}", bước đầu tiên bạn nhỏ cần làm là gì?`,
        options: [
          'A. Điền bừa đáp số thật nhanh để nộp bài trước.',
          'B. Đọc kỹ đề bài, xác định điều bài toán cho biết và điều bài toán hỏi.',
          'C. Bỏ qua câu hỏi và chuyển sang câu khác.',
          'D. Không cần viết câu lời giải hay đơn vị đo.',
        ],
        correctAnswer: 'B',
        explanation: 'Rất chính xác! Đọc kỹ đề bài, xác định dữ kiện đã cho và yêu cầu cần tìm là bí quyết số một để đạt điểm 10!',
        subtopic: 'Kỹ năng đọc hiểu đề bài',
      },
      {
        id: 3,
        question: `Để không bị mất điểm đáng tiếc ở dạng bài này, các bạn nhỏ cần chú ý điều gì nhất?`,
        options: [
          'A. Tính toán cẩn thận, ghi đúng đơn vị đo trong ngoặc đơn và kiểm tra lại đáp số.',
          'B. Vẽ hình nguệch ngoạc và tẩy xóa nhiều lần.',
          'C. Làm bài thật vội vàng và không soát lại bài.',
          'D. Không viết dấu chấm, dấu phẩy trong câu văn.',
        ],
        correctAnswer: 'A',
        explanation: 'Tuyệt vời! Tính toán cẩn thận từng bước và kiểm tra lại kết quả trước khi nộp bài giúp bé luôn đạt kết quả xuất sắc!',
        subtopic: 'Kỹ năng làm bài cẩn thận',
      },
    ],
  };
}

// API 1: Chatbot gia sư đa lượt (Multi-turn chat + Multimodal)
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages, grade, subject, files } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Danh sách tin nhắn không hợp lệ.' });
      return;
    }

    const ai = getGenAIClient();

    const systemInstruction = `${BASE_TUTOR_SYSTEM_INSTRUCTION}
Hiện tại học sinh đang học: ${grade || 'Tiểu học (Lớp 1 – Lớp 5)'}, Môn học: ${subject || 'Tổng hợp'}.
Hãy điều chỉnh thuật ngữ, mức độ nâng cao và ví dụ minh họa chính xác theo khối lớp và môn học này.`;

    // Format contents for generateContent
    const formattedContents = messages.map((m: { role: string; content: string }, index: number) => {
      const isLatestUser = index === messages.length - 1 && m.role === 'user';
      const parts: any[] = [];

      // If this is the latest message and files are attached, prepend the file parts
      if (isLatestUser && files && Array.isArray(files) && files.length > 0) {
        const fileParts = buildFileParts(files);
        parts.push(...fileParts);
      }

      parts.push({ text: m.content || '(Xem hình ảnh/tệp tin đính kèm và hướng dẫn giải giúp em)' });

      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts,
      };
    });

    const response = await generateWithModelFallback((model) =>
      ai.models.generateContent({
        model,
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      })
    );

    const reply = response.text || 'Xin lỗi, thầy/cô chưa xử lý được câu trả lời này. Em hãy thử lại nhé!';
    res.json({ reply });
  } catch (error: any) {
    console.error('Lỗi API /api/chat:', error);
    res.status(500).json({
      error: formatErrorMessage(error, 'Đã có lỗi xảy ra khi kết nối tới trợ lý AI.'),
    });
  }
});

// API 2: Giải bài tập sư phạm từng bước (+ Multimodal image/file input)
app.post('/api/solve', async (req: Request, res: Response) => {
  try {
    const { problem, grade, subject, files } = req.body;

    const hasText = problem && typeof problem === 'string' && problem.trim().length > 0;
    const hasFiles = files && Array.isArray(files) && files.length > 0;

    if (!hasText && !hasFiles) {
      res.status(400).json({ error: 'Vui lòng nhập đề bài hoặc tải ảnh/tệp đề bài cần giải.' });
      return;
    }

    const ai = getGenAIClient();

    const promptText = `Học sinh lớp: ${grade || 'Tiểu học (Lớp 1 – Lớp 5)'}, Môn học: ${subject || 'Toán học'}.
Đề bài cần giải ${hasText ? `:\n"""\n${problem}\n"""` : 'được đính kèm trong hình ảnh/tệp tin đính kèm.'}

YÊU CẦU ĐỐI VỚI GIA SƯ TIỂU HỌC:
Nếu có ảnh/tệp, hãy đọc kỹ và trích xuất chính xác đề bài và công thức/phép tính ra trước. Sau đó giải theo đúng chuẩn phương pháp sư phạm Tiểu học:

1. 🔍 **TÓM TẮT ĐỀ BÀI**: 
   - Bài toán cho biết gì? Bài toán hỏi gì?
   - Gợi ý vẽ sơ đồ đoạn thẳng hoặc hình vẽ minh họa trực quan (nếu là toán có lời văn).
2. 📋 **DỮ KIỆN & ĐẠI LƯỢNG**:
   - Ghi rõ các dữ kiện đã cho kèm đơn vị đo bằng công thức chuẩn (ví dụ: $a = 15\\text{ cm}$, $b = 8\\text{ cm}$, $v = 40\\text{ km/h}$, $t = 2\\text{ giờ}$).
   - Nêu rõ đại lượng cần tìm.
3. 🧠 **KIẾN THỨC & QUY TẮC CẦN NHỚ**: Liệt kê quy tắc tính, công thức chuẩn bằng LaTeX ($...$ hoặc $$...$$) phù hợp đúng chuẩn SGK Tiểu học (Bộ GD&ĐT).
4. 📝 **HƯỚNG DẪN BÀI GIẢI CHI TIẾT**:
   - Viết từng câu lời giải tròn trịa, phép tính rõ ràng, đơn vị đo trong ngoặc đơn, tính toán cẩn thận.
   - Mọi phép tính, phân số, công thức hình học đều PHẢI viết bằng công thức LaTeX chuẩn.
5. ✅ **ĐÁP SỐ**: Ghi rõ đáp số cuối cùng kèm đơn vị.
6. 💡 **LỜI KHUYÊN & LỖI BÉ HAY NHẦM**:
   - Chỉ ra bí quyết làm nhanh và dễ nhớ.
   - Cảnh báo các lỗi bé hay mắc phải (nhầm bảng cửu chương, quên đổi đơn vị đo về cùng loại, quên viết câu lời giải hoặc đáp số).
7. 🎯 **BÀI TẬP TỰ LUYỆN TƯƠNG TỰ**: Đưa ra 1 bài tập có dạng tương tự kèm đáp số gợi ý để bé tự làm kiểm tra bản thân.`;

    const contents: any[] = [];
    const fileParts = buildFileParts(files);
    if (fileParts.length > 0) {
      contents.push(...fileParts);
    }
    contents.push({ text: promptText });

    const response = await generateWithModelFallback((model) =>
      ai.models.generateContent({
        model,
        contents: { parts: contents },
        config: {
          systemInstruction: BASE_TUTOR_SYSTEM_INSTRUCTION,
          temperature: 0.5,
        },
      })
    );

    const solution = response.text || 'Không thể tạo lời giải lúc này.';
    res.json({ solution });
  } catch (error: any) {
    console.error('Lỗi API /api/solve:', error);
    res.status(500).json({
      error: formatErrorMessage(error, 'Lỗi khi giải bài tập.'),
    });
  }
});

// API 3: Ôn bài & Tóm tắt kiến thức cốt lõi (Topic Revision)
app.post('/api/review', async (req: Request, res: Response) => {
  try {
    const { topic, grade, subject } = req.body;

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập tên bài hoặc chủ đề cần ôn tập.' });
      return;
    }

    const ai = getGenAIClient();

    const prompt = `Học sinh khối lớp: ${grade || 'Tiểu học (Lớp 1 – Lớp 5)'}, Môn học: ${subject || 'Toán học'}.
Chủ đề / Tên bài học: "${topic}".

Hãy xây dựng một đề cương ôn tập toàn diện, sinh động, dễ nhớ và cực kỳ dễ hiểu theo chuẩn chương trình Tiểu học mới (Bộ GD&ĐT) gồm các phần:
1. 📌 **TỔNG QUAN & Ý NGHĨA**: Tại sao chúng ta học bài này? Ví dụ đời sống gần gũi với trẻ nhỏ.
2. 🔑 **CÁC KHÁI NIỆM & QUY TẮC QUAN TRỌNG**: Định nghĩa cô đọng, câu thần chú ghi nhớ mẹo học nhanh.
3. 📐 **BẢNG QUY TẮC / CÔNG THỨC CỐT LÕI**: Bảng công thức hoặc quy tắc chuẩn LaTeX ($...$ và $$...$$), kèm đơn vị đo và lưu ý khi tính toán.
4. 💡 **VÍ DỤ MINH HỌA ĐIỂN HÌNH**: 1-2 ví dụ tiêu biểu từ cơ bản đến nâng cao có lời giải mẫu, viết công thức và phép tính bằng LaTeX chuẩn.
5. ⚠️ **LỖI SAI BÉ THƯỜNG GẶP**: Những chỗ học sinh tiểu học hay bị nhầm lẫn hoặc mất điểm.
6. ⚡ **TÓM TẮT 30 GIÂY (GHI NHỚ NHANH)**: 3-5 gạch đầu dòng ngắn gọn để bé dễ thuộc lòng.
7. ❓ **3 CÂU ĐỐ VUI TỰ KIỂM TRA NHANH**: Kèm đáp án và giải thích ngắn gọn ẩn phía sau.`;

    const response = await generateWithModelFallback((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: BASE_TUTOR_SYSTEM_INSTRUCTION,
          temperature: 0.6,
        },
      })
    );

    const reviewContent = response.text || 'Không thể tạo tài liệu ôn tập.';
    res.json({ review: reviewContent });
  } catch (error: any) {
    console.error('Lỗi API /api/review:', error);
    res.status(500).json({
      error: formatErrorMessage(error, 'Lỗi khi tạo nội dung ôn bài.'),
    });
  }
});

// API 4: Tạo bộ câu hỏi trắc nghiệm chuẩn JSON (Quiz Generator cho HS & GV)
app.post('/api/quiz', async (req: Request, res: Response) => {
  try {
    const {
      subject,
      grade,
      topic,
      questionCount = 5,
      difficulty = 'medium',
      files,
      customPrompt,
      role = 'student', // 'student' or 'teacher'
    } = req.body;

    const hasTopic = topic && typeof topic === 'string' && topic.trim().length > 0;
    const hasFiles = files && Array.isArray(files) && files.length > 0;

    if (!hasTopic && !hasFiles) {
      res.status(400).json({ error: 'Vui lòng cung cấp chủ đề hoặc tải tệp tài liệu/đề thi.' });
      return;
    }

    const ai = getGenAIClient();
    const count = Math.min(Math.max(Number(questionCount) || 5, 2), 20);

    const promptText = `Bạn là chuyên gia soạn thảo đề thi trắc nghiệm và ngân hàng câu hỏi chuẩn cho thầy cô và học sinh Tiểu học Việt Nam.
- Đối tượng: ${role === 'teacher' ? 'Thầy/Cô giáo Tiểu học đang tạo bài ôn luyện cho lớp' : 'Học sinh Tiểu học đang tự luyện tập vui học'}
- Khối lớp: ${grade || 'Lớp 4'}
- Môn học: ${subject || 'Toán'}
- Chủ đề: "${topic || 'Theo tài liệu/hình ảnh đính kèm'}"
- Số lượng câu hỏi: ${count} câu
- Mức độ: ${difficulty === 'easy' ? 'Nhận biết - Thông hiểu' : difficulty === 'hard' ? 'Vận dụng sáng tạo' : 'Thông hiểu - Vận dụng'}
${customPrompt ? `- Yêu cầu đặc biệt: ${customPrompt}` : ''}

YÊU CẦU BẮT BUỘC VỀ DỮ LIỆU JSON:
1. Câu hỏi bám sát chuẩn kiến thức SGK Tiểu học Việt Nam hiện hành (Kết nối tri thức, Chân trời sáng tạo, Cánh diều).
2. Nếu có tệp/ảnh đính kèm: Hãy khai thác các câu hỏi, dữ liệu hoặc nội dung từ tệp đó để tạo ra các câu hỏi trắc nghiệm chất lượng.
3. Đúng 4 phương án rõ ràng (A, B, C, D).
4. Trường correctAnswer CHỈ LÀ một chữ cái in hoa: "A", "B", "C" hoặc "D".
5. Trường explanation phải phân tích cặn kẽ bằng lời lẽ ân cần, dễ hiểu tại sao phương án đó đúng, và tại sao các phương án khác sai (giúp bé hiểu sâu bản chất).
6. Mỗi câu hỏi phải có trường "subtopic" (tên chuyên đề nhỏ cụ thể) để phục vụ việc đánh giá lỗ hổng kiến thức.
7. ĐỊNH DẠNG CÔNG THỨC TOÁN & ĐƠN VỊ ĐO CHUẨN XÁC: Mọi biểu thức, phân số, phép tính và công thức trong trường "question", các phương án trong "options" và lời giải trong "explanation" PHẢI viết theo chuẩn LaTeX nằm trong cặp dấu $...$ (ví dụ: "$15 + 8 = 23$", "$\\frac{1}{2} + \\frac{1}{4} = \\frac{3}{4}$", "$P = (a + b) \\times 2$", "$S = 45\\text{ cm}^2$", "$v = 40\\text{ km/h}$"). Hãy escape dấu gạch chéo ngược hợp lệ trong JSON (ví dụ \\\\frac, \\\\times, \\\\text).`;

    const parts: any[] = [];
    const fileParts = buildFileParts(files);
    if (fileParts.length > 0) {
      parts.push(...fileParts);
    }
    parts.push({ text: promptText });

    const response = await generateWithModelFallback((model) =>
      ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Tiêu đề bài kiểm tra trắc nghiệm' },
              topic: { type: Type.STRING, description: 'Chủ đề' },
              grade: { type: Type.STRING, description: 'Khối lớp' },
              subject: { type: Type.STRING, description: 'Môn học' },
              questions: {
                type: Type.ARRAY,
                description: 'Danh sách các câu hỏi',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    question: { type: Type.STRING, description: 'Nội dung câu hỏi' },
                    options: {
                      type: Type.ARRAY,
                      description: 'Mảng 4 phương án A, B, C, D (ví dụ: ["A. ...", "B. ...", "C. ...", "D. ..."])',
                      items: { type: Type.STRING },
                    },
                    correctAnswer: {
                      type: Type.STRING,
                      description: 'Chỉ ghi chữ cái đáp án đúng: A, B, C hoặc D',
                    },
                    explanation: {
                      type: Type.STRING,
                      description: 'Lời giải chi tiết và phân tích cặn kẽ tại sao đúng/sai',
                    },
                    subtopic: {
                      type: Type.STRING,
                      description: 'Tên chuyên đề nhỏ của câu hỏi để phát hiện lỗ hổng kiến thức',
                    },
                  },
                  required: ['id', 'question', 'options', 'correctAnswer', 'explanation', 'subtopic'],
                },
              },
            },
            required: ['title', 'topic', 'questions'],
          },
        },
      })
    );

    const rawText = response.text || '{}';
    const parsed = JSON.parse(rawText);
    res.json(parsed);
  } catch (error: any) {
    console.warn('Lỗi API /api/quiz:', error?.message);
    const isTransient =
      error?.message?.includes('503') ||
      error?.message?.includes('429') ||
      error?.message?.includes('UNAVAILABLE') ||
      error?.status === 503;

    if (isTransient && req.body.topic) {
      console.log('Phục hồi bằng bộ đề trắc nghiệm chuẩn dự phòng...');
      const fallback = generateFallbackQuiz(
        req.body.subject || 'Toán',
        req.body.grade || 'Lớp 4',
        req.body.topic
      );
      res.json(fallback);
      return;
    }

    res.status(500).json({
      error: formatErrorMessage(error, 'Lỗi khi tạo đề trắc nghiệm.'),
    });
  }
});

// ==========================================
// GOOGLE SHEETS AS DATABASE PROXY & SYNC
// ==========================================
let currentGoogleSheetUrl =
  'https://script.google.com/macros/s/AKfycbwSHX1Q0KVnrdab_vxKpdt_lEUZ89CrUeYsuB1_ZU0qNWtYPIVrAfw3Ng8w71vHl3IwqQ/exec';

// Get Google Sheets configuration
app.get('/api/sheets/config', (req: Request, res: Response) => {
  res.json({
    url: currentGoogleSheetUrl,
    status: 'connected',
  });
});

// Update Google Sheets configuration
app.post('/api/sheets/config', (req: Request, res: Response) => {
  const { url } = req.body;
  if (url && typeof url === 'string' && url.trim().startsWith('http')) {
    currentGoogleSheetUrl = url.trim();
  }
  res.json({ success: true, url: currentGoogleSheetUrl });
});

// Proxy write / sync action to Google Apps Script Web App
app.post('/api/sheets/sync', async (req: Request, res: Response) => {
  try {
    const { action, payload, sheetUrl } = req.body;
    const targetUrl = sheetUrl || currentGoogleSheetUrl;

    if (!action) {
      res.status(400).json({ error: 'Thiếu action cần đồng bộ.' });
      return;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload, timestamp: Date.now() }),
      redirect: 'follow',
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { status: 'success', raw: text };
    }

    res.json({ success: true, result: data });
  } catch (err: any) {
    console.error('Lỗi proxy Google Sheets sync:', err);
    res.status(502).json({
      error: 'Không thể kết nối đến Google Sheets: ' + (err?.message || 'Lỗi mạng'),
    });
  }
});

// Read all data from Google Sheets (Database duy nhất)
app.post('/api/sheets/read_all', async (req: Request, res: Response) => {
  try {
    const { sheetUrl } = req.body;
    const targetUrl = sheetUrl || currentGoogleSheetUrl;

    // Thử truy vấn GET với ?action=read_all trước (chuẩn cho doGet Apps Script)
    const readUrl = targetUrl.includes('?')
      ? `${targetUrl}&action=read_all`
      : `${targetUrl}?action=read_all`;

    let text = '';
    try {
      const getRes = await fetch(readUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
      });
      text = await getRes.text();
    } catch {
      // Fallback sang POST nếu GET gặp sự cố mạng
      const postRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read_all', timestamp: Date.now() }),
        redirect: 'follow',
      });
      text = await postRes.text();
    }

    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (data && (data.status === 'success' || data.success) && data.data) {
      res.json({ success: true, data: data.data });
    } else {
      res.json({
        success: false,
        raw: typeof text === 'string' ? text.slice(0, 500) : '',
        message: 'Google Sheets chưa trả về cấu trúc mảng read_all hoặc script đang dùng bản rút gọn.',
      });
    }
  } catch (err: any) {
    console.error('Lỗi đọc dữ liệu Google Sheets:', err);
    res.status(502).json({
      error: 'Lỗi kết nối Google Sheets: ' + (err?.message || 'Lỗi mạng'),
    });
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    appName: 'StudyAI – Trợ lý học tập AI',
    timestamp: new Date().toISOString(),
  });
});

// Explicit 404 handler for API routes to prevent fallback to index.html
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: `API endpoint ${req.method} ${req.path} không tìm thấy.`,
  });
});

// Express error handling middleware for API routes
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Express uncaught error:', err);
  if (req.path.startsWith('/api')) {
    res.status(500).json({ error: err?.message || 'Lỗi xử lý yêu cầu phía máy chủ.' });
    return;
  }
  next(err);
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StudyAI server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
