# Nocodb-einvoice

自動匯入台灣電子發票到 NocoDB

## Env

- `NOCODB_URL`: NocoDB 的 URL
- `NOCODB_API_KEY`: NocoDB 的 API Key
- `NOCODB_BASE_ID`: NocoDB 的 Base ID （可以在瀏覽器的網址列中找到）
- `EINVOICE_USERNAME`: 電子發票的帳號（電話號碼）
- `EINVOICE_PASSWORD`: 電子發票的密碼（又稱驗證碼）
- `CRON_SCHEDULE`: 定時任務的時間設定，可參考 [Cron](https://crontab.guru/) 了解如何設定

## 開始使用

- 建立 API Key
- 建立 Base
- Docker
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
- 程式將自動建立相關資料表，請勿修改資料表名稱
