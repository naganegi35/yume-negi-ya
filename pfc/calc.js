// 自分に合うPFC計算：計算ロジック（出典は 02_App/proposal_pfc_tool.md の「計算式」「出典一覧」）
(function (root) {
  'use strict';

  // 身体活動レベル（低い/ふつう/高い）…日本人の食事摂取基準（2025年版）表4
  var PAL = {
    adult: { low: 1.5, normal: 1.75, high: 2.0 }, // 18〜64歳
    senior: { low: 1.5, normal: 1.7, high: 1.9 }  // 65〜74歳
  };
  var AGE_MIN = 18, AGE_MAX = 74;
  var KCAL_PER_KG_FAT = 7200; // 大雑把な近似（画面で「目安」と明記）
  var STD_DEFAULT = { P: 16, F: 25, C: 59 }; // デザイン上のおすすめ配分（出典ではない）
  var SPORT_DEFAULT_P_PER_KG = 1.6;          // ISSN 1.4〜2.0 の範囲内の選択（デザイン上）
  var SPORT_FAT_PCT = 25;                    // 20〜25%の範囲内

  function palFor(age, level) {
    return (age <= 64 ? PAL.adult : PAL.senior)[level];
  }

  // 標準モードのたんぱく質%範囲（厚労省 報告書p.149）
  function stdRanges(age) {
    var pLow = age <= 49 ? 13 : age <= 64 ? 14 : 15;
    return { P: [pLow, 20], F: [20, 30], C: [50, 65] };
  }

  function validate(i) {
    var e = [];
    if (i.sex !== 'male' && i.sex !== 'female') e.push('性別を選んでください。');
    if (!(i.age >= AGE_MIN && i.age <= AGE_MAX)) e.push('年齢は18〜74歳で入力してください（この範囲の健康な方向けです）。');
    if (!(i.height >= 120 && i.height <= 220)) e.push('身長は120〜220cmで入力してください。');
    if (!(i.weight >= 30 && i.weight <= 200)) e.push('体重は30〜200kgで入力してください。');
    if (!PAL.adult[i.pal]) e.push('活動量を選んでください。');
    if (i.bodyFat != null && !(i.bodyFat >= 3 && i.bodyFat <= 60)) e.push('体脂肪率は3〜60%で入力してください。');
    if (['maintain', 'lose', 'gain'].indexOf(i.goal) < 0) e.push('目的を選んでください。');
    if (i.goal === 'lose' && [1, 2, 3].indexOf(i.losePct) < 0) e.push('減量のペースを選んでください。');
    if (i.goal === 'gain' && [5, 10].indexOf(i.gainPct) < 0) e.push('増量のペースを選んでください。');
    if (i.mode !== 'standard' && i.mode !== 'sport') e.push('モードを選んでください。');
    return e;
  }

  // 基礎代謝（kcal/日）
  function bmr(i) {
    if (i.bodyFat != null) {
      // Katch-McArdle式：370 + 21.6 × 除脂肪体重
      var lbm = i.weight - i.weight * i.bodyFat / 100;
      return { value: 370 + 21.6 * lbm, method: 'katch' };
    }
    // 国立健康・栄養研究所の式（Ganpule et al., 2007）
    var k = i.sex === 'male' ? 0.4235 : 0.9708;
    return {
      value: (0.0481 * i.weight + 0.0234 * i.height - 0.0138 * i.age - k) * 1000 / 4.186,
      method: 'ganpule'
    };
  }

  function round(x, d) { var m = Math.pow(10, d || 0); return Math.round(x * m) / m; }

  function calc(input) {
    var errors = validate(input);
    if (errors.length) return { ok: false, errors: errors };

    var b = bmr(input);
    var palValue = palFor(input.age, input.pal);
    var tdee = b.value * palValue;
    var notes = [];
    var target = tdee, deltaPerDay = 0;

    if (input.goal === 'lose') {
      deltaPerDay = -(input.weight * input.losePct / 100 * KCAL_PER_KG_FAT / 30);
      target = tdee + deltaPerDay;
      if (target < b.value) {
        target = b.value;
        notes.push('floor'); // 基礎代謝を下回らないよう下限に当たった
      }
    } else if (input.goal === 'gain') {
      deltaPerDay = tdee * input.gainPct / 100;
      target = tdee + deltaPerDay;
    }

    var P, F, C, pct, ranges = null, perKg = null;
    if (input.mode === 'standard') {
      ranges = stdRanges(input.age);
      pct = { P: STD_DEFAULT.P, F: STD_DEFAULT.F, C: STD_DEFAULT.C };
      P = target * pct.P / 100 / 4;
      F = target * pct.F / 100 / 9;
      C = target * pct.C / 100 / 4;
    } else {
      P = input.weight * SPORT_DEFAULT_P_PER_KG;
      F = target * SPORT_FAT_PCT / 100 / 9;
      var rest = target - P * 4 - F * 9;
      if (rest < 0) { rest = 0; notes.push('carbZero'); }
      C = rest / 4;
      perKg = { P: [1.4, 2.0], default: SPORT_DEFAULT_P_PER_KG };
      pct = {
        P: P * 4 / target * 100,
        F: F * 9 / target * 100,
        C: C * 4 / target * 100
      };
      if (pct.C < 50) notes.push('carbBelowStd'); // 厚労省の炭水化物範囲(50〜65%)を下回る
    }

    var gramRanges = null;
    if (ranges) {
      gramRanges = {
        P: [target * ranges.P[0] / 100 / 4, target * ranges.P[1] / 100 / 4],
        F: [target * ranges.F[0] / 100 / 9, target * ranges.F[1] / 100 / 9],
        C: [target * ranges.C[0] / 100 / 4, target * ranges.C[1] / 100 / 4]
      };
    } else {
      gramRanges = { P: [input.weight * 1.4, input.weight * 2.0] };
    }

    return {
      ok: true,
      bmr: b.value, bmrMethod: b.method,
      pal: palValue, tdee: tdee,
      deltaPerDay: deltaPerDay, target: target,
      P: P, F: F, C: C, pct: pct,
      stdRanges: ranges, gramRanges: gramRanges, perKg: perKg,
      kcalFromPFC: P * 4 + F * 9 + C * 4,
      notes: notes,
      round: round
    };
  }

  var api = { calc: calc, validate: validate, palFor: palFor, stdRanges: stdRanges, bmr: bmr, round: round };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PFC = api;
})(typeof window !== 'undefined' ? window : this);
