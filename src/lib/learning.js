export const REVIEW_RATINGS = {
  again: { label: 'Học lại', short: '< 1 phút' },
  hard: { label: 'Khó', short: '1 ngày' },
  good: { label: 'Tốt', short: '3 ngày' },
  easy: { label: 'Dễ', short: '7 ngày' },
};

export function createInitialProgress() {
  return {
    repetitions: 0,
    interval: 0,
    easeFactor: 2.5,
    correct: 0,
    incorrect: 0,
    streak: 0,
    nextReviewAt: new Date(0).toISOString(),
    lastReviewedAt: null,
    lastRating: null,
    mastered: false,
  };
}

export function reviewWord(current = createInitialProgress(), rating) {
  const progress = { ...createInitialProgress(), ...current };
  const now = new Date();
  let interval = Number(progress.interval) || 0;
  let repetitions = Number(progress.repetitions) || 0;
  let easeFactor = Number(progress.easeFactor) || 2.5;
  let delayMinutes = 0;

  if (rating === 'again') {
    repetitions = 0;
    interval = 0;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    delayMinutes = 10;
  } else if (rating === 'hard') {
    repetitions = Math.max(1, repetitions);
    interval = Math.max(1, Math.round(interval * 1.2) || 1);
    easeFactor = Math.max(1.3, easeFactor - 0.15);
    delayMinutes = interval * 24 * 60;
  } else if (rating === 'easy') {
    repetitions += 1;
    interval = repetitions === 1 ? 4 : Math.max(7, Math.round((interval || 3) * easeFactor * 1.3));
    easeFactor = Math.min(3, easeFactor + 0.15);
    delayMinutes = interval * 24 * 60;
  } else {
    repetitions += 1;
    interval = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.max(4, Math.round(interval * easeFactor));
    delayMinutes = interval * 24 * 60;
  }

  const correct = rating !== 'again';
  return {
    ...progress,
    repetitions,
    interval,
    easeFactor,
    correct: progress.correct + (correct ? 1 : 0),
    incorrect: progress.incorrect + (correct ? 0 : 1),
    streak: correct ? progress.streak + 1 : 0,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: new Date(now.getTime() + delayMinutes * 60_000).toISOString(),
    lastRating: rating,
    mastered: repetitions >= 5 && interval >= 14,
  };
}

export function isDue(progress, now = new Date()) {
  if (!progress?.nextReviewAt) return true;
  return new Date(progress.nextReviewAt) <= now;
}

export function getSetMetrics(set) {
  const words = set?.words || [];
  const states = words.map((word) => set?.progress?.[word.id] || createInitialProgress());
  const due = states.filter((state) => isDue(state)).length;
  const mastered = states.filter((state) => state.mastered).length;
  const learning = states.filter((state) => state.lastReviewedAt && !state.mastered).length;
  const answered = states.reduce((sum, state) => sum + state.correct + state.incorrect, 0);
  const correct = states.reduce((sum, state) => sum + state.correct, 0);
  return {
    total: words.length,
    due,
    mastered,
    learning,
    newWords: Math.max(0, words.length - mastered - learning),
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
  };
}

export function shuffle(items) {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

export function normalizeAnswer(value = '') {
  return value
    .toLocaleLowerCase('en')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

let cachedEnglishVoice = null;
let speechInitialized = false;
let pendingSpeechTimer = null;

function selectFastEnglishVoice(voices) {
  const englishVoices = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('en'));
  return englishVoices.find((voice) => voice.localService && voice.lang.toLowerCase() === 'en-us')
    || englishVoices.find((voice) => voice.localService)
    || englishVoices.find((voice) => voice.lang.toLowerCase() === 'en-us')
    || englishVoices[0]
    || null;
}

export function initializeSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const synthesis = window.speechSynthesis;
  const refreshVoice = () => {
    cachedEnglishVoice = selectFastEnglishVoice(synthesis.getVoices());
  };

  refreshVoice();
  if (!speechInitialized) {
    synthesis.addEventListener('voiceschanged', refreshVoice);
    speechInitialized = true;
  }
  return true;
}

export function speakEnglish(text, rate = 0.96) {
  if (!text || !initializeSpeech()) return false;

  const synthesis = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(String(text).trim());
  utterance.lang = 'en-US';
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  if (cachedEnglishVoice) utterance.voice = cachedEnglishVoice;

  if (pendingSpeechTimer) {
    window.clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = null;
  }

  const play = () => {
    if (synthesis.paused) synthesis.resume();
    synthesis.speak(utterance);
  };

  if (synthesis.speaking || synthesis.pending) {
    synthesis.cancel();
    // Chrome cần một nhịp rất ngắn sau cancel để không làm khựng hàng đợi TTS.
    pendingSpeechTimer = window.setTimeout(play, 12);
  } else {
    play();
  }
  return true;
}

export function speakText(text, lang = 'vi-VN', rate = 0.96) {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const synthesis = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(String(text).trim());
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;

  if (pendingSpeechTimer) {
    window.clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = null;
  }

  const play = () => {
    if (synthesis.paused) synthesis.resume();
    synthesis.speak(utterance);
  };

  if (synthesis.speaking || synthesis.pending) {
    synthesis.cancel();
    pendingSpeechTimer = window.setTimeout(play, 12);
  } else {
    play();
  }
  return true;
}

export function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatRelativeDate(value) {
  if (!value) return 'Chưa học';
  const date = new Date(value);
  const diffDays = Math.round((startOfDay(date) - startOfDay()) / 86_400_000);
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === -1) return 'Hôm qua';
  if (diffDays > 0) return `Sau ${diffDays} ngày`;
  return date.toLocaleDateString('vi-VN');
}
