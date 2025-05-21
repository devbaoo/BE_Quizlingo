import packageService from "../services/packageService.js";

// Lấy danh sách package đang active
const getActivePackages = async (req, res) => {
  const result = await packageService.getActivePackages();
  return res.status(result.statusCode).json(result);
};

// Lấy thông tin chi tiết package
const getPackageDetails = async (req, res) => {
  const { packageId } = req.params;
  const result = await packageService.getPackageDetails(packageId);
  return res.status(result.statusCode).json(result);
};

// Lấy thông tin package đang active của user
const getUserActivePackage = async (req, res) => {
  const userId = req.user.id;
  const result = await packageService.getUserActivePackage(userId);
  return res.status(result.statusCode).json(result);
};

// Tạo đơn mua package mới
const createPackagePurchase = async (req, res) => {
  const userId = req.user.id;
  const { packageId, paymentMethod } = req.body;

  if (!packageId || !paymentMethod) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Thiếu thông tin cần thiết",
    });
  }

  const result = await packageService.createPackagePurchase(
    userId,
    packageId,
    paymentMethod
  );
  return res.status(result.statusCode).json(result);
};

// Webhook xử lý callback từ cổng thanh toán
const handlePaymentCallback = async (req, res) => {
  const { transactionId, status } = req.body;

  if (!transactionId || !status) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Thiếu thông tin cần thiết",
    });
  }

  const result = await packageService.updatePaymentStatus(
    transactionId,
    status
  );
  return res.status(result.statusCode).json(result);
};

// Kiểm tra và cập nhật trạng thái package của user
const checkUserPackages = async (req, res) => {
  const userId = req.user.id;
  const result = await packageService.checkAndUpdateUserPackages(userId);
  return res.status(result.statusCode).json(result);
};

// Xử lý webhook từ PayOS
const handlePaymentWebhook = async (req, res) => {
  const result = await packageService.handlePaymentWebhook(req.body);
  return res.status(result.statusCode).json(result);
};

// Kiểm tra trạng thái thanh toán
const checkPaymentStatus = async (req, res) => {
  const { transactionId } = req.params;
  const result = await packageService.checkPaymentStatus(transactionId);
  return res.status(result.statusCode).json(result);
};

// Hủy thanh toán
const cancelPayment = async (req, res) => {
  const { transactionId } = req.params;
  const result = await packageService.cancelPayment(transactionId);
  return res.status(result.statusCode).json(result);
};

export default {
  getActivePackages,
  getPackageDetails,
  getUserActivePackage,
  createPackagePurchase,
  handlePaymentCallback,
  checkUserPackages,
  handlePaymentWebhook,
  checkPaymentStatus,
  cancelPayment,
};
