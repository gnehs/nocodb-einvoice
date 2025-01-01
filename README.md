<img width="960"   src="https://github.com/user-attachments/assets/7146aa39-1938-4c05-955f-4b021b3e90b7" />

# NocoDB einvoice

自動匯入台灣電子發票到 NocoDB

## 環境變數

### 必填

- `NOCODB_URL`: NocoDB 的 URL
- `NOCODB_API_KEY`: NocoDB 的 API Key
- `NOCODB_BASE_ID`: NocoDB 的 Base ID （可以在瀏覽器的網址列中找到）
- `EINVOICE_USERNAME`: 電子發票的帳號（電話號碼）
- `EINVOICE_PASSWORD`: 電子發票的密碼（又稱驗證碼）

### 選填

- `CRON_SCHEDULE`
  - 預設值：`0 3 * * *`，每天凌晨 3 點執行
  - 可參考 [crontab.guru](https://crontab.guru/) 了解如何設定
- `MAX_SYNC_MONTHS`
  - 預設值：無限制
  - 同步的最大月份，預設同步可查詢到的全部發票，建議在首次同步後設定此值為 `3`，以避免同步過多資料造成電子發票系統的負擔
- `REQUEST_DELAY`
  - 預設值：`1000` 毫秒，即 1 秒
  - 每個請求之間的延遲（毫秒），避免造成電子發票系統的負擔

## 開始使用

- [安裝 NocoDB](https://docs.nocodb.com/category/installation)
- 建立 API Key
- 建立 Base

### 在 Docker 上部署

```bash
docker run -d --name nocodb-einvoice \
  -e NOCODB_URL=https://<HOST>:<PORT> \
  -e NOCODB_API_KEY=your-api-key \
  -e NOCODB_BASE_ID=your-base-id \
  -e EINVOICE_USERNAME=your-username \
  -e EINVOICE_PASSWORD=your-password \
  -e CRON_SCHEDULE="0 3 * * *" \
  ghcr.io/gnehs/nocodb-einvoice:latest
```

> 程式將自動建立相關資料表，請勿修改資料表與欄位名稱

### 在本機上部署

- 參考上述說明或 `.env.example` 建立 `.env` 檔案

```bash
pnpm install
pnpm start
```

## 特別感謝

`NocoDB einvoice` 參考或使用了以下套件：

- [ddddocr](https://github.com/sml2h3/ddddocr)、 [ddddocr Node.js 版](https://www.npmjs.com/package/ddddocr)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [jimp](https://www.npmjs.com/package/jimp)
- [NocoDB](https://github.com/nocodb/nocodb)
- [Node.js](https://nodejs.org/)
- [node-cron](https://www.npmjs.com/package/node-cron)
- [node-fetch-cookies](https://www.npmjs.com/package/node-fetch-cookies)
- [onnxruntime-node](https://www.npmjs.com/package/onnxruntime-node)
