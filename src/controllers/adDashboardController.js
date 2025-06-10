import adminService from "../services/adminService.js";

const totalUser = async (req, res) => {
  try {
    const result = await adminService.totalUser();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy dữ liệu leaderboard",
      error: error.message,
    });
  }
};
const totalUserByMonth = async (req, res) => {
  try {
    const result = await adminService.totalUserByMonth();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy dữ liệu leaderboard",
      error: error.message,
    });
  }
};

const totalUserByYear = async (req, res) => { 
  try {
    const result = await adminService.totalUserByYear();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy dữ liệu leaderboard",
      error: error.message,
    });
  }
};

const totalLesson = async (req, res) => {
  try {
    const result = await adminService.totalLesson();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy dữ liệu leaderboard",
      error: error.message,
    });
  }
};

const totalLevel = async (req, res) => {
  try {
    const result = await adminService.totalLevel();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy dữ liệu leaderboard",
      error: error.message,
    });
  }
};

const totalSkill = async (req, res) => {
  try {
    const result = await adminService.totalSkill();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy dữ liệu leaderboard",
      error: error.message,
    });
  }
};

export default {
  totalUser,
  totalUserByMonth,
  totalUserByYear,
  totalLesson,
  totalLevel,
  totalSkill,
};
