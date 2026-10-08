import { Grade, Subject, SubjectInfo } from '../types/study';

export const GRADES: Grade[] = [
  'Lớp 1',
  'Lớp 2',
  'Lớp 3',
  'Lớp 4',
  'Lớp 5',
];

export const SUBJECTS: SubjectInfo[] = [
  {
    id: 'Toán',
    name: 'Toán học Tiểu học',
    icon: 'Calculator',
    color: 'text-blue-600',
    bgLight: 'bg-blue-50 border-blue-200 text-blue-700',
    badgeColor: 'bg-blue-600 text-white',
    description: 'Cộng trừ nhân chia, bảng cửu chương, phân số, hình học & toán có lời văn',
  },
  {
    id: 'Tiếng Việt',
    name: 'Tiếng Việt',
    icon: 'BookOpen',
    color: 'text-rose-600',
    bgLight: 'bg-rose-50 border-rose-200 text-rose-700',
    badgeColor: 'bg-rose-600 text-white',
    description: 'Tập đọc, Chính tả, Luyện từ và câu, Tập làm văn miêu tả & kể chuyện',
  },
  {
    id: 'Tiếng Anh',
    name: 'Tiếng Anh Tiểu học',
    icon: 'Languages',
    color: 'text-indigo-600',
    bgLight: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    badgeColor: 'bg-indigo-600 text-white',
    description: 'Từ vựng tranh ảnh, mẫu câu giao tiếp, phát âm & ngữ pháp căn bản',
  },
  {
    id: 'Khoa học',
    name: 'Tự nhiên & Khoa học',
    icon: 'Compass',
    color: 'text-emerald-600',
    bgLight: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    badgeColor: 'bg-emerald-600 text-white',
    description: 'Thế giới động thực vật, cơ thể người, bảo vệ môi trường & khám phá tự nhiên',
  },
  {
    id: 'Lịch sử & Địa lý',
    name: 'Lịch sử & Địa lý',
    icon: 'Landmark',
    color: 'text-amber-600',
    bgLight: 'bg-amber-50 border-amber-200 text-amber-700',
    badgeColor: 'bg-amber-600 text-white',
    description: 'Truyền thuyết dựng nước, các vị anh hùng dân tộc & quê hương non sông gấm vóc',
  },
  {
    id: 'Tin học',
    name: 'Tin học & Scratch',
    icon: 'Cpu',
    color: 'text-purple-600',
    bgLight: 'bg-purple-50 border-purple-200 text-purple-700',
    badgeColor: 'bg-purple-600 text-white',
    description: 'Làm quen máy tính, gõ 10 ngón, vẽ Paint & lập trình khối Scratch sáng tạo',
  },
  {
    id: 'Đạo đức',
    name: 'Đạo đức & Kỹ năng sống',
    icon: 'BookOpen',
    color: 'text-pink-600',
    bgLight: 'bg-pink-50 border-pink-200 text-pink-700',
    badgeColor: 'bg-pink-600 text-white',
    description: 'Kính trọng ông bà cha mẹ, yêu quý bạn bè, an toàn giao thông & kỹ năng tự lập',
  },
];

export const SAMPLE_QUESTIONS_BY_SUBJECT: Record<Subject, string[]> = {
  Toán: [
    'Có 45 bông hoa chia đều vào 5 lọ, hỏi mỗi lọ có bao nhiêu bông hoa?',
    'Một mảnh vườn hình chữ nhật có chiều dài $15\\text{ m}$, chiều rộng $8\\text{ m}$. Tính chu vi và diện tích mảnh vườn?',
    'Tìm hai số khi biết tổng của chúng là $48$ và hiệu là $12$ bằng phương pháp sơ đồ đoạn thẳng?',
    'Mẹ mua một hộp sữa. Buổi sáng uống $\\frac{1}{3}$ hộp, buổi chiều uống $\\frac{1}{4}$ hộp. Hỏi còn lại bao nhiêu phần hộp sữa?',
  ],
  'Tiếng Việt': [
    'Phân biệt từ đơn và từ phức (từ ghép, từ láy)? Cho ví dụ dễ hiểu cho học sinh tiểu học.',
    'Lập dàn ý chi tiết bài văn miêu tả chú cún cưng hoặc con mèo thân thiết trong gia đình em?',
    'Các biện pháp nghệ thuật so sánh và nhân hóa trong câu văn tiểu học, cách nhận biết và đặt câu?',
    'Quy tắc phân biệt chính tả l/n, ch/tr, s/x, r/d/gi và cách viết hoa tên người, tên địa danh?',
  ],
  'Tiếng Anh': [
    'Cách đặt câu với cấu trúc "There is" và "There are" để nói về đồ dùng học tập trong lớp?',
    'Hỏi và trả lời về sở thích bằng Tiếng Anh: "What is your hobby? - I like swimming."',
    'Cách hỏi và chỉ đường đơn giản cho học sinh tiểu học: "Where is the library?"',
    'Phân biệt thì Hiện tại đơn với ngôi "I/You/We/They" và "He/She/It" (thêm -s hoặc -es)?',
  ],
  'Khoa học': [
    'Tại sao cây xanh cần ánh sáng mặt trời, nước và không khí để sống và lớn lên?',
    'Vòng tuần hoàn của nước trong tự nhiên diễn ra như thế nào (bốc hơi, mây, mưa)?',
    'Bốn nhóm chất dinh dưỡng quan trọng trong bữa ăn hàng ngày (chất bột đường, đạm, béo, vitamin)?',
    'Tại sao chúng ta phải rửa tay bằng xà phòng trước khi ăn và sau khi đi vệ sinh?',
  ],
  'Lịch sử & Địa lý': [
    'Kể câu chuyện về Hai Bà Trưng cưỡi voi ra trận đánh đuổi giặc phương Bắc?',
    'Chiến thắng lịch sử trên sông Bạch Đằng năm 938 của Ngô Quyền với bãi cọc gỗ ngầm?',
    'Việt Nam có bao nhiêu dân tộc anh em? Thủ đô và các miền địa lý của nước ta?',
    'Đặc điểm của dãy núi Hoàng Liên Sơn và đỉnh Fansipan - nóc nhà Đông Dương?',
  ],
  'Tin học': [
    'Cách ngồi đúng tư thế và đặt tay trên hàng phím cơ sở để gõ 10 ngón tay?',
    'Phần mềm Scratch là gì? Làm thế nào để lập trình cho chú mèo di chuyển và kêu meo meo?',
    'Những nguyên tắc cần nhớ để sử dụng máy tính và mạng Internet an toàn cho học sinh?',
    'Các bộ phận chính của máy tính để bàn (thân máy, màn hình, bàn phím, chuột) có chức năng gì?',
  ],
  'Đạo đức': [
    'Vì sao các bạn nhỏ cần biết nói lời "Cảm ơn" và "Xin lỗi" khi giao tiếp hàng ngày?',
    'Lòng hiếu thảo với ông bà cha mẹ được thể hiện qua những việc làm nhỏ nào?',
    'Quy tắc an toàn khi tham gia giao thông trên đường đi bộ hoặc đi xe đạp tới trường?',
    'Cách xử lý khi bị người lạ rủ rê hoặc cảm thấy không an toàn ở nơi công cộng?',
  ],
};

export const POPULAR_TOPICS: { subject: Subject; topic: string }[] = [
  { subject: 'Toán', topic: 'Bảng nhân và bảng chia từ 2 đến 9 (Bảng cửu chương)' },
  { subject: 'Toán', topic: 'Bài toán tìm hai số khi biết Tổng và Hiệu' },
  { subject: 'Toán', topic: 'Chu vi và diện tích các hình (Hình vuông, Hình chữ nhật, Hình tam giác)' },
  { subject: 'Toán', topic: 'Cộng, trừ, nhân, chia phân số và rút gọn phân số' },
  { subject: 'Toán', topic: 'Toán chuyển động đều: Vận tốc, Quãng đường, Thời gian ($s = v \\times t$)' },
  { subject: 'Tiếng Việt', topic: 'Luyện từ và câu: Ba kiểu câu kể cơ bản (Ai là gì? Ai làm gì? Ai thế nào?)' },
  { subject: 'Tiếng Việt', topic: 'Tập làm văn: Dàn ý và bài văn miêu tả con vật nuôi trong nhà' },
  { subject: 'Tiếng Việt', topic: 'Tập làm văn: Miêu tả đồ vật (Chiếc cặp sách, cây bút mực, chiếc đồng hồ)' },
  { subject: 'Tiếng Anh', topic: 'Từ vựng & Mẫu câu chủ đề Gia đình, Trường học và Sở thích' },
  { subject: 'Khoa học', topic: 'Sự biến đổi của chất và các thể của nước (Rắn, Lỏng, Khí)' },
  { subject: 'Lịch sử & Địa lý', topic: 'Nước Văn Lang thời các vua Hùng và phong tục ngày Tết' },
  { subject: 'Tin học', topic: 'Làm quen lập trình Scratch và vẽ hình cơ bản' },
  { subject: 'Đạo đức', topic: 'Kính trọng thầy cô, thân thiện với bạn bè và giữ lời hứa' },
];
