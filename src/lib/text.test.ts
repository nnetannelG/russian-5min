import { describe, expect, it } from 'vitest';
import { checkBuild } from './exercises';
import { countVowels, dayDiff, normalize, similarity, stressSegments, stripStress, tokenize } from './text';

describe('text', () => {
  it('strips stress marks', () => {
    expect(stripStress('приве́т')).toBe('привет');
  });
  it('normalizes punctuation, case, ё and stress', () => {
    expect(normalize('Приве́т! Как дела́?')).toBe('привет как дела');
    expect(normalize('Всё  хорошо́…')).toBe('все хорошо');
    expect(normalize('по-ру́сски — да')).toBe('по-русски да');
  });
  it('tokenizes sentences keeping stress and hyphens', () => {
    expect(tokenize('Я немно́го говорю́ по-ру́сски.')).toEqual(['Я', 'немно́го', 'говорю́', 'по-ру́сски']);
    expect(tokenize('Чай — э́то хорошо́!')).toEqual(['Чай', 'э́то', 'хорошо́']);
  });
  it('scores similarity', () => {
    expect(similarity('Я тебя́ люблю́', 'я тебя люблю')).toBe(1);
    expect(similarity('спаси́бо', 'спасиба')).toBeGreaterThan(0.8);
    expect(similarity('спаси́бо', 'до свидания')).toBeLessThan(0.5);
  });
  it('splits stressed vowels for rendering', () => {
    expect(stressSegments('приве́т')).toEqual([
      { text: 'прив', stressed: false },
      { text: 'е', stressed: true },
      { text: 'т', stressed: false },
    ]);
  });
  it('counts vowels and day gaps', () => {
    expect(countVowels('хорошо́')).toBe(3);
    expect(dayDiff('2026-02-27', '2026-03-01')).toBe(2);
  });
  it('checks built sentences', () => {
    expect(checkBuild(['я', 'тебя́', 'люблю́'], ['Я', 'тебя́', 'люблю́'])).toBe('correct');
    expect(checkBuild(['я', 'люблю́', 'тебя́'], ['Я', 'тебя́', 'люблю́'])).toBe('order');
    expect(checkBuild(['я', 'люблю́', 'чай'], ['Я', 'тебя́', 'люблю́'])).toBe('wrong');
  });
});
