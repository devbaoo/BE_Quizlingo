import User from "../models/user.js"; 
import Lesson from "../models/lesson.js";
import Level from "../models/level.js";
import Skill from "../models/skill.js";

const totalUser = async () => {
    try {
        const total = await User.countDocuments();
        return total;
    } catch (error) {
        throw error;
    }
}

const totalUserByMonth = async () => {
    try {
        const total = await User.countDocuments({ createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) } });
        return total;
    } catch (error) {
        throw error;
    }
}

const totalUserByYear = async () => {
    try {
        const total = await User.countDocuments({ createdAt: { $gte: new Date(new Date().setYear(new Date().getFullYear() - 1)) } });
        return total;
    } catch (error) {
        throw error;
    }
}

const totalLesson = async () => {
    try {
        const total = await Lesson.countDocuments();
        return total;
    } catch (error) {
        throw error;
    }
}

const totalLevel = async () => {
    try {
        const total = await Level.countDocuments();
        return total;
    } catch (error) {
        throw error;
    }
}

const totalSkill = async () => {
    try {
        const total = await Skill.countDocuments();
        return total;
    } catch (error) {
        throw error;
    }
}


export default {
    totalUser,
    totalUserByMonth,
    totalUserByYear,
    totalLesson,
    totalLevel,
    totalSkill
}