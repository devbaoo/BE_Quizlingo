import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse-new";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service để đọc và parse 4 file PDF giáo trình Triết học Mác-Lênin
 */
class MarxistTextbookService {
  constructor() {
    // Đường dẫn đến folder chứa PDF
    this.documentsPath = path.join(__dirname, "../document");

    // Danh sách 4 file PDF theo thứ tự
    this.pdfFiles = [
      "GT học phần Triết học MLN (K) Tr đầu -Tr59.pdf",
      "GT học phần Triết học MLN (K) Tr 60 -Tr130.pdf",
      "GT học phần Triết học MLN (K) Tr131-Tr229.pdf",
      "GT học phần Triết học MLN (K) Tr 230-Tr274.pdf",
    ];

    // Cache cho nội dung đã parse
    this.textbookCache = new Map();
    this.lastCacheTime = null;
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Đọc nội dung từ một file PDF
   * @param {string} filePath - Đường dẫn file PDF
   * @returns {Promise<string>} Nội dung text từ PDF
   */
  async readPDF(filePath) {
    try {
      console.log(`📖 Reading PDF: ${path.basename(filePath)}`);

      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      console.log(
        `✅ Successfully read ${data.numpages} pages from ${path.basename(
          filePath
        )}`
      );
      return data.text;
    } catch (error) {
      console.error(`❌ Error reading PDF ${filePath}:`, error.message);
      return "";
    }
  }

  /**
   * Đọc tất cả 4 file PDF giáo trình
   * @param {boolean} forceRefresh - Bắt buộc đọc lại từ file
   * @returns {Promise<Object>} Object chứa nội dung từ 4 file
   */
  async getAllTextbookContent(forceRefresh = false) {
    try {
      // Kiểm tra cache
      const now = Date.now();
      if (
        !forceRefresh &&
        this.lastCacheTime &&
        now - this.lastCacheTime < this.cacheExpiry &&
        this.textbookCache.size > 0
      ) {
        console.log("📚 Using cached textbook content");
        return Object.fromEntries(this.textbookCache);
      }

      console.log("📚 Loading all Marxist Philosophy textbook content...");
      const textbookContent = {};

      for (let i = 0; i < this.pdfFiles.length; i++) {
        const fileName = this.pdfFiles[i];
        const filePath = path.join(this.documentsPath, fileName);

        // Kiểm tra file tồn tại
        if (!fs.existsSync(filePath)) {
          console.warn(`⚠️ PDF file not found: ${filePath}`);
          textbookContent[`section_${i + 1}`] = "";
          continue;
        }

        const content = await this.readPDF(filePath);
        const sectionKey = `section_${i + 1}`;
        textbookContent[sectionKey] = {
          fileName: fileName,
          pageRange: this.getPageRange(fileName),
          content: content,
          wordCount: content.split(/\s+/).length,
          length: content.length,
        };

        // Cache individual section
        this.textbookCache.set(sectionKey, textbookContent[sectionKey]);

        console.log(
          `✅ Loaded section ${i + 1}: ${fileName} (${
            textbookContent[sectionKey].wordCount
          } words)`
        );
      }

      this.lastCacheTime = now;
      console.log("📚 All textbook content loaded successfully");

      return textbookContent;
    } catch (error) {
      console.error("❌ Error loading textbook content:", error);
      return {};
    }
  }

  /**
   * Trích xuất page range từ tên file
   * @param {string} fileName - Tên file PDF
   * @returns {string} Page range
   */
  getPageRange(fileName) {
    if (fileName.includes("Tr đầu -Tr59")) return "Trang đầu - 59";
    if (fileName.includes("Tr 60 -Tr130")) return "Trang 60 - 130";
    if (fileName.includes("Tr131-Tr229")) return "Trang 131 - 229";
    if (fileName.includes("Tr 230-Tr274")) return "Trang 230 - 274";
    return "Unknown range";
  }

  /**
   * Lấy nội dung theo chủ đề cụ thể
   * @param {string} topicKeywords - Từ khóa chủ đề cần tìm
   * @returns {Promise<Object>} Nội dung liên quan đến chủ đề
   */
  async getContentByTopic(topicKeywords) {
    try {
      console.log(`🔍 Searching textbook content for topic: ${topicKeywords}`);

      const allContent = await this.getAllTextbookContent();
      const relevantContent = {};

      // Tìm kiếm nội dung liên quan trong từng section
      for (const [sectionKey, sectionData] of Object.entries(allContent)) {
        if (!sectionData.content) continue;

        const content = sectionData.content.toLowerCase();
        const keywords = topicKeywords.toLowerCase().split(/[\s,]+/);

        // Tìm các đoạn văn chứa keywords
        const paragraphs = sectionData.content.split(/\n\s*\n/);
        const relevantParagraphs = [];

        for (const paragraph of paragraphs) {
          const paragraphLower = paragraph.toLowerCase();
          const hasKeyword = keywords.some(
            (keyword) => keyword.length > 2 && paragraphLower.includes(keyword)
          );

          if (hasKeyword && paragraph.trim().length > 50) {
            relevantParagraphs.push(paragraph.trim());
          }
        }

        if (relevantParagraphs.length > 0) {
          relevantContent[sectionKey] = {
            fileName: sectionData.fileName,
            pageRange: sectionData.pageRange,
            relevantParagraphs: relevantParagraphs.slice(0, 10), // Limit to 10 most relevant
            totalParagraphs: relevantParagraphs.length,
          };
        }
      }

      console.log(
        `✅ Found relevant content in ${
          Object.keys(relevantContent).length
        } sections`
      );
      return relevantContent;
    } catch (error) {
      console.error("❌ Error getting content by topic:", error);
      return {};
    }
  }

  /**
   * Fallback knowledge base khi PDF không extract được text
   * @returns {Object} Structured knowledge base
   */
  getMarxistKnowledgeBase() {
    return {
      duy_vat_bien_chung: {
        title: "Chủ nghĩa duy vật biện chứng",
        content: `
        Chủ nghĩa duy vật biện chứng là học thuyết triết học của chủ nghĩa Mác-Lênin về những quy luật vận động, phát triển chung nhất của tự nhiên, xã hội và tư duy.
        
        Những đặc điểm cơ bản:
        1. Tính duy vật: Thế giới là vật chất, ý thức là sản phẩm của vật chất
        2. Tính biện chứng: Mọi sự vật đều vận động, phát triển theo quy luật biện chứng
        3. Tính cách mạng: Phủ định cái cũ để sinh ra cái mới
        
        Ba quy luật cơ bản:
        - Quy luật thống nhất và đấu tranh của các mặt đối lập
        - Quy luật chuyển hóa từ những thay đổi về lượng thành những thay đổi về chất
        - Quy luật phủ định của phủ định
        `,
      },
      nhan_thuc_luan: {
        title: "Nhận thức luận Mác-Lênin",
        content: `
        Nhận thức luận Mác-Lênin nghiên cứu về bản chất, nguồn gốc, quá trình phát triển của nhận thức con người.
        
        Những quan điểm cơ bản:
        1. Nhận thức là quá trình phản ánh thế giới khách quan vào ý thức chủ quan
        2. Thực tiễn là cơ sở, động lực và mục đích của nhận thức
        3. Thực tiễn là tiêu chuẩn để kiểm tra chân lý
        
        Quá trình nhận thức:
        - Giai đoạn cảm tính: Cảm giác, tri giác, biểu tượng
        - Giai đoạn lý tính: Khái niệm, phán đoán, suy lý
        - Từ nhận thức đến thực tiễn
        `,
      },
      the_gioi_quan: {
        title: "Thế giới quan duy vật",
        content: `
        Thế giới quan duy vật khẳng định thế giới là vật chất, tồn tại khách quan, độc lập với ý thức con người.
        
        Những nguyên lý cơ bản:
        1. Thế giới là thống nhất trong vật chất
        2. Vật chất có tính khách quan
        3. Vật chất luôn vận động
        4. Không gian và thời gian là hình thức tồn tại của vật chất
        
        Ý thức:
        - Là thuộc tính của vật chất có tổ chức cao
        - Có tính năng động phản ánh thế giới khách quan
        - Có tác dụng tích cực trở lại với thế giới khách quan
        `,
      },
      quy_luat_bien_chung: {
        title: "Các quy luật biện chứng",
        content: `
        1. QUY LUẬT THỐNG NHẤT VÀ ĐẤU TRANH CỦA CÁC MẶT ĐỐI LẬP:
        - Mâu thuẫn là nguồn gốc của mọi vận động, phát triển
        - Các mặt đối lập vừa thống nhất vừa đấu tranh
        - Đấu tranh của các mặt đối lập là động lực phát triển
        
        2. QUY LUẬT CHUYỂN HÓA TỪ LƯỢNG THÀNH CHẤT:
        - Lượng và chất thống nhất biện chứng với nhau
        - Sự thay đổi về lượng dẫn đến thay đổi về chất
        - Bước nhảy là hình thức chuyển từ lượng sang chất
        
        3. QUY LUẬT PHỦ ĐỊNH CỦA PHỦ ĐỊNH:
        - Phủ định biện chứng khác với phủ định siêu hình
        - Phủ định là điều kiện cần thiết cho sự phát triển
        - Sự phát triển có tính chất xoay tròn nhưng trên cơ sở cao hơn
        `,
      },
      categories_bien_chung: {
        title: "Các cặp phạm trù biện chứng",
        content: `
        1. BẢN CHẤT VÀ HIỆN TƯỢNG:
        - Bản chất là mặt bên trong, ổn định của sự vật
        - Hiện tượng là mặt bên ngoài, biến động của sự vật
        - Chúng thống nhất biện chứng với nhau
        
        2. NGUYÊN NHÂN VÀ KẾT QUẢ:
        - Nguyên nhân sinh ra kết quả
        - Kết quả có thể trở thành nguyên nhân của hiện tượng khác
        - Mối quan hệ nhân quả có tính khách quan
        
        3. CẦN THIẾT VÀ NGẪU NHIÊN:
        - Cần thiết là điều không thể không xảy ra
        - Ngẫu nhiên là điều có thể xảy ra hoặc không
        - Cần thiết thể hiện qua ngẫu nhiên
        
        4. KHẮNG NĂNG VÀ HIỆN THỰC:
        - Khả năng là điều có thể trở thành hiện thực
        - Hiện thực là khả năng đã được thực hiện
        - Từ hiện thực sinh ra khả năng mới
        
        5. NỘI DUNG VÀ HÌNH THỨC:
        - Nội dung quyết định hình thức
        - Hình thức có tác dụng tích cực với nội dung
        - Khi nội dung thay đổi, hình thức cũng phải thay đổi
        `,
      },
      logic_bien_chung: {
        title: "Phương pháp luận biện chứng",
        content: `
        Phương pháp luận biện chứng là hệ thống các nguyên tắc và phương pháp tư duy, nhận thức và hoạt động thực tiễn.
        
        Các nguyên tắc cơ bản:
        1. Nguyên tắc khách quan: Xuất phát từ thực tế khách quan
        2. Nguyên tắc toàn diện: Xem xét sự vật trong mối liên hệ toàn diện
        3. Nguyên tắc phát triển: Xem xét sự vật trong vận động, phát triển
        4. Nguyên tắc lịch sử cụ thể: Xem xét sự vật trong hoàn cảnh lịch sử cụ thể
        
        Các phương pháp nhận thức:
        - Phân tích và tổng hợp
        - Quy nạp và diễn dịch  
        - Trừu tượng hóa và cụ thể hóa
        - Logic và lịch sử
        `,
      },
    };
  }

  /**
   * Lấy context từ knowledge base khi PDF không đọc được
   * @param {string} topicKeywords - Từ khóa chủ đề
   * @param {number} maxLength - Độ dài tối đa
   * @returns {string} Context từ knowledge base
   */
  getKnowledgeBasedContext(topicKeywords, maxLength = 2500) {
    try {
      console.log(`📖 Using fallback knowledge base for: ${topicKeywords}`);

      const knowledgeBase = this.getMarxistKnowledgeBase();
      const keywords = topicKeywords.toLowerCase().split(/[\s,]+/);

      let context =
        "📚 NỘI DUNG THAM KHẢO TỪ GIÁO TRÌNH TRIẾT HỌC MÁC-LÊNIN:\n\n";
      let currentLength = context.length;
      let sectionsAdded = 0;

      // Tìm các section phù hợp với keywords
      const relevantSections = [];

      for (const [key, section] of Object.entries(knowledgeBase)) {
        const sectionText = `${section.title} ${section.content}`.toLowerCase();
        const relevanceScore = keywords.reduce((score, keyword) => {
          if (keyword.length > 2 && sectionText.includes(keyword)) {
            return score + 1;
          }
          return score;
        }, 0);

        if (relevanceScore > 0) {
          relevantSections.push({ key, section, score: relevanceScore });
        }
      }

      // Sắp xếp theo điểm relevance
      relevantSections.sort((a, b) => b.score - a.score);

      // Thêm nội dung các section phù hợp nhất
      for (const { section } of relevantSections.slice(0, 3)) {
        const sectionText = `📋 ${
          section.title
        }:\n${section.content.trim()}\n\n`;

        if (currentLength + sectionText.length > maxLength) {
          // Cắt ngắn nếu quá dài
          const remainingLength = maxLength - currentLength - 100;
          if (remainingLength > 200) {
            context += `📋 ${section.title}:\n${section.content
              .trim()
              .substring(0, remainingLength)}...\n\n`;
          }
          break;
        }

        context += sectionText;
        currentLength += sectionText.length;
        sectionsAdded++;

        if (sectionsAdded >= 3) break;
      }

      // Nếu không tìm thấy section nào phù hợp, thêm overview
      if (sectionsAdded === 0) {
        const overviewSections = [
          "duy_vat_bien_chung",
          "nhan_thuc_luan",
          "quy_luat_bien_chung",
        ];
        for (const key of overviewSections) {
          if (knowledgeBase[key]) {
            const section = knowledgeBase[key];
            const sectionText = `📋 ${section.title}:\n${section.content
              .trim()
              .substring(0, 800)}...\n\n`;

            if (currentLength + sectionText.length > maxLength) break;

            context += sectionText;
            currentLength += sectionText.length;
            sectionsAdded++;
          }
        }
      }

      console.log(
        `✅ Generated ${currentLength} chars from knowledge base (${sectionsAdded} sections)`
      );
      return context.substring(0, maxLength);
    } catch (error) {
      console.error("❌ Error generating knowledge-based context:", error);
      return "📚 Triết học Mác-Lênin nghiên cứu về quy luật vận động, phát triển chung nhất của tự nhiên, xã hội và tư duy. Bao gồm chủ nghĩa duy vật biện chứng và nhận thức luận Mác-Lênin.";
    }
  }
  /**
   * Lấy context summary cho AI generation
   * @param {string} topicKeywords - Từ khóa chủ đề
   * @param {number} maxLength - Độ dài tối đa của context
   * @returns {Promise<string>} Context summary cho AI
   */
  async getContextForAI(topicKeywords, maxLength = 3000) {
    try {
      console.log(`🤖 Preparing context for AI generation: ${topicKeywords}`);

      const relevantContent = await this.getContentByTopic(topicKeywords);

      // Kiểm tra xem có nội dung thực sự từ PDF không
      const hasRealContent = Object.values(relevantContent).some(
        (section) =>
          section.relevantParagraphs &&
          section.relevantParagraphs.length > 0 &&
          section.relevantParagraphs.some((p) => p.trim().length > 50)
      );

      if (!hasRealContent || Object.keys(relevantContent).length === 0) {
        console.log("⚠️ No meaningful PDF content found, using knowledge base");
        return this.getKnowledgeBasedContext(topicKeywords, maxLength);
      }

      let context = `📚 NỘI DUNG TỪ GIÁO TRÌNH TRIẾT HỌC MÁC-LÊNIN:\n\n`;
      let currentLength = context.length;

      // Thêm nội dung từ các section có liên quan
      for (const [sectionKey, sectionData] of Object.entries(relevantContent)) {
        const sectionHeader = `[${sectionData.pageRange}] ${sectionData.fileName}\n`;

        if (currentLength + sectionHeader.length > maxLength) break;

        context += sectionHeader;
        currentLength += sectionHeader.length;

        // Thêm các đoạn văn liên quan
        for (const paragraph of sectionData.relevantParagraphs) {
          const paragraphText = `${paragraph}\n\n`;

          if (currentLength + paragraphText.length > maxLength) break;

          context += paragraphText;
          currentLength += paragraphText.length;
        }

        if (currentLength >= maxLength * 0.9) break; // Stop at 90% of max length
      }

      console.log(
        `✅ Context prepared: ${currentLength} characters from ${
          Object.keys(relevantContent).length
        } sections`
      );
      return context;
    } catch (error) {
      console.error("❌ Error preparing context for AI:", error);
      console.log("🔄 Falling back to knowledge base...");
      return this.getKnowledgeBasedContext(topicKeywords, maxLength);
    }
  }

  /**
   * Lấy context tổng quát khi không tìm thấy nội dung cụ thể
   * @param {number} maxLength - Độ dài tối đa
   * @returns {Promise<string>} General context
   */
  async getGeneralContext(maxLength = 1500) {
    try {
      const allContent = await this.getAllTextbookContent();
      let context = `📚 TỔNG QUAN GIÁO TRÌNH TRIẾT HỌC MÁC-LÊNIN:\n\n`;

      // Lấy đoạn đầu từ mỗi section làm context chung
      for (const [sectionKey, sectionData] of Object.entries(allContent)) {
        if (!sectionData.content) continue;

        const firstParagraphs = sectionData.content
          .split(/\n\s*\n/)
          .slice(0, 2)
          .join("\n\n")
          .substring(0, 300);

        context += `[${sectionData.pageRange}]: ${firstParagraphs}...\n\n`;

        if (context.length > maxLength) break;
      }

      return context.substring(0, maxLength);
    } catch (error) {
      console.error("❌ Error getting general context:", error);
      return "";
    }
  }

  /**
   * Lấy thống kê nội dung giáo trình
   * @returns {Promise<Object>} Statistics
   */
  async getTextbookStats() {
    try {
      const allContent = await this.getAllTextbookContent();
      const stats = {
        totalSections: Object.keys(allContent).length,
        sections: {},
        totalWords: 0,
        totalCharacters: 0,
        lastUpdated: this.lastCacheTime ? new Date(this.lastCacheTime) : null,
      };

      for (const [sectionKey, sectionData] of Object.entries(allContent)) {
        stats.sections[sectionKey] = {
          fileName: sectionData.fileName,
          pageRange: sectionData.pageRange,
          wordCount: sectionData.wordCount,
          characterCount: sectionData.length,
          hasContent: sectionData.content && sectionData.content.length > 0,
        };

        stats.totalWords += sectionData.wordCount || 0;
        stats.totalCharacters += sectionData.length || 0;
      }

      return stats;
    } catch (error) {
      console.error("❌ Error getting textbook stats:", error);
      return { error: error.message };
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.textbookCache.clear();
    this.lastCacheTime = null;
    console.log("🗑️ Textbook cache cleared");
  }
}

// Export singleton instance
const marxistTextbookService = new MarxistTextbookService();
export default marxistTextbookService;
