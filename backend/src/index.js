
import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { userRoute } from "./routes/user.routes.js";
import { fileURLToPath } from 'url';
import path from "path";

dotenv.config({
  path: './.env',
});

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use("/api/users", userRoute);

app.get("/", (req, res) => {
  res.send("Hello API SERVER");
});

const port = process.env.PORT || 3000;
const mongodb_uri = process.env.MONGODB_URI
mongoose
  .connect(
    mongodb_uri
  )
  .then(() => {
    console.log("Connected to database!");
    app.listen(port, () => {
      console.log(`Server is running on port ${port}, http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.log("Connection Failed:", error);
  });
