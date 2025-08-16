import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";
import Header from "./components/Header";
import PostForm from "./Operations/PostForm";
import UserTable from "./components/userTable";

const API_URL = import.meta.env.VITE_API_URL;
const API_ROUTE = import.meta.env.VITE_API_ROUTE;

function App() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [page, setPage] = useState(1);
  const limit = 10;

  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  const [activeUserId, setActiveUserId] = useState("");
  const [showPostForm, setShowPostForm] = useState(false);

  const [searchFirstName, setSearchFirstName] = useState("");
  const [searchLastName, setSearchLastName] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [searchPhone, setSearchPhone] = useState("");

  const [tempFirstName, setTempFirstName] = useState("");
  const [tempLastName, setTempLastName] = useState("");
  const [tempEmail, setTempEmail] = useState("");
  const [tempPhone, setTempPhone] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [order, setOrder] = useState("asc");

  // Loading and error states for file upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  useEffect(() => {
    getUsers();
  }, [page, sortBy, order, searchFirstName, searchLastName, searchEmail, searchPhone]);

  useEffect(() => {
    if (activeUserId) {
      setShowPostForm(true);
    }
  }, [activeUserId]);

  function getUsers() {
    const params = new URLSearchParams({
      page,
      limit,
      sortBy,
      order,
    });

    if (searchFirstName) params.append("firstName", searchFirstName);
    if (searchLastName) params.append("lastName", searchLastName);
    if (searchEmail) params.append("email", searchEmail);
    if (searchPhone) params.append("phone", searchPhone);

    fetch(`${API_URL}${API_ROUTE}?${params.toString()}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d.data);
        setTotalPages(d.totalPages);
        setTotalUsers(d.totalUsers);

        if (page > d.totalPages && d.totalPages > 0) {
          setPage(1);
        }
      })
      .catch((err) => console.error("Error fetching users:", err));
  }

  const handleFileUpload = () => {
    // Trigger the hidden file input
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (!allowedTypes.includes(file.type)) {
      setUploadMessage("Error: Please select a valid Excel file (.xlsx or .xls)");
      setTimeout(() => setUploadMessage(""), 5000);
      // Clear the file input
      event.target.value = '';
      return;
    }

    // Validate file size (e.g., max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      setUploadMessage("Error: File size too large. Please select a file smaller than 10MB");
      setTimeout(() => setUploadMessage(""), 5000);
      // Clear the file input
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('excelFile', file); // Must match your multer field name 'excelFile'

    // Debug the file and FormData
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified)
    });
    console.log('FormData entries:');
    for (let pair of formData.entries()) {
      console.log(pair[0], pair[1]);
    }

    setIsUploading(true);
    setUploadMessage("");

    try {
      // Debug URL construction
      const uploadUrl = `${API_URL}${API_ROUTE}/upload-excel`;
      console.log('Upload URL:', uploadUrl);
      console.log('API_URL:', API_URL);
      console.log('API_ROUTE:', API_ROUTE);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let the browser set it for FormData
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      let result;
      let responseText;

      // Try to get the response text first
      try {
        responseText = await response.text();
        console.log('Response text:', responseText);
      } catch (textError) {
        console.error('Error reading response text:', textError);
        throw new Error('Unable to read server response');
      }

      // Try to parse as JSON
      try {
        result = responseText ? JSON.parse(responseText) : {};
        console.log('Parsed result:', result);
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        console.log('Raw response:', responseText);
        throw new Error(`Server error: ${responseText || 'Invalid response format'}`);
      }

      if (response.ok) {
        setUploadMessage(`Success: ${result.message || `Successfully uploaded ${result.count || ''} users!`}`);
        // Refresh the users table to show new data
        getUsers();
        // Reset pagination to first page to see new users
        setPage(1);
      } else {
        // Handle different error status codes with detailed logging
        const errorMessage = result.message || result.error || result.details || responseText || 'Upload failed';
        console.error('Server error details:', {
          status: response.status,
          message: errorMessage,
          fullResult: result
        });

        if (response.status === 400) {
          setUploadMessage(`Error (400): ${errorMessage}`);
        } else if (response.status === 413) {
          setUploadMessage("Error: File too large");
        } else if (response.status === 415) {
          setUploadMessage("Error: Unsupported file type");
        } else {
          setUploadMessage(`Error (${response.status}): ${errorMessage}`);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setUploadMessage('Error: Unable to connect to server. Please check your connection.');
      } else {
        setUploadMessage(`Error: ${error.message || 'Network error occurred during upload'}`);
      }
    } finally {
      setIsUploading(false);
      // Clear the file input regardless of success/failure
      event.target.value = '';
      // Clear message after 7 seconds (slightly longer for error messages)
      setTimeout(() => setUploadMessage(""), 7000);
    }
  };

  const handleToggleForm = () => {
    setShowPostForm(!showPostForm);
    if (showPostForm) {
      setActiveUserId("");
    }
  };

  const handleUploadsClick = () => {
    navigate("/upload");
  };

  const handleFormClose = () => {
    setShowPostForm(false);
    setActiveUserId("");
  };

  const goToPage = (pageNum) => {
    if (pageNum < 1 || pageNum > totalPages) return;
    setPage(pageNum);
  };

  const handleSearch = () => {
    setSearchFirstName(tempFirstName);
    setSearchLastName(tempLastName);
    setSearchEmail(tempEmail);
    setSearchPhone(tempPhone);
    setPage(1);
  };

  const handleReset = () => {
    setTempFirstName("");
    setTempLastName("");
    setTempEmail("");
    setTempPhone("");

    setSearchFirstName("");
    setSearchLastName("");
    setSearchEmail("");
    setSearchPhone("");
    setPage(1);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen flex">
        <div
          className={`${showPostForm ? "w-2/3" : "w-full"} p-6 overflow-auto transition-all duration-300`}
        >
          {/* Add User Button */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={handleToggleForm}
              className={`px-4 py-2 rounded-lg font-medium ${showPostForm
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
                } transition-colors duration-200`}
            >
              {showPostForm ? "Hide Form" : "Add New User"}
            </button>

            <button
              onClick={handleUploadsClick}
              className="px-4 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 shadow-md"
            >
              Uploads
            </button>

            <button
              onClick={handleFileUpload}
              disabled={isUploading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 shadow-md flex items-center gap-2 ${isUploading
                  ? "bg-gray-400 cursor-not-allowed text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
            >
              {isUploading && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isUploading ? "Uploading..." : "Import Excel"}
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {/* Upload Message */}
          {uploadMessage && (
            <div
              className={`mb-4 p-3 rounded-lg ${uploadMessage.startsWith('Success')
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-red-100 text-red-700 border border-red-300'
                }`}
            >
              {uploadMessage}
            </div>
          )}

          {/* Multiple Search Inputs */}
          <div className="flex flex-col md:flex-row gap-2 mb-4">
            <input
              type="text"
              value={tempFirstName}
              onChange={(e) => setTempFirstName(e.target.value)}
              placeholder="First Name"
              className="px-3 py-2 border border-gray-300 rounded-lg flex-grow"
            />
            <input
              type="text"
              value={tempLastName}
              onChange={(e) => setTempLastName(e.target.value)}
              placeholder="Last Name"
              className="px-3 py-2 border border-gray-300 rounded-lg flex-grow"
            />
            <input
              type="text"
              value={tempEmail}
              onChange={(e) => setTempEmail(e.target.value)}
              placeholder="Email"
              className="px-3 py-2 border border-gray-300 rounded-lg flex-grow"
            />
            <input
              type="number"
              value={tempPhone}
              onChange={(e) => setTempPhone(e.target.value)}
              placeholder="Phone"
              className="px-3 py-2 border border-gray-300 rounded-lg flex-grow"
            />
            <button
              onClick={handleSearch}
              className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition-colors duration-200"
            >
              Search
            </button>
            <button
              onClick={handleReset}
              className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition-colors duration-200"
            >
              Reset
            </button>
          </div>

          {/* Users Table */}
          <UserTable
            users={data}
            setActiveUserId={setActiveUserId}
            getUsers={getUsers}
            sortBy={sortBy}
            order={order}
            setSortBy={setSortBy}
            setOrder={setOrder}
          />

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
              >
                Previous
              </button>

              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`px-3 py-1 rounded border border-gray-300 ${pageNum === page
                      ? "bg-indigo-500 text-white"
                      : "hover:bg-indigo-100"
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Form - Only show when showPostForm is true */}
        {showPostForm && (
          <div className="w-1/3 border-l border-gray-300">
            <PostForm
              activeUserId={activeUserId}
              setActiveUserId={setActiveUserId}
              onUserUpdated={getUsers}
              onFormClose={handleFormClose}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default App;
