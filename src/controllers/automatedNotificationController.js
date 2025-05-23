import AutomatedNotificationService from "../services/automatedNotificationService.js";
import Scheduler from "../config/scheduler.js";

class AutomatedNotificationController {
  // Lấy thống kê users không hoạt động
  static async getInactiveUsersStats(req, res) {
    try {
      const stats = await AutomatedNotificationService.getInactiveUsersStats();

      return res.status(200).json({
        success: true,
        message: "Lấy thống kê users không hoạt động thành công",
        data: stats,
      });
    } catch (error) {
      console.error("Error getting inactive users stats:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi khi lấy thống kê users không hoạt động",
        error: error.message,
      });
    }
  }

  // Chạy kiểm tra thủ công (cho admin test)
  static async runManualCheck(req, res) {
    try {
      const result = await Scheduler.runManualCheck();

      return res.status(200).json({
        success: true,
        message: "Chạy kiểm tra thủ công thành công",
        data: result,
      });
    } catch (error) {
      console.error("Error running manual check:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi khi chạy kiểm tra thủ công",
        error: error.message,
      });
    }
  }

  // Lấy thông tin cấu hình scheduler
  static async getSchedulerInfo(req, res) {
    try {
      const info = {
        isActive: true,
        schedules: [
          {
            name: "Daily Morning Check",
            time: "10:00 AM",
            cron: "0 10 * * *",
            timezone: "Asia/Ho_Chi_Minh",
            description:
              "Kiểm tra và gửi thông báo cho users không hoạt động mỗi sáng",
          },
          {
            name: "Daily Evening Check",
            time: "6:00 PM",
            cron: "0 18 * * *",
            timezone: "Asia/Ho_Chi_Minh",
            description:
              "Kiểm tra và gửi thông báo cho users không hoạt động mỗi tối",
          },
        ],
        lastCheck: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
      };

      // Thêm schedule development nếu là dev mode
      if (process.env.NODE_ENV === "development") {
        info.schedules.push({
          name: "Hourly Stats Check (DEV)",
          time: "Every hour",
          cron: "0 * * * *",
          timezone: "Asia/Ho_Chi_Minh",
          description:
            "Lấy thống kê users không hoạt động mỗi giờ (chỉ ở development)",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Lấy thông tin scheduler thành công",
        data: info,
      });
    } catch (error) {
      console.error("Error getting scheduler info:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi khi lấy thông tin scheduler",
        error: error.message,
      });
    }
  }

  // API để test notification content với số ngày khác nhau
  static async testNotificationContent(req, res) {
    try {
      const { daysInactive = 1, firstName = "Test User" } = req.body;

      const content = AutomatedNotificationService.getNotificationContent(
        parseInt(daysInactive),
        firstName
      );

      return res.status(200).json({
        success: true,
        message: "Test nội dung thông báo thành công",
        data: {
          daysInactive: parseInt(daysInactive),
          firstName,
          notificationContent: content,
        },
      });
    } catch (error) {
      console.error("Error testing notification content:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi khi test nội dung thông báo",
        error: error.message,
      });
    }
  }
}

export default AutomatedNotificationController;
