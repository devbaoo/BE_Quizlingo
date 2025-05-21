import Package from "../models/package.js";
import UserPackage from "../models/userPackage.js";
import User from "../models/user.js";
import moment from "moment-timezone";

// Lấy danh sách tất cả package (bao gồm cả inactive)
const getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find()
      .select("-__v")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách gói thành công",
      packages,
    });
  } catch (error) {
    console.error("Get all packages error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách gói",
      error: error.message,
    });
  }
};

// Tạo package mới
const createPackage = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      duration,
      features,
      discount,
      discountEndDate,
    } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!name || !description || !price || !duration) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin cần thiết",
      });
    }

    // Tạo package mới
    const newPackage = new Package({
      name,
      description,
      price,
      duration,
      features: features || {},
      discount: discount || 0,
      discountEndDate: discountEndDate || null,
    });

    await newPackage.save();

    return res.status(201).json({
      success: true,
      message: "Tạo gói thành công",
      package: newPackage,
    });
  } catch (error) {
    console.error("Create package error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tạo gói",
      error: error.message,
    });
  }
};

// Cập nhật package
const updatePackage = async (req, res) => {
  try {
    const { packageId } = req.params;
    const updateData = req.body;

    // Không cho phép cập nhật một số trường
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const packageData = await Package.findByIdAndUpdate(
      packageId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gói",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật gói thành công",
      package: packageData,
    });
  } catch (error) {
    console.error("Update package error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật gói",
      error: error.message,
    });
  }
};

// Xóa package
const deletePackage = async (req, res) => {
  try {
    const { packageId } = req.params;

    // Kiểm tra xem có user nào đang sử dụng package này không
    const activeUsers = await UserPackage.findOne({
      package: packageId,
      isActive: true,
      endDate: { $gt: new Date() },
    });

    if (activeUsers) {
      return res.status(400).json({
        success: false,
        message: "Không thể xóa gói đang có người dùng sử dụng",
      });
    }

    const packageData = await Package.findByIdAndDelete(packageId);

    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gói",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Xóa gói thành công",
    });
  } catch (error) {
    console.error("Delete package error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xóa gói",
      error: error.message,
    });
  }
};

// Lấy thống kê về package
const getPackageStats = async (req, res) => {
  try {
    const now = moment().tz("Asia/Ho_Chi_Minh");
    const thirtyDaysAgo = now.clone().subtract(30, "days");

    // Tổng số package đã bán trong 30 ngày
    const recentSales = await UserPackage.find({
      createdAt: { $gte: thirtyDaysAgo.toDate() },
      paymentStatus: "completed",
    });

    // Thống kê theo package
    const packageStats = await Package.aggregate([
      {
        $lookup: {
          from: "userpackages",
          localField: "_id",
          foreignField: "package",
          as: "sales",
        },
      },
      {
        $project: {
          name: 1,
          price: 1,
          totalSales: { $size: "$sales" },
          activeUsers: {
            $size: {
              $filter: {
                input: "$sales",
                as: "sale",
                cond: {
                  $and: [
                    { $eq: ["$$sale.isActive", true] },
                    { $gt: ["$$sale.endDate", new Date()] },
                    { $eq: ["$$sale.paymentStatus", "completed"] },
                  ],
                },
              },
            },
          },
          revenue: {
            $sum: {
              $map: {
                input: "$sales",
                as: "sale",
                in: {
                  $multiply: [
                    "$$sale.amount",
                    {
                      $cond: [
                        { $eq: ["$$sale.paymentStatus", "completed"] },
                        1,
                        0,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ]);

    // Thống kê doanh thu theo ngày trong 30 ngày gần nhất
    const dailyRevenue = await UserPackage.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo.toDate() },
          paymentStatus: "completed",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Ho_Chi_Minh",
            },
          },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      message: "Lấy thống kê thành công",
      stats: {
        totalSales: recentSales.length,
        totalRevenue: recentSales.reduce((sum, sale) => sum + sale.amount, 0),
        packageStats,
        dailyRevenue,
      },
    });
  } catch (error) {
    console.error("Get package stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thống kê",
      error: error.message,
    });
  }
};

// Quản lý package của user
const manageUserPackage = async (req, res) => {
  try {
    const { userId } = req.params;
    const { packageId, action, duration } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    switch (action) {
      case "add":
        // Thêm package cho user
        const packageData = await Package.findById(packageId);
        if (!packageData) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy gói",
          });
        }

        const userPackage = new UserPackage({
          user: userId,
          package: packageId,
          startDate: new Date(),
          endDate: moment()
            .add(duration || packageData.duration, "days")
            .toDate(),
          paymentStatus: "completed",
          paymentMethod: "admin",
          transactionId: `ADMIN_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          amount: 0,
          isActive: true,
        });

        await userPackage.save();

        return res.status(200).json({
          success: true,
          message: "Thêm gói cho người dùng thành công",
          userPackage,
        });

      case "extend":
        // Gia hạn package
        const activePackage = await UserPackage.findOne({
          user: userId,
          package: packageId,
          isActive: true,
        });

        if (!activePackage) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy gói đang active",
          });
        }

        activePackage.endDate = moment(activePackage.endDate)
          .add(duration, "days")
          .toDate();
        await activePackage.save();

        return res.status(200).json({
          success: true,
          message: "Gia hạn gói thành công",
          userPackage: activePackage,
        });

      case "cancel":
        // Hủy package
        const packageToCancel = await UserPackage.findOne({
          user: userId,
          package: packageId,
          isActive: true,
        });

        if (!packageToCancel) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy gói đang active",
          });
        }

        packageToCancel.isActive = false;
        await packageToCancel.save();

        return res.status(200).json({
          success: true,
          message: "Hủy gói thành công",
          userPackage: packageToCancel,
        });

      default:
        return res.status(400).json({
          success: false,
          message: "Hành động không hợp lệ",
        });
    }
  } catch (error) {
    console.error("Manage user package error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi quản lý gói của người dùng",
      error: error.message,
    });
  }
};

export default {
  getAllPackages,
  createPackage,
  updatePackage,
  deletePackage,
  getPackageStats,
  manageUserPackage,
};
