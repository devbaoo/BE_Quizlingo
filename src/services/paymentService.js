import axios from "axios";
import crypto from "crypto";
import payosConfig from "../config/payosConfig.js";
import moment from "moment-timezone";

// Tạo chữ ký theo format của PayOS
const createSignature = (data) => {
  // Format chuỗi theo đúng thứ tự yêu cầu của PayOS
  const query = `amount=${data.amount}&cancelUrl=${data.cancelUrl}&description=${data.description}&orderCode=${data.orderCode}&returnUrl=${data.returnUrl}`;

  const signature = crypto
    .createHmac("sha256", payosConfig.checksumKey)
    .update(query)
    .digest("hex")
    .toLowerCase();

  return signature;
};

// Tạo payment URL từ PayOS
const createPaymentUrl = async (paymentData) => {
  try {
    let {
      orderCode,
      amount,
      description,
      cancelUrl = payosConfig.cancelUrl,
      returnUrl = payosConfig.returnUrl,
      expiredAt: inputExpiredAt,
    } = paymentData;

    // Validate và tạo orderCode hợp lệ
    const generateOrderCode = () => {
      // Tạo số ngẫu nhiên 12 chữ số (đảm bảo không vượt quá giới hạn)
      const randomNum = Math.floor(Math.random() * 1000000000000);
      // Thêm timestamp vào để đảm bảo unique
      const timestamp = Date.now() % 1000000000000;
      // Kết hợp và đảm bảo không vượt quá giới hạn
      return Math.floor((timestamp * 1000000 + randomNum) % 9007199254740991);
    };

    // Kiểm tra và tạo orderCode mới nếu cần
    if (
      !orderCode ||
      !/^\d+$/.test(String(orderCode)) ||
      Number(orderCode) > 9007199254740991
    ) {
      console.warn("OrderCode không hợp lệ, tạo mã mới");
      orderCode = generateOrderCode();
    } else {
      orderCode = Number(orderCode);
    }

    // Đảm bảo amount là số nguyên
    const roundedAmount = Math.round(Number(amount));

    // Truncate description nếu vượt 25 ký tự
    let desc = String(description).trim();
    if (desc.length > 25) {
      console.warn("Description vượt 25 ký tự, tự động cắt bớt");
      desc = desc.substring(0, 25);
    }

    // Tính expiredAt (đơn vị giây Unix) nếu không truyền vào
    const expiredAt = inputExpiredAt
      ? Number(inputExpiredAt)
      : moment().tz("Asia/Bangkok").add(30, "minutes").unix();

    // Chuẩn bị request body
    const requestData = {
      orderCode,
      amount: roundedAmount,
      description: desc,
      cancelUrl: String(cancelUrl).trim(),
      returnUrl: String(returnUrl).trim(),
      expiredAt,
    };

    // Tạo signature
    requestData.signature = createSignature(requestData);

    console.log("Final Request Data:", requestData);

    // Gọi API PayOS
    const response = await axios.post(
      `${payosConfig.baseUrl}/v2/payment-requests`,
      requestData,
      {
        headers: {
          "x-client-id": payosConfig.clientId,
          "x-api-key": payosConfig.apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("PayOS Response:", response.data);

    if (response.data.code === "00") {
      return {
        success: true,
        paymentUrl: response.data.data.checkoutUrl,
        qrCode: response.data.data.qrCode,
        orderCode: response.data.data.orderCode,
        checkoutUrl: response.data.data.checkoutUrl,
      };
    }

    throw new Error(response.data.desc || "Lỗi khi tạo URL thanh toán");
  } catch (error) {
    console.error(
      "Create payment URL error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      message: "Lỗi khi tạo URL thanh toán",
      error: error.response?.data || error.message,
    };
  }
};

// Xác thực webhook từ PayOS
const verifyWebhook = (webhookData) => {
  try {
    const { signature, ...data } = webhookData;
    return signature === createSignature(data);
  } catch {
    return false;
  }
};

// Kiểm tra trạng thái thanh toán
const checkPaymentStatus = async (orderCodeInput) => {
  try {
    // Validate orderCode
    if (!orderCodeInput) {
      throw new Error("orderCode is required");
    }

    // Chuyển đổi và validate orderCode
    const orderCode = Number(String(orderCodeInput).trim());
    if (isNaN(orderCode) || orderCode <= 0 || orderCode > 9007199254740991) {
      throw new Error(
        "Invalid orderCode: must be a positive number not exceeding 9007199254740991"
      );
    }

    // Tạo signature cho request
    const requestData = { orderCode };
    const signature = createSignature(requestData);

    // Gọi API PayOS
    const response = await axios.get(
      `${payosConfig.baseUrl}/v2/payment-requests/${orderCode}`,
      {
        headers: {
          "x-client-id": payosConfig.clientId,
          "x-api-key": payosConfig.apiKey,
          "Content-Type": "application/json",
        },
        params: { signature }, // Thêm signature vào query params
      }
    );

    console.log("PayOS Check Status Response:", response.data);

    if (response.data.code === "00") {
      return {
        success: true,
        ...response.data.data,
        orderCode: orderCode, // Đảm bảo trả về orderCode đã validate
      };
    }

    throw new Error(
      response.data.desc || "Lỗi khi kiểm tra trạng thái thanh toán"
    );
  } catch (error) {
    // Log chi tiết lỗi
    console.error("Check payment status error:", {
      error: error.message,
      response: error.response?.data,
      orderCode: orderCodeInput,
    });

    // Trả về error message phù hợp
    return {
      success: false,
      error: error.response?.data?.desc || error.message,
      orderCode: orderCodeInput,
    };
  }
};

// Hủy thanh toán
const cancelPayment = async (orderCodeInput) => {
  try {
    // Validate orderCode
    if (!orderCodeInput) {
      throw new Error("orderCode is required");
    }

    // Chuyển đổi và validate orderCode
    const orderCode = Number(String(orderCodeInput).trim());
    if (isNaN(orderCode) || orderCode <= 0 || orderCode > 9007199254740991) {
      throw new Error(
        "Invalid orderCode: must be a positive number not exceeding 9007199254740991"
      );
    }

    // Tạo signature cho request
    const requestData = { orderCode };
    const signature = createSignature(requestData);

    // Gọi API PayOS
    const response = await axios.post(
      `${payosConfig.baseUrl}/v2/payment-requests/${orderCode}/cancel`,
      { orderCode, signature },
      {
        headers: {
          "x-client-id": payosConfig.clientId,
          "x-api-key": payosConfig.apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("PayOS Cancel Response:", response.data);

    if (response.data.code === "00") {
      return {
        success: true,
        message: "Hủy thanh toán thành công",
        orderCode: orderCode, // Đảm bảo trả về orderCode đã validate
      };
    }

    throw new Error(response.data.desc || "Lỗi khi hủy thanh toán");
  } catch (error) {
    // Log chi tiết lỗi
    console.error("Cancel payment error:", {
      error: error.message,
      response: error.response?.data,
      orderCode: orderCodeInput,
    });

    // Trả về error message phù hợp
    return {
      success: false,
      error: error.response?.data?.desc || error.message,
      orderCode: orderCodeInput,
    };
  }
};

export default {
  createPaymentUrl,
  verifyWebhook,
  checkPaymentStatus,
  cancelPayment,
};
