import User from "../models/user.js";
import moment from "moment-timezone";

// Constants for rewards
const DAILY_REWARDS = {
  XP: 50,
  POINTS: 100,
};

const SPECIAL_REWARDS = {
  DAY_7: {
    name: "iPhone 17 Pro Max",
    type: "physical_item",
    description: "Phần thưởng đặc biệt cho 7 ngày điểm danh liên tiếp",
  },
};

/**
 * Process daily check-in for user
 * @param {string} userId - User ID
 * @returns {Object} - Result object
 */
const processDailyCheckIn = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    const now = moment().tz("Asia/Ho_Chi_Minh");
    const today = now.startOf("day");

    // Check if user already checked in today
    if (
      user.lastCheckInDate &&
      moment(user.lastCheckInDate).tz("Asia/Ho_Chi_Minh").isSame(today, "day")
    ) {
      return {
        success: false,
        statusCode: 400,
        message: "Bạn đã điểm danh hôm nay rồi",
        data: {
          lastCheckIn: user.lastCheckInDate,
          consecutiveCheckIns: user.consecutiveCheckIns,
          totalCheckIns: user.totalCheckIns,
        },
      };
    }

    // Check if this is a consecutive check-in (yesterday or today)
    const yesterday = moment(today).subtract(1, "days");
    const isConsecutive =
      user.lastCheckInDate &&
      moment(user.lastCheckInDate)
        .tz("Asia/Ho_Chi_Minh")
        .isSameOrAfter(yesterday, "day");

    // Update check-in data
    user.lastCheckInDate = now.toDate();
    user.totalCheckIns += 1;

    // Handle consecutive check-ins
    if (isConsecutive) {
      user.consecutiveCheckIns += 1;
    } else {
      user.consecutiveCheckIns = 1; // Reset streak if not consecutive
    }

    // Add XP and points
    user.xp += DAILY_REWARDS.XP;

    // Check for special rewards
    let specialReward = null;
    if (user.consecutiveCheckIns === 7) {
      specialReward = SPECIAL_REWARDS.DAY_7;

      // Add to user's reward list
      user.checkInRewards.push({
        day: 7,
        claimed: true,
        rewardType: "physical_item",
        rewardValue: 1,
        claimedAt: now.toDate(),
      });
    }

    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: "Điểm danh thành công",
      data: {
        xpEarned: DAILY_REWARDS.XP,
        pointsEarned: DAILY_REWARDS.POINTS,
        consecutiveCheckIns: user.consecutiveCheckIns,
        totalCheckIns: user.totalCheckIns,
        specialReward: specialReward,
        nextSpecialReward:
          user.consecutiveCheckIns < 7
            ? {
                day: 7,
                daysLeft: 7 - user.consecutiveCheckIns,
                reward: SPECIAL_REWARDS.DAY_7,
              }
            : null,
      },
    };
  } catch (error) {
    console.error("Process daily check-in error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xử lý điểm danh",
    };
  }
};

/**
 * Get user check-in status
 * @param {string} userId - User ID
 * @returns {Object} - Result object
 */
const getCheckInStatus = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    const now = moment().tz("Asia/Ho_Chi_Minh");
    const today = now.startOf("day");

    // Check if user already checked in today
    const hasCheckedInToday =
      user.lastCheckInDate &&
      moment(user.lastCheckInDate).tz("Asia/Ho_Chi_Minh").isSame(today, "day");

    return {
      success: true,
      statusCode: 200,
      message: "Lấy thông tin điểm danh thành công",
      data: {
        hasCheckedInToday,
        lastCheckIn: user.lastCheckInDate,
        consecutiveCheckIns: user.consecutiveCheckIns,
        totalCheckIns: user.totalCheckIns,
        rewards: user.checkInRewards,
        nextSpecialReward:
          user.consecutiveCheckIns < 7
            ? {
                day: 7,
                daysLeft: 7 - user.consecutiveCheckIns,
                reward: SPECIAL_REWARDS.DAY_7,
              }
            : null,
      },
    };
  } catch (error) {
    console.error("Get check-in status error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy thông tin điểm danh",
    };
  }
};

export default {
  processDailyCheckIn,
  getCheckInStatus,
  DAILY_REWARDS,
  SPECIAL_REWARDS,
};
