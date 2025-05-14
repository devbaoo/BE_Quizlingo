/**
 * Plugin đơn giản cho soft delete trong Mongoose
 */
const softDeletePlugin = function (schema) {
  // Thêm các trường isDeleted và deletedAt
  schema.add({
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  });

  // Tự động bỏ qua tài liệu đã xóa khi query
  schema.pre(
    ["find", "findOne", "findOneAndUpdate", "count", "countDocuments"],
    function () {
      // Nếu không có điều kiện isDeleted, thêm vào
      if (!this._conditions.hasOwnProperty("isDeleted")) {
        this._conditions.isDeleted = false;
      }
    }
  );

  // Thêm query helper để bao gồm tài liệu đã xóa
  schema.query.includeDeleted = function () {
    delete this._conditions.isDeleted;
    return this;
  };

  // Thêm query helper để chỉ lấy tài liệu đã xóa
  schema.query.onlyDeleted = function () {
    this._conditions.isDeleted = true;
    return this;
  };

  // Ghi đè phương thức deleteOne cho document
  schema.methods.deleteOne = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
  };
};

export default softDeletePlugin;
