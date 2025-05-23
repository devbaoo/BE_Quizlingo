import cron from "node-cron";
import AutomatedNotificationService from "../services/automatedNotificationService.js";

class Scheduler {
  static start() {
    console.log("[SCHEDULER] Starting automated notification scheduler...");

    // Chạy mỗi ngày lúc 10:00 AM để kiểm tra users không hoạt động
    cron.schedule(
      "0 10 * * *",
      async () => {
        console.log("[SCHEDULER] Running daily inactive users check...");
        try {
          await AutomatedNotificationService.checkAndNotifyInactiveUsers();
        } catch (error) {
          console.error(
            "[SCHEDULER] Error in daily inactive users check:",
            error
          );
        }
      },
      {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh",
      }
    );

    // Chạy thêm một lần vào lúc 6:00 PM để nhắc nhở users học buổi tối
    cron.schedule(
      "0 18 * * *",
      async () => {
        console.log("[SCHEDULER] Running evening inactive users check...");
        try {
          await AutomatedNotificationService.checkAndNotifyInactiveUsers();
        } catch (error) {
          console.error(
            "[SCHEDULER] Error in evening inactive users check:",
            error
          );
        }
      },
      {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh",
      }
    );

    // Chạy mỗi giờ để test trong development (có thể tắt khi production)
    if (process.env.NODE_ENV === "development") {
      cron.schedule(
        "0 * * * *",
        async () => {
          console.log(
            "[SCHEDULER] Running hourly inactive users check (DEV MODE)..."
          );
          try {
            const stats =
              await AutomatedNotificationService.getInactiveUsersStats();
            console.log("[SCHEDULER] Inactive users stats:", stats);
          } catch (error) {
            console.error(
              "[SCHEDULER] Error getting inactive users stats:",
              error
            );
          }
        },
        {
          scheduled: true,
          timezone: "Asia/Ho_Chi_Minh",
        }
      );
    }

    console.log(
      "[SCHEDULER] Automated notification scheduler started successfully!"
    );
    console.log("[SCHEDULER] - Daily check at 10:00 AM");
    console.log("[SCHEDULER] - Evening check at 6:00 PM");

    if (process.env.NODE_ENV === "development") {
      console.log("[SCHEDULER] - Hourly stats check (DEV MODE)");
    }
  }

  // Dừng tất cả scheduled tasks
  static stop() {
    cron.destroy();
    console.log("[SCHEDULER] All scheduled tasks stopped.");
  }

  // Chạy thủ công để test
  static async runManualCheck() {
    console.log("[SCHEDULER] Running manual inactive users check...");
    try {
      const result =
        await AutomatedNotificationService.checkAndNotifyInactiveUsers();
      console.log("[SCHEDULER] Manual check completed:", result);
      return result;
    } catch (error) {
      console.error("[SCHEDULER] Error in manual check:", error);
      throw error;
    }
  }
}

export default Scheduler;
