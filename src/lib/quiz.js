import { getGeminiConfig } from './gemini.js';

const quizSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Tên ngắn gọn cho bộ câu hỏi.' },
    description: { type: 'string', description: 'Một câu mô tả nội dung bộ câu hỏi.' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'Nội dung đầy đủ của câu hỏi.' },
          options: {
            type: 'array',
            items: { type: 'string' },
            minItems: 3,
            maxItems: 4,
            description: 'Danh sách đúng 3 hoặc 4 phương án, giữ nguyên thứ tự nguồn.',
          },
          correctIndex: { type: 'integer', description: 'Vị trí đáp án đúng tính từ 0.' },
          explanation: { type: 'string', description: 'Lời giải chi tiết, rõ vì sao đáp án đúng và các phương án khác sai khi nguồn có thông tin.' },
          needsReview: { type: 'boolean', description: 'True khi đề, đáp án hoặc lời giải trong nguồn bị thiếu hay mơ hồ.' },
        },
        required: ['question', 'options', 'correctIndex', 'explanation', 'needsReview'],
      },
    },
  },
  required: ['title', 'description', 'questions'],
};

function cleanText(value, maxLength = 10_000) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, maxLength);
}

function createId() {
  return crypto.randomUUID();
}

export function createEmptyQuizQuestion() {
  const options = Array.from({ length: 4 }, () => ({ id: createId(), text: '' }));
  return {
    id: createId(),
    prompt: '',
    options,
    correctOptionId: options[0].id,
    explanation: '',
    needsReview: true,
  };
}

function normalizeOptions(value) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((option) => cleanText(typeof option === 'object' ? option?.text : option, 2_000))
    .filter(Boolean)
    .slice(0, 4)
    .map((text) => ({ id: createId(), text }));
}

export function normalizeQuizQuestion(value = {}) {
  const options = normalizeOptions(value.options);
  const rawCorrectIndex = Number(value.correctIndex);
  const correctIndex = Number.isInteger(rawCorrectIndex) && rawCorrectIndex >= 0 && rawCorrectIndex < options.length
    ? rawCorrectIndex
    : 0;
  const prompt = cleanText(value.question || value.prompt, 10_000);
  const explanation = cleanText(value.explanation, 20_000);
  return {
    id: cleanText(value.id, 200) || createId(),
    prompt,
    options,
    correctOptionId: options[correctIndex]?.id || '',
    explanation,
    needsReview: Boolean(value.needsReview) || !prompt || options.length < 3 || options.length > 4 || !explanation,
  };
}

export function validateQuizQuestion(question) {
  if (!cleanText(question?.prompt)) return 'Câu hỏi đang để trống.';
  const options = (question?.options || []).filter((option) => cleanText(option.text));
  if (options.length < 3) return 'Cần có ít nhất 3 phương án.';
  if (!options.some((option) => option.id === question.correctOptionId)) return 'Chưa chọn đáp án đúng.';
  if (!cleanText(question?.explanation)) return 'Chưa có lời giải chi tiết.';
  return '';
}

export async function analyzeQuizQuestions(sourceText, runtimeSettings = {}) {
  const source = cleanText(sourceText, 120_001);
  if (!source) throw new Error('Hãy nhập nội dung câu hỏi trước khi phân tích.');
  if (source.length > 120_000) throw new Error('Nội dung quá dài. Hãy chia file thành các phần nhỏ hơn 120.000 ký tự.');

  const { apiKey, model } = getGeminiConfig(runtimeSettings);
  if (!apiKey) throw new Error('Chưa có Gemini API key. Hãy thêm key trong Cài đặt → Kết nối Gemini.');

  const prompt = `Bạn là chuyên gia chuẩn hóa ngân hàng câu hỏi trắc nghiệm.

NHIỆM VỤ:
- Đọc toàn bộ dữ liệu nguồn và tách chính xác từng câu hỏi.
- Mỗi câu phải có nội dung câu hỏi, 3 hoặc 4 phương án, đúng một đáp án đúng và lời giải chi tiết.
- Giữ nguyên ngôn ngữ, kiến thức, số liệu và ý nghĩa của nguồn. Không tự đổi đáp án.
- Nhận diện đáp án dù nguồn dùng A/B/C/D, số thứ tự, dấu sao, chữ in đậm hoặc dòng "Đáp án".
- correctIndex bắt đầu từ 0: A=0, B=1, C=2, D=3.
- Không tạo thêm phương án không có trong nguồn. Câu có 3 phương án phải trả đúng 3; câu có 4 phải trả đúng 4.
- Chuẩn hóa khoảng trắng và bỏ tiền tố A., B., C., D. khỏi nội dung phương án.
- Nếu thiếu lời giải, đáp án mơ hồ, có ít hơn 3 phương án hoặc dữ liệu không chắc chắn, vẫn giữ câu nhưng đặt needsReview=true.
- Không đưa bất kỳ nội dung nào ngoài JSON theo schema.
- Tối đa 100 câu hỏi.

DỮ LIỆU NGUỒN:
---
${source}
---`;

  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: quizSchema,
        },
      }),
    });
  } catch (_error) {
    throw new Error('Không thể kết nối Gemini. Hãy kiểm tra Internet và thử lại.');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini trả về lỗi ${response.status}.`;
    if (response.status === 400 && /api key/i.test(message)) throw new Error('API key Gemini không hợp lệ. Hãy kiểm tra lại key.');
    if (response.status === 429) throw new Error('Gemini đã đạt giới hạn yêu cầu. Hãy chờ một chút rồi thử lại.');
    throw new Error(message);
  }

  const raw = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  if (!raw) throw new Error('Gemini không trả về nội dung câu hỏi.');

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
  } catch (_error) {
    throw new Error('Gemini trả về dữ liệu không đúng định dạng. Hãy thử phân tích lại.');
  }

  const questions = (Array.isArray(parsed.questions) ? parsed.questions : [])
    .slice(0, 100)
    .map(normalizeQuizQuestion)
    .filter((question) => question.prompt || question.options.length);
  if (!questions.length) throw new Error('Không nhận diện được câu hỏi trắc nghiệm hợp lệ trong nội dung.');

  return {
    title: cleanText(parsed.title, 150) || 'Bộ câu hỏi mới',
    description: cleanText(parsed.description, 500),
    questions,
  };
}

export function createQuizSet(source = {}, sourceLabel = 'Nội dung dán trực tiếp') {
  const questions = (source.questions || []).map((question) => {
    const options = (question.options || [])
      .map((option) => ({ id: cleanText(option.id, 200) || createId(), text: cleanText(option.text, 2_000) }))
      .filter((option) => option.text)
      .slice(0, 4);
    return {
      id: cleanText(question.id, 200) || createId(),
      prompt: cleanText(question.prompt, 10_000),
      options,
      correctOptionId: question.correctOptionId,
      explanation: cleanText(question.explanation, 20_000),
      needsReview: false,
    };
  }).filter((question) => !validateQuizQuestion(question));

  if (!cleanText(source.title)) throw new Error('Hãy đặt tên cho bộ câu hỏi.');
  if (!questions.length) throw new Error('Chưa có câu hỏi hoàn chỉnh để tạo bộ đề.');
  const timestamp = new Date().toISOString();
  return {
    id: createId(),
    title: cleanText(source.title, 150),
    description: cleanText(source.description, 500),
    source: cleanText(sourceLabel, 300),
    questions,
    attempts: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function buildQuizAttempt(quizSet, answers = {}) {
  const details = (quizSet.questions || []).map((question) => {
    const selectedOptionId = answers[question.id] || '';
    return {
      questionId: question.id,
      selectedOptionId,
      correctOptionId: question.correctOptionId,
      isCorrect: selectedOptionId === question.correctOptionId,
    };
  });
  const correct = details.filter((item) => item.isCorrect).length;
  const total = details.length;
  return {
    id: createId(),
    completedAt: new Date().toISOString(),
    total,
    correct,
    incorrect: total - correct,
    percentage: total ? Math.round((correct / total) * 100) : 0,
    details,
  };
}

export function shuffleQuizQuestions(questions = []) {
  const copy = [...questions];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}
