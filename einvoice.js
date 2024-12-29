import "dotenv/config";
import { setTimeout } from "node:timers/promises";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { classifyImage } from "./ocr.js";
import { createInvoice, isInvoiceExists } from "./db.js";
const MAX_CAPTCHA_RETRY = 10;
puppeteer.use(StealthPlugin());
function log(...args) {
  console.log(new Date().toLocaleTimeString(), `[發票]`, ...args);
}
export async function syncEinvoice() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD === "true"
        ? "/usr/bin/google-chrome"
        : "",
  });
  const page = await browser.newPage();

  await page.goto(
    "https://service-mc.einvoice.nat.gov.tw/act/login/api/proxy/login"
  );
  let captchaRetry = 0;
  while (captchaRetry < MAX_CAPTCHA_RETRY) {
    await page.waitForNetworkIdle();
    const captchaChallenge = await page.evaluate(() => {
      const img = document.querySelector("img[src^='data:image/png;base64']");
      return img.src;
    });
    const code = await classifyImage(
      Buffer.from(captchaChallenge.split(",")[1], "base64")
    );
    if (code.match(/^\d{5}$/) && code.trim().length === 5) {
      log(`測試驗證碼：${code}`);
      await page.type("#captcha", code);
      await page.type("#mobile_phone", process.env.EINVOICE_USERNAME);
      await page.type("#password", process.env.EINVOICE_PASSWORD);
      await page.click("button[type='submit']");
      await page.waitForNetworkIdle();
      const toastMessage = await page.evaluate(() => {
        return document.querySelector(".toast_box .toast-body")?.innerText;
      });
      if (
        toastMessage &&
        !toastMessage.includes("驗證碼（密碼）逾180天未變更")
      ) {
        if (toastMessage.includes("圖形驗證碼驗證失敗")) {
          console.log(`retrying captcha`);
        }
        if (toastMessage.includes("使用者帳號或密碼錯誤")) {
          throw new Error("invalid username or password");
        }
      } else {
        log("登入成功");
        await page.waitForNetworkIdle();
        break;
      }
      captchaRetry++;
    }
    await page.click('button[aria-label="更新圖形驗證碼"]');
    await page.waitForNetworkIdle();
  }
  if (captchaRetry === MAX_CAPTCHA_RETRY) {
    throw new Error("已達到最大驗證碼嘗試次數，不建議繼續");
  }

  const date = new Date();
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1;
  const maxMonth = currentMonth % 2 === 0 ? 8 : 9;
  const checkList = [];
  for (let i = 0; i < maxMonth; i++) {
    if (currentMonth - i <= 0) {
      checkList.push({
        year: currentYear - 1,
        month: currentMonth - i + 12,
      });
    } else {
      checkList.push({
        year: currentYear,
        month: currentMonth - i,
      });
    }
  }
  for (const { year, month } of checkList) {
    log(`- 正在取得 ${year} 年 ${month} 月發票`);
    await page.goto(
      `https://www.einvoice.nat.gov.tw/portal/btc/mobile/btc502w`
    );
    await page.waitForNetworkIdle();
    await page.waitForSelector(`[name="searchInvoiceDate"]`);
    await page.tap(`[name="searchInvoiceDate"]`);
    await setTimeout(100);

    await page.waitForSelector(`[aria-label="月份設定"]`);
    await page.tap(`[aria-label="月份設定"]`);
    await setTimeout(100);

    await page.tap(`[data-test="${month}月"]`);
    await setTimeout(100);

    await page.tap(`[aria-label="年份設定"]`);
    await setTimeout(100);

    await page.tap(`[data-test="${year}"]`);
    await setTimeout(100);

    const lastDay =
      currentMonth === month && currentYear === year
        ? date.getDate()
        : new Date(year, month, 0).getDate();

    await page.tap(`[id="${year}-${month.toString().padStart(2, "0")}-01"]`);
    await page.tap(
      `[id="${year}-${month.toString().padStart(2, "0")}-${lastDay
        .toString()
        .padStart(2, "0")}"]`
    );

    await page.click(`[aria-label="查詢"]`);
    await page.waitForNetworkIdle();
    await setTimeout(100);

    // change SelectSizes select to 100
    // await page.select(`#SelectSizes`, "100");
    // await setTimeout(100);
    // await page.click(`#SelectSizes+button`);

    const pages = await page.evaluate(() => {
      return [
        ...document.querySelectorAll(
          `.pagination .pagination :nth-child(11) select#SelectPages option:not([value=""])`
        ),
      ].map((el) => el.value);
    });
    for (const currentPage of pages) {
      log(`- 正在取得第 ${parseInt(currentPage) + 1}/${pages.length} 頁發票`);
      await page.select(`#SelectPages`, currentPage.toString());
      await page.click(`#SelectPages+button`);

      const invoices = await page
        .waitForResponse(
          (resp) =>
            resp
              .url()
              .startsWith(
                `https://service-mc.einvoice.nat.gov.tw/btc/cloud/api/btc502w/searchCarrierInvoice`
              ) &&
            resp.status() === 200 &&
            resp.request().method() === "POST"
        )
        .then((resp) => resp.json());

      for (let item of invoices.content) {
        if (await isInvoiceExists(item.invoiceNumber)) {
          log(`- 發票 ${item.invoiceNumber} 已存在`);
          continue;
        }
        const invoiceData = await fetch(
          "https://service-mc.einvoice.nat.gov.tw/btc/cloud/api/common/getCarrierInvoiceData",
          {
            referrerPolicy: "no-referrer-when-downgrade",
            body: JSON.stringify(item.token),
            method: "POST",
          }
        ).then((response) => response.json());
        const invoiceDetail = await fetch(
          "https://service-mc.einvoice.nat.gov.tw/btc/cloud/api/common/getCarrierInvoiceDetail?page=0&size=100",
          {
            referrerPolicy: "no-referrer-when-downgrade",
            body: JSON.stringify(item.token),
            method: "POST",
          }
        )
          .then((response) => response.json())
          .then((data) => data.content);
        await createInvoice(item.invoiceNumber, invoiceData, invoiceDetail);
        log(`+ 已新增發票 ${item.invoiceNumber}`);
      }

      await page.waitForNetworkIdle();
      await setTimeout(100);
    }

    await setTimeout(500);
  }
  await browser.close();
}
