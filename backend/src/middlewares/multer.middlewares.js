import multer from "multer";
import fs from "fs";
import path from "path";
import { User } from "../models/user.models.js";
import { v4 as uuidv4 } from "uuid";

const baseUploadsDir = "uploads/";
if (!fs.existsSync(baseUploadsDir)) {
  fs.mkdirSync(baseUploadsDir, { recursive: true });
}

const excelUploadsDir = "uploads/excel/";
if (!fs.existsSync(excelUploadsDir)) {
  fs.mkdirSync(excelUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: async function(req, file, cb) {
    let numericId;
    let userFolder;

    let userId = req.params.id || req.body.id || req.query.id;

    const isNewUser = req.body.isNewUser === 'true' || req.query.isNewUser === 'true';

    if (!userId && isNewUser) {
      if (!req.tempUserId) {
        req.tempUserId = uuidv4();
      }
      numericId = req.tempUserId;
      userFolder = path.join(baseUploadsDir, `temp_${numericId}`);
      req.numericUserId = numericId;
    } else if (userId) {
      try {
        const user = await User.findById(userId).lean();
        if (user && user.id) {
          numericId = user.id;
          req.numericUserId = numericId;
          userFolder = path.join(baseUploadsDir, `user_${numericId}`);
        } else {
          return cb(new Error(`User not found with ID: ${userId}`));
        }
      } catch (err) {
        return cb(new Error("Error fetching user data: " + err.message));
      }
    } else {
      return cb(new Error("User ID is required. Please provide user ID in URL parameter (:id), request body, query parameter, or set isNewUser=true for new user creation."));
    }

    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }

    cb(null, userFolder);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);

    let filename;
    const userId = req.numericUserId;

    if (!userId) {
      return cb(new Error("User ID not available during filename generation"));
    }

    filename = `${userId}_${file.fieldname}_${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

const excelStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, excelUploadsDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `users_bulk_${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function(req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    const validFieldNames = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5'];
    if (!validFieldNames.includes(file.fieldname)) {
      return cb(new Error(`Invalid field name: ${file.fieldname}. Expected one of: ${validFieldNames.join(', ')}`));
    }

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, JPG, PNG, GIF) are allowed!"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
});

const excelUpload = multer({
  storage: excelStorage,
  fileFilter: function(req, file, cb) {
    const allowedTypes = /xlsx|xls/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel';

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xlsx, .xls) are allowed!"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

const avatarFields = [
  { name: 'avatar1', maxCount: 1 },
  { name: 'avatar2', maxCount: 1 },
  { name: 'avatar3', maxCount: 1 },
  { name: 'avatar4', maxCount: 1 },
  { name: 'avatar5', maxCount: 1 }
];

const uploadAvatars = upload.fields(avatarFields);

const uploadExcel = excelUpload.single('excelFile');

const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB for images, 10MB for Excel files.' });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ error: 'Too many files. Maximum is 5 files for avatars, 1 for Excel.' });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ error: 'Unexpected field name in file upload.' });
      default:
        return res.status(400).json({ error: 'File upload error: ' + err.message });
    }
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

function addFullAvatarUrl(req, res, next) {
  const oldJson = res.json;
  res.json = function(data) {
    const backendURL = `${req.protocol}://${req.get("host")}`;

    const processAvatarUrls = (user) => {
      if (!user) return user;

      const idToUse = user.id || user._id;

      const avatarFields = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5'];
      avatarFields.forEach(field => {
        if (user[field]) {
          const urlField = `${field}Url`;
          user[urlField] = user[field].startsWith("http")
            ? user[field]
            : `${backendURL}/uploads/user_${idToUse}/${user[field]}`;
        }
      });

      if (user.avatar) {
        user.avatarUrl = `${backendURL}/uploads/user_${idToUse}/${user.avatar}`;
      }

      if (user.avatars && Array.isArray(user.avatars)) {
        user.avatarUrls = user.avatars.map((avatar) =>
          avatar.startsWith("http")
            ? avatar
            : `${backendURL}/uploads/user_${idToUse}/${avatar}`
        );
      }

      return user;
    };

    if (Array.isArray(data)) {
      data = data.map(processAvatarUrls);
    } else if (data && typeof data === "object") {
      data = processAvatarUrls(data);
    }

    return oldJson.call(this, data);
  };
  next();
}

function deleteExcelFile(filePath) {
  if (!filePath) return;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted Excel file: ${filePath}`);
    }
  } catch (error) {
    console.error('Error deleting Excel file:', error);
  }
}

function cleanupUserFiles(userId, keepCount = 10) {
  const userFolder = path.join(baseUploadsDir, `user_${userId}`);
  if (!fs.existsSync(userFolder)) return;

  fs.readdir(userFolder, (err, files) => {
    if (err) {
      return;
    }

    const fileStats = files
      .map((file) => {
        const filePath = path.join(userFolder, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          birthtime: stats.birthtime,
        };
      })
      .sort((a, b) => b.birthtime - a.birthtime);

    const filesToDelete = fileStats.slice(keepCount);
    filesToDelete.forEach((file) => {
      fs.unlink(file.path, (unlinkErr) => {
        if (!unlinkErr) {
        }
      });
    });
  });
}

function getUserFileCount(userId) {
  const userFolder = path.join(baseUploadsDir, `user_${userId}`);
  if (!fs.existsSync(userFolder)) return 0;

  try {
    const files = fs.readdirSync(userFolder);
    return files.length;
  } catch (error) {
    return 0;
  }
}

function deleteUserFiles(userId) {
  const userFolder = path.join(baseUploadsDir, `user_${userId}`);
  if (!fs.existsSync(userFolder)) return;

  try {
    const files = fs.readdirSync(userFolder);
    files.forEach((file) => {
      fs.unlinkSync(path.join(userFolder, file));
    });

    fs.rmdirSync(userFolder);
  } catch (error) {
  }
}

// Clean up temporary files
function deleteTemporaryFiles(tempUserId) {
  const tempFolder = path.join(baseUploadsDir, `temp_${tempUserId}`);
  if (!fs.existsSync(tempFolder)) return;

  try {
    const files = fs.readdirSync(tempFolder);
    files.forEach((file) => {
      fs.unlinkSync(path.join(tempFolder, file));
    });

    fs.rmdirSync(tempFolder);
  } catch (error) {
    console.error('Error deleting temporary files:', error);
  }
}

function processUploadedAvatars(files) {
  const avatarData = {};

  if (files) {
    ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5'].forEach(field => {
      if (files[field] && files[field][0]) {
        avatarData[field] = files[field][0].filename;
      }
    });
  }

  return avatarData;
}

function moveFilesToUserFolder(tempUserId, actualUserId) {
  const tempFolder = path.join(baseUploadsDir, `temp_${tempUserId}`);
  const userFolder = path.join(baseUploadsDir, `user_${actualUserId}`);

  if (!fs.existsSync(tempFolder)) return {};

  if (!fs.existsSync(userFolder)) {
    fs.mkdirSync(userFolder, { recursive: true });
  }

  const avatarData = {};

  try {
    const files = fs.readdirSync(tempFolder);

    files.forEach(filename => {
      const oldPath = path.join(tempFolder, filename);
      const newFilename = filename.replace(tempUserId, actualUserId);
      const newPath = path.join(userFolder, newFilename);

      fs.renameSync(oldPath, newPath);

      const fieldMatch = filename.match(/_avatar(\d+)_/);
      if (fieldMatch) {
        const fieldName = `avatar${fieldMatch[1]}`;
        avatarData[fieldName] = newFilename;
      }
    });

    fs.rmdirSync(tempFolder);
  } catch (error) {
    console.error('Error moving files to user folder:', error);
  }

  return avatarData;
}

export {
  upload,
  uploadAvatars,
  uploadExcel, // NEW: Export Excel upload middleware
  handleUploadErrors,
  addFullAvatarUrl,
  cleanupUserFiles,
  getUserFileCount,
  deleteUserFiles,
  deleteTemporaryFiles,
  deleteExcelFile, // NEW: Export Excel file cleanup function
  processUploadedAvatars,
  moveFilesToUserFolder,
};
