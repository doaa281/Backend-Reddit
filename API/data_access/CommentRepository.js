const Repository = require("./repository");
const APIFeatures = require("./apiFeatures");

class CommentRepository extends Repository {
  constructor({ Comment }) {
    super(Comment);
  }

  async addReply(parent, child) {
    await this.model.findByIdAndUpdate(parent, {
      $push: { replies: child },
      $inc: { repliesCount: 1 },
    });
  }

  async removeReply(parent, child) {
    await this.model.findByIdAndUpdate(parent, {
      $pull: { replies: child },
      $inc: { repliesCount: -1 },
    });
  }

  async updateText(id, text) {
    const comment = await this.model.findByIdAndUpdate(
      id,
      { text: text },
      {
        new: true,
        runValidators: true,
      }
    );

    return { success: true, doc: comment };
  }

  async deleteComment(id) {
    //await Post.findByIdAndUpdate(id, {isDeleted: true})
    await this.model.findByIdAndDelete(id);
  }
  async getUserComments(userId, query, popOptions) {
    const features = new APIFeatures(this.model.find({ author: userId }), query)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    // const doc = await features.query.explain();
    let doc = await features.query.populate(popOptions);
    return { success: true, doc: doc };
  }
}
module.exports = CommentRepository;
