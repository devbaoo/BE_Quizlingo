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
        const currentYear = new Date().getFullYear();
        const result = await User.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
                        $lt: new Date(`${currentYear + 1}-01-01T00:00:00.000Z`)
                    }
                }
            },
            {
                $group: {
                    _id: { month: { $month: "$createdAt" } },
                    value: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.month": 1 }
            },
            {
                $project: {
                    _id: 0,
                    month: {
                        $concat: ["Tháng ", { $toString: "$_id.month" }]
                    },
                    value: 1
                }
            }
        ]);
        return {
            success: true,
            statusCode: 200,
            message: "Lấy số lượng người dùng theo tháng thành công",
            data: result
        };
    } catch (error) {
        throw error;
    }
}

const totalUserByYear = async () => {
    try {
        const result = await User.aggregate([
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
    getTotalUserByLevel
}