const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const distDir = path.join(__dirname, 'gas_dist');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

// 1. htmlの読み込み
let html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');

// 2. cssのインライン化
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (match, p1) => {
    const cssPath = path.join(srcDir, p1);
    if (fs.existsSync(cssPath)) {
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        return `<style>\n${cssContent}\n</style>`;
    }
    return match;
});

// 3. jsのインライン化
html = html.replace(/<script\s+src="([^"]+)"><\/script>/g, (match, p1) => {
    if (p1.startsWith('http') || p1.startsWith('//')) {
        return match;
    }
    const jsPath = path.join(srcDir, p1);
    if (fs.existsSync(jsPath)) {
        const jsContent = fs.readFileSync(jsPath, 'utf8');
        return `<script>\n${jsContent}\n</script>`;
    }
    return match;
});

// 4. 画像のBase64エンコード
html = html.replace(/<img(.*?)src="([^"]+)"(.*?)>/g, (match, p1, p2, p3) => {
    if (p2.startsWith('http') || p2.startsWith('data:')) {
        return match;
    }
    const imgPath = path.join(srcDir, p2);
    if (fs.existsSync(imgPath)) {
        const base64 = fs.readFileSync(imgPath).toString('base64');
        return `<img${p1}src="data:image/png;base64,${base64}"${p3}>`;
    }
    return match;
});

// 5. 書き出し
fs.writeFileSync(path.join(distDir, 'index.html'), html);
console.log('Build completed: gas_dist/index.html generated.');

// Code.gs の作成
const codeGs = `function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('POWER TRACKER')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}
`;
fs.writeFileSync(path.join(distDir, 'Code.gs'), codeGs);
console.log('Code.gs generated.');

const appsscript = `{
  "timeZone": "Asia/Tokyo",
  "dependencies": {},
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE"
  },
  "exceptionLogging": "STACKDRIVER"
}`;
fs.writeFileSync(path.join(distDir, 'appsscript.json'), appsscript);
console.log('appsscript.json generated.');
