const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const Post = require("./models/Post");
const Project = require("./models/Project");
const bcrypt = require("bcryptjs");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/" });
const fs = require("fs");

const salt = bcrypt.genSaltSync(10);
const secret = "asdalkjsfkalnvasnvaklfhfhaklhkanlnanlisdfsdoiowqrasf";

app.use(cors({ credentials: true, origin: "http://localhost:5173" }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

mongoose.connect(
  "mongodb+srv://azis:5lV1D4hBcBkQvc2e@cluster0.05efqtu.mongodb.net/"
);

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    res.status(400).json(e);
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  const passOk = userDoc
    ? bcrypt.compareSync(password, userDoc.password)
    : false;
  if (passOk) {
    // logged in
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      res.cookie("token", token).json({
        id: userDoc._id,
        username,
      });
    });
  } else if (userDoc) {
    res.status(400).json("wrong credentials");
  } else {
    res.status(400).json("wrong credentials");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split(".");
  const ext = parts[parts.length - 1];
  const newPath = path + "." + ext;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, summary, content, category } = req.body;

    const categories = JSON.parse(category);
    const postDoc = await Post.create({
      title,
      summary,
      content,
      categories,
      cover: newPath,
      author: info.id,
    });
    res.json(postDoc);
  });
});

app.put("/post/:id", uploadMiddleware.single("file"), async (req, res) => {
  const { id } = req.params;

  const { token } = req.cookies;
  try {
    const info = jwt.verify(token, secret);
    const postDoc = await Post.findById(id);

    const isAuthor = postDoc.author.equals(info.id);
    if (!isAuthor) {
      return res.status(400).json("You are not the author");
    }

    const { title, summary, content, category } = req.body;

    const categories = JSON.parse(category);

    postDoc.title = title;
    postDoc.summary = summary;
    postDoc.content = content;
    postDoc.categories = categories;
    if (req.file) {
      const { originalname } = req.file;
      const parts = originalname.split(".");
      const ext = parts[parts.length - 1];
      const newPath = req.file.path + "." + ext;
      fs.renameSync(req.file.path, newPath);
      postDoc.cover = newPath;
    }
    await postDoc.save();
    res.json(postDoc);
  } catch (err) {
    console.error(err);
    res.status(500).json("Server error");
  }
});

app.get("/post", async (req, res) => {
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});

app.delete("/post/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Cek apakah postingan dengan ID yang diberikan ada dalam database
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Postingan tidak ditemukan" });
    }

    // Lakukan pengecekan otorisasi, misalnya hanya pengguna tertentu yang dapat menghapus postingan
    // ...

    // Hapus postingan dari database
    await Post.deleteOne({ _id: id });

    res.json({ message: "Postingan berhasil dihapus" });
  } catch (error) {
    console.error("Terjadi kesalahan saat menghapus postingan:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat menghapus postingan" });
  }
});

app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  res.json(postDoc);
});

// project
app.post("/project", uploadMiddleware.single("file"), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split(".");
  const ext = parts[parts.length - 1];
  const newPath = path + "." + ext;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, description, tag, link } = req.body;

    const tags = JSON.parse(tag);
    const projectDoc = await Project.create({
      title,
      description,
      link,
      image: newPath,
      tag: tags,
      author: info.id,
    });
    res.json(projectDoc);
  });
});

app.put("/project/:id", uploadMiddleware.single("file"), async (req, res) => {
  const { id } = req.params;

  try {
    const projectDoc = await Project.findById(id);
    const { title, description, tag, link } = req.body;

    const tags = JSON.parse(tag);

    projectDoc.title = title;
    projectDoc.description = description;
    projectDoc.link = link;
    projectDoc.tag = tags;
    if (req.file) {
      const { originalname } = req.file;
      const parts = originalname.split(".");
      const ext = parts[parts.length - 1];
      const newPath = req.file.path + "." + ext;
      fs.renameSync(req.file.path, newPath);
      projectDoc.image = newPath;
    }
    await projectDoc.save();
    res.json(projectDoc);
  } catch (err) {
    console.error(err);
    res.status(500).json("Server error");
  }
});

app.get("/project", async (req, res) => {
  res.json(await Project.find().sort({ createdAt: -1 }).limit(20));
});

app.get("/project/:id", async (req, res) => {
  const { id } = req.params;
  const projectDoc = await Project.findById(id);
  res.json(projectDoc);
});

app.delete("/project/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Cek apakah postingan dengan ID yang diberikan ada dalam database
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: "Postingan tidak ditemukan" });
    }
    // Hapus postingan dari database
    await Project.deleteOne({ _id: id });

    res.json({ message: "Postingan berhasil dihapus" });
  } catch (error) {
    console.error("Terjadi kesalahan saat menghapus postingan:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat menghapus postingan" });
  }
});

app.listen(5000);
