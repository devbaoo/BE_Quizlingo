import User from "../models/user.js";
import Notification from "../models/notification.js";
import NotificationService from "./notificationService.js";

class AutomatedNotificationService {
  // Kiểm tra và gửi thông báo cho users không hoạt động
  static async checkAndNotifyInactiveUsers() {
    try {
      console.log("[CRON] Starting inactive users check...");

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 ngày trước

      // Tìm users không hoạt động hơn 1 ngày
      const inactiveUsers = await User.find({
        $or: [
          { lastLoginDate: { $lt: oneDayAgo } }, // Có lastLoginDate nhưng > 1 ngày
          { lastLoginDate: null }, // Chưa từng login
          { lastLoginDate: { $exists: false } }, // Không có field lastLoginDate
        ],
        role: "user", // Chỉ check user, không check admin
        isDeleted: { $ne: true }, // Không check user đã bị xóa
      });

      console.log(`[CRON] Found ${inactiveUsers.length} inactive users`);

      let notificationsSent = 0;
      let emailOnlyNotifications = 0;
      const errors = [];

      for (const user of inactiveUsers) {
        try {
          // Kiểm tra xem đã gửi thông báo trong ngày hôm nay chưa
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const todayNotification = await Notification.findOne({
            user: user._id,
            type: "reminder",
            createdAt: {
              $gte: today,
              $lt: tomorrow,
            },
          });

          // Nếu đã gửi thông báo hôm nay, bỏ qua
          if (todayNotification) {
            console.log(
              `[CRON] Already sent notification today for user: ${user.email}`
            );
            continue;
          }

          // Tính số ngày không hoạt động
          let daysInactive = 1;
          if (user.lastLoginDate) {
            daysInactive = Math.floor(
              (now - user.lastLoginDate) / (24 * 60 * 60 * 1000)
            );
          } else {
            // Nếu chưa từng login, tính từ ngày tạo tài khoản
            daysInactive = Math.floor(
              (now - user.createdAt) / (24 * 60 * 60 * 1000)
            );
          }

          // Tạo nội dung thông báo phù hợp với số ngày không hoạt động
          const { title, message } = this.getNotificationContent(
            daysInactive,
            user.firstName
          );

          // Tạo thông báo với type đặc biệt để track
          const notification =
            await NotificationService.createInactiveReminderNotification(
              user._id,
              {
                title,
                message,
                type: "reminder",
                link: "/learn",
              },
              daysInactive
            );

          if (notification) {
            notificationsSent++;
            console.log(
              `[CRON] Sent notification to user: ${user.email} (${daysInactive} days inactive)`
            );
          } else {
            emailOnlyNotifications++;
            console.log(
              `[CRON] Sent email only to user: ${user.email} (push notifications disabled)`
            );
          }
        } catch (error) {
          console.error(
            `[CRON] Error sending notification to user ${user._id}:`,
            error
          );
          errors.push({
            userId: user._id,
            email: user.email,
            error: error.message,
          });
        }
      }

      const result = {
        totalInactiveUsers: inactiveUsers.length,
        notificationsSent,
        emailOnlyNotifications,
        errors: errors.length > 0 ? errors : undefined,
        processedAt: new Date(),
      };

      console.log("[CRON] Inactive users check completed:", result);
      return result;
    } catch (error) {
      console.error("[CRON] Error in checkAndNotifyInactiveUsers:", error);
      throw error;
    }
  }

  // Tạo nội dung thông báo phù hợp theo số ngày không hoạt động
  static getNotificationContent(daysInactive, firstName) {
    const name = firstName || "bạn";

    if (daysInactive === 1) {
      return {
        title: "📚 Bạn đã quên học hôm nay rồi!",
        message: `Chào ${name}! Bạn đã không học từ hôm qua. Hãy tiếp tục duy trì streak học tập của mình nhé! 🔥`,
      };
    } else if (daysInactive <= 3) {
      return {
        title: "⏰ Nhớ học tiếng Anh đều đặn nhé!",
        message: `Chào ${name}! Bạn đã không học ${daysInactive} ngày rồi. Chỉ cần 10 phút mỗi ngày để duy trì kỹ năng! 💪`,
      };
    } else if (daysInactive <= 7) {
      return {
        title: "🎯 Hãy quay lại học tập!",
        message: `${name} ơi! Đã ${daysInactive} ngày bạn chưa học. Đừng để kỹ năng tiếng Anh bị "gỉ" nhé! Quay lại ngay thôi! ⭐`,
      };
    } else if (daysInactive <= 14) {
      return {
        title: "💔 Quizlingo nhớ bạn!",
        message: `${name} à! ${daysInactive} ngày rồi bạn không ghé thăm. Hãy quay lại để tiếp tục hành trình học tiếng Anh của mình! 🌟`,
      };
    } else {
      return {
        title: "🌟 Chúng mình đang chờ bạn!",
        message: `Chào ${name}! Dù đã lâu rồi (${daysInactive} ngày), nhưng chưa bao giờ là quá muộn để bắt đầu lại. Hãy cùng học tiếng Anh nhé! 🚀`,
      };
    }
  }

  // Thống kê users không hoạt động (không gửi thông báo)
  static async getInactiveUsersStats() {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const stats = {
        inactive1Day: await User.countDocuments({
          $or: [
            { lastLoginDate: { $lt: oneDayAgo, $gte: threeDaysAgo } },
            {
              lastLoginDate: null,
              createdAt: { $lt: oneDayAgo, $gte: threeDaysAgo },
            },
          ],
          role: "user",
          isDeleted: { $ne: true },
        }),
        inactive3Days: await User.countDocuments({
          $or: [
            { lastLoginDate: { $lt: threeDaysAgo, $gte: oneWeekAgo } },
            {
              lastLoginDate: null,
              createdAt: { $lt: threeDaysAgo, $gte: oneWeekAgo },
            },
          ],
          role: "user",
          isDeleted: { $ne: true },
        }),
        inactive1Week: await User.countDocuments({
          $or: [
            { lastLoginDate: { $lt: oneWeekAgo, $gte: twoWeeksAgo } },
            {
              lastLoginDate: null,
              createdAt: { $lt: oneWeekAgo, $gte: twoWeeksAgo },
            },
          ],
          role: "user",
          isDeleted: { $ne: true },
        }),
        inactive2Weeks: await User.countDocuments({
          $or: [
            { lastLoginDate: { $lt: twoWeeksAgo } },
            { lastLoginDate: null, createdAt: { $lt: twoWeeksAgo } },
          ],
          role: "user",
          isDeleted: { $ne: true },
        }),
      };

      return stats;
    } catch (error) {
      console.error("Error getting inactive users stats:", error);
      throw error;
    }
  }
}

export default AutomatedNotificationService;
