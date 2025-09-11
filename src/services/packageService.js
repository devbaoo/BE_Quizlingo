import Package from "../models/package.js";
import UserPackage from "../models/userPackage.js";
import User from "../models/user.js";
import moment from "moment-timezone";
import paymentService from "./paymentService.js";

// Lấy danh sách package đang active
const getActivePackages = async () => {
  try {
    const packages = await Package.find({ isActive: true })
      .select("-__v")
      .sort({ price: 1 });

    return {
      success: true,
      statusCode: 200,
      message: "Lấy danh sách gói thành công",
      packages,
    };
  } catch (error) {
    console.error("Get active packages error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy danh sách gói",
      error: error.message,
    };
  }
};

// Lấy thông tin chi tiết package
const getPackageDetails = async (packageId) => {
  try {
    const packageData = await Package.findById(packageId);
    if (!packageData) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy gói",
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Lấy thông tin gói thành công",
      package: packageData,
    };
  } catch (error) {
    console.error("Get package details error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy thông tin gói",
      error: error.message,
    };
  }
};

// Kiểm tra package đang active của user
const getUserActivePackage = async (userId) => {
  try {
    const now = moment().tz("Asia/Ho_Chi_Minh");

    // Tìm package đang active và chưa hết hạn
    const activePackage = await UserPackage.findOne({
      user: userId,
      isActive: true,
      endDate: { $gt: now.toDate() },
      paymentStatus: "completed",
    }).populate("package");

    if (!activePackage) {
      return {
        success: true,
        statusCode: 200,
        message: "Người dùng chưa có gói đang active",
        hasActivePackage: false,
      };
    }

    // Tính số ngày còn lại
    const daysRemaining = moment(activePackage.endDate).diff(now, "days");

    return {
      success: true,
      statusCode: 200,
      message: "Lấy thông tin gói thành công",
      hasActivePackage: true,
      package: {
        ...activePackage.package.toObject(),
        daysRemaining,
        startDate: activePackage.startDate,
        endDate: activePackage.endDate,
      },
    };
  } catch (error) {
    console.error("Get user active package error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi kiểm tra gói của người dùng",
      error: error.message,
    };
  }
};

// Tạo đơn mua package mới
const createPackagePurchase = async (userId, packageId, paymentMethod) => {
  try {
    // Kiểm tra xem user đã có gói active chưa
    const now = moment().tz("Asia/Ho_Chi_Minh");
    const existingActivePackage = await UserPackage.findOne({
      user: userId,
      isActive: true,
      endDate: { $gt: now.toDate() },
      paymentStatus: "completed",
    });

    if (existingActivePackage) {
      return {
        success: false,
        statusCode: 400,
        message:
          "Bạn đang có gói Premium đang hoạt động, không thể mua thêm gói mới",
      };
    }

    const packageData = await Package.findById(packageId);
    if (!packageData) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy gói",
      };
    }

    if (!packageData.isActive) {
      return {
        success: false,
        statusCode: 400,
        message: "Gói không còn khả dụng",
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    // Tính giá sau khi áp dụng giảm giá
    let finalPrice = packageData.price;
    if (
      packageData.discount > 0 &&
      new Date(packageData.discountEndDate) > new Date()
    ) {
      finalPrice = packageData.price * (1 - packageData.discount / 100);
    }

    // Tạo orderCode số cho PayOS (đảm bảo không vượt quá giới hạn)
    const generateOrderCode = () => {
      // Tạo số ngẫu nhiên 12 chữ số
      const randomNum = Math.floor(Math.random() * 1000000000000);
      // Thêm timestamp vào để đảm bảo unique
      const timestamp = Date.now() % 1000000000000;
      // Kết hợp và đảm bảo không vượt quá giới hạn
      return Math.floor((timestamp * 1000000 + randomNum) % 9007199254740991);
    };

    const orderCode = generateOrderCode();
    const transactionId = `PKG_${orderCode}`; // Sử dụng orderCode làm một phần của transactionId

    // Tạo user package mới
    const userPackage = new UserPackage({
      user: userId,
      package: packageId,
      startDate: new Date(),
      endDate: moment().add(packageData.duration, "days").toDate(),
      paymentMethod,
      transactionId,
      amount: finalPrice,
      discountApplied: packageData.discount,
    });

    await userPackage.save();

    // Tạo payment URL từ PayOS
    const paymentResult = await paymentService.createPaymentUrl({
      orderCode, // Sử dụng orderCode số
      amount: Math.round(finalPrice), // PayOS yêu cầu số tiền là số nguyên
      description: `Mua gói ${packageData.name} - Marxedu`,
      expiredAt: moment().add(15, "minutes").unix(), // Link thanh toán hết hạn sau 15 phút
    });

    if (!paymentResult.success) {
      // Nếu tạo payment URL thất bại, cập nhật trạng thái package
      userPackage.paymentStatus = "failed";
      await userPackage.save();

      return {
        success: false,
        statusCode: 500,
        message: paymentResult.message || "Lỗi khi tạo đơn thanh toán",
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Tạo đơn mua gói thành công",
      purchaseInfo: {
        transactionId: userPackage.transactionId,
        amount: userPackage.amount,
        paymentMethod,
        paymentUrl: paymentResult.checkoutUrl,
        qrCode: paymentResult.qrCode,
        orderCode: orderCode,
      },
    };
  } catch (error) {
    console.error("Create package purchase error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi tạo đơn mua gói",
      error: error.message,
    };
  }
};

// Cập nhật trạng thái thanh toán
const updatePaymentStatus = async (transactionId, status) => {
  try {
    const userPackage = await UserPackage.findOne({ transactionId });
    if (!userPackage) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giao dịch",
      };
    }

    userPackage.paymentStatus = status;
    if (status === "completed") {
      userPackage.isActive = true;
    } else if (status === "failed" || status === "refunded") {
      userPackage.isActive = false;
    }

    await userPackage.save();

    return {
      success: true,
      statusCode: 200,
      message: "Cập nhật trạng thái thanh toán thành công",
      userPackage,
    };
  } catch (error) {
    console.error("Update payment status error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi cập nhật trạng thái thanh toán",
      error: error.message,
    };
  }
};

// Kiểm tra và cập nhật trạng thái package của user
const checkAndUpdateUserPackages = async (userId) => {
  try {
    const now = moment().tz("Asia/Ho_Chi_Minh");

    // Tìm tất cả package đã hết hạn nhưng vẫn đang active
    const expiredPackages = await UserPackage.find({
      user: userId,
      isActive: true,
      endDate: { $lte: now.toDate() },
    });

    // Cập nhật trạng thái các package đã hết hạn
    for (const pkg of expiredPackages) {
      pkg.isActive = false;
      await pkg.save();
    }

    return {
      success: true,
      statusCode: 200,
      message: "Cập nhật trạng thái gói thành công",
      updatedCount: expiredPackages.length,
    };
  } catch (error) {
    console.error("Check and update user packages error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi cập nhật trạng thái gói",
      error: error.message,
    };
  }
};

// Xử lý webhook từ PayOS
const handlePaymentWebhook = async (webhookData) => {
  try {
    // Xác thực webhook
    const isValid = paymentService.verifyWebhook(webhookData);
    if (!isValid) {
      return {
        success: false,
        statusCode: 400,
        message: "Chữ ký không hợp lệ",
      };
    }

    const { orderCode, status, amount, transactionTime } = webhookData;

    // Tìm user package theo orderCode
    const userPackage = await UserPackage.findOne({ transactionId: orderCode });
    if (!userPackage) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giao dịch",
      };
    }

    // Kiểm tra số tiền
    if (amount !== Math.round(userPackage.amount)) {
      return {
        success: false,
        statusCode: 400,
        message: "Số tiền không khớp",
      };
    }

    // Cập nhật trạng thái thanh toán
    let paymentStatus;
    switch (status) {
      case "PAID":
        paymentStatus = "completed";
        break;
      case "CANCELLED":
        paymentStatus = "failed";
        break;
      case "EXPIRED":
        paymentStatus = "failed";
        break;
      default:
        paymentStatus = "pending";
    }

    userPackage.paymentStatus = paymentStatus;
    if (paymentStatus === "completed") {
      userPackage.isActive = true;
      userPackage.transactionTime = new Date(transactionTime * 1000);
    } else if (paymentStatus === "failed") {
      userPackage.isActive = false;
    }

    await userPackage.save();

    return {
      success: true,
      statusCode: 200,
      message: "Cập nhật trạng thái thanh toán thành công",
      userPackage,
    };
  } catch (error) {
    console.error("Handle payment webhook error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xử lý webhook thanh toán",
      error: error.message,
    };
  }
};

// Kiểm tra trạng thái thanh toán
const checkPaymentStatus = async (transactionId) => {
  try {
    // Trích xuất orderCode số từ transactionId
    const orderCode = Number(transactionId.split("_")[1]);
    if (isNaN(orderCode)) {
      return {
        success: false,
        statusCode: 400,
        message: "Mã giao dịch không hợp lệ",
      };
    }

    const userPackage = await UserPackage.findOne({ transactionId });
    if (!userPackage) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giao dịch",
      };
    }

    // Kiểm tra trạng thái từ PayOS
    const paymentResult = await paymentService.checkPaymentStatus(orderCode);
    if (!paymentResult.success) {
      return paymentResult;
    }

    // Cập nhật trạng thái nếu cần
    if (
      paymentResult.status === "PAID" &&
      userPackage.paymentStatus !== "completed"
    ) {
      userPackage.paymentStatus = "completed";
      userPackage.isActive = true;
      userPackage.transactionTime = new Date(
        paymentResult.transactionTime * 1000
      );
      await userPackage.save();
    }

    return {
      success: true,
      statusCode: 200,
      message: "Kiểm tra trạng thái thanh toán thành công",
      paymentStatus: paymentResult.status,
      userPackage,
    };
  } catch (error) {
    console.error("Check payment status error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi kiểm tra trạng thái thanh toán",
      error: error.message,
    };
  }
};

// Hủy thanh toán
const cancelPayment = async (transactionId) => {
  try {
    // Trích xuất orderCode số từ transactionId
    const orderCode = Number(transactionId.split("_")[1]);
    if (isNaN(orderCode)) {
      return {
        success: false,
        statusCode: 400,
        message: "Mã giao dịch không hợp lệ",
      };
    }

    const userPackage = await UserPackage.findOne({ transactionId });
    if (!userPackage) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giao dịch",
      };
    }

    // Hủy thanh toán trên PayOS
    const cancelResult = await paymentService.cancelPayment(orderCode);

    // Nếu PayOS báo mã thanh toán không tồn tại, vẫn cập nhật trạng thái local
    if (
      !cancelResult.success &&
      cancelResult.error === "Mã thanh toán không tồn tại"
    ) {
      // Cập nhật trạng thái local
      userPackage.paymentStatus = "failed";
      userPackage.isActive = false;
      await userPackage.save();

      return {
        success: true,
        statusCode: 200,
        message:
          "Hủy thanh toán thành công (giao dịch không tồn tại trên PayOS)",
        userPackage,
      };
    }

    // Nếu có lỗi khác từ PayOS
    if (!cancelResult.success) {
      return {
        success: false,
        statusCode: 400,
        message: cancelResult.error || "Lỗi khi hủy thanh toán",
        error: cancelResult.error,
      };
    }

    // Cập nhật trạng thái nếu hủy thành công
    userPackage.paymentStatus = "failed";
    userPackage.isActive = false;
    await userPackage.save();

    return {
      success: true,
      statusCode: 200,
      message: "Hủy thanh toán thành công",
      userPackage,
    };
  } catch (error) {
    console.error("Cancel payment error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi hủy thanh toán",
      error: error.message,
    };
  }
};

export default {
  getActivePackages,
  getPackageDetails,
  getUserActivePackage,
  createPackagePurchase,
  updatePaymentStatus,
  checkAndUpdateUserPackages,
  handlePaymentWebhook,
  checkPaymentStatus,
  cancelPayment,
};
