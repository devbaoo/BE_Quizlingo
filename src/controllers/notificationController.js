import NotificationService from "../services/notificationService.js";

class NotificationController {
  // Lấy danh sách thông báo của user
  static async getNotifications(req, res) {
    try {
      const { page, limit, unreadOnly } = req.query;
      const userId = req.user.id;

      const result = await NotificationService.getUserNotifications(userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        unreadOnly: unreadOnly === "true",
      });

      res.json(result);
    } catch (error) {
      console.error("Error in getNotifications:", error);
      res.status(500).json({ message: "Lỗi khi lấy danh sách thông báo" });
    }
  }

  // Đánh dấu thông báo đã đọc
  static async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const userId = req.user.id;

      const notification = await NotificationService.markAsRead(
        notificationId,
        userId
      );

      res.json({
        success: true,
        message: "Đã đánh dấu thông báo đã đọc",
        notification,
      });
    } catch (error) {
      console.error("Error in markAsRead:", error);
      if (error.message === "Không tìm thấy thông báo") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: "Lỗi khi đánh dấu thông báo đã đọc",
      });
    }
  }

  // Đánh dấu tất cả thông báo đã đọc
  static async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      const result = await NotificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: `Đã đánh dấu ${result.modifiedCount} thông báo đã đọc`,
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Error in markAllAsRead:", error);
      if (error.message === "Không tìm thấy người dùng") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: "Lỗi khi đánh dấu tất cả thông báo đã đọc",
      });
    }
  }

  // Cập nhật cài đặt thông báo
  static async updateSettings(req, res) {
    try {
      const userId = req.user.id;
      const settings = req.body;

      // Validate settings
      if (
        typeof settings.emailNotifications !== "boolean" ||
        typeof settings.pushNotifications !== "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Cài đặt thông báo không hợp lệ. Các giá trị phải là boolean",
        });
      }

      const result = await NotificationService.updateNotificationSettings(
        userId,
        settings
      );

      res.json({
        success: true,
        message: "Đã cập nhật cài đặt thông báo thành công",
        settings: result.settings,
      });
    } catch (error) {
      console.error("Error in updateSettings:", error);
      if (error.message === "Không tìm thấy người dùng") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: "Lỗi khi cập nhật cài đặt thông báo",
      });
    }
  }

  // Admin tạo thông báo cho user
  static async createUserNotification(req, res) {
    try {
      const { userId, ...notificationData } = req.body;
      const result = await NotificationService.createUserNotification(
        userId,
        notificationData
      );

      // Nếu thông báo chỉ được gửi qua email
      if (result.sentViaEmail) {
        return res.json({
          success: true,
          message: result.message,
        });
      }

      // Nếu thông báo được tạo bình thường
      res.json({
        success: true,
        message: "Đã tạo thông báo thành công",
        notification: result,
      });
    } catch (error) {
      console.error("Error in createUserNotification:", error);
      res.status(error.message.includes("Thiếu thông tin") ? 400 : 500).json({
        success: false,
        message: error.message || "Lỗi khi tạo thông báo",
      });
    }
  }

  // Admin tạo thông báo cho nhiều user
  static async createBulkNotifications(req, res) {
    try {
      const { userIds, ...notificationData } = req.body;
      const result = await NotificationService.createBulkNotifications(
        userIds,
        notificationData
      );

      res.json({
        success: true,
        message: "Đã gửi thông báo cho người dùng",
        notifications: result.notifications,
        emailOnlyUsers: result.emailOnlyUsers,
        errors: result.errors,
      });
    } catch (error) {
      console.error("Error in createBulkNotifications:", error);
      res.status(error.message.includes("Thiếu thông tin") ? 400 : 500).json({
        success: false,
        message: error.message || "Lỗi khi tạo thông báo hàng loạt",
      });
    }
  }

  // Admin tạo thông báo cho tất cả user
  static async createNotificationForAllUsers(req, res) {
    try {
      const notificationData = req.body;
      const result = await NotificationService.createNotificationForAllUsers(
        notificationData
      );

      res.json({
        success: true,
        message: `Đã gửi thông báo cho ${result.totalUsers} người dùng`,
        ...result,
      });
    } catch (error) {
      console.error("Error in createNotificationForAllUsers:", error);
      res.status(error.message.includes("Thiếu thông tin") ? 400 : 500).json({
        success: false,
        message: error.message || "Lỗi khi gửi thông báo cho tất cả người dùng",
      });
    }
  }
  static async getNotificationsSetting(req, res) {
    try {
      const userId = req.user.id;
      const settings = await NotificationService.getNotificationSetting(userId);

      res.json({
        success: true,
        settings,
      });
    } catch (error) {
      console.error("Error in getNotificationsSetting:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy cài đặt thông báo",
      });
    }
  }
}

export default NotificationController;
