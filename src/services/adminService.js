import User from "../models/user.js"; 
import Lesson from "../models/lesson.js";
import Level from "../models/level.js";
import Skill from "../models/skill.js";
import UserPackage from "../models/userPackage.js";

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

const totalUserByMonth = async (year) => {
    try {
        const currentYear = new Date().getFullYear();
        const parsedYear = Number.parseInt(year, 10);
        const targetYear = Number.isNaN(parsedYear) ? currentYear : parsedYear;

        const startOfYear = new Date(Date.UTC(targetYear, 0, 1));
        const startOfNextYear = new Date(Date.UTC(targetYear + 1, 0, 1));

        const aggregation = await User.aggregate([
            {
                $match: {
                    isDeleted: false,
                    createdAt: {
                        $gte: startOfYear,
                        $lt: startOfNextYear
                    }
                }
            },
            {
                $group: {
                    _id: { month: { $month: "$createdAt" } },
                    value: { $sum: 1 }
                }
            }
        ]);

        const monthlyMap = aggregation.reduce((accumulator, current) => {
            accumulator[current._id.month] = current.value;
            return accumulator;
        }, {});

        const monthlyData = Array.from({ length: 12 }, (_, index) => ({
            month: `Tháng ${index + 1}`,
            value: monthlyMap[index + 1] ?? 0
        }));

        return {
            success: true,
            statusCode: 200,
            message: "Lấy số lượng người dùng theo tháng thành công",
            data: monthlyData,
            meta: {
                year: targetYear
            }
        };
    } catch (error) {
        throw error;
    }
}

const totalUserByYear = async () => {
    try {
        const result = await User.aggregate([
            {
                $match: { isDeleted: false }
            },
            {
                $group: {
                    _id: { year: { $year: "$createdAt" } },
                    value: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.year": 1 }
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    value: 1
                }
            }
        ]);
        return {
            success: true,
            statusCode: 200,
            message: "Lấy số lượng người dùng theo năm thành công",
            data: result
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

const totalRevenue = async ({ startDate, endDate } = {}) => {
    try {
        const matchConditions = {
            paymentStatus: "completed"
        };

        if (startDate || endDate) {
            matchConditions.createdAt = {};
            if (startDate) {
                const parsedStart = new Date(startDate);
                if (!Number.isNaN(parsedStart.getTime())) {
                    matchConditions.createdAt.$gte = parsedStart;
                }
            }
            if (endDate) {
                const parsedEnd = new Date(endDate);
                if (!Number.isNaN(parsedEnd.getTime())) {
                    matchConditions.createdAt.$lte = parsedEnd;
                }
            }
            if (Object.keys(matchConditions.createdAt).length === 0) {
                delete matchConditions.createdAt;
            }
        }

        const aggregation = await UserPackage.aggregate([
            { $match: matchConditions },
            {
                $group: {
                    _id: null,
                    value: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = aggregation[0] ?? { value: 0, count: 0 };

        return {
            success: true,
            statusCode: 200,
            message: "Lấy doanh thu thành công",
            totalRevenue: result.value,
            completedTransactions: result.count
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
                    value: { $sum: 1 }
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
                $unwind: {
                    path: "$levelInfo",
                    preserveNullAndEmptyArrays: false
                }
            },
            {
                $project: {
                    _id: 1,
                    type: "$levelInfo.name",
                    value: 1
                }
            },
            {
                $sort: { type: 1 }
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
                    type: "$skillInfo.name",
                    value: "$count"
                }
            },
            {
                $sort: { "type": 1 }
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
    getTotalUserByLevel,
    totalRevenue
}
