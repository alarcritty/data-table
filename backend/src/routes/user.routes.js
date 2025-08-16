import { Router } from "express";
import { uploadAvatars, uploadExcel, addFullAvatarUrl, handleUploadErrors } from "../middlewares/multer.middlewares.js";
import {
  getUser,
  getUserId,
  postUser,
  patchUser,
  putUser,
  deleteUser,
  uploadUsersFromExcel
} from "../controllers/user.controllers.js";

const router = Router();

router.get("/", addFullAvatarUrl, getUser);
router.get("/:id", addFullAvatarUrl, getUserId);
router.post("/", uploadAvatars, handleUploadErrors, addFullAvatarUrl, postUser);

router.post("/upload-excel", uploadExcel, handleUploadErrors, uploadUsersFromExcel);

router.put("/:id", uploadAvatars, handleUploadErrors, addFullAvatarUrl, putUser);
router.patch('/:id', uploadAvatars, handleUploadErrors, patchUser);
router.delete("/:id", deleteUser);

export { router as userRoute };
