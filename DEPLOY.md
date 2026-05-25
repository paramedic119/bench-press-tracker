# デプロイ手順

## GitHub Pages

`main` への push で自動デプロイ（`.github/workflows/pages.yml`）。
公開 URL: https://paramedic119.github.io/bench-press-tracker/

## Google Apps Script

同じ Web App URL（`AKfycbxf6...`）に新バージョンを上書きデプロイする。

### 初回セットアップ（ローカル PC で1度だけ）

```bash
npm install
npx clasp login            # ブラウザで Google 認証
cp .clasp.json.example .clasp.json
# .clasp.json の scriptId を編集
# scriptId は GAS エディタ URL の /d/<scriptId>/edit から取得
```

### 以降の更新

```bash
npm run deploy:gas
```

`build_gas.js` で `gas_dist/` を生成 → `clasp push` でアップロード →
`package.json` の `config.gasDeploymentId` で指定したデプロイ ID に上書き反映。
