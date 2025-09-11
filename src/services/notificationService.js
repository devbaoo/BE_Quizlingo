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
      console.log("[DEBUG] Creating push notification");
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
        console.log("[DEBUG] Sending email notification");
        await this.sendEmailNotification(user.email, title, message);
      }

      return notification;
    } catch (error) {
      console.error("[DEBUG] Error in createNotification:", error);
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
      console.log("[DEBUG] Attempting to send email to:", email);
      const mailOptions = {
        from: process.env.NOTIFICATION_SMTP_FROM,
        to: email,
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            </style>
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; line-height: 1.6;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 0;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden; margin: 0 auto;">
                    
                    <!-- Header với gradient -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                        <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 10px 0; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                          🐧 MarxEdu
                        </h1>
                        <p style="color:rgb(10, 10, 10); font-size: 16px; margin: 0; font-weight: 600;">
                          Học Triết học thông minh mỗi ngày
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Content chính -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <h2 style="color: #1e293b; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                          ${subject}
                        </h2>
                        
                        <div style="background: #ffffff; padding: 30px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #667eea; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                          <div style="color: #000000; font-size: 16px; line-height: 1.8; font-weight: 500;">
                            ${content}
                          </div>
                        </div>
                        
                        <!-- Call to Action Button -->
                        <div style="text-align: center; margin: 30px 0;">
                          <a href="https://marx-edu.netlify.app/philosophy" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); transition: all 0.3s ease;">
                            🚀 Bắt đầu học ngay
                          </a>
                        </div>                       
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                        <p style="color:rgb(0, 0, 0); font-size: 14px; margin: 10px 0;">
                          <strong>MarxEdu Team</strong><br>
                          Cùng bạn chinh phục Triết học mỗi ngày! 🌟
                        </p>
                        
                        <!-- Social media icons placeholder -->
                        <div style="margin-top: 20px;">
                          <span style="display: inline-block; margin: 0 5px; font-size: 20px;">📘</span>
                          <span style="display: inline-block; margin: 0 5px; font-size: 20px;">📷</span>
                          <span style="display: inline-block; margin: 0 5px; font-size: 20px;">🐦</span>
                          <span style="display: inline-block; margin: 0 5px; font-size: 20px;">📺</span>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
    } catch (error) {
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

      const result = await this.createNotification(userId, {
        title,
        message,
        type: "level_up",
        link: "/profile",
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  // Gửi email thông báo cho inactive users với template đặc biệt
  static async sendInactiveReminderEmail(
    email,
    subject,
    content,
    userName = "bạn",
    daysInactive = 1
  ) {
    try {
      console.log("[DEBUG] Sending inactive reminder email to:", email);

      // Chọn emoji và màu sắc dựa trên số ngày inactive
      let headerEmoji = "📚";
      let gradientColors = "#667eea 0%, #764ba2 100%";
      let motivationText = "Hãy quay lại học tiếp nhé!";

      if (daysInactive <= 1) {
        headerEmoji = "📚";
        gradientColors = "#10b981 0%, #059669 100%";
        motivationText = "Streak của bạn đang chờ đấy!";
      } else if (daysInactive <= 3) {
        headerEmoji = "⏰";
        gradientColors = "#f59e0b 0%, #d97706 100%";
        motivationText = "Đừng để kỹ năng bị lãng quên!";
      } else if (daysInactive <= 7) {
        headerEmoji = "🎯";
        gradientColors = "#ef4444 0%, #dc2626 100%";
        motivationText = "Chúng mình nhớ bạn lắm!";
      } else {
        headerEmoji = "🌟";
        gradientColors = "#8b5cf6 0%, #7c3aed 100%";
        motivationText = "Chào mừng bạn quay lại!";
      }

      const mailOptions = {
        from: process.env.NOTIFICATION_SMTP_FROM,
        to: email,
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            </style>
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; line-height: 1.6;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 0;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden; margin: 0 auto;">
                    
                    <!-- Header với gradient động -->
                    <tr>
                      <td style="background: linear-gradient(135deg, ${gradientColors}); padding: 40px 30px; text-align: center;">
                        <div style="font-size: 60px; margin-bottom: 20px;">
                          ${headerEmoji}
                        </div>
                        <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 10px 0; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                          MarxEdu
                        </h1>
                        <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin: 0; font-weight: 500;">
                          ${motivationText}
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Content chính -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <h2 style="color: #1e293b; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                          Chào ${userName}! 👋
                        </h2>
                        
                        <div style="background: #ffffff; padding: 30px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #667eea; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                          <div style="color: #000000; font-size: 16px; line-height: 1.8; font-weight: 500;">
                            ${content}
                          </div>
                        </div>
                        
                        <!-- Streak info -->
                        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%); padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center;">
                          <div style="font-size: 18px; font-weight: 600; color:rgb(92, 24, 1); margin-bottom: 10px;">
                            🔥 Bạn đã nghỉ ${daysInactive} ngày
                          </div>
                          <div style="font-size: 14px; color:rgb(113, 34, 7);">
                            Hãy quay lại để duy trì streak học tập của mình!
                          </div>
                        </div>
                        
                        <!-- Call to Action Button -->
                        <div style="text-align: center; margin: 30px 0;">
                          <a href="https://marx-edu.netlify.app/philosophy" style="display: inline-block; background: linear-gradient(135deg, ${gradientColors}); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); transition: all 0.3s ease;">
                            🚀 Bắt đầu học ngay
                          </a>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                        <p style="color: #1e293b; font-size: 14px; margin: 10px 0;">
                          <strong>💫 MarxEdu Team</strong><br>
                          Cùng bạn chinh phục Triết học mỗi ngày!
                        </p>

                        
                        <p style="color: #334155; font-size: 12px; margin: 15px 0 0 0; line-height: 1.5;">
                          Đây là email nhắc nhở học tập từ MarxEdu.<br>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      };

      console.log("[DEBUG] Inactive reminder email prepared for:", email);
      const info = await transporter.sendMail(mailOptions);
      console.log(
        "[DEBUG] Inactive reminder email sent successfully:",
        info.messageId
      );
    } catch (error) {
      console.error("[DEBUG] Error sending inactive reminder email:", error);
      throw error;
    }
  }

  // Tạo thông báo đặc biệt cho inactive reminders với email template nâng cao
  static async createInactiveReminderNotification(
    userId,
    { title, message, type = "reminder", link = null },
    daysInactive = 1
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
          await this.sendInactiveReminderEmail(
            user.email,
            title,
            message,
            user.firstName,
            daysInactive
          );
        }
        return null; // Không tạo thông báo trong database
      }

      // Nếu push notifications được bật, tạo thông báo bình thường
      console.log("[DEBUG] Creating inactive reminder push notification");
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

      // Gửi email với template đặc biệt nếu user bật thông báo email
      if (notificationSettings.emailNotifications) {
        console.log("[DEBUG] Sending enhanced inactive reminder email");
        await this.sendInactiveReminderEmail(
          user.email,
          title,
          message,
          user.firstName,
          daysInactive
        );
      }

      return notification;
    } catch (error) {
      console.error(
        "[DEBUG] Error in createInactiveReminderNotification:",
        error
      );
      throw error;
    }
  }

  static async getNotificationSetting(userId) {
    try {
      // Kiểm tra user tồn tại
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("Không tìm thấy người dùng");
      }
      // Trả về cài đặt thông báo của user
      return user.notificationSettings;
    } catch (error) {
      console.error("[DEBUG] Error in getNotificationSetting:", error);
      throw error;
    }
  }
}

export default NotificationService;
