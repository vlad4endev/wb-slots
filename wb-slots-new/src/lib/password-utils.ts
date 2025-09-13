export interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isValid: boolean;
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Проверка длины
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('Минимум 8 символов');
  }

  // Проверка наличия строчных букв
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Добавьте строчные буквы');
  }

  // Проверка наличия заглавных букв
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Добавьте заглавные буквы');
  }

  // Проверка наличия цифр
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('Добавьте цифры');
  }

  // Проверка наличия специальных символов
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Добавьте специальные символы');
  }

  // Дополнительные проверки
  if (password.length >= 12) {
    score += 1;
  }

  if (!/(.)\1{2,}/.test(password)) {
    score += 1;
  } else {
    feedback.push('Избегайте повторяющихся символов');
  }

  // Ограничиваем максимальный балл до 4
  score = Math.min(score, 4);

  return {
    score,
    feedback,
    isValid: score >= 3 && password.length >= 8
  };
}

export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'Очень слабый';
    case 2:
      return 'Слабый';
    case 3:
      return 'Средний';
    case 4:
      return 'Сильный';
    default:
      return 'Неизвестно';
  }
}

export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'text-red-600 dark:text-red-400';
    case 2:
      return 'text-orange-600 dark:text-orange-400';
    case 3:
      return 'text-yellow-600 dark:text-yellow-400';
    case 4:
      return 'text-green-600 dark:text-green-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}
