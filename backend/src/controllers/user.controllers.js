import { User } from "../models/user.models.js";
import path from "path";
import fs from "fs";
import XLSX from 'xlsx';
import {
  processUploadedAvatars,
  moveFilesToUserFolder,
  deleteTemporaryFiles,
  deleteExcelFile
} from "../middlewares/multer.middlewares.js";

const getAvatarUrls = (req, user, userId) => {
  if (!user) return {};

  const avatarUrls = {};
  const avatarFields = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5'];

  avatarFields.forEach(field => {
    const avatar = user[field];
    if (avatar) {
      if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
        avatarUrls[`${field}Url`] = avatar;
      } else if (avatar.startsWith("/uploads/")) {
        avatarUrls[`${field}Url`] = `${req.protocol}://${req.get("host")}${avatar}`;
      } else {
        avatarUrls[`${field}Url`] = `${req.protocol}://${req.get("host")}/uploads/user_${userId}/${avatar}`;
      }
    }
  });

  return avatarUrls;
};

const deleteFile = (filename, userId = null) => {
  if (!filename) return;
  let filePath;
  if (filename.startsWith("/uploads/")) {
    filePath = path.join(".", filename);
  } else if (userId) {
    filePath = path.join("uploads", `user_${userId}`, filename);
  } else {
    filePath = path.join("uploads", filename);
  }
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error(`Error deleting file: ${filePath}`, err);
      else console.log(`Deleted file: ${filePath}`);
    });
  }
};

const deleteUserFolder = (userId) => {
  const userFolder = path.join("uploads", `user_${userId}`);
  if (!fs.existsSync(userFolder)) return;
  try {
    const files = fs.readdirSync(userFolder);
    files.forEach(file => {
      fs.unlinkSync(path.join(userFolder, file));
    });
    fs.rmdirSync(userFolder);
    console.log(`Deleted user folder: ${userFolder}`);
  } catch (error) {
    console.error(`Error deleting user folder ${userFolder}:`, error);
  }
};

// NEW: Function to validate Excel data
const validateUserData = (userData, rowIndex) => {
  const errors = [];

  // Required fields validation
  if (!userData.firstName) errors.push(`Row ${rowIndex}: Missing firstName`);
  if (!userData.lastName) errors.push(`Row ${rowIndex}: Missing lastName`);
  if (!userData.email) errors.push(`Row ${rowIndex}: Missing email`);
  if (!userData.phone) errors.push(`Row ${rowIndex}: Missing phone`);
  if (!userData.age) errors.push(`Row ${rowIndex}: Missing age`);

  // Age validation
  if (userData.age && (isNaN(userData.age) || userData.age < 0 || userData.age > 120)) {
    errors.push(`Row ${rowIndex}: Invalid age (${userData.age})`);
  }

  // Driver license validation for users 18+
  if (userData.age >= 18 && !userData.driverLicense) {
    errors.push(`Row ${rowIndex}: Driver License required for age 18+`);
  }

  // Email format validation (basic)
  if (userData.email && !/\S+@\S+\.\S+/.test(userData.email)) {
    errors.push(`Row ${rowIndex}: Invalid email format`);
  }

  return errors;
};

// NEW: Function to process Excel data
const processExcelData = (filePath) => {
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Get first sheet
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    if (!rawData || rawData.length === 0) {
      throw new Error('Excel file is empty or has no data');
    }

    // Process and validate each row
    const processedData = [];
    const validationErrors = [];

    rawData.forEach((row, index) => {
      const rowIndex = index + 2; // Excel row number (starting from 2, assuming row 1 is headers)

      // Map Excel columns to your database fields
      // Adjust these field names based on your Excel headers
      const userData = {
        firstName: row['First Name'] || row['firstName'] || row['first_name'] || row['FirstName'],
        lastName: row['Last Name'] || row['lastName'] || row['last_name'] || row['LastName'],
        email: row['Email'] || row['email'],
        phone: row['Phone'] || row['phone'] || row['Phone Number'] || row['PhoneNumber'],
        age: parseInt(row['Age'] || row['age']),
        driverLicense: row['Driver License'] || row['driverLicense'] || row['driver_license'] || row['DriverLicense']
      };

      // Clean up the data (remove undefined/null values)
      Object.keys(userData).forEach(key => {
        if (userData[key] === undefined || userData[key] === null || userData[key] === '') {
          delete userData[key];
        }
      });

      // Validate the data
      const errors = validateUserData(userData, rowIndex);

      if (errors.length > 0) {
        validationErrors.push(...errors);
      } else {
        processedData.push(userData);
      }
    });

    return { processedData, validationErrors };

  } catch (error) {
    throw new Error(`Error processing Excel file: ${error.message}`);
  }
};

export const getUser = async (req, res) => {
  try {
    let { page = 1, limit = 10, sortBy = "id", order = "asc", firstName, lastName, phone, email } = req.query;
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const orderValue = order === "desc" ? -1 : 1;
    const sortOptions = {};
    sortOptions[sortBy] = orderValue;
    const searchConditions = [];
    if (firstName) searchConditions.push({ firstName: { $regex: firstName, $options: "i" } });
    if (lastName) searchConditions.push({ lastName: { $regex: lastName, $options: "i" } });
    if (email) searchConditions.push({ email: { $regex: email, $options: "i" } });
    if (phone) searchConditions.push({ phone: { $regex: phone, $options: "i" } });
    const searchQuery = searchConditions.length > 0 ? { $and: searchConditions } : {};
    const users = await User.find(searchQuery)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await User.countDocuments(searchQuery);

    const transformedUsers = users.map(user => {
      const userObj = user.toObject();
      const userId = userObj.id || userObj._id;
      const avatarUrls = getAvatarUrls(req, userObj, userId);
      return { ...userObj, ...avatarUrls };
    });

    res.status(200).json({
      data: transformedUsers,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalUsers: total,
    });
  } catch (error) {
    console.error("Error in getUser:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getUserId = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const userObj = user.toObject();
    const userId = userObj.id || userObj._id;
    const avatarUrls = getAvatarUrls(req, userObj, userId);

    res.status(200).json({ ...userObj, ...avatarUrls });
  } catch (error) {
    console.error("Error in getUserId:", error);
    res.status(500).json({ message: error.message });
  }
};

export const postUser = async (req, res) => {
  try {
    if (Array.isArray(req.body)) {
      return await createMultipleUsers(req, res);
    }

    const { firstName, lastName, email, phone, age, driverLicense, isNewUser } = req.body;

    if (!firstName || !lastName || !email || !phone || !age) {
      if (req.tempUserId) {
        deleteTemporaryFiles(req.tempUserId);
      }
      return res.status(400).json({
        success: false,
        message: "Missing required fields: firstName, lastName, email, phone, age"
      });
    }

    if (Number(age) >= 18 && !driverLicense) {
      if (req.tempUserId) {
        deleteTemporaryFiles(req.tempUserId);
      }
      return res.status(400).json({
        success: false,
        message: "Driver License is required for users 18 or older"
      });
    }

    const avatarData = processUploadedAvatars(req.files);

    const userData = {
      firstName,
      lastName,
      email,
      phone,
      age: Number(age),
      ...avatarData
    };

    if (Number(age) >= 18 && driverLicense) {
      userData.driverLicense = driverLicense;
    }

    const newUser = new User(userData);
    await newUser.save();

    let finalAvatarData = {};
    if (req.tempUserId && Object.keys(avatarData).length > 0) {
      finalAvatarData = moveFilesToUserFolder(req.tempUserId, newUser.id);

      if (Object.keys(finalAvatarData).length > 0) {
        await User.findByIdAndUpdate(newUser._id, finalAvatarData);
        Object.assign(newUser, finalAvatarData);
      }
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: newUser,
      user: newUser
    });

  } catch (error) {
    if (req.tempUserId) {
      deleteTemporaryFiles(req.tempUserId);
    }

    console.error("Error creating user:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating user",
      error: error.message
    });
  }
};

const createMultipleUsers = async (req, res) => {
  try {
    const users = req.body;
    const results = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const { firstName, lastName, email, phone, age, driverLicense } = user;

      if (!firstName || !lastName || !email || !phone || !age) {
        errors.push({
          index: i,
          user: user,
          error: "Missing required fields: firstName, lastName, email, phone, age"
        });
        continue;
      }

      if (Number(age) >= 18 && !driverLicense) {
        errors.push({
          index: i,
          user: user,
          error: "Driver License is required for users 18 or older"
        });
        continue;
      }

      try {
        const userData = {
          firstName,
          lastName,
          email,
          phone,
          age: Number(age)
        };

        if (Number(age) >= 18 && driverLicense) {
          userData.driverLicense = driverLicense;
        }

        const newUser = new User(userData);
        await newUser.save();

        results.push({
          success: true,
          user: newUser,
          index: i
        });

      } catch (error) {
        console.error(`Error creating user at index ${i}:`, error);

        let errorMessage = "Error creating user";
        if (error.code === 11000) {
          const field = Object.keys(error.keyPattern)[0];
          errorMessage = `${field} already exists`;
        } else if (error.name === 'ValidationError') {
          const messages = Object.values(error.errors).map(err => err.message);
          errorMessage = `Validation Error: ${messages.join(', ')}`;
        }

        errors.push({
          index: i,
          user: user,
          error: errorMessage
        });
      }
    }

    const response = {
      success: results.length > 0,
      message: `Processed ${users.length} users: ${results.length} created, ${errors.length} failed`,
      created: results,
      failed: errors,
      summary: {
        total: users.length,
        successful: results.length,
        failed: errors.length
      }
    };

    const statusCode = errors.length === users.length ? 400 :
      errors.length > 0 ? 207 : 201;

    res.status(statusCode).json(response);

  } catch (error) {
    console.error("Error in bulk user creation:", error);
    res.status(500).json({
      success: false,
      message: "Error processing bulk user creation",
      error: error.message
    });
  }
};

// NEW: Excel upload endpoint
export const uploadUsersFromExcel = async (req, res) => {
  let uploadedFilePath = null;

  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No Excel file uploaded. Please upload a .xlsx or .xls file"
      });
    }

    uploadedFilePath = req.file.path;

    console.log(`Processing Excel file: ${req.file.originalname}`);

    // Process the Excel file
    const { processedData, validationErrors } = processExcelData(uploadedFilePath);

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      // Clean up the uploaded file
      deleteExcelFile(uploadedFilePath);

      return res.status(400).json({
        success: false,
        message: "Validation errors found in Excel data",
        errors: validationErrors,
        totalRows: processedData.length + (validationErrors.length / 2) // Rough estimate
      });
    }

    // If no valid data to process
    if (processedData.length === 0) {
      // Clean up the uploaded file
      deleteExcelFile(uploadedFilePath);

      return res.status(400).json({
        success: false,
        message: "No valid user data found in Excel file"
      });
    }

    // Create users in database
    const results = [];
    const dbErrors = [];

    for (let i = 0; i < processedData.length; i++) {
      try {
        const newUser = new User(processedData[i]);
        await newUser.save();
        results.push({
          success: true,
          user: newUser,
          rowIndex: i + 2 // Excel row number
        });
      } catch (error) {
        console.error(`Error creating user from row ${i + 2}:`, error);

        let errorMessage = "Error creating user";
        if (error.code === 11000) {
          const field = Object.keys(error.keyPattern)[0];
          errorMessage = `${field} already exists: ${processedData[i][field]}`;
        } else if (error.name === 'ValidationError') {
          const messages = Object.values(error.errors).map(err => err.message);
          errorMessage = `Validation Error: ${messages.join(', ')}`;
        }

        dbErrors.push({
          rowIndex: i + 2,
          userData: processedData[i],
          error: errorMessage
        });
      }
    }

    // Clean up the uploaded Excel file
    deleteExcelFile(uploadedFilePath);

    // Prepare response
    const response = {
      success: results.length > 0,
      message: `Excel processing complete: ${results.length} users created, ${dbErrors.length} failed`,
      fileName: req.file.originalname,
      summary: {
        totalRows: processedData.length,
        successful: results.length,
        failed: dbErrors.length
      },
      createdUsers: results.map(r => ({
        id: r.user._id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        email: r.user.email,
        rowIndex: r.rowIndex
      })),
      failedUsers: dbErrors
    };

    // Return appropriate status code
    const statusCode = dbErrors.length === processedData.length ? 400 :
      dbErrors.length > 0 ? 207 : 201;

    res.status(statusCode).json(response);

  } catch (error) {
    // Clean up the uploaded file if there was an error
    if (uploadedFilePath) {
      deleteExcelFile(uploadedFilePath);
    }

    console.error("Error in Excel upload:", error);
    res.status(500).json({
      success: false,
      message: "Error processing Excel file",
      error: error.message
    });
  }
};

export const putUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, age, driverLicense } = req.body;
    const currentUser = await User.findById(id);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const numericUserId = currentUser.id;
    const newAge = age ? parseInt(age) : currentUser.age;
    const newDriverLicense = driverLicense !== undefined ? driverLicense : currentUser.driverLicense;
    if (newAge >= 18 && !newDriverLicense) {
      return res.status(400).json({ message: "Driver License is required for users 18 or older" });
    }

    const updateData = {
      firstName: firstName || currentUser.firstName,
      lastName: lastName || currentUser.lastName,
      email: email || currentUser.email,
      phone: phone || currentUser.phone,
      age: newAge,
      driverLicense: newDriverLicense,
    };

    if (req.files && Object.keys(req.files).length > 0) {
      console.log('PUT: Replacing avatars with new files');
      const avatarFields = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5'];
      avatarFields.forEach(field => {
        if (req.files[field] && currentUser[field]) {
          deleteFile(currentUser[field], numericUserId);
        }
      });
      const newAvatarData = processUploadedAvatars(req.files);
      Object.assign(updateData, newAvatarData);
    }

    const user = await User.findByIdAndUpdate(id, updateData, { new: true });
    const userObj = user.toObject();
    const avatarUrls = getAvatarUrls(req, userObj, numericUserId);

    res.status(200).json({
      message: "User updated successfully",
      data: { ...userObj, ...avatarUrls },
      filesUploaded: req.files ? Object.keys(req.files).length : 0,
      userFolder: `user_${numericUserId}`
    });
  } catch (error) {
    console.error("Error in putUser:", error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) return res.status(404).json({ message: "User not found" });

    const userId = deletedUser.id || deletedUser._id;

    const avatarFields = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5'];
    avatarFields.forEach(field => {
      if (deletedUser[field]) {
        deleteFile(deletedUser[field], userId);
      }
    });

    deleteUserFolder(userId);

    res.status(200).json({
      message: `User deleted successfully`,
      deletedUser: {
        id: deletedUser._id,
        firstName: deletedUser.firstName,
        lastName: deletedUser.lastName
      }
    });
  } catch (error) {
    console.error("Error in deleteUser:", error);
    res.status(500).json({ message: error.message });
  }
};

export const patchUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { avatarField } = req.body;
    const currentUser = await User.findById(id);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const numericUserId = currentUser.id;
    const uploadedFiles = req.files ? Object.keys(req.files) : [];
    if (uploadedFiles.length !== 1) {
      return res.status(400).json({
        message: "PATCH requires exactly one avatar field to be updated"
      });
    }

    const fieldToUpdate = uploadedFiles[0];
    if (!avatarField || avatarField !== fieldToUpdate) {
      return res.status(400).json({
        message: `avatarField parameter must match the uploaded field: ${fieldToUpdate}`
      });
    }

    const validFields = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5'];
    if (!validFields.includes(fieldToUpdate)) {
      return res.status(400).json({
        message: `Invalid avatar field. Must be one of: ${validFields.join(', ')}`
      });
    }

    console.log(`PATCH: Replacing ${fieldToUpdate} for user ${numericUserId}`);

    if (currentUser[fieldToUpdate]) {
      deleteFile(currentUser[fieldToUpdate], numericUserId);
    }

    const newAvatarData = processUploadedAvatars(req.files);
    const updateData = {
      [fieldToUpdate]: newAvatarData[fieldToUpdate]
    };

    const user = await User.findByIdAndUpdate(id, updateData, { new: true });
    const userObj = user.toObject();
    const avatarUrls = getAvatarUrls(req, userObj, numericUserId);

    res.status(200).json({
      message: `${fieldToUpdate} updated successfully`,
      data: { ...userObj, ...avatarUrls },
      updatedField: fieldToUpdate,
      userFolder: `user_${numericUserId}`
    });
  } catch (error) {
    console.error("Error in patchUser:", error);
    res.status(500).json({ message: error.message });
  }
};
