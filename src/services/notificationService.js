import User from "../models/user.js";
import Notification from "../models/notification.js";
import nodemailer from "nodemailer";

// Cấu hình email transporter
const transporter = nodemailer.createTransport({
  host: process.env.NOTIFICATION_SMTP_HOST,
  port: process.env.NOTIFICATION_SMTP_PORT,
  secure: process.env.NOTIFICATION_SMTP_SECURE === "true",
  auth: {
    user: process.env.NOTIFICATION_SMTP_USER,
    pass: process.env.NOTIFICATION_SMTP_PASS,
  },
});

class NotificationService {
  // Tạo thông báo mới
  static async createNotification(
    userId,
    { title, message, type = "system", link = null }
  ) {
    try {
      // Kiểm tra user tồn tại
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("Không tìm thấy người dùng");
      }

      // Kiểm tra cài đặt thông báo của user
      const notificationSettings = user.notificationSettings || {
        emailNotifications: true,
        pushNotifications: true,
      };

      // Nếu push notifications bị tắt, chỉ gửi email nếu được bật
      if (!notificationSettings.pushNotifications) {
        if (notificationSettings.emailNotifications) {
          await this.sendEmailNotification(user.email, title, message);
        }
        return null; // Không tạo thông báo trong database
      }

      // Nếu push notifications được bật, tạo thông báo bình thường
      const notification = await Notification.create({
        user: userId,
        title,
        message,
        type,
        link,
      });

      // Thêm notification vào user
      await User.findByIdAndUpdate(userId, {
        $push: { notifications: notification._id },
      });

      // Gửi email nếu user bật thông báo email
      if (notificationSettings.emailNotifications) {
        await this.sendEmailNotification(user.email, title, message);
      }

      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  // Tạo thông báo cho một user (admin)
  static async createUserNotification(userId, notificationData) {
    const { title, message, type = "system", link = null } = notificationData;

    // Validate dữ liệu đầu vào
    if (!userId || !title || !message) {
      throw new Error("Thiếu thông tin bắt buộc: userId, title, message");
    }

    const notification = await this.createNotification(userId, {
      title,
      message,
      type,
      link,
    });

    if (!notification) {
      return {
        message: "Thông báo đã của người dùng đã tắt",
      };
    }

    return notification;
  }

  // Tạo thông báo cho nhiều user (admin)
  static async createBulkNotifications(userIds, notificationData) {
    const { title, message, type = "system", link = null } = notificationData;

    // Validate dữ liệu đầu vào
    if (
      !userIds ||
      !Array.isArray(userIds) ||
      userIds.length === 0 ||
      !title ||
      !message
    ) {
      throw new Error(
        "Thiếu thông tin bắt buộc: userIds (mảng), title, message"
      );
    }

    const notifications = [];
    const emailOnlyUsers = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        const notification = await this.createNotification(userId, {
          title,
          message,
          type,
          link,
        });

        if (notification) {
          notifications.push(notification);
        } else {
          emailOnlyUsers.push(userId);
        }
      } catch (error) {
        errors.push({
          userId,
          error: error.message,
        });
      }
    }

    return {
      notifications,
      emailOnlyUsers,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // Gửi email thông báo
  static async sendEmailNotification(email, subject, content) {
    try {
      const mailOptions = {
        from: process.env.NOTIFICATION_SMTP_FROM,
        to: email,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${subject}</h2>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
              ${content}
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              Đây là email tự động từ Quizlingo. Vui lòng không trả lời email này.
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Error sending email notification:", error);
      throw error;
    }
  }

  // Lấy danh sách thông báo của user
  static async getUserNotifications(
    userId,
    { page = 1, limit = 10, unreadOnly = false }
  ) {
    try {
      const query = { user: userId };
      if (unreadOnly) {
        query.isRead = false;
      }

      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await Notification.countDocuments(query);

      return {
        notifications,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("Error getting user notifications:", error);
      throw error;
    }
  }

  // Đánh dấu thông báo đã đọc
  static async markAsRead(notificationId, userId) {
    try {
      // Kiểm tra thông báo tồn tại và thuộc về user
      const notification = await Notification.findOne({
        _id: notificationId,
        user: userId,
      });

      if (!notification) {
        throw new Error("Không tìm thấy thông báo");
      }

      // Update trạng thái đã đọc
      notification.isRead = true;
      await notification.save();

      return notification;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  // Đánh dấu tất cả thông báo đã đọc
  static async markAllAsRead(userId) {
    try {
      // Kiểm tra user tồn tại
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("Không tìm thấy người dùng");
      }

      // Update tất cả thông báo chưa đọc của user
      const result = await Notification.updateMany(
        {
          user: userId,
          isRead: false,
        },
        {
          $set: { isRead: true },
        }
      );

      return {
        success: true,
        modifiedCount: result.modifiedCount,
      };
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  // Cập nhật cài đặt thông báo của user
  static async updateNotificationSettings(userId, settings) {
    try {
      // Kiểm tra user tồn tại
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("Không tìm thấy người dùng");
      }

      // Khởi tạo notificationSettings nếu chưa tồn tại
      if (!user.notificationSettings) {
        user.notificationSettings = {
          emailNotifications: true,
          pushNotifications: true,
        };
      }

      // Update settings
      user.notificationSettings = {
        ...user.notificationSettings,
        ...settings,
      };

      // Lưu user với settings mới
      await user.save();

      return {
        success: true,
        settings: user.notificationSettings,
      };
    } catch (error) {
      console.error("Error updating notification settings:", error);
      throw error;
    }
  }

  // Tạo thông báo cho tất cả user trong hệ thống
  static async createNotificationForAllUsers(notificationData) {
    const { title, message, type = "system", link = null } = notificationData;

    if (!title || !message) {
      throw new Error("Thiếu thông tin bắt buộc: title, message");
    }

    try {
      // Lấy tất cả user trong hệ thống
      const users = await User.find({}, "_id");
      const userIds = users.map((user) => user._id);

      // Sử dụng phương thức createBulkNotifications để gửi cho tất cả user
      const result = await this.createBulkNotifications(userIds, {
        title,
        message,
        type,
        link,
      });

      return {
        success: true,
        totalUsers: userIds.length,
        ...result,
      };
    } catch (error) {
      console.error("Error creating notifications for all users:", error);
      throw error;
    }
  }
  // Tạo thông báo khi user level up
  static async createLevelUpNotification(userId, newUserLevel) {
    try {
      const title = "🎉 Chúc mừng Level Up!";
      const message = `Bạn đã đạt đến cấp độ ${newUserLevel}! Tiếp tục phấn đấu để đạt được những cấp độ cao hơn nhé!`;

      return await this.createNotification(userId, {
        title,
        message,
        type: "achievement",
        link: "/profile",
      });
    } catch (error) {
      console.error("Error creating level up notification:", error);
      throw error;
    }
  }
}

export default NotificationService;
