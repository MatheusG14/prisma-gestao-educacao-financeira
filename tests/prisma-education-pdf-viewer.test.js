const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const trailScript = fs.readFileSync(path.join(root, 'js/trilha-educacao.js'), 'utf-8');
const redesignCss = fs.readFileSync(path.join(root, 'css/prisma-redesign.css'), 'utf-8');

test('hidden PDF fallback stays hidden until the viewer fails', () => {
    assert.match(trailScript, /id="trilhaPdfFallback"[^>]*hidden/);
    assert.match(
        redesignCss,
        /\.trilha-pdf-fallback\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/
    );
    assert.match(trailScript, /frame\.addEventListener\('error',\s*\(\)\s*=>\s*mostrarFallback\(frame\.src\)\)/);
});

test('education trail still opens the selected guide PDF', () => {
    assert.match(trailScript, /frame\.src\s*=\s*mod\.arquivo/);
    assert.ok(
        fs.existsSync(path.join(root, 'assets/pdfs/educacao-financeira/06-metas-e-habitos.pdf')),
        'The Metas e Hábitos PDF must be present'
    );
    assert.match(html, /prisma-redesign\.css\?v=20261109-pdf-fallback-hidden-v1/);
});
