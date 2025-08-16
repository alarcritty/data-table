import mongoose, { Schema } from "mongoose";
import fs from "fs";
import path from "path";

const counterSchema = new Schema({
  _id: { type: String, required: true },
  sequence_value: { type: Number, default: 0 }
});


async function getNextSequenceValue() {
  const User = mongoose.model('User');

  const existingUsers = await User.find({}, { id: 1 }).sort({ id: 1 }).lean();
  const existingIds = existingUsers.map(user => user.id).filter(id => id != null);

  if (existingIds.length === 0) {
    return 1;
  }

  for (let i = 1; i <= existingIds.length + 1; i++) {
    if (!existingIds.includes(i)) {
      return i;
    }
  }

  return existingIds.length + 1;
}

async function renumberUsersWithFiles() {
  const User = mongoose.model('User');
  const baseUploadsDir = "uploads/";

  const users = await User.find({}).sort({ id: 1 });

  const renumberingMap = new Map();

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const newId = i + 1;

    if (user.id !== newId) {
      renumberingMap.set(user.id, newId);

      const oldFolder = path.join(baseUploadsDir, `user_${user.id}`);
      const newFolder = path.join(baseUploadsDir, `user_${newId}`);

      if (fs.existsSync(oldFolder)) {
        if (!fs.existsSync(newFolder)) {
          fs.mkdirSync(newFolder, { recursive: true });
        }

        const files = fs.readdirSync(oldFolder);
        files.forEach(filename => {
          const oldPath = path.join(oldFolder, filename);
          const newFilename = filename.replace(new RegExp(`^${user.id}_`), `${newId}_`);
          const newPath = path.join(newFolder, newFilename);

          fs.renameSync(oldPath, newPath);
        });

        fs.rmSync(oldFolder, { recursive: true, force: true });
      }

      user.id = newId;
      await user.save();
    }
  }

  return renumberingMap;
}

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      unique: true,
      trim: true,
    },
    id: {
      type: Number,
      unique: true,
    },
    avatar1: {
      type: String,
      default: null,
      trim: true,
    },
    avatar2: {
      type: String,
      default: null,
      trim: true,
    },
    avatar3: {
      type: String,
      default: null,
      trim: true,
    },
    avatar4: {
      type: String,
      default: null,
      trim: true,
    },
    avatar5: {
      type: String,
      default: null,
      trim: true,
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
    },
    driverLicense: {
      type: String,
      required: function() {
        return this.age >= 18;
      },
      trim: true,
    }
  },
  {
    timestamps: true,
    runValidators: true
  },
);

userSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      this.id = await getNextSequenceValue('userId');
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

userSchema.post('save', function(error, doc, next) {
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    next(new Error(`Validation Error: ${errors.join(', ')}`));
  } else if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    next(new Error(`${field} '${value}' already exists`));
  } else {
    next(error);
  }
});

export const User = mongoose.model("User", userSchema);
export { renumberUsersWithFiles };
