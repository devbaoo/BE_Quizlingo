import dotenv from "dotenv";
dotenv.config();

const payosConfig = {
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
  baseUrl: process.env.PAYOS_BASE_URL,
  returnUrl: process.env.PAYOS_RETURN_URL,
  cancelUrl: process.env.PAYOS_CANCEL_URL,
  webhookUrl: process.env.PAYOS_WEBHOOK_URL,
};

export default payosConfig;
