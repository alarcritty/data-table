
const API_URL = import.meta.env.VITE_API_URL;
const API_ROUTE = import.meta.env.VITE_API_ROUTE
export async function fetchData(url, method = "GET", body = {}) {
  const options = { method };

  if (method !== "GET") {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }
  }

  return fetch(`${API_URL}${url}`, options);
}

export const deleteUser = async (id) => fetchData(`${API_ROUTE}${id}`, "DELETE");

export const PostUpdateUser = async (activeUserId, userData) => {
  let url = activeUserId ? `${API_ROUTE}${activeUserId}` : `${API_ROUTE}`;
  let method = activeUserId ? "PUT" : "POST";

  let body = userData instanceof FormData ? userData : userData;

  const options = { method };
  if (body instanceof FormData) {
    options.body = body;
  } else {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${url}`, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Network response was not ok: ${response.status} - ${errorText}`);
  }
  return response;
};

export const PostUserWithFile = async (userData, file) => {
  const formData = new FormData();
  Object.keys(userData).forEach((key) => formData.append(key, userData[key]));
  if (file) formData.append("file", file);

  const response = await fetch(`${API_URL}${API_ROUTE}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Network response was not ok: ${response.status} - ${errorText}`);
  }

  return response;
};

export const UpdateUser = async (userId, userData) => {
  const response = await fetch(`${API_URL}${API_ROUTE}${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Network response was not ok: ${response.status} - ${errorText}`);
  }

  return response;
};
