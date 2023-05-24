const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const ProjectSchema = new Schema(
  {
    title: String,
    description: String,
    image: String,
    link: String,
    tag: { type: [String] },
  },
  {
    timestamps: true,
  }
);

const ProjectModel = model("Project", ProjectSchema);

module.exports = ProjectModel;
