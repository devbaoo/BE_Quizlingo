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

// Dữ liệu chủ đề mặc định
const defaultTopics = [
    {
        name: 'chu_nghia_tu_ban',
        title: 'Chủ nghĩa tư bản',
        description: 'Lý thuyết về chế độ tư bản chủ nghĩa, mâu thuẫn cơ bản của chủ nghĩa tư bản',
        keywords: ['tư bản', 'công nhân', 'bóc lột', 'thặng dư', 'tích lũy', 'khủng hoảng kinh tế'],
        suggestedDifficulty: 2,
        displayOrder: 1
    },
    {
        name: 'gia_tri_thang_du',
        title: 'Giá trị thặng dư',
        description: 'Học thuyết về giá trị thặng dư - nguồn gốc lợi nhuận của nhà tư bản',
        keywords: ['lao động', 'giá trị sử dụng', 'giá trị trao đổi', 'thời gian lao động', 'thặng dư tuyệt đối', 'thặng dư tương đối'],
        suggestedDifficulty: 3,
        displayOrder: 2
    },
    {
        name: 'dau_tranh_giai_cap',
        title: 'Đấu tranh giai cấp',
        description: 'Lý thuyết về đấu tranh giai cấp trong xã hội',
        keywords: ['giai cấp', 'vô sản', 'tư sản', 'đấu tranh', 'cách mạng', 'nhà nước'],
        suggestedDifficulty: 2,
        displayOrder: 3
    },
    {
        name: 'cong_hoa_xa_hoi_chu_nghia',
        title: 'Cộng hòa xã hội chủ nghĩa',
        description: 'Lý thuyết về nhà nước và chính trị trong xã hội xã hội chủ nghĩa',
        keywords: ['nhà nước', 'chuyên chính', 'dân chủ', 'công hòa', 'xã hội chủ nghĩa', 'quyền lực'],
        suggestedDifficulty: 3,
        displayOrder: 4
    },
    {
        name: 'dang_cong_san',
        title: 'Đảng cộng sán',
        description: 'Vai trò và sứ mệnh của Đảng cộng sản trong cách mạng',
        keywords: ['đảng', 'lãnh đạo', 'tổ chức', 'cương lĩnh', 'chiến lược', 'chiến thuật'],
        suggestedDifficulty: 2,
        displayOrder: 5
    },
    {
        name: 'cach_mang_vo_san',
        title: 'Cách mạng vô sản',
        description: 'Lý thuyết về cách mạng xã hội chủ nghĩa',
        keywords: ['cách mạng', 'vô sản', 'bạo lực', 'hòa bình', 'chuyển đổi', 'xã hội mới'],
        suggestedDifficulty: 4,
        displayOrder: 6
    },
    {
        name: 'kinh_te_chinh_tri',
        title: 'Kinh tế chính trị',
        description: 'Những quy luật kinh tế cơ bản của chủ nghĩa Mác',
        keywords: ['sản xuất', 'phân phối', 'lưu thông', 'tiêu dùng', 'quan hệ sản xuất', 'lực lượng sản xuất'],
        suggestedDifficulty: 3,
        displayOrder: 7
    },
    {
        name: 'chu_nghia_xa_hoi',
        title: 'Chủ nghĩa xã hội',
        description: 'Lý thuyết về xã hội xã hội chủ nghĩa và cộng sản chủ nghĩa',
        keywords: ['xã hội chủ nghĩa', 'cộng sản chủ nghĩa', 'sở hữu chung', 'phân phối', 'lao động'],
        suggestedDifficulty: 3,
        displayOrder: 8
    },
    {
        name: 'duy_vat_bien_chung',
        title: 'Duy vật biện chứng',
        description: 'Phương pháp luận Mác-xít về nhận thức và thực tiễn',
        keywords: ['mâu thuẫn', 'phủ định', 'lượng chất', 'thực tiễn', 'nhận thức', 'quy luật'],
        suggestedDifficulty: 4,
        displayOrder: 9
    },
    {
        name: 'duy_vat_lich_su',
        title: 'Duy vật lịch sử',
        description: 'Quan niệm Mác-xít về sự phát triển của xã hội loài người',
        keywords: ['hình thái kinh tế xã hội', 'cơ sở hạ tầng', 'kiến trúc thượng tầng', 'ý thức xã hội', 'tồn tại xã hội'],
        suggestedDifficulty: 5,
        displayOrder: 10
    }
];

// Hàm seed dữ liệu
const seedTopics = async () => {
    try {
        console.log('🌱 Đang seed dữ liệu chủ đề Marxist...');

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
        console.log('\n🎉 Hoàn thành seed dữ liệu!');
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