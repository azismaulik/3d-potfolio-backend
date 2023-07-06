const cloudinary = require("cloudinary").v2;
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
const uploadMiddleware = multer({ dest: "tmp/" });
const fs = require("fs");
require("dotenv").config();

const salt = bcrypt.genSaltSync(10);
const secret = process.env.SECRET;

app.use(
  cors({
    credentials: true,
    origin: ["http://localhost:5173", "http://localhost:3000"],
  })
);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

mongoose.connect(process.env.MONGODB_URL);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.get("/", async (req, res) => {
  res.status(200).json({
    message: "Hello from Azis Portfolio API!",
  });
});

app.post("/api/v1/register", async (req, res) => {
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

app.post("/api/v1/login", async (req, res) => {
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

app.get("/api/v1/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post("/api/v1/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

app.post("/api/v1/post", uploadMiddleware.single("file"), async (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, summary, content, category } = req.body;
    const file = req.file;
    const photoUrl = await cloudinary.uploader.upload(file.path);

    const categories = JSON.parse(category);
    const postDoc = await Post.create({
      title,
      summary,
      content,
      categories,
      cover: photoUrl.secure_url,
    });

    // Menghapus file yang diunggah
    fs.unlinkSync(file.path);
    res.json(postDoc);
  });
});

app.put(
  "/api/v1/post/:id",
  uploadMiddleware.single("file"),
  async (req, res) => {
    const { id } = req.params;
    const { token } = req.cookies;
    try {
      const postDoc = await Post.findById(id);
      const { title, summary, content, category } = req.body;
      const categories = JSON.parse(category);

      postDoc.title = title;
      postDoc.summary = summary;
      postDoc.content = content;
      postDoc.categories = categories;

      if (req.file) {
        const photoUrl = await cloudinary.uploader.upload(req.file.path);
        postDoc.cover = photoUrl.secure_url;
        fs.unlinkSync(req.file.path); // Menghapus file setelah diunggah ke Cloudinary
      }

      await postDoc.save();
      res.json(postDoc);
    } catch (err) {
      console.error(err);
      res.status(500).json("Server error");
    }
  }
);

app.get("/api/v1/post", async (req, res) => {
  res.json(await Post.find().sort({ createdAt: -1 }).limit(20));
});

app.delete("/api/v1/post/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Cek apakah postingan dengan ID yang diberikan ada dalam database
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Postingan tidak ditemukan" });
    }

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

app.get("/api/v1/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id);
  res.json(postDoc);
});

// project
app.post(
  "/api/v1/project",
  uploadMiddleware.single("file"),
  async (req, res) => {
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
      if (err) throw err;

      const { title, description, tag, link } = req.body;

      try {
        const photoUrl = await cloudinary.uploader.upload(req.file.path);
        const tags = JSON.parse(tag);

        const projectDoc = await Project.create({
          title,
          description,
          link,
          image: photoUrl.secure_url,
          tag: tags,
        });

        fs.unlinkSync(req.file.path); // Menghapus file setelah diunggah ke Cloudinary

        res.json(projectDoc);
      } catch (error) {
        console.error(error);
        res.status(500).json("Server error");
      }
    });
  }
);

app.put(
  "/api/v1/project/:id",
  uploadMiddleware.single("file"),
  async (req, res) => {
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
        const photoUrl = await cloudinary.uploader.upload(req.file.path);
        projectDoc.image = photoUrl.secure_url;
        fs.unlinkSync(req.file.path); // Menghapus file setelah diunggah ke Cloudinary
      }

      await projectDoc.save();
      res.json(projectDoc);
    } catch (err) {
      console.error(err);
      res.status(500).json("Server error");
    }
  }
);

app.get("/api/v1/project", async (req, res) => {
  res.json(await Project.find().sort({ createdAt: -1 }).limit(20));
});

app.get("/api/v1/project/:id", async (req, res) => {
  const { id } = req.params;
  const projectDoc = await Project.findById(id);
  res.json(projectDoc);
});

app.delete("/api/v1/project/:id", async (req, res) => {
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
