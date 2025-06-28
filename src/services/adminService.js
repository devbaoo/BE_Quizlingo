import User from "../models/user.js"; 
import Lesson from "../models/lesson.js";
import Level from "../models/level.js";
import Skill from "../models/skill.js";

const totalUser = async () => {
    try {
        const total = await User.countDocuments();
        return {
            success: true,
            statusCode: 200,
            message: "Lấy số lượng người dùng thành công",
            total
        };
    } catch (error) {
        throw error;
    }
}

const totalUserByMonth = async () => {
    try {
        const currentDate = new Date();
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        const thisMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        const total = await User.countDocuments({ 
            createdAt: { 
                $gte: lastMonth,
                $lt: thisMonth
            } 
        });
        
        const monthName = lastMonth.toLocaleString('vi-VN', { month: 'long', year: 'numeric' });
        
        return {
            success: true,
            statusCode: 200,
            message: "Lấy số lượng người dùng theo tháng thành công",
            data: {
                month: monthName,
                total: total
            }
        };
    } catch (error) {
        throw error;
    }
}

const totalUserByYear = async () => {
    try {
        const currentDate = new Date();
        const lastYear = new Date(currentDate.getFullYear() - 1, 0, 1);
        const thisYear = new Date(currentDate.getFullYear(), 0, 1);
        
        const total = await User.countDocuments({ 
            createdAt: { 
                $gte: lastYear,
                $lt: thisYear
            } 
        });
        
        const year = lastYear.getFullYear();
        
        return {
            success: true,
            statusCode: 200,
            message: "Lấy số lượng người dùng theo năm thành công",
            data: {
                year: year,
                total: total
            }
        };
    } catch (error) {
        throw error;
    }
}

const totalLesson = async () => {
    try {
        const total = await Lesson.countDocuments();
        return {
            success: true,
            statusCode: 200,
            message: "Lấy số lượng bài học thành công",
            total
        };
    } catch (error) {
        throw error;
    }
}

const totalLevel = async () => {
    try {
        const total = await Level.countDocuments();
        return {
            success: true,
            statusCode: 200,
            message: "Lấy số lượng cấp độ thành công",
            total
        };
    } catch (error) {
        throw error;
    }
}

const totalSkill = async () => {
    try {
        const total = await Skill.countDocuments();
        return {
            success: true,
            statusCode: 200,
            message: "Lấy số lượng kỹ năng thành công",
            total
        };
    } catch (error) {
        throw error;
    }
}

const getTotalUserByLevel = async () => {
    try {
        const result = await User.aggregate([
            {
                $match: {
                    level: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: "$level",
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: "levels",
                    localField: "_id",
                    foreignField: "_id",
                    as: "levelInfo"
                }
            },
            {
                $unwind: "$levelInfo"
            },
            {
                $project: {
                    level: {
                        _id: "$levelInfo._id",
                        name: "$levelInfo.name",
                        description: "$levelInfo.description"
                    },
                    total: "$count"
                }
            },
            {
                $sort: { "level.name": 1 }
            }
        ]);

        return {
            success: true,
            statusCode: 200,
            message: "Lấy số lượng người dùng theo cấp độ thành công",
            data: result
        };
    } catch (error) {
        throw error;
    }
}

const getTotalUserBySkill = async () => {
    try {
        const result = await User.aggregate([
            {
                $match: {
                    preferredSkills: { $exists: true, $ne: [] }
                }
            },
            {
                $unwind: "$preferredSkills"
            },
            {
                $group: {
                    _id: "$preferredSkills",
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: "skills",
                    localField: "_id",
                    foreignField: "_id",
                    as: "skillInfo"
                }
            },
            {
                $unwind: "$skillInfo"
            },
            {
                $project: {
                    skill: {
                        _id: "$skillInfo._id",
                        name: "$skillInfo.name",
                        description: "$skillInfo.description"
                    },
                    total: "$count"
                }
            },
            {
                $sort: { "skill.name": 1 }
            }
        ]);

        return {
            success: true,
            statusCode: 200,
            message: "Lấy số lượng người dùng theo kỹ năng thành công",
            data: result
        };
    } catch (error) {
        throw error;
    }
}

export default {
    getTotalUserBySkill,
    totalUser,
    totalUserByMonth,
    totalUserByYear,
    totalLesson,
    totalLevel,
    totalSkill,
    getTotalUserByLevel
}