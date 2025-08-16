import React, { useState, useEffect } from "react";
import { PostUpdateUser } from "../services/api";

export default function PostForm({ onUserUpdated, activeUserId, setActiveUserId }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [id, setId] = useState("");
  const [age, setAge] = useState("");
  const [driverLicense, setDriverLicense] = useState("");

  const [avatarFiles, setAvatarFiles] = useState({
    avatar1: null,
    avatar2: null,
    avatar3: null,
    avatar4: null,
    avatar5: null
  });

  // Current avatar URLs from server
  const [currentAvatarUrls, setCurrentAvatarUrls] = useState({
    avatar1Url: null,
    avatar2Url: null,
    avatar3Url: null,
    avatar4Url: null,
    avatar5Url: null
  });

  const [responseMessage, setResponseMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function getUser(id) {
    fetch(`http://localhost:3000/api/users/${id}`)
      .then((res) => res.json())
      .then((data) => {
        const userData = data.data || data;
        setFirstName(userData.firstName || "");
        setLastName(userData.lastName || "");
        setEmail(userData.email || "");
        setPhone(userData.phone || "");
        setId(userData.id || "");
        setAge(userData.age || "");
        setDriverLicense(userData.driverLicense || "");

        setCurrentAvatarUrls({
          avatar1Url: userData.avatar1Url || null,
          avatar2Url: userData.avatar2Url || null,
          avatar3Url: userData.avatar3Url || null,
          avatar4Url: userData.avatar4Url || null,
          avatar5Url: userData.avatar5Url || null
        });
      })
      .catch((err) => console.error("Error fetching user data:", err));
  }

  useEffect(() => {
    if (activeUserId) getUser(activeUserId);
  }, [activeUserId]);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setId("");
    setAge("");
    setDriverLicense("");
    setAvatarFiles({
      avatar1: null,
      avatar2: null,
      avatar3: null,
      avatar4: null,
      avatar5: null
    });
    setCurrentAvatarUrls({
      avatar1Url: null,
      avatar2Url: null,
      avatar3Url: null,
      avatar4Url: null,
      avatar5Url: null
    });
    setActiveUserId("");

    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => input.value = '');
  };

  const validateImage = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const isValidSize = !(
          (img.width === 1200 && img.height === 400) ||
          img.width < 400 ||
          img.height < 200 ||
          img.width > 2000 ||
          img.height > 1000
        );

        if (!isValidSize) {
          alert(`Image "${file.name}" rejected. Must not be 1200x400, min 400x200, max 2000x1000.`);
          resolve(null);
        } else {
          resolve(file);
        }

        URL.revokeObjectURL(img.src);
      };
    });
  };

  const handleFileChange = async (avatarField, e) => {
    const file = e.target.files[0];
    if (!file) {
      setAvatarFiles(prev => ({ ...prev, [avatarField]: null }));
      return;
    }

    const validatedFile = await validateImage(file);
    if (validatedFile) {
      setAvatarFiles(prev => ({ ...prev, [avatarField]: validatedFile }));
    } else {
      e.target.value = '';
    }
  };

  const removeAvatar = (avatarField) => {
    setAvatarFiles(prev => ({ ...prev, [avatarField]: null }));
    const input = document.querySelector(`input[name="${avatarField}"]`);
    if (input) input.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setResponseMessage("");

    if (Number(age) >= 18 && !driverLicense) {
      alert("Driver License is required for users 18 or older");
      setIsLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("firstName", firstName);
      formData.append("lastName", lastName);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("age", Number(age));

      // Add the isNewUser flag for new user creation
      if (!activeUserId) {
        formData.append("isNewUser", "true");
      }

      if (Number(age) >= 18 && driverLicense) {
        formData.append("driverLicense", driverLicense);
      }

      // Append individual avatar files
      Object.entries(avatarFiles).forEach(([fieldName, file]) => {
        if (file) {
          formData.append(fieldName, file);
        }
      });

      const response = await PostUpdateUser(activeUserId || null, formData);

      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const message = result.message || (activeUserId ? "User updated successfully!" : "User created successfully!");
      const userData = result.data || result.user || result;

      setResponseMessage(message);

      // Update the displayed ID with the auto-generated one for new users
      if (!activeUserId && userData && userData.id) {
        setId(userData.id);
        // Set the activeUserId to the newly created user's ID for subsequent updates
        setActiveUserId(userData.id || userData._id);
      }

      // Update current avatar URLs
      if (userData) {
        setCurrentAvatarUrls({
          avatar1Url: userData.avatar1Url || null,
          avatar2Url: userData.avatar2Url || null,
          avatar3Url: userData.avatar3Url || null,
          avatar4Url: userData.avatar4Url || null,
          avatar5Url: userData.avatar5Url || null
        });
      }

      // Clear file inputs after successful submission
      setAvatarFiles({
        avatar1: null,
        avatar2: null,
        avatar3: null,
        avatar4: null,
        avatar5: null
      });

      const fileInputs = document.querySelectorAll('input[type="file"]');
      fileInputs.forEach(input => input.value = '');

      if (onUserUpdated) onUserUpdated();
    } catch (error) {
      let errorMessage = error.message || "An error occurred";

      // Try to extract error message from response if it's a fetch error
      if (error.message.includes('HTTP error')) {
        errorMessage = `Server error (${error.message})`;
      }

      setResponseMessage(
        activeUserId ? "Error updating user: " + errorMessage : "Error creating user: " + errorMessage
      );
      console.error('Full error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAvatarInput = (avatarField, index) => {
    const currentUrl = currentAvatarUrls[`${avatarField}Url`];
    const newFile = avatarFiles[avatarField];

    return (
      <div key={avatarField} className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Avatar {index + 1}
        </label>

        {/* Current avatar preview */}
        {activeUserId && currentUrl && !newFile && (
          <div className="mb-2">
            <div className="text-xs text-gray-500 mb-1">Current:</div>
            <img
              src={currentUrl}
              alt={`Current Avatar ${index + 1}`}
              className="w-16 h-16 rounded-full object-cover border border-gray-300"
            />
          </div>
        )}

        {/* New file preview */}
        {newFile && (
          <div className="mb-2">
            <div className="text-xs text-gray-500 mb-1">New:</div>
            <div className="flex items-center gap-2">
              <img
                src={URL.createObjectURL(newFile)}
                alt={`Preview Avatar ${index + 1}`}
                className="w-16 h-16 rounded-full object-cover border border-gray-300"
              />
              <button
                type="button"
                onClick={() => removeAvatar(avatarField)}
                className="text-red-500 hover:text-red-700 text-sm"
                disabled={isLoading}
              >
                Remove
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {newFile.name.length > 20 ? newFile.name.substring(0, 17) + '...' : newFile.name}
            </div>
          </div>
        )}

        {/* File input */}
        <input
          type="file"
          name={avatarField}
          accept="image/*"
          onChange={(e) => handleFileChange(avatarField, e)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
          disabled={isLoading}
        />
      </div>
    );
  };

  return (
    <div className="max-w-lg mx-auto mt-8 p-8 bg-white shadow-md rounded">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {activeUserId ? "Update User" : "Add User"}
      </h1>

      {/* Display User ID (read-only) */}
      {id && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
          <label className="block text-gray-700 text-sm font-bold mb-2">User ID</label>
          <div className="text-lg font-semibold text-indigo-600">#{id}</div>
          <p className="text-xs text-gray-500 mt-1">Auto-generated ID</p>
        </div>
      )}

      <form onSubmit={handleSubmit} encType="multipart/form-data">
        {/* First Name */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">First Name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Enter first name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
            required
            disabled={isLoading}
          />
        </div>

        {/* Last Name */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Last Name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Enter last name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
            required
            disabled={isLoading}
          />
        </div>

        {/* Email */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
            required
            disabled={isLoading}
          />
        </div>

        {/* Phone */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter phone number"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
            required
            disabled={isLoading}
          />
        </div>

        {/* Age */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Age</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Enter age"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
            required
            disabled={isLoading}
          />
        </div>

        {/* Driver License */}
        {Number(age) >= 18 && (
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">Driver License *</label>
            <input
              type="text"
              value={driverLicense}
              onChange={(e) => setDriverLicense(e.target.value)}
              placeholder="Enter driver license"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
              required
              disabled={isLoading}
            />
          </div>
        )}

        {/* Avatar Upload Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Avatars</h3>
          <p className="text-xs text-gray-500 mb-4">
            Supported formats: JPEG, JPG, PNG, GIF (Min: 400x200, Max: 2000x1000)
          </p>

          {/* Render 5 avatar inputs */}
          <div className="space-y-4">
            {['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5'].map((avatarField, index) =>
              renderAvatarInput(avatarField, index)
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full font-bold py-2 px-4 rounded focus:outline-none ${isLoading
            ? "bg-gray-400 text-gray-600 cursor-not-allowed"
            : "bg-indigo-500 text-white hover:bg-indigo-700 focus:bg-indigo-700"
            }`}
        >
          {isLoading ? (activeUserId ? "Updating..." : "Creating...") : (activeUserId ? "Update User" : "Create User")}
        </button>

        {/* Cancel/Reset - Only show reset button during editing mode */}
        {activeUserId && !isLoading && (
          <button
            type="button"
            onClick={resetForm}
            className="w-full mt-2 bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded hover:bg-gray-400 focus:outline-none"
          >
            Cancel
          </button>
        )}
      </form>

      {/* Response message */}
      {responseMessage && (
        <div className={`mt-4 p-3 rounded ${responseMessage.includes("Error")
          ? "bg-red-100 border border-red-300 text-red-700"
          : "bg-green-100 border border-green-300 text-green-700"
          }`}>
          <p className="text-sm text-center">{responseMessage}</p>
        </div>
      )}
    </div>
  );
}
