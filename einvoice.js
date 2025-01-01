import "dotenv/config";
import { fetch, CookieJar } from "node-fetch-cookies";
import { classifyImage } from "./ocr.js";
import { createInvoice, isInvoiceExists } from "./db.js";
function log(...args) {
  console.log(new Date().toLocaleTimeString(), `[發票]`, ...args);
}
const MAX_CAPTCHA_RETRY = 10;
let cookieJar = new CookieJar();
const headers = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
};

async function login() {
  let CAPTCHA_RETRY = 0;
  let code;

  const { url } = await fetch(
    cookieJar,
    `https://service-mc.einvoice.nat.gov.tw/act/login/api/proxy/login`,
    {
      redirect: "follow",
      follow: 2,
    }
  );
  const loginChallenge = url.split("?login_challenge=")[1];
  while (CAPTCHA_RETRY < MAX_CAPTCHA_RETRY) {
    const { token, image } = await fetch(
      cookieJar,
      "https://service-mc.einvoice.nat.gov.tw/act/login/api/act002i/captcha"
    ).then((x) => x.json());
    code = await classifyImage(Buffer.from(image, "base64"));
    if (code.match(/^\d{5}$/) && code.trim().length === 5) {
      log(`測試驗證碼：${code}`);

      const loginResponse = await fetch(
        cookieJar,
        "https://service-mc.einvoice.nat.gov.tw/act/login/api/client/doLogin",
        {
          headers,
          referrer: `https://www.einvoice.nat.gov.tw/accounts/login/mw?login_challenge=${loginChallenge}`,
          referrerPolicy: "no-referrer-when-downgrade",
          body: JSON.stringify({
            loginType: "U",
            userType: "MW",
            loginChallenge,
            captchaToken: token,
            captcha: code,
            customId: process.env.EINVOICE_USERNAME,
            password: process.env.EINVOICE_PASSWORD,
          }),
          method: "POST",
          mode: "cors",
          credentials: "include",
        }
      ).then((x) => x.json());
      if (
        loginResponse?.title?.startsWith(
          "The username or password is incorrect"
        )
      ) {
        throw new Error("The username or password is incorrect");
      }
      if (
        loginResponse.title !==
          "Image verification code verification failed." &&
        loginResponse?.redirectTo
      ) {
        await fetch(cookieJar, loginResponse?.redirectTo, {
          headers,
          referrer: `https://www.einvoice.nat.gov.tw/accounts/login/mw?login_challenge=${loginChallenge}`,
          referrerPolicy: "no-referrer-when-downgrade",
        });
        log("登入成功");
        break;
      }
      log("測試新的驗證碼");
      CAPTCHA_RETRY++;
    }
  }
  if (CAPTCHA_RETRY >= MAX_CAPTCHA_RETRY) {
    throw new Error("已達到最大驗證碼嘗試次數，不建議繼續");
  }
}
async function syncMonthEinvoice(year, month) {
  let sid = [...cookieJar.cookiesDomain("service-mc.einvoice.nat.gov.tw")].find(
    (cookie) => cookie.name === "sid"
  ).value;

  const date = new Date();
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const searchStartDate = `${year}-${month
    .toString()
    .padStart(2, "0")}-01T00:00:00.000Z`;
  const searchEndDate =
    currentMonth === month && currentYear === year
      ? new Date().toISOString()
      : `${year}-${month.toString().padStart(2, "0")}-${lastDay}T00:00:00.000Z`;
  const token = await fetch(
    cookieJar,
    "https://service-mc.einvoice.nat.gov.tw/btc/cloud/api/btc502w/getSearchCarrierInvoiceListJWT",
    {
      headers: {
        ...headers,
        Authorization: `Bearer ${sid}`,
      },
      referrer:
        "https://www.einvoice.nat.gov.tw/portal/btc/mobile/btc502w/search",
      referrerPolicy: "no-referrer-when-downgrade",
      body: JSON.stringify({
        cardCode: "",
        carrierId2: "",
        searchStartDate,
        searchEndDate,
        invoiceStatus: "all",
        isSearchAll: "true",
      }),
      method: "POST",
    }
  ).then((x) => x.text());
  let totalPages = 0;
  let currentPage = 0;
  do {
    const searchCarrierInvoice = await fetch(
      cookieJar,
      `https://service-mc.einvoice.nat.gov.tw/btc/cloud/api/btc502w/searchCarrierInvoice?page=${currentPage}&size=100`,
      {
        headers: {
          ...headers,
          Authorization: `Bearer ${sid}`,
        },
        referrer:
          "https://www.einvoice.nat.gov.tw/portal/btc/mobile/btc502w/detail",
        referrerPolicy: "no-referrer-when-downgrade",
        body: JSON.stringify({ token }),
        method: "POST",
      }
    ).then((x) => x.json());
    if (
      searchCarrierInvoice.title === "Session has expired, please try again."
    ) {
      throw new Error("Session has expired, please try again.");
    }

    totalPages = searchCarrierInvoice.totalPages;

    log(`- 正在取得第 ${currentPage + 1}/${totalPages} 頁發票`);
    for (let item of searchCarrierInvoice.content) {
      if (await isInvoiceExists(item.invoiceNumber)) {
        log(`- 發票 ${item.invoiceNumber} 已存在`);
        continue;
      }
      const invoiceData = await fetch(
        cookieJar,
        "https://service-mc.einvoice.nat.gov.tw/btc/cloud/api/common/getCarrierInvoiceData",
        {
          headers: {
            ...headers,
            Authorization: `Bearer ${sid}`,
          },
          referrer:
            "https://www.einvoice.nat.gov.tw/portal/btc/mobile/btc502w/detail",
          referrerPolicy: "no-referrer-when-downgrade",
          body: JSON.stringify(item.token),
          method: "POST",
          mode: "cors",
          credentials: "include",
        }
      ).then((x) => x.json());
      const invoiceDetail = await fetch(
        cookieJar,
        "https://service-mc.einvoice.nat.gov.tw/btc/cloud/api/common/getCarrierInvoiceDetail?page=0&size=10",
        {
          headers: {
            ...headers,
            Authorization: `Bearer ${sid}`,
          },
          referrer:
            "https://www.einvoice.nat.gov.tw/portal/btc/mobile/btc502w/detail",
          referrerPolicy: "no-referrer-when-downgrade",
          body: JSON.stringify(item.token),
          method: "POST",
          mode: "cors",
          credentials: "include",
        }
      ).then((x) => x.json());
      await createInvoice(
        item.invoiceNumber,
        invoiceData,
        invoiceDetail.content
      );
      log(`- 發票 ${item.invoiceNumber} 新增成功`);
    }
    currentPage++;
  } while (currentPage + 1 < totalPages);
}
export async function syncEinvoice() {
  await login();
  // get sid value

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
  let SYNC_RETRY = 0;
  for (const { year, month } of checkList) {
    while (SYNC_RETRY < 3) {
      try {
        log(`正在同步 ${year} 年 ${month} 月發票`);
        await syncMonthEinvoice(year, month);
        break;
      } catch (error) {
        SYNC_RETRY++;
        log(`同步 ${year} 年 ${month} 月發票失敗: ${error.message}`);

        cookieJar = new CookieJar();
        await login();
      }
    }
    if (SYNC_RETRY >= 3) {
      break;
    }
  }
  if (SYNC_RETRY >= 3) {
    log(`已達到最大同步次數，不建議繼續`);
  } else {
    log(`同步完成`);
  }
}
