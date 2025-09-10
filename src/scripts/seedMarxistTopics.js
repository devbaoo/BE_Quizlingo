import mongoose from 'mongoose';
import MarxistTopic from '../models/marxistTopic.js';
import dotenv from 'dotenv';

dotenv.config();

// Kết nối database
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/quizlingo";
        await mongoose.connect(mongoURI);
        console.log('✅ Database connected');
    } catch (error) {
        console.error('❌ Database connection error:', error);
        process.exit(1);
    }
};

// Dữ liệu chủ đề triết học Mác-Lê-Nin
const defaultTopics = [
    {
        name: 'duy_vat_bien_chung',
        title: 'Duy vật biện chứng',
        description: 'Phương pháp luận triết học Mác-xít về quy luật biến đổi và phát triển của thế giới',
        keywords: ['duy vật', 'biện chứng', 'quy luật', 'nhận thức', 'thực tiễn', 'mâu thuẫn'],
        suggestedDifficulty: 3,
        suggestedQuestionCount: 10,
        displayOrder: 1
    },
    {
        name: 'duy_vat_lich_su',
        title: 'Duy vật lịch sử',
        description: 'Quan niệm duy vật về lịch sử xã hội và quy luật phát triển xã hội',
        keywords: ['lịch sử', 'xã hội', 'hình thái', 'cơ sở', 'thượng tầng', 'ý thức xã hội'],
        suggestedDifficulty: 4,
        suggestedQuestionCount: 10,
        displayOrder: 2
    },
    {
        name: 'nhan_thuc_luan',
        title: 'Nhận thức luận',
        description: 'Lý thuyết về quá trình nhận thức thế giới và vai trò của thực tiễn trong nhận thức',
        keywords: ['nhận thức', 'thực tiễn', 'chân lý', 'kiến thức', 'kinh nghiệm', 'cảm tính'],
        suggestedDifficulty: 3,
        suggestedQuestionCount: 10,
        displayOrder: 3
    },
    {
        name: 'quy_luat_mau_thuan',
        title: 'Quy luật mâu thuẫn',
        description: 'Quy luật thống nhất và đấu tranh của các mặt đối lập trong sự vật',
        keywords: ['mâu thuẫn', 'đối lập', 'thống nhất', 'đấu tranh', 'phủ định', 'chuyển hóa'],
        suggestedDifficulty: 4,
        suggestedQuestionCount: 10,
        displayOrder: 4
    },
    {
        name: 'quy_luat_luong_chat',
        title: 'Quy luật lượng chất',
        description: 'Quy luật chuyển hóa từ những thay đổi về lượng thành thay đổi về chất',
        keywords: ['lượng', 'chất', 'độ', 'bước nhảy', 'tích lũy', 'chuyển hóa'],
        suggestedDifficulty: 3,
        suggestedQuestionCount: 10,
        displayOrder: 5
    },
    {
        name: 'quy_luat_phu_dinh',
        title: 'Quy luật phủ định của phủ định',
        description: 'Quy luật về sự phát triển theo hình xoắn ốc của sự vật, hiện tượng',
        keywords: ['phủ định', 'khẳng định', 'xoắn ốc', 'phát triển', 'tiến bộ', 'tương lai'],
        suggestedDifficulty: 4,
        suggestedQuestionCount: 10,
        displayOrder: 6
    },
    {
        name: 'con_nguoi_va_xa_hoi',
        title: 'Con người và xã hội',
        description: 'Quan niệm Mác-xít về bản chất con người và mối quan hệ cá nhân - xã hội',
        keywords: ['con người', 'bản chất', 'xã hội', 'cá nhân', 'quan hệ xã hội', 'hoạt động'],
        suggestedDifficulty: 2,
        suggestedQuestionCount: 10,
        displayOrder: 7
    },
    {
        name: 'y_thuc_xa_hoi',
        title: 'Ý thức xã hội',
        description: 'Lý thuyết về ý thức xã hội, các hình thái ý thức xã hội và vai trò của chúng',
        keywords: ['ý thức', 'tồn tại', 'hình thái', 'tư tưởng', 'văn hóa', 'tôn giáo'],
        suggestedDifficulty: 3,
        suggestedQuestionCount: 10,
        displayOrder: 8
    },
    {
        name: 'giai_cap_va_dau_tranh_giai_cap',
        title: 'Giai cấp và đấu tranh giai cấp',
        description: 'Lý thuyết về sự hình thành giai cấp và đấu tranh giai cấp trong xã hội',
        keywords: ['giai cấp', 'đấu tranh', 'vô sản', 'tư sản', 'lợi ích', 'mâu thuẫn'],
        suggestedDifficulty: 3,
        suggestedQuestionCount: 10,
        displayOrder: 9
    },
    {
        name: 'nha_nuoc_va_cach_mang',
        title: 'Nhà nước và cách mạng',
        description: 'Quan niệm về nhà nước, cách mạng xã hội và sự chuyển đổi xã hội',
        keywords: ['nhà nước', 'cách mạng', 'chuyên chính', 'dân chủ', 'quyền lực', 'chính trị'],
        suggestedDifficulty: 4,
        suggestedQuestionCount: 10,
        displayOrder: 10
    }
];

// Hàm seed dữ liệu
const seedTopics = async () => {
    try {
        console.log('🌱 Đang seed dữ liệu chủ đề triết học Mác-Lê-Nin...');

        // Tạo admin user giả để làm createdBy
        const fakeAdminId = new mongoose.Types.ObjectId();

        const created = [];
        const skipped = [];

        for (const topicData of defaultTopics) {
            const existing = await MarxistTopic.findOne({ name: topicData.name });

            if (existing) {
                skipped.push(topicData.name);
                continue;
            }

            const topic = await MarxistTopic.create({
                ...topicData,
                createdBy: fakeAdminId
            });

            created.push(topic.name);
            console.log(`✅ Đã tạo chủ đề: ${topic.title}`);
        }

        console.log('\n📊 Kết quả seed:');
        console.log(`✅ Đã tạo: ${created.length} chủ đề`);
        console.log(`⏭️  Bỏ qua: ${skipped.length} chủ đề (đã tồn tại)`);

        if (created.length > 0) {
            console.log('\n📝 Chủ đề đã tạo:');
            created.forEach((name, index) => {
                const topic = defaultTopics.find(t => t.name === name);
                console.log(`${index + 1}. ${topic.title} (${name})`);
            });
        }

        if (skipped.length > 0) {
            console.log('\n📝 Chủ đề bỏ qua:');
            skipped.forEach((name, index) => {
                const topic = defaultTopics.find(t => t.name === name);
                console.log(`${index + 1}. ${topic.title} (${name})`);
            });
        }

    } catch (error) {
        console.error('❌ Lỗi khi seed topics:', error);
        throw error;
    }
};

// Chạy script
const main = async () => {
    try {
        await connectDB();
        await seedTopics();
        console.log('\n🎉 Hoàn thành seed dữ liệu triết học Mác-Lê-Nin!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Script thất bại:', error);
        process.exit(1);
    }
};

// Chạy script nếu được gọi trực tiếp
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { seedTopics, defaultTopics };