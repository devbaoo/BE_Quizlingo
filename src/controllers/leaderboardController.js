import leaderboardService from "../services/leaderboardService.js";

const leaderboardController = {
  getLeaderboard: async (req, res) => {
    try {
      const result = await leaderboardService.getLeaderboard();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy dữ liệu leaderboard",
        error: error.message,
      });
    }
  },
};

export default leaderboardController;
