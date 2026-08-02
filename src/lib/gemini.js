const DEFAULT_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
const ENV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const vocabularySchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Tên ngắn gọn bằng tiếng Việt cho bộ từ.' },
    description: { type: 'string', description: 'Một câu mô tả chủ đề bộ từ bằng tiếng Việt.' },
    words: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          term: { type: 'string', description: 'Từ hoặc cụm từ tiếng Anh chuẩn hóa.' },
          meaning: { type: 'string', description: 'Nghĩa tiếng Việt dựa trên dữ liệu nguồn.' },
          englishMeaning: { type: 'string', description: 'Một định nghĩa ngắn, tự nhiên bằng tiếng Anh để người học có thể tự viết lại.' },
          pronunciation: { type: 'string', description: 'Phiên âm IPA, để trống nếu không chắc.' },
          partOfSpeech: { type: 'string', description: 'Loại từ viết tắt: noun, verb, adjective, adverb, phrase hoặc other.' },
          example: { type: 'string', description: 'Một câu ví dụ tiếng Anh tự nhiên, ngắn gọn.' },
          exampleMeaning: { type: 'string', description: 'Bản dịch tiếng Việt của câu ví dụ.' },
          level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tối đa 3 nhãn chủ đề ngắn bằng tiếng Việt.' },
          note: { type: 'string', description: 'Ghi chú cách dùng quan trọng, có thể để trống.' },
          needsReview: { type: 'boolean', description: 'True nếu cặp từ-nghĩa trong nguồn mơ hồ hoặc thiếu dữ liệu.' },
        },
        required: ['term', 'meaning', 'englishMeaning', 'pronunciation', 'partOfSpeech', 'example', 'exampleMeaning', 'level', 'tags', 'note', 'needsReview'],
      },
    },
  },
  required: ['title', 'description', 'words'],
};

function cleanWord(word) {
  return {
    id: crypto.randomUUID(),
    term: String(word.term || '').trim(),
    meaning: String(word.meaning || '').trim(),
    englishMeaning: String(word.englishMeaning || '').trim(),
    pronunciation: String(word.pronunciation || '').trim(),
    partOfSpeech: String(word.partOfSpeech || 'other').trim().toLowerCase(),
    example: String(word.example || '').trim(),
    exampleMeaning: String(word.exampleMeaning || '').trim(),
    level: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(word.level) ? word.level : 'A2',
    tags: Array.isArray(word.tags) ? word.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 3) : [],
    note: String(word.note || '').trim(),
    needsReview: Boolean(word.needsReview),
  };
}

export function getGeminiConfig(runtimeSettings = {}) {
  return {
    apiKey: String(runtimeSettings.geminiApiKey || ENV_API_KEY).trim(),
    model: String(runtimeSettings.geminiModel || DEFAULT_MODEL).trim(),
    hasEnvKey: Boolean(ENV_API_KEY),
  };
}

export async function analyzeVocabulary(sourceText, runtimeSettings = {}) {
  const source = sourceText.trim();
  if (!source) throw new Error('Hãy nhập nội dung từ vựng trước khi phân tích.');
  if (source.length > 120_000) throw new Error('Nội dung quá dài. Vui lòng chia thành các phần nhỏ hơn 120.000 ký tự.');

  const { apiKey, model } = getGeminiConfig(runtimeSettings);
  if (!apiKey) {
    throw new Error('Chưa có Gemini API key. Hãy thêm key trong file .env.local hoặc mục Cài đặt.');
  }

  const prompt = `Bạn là chuyên gia biên soạn từ vựng Anh–Việt cho người Việt.

NHIỆM VỤ:
- Đọc dữ liệu thô bên dưới và tách thành các từ hoặc cụm từ tiếng Anh kèm nghĩa tiếng Việt.
- Ưu tiên tuyệt đối nghĩa tiếng Việt có sẵn trong nguồn. Không thay đổi ý nghĩa gốc.
- Chuẩn hóa lỗi viết hoa và khoảng trắng; loại bỏ mục trùng lặp nhưng giữ nghĩa hữu ích.
- Bổ sung phiên âm IPA, loại từ, trình độ CEFR và một câu ví dụ ngắn, tự nhiên.
- Bổ sung englishMeaning: một định nghĩa tiếng Anh đơn giản, không dùng lại chính từ vựng làm đáp án. Nếu không đủ ngữ cảnh, để trống và đặt needsReview=true.
- Nếu một mục thiếu nghĩa tiếng Việt, nghĩa mơ hồ hoặc không chắc chắn, vẫn xử lý nhưng đặt needsReview=true.
- Không đưa câu giải thích ngoài cấu trúc JSON được yêu cầu.
- Chỉ lấy các mục thật sự hữu ích để học, tối đa 100 mục.

DỮ LIỆU NGUỒN:
---
${source}
---`;

  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: vocabularySchema,
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
  if (!raw) {
    const reason = payload?.candidates?.[0]?.finishReason;
    throw new Error(reason ? `Gemini không tạo được dữ liệu (${reason}).` : 'Gemini không trả về nội dung.');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
  } catch (_error) {
    throw new Error('Gemini trả về dữ liệu không đúng định dạng. Hãy thử phân tích lại.');
  }

  const seen = new Set();
  const words = (Array.isArray(parsed.words) ? parsed.words : [])
    .map(cleanWord)
    .filter((word) => word.term && word.meaning)
    .filter((word) => {
      const key = word.term.toLocaleLowerCase('en');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (!words.length) throw new Error('Không tìm thấy cặp từ vựng Anh–Việt hợp lệ trong nội dung.');
  return {
    title: String(parsed.title || 'Bộ từ mới').trim(),
    description: String(parsed.description || '').trim(),
    words,
  };
}

export function parseLocally(sourceText) {
  const lines = sourceText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const words = [];
  const seen = new Set();

  for (const line of lines) {
    if (/^(english|từ vựng|vocabulary|word)\s*[,|;\t]/i.test(line)) continue;
    const separators = [/\t+/, /\s*\|\s*/, /\s*;\s*/, /\s+[–—-]\s+/, /\s*:\s*/, /\s*,\s*/];
    let parts;
    for (const separator of separators) {
      const candidate = line.split(separator);
      if (candidate.length >= 2) {
        parts = candidate;
        break;
      }
    }
    if (!parts) continue;
    const term = parts.shift()?.trim();
    const meaning = parts.join(', ').trim();
    const key = term?.toLocaleLowerCase('en');
    if (!term || !meaning || seen.has(key)) continue;
    if (!/[a-z]/i.test(term)) continue;
    seen.add(key);
    words.push(cleanWord({ term, meaning, needsReview: true, level: 'A2' }));
  }

  if (!words.length) {
    throw new Error('Không nhận diện được dữ liệu. Mỗi dòng nên có dạng “english | nghĩa tiếng Việt”.');
  }
  return { title: 'Bộ từ nhập nhanh', description: 'Được tách trực tiếp từ dữ liệu thô.', words };
}

const englishDefinitionsSchema = {
  type: 'object',
  properties: {
    definitions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          term: { type: 'string' },
          englishMeaning: { type: 'string', description: 'Định nghĩa ngắn bằng tiếng Anh, không lặp lại chính từ.' },
        },
        required: ['term', 'englishMeaning'],
      },
    },
  },
  required: ['definitions'],
};

export async function generateEnglishDefinitions(words = [], runtimeSettings = {}) {
  const sourceWords = words.filter((word) => word?.term && !String(word.englishMeaning || '').trim()).slice(0, 100);
  if (!sourceWords.length) return [];
  const { apiKey, model } = getGeminiConfig(runtimeSettings);
  if (!apiKey) throw new Error('Chưa có Gemini API key. Hãy thêm key trong Cài đặt → Kết nối Gemini.');

  const prompt = `Hãy viết định nghĩa tiếng Anh đơn giản, chính xác cho các từ dưới đây để người học có thể nghe từ và tự gõ lại định nghĩa.
- Mỗi định nghĩa dài tối đa 18 từ, dùng tiếng Anh tự nhiên ở mức dễ hiểu.
- Không lặp lại chính từ/cụm từ trong định nghĩa.
- Dựa vào nghĩa tiếng Việt và câu ví dụ nếu có.
- Trả đúng một mục cho mỗi từ, không thêm lời giải ngoài JSON.

DỮ LIỆU:
${JSON.stringify(sourceWords.map((word) => ({ term: word.term, meaning: word.meaning, example: word.example || '' })))} `;

  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: englishDefinitionsSchema },
      }),
    });
  } catch (_error) {
    throw new Error('Không thể kết nối Gemini. Hãy kiểm tra Internet và thử lại.');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `Gemini trả về lỗi ${response.status}.`);
  const raw = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  if (!raw) throw new Error('Gemini không trả về định nghĩa tiếng Anh.');
  let parsed;
  try { parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')); } catch (_error) { throw new Error('Gemini trả về dữ liệu không đúng định dạng.'); }
  return (Array.isArray(parsed.definitions) ? parsed.definitions : [])
    .map((item) => ({ term: String(item.term || '').trim().toLocaleLowerCase('en'), englishMeaning: String(item.englishMeaning || '').trim() }))
    .filter((item) => item.term && item.englishMeaning);
}
