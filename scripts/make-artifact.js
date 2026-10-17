// オフライン専用の単一 HTML（claude.ai アーティファクト用）を生成する
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('dist-artifact');
const assets = fs.readdirSync(path.join(dir, 'assets'));
const js = assets.filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dir, 'assets', f), 'utf8')).join('\n');
const css = assets.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(dir, 'assets', f), 'utf8')).join('\n');
const safeJs = js.replace(/<\/script/gi, '<\\/script');
const safeCss = css.replace(/<\/style/gi, '<\\/style');
const html = `<title>RAIDER BATTLE</title>
<meta name="description" content="アイテムを漁って持ち帰るブラウザ3D脱出シューター（オールNPC版）">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Rajdhani:wght@500;600;700&display=swap">
<style>
:root { color-scheme: dark; }
${safeCss}
</style>
<script>
// 起動・実行中のエラーを画面に出す（真っ黒な画面のままにしない）
(function () {
  var seen = {}, n = 0;
  function show(m) {
    m = String(m && m.message ? m.message + (m.stack ? '\\n' + String(m.stack).split('\\n').slice(0, 3).join('\\n') : '') : m);
    if (seen[m] || n >= 3) return; seen[m] = 1; n++;
    var d = document.getElementById('rb-err');
    if (!d) {
      d = document.createElement('div'); d.id = 'rb-err';
      d.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:99999;background:#2a1414;border:1px solid #a33;color:#fdd;font:12px/1.5 monospace;padding:10px;white-space:pre-wrap;max-height:45vh;overflow:auto';
      var b = document.createElement('button'); b.textContent = '再読み込み'; b.style.cssText = 'float:right;margin-left:8px;padding:6px 10px';
      b.onclick = function () { location.reload(); };
      var c = document.createElement('button'); c.textContent = '閉じる'; c.style.cssText = 'float:right;margin-left:8px;padding:6px 10px';
      c.onclick = function () { d.remove(); };
      d.appendChild(b); d.appendChild(c);
      d.appendChild(document.createTextNode('エラーが起きました。この画面のスクリーンショットを送ってください。\\n'));
      document.body.appendChild(d);
    }
    d.appendChild(document.createTextNode('\\n' + m + '\\n'));
  }
  window.__rbError = show;
  addEventListener('error', function (e) { if (e.message) show(e.message + (e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ':' + e.colno + ')' : '')); });
  addEventListener('unhandledrejection', function (e) { var r = e.reason; if (r && (r.name === 'NotAllowedError' || r.name === 'AbortError')) return; show(r); });
})();
</script>
<div id="app"></div>
<script type="module">
${safeJs}
</script>
`;
fs.writeFileSync(path.join(dir, 'raider-battle.html'), html);
console.log('wrote', path.join(dir, 'raider-battle.html'), (html.length / 1024).toFixed(0) + ' KB');
