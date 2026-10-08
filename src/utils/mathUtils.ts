/**
 * Utilities for LaTeX & Math/Science Formula Normalization, Syntax Preprocessing and Reference Templates
 * Hỗ trợ chuẩn hóa toàn diện cho các môn Toán học, KHTN (Vật lý, Hóa học, Sinh học)
 */

export interface FormulaSnippet {
  id: string;
  name: string;
  category: 'Toán học' | 'KHTN - Vật lý' | 'KHTN - Hóa học' | 'KHTN - Sinh học' | 'Ký hiệu & Đơn vị' | 'Tiếng Việt';
  latex: string;
  template: string;
  description: string;
  gradeLevel?: string;
}

/**
 * Preprocess markdown content containing math & science formulas:
 * 1. Convert standard LaTeX environments and delimiters \(...\) to $...$ and \[...\] to $$...$$
 * 2. Ensure block formulas $$...$$ have newline padding so remark-math parses them reliably
 * 3. Convert chemical reactions and standard notation
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
 * Quick symbol toolbar items categorized for easy access
 */
export const QUICK_SYMBOLS_BY_CATEGORY: Record<string, { label: string; insert: string; title: string }[]> = {
  'Toán học': [
    { label: '+', insert: ' + ', title: 'Phép cộng' },
    { label: '−', insert: ' - ', title: 'Phép trừ' },
    { label: '×', insert: ' \\times ', title: 'Phép nhân' },
    { label: '÷', insert: ' : ', title: 'Phép chia' },
    { label: '=', insert: ' = ', title: 'Dấu bằng' },
    { label: 'a/b', insert: '$\\frac{a}{b}$', title: 'Phân số' },
    { label: '√x', insert: '$\\sqrt{x}$', title: 'Căn bậc hai' },
    { label: 'x²', insert: '$x^2$', title: 'Bình phương' },
    { label: 'xⁿ', insert: '$x^n$', title: 'Lũy thừa' },
    { label: 'π', insert: '$\\pi$', title: 'Số Pi (3,14)' },
    { label: '±', insert: ' \\pm ', title: 'Cộng trừ' },
    { label: '≤', insert: ' \\le ', title: 'Bé hơn hoặc bằng' },
    { label: '≥', insert: ' \\ge ', title: 'Lớn hơn hoặc bằng' },
    { label: '≠', insert: ' \\neq ', title: 'Khác nhau' },
    { label: '≈', insert: ' \\approx ', title: 'Xấp xỉ' },
    { label: 'Δ', insert: '$\\Delta$', title: 'Delta biệt thức' },
    { label: '°', insert: '^\\circ', title: 'Độ góc / nhiệt độ' },
    { label: '∠A', insert: '$\\widehat{A}$', title: 'Góc A' },
  ],
  'KHTN - Vật lý': [
    { label: 'v = s/t', insert: '$v = \\frac{s}{t}$', title: 'Vận tốc chuyển động' },
    { label: 'P = 10m', insert: '$P = 10m$', title: 'Trọng lượng vật' },
    { label: 'D = m/V', insert: '$D = \\frac{m}{V}$', title: 'Khối lượng riêng' },
    { label: 'p = F/S', insert: '$p = \\frac{F}{S}$', title: 'Áp suất' },
    { label: 'FA = d.V', insert: '$F_A = d \\cdot V$', title: 'Lực đẩy Ác-si-mét' },
    { label: 'A = F.s', insert: '$A = F \\cdot s$', title: 'Công cơ học' },
    { label: 'P = A/t', insert: '$\\mathcal{P} = \\frac{A}{t}$', title: 'Công suất' },
    { label: 'I = U/R', insert: '$I = \\frac{U}{R}$', title: 'Định luật Ôm' },
    { label: 'Q = mcΔt', insert: '$Q = m \\cdot c \\cdot \\Delta t$', title: 'Nhiệt lượng' },
    { label: 'Ω', insert: '$\\Omega$', title: 'Ôm (điện trở)' },
    { label: 'm/s', insert: '$\\text{m/s}$', title: 'Mét trên giây' },
    { label: 'km/h', insert: '$\\text{km/h}$', title: 'Ki-lô-mét trên giờ' },
    { label: 'N', insert: '$\\text{N}$', title: 'Niutơn (Lực)' },
    { label: 'J', insert: '$\\text{J}$', title: 'Jun (Công)' },
    { label: 'W', insert: '$\\text{W}$', title: 'Oát (Công suất)' },
    { label: '°C', insert: '$^\\circ\\text{C}$', title: 'Độ C' },
  ],
  'KHTN - Hóa học': [
    { label: 'n = m/M', insert: '$n = \\frac{m}{M}$', title: 'Số mol từ khối lượng' },
    { label: 'n = V/24,79', insert: '$n = \\frac{V}{24{,}79}$', title: 'Số mol khí (đkc)' },
    { label: 'CM = n/V', insert: '$C_M = \\frac{n}{V}$', title: 'Nồng độ mol' },
    { label: 'C%', insert: '$C\\% = \\frac{m_{ct}}{m_{dd}} \\times 100\\%$', title: 'Nồng độ phần trăm' },
    { label: 'H2O', insert: '$\\text{H}_2\\text{O}$', title: 'Nước' },
    { label: 'CO2', insert: '$\\text{CO}_2$', title: 'Khí Cacbonic' },
    { label: 'O2', insert: '$\\text{O}_2$', title: 'Khí Oxi' },
    { label: 'H2SO4', insert: '$\\text{H}_2\\text{SO}_4$', title: 'Axit Sunfuric' },
    { label: 'HCl', insert: '$\\text{HCl}$', title: 'Axit Clohiđric' },
    { label: 'NaOH', insert: '$\\text{NaOH}$', title: 'Natri hiđroxit' },
    { label: 'NaCl', insert: '$\\text{NaCl}$', title: 'Muối ăn' },
    { label: 'CaCO3', insert: '$\\text{CaCO}_3$', title: 'Đá vôi' },
    { label: '→', insert: ' \\rightarrow ', title: 'Mũi tên phản ứng' },
    { label: '↑', insert: ' \\uparrow ', title: 'Khí bay lên' },
    { label: '↓', insert: ' \\downarrow ', title: 'Kết tủa' },
    { label: 't°', insert: ' \\xrightarrow{t^\\circ} ', title: 'Phản ứng có nhiệt độ' },
    { label: 'mol/L', insert: '$\\text{mol/L}$', title: 'Molar' },
  ],
  'KHTN - Sinh học': [
    { label: 'Quang hợp', insert: '$6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow{\\text{Ánh sáng, Diệp lục}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2\\uparrow$', title: 'Phương trình quang hợp' },
    { label: 'Hô hấp', insert: '$\\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\rightarrow 6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{ATP}$', title: 'Hô hấp tế bào' },
    { label: 'N = 2A+2G', insert: '$N = 2A + 2G$', title: 'Tổng số nucleotit ADN' },
    { label: 'H = 2A+3G', insert: '$H = 2A + 3G$', title: 'Số liên kết hiđrô' },
    { label: 'L = (N/2).3,4Å', insert: '$L = \\frac{N}{2} \\times 3{,}4\\,\\text{Å}$', title: 'Chiều dài phân tử ADN' },
    { label: 'M = N.300', insert: '$M = N \\times 300\\,\\text{đvC}$', title: 'Khối lượng ADN' },
    { label: 'ADN', insert: '$\\text{ADN}$', title: 'Axit đeoxiribonucleic' },
    { label: 'ARN', insert: '$\\text{ARN}$', title: 'Axit ribonucleic' },
  ],
  'Ký hiệu & Đơn vị': [
    { label: 'cm', insert: '$\\text{cm}$', title: 'Xăng-ti-mét' },
    { label: 'm', insert: '$\\text{m}$', title: 'Mét' },
    { label: 'km', insert: '$\\text{km}$', title: 'Ki-lô-mét' },
    { label: 'cm²', insert: '$\\text{cm}^2$', title: 'Xăng-ti-mét vuông' },
    { label: 'm²', insert: '$\\text{m}^2$', title: 'Mét vuông' },
    { label: 'ha', insert: '$\\text{ha}$', title: 'Héc-ta' },
    { label: 'kg', insert: '$\\text{kg}$', title: 'Ki-lô-gam' },
    { label: 'tấn', insert: '$\\text{tấn}$', title: 'Tấn' },
    { label: 'lít', insert: '$\\text{lít}$', title: 'Lít' },
    { label: 'giờ', insert: '$\\text{giờ}$', title: 'Giờ' },
    { label: 'phút', insert: '$\\text{phút}$', title: 'Phút' },
    { label: 'giây', insert: '$\\text{giây}$', title: 'Giây' },
    { label: '%', insert: '\\%', title: 'Phần trăm' },
  ],
};

export const QUICK_MATH_SYMBOLS = [
  ...QUICK_SYMBOLS_BY_CATEGORY['Toán học'].slice(0, 8),
  ...QUICK_SYMBOLS_BY_CATEGORY['KHTN - Vật lý'].slice(0, 3),
  ...QUICK_SYMBOLS_BY_CATEGORY['KHTN - Hóa học'].slice(0, 3),
  ...QUICK_SYMBOLS_BY_CATEGORY['Ký hiệu & Đơn vị'].slice(0, 4),
];

/**
 * Kho dữ liệu chuẩn hóa công thức Toán học & KHTN toàn diện (Tiểu học, THCS, THPT)
 */
export const STANDARD_FORMULAS: FormulaSnippet[] = [
  // ==========================================
  // --- 1. TOÁN HỌC ---
  // ==========================================
  {
    id: 'math-rect',
    name: 'Chu vi & Diện tích Hình chữ nhật',
    category: 'Toán học',
    latex: 'P = (a + b) \\times 2 \\quad;\\quad S = a \\times b',
    template: '$$\\text{Chu vi: } P = (a + b) \\times 2$$\n$$\\text{Diện tích: } S = a \\times b$$',
    description: 'Trong đó $a$ là chiều dài, $b$ là chiều rộng (cùng đơn vị đo). Muốn tính chu vi lấy dài cộng rộng nhân 2; muốn tính diện tích lấy dài nhân rộng.',
    gradeLevel: 'Lớp 3, 4, 5',
  },
  {
    id: 'math-square',
    name: 'Chu vi & Diện tích Hình vuông',
    category: 'Toán học',
    latex: 'P = a \\times 4 \\quad;\\quad S = a \\times a',
    template: '$$\\text{Chu vi: } P = a \\times 4$$\n$$\\text{Diện tích: } S = a \\times a$$',
    description: 'Trong đó $a$ là độ dài cạnh. Chu vi bằng độ dài cạnh nhân với 4; diện tích bằng độ dài cạnh nhân với chính nó.',
    gradeLevel: 'Lớp 3, 4, 5',
  },
  {
    id: 'math-triangle',
    name: 'Diện tích Hình tam giác',
    category: 'Toán học',
    latex: 'S = \\frac{a \\times h}{2}',
    template: '$$S = \\frac{a \\times h}{2} \\quad\\text{hoặc}\\quad S = (a \\times h) : 2$$',
    description: 'Trong đó $a$ là độ dài cạnh đáy, $h$ là chiều cao tương ứng. Diện tích tam giác bằng đáy nhân chiều cao rồi chia cho 2.',
    gradeLevel: 'Lớp 5, 6, 7',
  },
  {
    id: 'math-trapezoid',
    name: 'Diện tích Hình thang',
    category: 'Toán học',
    latex: 'S = \\frac{(a + b) \\times h}{2}',
    template: '$$S = \\frac{(a + b) \\times h}{2}$$',
    description: 'Trong đó $a, b$ là độ dài hai đáy, $h$ là chiều cao: "Đáy lớn đáy nhỏ ta mang cộng vào, cộng vào nhân với chiều cao, chia đôi lấy nửa thế nào cũng ra".',
    gradeLevel: 'Lớp 5, 8',
  },
  {
    id: 'math-circle',
    name: 'Chu vi & Diện tích Hình tròn',
    category: 'Toán học',
    latex: 'C = d \\times 3{,}14 = 2 \\times r \\times 3{,}14 \\quad;\\quad S = r \\times r \\times 3{,}14',
    template: '$$C = d \\times 3{,}14 = 2 \\times r \\times 3{,}14$$\n$$S = r \\times r \\times 3{,}14$$',
    description: 'Trong đó $r$ là bán kính, $d$ là đường kính ($d = 2r$). Số Pi xấp xỉ $3{,}14$.',
    gradeLevel: 'Lớp 5, 9',
  },
  {
    id: 'math-motion',
    name: 'Toán chuyển động đều (Vận tốc - Quãng đường - Thời gian)',
    category: 'Toán học',
    latex: 's = v \\times t \\quad;\\quad v = \\frac{s}{t} \\quad;\\quad t = \\frac{s}{v}',
    template: '$$s = v \\times t \\quad (\\text{Quãng đường = Vận tốc} \\times \\text{Thời gian})$$\n$$v = \\frac{s}{t} \\quad (\\text{Vận tốc = Quãng đường} : \\text{Thời gian})$$\n$$t = \\frac{s}{v} \\quad (\\text{Thời gian = Quãng đường} : \\text{Vận tốc})$$',
    description: 'Ba công thức chuyển động cốt lõi. Lưu ý đổi các đại lượng về cùng đơn vị đo (km/h với km và h; m/s với m và s).',
    gradeLevel: 'Lớp 5, 8',
  },
  {
    id: 'math-sum-diff',
    name: 'Tìm hai số khi biết Tổng và Hiệu',
    category: 'Toán học',
    latex: '\\text{Số bé} = \\frac{\\text{Tổng} - \\text{Hiệu}}{2} \\quad;\\quad \\text{Số lớn} = \\frac{\\text{Tổng} + \\text{Hiệu}}{2}',
    template: '$$\\text{Số bé} = (\\text{Tổng} - \\text{Hiệu}) : 2$$\n$$\\text{Số lớn} = (\\text{Tổng} + \\text{Hiệu}) : 2$$',
    description: 'Dạng toán kinh điển lớp 4. Thường vẽ sơ đồ đoạn thẳng để thấy rõ mối tương quan giữa tổng và hiệu.',
    gradeLevel: 'Lớp 4',
  },
  {
    id: 'math-fraction',
    name: 'Các phép tính Phân số',
    category: 'Toán học',
    latex: '\\frac{a}{m} + \\frac{b}{m} = \\frac{a+b}{m} \\quad;\\quad \\frac{a}{b} \\times \\frac{c}{d} = \\frac{a \\times c}{b \\times d}',
    template: '$$\\frac{a}{m} + \\frac{b}{m} = \\frac{a+b}{m} \\quad (\\text{Cộng cùng mẫu})$$\n$$\\frac{a}{b} \\times \\frac{c}{d} = \\frac{a \\times c}{b \\times d} \\quad (\\text{Nhân phân số})$$\n$$\\frac{a}{b} : \\frac{c}{d} = \\frac{a}{b} \\times \\frac{d}{c} = \\frac{a \\times d}{b \\times c} \\quad (\\text{Chia phân số})$$',
    description: 'Cộng, trừ, nhân, chia phân số chuẩn mực SGK.',
    gradeLevel: 'Lớp 4, 5, 6',
  },
  {
    id: 'math-identity',
    name: 'Bảy hằng đẳng thức đáng nhớ',
    category: 'Toán học',
    latex: '(a \\pm b)^2 = a^2 \\pm 2ab + b^2 \\quad;\\quad a^2 - b^2 = (a-b)(a+b)',
    template: '$$1.\\ (a + b)^2 = a^2 + 2ab + b^2$$\n$$2.\\ (a - b)^2 = a^2 - 2ab + b^2$$\n$$3.\\ a^2 - b^2 = (a - b)(a + b)$$\n$$4.\\ (a + b)^3 = a^3 + 3a^2b + 3ab^2 + b^3$$\n$$5.\\ (a - b)^3 = a^3 - 3a^2b + 3ab^2 - b^3$$\n$$6.\\ a^3 + b^3 = (a + b)(a^2 - ab + b^2)$$\n$$7.\\ a^3 - b^3 = (a - b)(a^2 + ab + b^2)$$',
    description: 'Hằng đẳng thức cốt lõi của đại số THCS và THPT, dùng phân tích đa thức và giải phương trình.',
    gradeLevel: 'Lớp 8, 9, 10',
  },
  {
    id: 'math-quadratic-viet',
    name: 'Phương trình bậc hai & Định lý Vi-ét',
    category: 'Toán học',
    latex: 'ax^2 + bx + c = 0 \\ (a \\neq 0) \\quad;\\quad \\Delta = b^2 - 4ac',
    template: '$$\\text{Biệt thức: } \\Delta = b^2 - 4ac$$\n$$\\Delta > 0 \\Rightarrow x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$$\n$$\\Delta = 0 \\Rightarrow x_1 = x_2 = -\\frac{b}{2a}$$\n$$\\Delta < 0 \\Rightarrow \\text{Phương trình vô nghiệm}$$\n$$\\text{Hệ thức Vi-ét: } x_1 + x_2 = -\\frac{b}{a} \\quad;\\quad x_1 x_2 = \\frac{c}{a}$$',
    description: 'Công thức nghiệm phương trình bậc hai và hệ thức Vi-ét chuẩn SGK Toán 9 & Toán 10.',
    gradeLevel: 'Lớp 9, 10',
  },
  {
    id: 'math-pythagoras',
    name: 'Định lý Pythagore trong tam giác vuông',
    category: 'Toán học',
    latex: 'a^2 + b^2 = c^2',
    template: '$$c^2 = a^2 + b^2 \\iff c = \\sqrt{a^2 + b^2}$$\n$$\\text{với } c \\text{ là cạnh huyền, } a, b \\text{ là hai cạnh góc vuông}$$',
    description: 'Bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.',
    gradeLevel: 'Lớp 7, 8, 9',
  },

  // ==========================================
  // --- 2. KHTN - VẬT LÝ ---
  // ==========================================
  {
    id: 'phys-speed',
    name: 'Tốc độ chuyển động',
    category: 'KHTN - Vật lý',
    latex: 'v = \\frac{s}{t} \\quad;\\quad s = v \\cdot t \\quad;\\quad t = \\frac{s}{v}',
    template: '$$v = \\frac{s}{t} \\quad (\\text{Tốc độ} = \\frac{\\text{Quãng đường}}{\\text{Thời gian}})$$\n$$\\text{Đơn vị: } 1\\text{ m/s} = 3{,}6\\text{ km/h}$$',
    description: 'Tốc độ đặc trưng cho sự chuyển động nhanh hay chậm của một vật trên quãng đường trong một đơn vị thời gian.',
    gradeLevel: 'Lớp 7, 10',
  },
  {
    id: 'phys-density',
    name: 'Khối lượng riêng & Trọng lượng riêng',
    category: 'KHTN - Vật lý',
    latex: 'D = \\frac{m}{V} \\quad;\\quad d = \\frac{P}{V} = 10D',
    template: '$$D = \\frac{m}{V} \\quad (\\text{Khối lượng riêng, } \\text{kg/m}^3)$$\n$$d = \\frac{P}{V} = 10D \\quad (\\text{Trọng lượng riêng, } \\text{N/m}^3)$$\n$$P = 10m \\quad (\\text{Trọng lượng, } \\text{N})$$',
    description: 'Khối lượng riêng $D$ là khối lượng của một đơn vị thể tích ($1\\text{ m}^3$) chất đó.',
    gradeLevel: 'Lớp 6, 8',
  },
  {
    id: 'phys-pressure',
    name: 'Áp suất & Lực đẩy Ác-si-mét',
    category: 'KHTN - Vật lý',
    latex: 'p = \\frac{F}{S} \\quad;\\quad F_A = d \\cdot V',
    template: '$$p = \\frac{F}{S} \\quad (\\text{Áp suất = Áp lực / Diện tích bị ép, } \\text{N/m}^2 = \\text{Pa})$$\n$$p = d \\cdot h \\quad (\\text{Áp suất chất lỏng ở độ sâu } h)$$\n$$F_A = d \\cdot V \\quad (\\text{Lực đẩy Ác-si-mét: } d \\text{ trọng lượng riêng chất lỏng, } V \\text{ thể tích phần chìm})$$',
    description: 'Công thức tính áp suất chất rắn, chất lỏng và lực đẩy Ác-si-mét trong KHTN lớp 8.',
    gradeLevel: 'Lớp 8',
  },
  {
    id: 'phys-work-power',
    name: 'Công cơ học & Công suất',
    category: 'KHTN - Vật lý',
    latex: 'A = F \\cdot s \\quad;\\quad \\mathcal{P} = \\frac{A}{t}',
    template: '$$A = F \\cdot s \\quad (\\text{Công cơ học, } \\text{J} = \\text{N} \\cdot \\text{m})$$\n$$\\mathcal{P} = \\frac{A}{t} = F \\cdot v \\quad (\\text{Công suất, } \\text{W} = \\text{J/s})$$',
    description: 'Công cơ học xuất hiện khi có lực tác dụng vào vật và làm vật dịch chuyển. Công suất là công thực hiện trong $1$ đơn vị thời gian.',
    gradeLevel: 'Lớp 8, 9, 10',
  },
  {
    id: 'phys-ohm',
    name: 'Định luật Ôm cho đoạn mạch',
    category: 'KHTN - Vật lý',
    latex: 'I = \\frac{U}{R} \\quad;\\quad U = I \\cdot R \\quad;\\quad R = \\frac{U}{I}',
    template: '$$I = \\frac{U}{R}$$\n$$\\text{Trong đó: } I \\text{ là cường độ dòng điện (A), } U \\text{ là hiệu điện thế (V), } R \\text{ là điện trở (}\\Omega\\text{)}$$',
    description: 'Cường độ dòng điện chạy qua dây dẫn tỉ lệ thuận với hiệu điện thế đặt vào hai đầu dây và tỉ lệ nghịch với điện trở của dây.',
    gradeLevel: 'Lớp 9, 11',
  },
  {
    id: 'phys-resistor',
    name: 'Đoạn mạch nối tiếp & Đoạn mạch song song',
    category: 'KHTN - Vật lý',
    latex: 'R_{nt} = R_1 + R_2 \\quad;\\quad \\frac{1}{R_{ss}} = \\frac{1}{R_1} + \\frac{1}{R_2}',
    template: '$$\\text{Nối tiếp: } I = I_1 = I_2 \\quad;\\quad U = U_1 + U_2 \\quad;\\quad R_{tđ} = R_1 + R_2$$\n$$\\text{Song song: } U = U_1 = U_2 \\quad;\\quad I = I_1 + I_2 \\quad;\\quad \\frac{1}{R_{tđ}} = \\frac{1}{R_1} + \\frac{1}{R_2}$$',
    description: 'Quy tắc ghép điện trở chuẩn mực theo SGK Vật lý / KHTN 9.',
    gradeLevel: 'Lớp 9, 11',
  },
  {
    id: 'phys-heat',
    name: 'Nhiệt lượng & Phương trình cân bằng nhiệt',
    category: 'KHTN - Vật lý',
    latex: 'Q = m \\cdot c \\cdot \\Delta t \\quad;\\quad Q_{\\text{tỏa}} = Q_{\\text{thu}}',
    template: '$$Q = m \\cdot c \\cdot \\Delta t = m \\cdot c \\cdot (t_2 - t_1)$$\n$$\\text{Phương trình cân bằng nhiệt: } Q_{\\text{tỏa}} = Q_{\\text{thu}}$$\n$$\\text{với } m\\text{ (kg), } c\\text{ nhiệt dung riêng (J/kg.K), } \\Delta t\\text{ độ tăng/giảm nhiệt độ}$$',
    description: 'Công thức tính nhiệt lượng một vật thu vào hoặc tỏa ra khi nhiệt độ thay đổi.',
    gradeLevel: 'Lớp 8, 12',
  },

  // ==========================================
  // --- 3. KHTN - HÓA HỌC ---
  // ==========================================
  {
    id: 'chem-mol',
    name: 'Công thức tính số mol ($n$)',
    category: 'KHTN - Hóa học',
    latex: 'n = \\frac{m}{M} = \\frac{V}{24{,}79} = C_M \\cdot V',
    template: '$$n = \\frac{m}{M} \\quad (\\text{Từ khối lượng } m\\text{ (g) và khối lượng mol } M\\text{ (g/mol)})$$\n$$n = \\frac{V}{24{,}79} \\quad (\\text{Từ thể tích khí ở điều kiện chuẩn } 25^\\circ\\text{C, } 1\\text{ bar})$$\n$$n = C_M \\cdot V_{dd} \\quad (\\text{Từ nồng độ mol và thể tích dung dịch (lít)})$$\n$$n = \\frac{N}{6{,}022 \\times 10^{23}} \\quad (\\text{Từ số hạt nguyên tử/phân tử})$$',
    description: 'Bốn công thức tính số mol cốt lõi của môn Hóa học từ lớp 8 đến lớp 12.',
    gradeLevel: 'Lớp 8, 9, 10, 11, 12',
  },
  {
    id: 'chem-concentration',
    name: 'Nồng độ dung dịch ($C\\%$ và $C_M$)',
    category: 'KHTN - Hóa học',
    latex: 'C\\% = \\frac{m_{ct}}{m_{dd}} \\times 100\\% \\quad;\\quad C_M = \\frac{n}{V}',
    template: '$$C\\% = \\frac{m_{ct}}{m_{dd}} \\times 100\\% \\quad\\text{với } m_{dd} = m_{ct} + m_{dm} = V \\cdot D$$\n$$C_M = \\frac{n}{V_{dd}} \\quad (\\text{mol/L})$$\n$$\\text{Công thức chuyển đổi: } C_M = \\frac{10 \\cdot C\\% \\cdot D}{M}$$',
    description: 'Nồng độ phần trăm biểu thị số gam chất tan có trong 100 gam dung dịch; nồng độ mol biểu thị số mol chất tan trong 1 lít dung dịch.',
    gradeLevel: 'Lớp 8, 9, 10, 11',
  },
  {
    id: 'chem-gas-density',
    name: 'Tỉ khối của chất khí',
    category: 'KHTN - Hóa học',
    latex: 'd_{A/B} = \\frac{M_A}{M_B} \\quad;\\quad d_{A/\\text{kk}} = \\frac{M_A}{29}',
    template: '$$d_{A/B} = \\frac{M_A}{M_B} \\quad (\\text{Khí A nặng/nhẹ hơn khí B bao nhiêu lần})$$\n$$d_{A/\\text{không khí}} = \\frac{M_A}{29} \\quad (\\text{Khối lượng mol trung bình không khí là } 29\\text{ g/mol})$$',
    description: 'Biết chất khí nặng hay nhẹ hơn không khí để thu khí bằng phương pháp đẩy nước hay đẩy không khí.',
    gradeLevel: 'Lớp 8, 9, 10',
  },
  {
    id: 'chem-classic-reactions',
    name: 'Các phương trình hóa học chuẩn mực',
    category: 'KHTN - Hóa học',
    latex: '2\\text{H}_2 + \\text{O}_2 \\xrightarrow{t^\\circ} 2\\text{H}_2\\text{O} \\quad;\\quad \\text{Fe} + 2\\text{HCl} \\rightarrow \\text{FeCl}_2 + \\text{H}_2\\uparrow',
    template: '$$2\\text{H}_2 + \\text{O}_2 \\xrightarrow{t^\\circ} 2\\text{H}_2\\text{O} \\quad (\\text{Phản ứng cháy tạo nước})$$\n$$\\text{Fe} + 2\\text{HCl} \\rightarrow \\text{FeCl}_2 + \\text{H}_2\\uparrow \\quad (\\text{Kim loại tác dụng axit})$$\n$$\\text{CaCO}_3 \\xrightarrow{t^\\circ} \\text{CaO} + \\text{CO}_2\\uparrow \\quad (\\text{Nhiệt phân đá vôi})$$\n$$\\text{NaOH} + \\text{HCl} \\rightarrow \\text{NaCl} + \\text{H}_2\\text{O} \\quad (\\text{Phản ứng trung hòa})$$',
    description: 'Các phản ứng hóa học đại diện cho các nhóm chất vô cơ cơ bản (oxit, axit, bazơ, muối).',
    gradeLevel: 'Lớp 8, 9, 10',
  },

  // ==========================================
  // --- 4. KHTN - SINH HỌC ---
  // ==========================================
  {
    id: 'bio-photosynthesis',
    name: 'Phương trình Quang hợp & Hô hấp tế bào',
    category: 'KHTN - Sinh học',
    latex: '6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow{\\text{Ánh sáng, Diệp lục}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2',
    template: '$$\\text{Quang hợp: } 6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow{\\text{Ánh sáng, Diệp lục}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2\\uparrow$$\n$$\\text{Hô hấp: } \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\rightarrow 6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{Năng lượng (ATP)}$$',
    description: 'Hai quá trình chuyển hóa vật chất và năng lượng nền tảng trong thế giới sống.',
    gradeLevel: 'Lớp 7, 10, 11',
  },
  {
    id: 'bio-dna',
    name: 'Cấu trúc di truyền phân tử ADN',
    category: 'KHTN - Sinh học',
    latex: 'N = 2A + 2G \\quad;\\quad L = \\frac{N}{2} \\times 3{,}4\\,\\text{Å} \\quad;\\quad H = 2A + 3G',
    template: '$$N = 2A + 2G = 2T + 2X \\quad (\\text{Theo nguyên tắc bổ sung: } A=T, G=X)$$\n$$L = \\frac{N}{2} \\times 3{,}4\\,\\text{Å} \\quad (1\\,\\text{Å} = 10^{-4}\\,\\mu\\text{m} = 10^{-7}\\,\\text{mm})$$\n$$M = N \\times 300\\,\\text{đvC} \\quad (\\text{Khối lượng phân tử ADN})$$\n$$H = 2A + 3G \\quad (\\text{Số liên kết hiđrô: } A-T \\text{ có 2 liên kết, } G-X \\text{ có 3 liên kết})$$',
    description: 'Hệ thống công thức toán giải bài tập di truyền ADN lớp 9 và Sinh học 12.',
    gradeLevel: 'Lớp 9, 12',
  },

  // ==========================================
  // --- 5. KÝ HIỆU & ĐƠN VỊ ---
  // ==========================================
  {
    id: 'unit-length',
    name: 'Bảng đơn vị đo độ dài & khối lượng',
    category: 'Ký hiệu & Đơn vị',
    latex: '1\\text{ km} = 1000\\text{ m} \\quad;\\quad 1\\text{ tấn} = 1000\\text{ kg}',
    template: '$$\\text{Độ dài: } \\text{km} \\rightarrow \\text{hm} \\rightarrow \\text{dam} \\rightarrow \\text{m} \\rightarrow \\text{dm} \\rightarrow \\text{cm} \\rightarrow \\text{mm}$$\n$$\\text{Khối lượng: } \\text{tấn} \\rightarrow \\text{tạ} \\rightarrow \\text{yến} \\rightarrow \\text{kg} \\rightarrow \\text{hg} \\rightarrow \\text{dag} \\rightarrow \\text{g}$$',
    description: 'Bảng quy đổi các đơn vị đo lường phổ biến.',
    gradeLevel: 'Tất cả các khối',
  },
  {
    id: 'unit-area-volume',
    name: 'Bảng đơn vị đo diện tích & thể tích',
    category: 'Ký hiệu & Đơn vị',
    latex: '1\\text{ m}^2 = 100\\text{ dm}^2 \\quad;\\quad 1\\text{ m}^3 = 1000\\text{ dm}^3 = 1000\\text{ lít}',
    template: '$$\\text{Diện tích: } \\text{km}^2 \\rightarrow \\text{ha} (\\text{hm}^2) \\rightarrow \\text{dam}^2 \\rightarrow \\text{m}^2 \\rightarrow \\text{dm}^2 \\rightarrow \\text{cm}^2 \\rightarrow \\text{mm}^2$$\n$$\\text{Thể tích: } 1\\text{ m}^3 = 1000\\text{ dm}^3 = 1\\,000\\,000\\text{ cm}^3 \\quad;\\quad 1\\text{ dm}^3 = 1\\text{ lít}$$',
    description: 'Bảng quy đổi diện tích (mỗi đơn vị gấp/kém 100 lần) và thể tích (mỗi đơn vị gấp/kém 1000 lần).',
    gradeLevel: 'Tất cả các khối',
  },
];
