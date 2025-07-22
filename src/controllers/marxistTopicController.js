import MarxistTopic from '../models/marxistTopic.js';

/**
 * Tạo chủ đề Marxist mới
 * POST /api/marxist-topics
 */
const createTopic = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Yêu cầu đăng nhập'
            });
        }

        const {
            name,
            title,
            description,
            keywords,
            suggestedDifficulty,
            suggestedQuestionCount,
            displayOrder
        } = req.body;

        // Validation
        if (!name || !title || !description) {
            return res.status(400).json({
                success: false,
                message: 'name, title và description là bắt buộc'
            });
        }

        // Kiểm tra name đã tồn tại
        const existingTopic = await MarxistTopic.findOne({ name: name.toLowerCase() });
        if (existingTopic) {
            return res.status(409).json({
                success: false,
                message: 'Tên chủ đề đã tồn tại'
            });
        }

        const topic = await MarxistTopic.create({
            name: name.toLowerCase().replace(/\s+/g, '_'),
            title,
            description,
            keywords: keywords || [],
            suggestedDifficulty: suggestedDifficulty || 2,
            suggestedQuestionCount: suggestedQuestionCount || 30,
            displayOrder: displayOrder || 0,
            createdBy: userId
        });

        return res.status(201).json({
            success: true,
            message: 'Tạo chủ đề thành công',
            topic: {
                id: topic._id,
                name: topic.name,
                title: topic.title,
                description: topic.description,
                keywords: topic.keywords,
                suggestedDifficulty: topic.suggestedDifficulty,
                suggestedQuestionCount: topic.suggestedQuestionCount,
                displayOrder: topic.displayOrder,
                createdAt: topic.createdAt
            }
        });

    } catch (error) {
        console.error('Create Marxist topic error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo chủ đề'
        });
    }
};

/**
 * Lấy danh sách chủ đề Marxist
 * GET /api/marxist-topics
 */
const getTopics = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, isActive = true } = req.query;

        const query = {};
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [topics, total] = await Promise.all([
            MarxistTopic.find(query)
                .select('name title description keywords suggestedDifficulty suggestedQuestionCount displayOrder totalLessonsGenerated averageScore isActive createdAt')
                .sort({ displayOrder: 1, createdAt: 1 })
                .skip(skip)
                .limit(parseInt(limit)),
            MarxistTopic.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách chủ đề thành công',
            topics,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                pageSize: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Get Marxist topics error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách chủ đề'
        });
    }
};

/**
 * Lấy chi tiết chủ đề
 * GET /api/marxist-topics/:id
 */
const getTopicById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const topic = await MarxistTopic.findById(id)
            .populate('createdBy', 'name email');

        if (!topic) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chủ đề'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Lấy chi tiết chủ đề thành công',
            topic
        });

    } catch (error) {
        console.error('Get Marxist topic by ID error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy chi tiết chủ đề'
        });
    }
};

/**
 * Cập nhật chủ đề
 * PUT /api/marxist-topics/:id
 */
const updateTopic = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Yêu cầu đăng nhập'
            });
        }

        const topic = await MarxistTopic.findById(id);
        if (!topic) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chủ đề'
            });
        }

        const {
            title,
            description,
            keywords,
            suggestedDifficulty,
            suggestedQuestionCount,
            displayOrder,
            isActive
        } = req.body;

        // Cập nhật các trường
        if (title) topic.title = title;
        if (description) topic.description = description;
        if (keywords !== undefined) topic.keywords = keywords;
        if (suggestedDifficulty) topic.suggestedDifficulty = suggestedDifficulty;
        if (suggestedQuestionCount) topic.suggestedQuestionCount = suggestedQuestionCount;
        if (displayOrder !== undefined) topic.displayOrder = displayOrder;
        if (isActive !== undefined) topic.isActive = isActive;

        await topic.save();

        return res.status(200).json({
            success: true,
            message: 'Cập nhật chủ đề thành công',
            topic: {
                id: topic._id,
                name: topic.name,
                title: topic.title,
                description: topic.description,
                keywords: topic.keywords,
                suggestedDifficulty: topic.suggestedDifficulty,
                suggestedQuestionCount: topic.suggestedQuestionCount,
                displayOrder: topic.displayOrder,
                isActive: topic.isActive,
                updatedAt: topic.updatedAt
            }
        });

    } catch (error) {
        console.error('Update Marxist topic error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật chủ đề'
        });
    }
};

/**
 * Xóa chủ đề (soft delete - set isActive = false)
 * DELETE /api/marxist-topics/:id
 */
const deleteTopic = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Yêu cầu đăng nhập'
            });
        }

        const topic = await MarxistTopic.findById(id);
        if (!topic) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chủ đề'
            });
        }

        // Soft delete
        topic.isActive = false;
        await topic.save();

        return res.status(200).json({
            success: true,
            message: 'Xóa chủ đề thành công'
        });

    } catch (error) {
        console.error('Delete Marxist topic error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi xóa chủ đề'
        });
    }
};

/**
 * Seed dữ liệu chủ đề mặc định (cho admin)
 * POST /api/marxist-topics/seed
 */
const seedDefaultTopics = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Yêu cầu đăng nhập'
            });
        }

        const defaultTopics = [
            {
                name: 'chu_nghia_tu_ban',
                title: 'Chủ nghĩa tư bản',
                description: 'Lý thuyết về chế độ tư bản chủ nghĩa, mâu thuẫn cơ bản của chủ nghĩa tư bản',
                keywords: ['tư bản', 'công nhân', 'bóc lột', 'thặng dư', 'tích lũy', 'khủng hoảng kinh tế'],
                suggestedDifficulty: 2,
                displayOrder: 1,
                createdBy: userId
            },
            {
                name: 'gia_tri_thang_du',
                title: 'Giá trị thặng dư',
                description: 'Học thuyết về giá trị thặng dư - nguồn gốc lợi nhuận của nhà tư bản',
                keywords: ['lao động', 'giá trị sử dụng', 'giá trị trao đổi', 'thời gian lao động', 'thặng dư tuyệt đối', 'thặng dư tương đối'],
                suggestedDifficulty: 3,
                displayOrder: 2,
                createdBy: userId
            },
            {
                name: 'dau_tranh_giai_cap',
                title: 'Đấu tranh giai cấp',
                description: 'Lý thuyết về đấu tranh giai cấp trong xã hội',
                keywords: ['giai cấp', 'vô sản', 'tư sản', 'đấu tranh', 'cách mạng', 'nhà nước'],
                suggestedDifficulty: 2,
                displayOrder: 3,
                createdBy: userId
            },
            {
                name: 'cong_hoa_xa_hoi_chu_nghia',
                title: 'Cộng hòa xã hội chủ nghĩa',
                description: 'Lý thuyết về nhà nước và chính trị trong xã hội xã hội chủ nghĩa',
                keywords: ['nhà nước', 'chuyên chính', 'dân chủ', 'công hòa', 'xã hội chủ nghĩa', 'quyền lực'],
                suggestedDifficulty: 3,
                displayOrder: 4,
                createdBy: userId
            },
            {
                name: 'dang_cong_san',
                title: 'Đảng cộng sản',
                description: 'Vai trò và sứ mệnh của Đảng cộng sản trong cách mạng',
                keywords: ['đảng', 'lãnh đạo', 'tổ chức', 'cương lĩnh', 'chiến lược', 'chiến thuật'],
                suggestedDifficulty: 2,
                displayOrder: 5,
                createdBy: userId
            },
            {
                name: 'cach_mang_vo_san',
                title: 'Cách mạng vô sản',
                description: 'Lý thuyết về cách mạng xã hội chủ nghĩa',
                keywords: ['cách mạng', 'vô sản', 'bạo lực', 'hòa bình', 'chuyển đổi', 'xã hội mới'],
                suggestedDifficulty: 4,
                displayOrder: 6,
                createdBy: userId
            },
            {
                name: 'kinh_te_chinh_tri',
                title: 'Kinh tế chính trị',
                description: 'Những quy luật kinh tế cơ bản của chủ nghĩa Mác',
                keywords: ['sản xuất', 'phân phối', 'lưu thông', 'tiêu dùng', 'quan hệ sản xuất', 'lực lượng sản xuất'],
                suggestedDifficulty: 3,
                displayOrder: 7,
                createdBy: userId
            },
            {
                name: 'chu_nghia_xa_hoi',
                title: 'Chủ nghĩa xã hội',
                description: 'Lý thuyết về xã hội xã hội chủ nghĩa và cộng sản chủ nghĩa',
                keywords: ['xã hội chủ nghĩa', 'cộng sản chủ nghĩa', 'sở hữu chung', 'phân phối', 'lao động'],
                suggestedDifficulty: 3,
                displayOrder: 8,
                createdBy: userId
            },
            {
                name: 'duy_vat_bien_chung',
                title: 'Duy vật biện chứng',
                description: 'Phương pháp luận Mác-xít về nhận thức và thực tiễn',
                keywords: ['mâu thuẫn', 'phủ định', 'lượng chất', 'thực tiễn', 'nhận thức', 'quy luật'],
                suggestedDifficulty: 4,
                displayOrder: 9,
                createdBy: userId
            },
            {
                name: 'duy_vat_lich_su',
                title: 'Duy vật lịch sử',
                description: 'Quan niệm Mác-xít về sự phát triển của xã hội loài người',
                keywords: ['hình thái kinh tế xã hội', 'cơ sở hạ tầng', 'kiến trúc thượng tầng', 'ý thức xã hội', 'tồn tại xã hội'],
                suggestedDifficulty: 5,
                displayOrder: 10,
                createdBy: userId
            }
        ];

        const created = [];
        for (const topicData of defaultTopics) {
            const existing = await MarxistTopic.findOne({ name: topicData.name });
            if (!existing) {
                const topic = await MarxistTopic.create(topicData);
                created.push(topic.name);
            }
        }

        return res.status(201).json({
            success: true,
            message: `Tạo ${created.length} chủ đề mặc định thành công`,
            createdTopics: created
        });

    } catch (error) {
        console.error('Seed default topics error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo dữ liệu mặc định'
        });
    }
};

export default {
    createTopic,
    getTopics,
    getTopicById,
    updateTopic,
    deleteTopic,
    seedDefaultTopics
}; 