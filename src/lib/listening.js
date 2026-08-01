import { getGeminiConfig } from './gemini.js';

const EXAMS = new Map([
  ['toeic', 'TOEIC'],
  ['ielts', 'IELTS'],
  ['general', 'General'],
]);

const LENGTH_PRESETS = {
  short: 90,
  medium: 170,
  long: 280,
};

const BLANK_MODES = new Set(['random', 'content', 'difficult', 'phrases']);

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
  'by', 'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself',
  'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off',
  'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to',
  'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your', 'yours',
  'yourself', 'yourselves',
]);

const COMMON_WORDS = new Set([
  'also', 'back', 'come', 'day', 'even', 'first', 'get', 'give', 'go', 'good', 'know', 'last',
  'like', 'long', 'look', 'make', 'many', 'much', 'need', 'new', 'next', 'one', 'people',
  'say', 'see', 'take', 'thing', 'think', 'time', 'two', 'use', 'want', 'way', 'well', 'work',
  'year',
]);

const listeningSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Tiêu đề ngắn bằng tiếng Việt hoặc tiếng Anh.' },
    description: { type: 'string', description: 'Một câu mô tả bài nghe bằng tiếng Việt.' },
    passage: { type: 'string', description: 'Toàn bộ nội dung tiếng Anh hoàn chỉnh, không đục lỗ.' },
    estimatedLevel: { type: 'string', description: 'Mức độ ước tính của bài, ví dụ IELTS 6.0 hoặc TOEIC 650.' },
    questions: {
      type: 'array',
      description: 'Từ 3 đến 5 câu hỏi đọc/nghe hiểu.',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['multiple-choice'] },
          question: { type: 'string', description: 'Câu hỏi bằng tiếng Anh.' },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Đúng 4 lựa chọn bằng tiếng Anh.',
          },
          correctIndex: { type: 'integer', description: 'Vị trí đáp án đúng, tính từ 0.' },
          explanation: { type: 'string', description: 'Giải thích ngắn gọn bằng tiếng Việt.' },
        },
        required: ['type', 'question', 'options', 'correctIndex', 'explanation'],
      },
    },
    vocabulary: {
      type: 'array',
      description: 'Từ 5 đến 12 từ hoặc cụm từ đáng học trong bài.',
      items: {
        type: 'object',
        properties: {
          term: { type: 'string', description: 'Từ hoặc cụm từ tiếng Anh xuất hiện trong bài.' },
          meaning: { type: 'string', description: 'Nghĩa tiếng Việt đúng theo ngữ cảnh.' },
        },
        required: ['term', 'meaning'],
      },
    },
  },
  required: ['title', 'description', 'passage', 'estimatedLevel', 'questions', 'vocabulary'],
};

function createId() {
  return crypto.randomUUID();
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function cleanSingleLine(value, fallback = '', maximum = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return (text || fallback).slice(0, maximum).trim();
}

function normalizePassage(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeExam(value) {
  const key = String(value || 'General').trim().toLowerCase();
  if (!EXAMS.has(key)) {
    throw new Error('Loại bài thi không hợp lệ. Hãy chọn TOEIC, IELTS hoặc General.');
  }
  return EXAMS.get(key);
}

function resolveTargetWordCount(config) {
  const raw = config.targetWordCount ?? config.length ?? 'medium';
  const preset = LENGTH_PRESETS[String(raw).trim().toLowerCase()];
  const numeric = preset ?? Number(raw);
  if (!Number.isFinite(numeric)) {
    throw new Error('Độ dài bài nghe không hợp lệ. Hãy chọn ngắn, vừa, dài hoặc nhập số từ mong muốn.');
  }
  return Math.round(clamp(numeric, 50, 600));
}

function countWords(value) {
  return tokenizeListeningText(value).filter((token) => token.type === 'word').length;
}

function validatePassage(passage, sourceLabel = 'Đoạn văn') {
  if (!passage) throw new Error(`${sourceLabel} đang để trống.`);
  if (passage.length > 40_000) {
    throw new Error(`${sourceLabel} quá dài. Vui lòng dùng nội dung ngắn hơn 40.000 ký tự.`);
  }
  if (!/[a-z]/i.test(passage)) {
    throw new Error(`${sourceLabel} cần có nội dung tiếng Anh để luyện nghe.`);
  }
  if (countWords(passage) < 5) {
    throw new Error(`${sourceLabel} quá ngắn. Hãy nhập ít nhất 5 từ tiếng Anh.`);
  }
}

function normalizeConfig(config = {}) {
  const sourceKey = String(config.sourceMode || 'ai').trim().toLowerCase();
  if (!['ai', 'manual'].includes(sourceKey)) {
    throw new Error('Nguồn bài nghe không hợp lệ. Hãy chọn tạo bằng AI hoặc nhập thủ công.');
  }

  const exam = normalizeExam(config.exam);
  const defaultType = exam === 'TOEIC'
    ? 'Bài nói ngắn'
    : exam === 'IELTS'
      ? 'Bài nói học thuật'
      : 'Đoạn văn kể chuyện hoặc cung cấp thông tin';

  return {
    sourceMode: sourceKey,
    exam,
    level: cleanSingleLine(config.level, exam === 'General' ? 'Trung cấp' : 'Mức trung bình', 80),
    topic: cleanSingleLine(config.topic, 'Đời sống hằng ngày', 120),
    passageType: cleanSingleLine(config.passageType, defaultType, 120),
    customInstructions: cleanSingleLine(config.customInstructions, '', 1_500),
    targetWordCount: resolveTargetWordCount(config),
    manualText: normalizePassage(config.manualText),
    title: cleanSingleLine(config.title, 'Bài nghe tự nhập', 120),
  };
}

function cleanQuestions(value) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 8).flatMap((item) => {
    const question = cleanSingleLine(item?.question, '', 500);
    const originalOptions = Array.isArray(item?.options) ? item.options : [];
    const originalCorrectIndex = Number(item?.correctIndex);
    const correctOption = Number.isInteger(originalCorrectIndex)
      ? cleanSingleLine(originalOptions[originalCorrectIndex], '', 300)
      : '';
    const options = [];

    originalOptions.forEach((option) => {
      const cleaned = cleanSingleLine(option, '', 300);
      if (cleaned && !options.includes(cleaned)) options.push(cleaned);
    });

    const correctIndex = options.indexOf(correctOption);
    if (!question || options.length < 2 || correctIndex < 0) return [];

    return [{
      id: createId(),
      type: 'multiple-choice',
      question,
      options,
      correctIndex,
      explanation: cleanSingleLine(item?.explanation, 'Đáp án dựa trên thông tin trong bài nghe.', 700),
    }];
  });
}

function cleanVocabulary(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const vocabulary = [];

  for (const item of value) {
    const term = cleanSingleLine(item?.term, '', 120);
    const meaning = cleanSingleLine(item?.meaning, '', 300);
    const key = term.toLocaleLowerCase('en-US');
    if (!term || !meaning || seen.has(key)) continue;
    seen.add(key);
    vocabulary.push({ id: createId(), term, meaning });
    if (vocabulary.length >= 20) break;
  }
  return vocabulary;
}

function parseGeminiJson(raw) {
  const withoutFence = String(raw || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');

  try {
    return JSON.parse(withoutFence);
  } catch (_error) {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFence.slice(start, end + 1));
      } catch (_error) {
        // The caller provides one consistent, user-facing parsing error.
      }
    }
  }
  throw new Error('Gemini trả về dữ liệu không đúng định dạng. Hãy thử tạo lại bài nghe.');
}

function cleanGeneratedPassage(parsed, config) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Gemini không trả về một bài nghe hợp lệ. Hãy thử lại.');
  }

  const passage = normalizePassage(parsed.passage);
  validatePassage(passage, 'Nội dung Gemini tạo');

  const questions = cleanQuestions(parsed.questions);
  if (!questions.length) {
    throw new Error('Gemini chưa tạo được câu hỏi trắc nghiệm hợp lệ. Hãy thử tạo lại bài nghe.');
  }

  return {
    title: cleanSingleLine(parsed.title, `${config.topic} · ${config.exam}`, 120),
    description: cleanSingleLine(parsed.description, `Bài luyện nghe chủ đề ${config.topic}.`, 300),
    passage,
    estimatedLevel: cleanSingleLine(parsed.estimatedLevel, `${config.exam} · ${config.level}`, 100),
    exam: config.exam,
    topic: config.topic,
    passageType: config.passageType,
    sourceMode: 'ai',
    targetWordCount: config.targetWordCount,
    questions,
    vocabulary: cleanVocabulary(parsed.vocabulary),
  };
}

export async function generateListeningPassage(config = {}, runtimeSettings = {}) {
  const normalized = normalizeConfig(config);

  if (normalized.sourceMode === 'manual') {
    validatePassage(normalized.manualText, 'Đoạn văn bạn nhập');
    return {
      title: normalized.title,
      description: 'Nội dung do người học nhập để tạo bài luyện nghe.',
      passage: normalized.manualText,
      estimatedLevel: normalized.level,
      exam: normalized.exam,
      topic: normalized.topic,
      passageType: normalized.passageType,
      sourceMode: 'manual',
      targetWordCount: countWords(normalized.manualText),
      questions: [],
      vocabulary: [],
    };
  }

  const { apiKey, model } = getGeminiConfig(runtimeSettings);
  if (!apiKey) {
    throw new Error('Chưa có Gemini API key. Hãy thêm key trong file .env.local hoặc mục Cài đặt.');
  }
  if (!model) throw new Error('Chưa chọn mô hình Gemini để tạo bài nghe.');

  const extraInstruction = normalized.customInstructions
    ? `\nYÊU CẦU THÊM CỦA NGƯỜI DÙNG:\n${normalized.customInstructions}\n`
    : '';
  const prompt = `Bạn là chuyên gia biên soạn bài luyện nghe tiếng Anh cho người Việt.

Hãy tạo một bài nghe mới theo cấu hình:
- Hệ/mục tiêu: ${normalized.exam}
- Trình độ hoặc mức điểm: ${normalized.level}
- Chủ đề: ${normalized.topic}
- Dạng bài: ${normalized.passageType}
- Độ dài mục tiêu: khoảng ${normalized.targetWordCount} từ (sai số tối đa 15%)
${extraInstruction}
QUY TẮC BẮT BUỘC:
- passage phải hoàn toàn bằng tiếng Anh, tự nhiên, mạch lạc và phù hợp đúng mức độ đã chọn.
- Trả về passage đầy đủ; tuyệt đối không đặt chỗ trống, dấu gạch dưới hoặc đáp án trong passage.
- Nếu là TOEIC, ưu tiên bối cảnh công việc và dạng nghe sát mục tiêu nhưng không sao chép đề thi thật.
- Nếu là IELTS, dùng văn phong và nhiệm vụ nghe phù hợp mục tiêu nhưng không tự nhận là đề thi chính thức.
- Tạo 3–5 câu hỏi trắc nghiệm bằng tiếng Anh, mỗi câu có đúng 4 lựa chọn và chỉ một đáp án đúng.
- correctIndex phải là số từ 0 đến 3.
- Giải thích đáp án bằng tiếng Việt, ngắn gọn và dựa trực tiếp vào passage.
- Chọn 5–12 từ/cụm từ hữu ích thực sự xuất hiện trong passage và dịch nghĩa theo ngữ cảnh.
- description phải bằng tiếng Việt.
- Chỉ trả về JSON theo đúng cấu trúc được yêu cầu, không kèm lời dẫn hay Markdown.`;

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
          temperature: 0.65,
          maxOutputTokens: 8_192,
          responseMimeType: 'application/json',
          responseSchema: listeningSchema,
        },
      }),
    });
  } catch (_error) {
    throw new Error('Không thể kết nối Gemini. Hãy kiểm tra Internet rồi thử lại.');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const apiMessage = cleanSingleLine(payload?.error?.message, '', 500);
    if (response.status === 400 && /api.?key/i.test(apiMessage)) {
      throw new Error('API key Gemini không hợp lệ. Hãy kiểm tra lại key trong Cài đặt.');
    }
    if (response.status === 400) {
      throw new Error(apiMessage || 'Gemini từ chối cấu hình bài nghe. Hãy kiểm tra các lựa chọn rồi thử lại.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Gemini không cho phép yêu cầu này. Hãy kiểm tra API key và quyền sử dụng mô hình.');
    }
    if (response.status === 429) {
      throw new Error('Gemini đã đạt giới hạn yêu cầu. Hãy chờ một chút rồi thử lại.');
    }
    if (response.status >= 500) {
      throw new Error('Dịch vụ Gemini đang tạm thời gặp sự cố. Hãy thử lại sau ít phút.');
    }
    throw new Error(apiMessage || `Gemini trả về lỗi ${response.status}.`);
  }

  const raw = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();
  if (!raw) {
    const reason = payload?.candidates?.[0]?.finishReason;
    if (reason === 'SAFETY') {
      throw new Error('Gemini không thể tạo bài với chủ đề này vì bộ lọc an toàn. Hãy chọn chủ đề khác.');
    }
    throw new Error(reason
      ? `Gemini chưa tạo được nội dung hoàn chỉnh (${reason}). Hãy thử lại.`
      : 'Gemini không trả về nội dung bài nghe. Hãy thử lại.');
  }

  return cleanGeneratedPassage(parseGeminiJson(raw), normalized);
}

export function normalizeListeningAnswer(value = '') {
  return String(value ?? '')
    .toLocaleLowerCase('en-US')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeListeningText(value = '') {
  const text = String(value ?? '');
  const matches = text.match(/[\p{L}\p{M}]+(?:[’'-][\p{L}\p{M}]+)*|\p{N}+(?:[.,]\p{N}+)*|\s+|[^\s]/gu) || [];
  let wordIndex = 0;

  return matches.map((token) => {
    if (/^[\p{L}\p{M}\p{N}]/u.test(token)) {
      const result = { type: 'word', value: token, wordIndex };
      wordIndex += 1;
      return result;
    }
    return { type: /^\s+$/u.test(token) ? 'space' : 'punctuation', value: token };
  });
}

function fallbackSentenceSplit(text) {
  const abbreviations = new Set([
    'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'no',
    'fig', 'a.m', 'p.m', 'u.s', 'u.k',
  ]);
  const sentences = [];
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (!'.!?'.includes(character)) continue;

    if (character === '.') {
      if (/\d/.test(text[index - 1] || '') && /\d/.test(text[index + 1] || '')) continue;
      const before = text.slice(0, index + 1);
      const lastToken = before.match(/([A-Za-z](?:[A-Za-z.]*)?)\.$/)?.[1]?.toLowerCase();
      if (lastToken && (abbreviations.has(lastToken) || /^(?:[a-z]\.)+[a-z]?$/i.test(lastToken))) continue;
      if (/[A-Za-z0-9]/.test(text[index + 1] || '')) continue;
    }

    let end = index + 1;
    while (/[.!?]/.test(text[end] || '')) end += 1;
    while (/['”’")\]]/.test(text[end] || '')) end += 1;
    const sentence = text.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    while (/\s/.test(text[end] || '')) end += 1;
    start = end;
    index = end - 1;
  }

  const remainder = text.slice(start).trim();
  if (remainder) sentences.push(remainder);
  return sentences;
}

export function splitIntoSentences(value = '') {
  const text = normalizePassage(value);
  if (!text) return [];

  if (typeof Intl?.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    const segmented = Array.from(segmenter.segment(text), ({ segment }) => segment.trim())
      .filter(Boolean);
    const sentences = [];
    const endsWithAbbreviation = (sentence) => /(?:^|\s)(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|e\.g|i\.e|no|fig|a\.m|p\.m|u\.s|u\.k)\.[\s'”’")\]]*$/i.test(sentence);

    segmented.forEach((sentence) => {
      const previousIndex = sentences.length - 1;
      if (previousIndex >= 0 && endsWithAbbreviation(sentences[previousIndex])) {
        sentences[previousIndex] = `${sentences[previousIndex]} ${sentence}`;
      } else {
        sentences.push(sentence);
      }
    });
    if (sentences.length) return sentences;
  }
  return fallbackSentenceSplit(text);
}

function stableFraction(value) {
  let hash = 2_166_136_261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_295;
}

function getWordTokens(sentence) {
  return sentence.tokens.filter((token) => token.type === 'word');
}

function tokenPositionForWord(tokens, wordIndex) {
  return tokens.findIndex((token) => token.type === 'word' && token.wordIndex === wordIndex);
}

function extractWordRange(sentence, startWord, endWord) {
  const startToken = tokenPositionForWord(sentence.tokens, startWord);
  const endToken = tokenPositionForWord(sentence.tokens, endWord);
  if (startToken < 0 || endToken < startToken) return '';
  return sentence.tokens.slice(startToken, endToken + 1).map((token) => token.value).join('').trim();
}

function rangeHasInternalPunctuation(sentence, startWord, endWord) {
  const startToken = tokenPositionForWord(sentence.tokens, startWord);
  const endToken = tokenPositionForWord(sentence.tokens, endWord);
  if (startToken < 0 || endToken < startToken) return true;
  return sentence.tokens.slice(startToken, endToken + 1)
    .some((token) => token.type === 'punctuation');
}

function isEligibleWord(token) {
  const normalized = normalizeListeningAnswer(token.value);
  if (!normalized || STOPWORDS.has(normalized)) return false;
  if (/^[a-z]$/i.test(normalized)) return false;
  return /^[a-z0-9][a-z0-9'-]*$/i.test(normalized);
}

function countSyllableLikeGroups(word) {
  return word.replace(/e$/i, '').match(/[aeiouy]+/gi)?.length || 1;
}

function scoreSingleCandidate(candidate, mode, seed) {
  const word = normalizeListeningAnswer(candidate.answer);
  const randomPart = stableFraction(`${seed}|${candidate.sentenceIndex}|${candidate.startWord}|${word}`);
  const lengthScore = Math.min(word.length, 14) / 14;
  const suffixScore = /(tion|sion|ment|ness|ity|ance|ence|able|ible|ive|ous|ally|ically|ize|ise)$/i.test(word) ? 0.8 : 0;
  const commonPenalty = COMMON_WORDS.has(word) ? 0.45 : 0;
  const sentenceStartPenalty = candidate.startWord === 0 ? 0.12 : 0;

  if (mode === 'random') return randomPart - sentenceStartPenalty;
  if (mode === 'difficult') {
    return (lengthScore * 1.2)
      + (Math.min(countSyllableLikeGroups(word), 5) / 5)
      + suffixScore
      + (randomPart * 0.2)
      - commonPenalty
      - sentenceStartPenalty;
  }
  return lengthScore + (suffixScore * 0.35) + (randomPart * 0.35) - commonPenalty - sentenceStartPenalty;
}

function buildSingleCandidates(sentences, mode, seed) {
  const candidates = [];
  sentences.forEach((sentence) => {
    getWordTokens(sentence).forEach((word) => {
      if (!isEligibleWord(word)) return;
      const candidate = {
        sentenceIndex: sentence.index,
        startWord: word.wordIndex,
        endWord: word.wordIndex,
        answer: word.value,
        wordCount: 1,
      };
      candidate.score = scoreSingleCandidate(candidate, mode, seed);
      candidates.push(candidate);
    });
  });
  return candidates;
}

function buildPhraseCandidates(sentences, seed) {
  const candidates = [];
  sentences.forEach((sentence) => {
    const words = getWordTokens(sentence);
    for (let start = 0; start < words.length; start += 1) {
      for (const phraseLength of [3, 2]) {
        const end = start + phraseLength - 1;
        if (end >= words.length) continue;
        const startWord = words[start].wordIndex;
        const endWord = words[end].wordIndex;
        if (rangeHasInternalPunctuation(sentence, startWord, endWord)) continue;

        const phraseWords = words.slice(start, end + 1);
        const contentWords = phraseWords.filter(isEligibleWord);
        // Keep articles/prepositions inside a useful phrase (for example "quality of life"),
        // but never create a phrase that starts or ends with a standalone stopword.
        if (!isEligibleWord(phraseWords[0]) || !isEligibleWord(phraseWords.at(-1))) continue;
        const answer = extractWordRange(sentence, startWord, endWord);
        const contentRatio = contentWords.length / phraseLength;
        const randomPart = stableFraction(`${seed}|phrase|${sentence.index}|${startWord}|${answer}`);
        candidates.push({
          sentenceIndex: sentence.index,
          startWord,
          endWord,
          answer,
          wordCount: phraseLength,
          score: (phraseLength * 0.4) + contentRatio + (randomPart * 0.35),
        });
      }
    }
  });
  return candidates;
}

function rangesConflict(candidate, selected) {
  return selected.some((existing) => existing.sentenceIndex === candidate.sentenceIndex
    && !(candidate.endWord + 1 < existing.startWord || candidate.startWord > existing.endWord + 1));
}

function resolveBlankOptions(options = {}) {
  const rawPercentage = Number(options.blankPercentage ?? options.percentage ?? 20);
  const percentage = Number.isFinite(rawPercentage) ? clamp(rawPercentage, 5, 45) : 20;
  const rawMode = String(options.blankMode || options.mode || 'content').trim().toLowerCase();
  return {
    blankPercentage: Math.round(percentage),
    blankMode: BLANK_MODES.has(rawMode) ? rawMode : 'content',
  };
}

function selectBlanks(sentences, passage, settings, totalWords) {
  const targetWords = Math.max(1, Math.round(totalWords * (settings.blankPercentage / 100)));
  const seed = `${passage}|${settings.blankMode}|${settings.blankPercentage}`;
  const candidates = settings.blankMode === 'phrases'
    ? buildPhraseCandidates(sentences, seed)
    : buildSingleCandidates(sentences, settings.blankMode, seed);

  candidates.sort((left, right) => right.score - left.score
    || left.sentenceIndex - right.sentenceIndex
    || left.startWord - right.startWord);

  const selected = [];
  let blankedWords = 0;
  for (const candidate of candidates) {
    if (blankedWords >= targetWords) break;
    if (rangesConflict(candidate, selected)) continue;
    selected.push(candidate);
    blankedWords += candidate.wordCount;
  }

  if (!selected.length) {
    throw new Error('Đoạn văn chưa có đủ từ nội dung phù hợp để tạo chỗ trống. Hãy dùng một đoạn dài hơn.');
  }

  selected.sort((left, right) => left.sentenceIndex - right.sentenceIndex
    || left.startWord - right.startWord);
  return selected.map((candidate) => ({
    id: createId(),
    sentenceIndex: candidate.sentenceIndex,
    startWord: candidate.startWord,
    endWord: candidate.endWord,
    answer: candidate.answer,
    normalizedAnswer: normalizeListeningAnswer(candidate.answer),
  }));
}

export function createListeningLesson(base, options = {}) {
  const source = typeof base === 'string' ? { passage: base } : base;
  if (!source || typeof source !== 'object') {
    throw new Error('Không tìm thấy nội dung để tạo bài luyện nghe.');
  }

  const passage = normalizePassage(source.passage);
  validatePassage(passage, 'Nội dung bài nghe');
  const sentenceTexts = splitIntoSentences(passage);
  if (!sentenceTexts.length) throw new Error('Không thể tách nội dung thành câu để tạo bài luyện nghe.');

  const sentences = sentenceTexts.map((text, index) => ({
    id: createId(),
    index,
    text,
    tokens: tokenizeListeningText(text),
  }));
  const totalWords = sentences.reduce((sum, sentence) => sum + getWordTokens(sentence).length, 0);
  const blankSettings = resolveBlankOptions(options);
  const blanks = selectBlanks(sentences, passage, blankSettings, totalWords);
  const blankedWords = blanks.reduce((sum, blank) => sum + blank.endWord - blank.startWord + 1, 0);
  const timestamp = new Date().toISOString();

  return {
    id: createId(),
    title: cleanSingleLine(source.title, 'Bài luyện nghe mới', 120),
    description: cleanSingleLine(source.description, '', 300),
    passage,
    estimatedLevel: cleanSingleLine(source.estimatedLevel, 'Tự chọn', 100),
    exam: normalizeExam(source.exam || 'General'),
    topic: cleanSingleLine(source.topic, 'Tự chọn', 120),
    passageType: cleanSingleLine(source.passageType, 'Đoạn văn', 120),
    sourceMode: source.sourceMode === 'ai' ? 'ai' : 'manual',
    sentences,
    blanks,
    questions: cleanQuestions(source.questions),
    vocabulary: cleanVocabulary(source.vocabulary),
    settings: {
      blankPercentage: blankSettings.blankPercentage,
      blankMode: blankSettings.blankMode,
      totalWords,
      blankedWords,
      blankCount: blanks.length,
      actualBlankPercentage: Math.round((blankedWords / totalWords) * 100),
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: [],
  };
}

function appendTextPart(parts, text) {
  if (!text) return;
  const previous = parts.at(-1);
  if (previous?.type === 'text') {
    previous.text += text;
    return;
  }
  parts.push({ type: 'text', key: `text-${parts.length}`, text });
}

export function renderSentenceParts(sentence, blanks = []) {
  const sentenceObject = typeof sentence === 'string'
    ? { index: 0, text: sentence, tokens: tokenizeListeningText(sentence) }
    : sentence;
  if (!sentenceObject?.tokens) return [];

  const sentenceBlanks = blanks
    .filter((blank) => sentenceObject.index == null || blank.sentenceIndex === sentenceObject.index)
    .sort((left, right) => left.startWord - right.startWord);
  const blankByStartWord = new Map(sentenceBlanks.map((blank) => [blank.startWord, blank]));
  const parts = [];

  for (let tokenIndex = 0; tokenIndex < sentenceObject.tokens.length; tokenIndex += 1) {
    const token = sentenceObject.tokens[tokenIndex];
    const blank = token.type === 'word' ? blankByStartWord.get(token.wordIndex) : null;
    if (!blank) {
      appendTextPart(parts, token.value);
      continue;
    }

    const answerLength = Math.max(4, Math.min(18, blank.answer.replace(/\s/g, '').length));
    parts.push({
      type: 'blank',
      key: blank.id,
      blankId: blank.id,
      blank,
      placeholder: '_'.repeat(answerLength),
      answerLength: blank.answer.length,
    });

    while (tokenIndex + 1 < sentenceObject.tokens.length) {
      const next = sentenceObject.tokens[tokenIndex + 1];
      tokenIndex += 1;
      if (next.type === 'word' && next.wordIndex === blank.endWord) break;
      if (blank.startWord === blank.endWord) {
        tokenIndex -= 1;
        break;
      }
    }
  }
  return parts;
}

function readKeyedAnswer(answers, item, index, idKey) {
  if (answers instanceof Map) return answers.get(item.id) ?? '';
  if (Array.isArray(answers)) {
    const keyed = answers.find((answer) => answer && typeof answer === 'object' && answer[idKey] === item.id);
    if (keyed) return keyed.value ?? keyed.answer ?? keyed.selectedIndex ?? '';
    const positional = answers[index];
    if (positional && typeof positional === 'object') {
      return positional.value ?? positional.answer ?? positional.selectedIndex ?? '';
    }
    return positional ?? '';
  }
  return answers && typeof answers === 'object' ? answers[item.id] ?? '' : '';
}

export function scoreClozeAnswers(lesson, answers = {}) {
  const blanks = Array.isArray(lesson?.blanks) ? lesson.blanks : [];
  const results = blanks.map((blank, index) => {
    const rawAnswer = readKeyedAnswer(answers, blank, index, 'blankId');
    const userAnswer = String(rawAnswer ?? '').trim();
    const normalizedUserAnswer = normalizeListeningAnswer(userAnswer);
    const normalizedExpected = blank.normalizedAnswer || normalizeListeningAnswer(blank.answer);
    return {
      blankId: blank.id,
      sentenceIndex: blank.sentenceIndex,
      answer: blank.answer,
      userAnswer,
      normalizedUserAnswer,
      isCorrect: Boolean(normalizedUserAnswer) && normalizedUserAnswer === normalizedExpected,
    };
  });
  const correct = results.filter((result) => result.isCorrect).length;
  const unanswered = results.filter((result) => !result.normalizedUserAnswer).length;
  const total = results.length;

  return {
    score: correct,
    correct,
    incorrect: Math.max(0, total - correct - unanswered),
    unanswered,
    total,
    percentage: total ? Math.round((correct / total) * 100) : 0,
    results,
  };
}

function scoreQuestionAnswers(lesson, answers = {}) {
  const questions = Array.isArray(lesson?.questions) ? lesson.questions : [];
  const results = questions.map((question, index) => {
    const rawAnswer = readKeyedAnswer(answers, question, index, 'questionId');
    const selectedIndex = rawAnswer === '' || rawAnswer == null ? null : Number(rawAnswer);
    const hasAnswer = Number.isInteger(selectedIndex)
      && selectedIndex >= 0
      && selectedIndex < question.options.length;
    return {
      questionId: question.id,
      selectedIndex: hasAnswer ? selectedIndex : null,
      correctIndex: question.correctIndex,
      isCorrect: hasAnswer && selectedIndex === question.correctIndex,
      explanation: question.explanation,
    };
  });
  const correct = results.filter((result) => result.isCorrect).length;
  const unanswered = results.filter((result) => result.selectedIndex == null).length;
  const total = results.length;
  return {
    score: correct,
    correct,
    incorrect: Math.max(0, total - correct - unanswered),
    unanswered,
    total,
    percentage: total ? Math.round((correct / total) * 100) : 0,
    results,
  };
}

function answersToObject(items, answers, idKey) {
  return Object.fromEntries(items.map((item, index) => [
    item.id,
    readKeyedAnswer(answers, item, index, idKey),
  ]));
}

export function buildAttempt(lesson, answers = {}, questionAnswers = {}) {
  if (!lesson?.id) throw new Error('Không tìm thấy bài luyện nghe để lưu kết quả.');
  const cloze = scoreClozeAnswers(lesson, answers);
  const quiz = scoreQuestionAnswers(lesson, questionAnswers);
  const total = cloze.total + quiz.total;
  const correct = cloze.correct + quiz.correct;
  const unanswered = cloze.unanswered + quiz.unanswered;
  const submittedAt = new Date().toISOString();

  return {
    id: createId(),
    lessonId: lesson.id,
    submittedAt,
    completedAt: submittedAt,
    answers: answersToObject(lesson.blanks || [], answers, 'blankId'),
    questionAnswers: answersToObject(lesson.questions || [], questionAnswers, 'questionId'),
    cloze,
    quiz,
    score: correct,
    correct,
    incorrect: Math.max(0, total - correct - unanswered),
    unanswered,
    total,
    percentage: total ? Math.round((correct / total) * 100) : 0,
  };
}
