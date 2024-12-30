import "dotenv/config";
import { Api } from "nocodb-sdk";
const api = new Api({
  baseURL: process.env.NOCODB_URL,
  headers: {
    "xc-token": process.env.NOCODB_API_KEY,
  },
});
function log(...args) {
  console.log(new Date().toLocaleTimeString(), `[資料庫]`, ...args);
}

function logError(error) {
  console.error(new Date().toLocaleTimeString(), `[資料庫錯誤]`, {
    name: error.name,
    message: error.message,
    stack: error.stack,
    response: error.response?.data,
  });
}
let invoiceTableId, invoiceDetailTableId;
export async function getDBInfo() {
  try {
    const { list } = await api.dbTable.list(process.env.NOCODB_BASE_ID);
    // Create 電子發票 table first
    const isInvoiceTableExists = list.some(
      (table) => table.title === "電子發票"
    );
    const isInvoiceDetailTableExists = list.some(
      (table) => table.title === "電子發票 - 明細"
    );
    if (isInvoiceTableExists && isInvoiceDetailTableExists) {
      invoiceTableId = list.find((table) => table.title === "電子發票").id;
      invoiceDetailTableId = list.find(
        (table) => table.title === "電子發票 - 明細"
      ).id;
    } else {
      log("建立電子發票資料表");
      const invoiceTable = await api.dbTable.create(
        process.env.NOCODB_BASE_ID,
        {
          table_name: "電子發票",
          title: "電子發票",
          description: "自動同步的電子發票資料，請勿手動修改表格名稱",
          tags: ["電子發票"],
          columns: [
            {
              title: "id",
              uidt: "ID",
              pv: true,
            },
            {
              title: "invoice_id",
              uidt: "SingleLineText",
            },
            {
              title: "invoice_date",
              uidt: "SingleLineText",
            },
            {
              title: "invoice_time",
              uidt: "SingleLineText",
            },
            {
              title: "invoice_instant_date",
              uidt: "DateTime",
            },
            {
              title: "total_amount",
              uidt: "Currency",
              meta: {
                currency_locale: "zh-TW",
                currency_code: "TWD",
              },
            },
            {
              title: "ext_status",
              uidt: "SingleLineText",
            },
            {
              title: "donate_mark",
              uidt: "SingleLineText",
            },
            {
              title: "seller_name",
              uidt: "SingleLineText",
            },
            {
              title: "seller_id",
              uidt: "SingleLineText",
            },
            {
              title: "currency",
              uidt: "SingleLineText",
            },
            {
              title: "seller_address",
              uidt: "SingleLineText",
            },
            {
              title: "buyer_name",
              uidt: "SingleLineText",
            },
            {
              title: "main_remark",
              uidt: "SingleLineText",
            },
            {
              title: "alw_flag",
              uidt: "SingleLineText",
            },
            {
              title: "random_number",
              uidt: "SingleLineText",
            },
            {
              title: "invoice_str_status",
              uidt: "SingleLineText",
            },
          ],
        }
      );

      const detailTable = await api.dbTable.create(process.env.NOCODB_BASE_ID, {
        table_name: "電子發票 - 明細",
        title: "電子發票 - 明細",
        description: "自動同步的電子發票明細資料，請勿手動修改表格名稱",
        tags: ["電子發票"],
        columns: [
          {
            title: "id",
            uidt: "ID",
            pv: true,
          },
          {
            title: "item",
            uidt: "SingleLineText",
          },
          {
            title: "quantity",
            uidt: "Number",
          },
          {
            title: "unit_price",
            uidt: "Currency",
            meta: {
              currency_locale: "zh-TW",
              currency_code: "TWD",
            },
          },
          {
            title: "amount",
            uidt: "Currency",
            meta: {
              currency_locale: "zh-TW",
              currency_code: "TWD",
            },
          },
        ],
      });
      await fetch(
        `${process.env.NOCODB_URL}/api/v1/db/meta/tables/${invoiceTable.id}/columns`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xc-token": process.env.NOCODB_API_KEY,
          },
          body: JSON.stringify({
            title: "details",
            column_name: "details",
            uidt: "Links",
            userHasChangedTitle: false,
            dtx: "specificType",
            dt: "character varying",
            altered: 2,
            parentId: invoiceTable.id,
            childColumn: "電子發票_id",
            childTable: "電子發票",
            parentTable: "",
            parentColumn: "",
            type: "hm",
            onUpdate: "NO ACTION",
            onDelete: "NO ACTION",
            virtual: false,
            alias: "",
            childId: detailTable.id,
            childViewId: null,
            childTableTitle: "電子發票 - 明細",
            primaryKey: false,
            table_name: "電子發票",
          }),
        }
      );
      invoiceTableId = invoiceTable.id;
      invoiceDetailTableId = detailTable.id;
    }
  } catch (error) {
    logError(error);
    throw new Error(`取得資料庫資訊失敗: ${error.message}`);
  }
}

export async function createInvoice(invoiceId, invoiceData, invoiceDetails) {
  if (!invoiceTableId || invoiceDetailTableId) {
    await getDBInfo();
  }
  let existingInvoice;
  try {
    // Create new invoice
    existingInvoice = await fetch(
      `${process.env.NOCODB_URL}/api/v2/tables/${invoiceTableId}/records`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xc-token": process.env.NOCODB_API_KEY,
        },
        body: JSON.stringify({
          invoice_id: invoiceId,
          invoice_date: invoiceData.invoiceDate,
          invoice_time: invoiceData.invoiceTime,
          invoice_instant_date: invoiceData.invoiceInstantDate,
          total_amount: parseInt(invoiceData.totalAmount.replace(/,/g, "")),
          ext_status: invoiceData.extStatus,
          donate_mark: invoiceData.donateMark,
          seller_name: invoiceData.sellerName,
          seller_id: invoiceData.sellerId,
          currency: invoiceData.currency,
          seller_address: invoiceData.sellerAddress,
          buyer_name: invoiceData.buyerName,
          main_remark: invoiceData.mainRemark,
          alw_flag: invoiceData.alwFlag,
          random_number: invoiceData.randomNumber,
          invoice_str_status: invoiceData.invoiceStrStatus,
        }),
      }
    ).then((res) => res.json());
    if (existingInvoice?.error) {
      throw new Error(`新增發票失敗: ${existingInvoice.error}`);
    }
    if (invoiceDetails?.length) {
      for (const detail of invoiceDetails) {
        let record = await fetch(
          `${process.env.NOCODB_URL}/api/v2/tables/${invoiceDetailTableId}/records`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xc-token": process.env.NOCODB_API_KEY,
            },
            body: JSON.stringify({
              item: detail.item,
              quantity: parseInt(detail.quantity.replace(/,/g, "")),
              unit_price: parseInt(detail.unitPrice.replace(/,/g, "")),
              amount: parseInt(detail.amount.replace(/,/g, "")),
              電子發票_id: existingInvoice.id,
            }),
          }
        ).then((res) => res.json());
        if (record?.error) {
          throw new Error(`新增發票明細失敗: ${record.error}`);
        }
      }
    }
  } catch (error) {
    logError(`處理發票 ${invoiceId} 失敗: ${error.message}`);
  }
}
export async function isInvoiceExists(invoiceId) {
  try {
    const existingInvoice = await fetch(
      `${process.env.NOCODB_URL}/api/v2/tables/${invoiceTableId}/records?where=(invoice_id,eq,${invoiceId})`,
      {
        headers: {
          "Content-Type": "application/json",
          "xc-token": process.env.NOCODB_API_KEY,
        },
      }
    )
      .then((res) => res.json())
      .then((data) => data.list?.[0]);
    return !!existingInvoice;
  } catch (error) {
    logError(error);
    throw new Error(`查詢發票 ${invoiceId} 失敗: ${error.message}`);
  }
}
