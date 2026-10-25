import { LawVariable, LessonLaw } from '../types';

// Tiny safe formula engine (no eval): numbers, variables, + - * / ^, parentheses and a few functions.
type Scope = Record<string, number>;
type Fn = (s: Scope) => number;

const DEG = Math.PI / 180;
const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sind: x => Math.sin(x * DEG), cosd: x => Math.cos(x * DEG), tand: x => Math.tan(x * DEG),
  ln: Math.log, log: Math.log10, exp: Math.exp
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function normalize(src: string): string {
  return src
    .replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/\*\*/g, '^')
    .replace(/\s+/g, '');
}

interface Compiled { fn: Fn; vars: string[] }

export function compileExpression(src: string): Compiled {
  const text = normalize(src);
  if (!text) throw new Error('اكتب الصيغة.');
  const toks: string[] = text.match(/\d+(?:\.\d+)?|[\p{L}_][\p{L}\p{N}_]*|[-+*/^()]|./gu) || [];
  let pos = 0;
  const vars: string[] = [];

  const peek = () => toks[pos];
  const next = () => toks[pos++];

  const atom = (): Fn => {
    const t = next();
    if (t === undefined) throw new Error('الصيغة غير مكتملة.');
    if (/^\d/.test(t)) { const v = parseFloat(t); return () => v; }
    if (t === '(') {
      const f = expr();
      if (next() !== ')') throw new Error('قوس غير مغلق.');
      return f;
    }
    if (/^[\p{L}_]/u.test(t)) {
      const lower = t.toLowerCase();
      if (peek() === '(') {
        const fnc = FUNCS[lower];
        if (!fnc) throw new Error(`الدالة "${t}" غير مدعومة.`);
        next();
        const inner = expr();
        if (next() !== ')') throw new Error('قوس غير مغلق.');
        return s => fnc(inner(s));
      }
      if (lower in CONSTS && !(t in CONSTS && false)) {
        const c = CONSTS[lower];
        return () => c;
      }
      if (!vars.includes(t)) vars.push(t);
      return s => s[t];
    }
    throw new Error(`رمز غير مفهوم: ${t}`);
  };

  const power = (): Fn => {
    const base = atom();
    if (peek() === '^') {
      next();
      const exp = unary();
      return s => Math.pow(base(s), exp(s));
    }
    return base;
  };

  const unary = (): Fn => {
    if (peek() === '-') { next(); const f = unary(); return s => -f(s); }
    if (peek() === '+') { next(); return unary(); }
    return power();
  };

  const term = (): Fn => {
    let left = unary();
    while (peek() === '*' || peek() === '/') {
      const op = next();
      const right = unary();
      const l = left;
      left = op === '*' ? s => l(s) * right(s) : s => l(s) / right(s);
    }
    return left;
  };

  const expr = (): Fn => {
    let left = term();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const right = term();
      const l = left;
      left = op === '+' ? s => l(s) + right(s) : s => l(s) - right(s);
    }
    return left;
  };

  const fn = expr();
  if (pos < toks.length) throw new Error(`رمز غير متوقع: ${toks[pos]}`);
  return { fn, vars };
}

export interface ParsedFormula { result: string; vars: string[]; fn: Fn }

export function parseFormula(formula: string): ParsedFormula {
  const parts = formula.split('=');
  if (parts.length > 2) throw new Error('استخدم علامة = مرة واحدة فقط.');
  const rhs = parts.length === 2 ? parts[1] : parts[0];
  const lhs = parts.length === 2 ? normalize(parts[0]) : 'y';
  if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(lhs)) throw new Error('الطرف الأيمن من القانون لازم يكون رمز واحد (مثال: V).');
  const c = compileExpression(rhs);
  if (c.vars.length === 0) throw new Error('القانون لازم يحتوي على متغير واحد على الأقل.');
  return { result: lhs, vars: c.vars, fn: c.fn };
}

export function lawError(law: LessonLaw): string | null {
  try { parseFormula(law.formula); return null; } catch (e: any) { return e?.message || 'صيغة غير صحيحة.'; }
}

export const isLawValid = (law: LessonLaw) => lawError(law) === null && law.variables.length > 0;

export function defaultVariable(symbol: string): LawVariable {
  return { symbol, name: '', unit: '', min: 1, max: 100, step: 1, value: 10 };
}

export function syncVariables(formula: string, existing: LawVariable[]): LawVariable[] {
  try {
    const p = parseFormula(formula);
    return p.vars.map(v => existing.find(x => x.symbol === v) || defaultVariable(v));
  } catch {
    return existing;
  }
}

export function evalLaw(law: LessonLaw, values: Record<string, number>): number {
  try {
    const p = parseFormula(law.formula);
    return p.fn(values);
  } catch { return NaN; }
}

export const fmtNum = (n: number) => (Number.isFinite(n) ? String(Number(n.toPrecision(6))) : '—');
