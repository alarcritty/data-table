import { useEffect, useState, useCallback } from "react";
import { fetchData, PostUpdateUser } from "../services/api";
import { useNavigate } from "react-router-dom";
import Cropper from "react-easy-crop";

const API_ROUTE = import.meta.env.VITE_API_ROUTE;

export default function UploadPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImage, setCropImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    async function loadAllUsers() {
      try {
        let allUsers = [];
        let page = 1;
        let totalPages = 1;

        do {
          const res = await fetchData(`${API_ROUTE}?page=${page}&limit=10`, "GET");
          const data = await res.json();

          allUsers = [...allUsers, ...(data?.data ?? [])];
          totalPages = data?.totalPages || 1;
          page++;
        } while (page <= totalPages);

        allUsers.sort((a, b) => Number(a.id || a._id) - Number(b.id || b._id));


        setUsers(allUsers);
      } catch (error) {
        console.error("Error fetching all users:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAllUsers();
  }, []);

  const getAvatarUrls = (user) => {
    if (user.avatarUrls && Array.isArray(user.avatarUrls) && user.avatarUrls.length > 0) {
      return user.avatarUrls;
    }

    const urls = [];
    const avatarFields = ['avatar1Url', 'avatar2Url', 'avatar3Url', 'avatar4Url', 'avatar5Url'];

    avatarFields.forEach(field => {
      if (user[field]) {
        urls.push(user[field]);
      }
    });

    if (urls.length > 0) {
      return urls;
    }

    if (user.avatarUrl) {
      urls.push(user.avatarUrl);
    }

    return urls;
  };

  const openCropper = (url, user, imageIndex) => {
    setCropImage(url);
    setCurrentUser(user);
    setCurrentImageIndex(imageIndex);
    setCropModalOpen(true);
  };

  const closeCropper = () => {
    setCropModalOpen(false);
    setCropImage(null);
    setCurrentUser(null);
    setCurrentImageIndex(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = useCallback(async (imageSrc, pixelCrop, imageIndex) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          canvas.width = pixelCrop.width;
          canvas.height = pixelCrop.height;

          ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
          );

          canvas.toBlob((blob) => {
            if (blob) {
              const file = new File(
                [blob],
                `cropped_avatar_${imageIndex}_${Date.now()}.jpg`,
                { type: "image/jpeg" }
              );
              resolve(file);
            } else {
              reject(new Error("Failed to create cropped image blob"));
            }
          }, "image/jpeg", 0.9);
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error("Failed to load image for cropping"));
      image.src = imageSrc;
    });
  }, []);

  const saveCroppedImage = async () => {
    if (!croppedAreaPixels || !currentUser || currentImageIndex === null) {
      console.error("Missing required data for saving");
      return;
    }

    setSaving(true);

    try {
      const croppedFile = await createCroppedImage(cropImage, croppedAreaPixels, currentImageIndex);

      const formData = new FormData();
      formData.append("firstName", currentUser.firstName || "");
      formData.append("lastName", currentUser.lastName || "");
      formData.append("email", currentUser.email || "");
      formData.append("phone", currentUser.phone || "");
      formData.append("id", Number(currentUser.id || currentUser._id));
      formData.append("age", Number(currentUser.age || 0));
      if (currentUser.driverLicense) {
        formData.append("driverLicense", currentUser.driverLicense);
      }

      const avatarFieldName = `avatar${currentImageIndex + 1}`;
      formData.append(avatarFieldName, croppedFile);

      formData.append("cropReplace", "true");
      formData.append("replaceImageIndex", currentImageIndex.toString());

      const userId = currentUser._id;
      console.log("Attempting to update user with ID:", userId);
      console.log("Using avatar field name:", avatarFieldName);

      console.log("FormData contents:");
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value instanceof File ? `File: ${value.name}` : value);
      }

      const response = await PostUpdateUser(userId, formData);
      const result = await response.json();

      if (response.ok) {
        const userData = result.data || result.user || result;
        setUsers(prevUsers =>
          prevUsers.map(user =>
            (user.id || user._id) === (currentUser.id || currentUser._id)
              ? { ...user, ...userData, avatarUrls: userData.avatarUrls || user.avatarUrls }
              : user
          )
        );
        alert("Image cropped and saved successfully!");
        closeCropper();
      } else {
        throw new Error(result.message || "Failed to save cropped image");
      }
    } catch (error) {
      console.error("Error saving cropped image:", error);
      alert(`Failed to save the cropped image: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="p-4">Loading...</p>;

  return (
    <div className="p-6">
      <button
        onClick={() => navigate("/")}
        className="mb-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow"
      >
        ← Back to Home
      </button>

      <h1 className="text-2xl font-bold mb-4">Uploaded Users (All)</h1>


      <table className="min-w-full border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-4 py-2">ID</th>
            <th className="border px-4 py-2">Avatars</th>
            <th className="border px-4 py-2">Avatar URLs</th>
          </tr>
        </thead>
        <tbody>
          {users.length > 0 ? (
            users.map((user) => {
              const avatarUrls = getAvatarUrls(user);
              return (
                <tr key={user.id || user._id}>
                  <td className="border px-4 py-2">{user.id || user._id}</td>
                  <td className="border px-4 py-2">
                    {avatarUrls.length > 0 ? (
                      <div className="flex flex-wrap gap-4">
                        {avatarUrls.map((url, idx) => (
                          <div key={idx} className="relative">
                            <img
                              src={url}
                              alt={`Avatar ${idx + 1}`}
                              className="w-40 h-28 object-cover rounded-lg border cursor-pointer hover:scale-105 transition-transform"
                              onClick={() => openCropper(url, user, idx)}
                              onError={(e) => {
                                console.error(`Failed to load image: ${url}`);
                                e.target.style.border = '2px solid red';
                                e.target.style.opacity = '0.5';
                              }}
                            />
                            <div className="absolute top-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                              {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-red-500">No Avatars Found</span>
                    )}
                  </td>
                  <td className="border px-4 py-2">
                    {avatarUrls.length > 0 ? (
                      <ul className="space-y-1">
                        {avatarUrls.map((url, idx) => (
                          <li key={idx}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 underline text-xs hover:text-blue-700"
                            >
                              View {idx + 1}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "N/A"
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="4" className="border px-4 py-2 text-center text-gray-500">
                No data found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Crop Modal */}
      {cropModalOpen && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={!saving ? closeCropper : undefined}
            aria-hidden="true"
          />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                       w-[95vw] max-w-[1200px] h-[85vh] min-h-[500px]
                       bg-white rounded-xl shadow-xl overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Image cropper"
          >
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="text-lg font-semibold">
                Crop Avatar {currentImageIndex !== null ? currentImageIndex + 1 : ''}{" "}
                {currentUser && `for User ${currentUser.id || currentUser._id}`}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Field name: <code className="bg-gray-200 px-1 rounded">avatar{currentImageIndex !== null ? currentImageIndex + 1 : ''}</code>
              </p>
            </div>
            <div className="relative flex-1">
              {cropImage && (
                <Cropper
                  image={cropImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={4 / 3}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>
            <div className="px-4 py-3 border-t flex items-center gap-4">
              <label className="text-sm whitespace-nowrap">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
                disabled={saving}
              />
              <button
                onClick={closeCropper}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={saveCroppedImage}
                disabled={saving || !croppedAreaPixels}
                className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                {saving ? "Saving..." : "Save & Replace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
