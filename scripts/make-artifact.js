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
<div id="app"></div>
<script type="module">
${safeJs}
</script>
`;
fs.writeFileSync(path.join(dir, 'raider-battle.html'), html);
console.log('wrote', path.join(dir, 'raider-battle.html'), (html.length / 1024).toFixed(0) + ' KB');
