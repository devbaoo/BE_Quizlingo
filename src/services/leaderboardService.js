import Progress from "../models/progress.js";

const leaderboardService = {
  getLeaderboard: async () => {
    try {
      const leaderboard = await Progress.aggregate([
        {
          $group: {
            _id: "$userId",
            totalScore: { $sum: "$score" },
            completedLessons: { $sum: 1 },
          },
        },
        {
          $sort: { totalScore: -1 }, // Sort by total score in descending order
        },
        {
          $limit: 100, // Limit to top 100 users
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        {
          $unwind: "$userInfo",
        },
        {
          $project: {
            _id: 1,
            totalScore: 1,
            completedLessons: 1,
            firstName: "$userInfo.firstName",
            lastName: "$userInfo.lastName",
            avatar: "$userInfo.avatar",
            email: "$userInfo.email",
          },
        },
      ]);

      return {
        success: true,
        data: leaderboard,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

export default leaderboardService;
