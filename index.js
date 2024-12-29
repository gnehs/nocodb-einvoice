import "dotenv/config";
import cron from "node-cron";
import { syncEinvoice } from "./einvoice.js";
syncEinvoice();
cron.schedule(process.env.CRON_SCHEDULE, () => {
  syncEinvoice();
});
