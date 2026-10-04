(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var form = $('form');
  var last = null; // 直近の計算結果と条件

  // 食材の翻訳に出す食材と量（量は目安として仮置き。1個・1杯などのグラムは foods.js の unitG）
  var SHOW = {
    P: [
      { name: '鶏むね肉（皮なし）', show: '鶏むね肉', grams: 150, text: '150g（生）' },
      { name: '卵（全卵）', show: '卵', count: 2 },
      { name: '納豆', show: '納豆', count: 1 },
      { name: '牛乳', show: '牛乳', count: 1 }
    ],
    F: [
      { name: 'アボカド', show: 'アボカド', count: 1 },
      { name: 'アーモンド', show: 'アーモンド', grams: 20, text: '20g' },
      { name: 'オリーブ油', show: 'オリーブ油', count: 1 },
      { name: 'チーズ（プロセス）', show: 'プロセスチーズ', grams: 20, text: '20g' }
    ],
    C: [
      { name: 'ご飯（白米）', show: 'ご飯', count: 1 },
      { name: '食パン', show: '食パン', count: 1 },
      { name: 'うどん（ゆで）', show: 'うどん', count: 1 },
      { name: 'バナナ', show: 'バナナ', count: 1 }
    ]
  };
  var GROUP_LABEL = {
    P: ['たんぱく質をとるなら、たとえば', 'P', 'p'],
    F: ['脂質をとるなら、たとえば', 'F', 'f'],
    C: ['炭水化物をとるなら、たとえば', 'C', 'c']
  };

  function food(name) {
    for (var i = 0; i < FOODS.length; i++) if (FOODS[i].name === name) return FOODS[i];
    return null;
  }
  function fmt(n) { return Math.round(n).toLocaleString('ja-JP'); }
  function r10(n) { return Math.round(n / 10) * 10; }
  function val(id) { var v = $(id).value.trim(); return v === '' ? null : Number(v); }
  function radio(name) { var e = form.querySelector('input[name="' + name + '"]:checked'); return e ? e.value : null; }

  function readInput() {
    var goal = radio('goal');
    return {
      sex: radio('sex'),
      age: val('age'), height: val('height'), weight: val('weight'),
      pal: radio('pal'),
      bodyFat: val('bodyfat'),
      goal: goal,
      losePct: goal === 'lose' ? Number(radio('losePct')) : null,
      gainPct: goal === 'gain' ? Number(radio('gainPct')) : null,
      mode: radio('mode')
    };
  }

  function amountOf(item, f) {
    if (item.grams != null) return { g: item.grams, label: item.show + ' ' + item.text };
    var g = f.unitG * item.count;
    var label = item.count === 1 ? item.show + ' ' + f.unit : item.show + ' ' + item.count + f.unit.replace(/^1/, '');
    return { g: g, label: label };
  }

  function render(res, input) {
    var goalText = input.goal === 'lose' ? '減量（1か月で体重の' + input.losePct + '%）'
      : input.goal === 'gain' ? '増量（' + (input.gainPct === 5 ? 'ゆっくり+5%' : 'しっかり+10%') + '）' : '維持';
    var modeText = input.mode === 'standard' ? '標準モード' : '運動モード';
    last = { res: res, goalText: goalText, modeText: modeText };

    $('r-target').textContent = '約 ' + fmt(r10(res.target)) + ' kcal';
    var delta = res.deltaPerDay === 0 ? '' : '（消費カロリーより1日 ' + (res.deltaPerDay > 0 ? '+' : '−') + fmt(Math.abs(res.deltaPerDay)) + ' kcal）';
    $('r-sub').textContent = '消費カロリー 約' + fmt(r10(res.tdee)) + ' kcal ／ 基礎代謝 約' + fmt(r10(res.bmr)) + ' kcal ' + delta;

    var notes = [];
    if (res.notes.indexOf('floor') >= 0) notes.push('計算上の目標が基礎代謝を下回るため、基礎代謝の値を下限にしています。ペースを下げることも検討してください。');
    if (res.notes.indexOf('carbZero') >= 0) notes.push('たんぱく質と脂質だけで目標カロリーに達するため、炭水化物を0gとしています。');
    if (res.notes.indexOf('carbBelowStd') >= 0) notes.push('炭水化物の割合が、標準モードの範囲（50〜65%）を下回っています。');
    var nEl = $('r-notes');
    nEl.hidden = notes.length === 0;
    nEl.textContent = notes.join(' ');

    var bars = $('r-bars');
    bars.innerHTML = '';
    [['P', 'var(--p)'], ['F', 'var(--f)'], ['C', 'var(--c)']].forEach(function (k) {
      var b = document.createElement('span');
      b.className = 'bar';
      b.style.flex = String(Math.max(res.pct[k[0]], 1));
      b.style.background = k[1];
      bars.appendChild(b);
    });
    var names = { P: 'たんぱく質 P', F: '脂質 F', C: '炭水化物 C' };
    $('r-pfc').innerHTML = ['P', 'F', 'C'].map(function (k) {
      return '<div><div class="sm">' + names[k] + '</div><div class="v">' + fmt(res[k]) + ' g</div><div class="sm">' + Math.round(res.pct[k]) + '%</div></div>';
    }).join('');

    var gr = res.gramRanges;
    if (input.mode === 'standard') {
      var s = res.stdRanges;
      $('r-range').textContent = '厚生労働省の範囲：たんぱく質 ' + s.P[0] + '〜' + s.P[1] + '%（約' + fmt(gr.P[0]) + '〜' + fmt(gr.P[1]) + 'g）／脂質 ' + s.F[0] + '〜' + s.F[1] + '%（約' + fmt(gr.F[0]) + '〜' + fmt(gr.F[1]) + 'g）／炭水化物 ' + s.C[0] + '〜' + s.C[1] + '%（約' + fmt(gr.C[0]) + '〜' + fmt(gr.C[1]) + 'g）。上の値は、この範囲内のおすすめ配分（P16%・F25%・C59%）です。';
    } else {
      $('r-range').textContent = '運動モード：たんぱく質は体重×1.6g。目安の範囲は1.4〜2.0g／kg（約' + fmt(gr.P[0]) + '〜' + fmt(gr.P[1]) + 'g）。脂質は目標カロリーの25%、炭水化物は残りです。厚生労働省の範囲とは異なります。';
    }

    var html = '';
    ['P', 'F', 'C'].forEach(function (g) {
      var meta = GROUP_LABEL[g];
      html += '<div class="food-h">' + meta[0] + '</div>';
      SHOW[g].forEach(function (item) {
        var f = food(item.name);
        if (!f) return;
        var a = amountOf(item, f);
        html += '<div class="food-row"><span>' + a.label + '</span><span>' + meta[1] + ' 約' + Math.round(f[meta[2]] * a.g / 100) + 'g</span></div>';
      });
    });
    html += '<p class="hint">量は目安です。食材の数値は日本食品標準成分表（八訂）増補2023年から引用しています。</p>';
    $('r-foods').innerHTML = html;

    $('result').hidden = false;
  }

  function showErrors(list) {
    var el = $('errors');
    if (!list.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = list.map(function (t) { return '<p>' + t + '</p>'; }).join('');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = readInput();
    var res = PFC.calc(input);
    if (!res.ok) { showErrors(res.errors); $('result').hidden = true; return; }
    showErrors([]);
    render(res, input);
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // 目的・モードの切り替え表示
  function syncGoal() {
    var g = radio('goal');
    $('pace-lose').hidden = g !== 'lose';
    $('pace-gain').hidden = g !== 'gain';
  }
  function syncMode() {
    $('mode-hint').textContent = radio('mode') === 'standard'
      ? '標準：厚生労働省「日本人の食事摂取基準（2025年版）」の範囲で出します。'
      : '運動している：たんぱく質を体重1kgあたり1.6gで出します。厚生労働省の範囲ではなく、運動をしている人向けの目安です。';
  }
  form.addEventListener('change', function () { syncGoal(); syncMode(); });
  syncGoal(); syncMode();

  // 画像で保存（個人の身長・体重・年齢は画像に入れない）
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawImage() {
    var cv = $('cv'), ctx = cv.getContext('2d'), r = last.res;
    var font = "'Yomogi','Hiragino Maru Gothic ProN','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif";
    ctx.clearRect(0, 0, 1080, 1350);
    ctx.fillStyle = '#EDE5DF'; ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = '#fff'; roundRect(ctx, 60, 60, 960, 1260, 48); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = '#4F4A47';
    ctx.font = '56px ' + font; ctx.fillText('自分に合うPFC計算', 540, 170);
    ctx.fillStyle = '#6B6460'; ctx.font = '36px ' + font;
    ctx.fillText(last.goalText + '・' + last.modeText, 540, 240);
    ctx.fillStyle = '#F6F1ED'; roundRect(ctx, 120, 290, 840, 260, 40); ctx.fill();
    ctx.fillStyle = '#6B6460'; ctx.font = '34px ' + font; ctx.fillText('1日の目標カロリー', 540, 350);
    ctx.fillStyle = '#4F4A47'; ctx.font = '110px ' + font; ctx.fillText('約 ' + fmt(r10(r.target)) + ' kcal', 540, 470);
    ctx.fillStyle = '#6B6460'; ctx.font = '30px ' + font;
    ctx.fillText('消費カロリー 約' + fmt(r10(r.tdee)) + ' kcal／基礎代謝 約' + fmt(r10(r.bmr)) + ' kcal', 540, 525);
    var total = r.pct.P + r.pct.F + r.pct.C, x = 120, W = 840;
    [['P', '#D98C8C'], ['F', '#E3C27A'], ['C', '#8FB5A4']].forEach(function (k) {
      var w = W * r.pct[k[0]] / total;
      ctx.fillStyle = k[1]; roundRect(ctx, x + 3, 600, Math.max(w - 6, 6), 28, 14); ctx.fill();
      x += w;
    });
    var cols = [['たんぱく質 P', 'P', 240], ['脂質 F', 'F', 540], ['炭水化物 C', 'C', 840]];
    cols.forEach(function (c) {
      ctx.fillStyle = '#6B6460'; ctx.font = '34px ' + font; ctx.fillText(c[0], c[2], 710);
      ctx.fillStyle = '#4F4A47'; ctx.font = '84px ' + font; ctx.fillText(fmt(r[c[1]]) + ' g', c[2], 810);
      ctx.fillStyle = '#6B6460'; ctx.font = '32px ' + font; ctx.fillText(Math.round(r.pct[c[1]]) + '%', c[2], 860);
    });
    ctx.fillStyle = '#4F4A47'; ctx.font = '34px ' + font; ctx.textAlign = 'left';
    ctx.fillText('たとえば（たんぱく質）', 120, 960);
    var y = 1020;
    SHOW.P.forEach(function (item) {
      var f = food(item.name); if (!f) return;
      var a = amountOf(item, f);
      ctx.fillStyle = '#4F4A47'; ctx.font = '34px ' + font; ctx.textAlign = 'left'; ctx.fillText(a.label, 120, y);
      ctx.textAlign = 'right'; ctx.fillText('P 約' + Math.round(f.p * a.g / 100) + 'g', 960, y);
      y += 56;
    });
    ctx.textAlign = 'center'; ctx.fillStyle = '#6B6460'; ctx.font = '26px ' + font;
    ctx.fillText('※目安です。医療アドバイスではありません。', 540, 1250);
    ctx.font = '22px ' + font;
    ctx.fillText('出典：日本食品標準成分表（八訂）増補2023年／日本人の食事摂取基準（2025年版）ほか', 540, 1280);
  }
  $('save').addEventListener('click', function () {
    if (!last) return;
    var load = (document.fonts && document.fonts.load) ? document.fonts.load("32px 'Yomogi'") : Promise.resolve();
    load.catch(function () {}).then(function () {
      drawImage();
      $('cv').toBlob(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'pfc-result.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      }, 'image/png');
    });
  });
})();
