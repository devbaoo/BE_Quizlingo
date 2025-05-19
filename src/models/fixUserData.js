import mongoose from 'mongoose';

import User from './user.js';
import Level from './level.js';
import Topic from './topic.js';
import Skill from './skill.js';

async function fixUserData() {
    const users = await User.find();

    for (let user of users) {
        let changed = false;

        // Fix level
        if (typeof user.level === 'string') {
            const levelDoc = await Level.findOne({ name: user.level });
            if (levelDoc) {
                user.level = levelDoc._id;
                changed = true;
            }
        }

        // Fix completedBasicVocab
        if (Array.isArray(user.completedBasicVocab) && typeof user.completedBasicVocab[0] === 'string') {
            const topics = await Topic.find({ name: { $in: user.completedBasicVocab } });
            user.completedBasicVocab = topics.map(t => t._id);
            changed = true;
        }

        // Fix preferredSkills
        if (Array.isArray(user.preferredSkills) && typeof user.preferredSkills[0] === 'string') {
            const skills = await Skill.find({ name: { $in: user.preferredSkills } });
            user.preferredSkills = skills.map(s => s._id);
            changed = true;
        }

        if (changed) {
            await user.save();
            console.log(`✅ Updated user: ${user.email}`);
        }
    }
}

mongoose.connect(`mongodb+srv://admin:Khacbao0712@devbaoo.j8s947t.mongodb.net/quizlingo?retryWrites=true&w=majority`, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('🔗 MongoDB connected');
    fixUserData().then(() => {
        console.log('🎉 All user data fixed');
        mongoose.disconnect();
    });
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
});
