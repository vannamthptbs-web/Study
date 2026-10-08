/**
 * Utilities for LaTeX & Math/Science Formula Normalization, Syntax Preprocessing and Reference Templates
 */

export interface FormulaSnippet {
  id: string;
  name: string;
  category: 'Toán học' | 'Tiếng Việt' | 'Khoa học' | 'Ký hiệu & Đơn vị';
  latex: string;
  template: string;
  description: string;
  gradeLevel?: string;
}

/**
 * Preprocess markdown content containing math formulas:
 * 1. Convert standard LaTeX environments and delimiters \(...\) to $...$ and \[...\] to $$...$$
 * 2. Ensure block formulas $$...$$ have newline padding so remark-math parses them reliably
 * 3. Normalize common notations
 */
export function preprocessMath(content: string): string {
  if (!content) return '';

  let text = content;

  // Protect code blocks (```...```) from math replacement
  const codeBlocks: string[] = [];
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Protect inline code (`...`)
  const inlineCodes: string[] = [];
  text = text.replace(/`[^`\n]+`/g, (match) => {
    inlineCodes.push(match);
    return `__INLINE_CODE_${inlineCodes.length - 1}__`;
  });

  // Convert \[ ... \] into $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => {
    return `\n\n$$\n${formula.trim()}\n$$\n\n`;
  });

  // Convert \( ... \) into $ ... $
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, formula) => {
    return `$${formula.trim()}$`;
  });

  // Fix glued block formulas: text $$formula$$ text -> text \n\n$$formula$$\n\n text
  text = text.replace(/([^\n])\$\$([\s\S]*?)\$\$([^\n])/g, '$1\n\n$$$2$$\n\n$3');

  // Ensure $$ have newlines if they are single lines
  text = text.replace(/\n\$\$([^\n]+)\$\$\n/g, '\n\n$$\n$1\n$$\n\n');

  // Convert \ce{...} to \mathrm{...} if present
  text = text.replace(/\\ce\{([^{}]+)\}/g, (_, inner) => `\\mathrm{${inner}}`);

  // Restore inline codes
  text = text.replace(/__INLINE_CODE_(\d+)__/g, (_, idx) => inlineCodes[Number(idx)] || '');

  // Restore code blocks
  text = text.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => codeBlocks[Number(idx)] || '');

  return text;
}

/**
 * Quick symbol toolbar items for primary school students & teachers
 */
export const QUICK_MATH_SYMBOLS = [
  { label: '+', insert: ' + ', title: 'Phép cộng' },
  { label: '−', insert: ' - ', title: 'Phép trừ' },
  { label: '×', insert: ' \\times ', title: 'Phép nhân' },
  { label: '÷', insert: ' : ', title: 'Phép chia' },
  { label: '=', insert: ' = ', title: 'Dấu bằng' },
  { label: 'a/b', insert: '$\\frac{a}{b}$', title: 'Phân số' },
  { label: '<', insert: ' < ', title: 'Bé hơn' },
  { label: '>', insert: ' > ', title: 'Lớn hơn' },
  { label: '≤', insert: ' \\le ', title: 'Bé hơn hoặc bằng' },
  { label: '≥', insert: ' \\ge ', title: 'Lớn hơn hoặc bằng' },
  { label: 'cm', insert: '$\\text{cm}$', title: 'Xăng-ti-mét' },
  { label: 'm', insert: '$\\text{m}$', title: 'Mét' },
  { label: 'km', insert: '$\\text{km}$', title: 'Ki-lô-mét' },
  { label: 'cm²', insert: '$\\text{cm}^2$', title: 'Xăng-ti-mét vuông' },
  { label: 'm²', insert: '$\\text{m}^2$', title: 'Mét vuông' },
  { label: 'kg', insert: '$\\text{kg}$', title: 'Ki-lô-gam' },
  { label: 'tấn', insert: '$\\text{tấn}$', title: 'Tấn' },
  { label: 'lít', insert: '$\\text{lít}$', title: 'Lít' },
  { label: 'giờ', insert: '$\\text{giờ}$', title: 'Giờ' },
  { label: 'phút', insert: '$\\text{phút}$', title: 'Phút' },
  { label: 'v', insert: '$v$', title: 'Vận tốc' },
  { label: 's', insert: '$s$', title: 'Quãng đường' },
  { label: 't', insert: '$t$', title: 'Thời gian' },
  { label: 'S', insert: '$S$', title: 'Diện tích' },
  { label: 'P', insert: '$P$', title: 'Chu vi' },
  { label: 'V', insert: '$V$', title: 'Thể tích' },
];

/**
 * Comprehensive standard formulas repository for Elementary School (Tiểu học Lớp 1 - 5)
 */
export const STANDARD_FORMULAS: FormulaSnippet[] = [
  // --- TOÁN HỌC TIỂU HỌC ---
  {
    id: 'math-rect',
    name: 'Chu vi & Diện tích Hình chữ nhật',
    category: 'Toán học',
    latex: 'P = (a + b) \\times 2 \\quad;\\quad S = a \\times b',
    template: '$$\\text{Chu vi: } P = (a + b) \\times 2$$\n$$\\text{Diện tích: } S = a \\times b$$',
    description: 'Trong đó $a$ là chiều dài, $b$ là chiều rộng (cùng một đơn vị đo). Muốn tính chu vi lấy dài cộng rộng nhân 2; muốn tính diện tích lấy dài nhân rộng.',
    gradeLevel: 'Lớp 3, 4, 5',
  },
  {
    id: 'math-square',
    name: 'Chu vi & Diện tích Hình vuông',
    category: 'Toán học',
    latex: 'P = a \\times 4 \\quad;\\quad S = a \\times a',
    template: '$$\\text{Chu vi: } P = a \\times 4$$\n$$\\text{Diện tích: } S = a \\times a$$',
    description: 'Trong đó $a$ là độ dài cạnh hình vuông. Chu vi bằng độ dài cạnh nhân với 4; diện tích bằng độ dài cạnh nhân với chính nó.',
    gradeLevel: 'Lớp 3, 4, 5',
  },
  {
    id: 'math-triangle',
    name: 'Diện tích Hình tam giác',
    category: 'Toán học',
    latex: 'S = \\frac{a \\times h}{2}',
    template: '$$S = \\frac{a \\times h}{2} \\quad\\text{hoặc}\\quad S = (a \\times h) : 2$$',
    description: 'Trong đó $a$ là độ dài đáy, $h$ là chiều cao tương ứng (cùng một đơn vị đo). Muốn tính diện tích hình tam giác ta lấy độ dài đáy nhân với chiều cao rồi chia cho 2.',
    gradeLevel: 'Lớp 5',
  },
  {
    id: 'math-trapezoid',
    name: 'Diện tích Hình thang',
    category: 'Toán học',
    latex: 'S = \\frac{(a + b) \\times h}{2}',
    template: '$$S = \\frac{(a + b) \\times h}{2}$$',
    description: 'Trong đó $a, b$ là độ dài hai đáy, $h$ là chiều cao. "Muốn tính diện tích hình thang, đáy lớn đáy nhỏ ta mang cộng vào, cộng vào nhân với chiều cao, chia đôi lấy nửa thế nào cũng ra".',
    gradeLevel: 'Lớp 5',
  },
  {
    id: 'math-circle',
    name: 'Chu vi & Diện tích Hình tròn',
    category: 'Toán học',
    latex: 'C = d \\times 3{,}14 = r \\times 2 \\times 3{,}14 \\quad;\\quad S = r \\times r \\times 3{,}14',
    template: '$$C = d \\times 3{,}14 = r \\times 2 \\times 3{,}14$$\n$$S = r \\times r \\times 3{,}14$$',
    description: 'Trong đó $r$ là bán kính, $d$ là đường kính ($d = 2 \\times r$). Chu vi bằng đường kính nhân 3,14; diện tích bằng bán kính nhân bán kính nhân 3,14.',
    gradeLevel: 'Lớp 5',
  },
  {
    id: 'math-motion',
    name: 'Toán chuyển động đều (Vận tốc - Quãng đường - Thời gian)',
    category: 'Toán học',
    latex: 's = v \\times t \\quad;\\quad v = \\frac{s}{t} \\quad;\\quad t = \\frac{s}{v}',
    template: '$$s = v \\times t \\quad (\\text{Quãng đường = Vận tốc} \\times \\text{Thời gian})$$\n$$v = s : t \\quad (\\text{Vận tốc = Quãng đường} : \\text{Thời gian})$$\n$$t = s : v \\quad (\\text{Thời gian = Quãng đường} : \\text{Vận tốc})$$',
    description: 'Ba công thức cốt lõi của bài toán chuyển động đều lớp 5. Lưu ý đổi các đại lượng về cùng đơn vị đo (km/h với km và giờ; m/s với m và giây).',
    gradeLevel: 'Lớp 5',
  },
  {
    id: 'math-sum-diff',
    name: 'Tìm hai số khi biết Tổng và Hiệu',
    category: 'Toán học',
    latex: '\\text{Số bé} = \\frac{\\text{Tổng} - \\text{Hiệu}}{2} \\quad;\\quad \\text{Số lớn} = \\frac{\\text{Tổng} + \\text{Hiệu}}{2}',
    template: '$$\\text{Số bé} = (\\text{Tổng} - \\text{Hiệu}) : 2$$\n$$\\text{Số lớn} = (\\text{Tổng} + \\text{Hiệu}) : 2$$\n\\text{hoặc: } \\text{Số lớn} = \\text{Số bé} + \\text{Hiệu}',
    description: 'Dạng toán kinh điển lớp 4. Thường vẽ sơ đồ đoạn thẳng để thấy rõ: 2 lần số bé bằng Tổng trừ Hiệu, 2 lần số lớn bằng Tổng cộng Hiệu.',
    gradeLevel: 'Lớp 4',
  },
  {
    id: 'math-sum-ratio',
    name: 'Tìm hai số khi biết Tổng và Tỉ số / Hiệu và Tỉ số',
    category: 'Toán học',
    latex: '\\text{Giá trị một phần} = \\text{Tổng} : \\text{Tổng số phần bằng nhau}',
    template: '$$\\text{Bước 1: Vẽ sơ đồ đoạn thẳng}$$\n$$\\text{Bước 2: Tìm tổng (hoặc hiệu) số phần bằng nhau}$$\n$$\\text{Bước 3: Tìm giá trị một phần}$$\n$$\\text{Bước 4: Tìm số bé và số lớn}$$',
    description: 'Quy trình giải bài toán Tổng - Tỉ và Hiệu - Tỉ chuẩn mực theo chương trình SGK lớp 4.',
    gradeLevel: 'Lớp 4, 5',
  },
  {
    id: 'math-fraction',
    name: 'Các phép tính Phân số',
    category: 'Toán học',
    latex: '\\frac{a}{m} + \\frac{b}{m} = \\frac{a+b}{m} \\quad;\\quad \\frac{a}{b} \\times \\frac{c}{d} = \\frac{a \\times c}{b \\times d}',
    template: '$$\\frac{a}{m} + \\frac{b}{m} = \\frac{a+b}{m} \\quad (\\text{Cùng mẫu số})$$\n$$\\frac{a}{b} \\times \\frac{c}{d} = \\frac{a \\times c}{b \\times d} \\quad (\\text{Nhân phân số})$$\n$$\\frac{a}{b} : \\frac{c}{d} = \\frac{a}{b} \\times \\frac{d}{c} = \\frac{a \\times d}{b \\times c} \\quad (\\text{Chia phân số})$$',
    description: 'Cộng, trừ, nhân, chia phân số. Muốn cộng/trừ khác mẫu số ta phải quy đồng mẫu số rồi mới cộng/trừ tử số.',
    gradeLevel: 'Lớp 4, 5',
  },
  {
    id: 'math-box-volume',
    name: 'Thể tích Hình hộp chữ nhật & Hình lập phương',
    category: 'Toán học',
    latex: 'V_{hhcn} = a \\times b \\times c \\quad;\\quad V_{hlp} = a \\times a \\times a',
    template: '$$\\text{Hình hộp chữ nhật: } V = a \\times b \\times c$$\n$$\\text{Hình lập phương: } V = a \\times a \\times a$$',
    description: 'Thể tích hình hộp chữ nhật bằng chiều dài nhân chiều rộng nhân chiều cao. Thể tích hình lập phương bằng cạnh nhân cạnh nhân cạnh.',
    gradeLevel: 'Lớp 5',
  },

  // --- TIẾNG VIỆT TIỂU HỌC ---
  {
    id: 'tv-spelling',
    name: 'Quy tắc chính tả cơ bản (c/k, g/gh, ng/ngh)',
    category: 'Tiếng Việt',
    latex: 'k, gh, ngh + (e, ê, i)',
    template: '$$\\text{Quy tắc: } k, gh, ngh \\text{ luôn đứng trước các nguyên âm } e, ê, i$$\n$$\\text{Ví dụ: } \\text{kẻ vẽ, cái kéo, con ghẹ, ghi nhớ, nghề nghiệp, lắng nghe}$$',
    description: 'Trước các chữ $e, ê, i$ luôn viết là $k, gh, ngh$. Trước các nguyên âm còn lại ($a, o, ô, ơ, u, ư$) thì viết là $c, g, ng$.',
    gradeLevel: 'Lớp 1, 2, 3',
  },
  {
    id: 'tv-sentences',
    name: 'Ba kiểu câu kể cơ bản (Ai là gì? Ai làm gì? Ai thế nào?)',
    category: 'Tiếng Việt',
    latex: '\\text{Câu kể: Ai là gì? / Ai làm gì? / Ai thế nào?}',
    template: '$$\\text{1. Ai là gì? } \\rightarrow \\text{Dùng để giới thiệu, nhận định (Ví dụ: Bố em là bác sĩ).}$$\n$$\\text{2. Ai làm gì? } \\rightarrow \\text{Vị ngữ chỉ hoạt động (Ví dụ: Chú chim non đang hót).}$$\n$$\\text{3. Ai thế nào? } \\rightarrow \\text{Vị ngữ chỉ đặc điểm, tính chất (Ví dụ: Bông hoa nở rất đẹp).}$$',
    description: 'Mô hình ba kiểu câu kể cốt lõi trong phân môn Luyện từ và câu cấp tiểu học.',
    gradeLevel: 'Lớp 2, 3, 4',
  },
  {
    id: 'tv-words',
    name: 'Phân loại từ: Từ đơn & Từ phức (Từ ghép, Từ láy)',
    category: 'Tiếng Việt',
    latex: '\\text{Từ phức} = \\text{Từ ghép} + \\text{Từ láy}',
    template: '$$\\text{Từ đơn: Chỉ gồm 1 tiếng (Ví dụ: nhà, xe, hoa, học).}$$\n$$\\text{Từ ghép: Ghép các tiếng có nghĩa với nhau (Ví dụ: hoa hồng, xe đạp, trường học).}$$\n$$\\text{Từ láy: Các tiếng lặp lại âm đầu, vần hoặc toàn bộ (Ví dụ: long lanh, rì rào, thoăn thoắt).}$$',
    description: 'Kiến thức phân biệt từ đơn, từ ghép và từ láy trong chương trình Tiếng Việt lớp 4.',
    gradeLevel: 'Lớp 4, 5',
  },
  {
    id: 'tv-comparison',
    name: 'Biện pháp nghệ thuật: So sánh & Nhân hóa',
    category: 'Tiếng Việt',
    latex: '\\text{Vật A} + \\text{từ so sánh (như, là)} + \\text{Vật B}',
    template: '$$\\text{So sánh: Đối chiếu sự vật này với sự vật khác có nét tương đồng (Ví dụ: Trẻ em như búp trên cành).}$$\n$$\\text{Nhân hóa: Gọi hoặc tả con vật, đồ vật bằng những từ ngữ dùng cho con người (Ví dụ: Chị ong nâu chăm chỉ).}$$',
    description: 'Hai biện pháp tu từ quan trọng nhất giúp bài văn miêu tả của học sinh tiểu học trở nên sinh động, giàu cảm xúc.',
    gradeLevel: 'Lớp 3, 4, 5',
  },

  // --- KHOA HỌC & TỰ NHIÊN TIỂU HỌC ---
  {
    id: 'sci-water-cycle',
    name: 'Vòng tuần hoàn của nước trong tự nhiên',
    category: 'Khoa học',
    latex: '\\text{Nước lỏng} \\xrightarrow{\\text{Bay hơi}} \\text{Hơi nước} \\xrightarrow{\\text{Ngưng tụ}} \\text{Mây} \\xrightarrow{\\text{Mưa}} \\text{Nước}',
    template: '$$\\text{Nước ở sông biển bay hơi } \\rightarrow \\text{ Ngưng tụ thành mây } \\rightarrow \\text{ Mưa rơi xuống đất } \\rightarrow \\text{ Trở về sông biển}$$',
    description: 'Quá trình luân chuyển không ngừng của nước giữa mặt đất và bầu khí quyển dưới tác dụng của ánh sáng Mặt Trời.',
    gradeLevel: 'Lớp 4',
  },
  {
    id: 'sci-nutrition',
    name: 'Bốn nhóm chất dinh dưỡng trong bữa ăn',
    category: 'Khoa học',
    latex: '\\text{4 nhóm: Chất bột đường, Chất đạm, Chất béo, Vitamin và khoáng chất}',
    template: '$$\\text{1. Chất bột đường: Cơm, ngô, khoai (cung cấp năng lượng chính).}$$\n$$\\text{2. Chất đạm: Thịt, cá, trứng, sữa, đậu (giúp cơ thể lớn lên và phát triển).}$$\n$$\\text{3. Chất béo: Dầu ăn, mỡ, bơ, lạc (dự trữ năng lượng).}$$\n$$\\text{4. Vitamin & khoáng chất: Rau xanh, trái cây (giúp cơ thể khỏe mạnh, chống bệnh).}$$',
    description: 'Chế độ ăn cân đối 4 nhóm thực phẩm giúp các bạn nhỏ phát triển chiều cao, trí não và thể lực toàn diện.',
    gradeLevel: 'Lớp 4, 5',
  },

  // --- KÝ HIỆU & ĐƠN VỊ ---
  {
    id: 'unit-length',
    name: 'Bảng đơn vị đo độ dài & khối lượng',
    category: 'Ký hiệu & Đơn vị',
    latex: '1\\text{ km} = 1000\\text{ m} \\quad;\\quad 1\\text{ tấn} = 1000\\text{ kg}',
    template: '$$\\text{Độ dài: } \\text{km} \\rightarrow \\text{hm} \\rightarrow \\text{dam} \\rightarrow \\text{m} \\rightarrow \\text{dm} \\rightarrow \\text{cm} \\rightarrow \\text{mm} \\quad (\\text{Mỗi đơn vị liền nhau gấp/kém 10 lần})$$\n$$\\text{Khối lượng: } \\text{tấn} \\rightarrow \\text{tạ} \\rightarrow \\text{yến} \\rightarrow \\text{kg} \\rightarrow \\text{hg} \\rightarrow \\text{dag} \\rightarrow \\text{g} \\quad (\\text{Mỗi đơn vị liền nhau gấp/kém 10 lần})$$',
    description: 'Bảng quy đổi đơn vị đo độ dài và khối lượng chuẩn SGK tiểu học.',
    gradeLevel: 'Lớp 3, 4, 5',
  },
];

