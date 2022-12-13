const { Dir } = require("fs");
const {
  postErrors,
  subredditErrors,
  postActions,
} = require("../error_handling/errors");

class PostController {
  constructor({ PostService, UserService }) {
    this.postServices = PostService;
    this.userServices = UserService;
  }

  createPost = async (req, res) => {
    const data = req.body;
    data.author = req.user._id;

    const validReq = data.ownerType && data.kind && data.title;
    if (!validReq) {
      res.status(400).json({
        status: "fail",
        message: "Invalid request",
      });
      return;
    }

    const post = await this.postServices.createPost(data);

    if (!post.success) {
      let msg, stat;
      switch (post.error) {
        case postErrors.INVALID_POST_KIND:
          msg = "Invalid post kind";
          stat = 400;
          break;
        case postErrors.INVALID_OWNER:
          msg = "Invalid owner type";
          stat = 400;
          break;
        case postErrors.SUBREDDIT_NOT_FOUND:
          msg = "Subreddit not found";
          stat = 404;
          break;
        case postErrors.FLAIR_NOT_FOUND:
          msg = "Flair not found";
          stat = 404;
          break;
        case postErrors.MONGO_ERR:
          msg = post.msg;
          stat = 400;
      }
      res.status(stat).json({
        status: "fail",
        message: msg,
      });
      return;
    }

    res.status(201).json({
      status: "success",
      data: post.data,
    });
  };

  deletePost = async (req, res) => {
    //validate request params
    const id = req.params?.postId;
    if (!req.params || !id) {
      res.status(400).json({
        status: "fail",
        message: "Missing required parameter postId",
      });
      return;
    }

    const post = await this.postServices.deletePost(id, req.user._id);

    if (!post.success) {
      let msg, stat;
      switch (post.error) {
        case postErrors.NOT_AUTHOR:
          msg = "User must be author";
          stat = 401;
          break;
        case postErrors.POST_NOT_FOUND:
          msg = "Post not found";
          stat = 404;
          break;
      }
      res.status(stat).json({
        status: "fail",
        message: msg,
      });
      return;
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  };

  updatePost = async (req, res) => {
    const id = req.params?.postId;
    const data = req.body;
    if (!id || !data.text) {
      res.status(400).json({
        status: "fail",
        message: "Invalid request",
      });
      return;
    }

    const post = await this.postServices.updatePost(id, data, req.user._id);

    if (!post.success) {
      let msg, stat;
      switch (post.error) {
        case postErrors.NOT_EDITABLE:
          msg = "Post isn't editable";
          stat = 400;
          break;
        case postErrors.NOT_AUTHOR:
          msg = "User must be author";
          stat = 401;
          break;
        case postErrors.POST_NOT_FOUND:
          msg = "Post not found";
          stat = 404;
          break;
        case postErrors.MONGO_ERR:
          msg = post.msg;
          stat = 400;
      }
      res.status(stat).json({
        status: "fail",
        message: msg,
      });
      return;
    }

    res.status(200).json({
      status: "success",
      data: post.data,
    });
  };
  /**
   * @property {Function} userPosts  get created posts by user
   * @param {object} req - request object sent by client
   * @param {object} res - response to client
   * @param {Function} next -  function to execute next middleware
   * @returns void
   */
  userPosts = async (req, res, next) => {
    // i have user id
    let me = req.user;
    if (!req.params.userName) {
      res.status(400).json({
        status: "fail",
        errorMessage: "Provide userName ",
      });
    } else {
      let sortType = "New";
      if (req.query.sort) {
        sortType = req.query.sort;
      }
      const userName = req.params.userName;
      let user = await this.userServices.getUserByName(userName, "");
      // get id of user with its name
      if (user.success === true) {
        let userId = user.data._id;

        // check if this user block me or i blocked him in order to show posts , TODO

        // get post which he creates
        let posts = await this.postServices.getUserPosts(userId, sortType);
        // get vote of me if these post i vote on it
        posts = this.postServices.setVotePostStatus(me, posts);
        posts = this.postServices.setSavedPostStatus(me, posts);
        posts = this.postServices.setHiddenPostStatus(me, posts);
        posts = this.postServices.setPostOwnerData(posts);
        //console.log(posts[0]);

        res.status(200).json({
          status: "success",
          posts: posts,
        });
      } else {
        res.status(404).json({
          status: "fail",
          errorMessage: "User Not Found",
        });
      }
    }
  };
  /**
   *
   * @property {Function} getSavedPosts  get saved posts of user
   * @param {object} req - request object sent by client
   * @param {object} res - response to client
   * @param {Function} next -  function to execute next middleware
   * @returns void
   */
  getSavedPosts = async (req, res, next) => {
    let me = req.user;

    // check if the owner of post block me or i blocked him in order to show posts , TODO

    // get post which he creates
    await me.populate("saved", "-__v");
    //await me.saved.populate("owner");
    // get vote of me if these post i vote on it
    //posts = this.postServices.setVotePostStatus(me, posts);
    let posts = this.postServices.setVotePostStatus(me, me.saved);
    posts = this.postServices.removeHiddenPosts(me, posts);
    posts = this.postServices.setPostOwnerData(posts);
    res.status(200).json({
      status: "success",
      posts: posts,
    });
  };
  /**
   * @property {Function} getHiddenPosts get hidden posts of user
   * @param {object} req - request object sent by client
   * @param {object} res - response to client
   * @param {Function} next -  function to execute next middleware
   * @returns void
   */
  getHiddenPosts = async (req, res, next) => {
    let me = req.user;

    // check if the owner of post block me or i blocked him in order to show posts , TODO

    // get post which he creates
    await me.populate("hidden", "-__v");
    // get vote of me if these post i vote on it
    //posts = this.postServices.setVotePostStatus(me, posts);
    let posts = this.postServices.setVotePostStatus(me, me.hidden);
    posts = this.postServices.setPostOwnerData(posts);
    res.status(200).json({
      status: "success",
      posts: posts,
    });
  };
  /**
   * @property {Function} userUpvotedPosts  get upvoted posts of user
   * @param {object} req - request object sent by client
   * @param {object} res - response to client
   * @param {Function} next -  function to execute next middleware
   * @returns void
   */
  userUpvotedPosts = async (req, res, next) => {
    let me = req.user;

    // check if the owner of post block me or i blocked him in order to show posts , TODO

    // get post which he creates
    await me.populate("votePost.posts", "-__v");
    // get vote of me if these post i vote on it
    //let posts = this.postServices.setVotePostStatus(me, me.votePost);
    let posts = this.postServices.selectPostsWithVotes(me.votePost, "1");
    posts = this.postServices.setSavedPostStatus(me, posts);
    posts = this.postServices.setHiddenPostStatus(me, posts);
    posts = this.postServices.setPostOwnerData(posts);
    res.status(200).json({
      status: "success",
      posts: posts,
    });
  };
  /**
   *
   * @property {Function} userDownvotedPosts get downvoted posts of user
   * @param {object} req - request object sent by client
   * @param {object} res - response to client
   * @param {Function} next -  function to execute next middleware
   * @returns void
   */
  userDownvotedPosts = async (req, res, next) => {
    let me = req.user;

    // check if the owner of post block me or i blocked him in order to show posts , TODO
    await me.populate("votePost.posts", "-__v");
    // get vote of me if these post i vote on it
    //let posts = this.postServices.setVotePostStatus(me, me.votePost);
    let posts = this.postServices.selectPostsWithVotes(me.votePost, "-1");
    posts = this.postServices.setSavedPostStatus(me, posts);
    posts = this.postServices.setHiddenPostStatus(me, posts);
    posts = this.postServices.setPostOwnerData(posts);
    res.status(200).json({
      status: "success",
      posts: posts,
    });
  };

  getHotPosts = async (req, res) => {
    try {
      //req.query.sort = "-createdAt,-votes,-commentCount";
      let sortType = "hot";
      let me = req.isAuthorized == true ? req.user : undefined;

      //console.log(req.user);
      //let posts;
      // if (req.user) {
      //   // let hiddenPostsIds = await req.user.populate("hidden");
      //   // console.log(hiddenPostsIds);
      //    posts = await this.postServices.getPosts(req.query, req.toFilter,req.user);
      // }
      // else {
      let posts = await this.postServices.getPosts(
        req.query,
        req.toFilter,
        me,
        sortType
      );

      // }
      if (!posts.success) {
        let message, statusCode, status;
        switch (posts.error) {
          case subredditErrors.SUBREDDIT_NOT_FOUND:
            message = "Subreddit not found";
            statusCode = 404;
            status = "Not Found";
            break;
          case subredditErrors.MONGO_ERR:
            message = "Internal server error";
            statusCode = 500;
            status = "Internal Server Error";
            break;
        }
        return res.status(statusCode).json({
          status: status,
          message: message,
        });
      }

      res.status(200).json({
        status: "OK",
        data: posts.data,
      });
    } catch (err) {
      console.log("error in subredditservices " + err);
      res.status(500).json({
        status: "fail",
      });
    }
  };
  getNewPosts = async (req, res) => {
    try {
      //req.query.sort = "-createdAt";
      //console.log(req.query);

      let sortType = "new";
      let me = req.isAuthorized == true ? req.user : undefined;
      let posts = await this.postServices.getPosts(
        req.query,
        req.toFilter,
        me,
        sortType
      );

      if (!posts.success) {
        let message, statusCode, status;
        switch (posts.error) {
          case subredditErrors.SUBREDDIT_NOT_FOUND:
            message = "Subreddit not found";
            statusCode = 404;
            status = "Not Found";
            break;
          case subredditErrors.MONGO_ERR:
            message = "Internal server error";
            statusCode = 500;
            status = "Internal Server Error";
            break;
        }
        return res.status(statusCode).json({
          status: status,
          message: message,
        });
      }

      res.status(200).json({
        status: "OK",
        data: posts.data,
      });
    } catch (err) {
      console.log("error in subredditservices " + err);
      res.status(500).json({
        status: "fail",
      });
    }
  };
  getTopPosts = async (req, res) => {
    try {
      //req.query.sort = "-votes";
      //console.log(req.query);

      let me = req.isAuthorized == true ? req.user : undefined;

      let sortType = "top";
      // let filter = (req.toFilter) ? req.toFilter : {};
      let posts = await this.postServices.getPosts(
        req.query,
        req.toFilter,
        me,
        sortType
      );

      if (!posts.success) {
        let message, statusCode, status;
        switch (posts.error) {
          case subredditErrors.SUBREDDIT_NOT_FOUND:
            message = "Subreddit not found";
            statusCode = 404;
            status = "Not Found";
            break;
          case subredditErrors.MONGO_ERR:
            message = "Internal server error";
            statusCode = 500;
            status = "Internal Server Error";
            break;
        }
        return res.status(statusCode).json({
          status: status,
          message: message,
        });
      }
      // if (req.user)
      // {
      //   let me = req.user;

      //   posts = this.postServices.setVotePostStatus(me, posts);
      //   console.log(posts);
      //   posts = this.postServices.setSavedPostStatus(me, posts);
      //   posts = this.postServices.setHiddenPostStatus(me, posts);
      //   posts = this.postServices.removeHiddenPosts(me, posts);
      //   posts = this.postServices.setPostOwnerData(posts);

      //   }

      res.status(200).json({
        status: "OK",
        data: posts.data,
      });
    } catch (err) {
      console.log("error in subredditservices " + err);
      res.status(500).json({
        status: "fail",
      });
    }
  };
  getBestPosts = async (req, res) => {
    try {
      //req.query.sort = "-createdAt,-votes,-commentCount,-shareCount";

      let sortType = "best";
      // check if the owner of post block me or i blocked him in order to show posts , TODO

      let me = req.isAuthorized == true ? req.user : undefined;

      // get post which he creates

      let posts = await this.postServices.getPosts(
        req.query,
        req.toFilter,
        me,
        sortType
      );

      if (!posts.success) {
        let message, statusCode, status;
        switch (posts.error) {
          case subredditErrors.SUBREDDIT_NOT_FOUND:
            message = "Subreddit not found";
            statusCode = 404;
            status = "Not Found";
            break;
          case subredditErrors.MONGO_ERR:
            message = "Internal server error";
            statusCode = 500;
            status = "Internal Server Error";
            break;
        }
        return res.status(statusCode).json({
          status: status,
          message: message,
        });
      }

      res.status(200).json({
        status: "OK",
        data: posts.data,
      });
    } catch (err) {
      console.log("error in subredditservices " + err);
      res.status(500).json({
        status: "fail",
      });
    }
  };
  getPost = async (req, res) => {
    let postId = req.params.postId;
let me =(req.isAuthorized==true)?req.user:undefined;
    if (!postId) {
      res.status(400).json({
        status: "fail",
        message: "Missing required parameter",
      });
      return;
    }
    try {
      let post = await this.postServices.getPost(postId,me);
      if (!post.success) {
        let message, statusCode, status;
        switch (post.error) {
          case postErrors.POST_NOT_FOUND:
            message = "Post not found";
            statusCode = 404;
            status = "Not Found";
            break;
          case postErrors.MONGO_ERR:
            message = "Internal server error";
            statusCode = 500;
            status = "Internal Server Error";
            break;
        }
        return res.status(statusCode).json({
          status: status,
          message: message,
        });
      }

      res.status(200).json({
        status: "OK",
        data: post.doc,
      });
    } catch (err) {
      console.log("error in subredditservices " + err);
      res.status(500).json({
        status: "fail",
      });
    }
  };

  postActions = async (req, res) => {
    const postId = req.params.postId;
    const action = req.params.action;

    const validActions = [
      "lock_comments",
      "unlock_comments",
      "mark_nsfw",
      "unmark_nsfw",
      "spoiler",
      "unspoiler",
    ];
    if (!validActions.includes(action)) {
      res.status(400).json({
        status: "fail",
        message: "Invalid post action",
      });
      return;
    }

    const success = await this.postServices.postAction(postId, action);
    if (success) res.status(204).json({});
    else
      res.status(409).json({
        status: "fail",
        message: "Action already performed",
      });
  };

  moderatePost = async (req, res) => {
    const postId = req.params.postId;
    const action = req.params?.action;

    const validActions = ["approve", "remove", "spam"];
    if (!validActions.includes(action)) {
      res.status(400).json({
        status: "fail",
        message: "Invalid post moderation action",
      });
      return;
    }

    const success = await this.postServices.modAction(postId, action);
    if (success) res.status(204).json({});
    else
      res.status(409).json({
        status: "fail",
        message: "Action is already performed",
      });
  };

  followPost = async (req, res) => {};
  suggestedSort = async (req, res) => {};

  spam = async (req, res) => {
    const postId = req.params?.postId;
    const dir = req.body.dir || 1;

    if (!postId || !dir) {
      res.status(400).json({
        status: "fail",
        message: "Invalid request",
      });
      return;
    }

    const { success, error } = await this.postServices.spam(
      postId,
      req.user._id, dir
    );
    if (!success) {
      let msg, stat;
      switch (error) {
        case postErrors.POST_NOT_FOUND:
          msg = "Post not found";
          stat = 404;
          break;
        case postErrors.ACTION_ALREADY_DONE:
          msg = "Action already performed";
          stat = 409;
          break;
      }
      res.status(stat).json({
        status: "fail",
        message: msg,
      });
      return;
    }

    res.status(204).json({});
  };

  mustBeMod = async (req, res, next) => {
    const postId = req.params?.postId;
    const userId = req.user._id;

    if (!postId) {
      res.status(400).send({ status: "fail", message: "Invalid request" });
      return;
    }

    const { success, error } = await this.postServices.isMod(postId, userId);

    if (!success) {
      switch (error) {
        case postErrors.POST_NOT_FOUND:
          res.status(404).send({ status: "fail", message: "Post not found" });
          break;
        case postErrors.NOT_MOD:
          res.status(401).send({
            status: "fail",
            message: "User must be moderator",
          });
          break;
        case postErrors.OWNER_NOT_SUBREDDIT:
          res.status(400).send({
            status: "fail",
            message: "The post must belong to a subreddit",
          });
          break;
      }
      return;
    }

    next();
  };

  mustBeAuthOrMod = async (req, res, next) => {
    const postId = req.params?.postId;

    if (!postId) {
      res.status(400).send({ status: "fail", message: "Invalid request" });
      return;
    }
    const userId = req.user._id;

    const { success, error } = await this.postServices.isAuthOrMod(
      postId,
      userId
    );

    if (!success) {
      switch (error) {
        case postErrors.POST_NOT_FOUND:
          res.status(404).send({ status: "fail", message: "Post not found" });
          break;
        case postErrors.NOT_AUTHOR_OR_MOD:
          res.status(401).send({
            status: "fail",
            message: "User must be author or moderator",
          });
          break;
      }
      return;
    }

    next();
  };
}

module.exports = PostController;
